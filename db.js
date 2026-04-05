const mongoose = require("mongoose")

/* =========================
   🔑 URI
========================= */
const MONGO_URI = process.env.MONGO_URI

if (!MONGO_URI) {
  console.error("❌ ERROR: MONGO_URI no está definida en variables de entorno")
  process.exit(1)
}

/* =========================
   🔌 CONEXIÓN
========================= */
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ Mongo conectado"))
.catch(err => {
  console.error("❌ Error MongoDB:", err.message)
  process.exit(1)
})

/* =========================
   ⚠️ EVENTOS
========================= */
mongoose.connection.on("connected", () => {
  console.log("🟢 MongoDB conectado correctamente")
})

mongoose.connection.on("error", err => {
  console.error("❌ Error de conexión:", err.message)
})

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB desconectado")
})

/* =========================
   🛑 CIERRE LIMPIO
========================= */
process.on("SIGINT", async () => {
  await mongoose.connection.close()
  console.log("🔴 MongoDB cerrado")
  process.exit(0)
})

module.exports = mongoose