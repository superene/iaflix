const express = require("express")
const cors = require("cors")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const path = require("path")
const multer = require("multer")
const fs = require("fs")
const cloudinary = require("cloudinary").v2

require("./db")
const User = require("./models/User")
const Serie = require("./models/Serie")

const app = express()

/* =========================
   ⚙️ CONFIG
========================= */
app.use(cors())
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, "public")))

/* =========================
   ☁️ CLOUDINARY
========================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

console.log("☁️ Cloudinary listo")

/* =========================
   📦 MULTER
========================= */
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB máximo
})

/* =========================
   🔑 SECRET
========================= */
const SECRET = process.env.JWT_SECRET || "clave_secreta"

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
   🔐 REGISTER
========================= */
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ mensaje: "Faltan datos" })
    }

    const existe = await User.findOne({ username: username.toLowerCase() })
    if (existe) {
      return res.status(400).json({ mensaje: "Usuario ya existe" })
    }

    const hash = bcrypt.hashSync(password, 10)

    const user = new User({
      username: username.toLowerCase(),
      password: hash
    })

    await user.save()

    res.json({ mensaje: "Usuario creado" })

  } catch (err) {
    console.error(err)
    res.status(500).json({ mensaje: "Error servidor" })
  }
})

/* =========================
   🔐 LOGIN USER
========================= */
app.post("/login-user", async (req, res) => {
  try {
    const user = await User.findOne({
      username: req.body.username.toLowerCase()
    })

    if (!user) return res.status(401).json({ mensaje: "No existe" })

    const valid = bcrypt.compareSync(req.body.password, user.password)
    if (!valid) return res.status(401).json({ mensaje: "Incorrecto" })

    const token = jwt.sign(
      { id: user._id, role: "user" },
      SECRET,
      { expiresIn: "7d" }
    )

    res.json({ token })

  } catch (err) {
    console.error(err)
    res.status(500).json({ mensaje: "Error servidor" })
  }
})

/* =========================
   🔐 LOGIN ADMIN
========================= */
app.post("/login", (req, res) => {
  if (req.body.username === "admin" && req.body.password === "1234") {
    const token = jwt.sign({ role: "admin" }, SECRET, { expiresIn: "2h" })
    return res.json({ token })
  }
  res.status(401).json({ mensaje: "Error login" })
})

/* =========================
   📺 SERIES
========================= */
app.get("/series", async (req, res) => {
  try {
    const data = await Serie.find().sort({ createdAt: -1 })
    res.json(data)
  } catch (err) {
    console.error(err)
    res.status(500).json({ mensaje: "Error obteniendo contenido" })
  }
})

/* =========================
   🗑️ DELETE
========================= */
app.delete("/serie/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ mensaje: "No autorizado" })
    }

    const eliminado = await Serie.findByIdAndDelete(req.params.id)

    if (!eliminado) {
      return res.status(404).json({ mensaje: "No encontrado" })
    }

    res.json({ mensaje: "Eliminado correctamente" })

  } catch (err) {
    console.error(err)
    res.status(500).json({ mensaje: "Error eliminando" })
  }
})

/* =========================
   📤 UPLOAD (ESTABLE)
========================= */
app.post("/upload", auth, upload.fields([
  { name: "video", maxCount: 1 },
  { name: "portada", maxCount: 1 }
]), async (req, res) => {

  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ mensaje: "No autorizado" })
    }

    if (!req.files?.video || !req.files?.portada) {
      return res.status(400).json({ mensaje: "Faltan archivos" })
    }

    console.log("FILES:", req.files)
    console.log("BODY:", req.body)

    const videoFile = req.files.video[0]
    const portadaFile = req.files.portada[0]

    console.log("📤 Subiendo video...")

    const videoUpload = await cloudinary.uploader.upload(videoFile.path, {
      resource_type: "video",
      folder: "iaflix"
    })

    console.log("📤 Subiendo portada...")

    const portadaUpload = await cloudinary.uploader.upload(portadaFile.path, {
      folder: "iaflix"
    })

    // 🧹 borrar archivos temporales
    fs.unlinkSync(videoFile.path)
    fs.unlinkSync(portadaFile.path)

    const serie = new Serie({
      titulo: req.body.titulo,
      descripcion: req.body.descripcion,
      tipo: req.body.tipo,
      video: videoUpload.secure_url,
      portada: portadaUpload.secure_url
    })

    await serie.save()

    res.json({ mensaje: "Subido PRO 🔥" })

  } catch (err) {
    console.error("💥 ERROR UPLOAD:", err)
    res.status(500).json({ mensaje: "Error servidor" })
  }
})

/* =========================
   🚀 SERVER
========================= */
const PORT = process.env.PORT || 10000

app.listen(PORT, () => {
  console.log("🔥 SERVER RUNNING " + PORT)
})