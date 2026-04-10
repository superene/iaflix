const mongoose = require("mongoose")

const MONGO_URI = process.env.MONGO_URI

if (!MONGO_URI) {
  console.error("❌ MONGO_URI no definida")
}

/* =========================
   🔌 CONEXIÓN SEGURA
========================= */
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI)
    console.log("✅ Mongo conectado")
  } catch (err) {
    console.error("❌ Error MongoDB:", err.message)
    // ❌ NO matar servidor
  }
}

connectDB()

/* =========================
   EVENTOS
========================= */
mongoose.connection.on("connected", () => {
  console.log("🟢 Mongo listo")
})

mongoose.connection.on("error", err => {
  console.error("❌ Mongo error:", err.message)
})

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ Mongo desconectado")
})

module.exports = mongoose