const express = require("express")
const cors = require("cors")
const multer = require("multer")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const path = require("path")

const { CloudinaryStorage } = require("multer-storage-cloudinary")
const cloudinary = require("cloudinary").v2

require("./db")
const User = require("./models/User")
const Serie = require("./models/Serie")

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

/* =========================
   🔑 SECRET
========================= */
const SECRET = process.env.JWT_SECRET || "clave_secreta"

/* =========================
   ☁️ CLOUDINARY
========================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "iaflix",
    resource_type: "auto"
  })
})

const upload = multer({ storage })

/* =========================
   🔒 AUTH
========================= */
function auth(req, res, next) {
  let token = req.headers.authorization

  if (!token) return res.status(403).json({ mensaje: "Sin token" })

  try {
    token = token.replace("Bearer ", "")
    req.user = jwt.verify(token, SECRET)
    next()
  } catch {
    return res.status(401).json({ mensaje: "Token inválido" })
  }
}

/* =========================
   🔐 LOGIN ADMIN
========================= */
app.post("/login", (req, res) => {
  if (req.body.username === "admin" && req.body.password === "1234") {
    const token = jwt.sign({ role: "admin" }, SECRET)
    return res.json({ token })
  }
  res.status(401).json({ mensaje: "Error login" })
})

/* =========================
   👤 /ME
========================= */
app.get("/me", auth, (req, res) => {
  if (req.user.role === "admin") {
    return res.json({ role: "admin" })
  }
  res.json({ role: "user" })
})

/* =========================
   📺 SERIES
========================= */
app.get("/series", async (req, res) => {
  try {
    const data = await Serie.find().sort({ createdAt: -1 })
    res.json(data)
  } catch (err) {
    console.error("SERIES ERROR:", err)
    res.status(500).json({ error: "Error obteniendo series" })
  }
})

/* =========================
   🗑️ ELIMINAR (FIX 404)
========================= */
app.delete("/serie/:id", auth, async (req, res) => {
  try {
    console.log("🗑️ ID:", req.params.id)

    if (req.user.role !== "admin") {
      return res.status(403).json({ mensaje: "No autorizado" })
    }

    const eliminado = await Serie.findByIdAndDelete(req.params.id)

    if (!eliminado) {
      return res.status(404).json({ mensaje: "No encontrado" })
    }

    res.json({ mensaje: "Eliminado correctamente" })

  } catch (err) {
    console.error("DELETE ERROR:", err)
    res.status(500).json({ mensaje: "Error eliminando" })
  }
})

/* =========================
   📤 UPLOAD (FIX REAL)
========================= */
app.post(
  "/upload",
  auth,
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "portada", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      console.log("BODY:", req.body)
      console.log("FILES:", req.files)

      if (req.user.role !== "admin") {
        return res.status(403).json({ mensaje: "No autorizado" })
      }

      if (!req.files || !req.files.video || !req.files.portada) {
        return res.status(400).json({
          mensaje: "Archivos faltantes",
          debug: req.files
        })
      }

      const videoUrl = req.files.video[0].path
      const portadaUrl = req.files.portada[0].path

      const serie = new Serie({
        titulo: req.body.titulo,
        descripcion: req.body.descripcion,
        tipo: req.body.tipo,
        portada: portadaUrl,
        video: videoUrl
      })

      await serie.save()

      res.json({
        mensaje: "Subido correctamente",
        video: videoUrl
      })

    } catch (err) {
      console.error("💥 ERROR UPLOAD:", err)

      res.status(500).json({
        mensaje: "Error upload",
        error: err.message
      })
    }
  }
)

/* =========================
   🚀 SERVER
========================= */
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("🔥 servidor corriendo en puerto " + PORT)
})