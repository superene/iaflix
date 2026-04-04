const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true // 🔥 evita duplicados tipo "Juan" vs "juan"
  },

  password: {
    type: String,
    required: true
  },

  // ⭐ FAVORITOS
  favoritos: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Serie"
    }
  ],

  // 🎬 HISTORIAL
  historial: [
    {
      serie: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Serie"
      },
      fecha: {
        type: Date,
        default: Date.now
      }
    }
  ], // 🔥 ← AQUÍ FALTABA LA COMA

  // 👤 PERFILES TIPO NETFLIX
  perfiles: [
    {
      nombre: {
        type: String,
        required: true
      },
      avatar: {
        type: String,
        default: "https://i.imgur.com/6VBx3io.png"
      }
    }
  ],

  // 🎯 PERFIL ACTIVO
  perfilActivo: {
    type: String,
    default: ""
  }

}, { timestamps: true })

module.exports = mongoose.model("User", userSchema)