const mongoose = require("mongoose")

const MONGO_URI = process.env.MONGO_URI

if (!MONGO_URI) {
  console.error("❌ MONGO_URI no definida")
}

/* =========================
   🔌 CONEXIÓN ROBUSTA
========================= */
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    })

    console.log("✅ Mongo conectado")

  } catch (err) {
    console.error("❌ Mongo ERROR:", err.message)

    // 🔁 reintento automático
    setTimeout(connectDB, 5000)
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