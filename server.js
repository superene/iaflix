const express = require("express")
const cors = require("cors")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const path = require("path")
const multer = require("multer")

// 🔥 CLOUDINARY (FALTABA ESTO)
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
app.use(express.static(path.join(__dirname, "public")))
app.use("/uploads", express.static(path.join(__dirname, "uploads")))

/* =========================
   ☁️ CLOUDINARY CONFIG
========================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

console.log("✅ Cloudinary listo")

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
   🏠 HOME
========================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
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
        { nombre: "Principal", avatar: "👤" },
        { nombre: "Niños", avatar: "🧸" }
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
        perfiles: [{ nombre: "Admin", avatar: "👑" }],
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
    const user = await User.findById(req.user.id)

    const perfil = user.perfiles.find(p => p.nombre === req.body.nombre)

    if (!perfil) {
      return res.status(400).json({ mensaje: "Perfil inválido" })
    }

    user.perfilActivo = perfil.nombre
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
   📤 UPLOAD FINAL
========================= */
const upload = multer({ dest: "uploads/" })

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

    const videoFile = req.files.video[0]
    const portadaFile = req.files.portada[0]

    const videoUpload = await cloudinary.uploader.upload(videoFile.path, {
      resource_type: "video"
    })

    const portadaUpload = await cloudinary.uploader.upload(portadaFile.path)

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
    console.error("UPLOAD ERROR:", err)
    res.status(500).json({
      mensaje: "Error servidor",
      error: err.message
    })
  }
})

/* =========================
   🚀 SERVER
========================= */
const PORT = process.env.PORT || 10000

app.listen(PORT, "0.0.0.0", () => {
  console.log("🔥 SERVER RUNNING " + PORT)
})