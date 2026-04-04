const express = require("express")
const cors = require("cors")
const multer = require("multer")
const path = require("path")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const fs = require("fs")

require("./db")
const User = require("./models/User")
const Serie = require("./models/Serie")

const app = express()
app.use(cors())
app.use(express.json())

const SECRET = "clave_secreta"

/* =========================
   📂 UPLOADS
========================= */
const uploadsPath = path.join(__dirname, "uploads")
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath)

app.use("/uploads", express.static(uploadsPath))

/* =========================
   📦 MULTER (PRO)
========================= */
const storage = multer.diskStorage({
  destination: uploadsPath,
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/\s+/g, "_")
    cb(null, Date.now() + "-" + cleanName)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 🔥 500MB tipo Netflix
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
    const hash = bcrypt.hashSync(req.body.password, 8)

    const user = new User({
      username: req.body.username.toLowerCase(),
      password: hash,
      favoritos: [],
      historial: [],
      perfiles: [
        { nombre: "Principal", avatar: "👤" },
        { nombre: "Niños", avatar: "🧸" }
      ],
      perfilActivo: "Principal"
    })

    await user.save()

    res.json({ mensaje: "Usuario creado" })
  } catch {
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
  } catch {
    res.status(500).json({ mensaje: "Error servidor" })
  }
})

/* =========================
   🔒 TOKEN
========================= */
function auth(req, res, next) {
  let token = req.headers["authorization"]

  if (!token) return res.status(403).json({ mensaje: "Sin token" })

  token = token.replace("Bearer ", "")

  try {
    req.user = jwt.verify(token, SECRET)
    next()
  } catch {
    res.status(401).json({ mensaje: "Token inválido" })
  }
}

/* =========================
   👤 ME (usuario + perfil)
========================= */
app.get("/me", auth, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      return res.json({ username: "admin", role: "admin" })
    }

    const user = await User.findById(req.user.id)

    res.json({
      username: user.username,
      perfiles: user.perfiles,
      perfilActivo: user.perfilActivo
    })
  } catch {
    res.status(500).json({})
  }
})

/* =========================
   📤 UPLOAD
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
      if (req.user.role !== "admin") {
        return res.status(403).json({ mensaje: "No autorizado" })
      }

      const serie = new Serie({
        titulo: req.body.titulo,
        descripcion: req.body.descripcion,
        tipo: req.body.tipo,
        portada: `http://localhost:3000/uploads/${req.files.portada[0].filename}`,
        video: `http://localhost:3000/uploads/${req.files.video[0].filename}`
      })

      await serie.save()

      res.json({ mensaje: "Subido" })
    } catch (err) {
      console.error(err)
      res.status(500).json({ mensaje: "Error upload" })
    }
  }
)

/* =========================
   📺 SERIES
========================= */
app.get("/series", async (req, res) => {
  const data = await Serie.find().sort({ createdAt: -1 })
  res.json(data)
})

/* =========================
   🗑️ ELIMINAR
========================= */
app.delete("/serie/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ mensaje: "No autorizado" })
    }

    const serie = await Serie.findById(req.params.id)
    if (!serie) return res.status(404).json({ mensaje: "No existe" })

    // borrar archivos
    const portadaPath = path.join(__dirname, "uploads", path.basename(serie.portada))
    const videoPath = path.join(__dirname, "uploads", path.basename(serie.video))

    if (fs.existsSync(portadaPath)) fs.unlinkSync(portadaPath)
    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath)

    await serie.deleteOne()

    res.json({ mensaje: "Eliminado" })
  } catch {
    res.status(500).json({ mensaje: "Error eliminando" })
  }
})

/* =========================
   ⭐ FAVORITOS
========================= */
app.post("/favoritos/:id", auth, async (req, res) => {
  const user = await User.findById(req.user.id)

  const existe = user.favoritos.some(id => id.toString() === req.params.id)

  if (existe) {
    user.favoritos = user.favoritos.filter(id => id.toString() !== req.params.id)
  } else {
    user.favoritos.push(req.params.id)
  }

  await user.save()
  res.json({ mensaje: "OK" })
})

app.get("/favoritos", auth, async (req, res) => {
  const user = await User.findById(req.user.id).populate("favoritos")
  res.json(user.favoritos)
})

/* =========================
   🎬 HISTORIAL (CONTINUAR VIENDO)
========================= */
app.post("/historial/:id", auth, async (req, res) => {
  const user = await User.findById(req.user.id)

  user.historial = user.historial.filter(
    h => h.serie.toString() !== req.params.id
  )

  user.historial.unshift({
    serie: req.params.id,
    tiempo: req.body.tiempo || 0
  })

  user.historial = user.historial.slice(0, 20)

  await user.save()
  res.json({})
})

app.get("/historial", auth, async (req, res) => {
  const user = await User.findById(req.user.id)
    .populate("historial.serie")

  res.json(user.historial)
})

/* =========================
   🚀 SERVER
========================= */
app.listen(3000, () => {
  console.log("🔥 http://localhost:3000")
})