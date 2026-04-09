const mongoose = require("mongoose")

const MONGO_URI = process.env.MONGO_URI

if (!MONGO_URI) {
  console.error("❌ ERROR: MONGO_URI no definida")
  process.exit(1)
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
      serverSelectionTimeoutMS: 10000, // evita cuelgues largos
      socketTimeoutMS: 45000
    })

    console.log("✅ Mongo conectado")

  } catch (err) {
    console.error("❌ Error MongoDB:", err.message)

    // 🔁 reintento automático (NO mata el server)
    setTimeout(connectDB, 5000)
  }
}

connectDB()

/* =========================
   ⚠️ EVENTOS
========================= */
mongoose.connection.on("connected", () => {
  console.log("🟢 MongoDB listo")
})

mongoose.connection.on("error", err => {
  console.error("❌ Error conexión:", err.message)
})

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ Mongo desconectado → reconectando...")
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