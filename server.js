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
app.use("/uploads", express.static(path.join(__dirname, "uploads")))

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

const upload = multer({
  storage: new CloudinaryStorage({
    cloudinary,
    params: async () => ({
      folder: "iaflix",
      resource_type: "auto"
    })
  })
})

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
  res.send("IAFLIX API 🚀")
})

/* =========================
   👤 REGISTER
========================= */
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body

    const existe = await User.findOne({ username })
    if (existe) return res.status(400).json({ mensaje: "Ya existe" })

    const hash = bcrypt.hashSync(password, 10)

    const user = new User({
      username,
      password: hash,
      perfiles: [{ nombre: "Principal", avatar: "👤" }],
      perfilActivo: "Principal"
    })

    await user.save()

    res.json({ mensaje: "Usuario creado" })

  } catch (err) {
    console.error(err)
    res.status(500).json({ mensaje: "Error servidor" })
  }
})
/* =========================
   🔐 LOGIN ADMIN (FIX)
========================= */
app.post("/login", (req, res) => {
  const { username, password } = req.body

  if (username === "admin" && password === "1234") {
    const token = jwt.sign(
      { role: "admin" },
      SECRET,
      { expiresIn: "2h" }
    )

    return res.json({ token })
  }

  res.status(401).json({ mensaje: "Credenciales incorrectas" })
})
/* =========================
   🔐 LOGIN USER
========================= */
app.post("/login-user", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.body.username })

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
    res.status(500).json({ mensaje: "Error servidor" })
  }
})

/* =========================
   👤 /ME
========================= */
app.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)

    res.json({
      username: user.username,
      perfiles: user.perfiles,
      perfilActivo: user.perfilActivo
    })

  } catch {
    res.status(500).json({ mensaje: "Error" })
  }
})

/* =========================
   🎭 PERFIL (FIX 502)
========================= */
app.post("/perfil", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)

    user.perfilActivo = req.body.nombre
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
  } catch {
    res.status(500).json({ error: "Error" })
  }
})

/* =========================
   📤 UPLOAD (100% ESTABLE)
========================= */
app.post("/upload", auth, (req, res) => {

  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "portada", maxCount: 1 }
  ])(req, res, async (err) => {

    if (err) {
      console.error(err)
      return res.status(500).json({ mensaje: err.message })
    }

    try {
      const video = req.files.video?.[0]?.path
      const portada = req.files.portada?.[0]?.path

      if (!video || !portada) {
        return res.status(400).json({ mensaje: "Faltan archivos" })
      }

      const serie = new Serie({
        titulo: req.body.titulo,
        descripcion: req.body.descripcion,
        tipo: req.body.tipo,
        video,
        portada
      })

      await serie.save()

      res.json({ mensaje: "OK" })

    } catch (err) {
      console.error(err)
      res.status(500).json({ mensaje: "Error interno" })
    }

  })
})

/* =========================
   🚨 ERROR GLOBAL
========================= */
app.use((err, req, res, next) => {
  console.error("ERROR GLOBAL:", err)
  res.status(500).json({ mensaje: "Error servidor" })
})

/* =========================
   🚀 SERVER
========================= */
const PORT = process.env.PORT || 10000

app.listen(PORT, "0.0.0.0", () => {
  console.log("🔥 corriendo en puerto " + PORT)
})