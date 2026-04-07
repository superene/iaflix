const contenedor = document.getElementById("contenedorSeries")
const player = document.getElementById("videoPlayer")

const token = localStorage.getItem("token")

let serieActual = null
let todas = []

// 🔐 Verificar login
if (!token) {
  window.location.href = "login-user.html"
}

/* =========================
   👤 USUARIO
========================= */
fetch("https://iaflix.onrender.com/me", {
  headers: { Authorization: "Bearer " + token }
})
.then(res => res.json())
.then(data => {
  if (data.username) {
    document.getElementById("userName").innerText = data.username
  }
})

/* =========================
   🔄 CARGAR SERIES
========================= */
async function cargarSeries() {
  try {
    const res = await fetch("https://iaflix.onrender.com/series")
    const data = await res.json()

    todas = data
    render(data)

    if (data.length > 0) {
      seleccionarSerie(data[0])
    }

  } catch (error) {
    console.error("Error cargando series:", error)
  }
}

/* =========================
   🎬 RENDER
========================= */
function render(data) {
  contenedor.innerHTML = ""

  if (!data.length) {
    contenedor.innerHTML = "<p>No hay contenido</p>"
    return
  }

  data.forEach(serie => {
    const div = document.createElement("div")
    div.classList.add("poster")

    div.innerHTML = `
      <img src="${serie.portada}" width="150">
      <p>${serie.titulo}</p>
    `

    div.onclick = () => seleccionarSerie(serie)

    contenedor.appendChild(div)
  })
}

/* =========================
   🎬 SELECCIONAR
========================= */
function seleccionarSerie(serie) {
  serieActual = serie

  document.getElementById("tituloHero").innerText = serie.titulo || "Sin título"
  document.getElementById("descHero").innerText = serie.descripcion || "Sin descripción"

  document.querySelector(".hero").style.backgroundImage = `url(${serie.portada})`
}

/* =========================
   ▶️ REPRODUCIR + HISTORIAL
========================= */
function reproducirHero() {
  if (!serieActual) return

  player.src = serieActual.video
  player.scrollIntoView({ behavior: "smooth" })

  player.play().catch(() => {})

  // 🎬 guardar historial
  fetch("https://iaflix.onrender.com/historial/" + serieActual._id, {
    method: "POST",
    headers: { Authorization: "Bearer " + token }
  })
}

/* =========================
   ⭐ FAVORITO
========================= */
function toggleFavorito() {
  if (!serieActual) return

  fetch("https://iaflix.onrender.com/favoritos/" + serieActual._id, {
    method: "POST",
    headers: { Authorization: "Bearer " + token }
  })

  alert("⭐ Guardado en favoritos")
}

/* =========================
   🔍 BUSCAR
========================= */
function buscar(texto) {
  texto = texto.toLowerCase().trim()

  if (!texto) {
    render(todas)
    return
  }

  const filtradas = todas.filter(s =>
    s.titulo.toLowerCase().includes(texto) ||
    (s.descripcion || "").toLowerCase().includes(texto)
  )

  render(filtradas)
}

/* =========================
   🎬 FILTRAR POR TIPO
========================= */
function filtrar(tipo) {
  const filtradas = todas.filter(s =>
    (s.tipo || "serie").toLowerCase().trim() === tipo.toLowerCase().trim()
  )

  if (!filtradas.length) {
    alert("No hay contenido en " + tipo)
  }

  render(filtradas)
}

/* =========================
   ⭐ VER FAVORITOS
========================= */
function verFavoritos() {
  fetch("https://iaflix.onrender.com/favoritos", {
    headers: { Authorization: "Bearer " + token }
  })
  .then(res => res.json())
  .then(data => render(data))
}

/* =========================
   🕓 VER HISTORIAL
========================= */
function verHistorial() {
  fetch("https://iaflix.onrender.com/historial", {
    headers: { Authorization: "Bearer " + token }
  })
  .then(res => res.json())
  .then(data => {
    const lista = data.map(h => h.serie)
    render(lista)
  })
}

/* =========================
   🏠 INICIO
========================= */
function inicio() {
  render(todas)
}

/* =========================
   🚀 INIT
========================= */
cargarSeries()