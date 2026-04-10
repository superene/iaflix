const mongoose = require("mongoose")

const MONGO_URI = process.env.MONGO_URI

if (!MONGO_URI) {
  console.error("❌ MONGO_URI no definida")
}

/* =========================
   🔧 CONFIG GLOBAL
========================= */
mongoose.set("strictQuery", true)

/* =========================
   🔌 CONEXIÓN ROBUSTA
========================= */
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // evita cuelgues largos
      socketTimeoutMS: 45000
    })

    console.log("✅ Mongo conectado")

  } catch (err) {
    console.error("❌ Error MongoDB:", err.message)

    // 🔁 Reintento automático (IMPORTANTE)
    setTimeout(connectDB, 5000)
  }
}

connectDB()

/* =========================
   ⚠️ EVENTOS
========================= */
mongoose.connection.on("connected", () => {
  console.log("🟢 Mongo listo")
})

mongoose.connection.on("error", err => {
  console.error("❌ Mongo error:", err.message)
})

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ Mongo desconectado")

  // 🔁 reconectar automáticamente
  setTimeout(connectDB, 5000)
})

mongoose.connection.on("reconnected", () => {
  console.log("🔁 Mongo reconectado")
})

/* =========================
   🛑 CIERRE LIMPIO
========================= */
process.on("SIGINT", async () => {
  await mongoose.connection.close()
  console.log("🔴 Mongo cerrado")
  process.exit(0)
})

module.exports = mongoose