const mongoose = require("mongoose")

const serieSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true,
    trim: true
  },

  descripcion: {
    type: String,
    default: "",
    trim: true
  },

  portada: {
    type: String,
    required: true
  },

  video: {
    type: String,
    required: true
  },

  // 🎬 Tipo de contenido
  tipo: {
    type: String,
    enum: ["serie", "pelicula", "musica", "anime"],
    default: "serie",
    lowercase: true,
    trim: true
  },

  // ⭐ Rating tipo Netflix
  rating: {
    type: Number,
    default: 0
  },

  // 🔥 Para "Continuar viendo"
  duracion: {
    type: Number, // en segundos
    default: 0
  }

}, {
  timestamps: true
})

module.exports = mongoose.model("Serie", serieSchema)