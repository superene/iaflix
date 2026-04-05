const mongoose = require("mongoose")

const MONGO_URI = process.env.MONGO_URI

if (!MONGO_URI) {
  console.error("❌ ERROR: MONGO_URI no definida")
  process.exit(1)
}

/* =========================
   🔌 CONEXIÓN
========================= */
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Mongo conectado"))
  .catch(err => {
    console.error("❌ Error MongoDB:", err.message)
    process.exit(1)
  })

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
  console.warn("⚠️ Mongo desconectado")
})

process.on("SIGINT", async () => {
  await mongoose.connection.close()
  console.log("🔴 Mongo cerrado")
  process.exit(0)
})

module.exports = mongoose