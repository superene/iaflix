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
const cloudConfigured =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

let upload

if (cloudConfigured) {
  console.log("✅ Cloudinary activo")

  const storage = new CloudinaryStorage({
    cloudinary,
    params: async () => ({
      folder: "iaflix",
      resource_type: "auto"
    })
  })

  upload = multer({ storage })
} else {
  console.log("⚠️ Cloudinary OFF (modo local)")
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
  res.send("IAFLIX backend funcionando 🚀")
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
      perfiles: [
        { nombre: "Principal", avatar: "👤" }
      ],
      perfilActivo: null,
      favoritos: [],
      historial: []
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
    res.status(500).json({ mensaje: "Error servidor" })
  }
})

/* =========================
   👤 /ME (FIX PERFIL)
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
   🎭 SELECCIONAR PERFIL
========================= */
app.post("/perfil", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)

    user.perfilActivo = req.body.nombre

    await user.save()

    res.json({ ok: true })

  } catch (err) {
    console.error(err)
    res.status(500).json({ mensaje: "Error perfil" })
  }
})

/* =========================
   📺 SERIES
========================= */
app.get("/series", async (req, res) => {
  const data = await Serie.find().sort({ createdAt: -1 })
  res.json(data)
})

/* =========================
   ⭐ FAVORITOS
========================= */
app.post("/favoritos/:id", auth, async (req, res) => {
  const user = await User.findById(req.user.id)

  if (!user.favoritos.includes(req.params.id)) {
    user.favoritos.push(req.params.id)
    await user.save()
  }

  res.json({ ok: true })
})

app.get("/favoritos", auth, async (req, res) => {
  const user = await User.findById(req.user.id).populate("favoritos")
  res.json(user.favoritos)
})

/* =========================
   🕓 HISTORIAL
========================= */
app.post("/historial/:id", auth, async (req, res) => {
  const user = await User.findById(req.user.id)

  user.historial.push({
    serie: req.params.id,
    tiempo: req.body.tiempo
  })

  await user.save()

  res.json({ ok: true })
})

app.get("/historial", auth, async (req, res) => {
  const user = await User.findById(req.user.id)
    .populate("historial.serie")

  res.json(user.historial)
})

/* =========================
   📤 UPLOAD
========================= */
app.post("/upload", auth, (req, res) => {

  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "portada", maxCount: 1 }
  ])(req, res, async (err) => {

    if (err) {
      return res.status(500).json({ mensaje: err.message })
    }

    try {
      const video = req.files.video[0].path
      const portada = req.files.portada[0].path

      const serie = new Serie({
        titulo: req.body.titulo,
        descripcion: req.body.descripcion,
        tipo: req.body.tipo,
        portada,
        video
      })

      await serie.save()

      res.json({ ok: true })

    } catch (e) {
      res.status(500).json({ mensaje: e.message })
    }

  })

})

/* =========================
   🚀 SERVER
========================= */
const PORT = process.env.PORT || 10000

app.listen(PORT, "0.0.0.0", () => {
  console.log("🔥 SERVER RUNNING " + PORT)
})