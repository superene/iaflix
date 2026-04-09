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

/* =========================
   📂 SERVIR FRONTEND
========================= */
app.use(express.static(path.join(__dirname, "public")))

/* =========================
   🔑 SECRET
========================= */
const SECRET = process.env.JWT_SECRET || "clave_secreta"

/* =========================
   ☁️ CLOUDINARY (FIX REAL)
========================= */
const cloudConfigured =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET

if (!cloudConfigured) {
  console.log("⚠️ Cloudinary NO configurado")
} else {
  console.log("✅ Cloudinary OK")
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

/* =========================
   📦 MULTER (SEGURO)
========================= */
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
  // fallback (NO CRASHEA)
  upload = multer({ dest: "uploads/" })
}

/* =========================
   🔒 AUTH
========================= */
function auth(req, res, next) {
  let token = req.headers["authorization"]

  if (!token) return res.status(403).json({ mensaje: "Sin token" })

  token = token.replace("Bearer ", "")

  try {
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
   👤 REGISTER
========================= */
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ mensaje: "Datos incompletos" })
    }

    const existe = await User.findOne({ username: username.toLowerCase() })
    if (existe) {
      return res.status(400).json({ mensaje: "Usuario ya existe" })
    }

    const hash = bcrypt.hashSync(password, 8)

    const user = new User({
      username: username.toLowerCase(),
      password: hash,
      favoritos: [],
      historial: [],
      perfiles: [
        { nombre: "Principal", avatar: "👤", tipo: "adulto" },
        { nombre: "Niños", avatar: "🧸", tipo: "infantil" }
      ],
      perfilActivo: null
    })

    await user.save()

    res.json({ mensaje: "Usuario creado" })

  } catch (err) {
    console.error("REGISTER ERROR:", err)
    res.status(500).json({ mensaje: "Error servidor" })
  }
})

/* =========================
   👤 LOGIN USER
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
        username: "admin",
        role: "admin",
        perfiles: [{ nombre: "Admin", avatar: "👑", tipo: "adulto" }],
        perfilActivo: "Admin"
      })
    }

    const user = await User.findById(req.user.id)

    if (!user) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" })
    }

    res.json({
      username: user.username,
      role: "user",
      perfiles: user.perfiles || [],
      perfilActivo: user.perfilActivo || null
    })

  } catch (err) {
    console.error("ME ERROR:", err)
    res.status(500).json({ mensaje: "Error servidor" })
  }
})

/* =========================
   🎭 PERFIL
========================= */
app.post("/perfil", auth, async (req, res) => {
  try {
    const { nombre } = req.body

    const user = await User.findById(req.user.id)

    const existe = user?.perfiles.find(p => p.nombre === nombre)

    if (!existe) {
      return res.status(400).json({ mensaje: "Perfil inválido" })
    }

    user.perfilActivo = nombre
    await user.save()

    res.json({ ok: true })

  } catch (err) {
    console.error("PERFIL ERROR:", err)
    res.status(500).json({ mensaje: "Error perfil" })
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
   📤 UPLOAD (ANTI CRASH)
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
      console.log("📥 BODY:", req.body)
      console.log("📂 FILES:", req.files)

      if (req.user.role !== "admin") {
        return res.status(403).json({ mensaje: "No autorizado" })
      }

      if (!req.files?.portada || !req.files?.video) {
        return res.status(400).json({
          mensaje: "Faltan archivos"
        })
      }

      const serie = new Serie({
        titulo: req.body.titulo,
        descripcion: req.body.descripcion,
        tipo: req.body.tipo,
        portada: req.files.portada[0].path,
        video: req.files.video[0].path
      })

      await serie.save()

      res.json({ mensaje: "Subido correctamente 🚀" })

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