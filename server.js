const express = require("express")
const cors = require("cors")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const path = require("path")
const multer = require("multer")

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

/* =========================
   ☁️ CLOUDINARY CONFIG
========================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

console.log("☁️ Cloudinary listo")

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
   📦 MULTER
========================= */
const upload = multer({ dest: "uploads/" })

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

    const hash = bcrypt.hashSync(password, 8)

    const user = new User({
      username,
      password: hash,
      perfiles: [
        { nombre: "Principal", avatar: "👤" }
      ],
      perfilActivo: null
    })

    await user.save()
    res.json({ mensaje: "Usuario creado" })

  } catch (err) {
    res.status(500).json({ mensaje: "Error servidor" })
  }
})

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
   👤 LOGIN USER
========================= */
app.post("/login-user", async (req, res) => {
  const user = await User.findOne({ username: req.body.username })

  if (!user) return res.status(401).json({ mensaje: "No existe" })

  const valid = bcrypt.compareSync(req.body.password, user.password)
  if (!valid) return res.status(401).json({ mensaje: "Incorrecto" })

  const token = jwt.sign({ id: user._id, role: "user" }, SECRET)

  res.json({ token })
})

/* =========================
   👤 /ME
========================= */
app.get("/me", auth, async (req, res) => {
  if (req.user.role === "admin") {
    return res.json({
      username: "admin",
      role: "admin",
      perfiles: [{ nombre: "Admin", avatar: "👑" }],
      perfilActivo: "Admin"
    })
  }

  const user = await User.findById(req.user.id)

  res.json({
    username: user.username,
    perfiles: user.perfiles,
    perfilActivo: user.perfilActivo
  })
})

/* =========================
   🎭 PERFIL
========================= */
app.post("/perfil", auth, async (req, res) => {
  const user = await User.findById(req.user.id)

  user.perfilActivo = req.body.nombre
  await user.save()

  res.json({ ok: true })
})

/* =========================
   📺 SERIES
========================= */
app.get("/series", async (req, res) => {
  const data = await Serie.find().sort({ createdAt: -1 })
  res.json(data)
})

/* =========================
   🗑️ DELETE (FIX 404)
========================= */
app.delete("/serie/:id", auth, async (req, res) => {
  await Serie.findByIdAndDelete(req.params.id)
  res.json({ mensaje: "Eliminado" })
})

/* =========================
   📤 UPLOAD (FUNCIONANDO)
========================= */
app.post("/upload", auth,
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "portada", maxCount: 1 }
  ]),
  async (req, res) => {
    try {

      if (req.user.role !== "admin") {
        return res.status(403).json({ mensaje: "No autorizado" })
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

      res.json({ mensaje: "Subido correctamente 🔥" })

    } catch (err) {
      console.error("UPLOAD ERROR:", err)
      res.status(500).json({ mensaje: "Error servidor" })
    }
  }
)

/* =========================
   🚀 SERVER
========================= */
const PORT = process.env.PORT || 10000

app.listen(PORT, () => {
  console.log("🔥 SERVER RUNNING " + PORT)
})