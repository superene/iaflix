const mongoose = require("mongoose")

const MONGO_URI = "mongodb://127.0.0.1:27017/netflix-clone"

/* =========================
   🔌 CONEXIÓN
========================= */
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("🟢 MongoDB conectado correctamente")
  })
  .catch(err => {
    console.error("❌ Error MongoDB:", err.message)
  })

/* =========================
   ⚠️ EVENTOS
========================= */
mongoose.connection.on("error", err => {
  console.error("❌ Error de conexión:", err)
})

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB desconectado")
})

process.on("SIGINT", async () => {
  await mongoose.connection.close()
  console.log("🔴 MongoDB cerrado")
  process.exit(0)
})

module.exports = mongoose