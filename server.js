const express = require("express")
const cors = require("cors")
const multer = require("multer")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")

const { CloudinaryStorage } = require("multer-storage-cloudinary")
const cloudinary = require("cloudinary").v2

require("./db")
const User = require("./models/User")
const Serie = require("./models/Serie")

const app = express()

/* =========================
   🔧 MIDDLEWARE
========================= */
app.use(cors())
app.use(express.json())

/* =========================
   🔐 SECRET
========================= */
const SECRET = process.env.JWT_SECRET || "clave_secreta"

/* =========================
   ☁️ CLOUDINARY CONFIG
========================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

/* =========================
   📦 MULTER CLOUDINARY
========================= */
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "iaflix",
    resource_type: "auto"
  }
})

const upload = multer({ storage })

/* =========================
   🏠 RUTA RAÍZ (IMPORTANTE)
========================= */
app.get("/", (req, res) => {
  res.send("🔥 IAFLIX API funcionando")
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

  } catch (err) {
    console.error(err)
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
    console.error(err)
    res.status(500).json({ mensaje: "Error servidor" })
  }
})

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
    res.status(401).json({ mensaje: "Token inválido" })
  }
}

/* =========================
   👤 ME
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

  } catch (err) {
    console.error(err)
    res.status(500).json({})
  }
})

/* =========================
   👤 PERFIL
========================= */
app.post("/perfil", auth, async (req, res) => {
  const user = await User.findById(req.user.id)
  user.perfilActivo = req.body.nombre
  await user.save()
  res.json({ ok: true })
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

      if (!req.files || !req.files.video || !req.files.portada) {
        return res.status(400).json({ mensaje: "Faltan archivos" })
      }

      const serie = new Serie({
        titulo: req.body.titulo,
        descripcion: req.body.descripcion,
        tipo: req.body.tipo,
        portada: req.files.portada[0].path,
        video: req.files.video[0].path
      })

      await serie.save()

      res.json({ mensaje: "Subido a Cloudinary ☁️" })

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
  try {
    const data = await Serie.find().sort({ createdAt: -1 })
    res.json(data)
  } catch (err) {
    console.error(err)
    res.status(500).json({ mensaje: "Error obteniendo series" })
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

    await Serie.findByIdAndDelete(req.params.id)
    res.json({ mensaje: "Eliminado" })

  } catch (err) {
    console.error(err)
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
   🎬 HISTORIAL
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
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("🔥 servidor corriendo en puerto " + PORT)
})