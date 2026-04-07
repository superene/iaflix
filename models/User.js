const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({

  // 👤 USUARIO
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
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

  // 🎬 HISTORIAL (PRO POR PERFIL)
  historial: [
    {
      serie: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Serie"
      },
      perfil: String, // 🔥 importante (quién lo vio)
      tiempo: Number, // ⏱ progreso del video
      fecha: {
        type: Date,
        default: Date.now
      }
    }
  ],

  // 👤 PERFILES TIPO NETFLIX PRO
  perfiles: [
    {
      nombre: {
        type: String,
        required: true
      },

      avatar: {
        type: String,
        default: "👤" // 🔥 mejor usar emoji
      },

      tipo: {
        type: String,
        enum: ["adulto", "infantil"],
        default: "adulto"
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