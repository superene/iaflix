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

/* =========================
   ⚙️ CONFIG
========================= */
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

// 🔥 IMPORTANTE: servir uploads local (fallback)
app.use("/uploads", express.static(path.join(__dirname, "uploads")))

/* =========================
   🔑 SECRET
========================= */
const SECRET = process.env.JWT_SECRET || "clave_secreta"

/* =========================
   ☁️ CLOUDINARY
========================= */
const cloudConfigured =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET

if (!cloudConfigured) {
  console.log("⚠️ Cloudinary NO configurado")
} else {
  console.log("✅ Cloudinary conectado")
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

let upload

if (cloudConfigured) {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
      folder: "iaflix",
      resource_type: "auto"
    })
  })

  upload = multer({ storage })
} else {
  upload = multer({ dest: "uploads/" })
}

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
   🏠 HOME
========================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

/* =========================
   👤 REGISTER (FIX 404)
========================= */
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ mensaje: "Datos incompletos" })
    }

    const existe = await User.findOne({
      username: username.toLowerCase()
    })

    if (existe) {
      return res.status(400).json({ mensaje: "Usuario ya existe" })
    }

    const hash = bcrypt.hashSync(password, 8)

    const user = new User({
      username: username.toLowerCase(),
      password: hash,
      perfiles: [
        { nombre: "Principal", avatar: "👤", tipo: "adulto" }
      ],
      perfilActivo: "Principal"
    })

    await user.save()

    res.json({ mensaje: "Usuario creado" })

  } catch (err) {
    console.error("REGISTER ERROR:", err)
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
   👤 LOGIN USER (FIX)
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
    console.error("LOGIN USER ERROR:", err)
    res.status(500).json({ mensaje: "Error servidor" })
  }
})

/* =========================
   👤 /ME
========================= */
app.get("/me", auth, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      return res.json({
        role: "admin",
        perfiles: [
          { nombre: "Admin", avatar: "👑" }
        ]
      })
    }

    const user = await User.findById(req.user.id)

    if (!user) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" })
    }

    res.json({
      role: "user",
      perfiles: user.perfiles || []
    })

  } catch (err) {
    console.error("ME ERROR:", err)
    res.status(500).json({ mensaje: "Error servidor" })
  }
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
   🗑️ ELIMINAR
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
    console.error("DELETE ERROR:", err)
    res.status(500).json({ mensaje: "Error eliminando" })
  }
})

/* =========================
   📤 UPLOAD (FIX FINAL)
========================= */
app.post("/upload", auth, (req, res) => {

  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "portada", maxCount: 1 }
  ])(req, res, async (err) => {

    if (err) {
      console.error("💥 MULTER ERROR:", err)
      return res.status(500).json({ mensaje: err.message })
    }

    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ mensaje: "No autorizado" })
      }

      if (!req.files?.video || !req.files?.portada) {
        return res.status(400).json({ mensaje: "Faltan archivos" })
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

      res.json({ mensaje: "Subido correctamente 🚀" })

    } catch (error) {
      console.error("💥 ERROR:", error)
      res.status(500).json({ mensaje: error.message })
    }

  })

})

/* =========================
   🚨 ERROR GLOBAL (ANTI 502)
========================= */
app.use((err, req, res, next) => {
  console.error("💥 ERROR GLOBAL:", err)
  res.status(500).json({ mensaje: "Error interno servidor" })
})

/* =========================
   🚀 SERVER
========================= */
const PORT = process.env.PORT || 10000

app.listen(PORT, "0.0.0.0", () => {
  console.log("🔥 servidor corriendo en puerto " + PORT)
})