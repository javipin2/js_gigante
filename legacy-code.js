// Mampanos Pizza - Sistema de Gestión Optimizado
const L = window.L

// Define initMapModule como una función global al principio del script
// Esta asignación debe estar aquí, fuera del DOMContentLoaded, para que Google Maps la encuentre.
window.initMap = initMapModule

function initMapModule() {
  console.log("initMapModule ha sido llamado por la API de Google Maps.")
  const mapContainer = document.getElementById("map")
  if (!mapContainer) {
    console.warn("Contenedor del mapa no encontrado (#map). El mapa no se inicializará.")
    return
  }

  if (map === null) {
    map = new google.maps.Map(mapContainer, {
      center: restauranteCoords,
      zoom: 13,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
    })

    const restaurantMarker = new google.maps.Marker({
      position: restauranteCoords,
      map: map,
      title: "🍕 Mampanos Pizza",
      icon: {
        url:
          "data:image/svg+xml;charset=UTF-8," +
          encodeURIComponent(`
          <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="18" fill="#ea580c" stroke="#fff" stroke-width="2"/>
            <text x="20" y="26" text-anchor="middle" fill="white" font-size="16">🍕</text>
          </svg>
        `),
        scaledSize: new google.maps.Size(40, 40),
      },
    })

    const restaurantInfoWindow = new google.maps.InfoWindow({
      content: "<div><strong>🍕 Mampanos Pizza</strong><br>Calle 16 #5-25, Centro</div>",
    })

    restaurantMarker.addListener("click", () => {
      restaurantInfoWindow.open(map, restaurantMarker)
    })

    // Abre la infoWindow del restaurante por defecto
    restaurantInfoWindow.open(map, restaurantMarker)

    map.addListener("click", (event) => {
      const lat = event.latLng.lat()
      const lng = event.latLng.lng()

      if (marker) {
        marker.setMap(null)
      }

      marker = new google.maps.Marker({
        position: { lat, lng },
        map: map,
        title: "📍 Tu ubicación de entrega",
        draggable: true,
        icon: {
          url:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(`
            <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
              <circle cx="15" cy="15" r="13" fill="#dc2626" stroke="#fff" stroke-width="2"/>
              <text x="15" y="20" text-anchor="middle" fill="white" font-size="12">📍</text>
            </svg>
          `),
          scaledSize: new google.maps.Size(30, 30),
        },
      })

      const deliveryInfoWindow = new google.maps.InfoWindow({
        content: "<div><strong>📍 Tu ubicación de entrega</strong></div>",
      })

      marker.addListener("click", () => {
        deliveryInfoWindow.open(map, marker)
      })

      deliveryInfoWindow.open(map, marker)

      coordenadasSeleccionadas = { lat, lng }
      calcularDistanciaYCostos(lat, lng)
      obtenerDireccion(lat, lng)

      marker.addListener("dragend", () => {
        const newPosition = marker.getPosition()
        const newLat = newPosition.lat()
        const newLng = newPosition.lng()
        coordenadasSeleccionadas = { lat: newLat, lng: newLng }
        calcularDistanciaYCostos(newLat, newLng)
        obtenerDireccion(newLat, newLng)
      })
    })
  }
}

// === VARIABLES GLOBALES ===
let productos = [],
  gruposCategorias = {},
  ingredientesExtras = [],
  configuracionMenu = {},
  pedidos = [],
  mesas = []
const currentProductGroup = { domicilio: "pizzas", local: "pizzas" }
const currentPizzaSubtab = { domicilio: undefined, local: undefined } // FIX: Declaración global
let carrito = [],
  carritoLocal = [],
  mesaSeleccionada = null
let map = null,
  marker = null,
  coordenadasSeleccionadas = null
let distanciaKm = 0,
  costoEnvioActual = 5000,
  tiempoEntregaEstimado = 30,
  tipoVivienda = "residencial"
const restauranteCoords = { lat: 10.46271, lng: -73.25115 }
let currentProductForIngredientSelection = null // Nuevo: para rastrear el producto que se está editando en el modal de ingredientes

// === AUTENTICACIÓN ===
const PASSWORDS = { local: "mesero123", admin: "admin456", "menu-admin": "menu789" }
const authenticatedModules = new Set()
let currentAuthModule = null

// === CONFIGURACIÓN DEL SERVIDOR ===
const SERVER_CONFIG = {
  baseUrl: "https://henry-h.websitex5.me/mampanospizza",
  endpoints: {
    productos: "/api/productos.php",
    pedidosSave: "/api/save_order_clean.php",
    pedidosLoad: "/api/get_orders.php", // Usado para pedidos activos
    pedidosAll: "/api/get_all_orders.php", // Nuevo endpoint para todos los pedidos (historial)
    mesas: "/api/mesas.php",
    categorias: "/api/categorias.php",
    ingredientes: "/api/ingredientes.php",
    configuracion: "/api/configuracion.php",
    deleteOrder: "/api/delete_order.php", // ¡NUEVO ENDPOINT PARA ELIMINAR PEDIDOS!
  },
  timeout: 30000, // Aumentado a 30 segundos
}

const STORAGE_KEYS = {
  PRODUCTOS: "mampanos_productos",
  PEDIDOS: "mampanos_pedidos",
  MESAS: "mampanos_mesas",
  CATEGORIAS: "mampanos_categorias",
  INGREDIENTES: "mampanos_ingredientes",
  CONFIGURACION: "mampanos_configuracion",
  LAST_SYNC: "mampanos_last_sync",
  PENDING_SYNC: "mampanos_pending_sync",
}

let isOnline = navigator.onLine,
  syncInProgress = false

// === DATOS POR DEFECTO ===
const DEFAULT_PRODUCTS = [
  {
    id: 1,
    nombre: "Jamon Queso",
    descripcion: "Jamón, piña, queso mozzarella",
    categoria: "pizzas-sencillas",
    emoji: "🍕",
    precios: { personal: 15000, porcion: 18000, small: 34000, medium: 55000, large: 58000, xlarge: 90000 },
    combinable: true,
    bordeRelleno: true,
    permiteIngredientesExtra: true, // Nuevo campo
    ingredientesAsociados: [], // Nuevo campo
  },
  {
    id: 2,
    nombre: "Pizza Pepperoni",
    descripcion: "Pepperoni, queso mozzarella",
    categoria: "pizzas-sencillas",
    emoji: "🍕",
    precios: { personal: 13000, porcion: 19000, small: 26000, medium: 33000, large: 41000, xlarge: 49000 },
    combinable: true,
    bordeRelleno: true,
    permiteIngredientesExtra: true, // Nuevo campo
    ingredientesAsociados: [], // Nuevo campo
  },
  {
    id: 3,
    nombre: "Pizza Margherita",
    descripcion: "Tomate, albahaca, queso mozzarella",
    categoria: "pizzas-sencillas",
    emoji: "🍕",
    precios: { personal: 11000, porcion: 17000, small: 24000, medium: 31000, large: 39000, xlarge: 47000 },
    combinable: true,
    bordeRelleno: true,
    permiteIngredientesExtra: true, // Nuevo campo
    ingredientesAsociados: [], // Nuevo campo
  },
  {
    id: 4,
    nombre: "Pizza Mexicana",
    descripcion: "Carne molida, frijoles, jalapeños, cebolla",
    categoria: "pizzas-tradicionales",
    emoji: "🍕",
    precios: { personal: 15000, porcion: 22000, small: 29000, medium: 36000, large: 44000, xlarge: 52000 },
    combinable: true,
    bordeRelleno: true,
    permiteIngredientesExtra: true, // Nuevo campo
    ingredientesAsociados: [], // Nuevo campo
  },
  {
    id: 5,
    nombre: "Pizza Americana",
    descripcion: "Jamón, tocineta, salchicha, queso",
    categoria: "pizzas-tradicionales",
    emoji: "🍕",
    precios: { personal: 16000, porcion: 23000, small: 30000, medium: 37000, large: 45000, xlarge: 53000 },
    combinable: true,
    bordeRelleno: true,
    permiteIngredientesExtra: true, // Nuevo campo
    ingredientesAsociados: [], // Nuevo campo
  },
  {
    id: 6,
    nombre: "Pizza BBQ",
    descripcion: "Pollo BBQ, cebolla caramelizada, salsa BBQ",
    categoria: "pizzas-especiales",
    emoji: "🍕",
    precios: { personal: 18000, porcion: 25000, small: 32000, medium: 39000, large: 47000, xlarge: 55000 },
    combinable: true,
    bordeRelleno: true,
    permiteIngredientesExtra: true, // Nuevo campo
    ingredientesAsociados: [], // Nuevo campo
  },
  {
    id: 7,
    nombre: "Calzone Clásico",
    descripcion: "Jamón, queso, champiñones",
    categoria: "calzones",
    emoji: "🥟",
    precios: { personal: 15000, medium: 22000, large: 28000 },
    combinable: false,
    bordeRelleno: false,
    permiteIngredientesExtra: true, // Nuevo campo
    ingredientesAsociados: [], // Nuevo campo
  },
  {
    id: 8,
    nombre: "Salchipapa Sencilla",
    descripcion: "Papas fritas, salchicha, salsas",
    categoria: "salchipapas",
    emoji: "🍟",
    precios: { personal: 12000, medium: 18000, large: 24000 },
    combinable: false,
    bordeRelleno: false,
    permiteIngredientesExtra: true, // Nuevo campo
    ingredientesAsociados: [], // Nuevo campo
  },
  {
    id: 9,
    nombre: "Hamburguesa Clásica",
    descripcion: "Carne, lechuga, tomate, cebolla, queso",
    categoria: "hamburguesas",
    emoji: "🍔",
    precios: { personal: 14000 },
    combinable: false,
    bordeRelleno: false,
    permiteIngredientesExtra: true, // Nuevo campo
    ingredientesAsociados: [], // Nuevo campo
  },
  {
    id: 10,
    nombre: "Coca Cola",
    descripcion: "Refresco de cola",
    categoria: "bebidas",
    emoji: "🥤",
    precios: { personal: 3000, "1.3lt": 6000, "2.5lt": 9000, "3lt": 11000 },
    combinable: false,
    bordeRelleno: false,
    permiteIngredientesExtra: false, // Nuevo campo
    ingredientesAsociados: [], // Nuevo campo
  },
]

const DEFAULT_CATEGORIES = {
  pizzas: {
    nombre: "🍕 Pizzas",
    categorias: {
      "pizzas-sencillas": { nombre: "Pizzas Sencillas", orden: 1 },
      "pizzas-tradicionales": { nombre: "Pizzas Tradicionales", orden: 2 },
      "pizzas-especiales": { nombre: "Pizzas Especiales", orden: 3 },
      "pizzas-gourmet": { nombre: "Pizzas Gourmet", orden: 4 },
    },
  },
  comidas: {
    nombre: "🍽️ Comidas",
    categorias: {
      calzones: { nombre: "Calzones", orden: 1 },
      salchipapas: { nombre: "Salchipapas", orden: 2 },
      picadas: { nombre: "Picadas", orden: 3 },
      desgranados: { nombre: "Desgranados", orden: 4 },
      hamburguesas: { nombre: "Hamburguesas", orden: 5 },
      perros: { nombre: "Perros Calientes", orden: 6 },
    },
  },
  bebidas: {
    nombre: "🥤 Bebidas",
    categorias: {
      bebidas: { nombre: "Bebidas", orden: 1 },
      jugos: { nombre: "Jugos Naturales", orden: 2 },
      limonadas: { nombre: "Limonadas", orden: 3 },
      micheladas: { nombre: "Micheladas", orden: 4 },
    },
  },
}

function createStorageFunction(key, defaultData, endpoint) {
  return {
    async cargar() {
      let dataToReturn = null
      const localData = localStorage.getItem(STORAGE_KEYS[key])

      if (localData) {
        try {
          const parsedData = JSON.parse(localData)
          if (key === "CATEGORIAS") {
            for (const grupoKey in parsedData) {
              if (parsedData[grupoKey].categorias) {
                for (const catKey in parsedData[grupoKey].categorias) {
                  if (typeof parsedData[grupoKey].categorias[catKey] === "string") {
                    parsedData[grupoKey].categorias[catKey] = {
                      nombre: parsedData[grupoKey].categorias[catKey],
                      orden: 999,
                    }
                  }
                }
              }
            }
          }
          if (parsedData && (Array.isArray(parsedData) ? parsedData.length > 0 : Object.keys(parsedData).length > 0)) {
            dataToReturn = parsedData
            console.log(`${key} cargado desde almacenamiento local`)
          }
        } catch (error) {
          console.error(`Error parseando datos locales para ${key}, limpiando:`, error)
          localStorage.removeItem(STORAGE_KEYS[key])
        }
      }

      if (isOnline) {
        try {
          const serverData = await fetchWithTimeout(`${SERVER_CONFIG.baseUrl}${SERVER_CONFIG.endpoints[endpoint]}`)
          if (serverData && (Array.isArray(serverData) ? serverData.length > 0 : Object.keys(serverData).length > 0)) {
            if (key === "CATEGORIAS") {
              for (const grupoKey in serverData) {
                if (serverData[grupoKey].categorias) {
                  for (const catKey in serverData[grupoKey].categorias) {
                    if (typeof serverData[grupoKey].categorias[catKey] === "string") {
                      serverData[grupoKey].categorias[catKey] = {
                        nombre: serverData[grupoKey].categorias[catKey],
                        orden: 999,
                      }
                    }
                  }
                }
              }
            }
            dataToReturn = serverData
            localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(serverData))
            console.log(`${key} cargado exitosamente desde el servidor`)
          }
        } catch (error) {
          console.error(`Error cargando ${key} desde servidor:`, error)
        }
      }

      if (
        !dataToReturn ||
        (Array.isArray(dataToReturn) ? dataToReturn.length === 0 : Object.keys(dataToReturn).length === 0)
      ) {
        console.log(`Usando datos por defecto para ${key}`)
        localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(defaultData))
        dataToReturn = defaultData
      }
      return dataToReturn
    },

    async guardar(data) {
      try {
        JSON.stringify(data)

        if (isOnline) {
          const response = await fetchWithTimeout(`${SERVER_CONFIG.baseUrl}${SERVER_CONFIG.endpoints[endpoint]}`, {
            method: "POST",
            body: JSON.stringify(data),
          })
          if (response?.success) {
            // Cambiado de response?.status === "success" a response?.success
            localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(data))
            console.log(`${key} guardado exitosamente en el servidor`)
            return true
          }
        } else {
          // Usar SERVER_CONFIG.endpoints[endpoint] para el endpoint correcto
          addToPendingSync({ endpoint: SERVER_CONFIG.endpoints[endpoint], method: "POST", data })
          console.log(`${key} agregado a sincronización pendiente`)
        }
      } catch (error) {
        console.error(`Error guardando ${key}:`, error)
        // Usar SERVER_CONFIG.endpoints[endpoint] para el endpoint correcto
        addToPendingSync({ endpoint: SERVER_CONFIG.endpoints[endpoint], method: "POST", data })
      }

      try {
        localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(data))
        console.log(`${key} guardado localmente`)
      } catch (storageError) {
        console.error(`Error guardando ${key} localmente:`, storageError)
      }
      return false
    },
  }
}

// === FUNCIONES DE UTILIDAD ===
function formatCurrency(amount) {
  return `$${Number(amount).toLocaleString("es-CO")}`
}
function formatDateToColombia(dateString) {
  const date = new Date(dateString)
  if (isNaN(date.getTime())) {
    // Comprobar si la fecha es inválida
    console.warn("Fecha inválida detectada:", dateString)
    return "Fecha inválida" // O cualquier otro marcador de posición
  }
  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "numeric",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "America/Bogota",
  }).format(date)
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div")
  notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 text-white ${
    { success: "bg-green-500", error: "bg-red-500", warning: "bg-yellow-500", info: "bg-blue-500" }[type] ||
    "bg-blue-500"
  }`
  notification.textContent = message
  document.body.appendChild(notification)
  setTimeout(() => notification.remove(), 3000)
}

function cleanAndParseJSON(responseText) {
  try {
    return JSON.parse(responseText)
  } catch (firstError) {
    console.warn("Primer intento de parseo falló, intentando limpiar JSON...")

    try {
      let cleanedText = responseText
        .trim()
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]")
        .replace(/}\s*{/g, "},{")
        .replace(/]\s*\[/g, "],[")

      const firstBracket = cleanedText.indexOf("[")
      const firstBrace = cleanedText.indexOf("{")

      let startIndex = -1
      if (firstBracket !== -1 && firstBrace !== -1) {
        startIndex = Math.min(firstBracket, firstBrace)
      } else if (firstBracket !== -1) {
        startIndex = firstBracket
      } else if (firstBrace !== -1) {
        startIndex = firstBrace
      }

      if (startIndex > 0) {
        cleanedText = cleanedText.substring(startIndex)
      }

      const lastBracket = cleanedText.lastIndexOf("]")
      const lastBrace = cleanedText.lastIndexOf("}")

      let endIndex = -1
      if (lastBracket !== -1 && lastBrace !== -1) {
        endIndex = Math.max(lastBracket, lastBrace)
      } else if (lastBracket !== -1) {
        endIndex = lastBracket
      } else if (lastBrace !== -1) {
        endIndex = lastBrace
      }

      if (endIndex !== -1 && endIndex < cleanedText.length - 1) {
        cleanedText = cleanedText.substring(0, endIndex + 1)
      }

      return JSON.parse(cleanedText)
    } catch (secondError) {
      console.error("Segundo intento de parseo también falló")
      console.error("Texto original:", responseText.substring(0, 500) + "...")
      console.error("Error original:", firstError.message)
      console.error("Error después de limpieza:", secondError.message)
      throw new Error(`JSON inválido del servidor: ${firstError.message}`)
    }
  }
}

// === COMUNICACIÓN CON SERVIDOR ===
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SERVER_CONFIG.timeout)
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...options.headers },
    })
    clearTimeout(timeoutId)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    const responseText = await response.text()

    if (!responseText || responseText.trim() === "") {
      console.warn("Respuesta vacía del servidor para:", url)
      return null
    }

    try {
      return cleanAndParseJSON(responseText)
    } catch (parseError) {
      console.error("Error parseando JSON para URL:", url)
      console.error("Respuesta del servidor:", responseText.substring(0, 500) + "...")
      throw parseError
    }
  } catch (error) {
    clearTimeout(timeoutId)
    console.error("Error en petición al servidor:", error)
    throw error
  }
}

function updateConnectionStatus(online) {
  isOnline = online
  const statusElement = document.getElementById("connection-status")
  if (statusElement) {
    statusElement.className = online ? "connection-status online" : "connection-status offline"
    statusElement.textContent = online ? "🟢 Conectado al servidor" : "🔴 Sin conexión - Modo offline"
  }
  if (online && !syncInProgress) {
    const pending = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) || "[]")
    if (pending.length > 0) syncPendingData()
  }
}

function addToPendingSync(operation) {
  const pending = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) || "[]")
  pending.push({ ...operation, timestamp: new Date().toISOString() })
  localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(pending))
}

async function syncPendingData() {
  if (syncInProgress || !isOnline) return
  syncInProgress = true
  const pending = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_SYNC) || "[]")
  const successfullySyncedIndices = []

  try {
    for (let i = 0; i < pending.length; i++) {
      const operation = pending[i]
      // Añadir comprobación defensiva para operation.endpoint
      if (typeof operation.endpoint !== "string" || operation.endpoint.trim() === "") {
        console.warn(`Saltando operación pendiente inválida en el índice ${i}: endpoint es inválido.`, operation)
        successfullySyncedIndices.push(i) // Considerar como "sincronizado" para eliminarlo
        continue
      }

      try {
        await fetchWithTimeout(`${SERVER_CONFIG.baseUrl}${operation.endpoint}`, {
          method: operation.method,
          body: JSON.stringify(operation.data),
        })
        successfullySyncedIndices.push(i)
      } catch (error) {
        console.error(`Error sincronizando operación ${operation.endpoint}:`, error)
      }
    }
    const remainingPending = pending.filter((_, index) => !successfullySyncedIndices.includes(index))
    localStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(remainingPending))
    if (successfullySyncedIndices.length > 0) {
      showNotification("Datos sincronizados con el servidor", "success")
      await cargarDatos()
    }
  } catch (error) {
    console.error("Error sincronizando datos:", error)
  } finally {
    syncInProgress = false
  }
}

const DEFAULT_MENU_CONFIG = {
  tamanos: ["personal", "porcion", "small", "medium", "large", "xlarge"],
  tiposBorde: [
    { key: "normal", nombre: "Normal", precios: {} },
    {
      key: "queso",
      nombre: "Relleno de Queso",
      precios: { personal: 2000, porcion: 2500, small: 3000, medium: 4000, large: 5000, xlarge: 6000 },
    },
    {
      key: "salchicha",
      nombre: "Relleno de Salchicha",
      precios: { personal: 2500, porcion: 3000, small: 3500, medium: 4500, large: 5500, xlarge: 6500 },
    },
  ],
  costosCombinacion: {
    defaultCostoAdicional: 2000,
    saboresCombinacionPersonalizados: [],
  },
}
const DEFAULT_MESAS_ESTADO = [
  { numero: 1, capacidad: 4, ubicacion: "Salón Principal", estado: "libre", pedido: null },
  { numero: 2, capacidad: 2, ubicacion: "Salón Principal", estado: "libre", pedido: null },
  { numero: 3, capacidad: 6, ubicacion: "Terraza", estado: "libre", pedido: null },
  { numero: 4, capacidad: 4, ubicacion: "Salón Principal", estado: "libre", pedido: null },
  { numero: 5, capacidad: 2, ubicacion: "Terraza", estado: "libre", pedido: null },
  { numero: 6, capacidad: 8, ubicacion: "Salón Principal", estado: "libre", pedido: null },
  { numero: 7, capacidad: 4, ubicacion: "Terraza", estado: "libre", pedido: null },
  { numero: 8, capacidad: 2, ubicacion: "Salón Principal", estado: "libre", pedido: null },
  { numero: 9, capacidad: 2, ubicacion: "Salón Principal", estado: "libre", pedido: null },
  { numero: 10, capacidad: 2, ubicacion: "Salón Principal", estado: "libre", pedido: null },
  { numero: 11, capacidad: 2, ubicacion: "Salón Principal", estado: "libre", pedido: null },
  { numero: 12, capacidad: 2, ubicacion: "Salón Principal", estado: "libre", pedido: null },
]

const storage = {
  productos: createStorageFunction("PRODUCTOS", DEFAULT_PRODUCTS, "productos"),
  categorias: createStorageFunction("CATEGORIAS", DEFAULT_CATEGORIES, "categorias"),
  ingredientes: createStorageFunction("INGREDIENTES", [], "ingredientes"),
  configuracion: createStorageFunction("CONFIGURACION", DEFAULT_MENU_CONFIG, "configuracion"),
  mesas: createStorageFunction("MESAS", DEFAULT_MESAS_ESTADO, "mesas"),
  pedidos: createStorageFunction("PEDIDOS", [], "pedidosSave"), // Añadido para persistencia de pedidos
}

async function guardarPedido(nuevoPedido) {
  try {
    if (isOnline) {
      await fetchWithTimeout(`${SERVER_CONFIG.baseUrl}${SERVER_CONFIG.endpoints.pedidosSave}`, {
        method: "POST",
        body: JSON.stringify({ order: nuevoPedido }),
      })
    } else {
      addToPendingSync({ endpoint: SERVER_CONFIG.endpoints.pedidosSave, method: "POST", data: { order: nuevoPedido } })
    }
  } catch (error) {
    console.error("Error guardando pedido:", error)
    addToPendingSync({ endpoint: SERVER_CONFIG.endpoints.pedidosSave, method: "POST", data: { order: nuevoPedido } })
  }
}

async function cargarPedidos() {
  let currentPedidos = []
  const localData = localStorage.getItem(STORAGE_KEYS.PEDIDOS)
  if (localData) {
    try {
      currentPedidos = JSON.parse(localData)
      if (!Array.isArray(currentPedidos)) currentPedidos = []
    } catch (error) {
      console.error("Error parseando pedidos locales, limpiando:", error)
      localStorage.removeItem(STORAGE_KEYS.PEDIDOS)
      currentPedidos = []
    }
  }

  if (isOnline) {
    try {
      // Cargar pedidos activos (no despachados)
      const serverActiveData = await fetchWithTimeout(`${SERVER_CONFIG.baseUrl}${SERVER_CONFIG.endpoints.pedidosLoad}`)
      // Cargar todos los pedidos (incluyendo despachados) para el historial y fusión
      const serverAllData = await fetchWithTimeout(`${SERVER_CONFIG.baseUrl}${SERVER_CONFIG.endpoints.pedidosAll}`)

      let serverPedidos = []
      if (serverActiveData && Array.isArray(serverActiveData)) {
        serverPedidos = serverPedidos.concat(serverActiveData)
      }
      if (serverAllData && Array.isArray(serverAllData)) {
        // Fusionar para asegurar que tenemos todos los pedidos, priorizando los activos si hay duplicados
        const allServerMap = new Map(serverAllData.map((p) => [p.id, p]))
        serverPedidos.forEach((p) => allServerMap.set(p.id, p)) // Activos sobrescriben si hay conflicto
        serverPedidos = Array.from(allServerMap.values())
      }

      if (serverPedidos.length > 0) {
        const serverPedidosMap = new Map(serverPedidos.map((p) => [p.id, p]))

        const mergedPedidos = [...currentPedidos]
        for (const serverPedido of serverPedidos) {
          const localIndex = mergedPedidos.findIndex((p) => p.id === serverPedido.id)
          if (localIndex !== -1) {
            const localPedido = mergedPedidos[localIndex]
            // Lógica de fusión: si el local está despachado y el server no, mantener el estado local
            if (localPedido.status === "despachado" && serverPedido.status !== "despachado") {
              mergedPedidos[localIndex] = {
                ...serverPedido,
                status: localPedido.status,
                lastUpdated: localPedido.lastUpdated,
              }
            } else if (new Date(localPedido.timestamp) > new Date(serverPedido.timestamp)) {
              // Si la versión local es más reciente, mantenerla (esto es una simplificación, idealmente se resolverían conflictos)
            } else {
              mergedPedidos[localIndex] = serverPedido
            }
          } else {
            mergedPedidos.push(serverPedido)
          }
        }

        currentPedidos = mergedPedidos
        localStorage.setItem(STORAGE_KEYS.PEDIDOS, JSON.stringify(currentPedidos))
        console.log(`${currentPedidos.length} pedidos (fusionados) cargados desde el servidor`)
      }
    } catch (error) {
      console.error("Error cargando pedidos desde servidor, usando datos locales:", error)
    }
  }

  // Normalización de timestamps, status, totals, customer e items para asegurar que sean válidos
  currentPedidos = currentPedidos.map((pedido) => {
    const date = new Date(pedido.timestamp)
    const normalizedTimestamp = isNaN(date.getTime()) ? new Date().toISOString() : pedido.timestamp

    // Normalizar el status: asegurar que sea una cadena y tenga un valor por defecto
    const normalizedStatus =
      typeof pedido.status === "string" && pedido.status.trim() !== "" ? pedido.status : "pendiente" // Valor por defecto si el status es inválido o no existe

    // Normalizar el objeto totals y su propiedad total
    const normalizedTotals = {
      subtotal: typeof pedido.totals?.subtotal === "number" ? pedido.totals.subtotal : 0,
      envio: typeof pedido.totals?.envio === "number" ? pedido.totals.envio : 0,
      total: typeof pedido.totals?.total === "number" ? pedido.totals.total : 0,
    }

    // Normalizar el objeto customer y su propiedad nombre
    const normalizedCustomer = {
      nombre: typeof pedido.customer?.nombre === "string" ? pedido.customer.nombre : "Consumidor Final",
      telefono: typeof pedido.customer?.telefono === "string" ? pedido.customer.telefono : "",
      direccion: typeof pedido.customer?.direccion === "string" ? pedido.customer.direccion : "",
      referencia: typeof pedido.customer?.referencia === "string" ? pedido.customer.referencia : "",
      coordenadas: pedido.customer?.coordenadas || null,
      tipoVivienda: typeof pedido.customer?.tipoVivienda === "string" ? pedido.customer.tipoVivienda : "residencial",
      observaciones: typeof pedido.customer?.observaciones === "string" ? pedido.customer.observaciones : "",
    }

    // Normalizar la propiedad items: asegurar que siempre sea un array
    const normalizedItems = Array.isArray(pedido.items) ? pedido.items : []

    return {
      ...pedido,
      timestamp: normalizedTimestamp,
      status: normalizedStatus,
      totals: normalizedTotals, // Asegurar que totals siempre sea un objeto válido
      customer: normalizedCustomer, // Asegurar que customer siempre sea un objeto válido
      items: normalizedItems, // Asegurar que items siempre sea un array válido
    }
  })

  pedidos = currentPedidos
  return pedidos
}

function limpiarDatosCorruptos() {
  const keys = Object.values(STORAGE_KEYS)
  keys.forEach((key) => {
    const data = localStorage.getItem(key)
    if (data) {
      try {
        JSON.parse(data)
      } catch (error) {
        console.warn(`Eliminando datos corruptos para ${key}`)
        localStorage.removeItem(key)
      }
    }
  })
}

async function cargarDatos() {
  try {
    limpiarDatosCorruptos()

    isOnline = navigator.onLine
    updateConnectionStatus(isOnline)

    productos = await storage.productos.cargar()
    // Normalizar productos: asegurar que permiteIngredientesExtra e ingredientesAsociados existan
    productos = productos.map((p) => {
      // Buscar el producto correspondiente en los valores por defecto
      const defaultProduct = DEFAULT_PRODUCTS.find((dp) => dp.id === p.id)
      let permiteExtras = typeof p.permiteIngredientesExtra === "boolean" ? p.permiteIngredientesExtra : false

      // Si este producto es uno de los productos por defecto y se supone que permite extras,
      // asegurar que la bandera sea true, anulando cualquier valor false de los datos cargados.
      if (defaultProduct && defaultProduct.permiteIngredientesExtra === true) {
        permiteExtras = true
      }

      return {
        ...p,
        permiteIngredientesExtra: permiteExtras,
        ingredientesAsociados: Array.isArray(p.ingredientesAsociados) ? p.ingredientesAsociados : [],
      }
    })

    gruposCategorias = await storage.categorias.cargar()
    // FIX: Normalizar la estructura de categorías después de cargar
    // Asegurar que todas las categorías tengan 'nombre' y 'orden' como número
    for (const grupoKey in gruposCategorias) {
      if (gruposCategorias[grupoKey].categorias) {
        for (const catKey in gruposCategorias[grupoKey].categorias) {
          const currentCat = gruposCategorias[grupoKey].categorias[catKey]
          if (typeof currentCat === "string") {
            // Si la categoría es un string, convertirla a objeto con nombre y orden numérico
            gruposCategorias[grupoKey].categorias[catKey] = {
              nombre: currentCat,
              orden: 999, // Valor por defecto numérico para el orden
            }
          } else if (typeof currentCat === "object" && currentCat !== null) {
            // Asegurar que 'nombre' y 'orden' existan y 'orden' sea numérico
            if (!currentCat.nombre) currentCat.nombre = catKey // Fallback a la clave si el nombre falta
            if (typeof currentCat.orden === "undefined" || currentCat.orden === null || isNaN(currentCat.orden)) {
              currentCat.orden = 999 // Valor por defecto numérico si el orden falta o no es un número
            }
          }
        }
      } else {
        // Si el grupo no tiene la propiedad 'categorias', inicializarla como un objeto vacío
        gruposCategorias[grupoKey].categorias = {}
      }
    }
    // Guardar la estructura normalizada de vuelta al almacenamiento local
    localStorage.setItem(STORAGE_KEYS.CATEGORIAS, JSON.stringify(gruposCategorias))

    ingredientesExtras = await storage.ingredientes.cargar()
    // Normalizar ingredientesExtras: asegurar que precio sea un número y disponible sea booleano
    ingredientesExtras = ingredientesExtras.map((ing) => ({
      ...ing,
      precio: typeof ing.precio === "number" ? ing.precio : Number.parseInt(ing.precio) || 0,
      disponible: typeof ing.disponible === "boolean" ? ing.disponible : true, // Asegurar que disponible sea booleano
    }))

    configuracionMenu = await storage.configuracion.cargar()

    mesas = await storage.mesas.cargar()
    // Normalizar cada objeto mesa para asegurar estructura y tipos
    mesas = mesas.map((mesa) => ({
      numero: typeof mesa.numero === "number" && !isNaN(mesa.numero) && mesa.numero > 0 ? mesa.numero : 0, // Asegurar que numero sea un número válido
      capacidad: typeof mesa.capacidad === "number" && !isNaN(mesa.capacidad) ? mesa.capacidad : 4,
      ubicacion: typeof mesa.ubicacion === "string" ? mesa.ubicacion : "Salón Principal",
      estado: typeof mesa.estado === "string" ? mesa.estado : "libre",
      pedido: mesa.pedido !== undefined ? mesa.pedido : null, // Asegurar que pedido sea null o un objeto, no undefined
    }))

    // Si el array 'mesas' cargado está vacío o tiene menos mesas válidas que las por defecto, re-inicializar/fusionar
    const validLoadedMesasCount = new Set(mesas.map((m) => m.numero).filter((n) => n > 0)).size
    if (mesas.length === 0 || validLoadedMesasCount < DEFAULT_MESAS_ESTADO.length) {
      console.warn(
        "Los datos de las mesas son insuficientes o están corruptos. Reinicializando/fusionando con las mesas por defecto.",
      )
      const defaultMesasMap = new Map(DEFAULT_MESAS_ESTADO.map((m) => [m.numero, m]))
      const newMesas = []
      for (const defaultMesa of DEFAULT_MESAS_ESTADO) {
        const loadedMesa = mesas.find((m) => m.numero === defaultMesa.numero)
        if (loadedMesa && loadedMesa.numero > 0) {
          // Usar la mesa cargada solo si tiene un numero válido
          newMesas.push(loadedMesa)
        } else {
          newMesas.push(defaultMesa) // De lo contrario, usar la predeterminada
        }
      }
      mesas = newMesas
      // Persistir las mesas por defecto re-inicializadas para asegurar la consistencia en futuras cargas
      storage.mesas.guardar(mesas)
    }

    pedidos = await cargarPedidos()

    console.log("Datos cargados:", {
      productos: productos.length,
      categorias: Object.keys(gruposCategorias).length,
      ingredientes: ingredientesExtras.length,
      mesas: mesas.length,
      pedidos: pedidos.length,
    })

    showNotification(
      isOnline ? "Datos cargados desde el servidor" : "Datos cargados localmente",
      isOnline ? "success" : "warning",
    )
  } catch (error) {
    console.error("Error cargando datos:", error)
    productos = DEFAULT_PRODUCTS
    gruposCategorias = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)) // Asegurar copia profunda de los valores por defecto
    ingredientesExtras = []
    configuracionMenu = DEFAULT_MENU_CONFIG
    mesas = DEFAULT_MESAS_ESTADO
    pedidos = []
    showNotification("Error cargando datos, usando datos por defecto", "error")
  }
}

// === GESTIÓN DE MÓDULOS Y NAVEGACIÓN ===
function showSection(targetId, type = "module") {
  console.log(`showSection: Intentando mostrar ${targetId} (tipo: ${type})`)
  const activeClass = "active"
  let targetElementId = ""
  let contentSelector = ""
  let buttonSelector = ""
  let dataAttribute = ""

  if (type === "module") {
    targetElementId = `${targetId}-module`
    contentSelector = ".module"
    buttonSelector = ".nav-btn"
    dataAttribute = "data-nav-module"
  } else if (type === "admin") {
    targetElementId = `admin-${targetId}`
    contentSelector = ".admin-tab-content"
    buttonSelector = ".admin-tab"
    dataAttribute = "data-admin-tab"
  } else if (type === "menu-admin") {
    targetElementId = `menu-admin-${targetId}`
    contentSelector = ".menu-admin-tab-content"
    buttonSelector = ".menu-admin-tab"
    dataAttribute = "data-menu-admin-tab"
  }

  document.querySelectorAll(contentSelector).forEach((el) => {
    if (el.classList.contains(activeClass)) {
      console.log(`showSection: Removiendo 'active' de ${el.id || el.className}`)
      el.classList.remove(activeClass)
    }
  })

  const targetElement = document.getElementById(targetElementId)
  if (targetElement) {
    console.log(`showSection: Añadiendo 'active' a ${targetElement.id}`)
    targetElement.classList.add(activeClass)
  } else {
    console.error(`showSection: Elemento objetivo ${targetElementId} no encontrado!`)
  }

  document.querySelectorAll(buttonSelector).forEach((btn) => {
    if (btn.classList.contains(activeClass)) {
      console.log(`showSection: Removiendo 'active' de botón`)
      btn.classList.remove(activeClass)
    }
  })

  const activeBtn = document.querySelector(`[${dataAttribute}="${targetId}"]`)
  if (activeBtn) {
    console.log(`showSection: Añadiendo 'active' a botón ${targetId}`)
    activeBtn.classList.add(activeClass)
  } else {
    console.error(`showSection: Botón activo [${dataAttribute}="${targetId}"] no encontrado!`)
  }

  switch (targetId) {
    case "domicilio":
      loadProductos("domicilio")
      // initializeMapModule() // Eliminado: la inicialización del mapa se maneja por el callback de Google Maps
      break
    case "local":
      loadMesas()
      loadProductos("local")
      break
    case "admin":
      showAdminTab("pedidos") // Default to active orders
      break
    case "menu-admin":
      showMenuAdminTab("productos")
      break
    case "pedidos":
      loadPedidosList() // Load active orders
      updateAdminStats()
      break
    case "historial": // New case for historial tab
      loadHistorialPedidosList()
      updateAdminStats()
      break
    case "estadisticas":
      updateAdminStats()
      loadTopSellingProducts()
      break
    case "productos":
      cargarListaProductos()
      cargarCategoriasEnSelect("producto-categoria")
      cargarCategoriasEnSelect("filtro-categoria-productos")
      cancelarFormularioProducto()
      break
    case "categorias":
      cargarListaCategorias()
      cancelarFormularioCategoria()
      break
    case "ingredientes":
      cargarListaIngredientes()
      cargarCategoriasEnSelectIngredientes()
      cancelarFormularioIngrediente()
      break
    case "configuracion":
      cargarConfiguracion()
      break
  }
}

function showAdminTab(tabName) {
  showSection(tabName, "admin")
}

function showMenuAdminTab(tabName) {
  showSection(tabName, "menu-admin")
}

// === AUTENTICACIÓN ===
function checkAccess(moduleName) {
  if (authenticatedModules.has(moduleName)) {
    showSection(moduleName)
    return
  }
  currentAuthModule = moduleName
  document.getElementById("auth-title").textContent = `Acceso a ${moduleName.replace("-", " ")}`
  document.getElementById("auth-description").textContent = "Ingresa la contraseña para continuar"
  document.getElementById("auth-modal").classList.remove("hidden")
  document.getElementById("auth-password").value = ""
  document.getElementById("auth-error").classList.add("hidden")
  document.getElementById("auth-password").focus()
}

function validateAccess() {
  const passwordInput = document.getElementById("auth-password").value
  if (PASSWORDS[currentAuthModule] === passwordInput) {
    authenticatedModules.add(currentAuthModule)
    closeAuthModal()
    showSection(currentAuthModule)
  } else {
    document.getElementById("auth-error").classList.remove("hidden")
  }
}

function closeAuthModal() {
  document.getElementById("auth-modal").classList.add("hidden")
}

// === MÓDULO DOMICILIO CON GOOGLE MAPS ===
// La función initMapModule ya está definida al principio del script y es el callback de Google Maps.
// No se necesita una llamada directa aquí.

function calcularDistanciaYCostos(lat, lng) {
  const R = 6371
  const dLat = ((lat - restauranteCoords.lat) * Math.PI) / 180
  const dLng = ((lng - restauranteCoords.lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((restauranteCoords.lat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  distanciaKm = Math.round(R * c * 100) / 100

  const segmentos = Math.ceil(distanciaKm / 1.5)
  costoEnvioActual = 5000 + Math.max(0, segmentos - 1) * 500

  if (tipoVivienda === "conjunto") {
    costoEnvioActual += 1000
  }

  tiempoEntregaEstimado = Math.max(30, 20 + Math.round((distanciaKm / 20) * 60))

  document.getElementById("distancia-text").textContent = `${distanciaKm} km`
  document.getElementById("tiempo-text").textContent = `${tiempoEntregaEstimado} min`
  document.getElementById("costo-envio-text").textContent = formatCurrency(costoEnvioActual)
  document.getElementById("info-entrega").classList.remove("hidden")
  updateCart("domicilio")
}

function updateDeliveryCost() {
  const tipoViviendaRadios = document.querySelectorAll('input[name="tipo-vivienda"]')
  const selectedTipoVivienda = Array.from(tipoViviendaRadios).find((radio) => radio.checked)

  if (selectedTipoVivienda) {
    tipoVivienda = selectedTipoVivienda.value

    if (coordenadasSeleccionadas) {
      calcularDistanciaYCostos(coordenadasSeleccionadas.lat, coordenadasSeleccionadas.lng)
    }
  }
}

function obtenerDireccion(lat, lng) {
  const geocoder = new google.maps.Geocoder()
  const latlng = { lat: Number.parseFloat(lat), lng: Number.parseFloat(lng) }

  geocoder.geocode({ location: latlng }, (results, status) => {
    if (status === "OK") {
      if (results[0]) {
        const direccionCompleta = results[0].formatted_address
        const direccionInput = document.getElementById("direccion-domicilio")
        if (direccionInput) direccionInput.value = direccionCompleta
      } else {
        console.log("No se encontraron resultados")
        const direccionInput = document.getElementById("direccion-domicilio")
        if (direccionInput) direccionInput.value = `Coordenadas: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
      }
    } else {
      console.error("Error en geocoding:", status)
      const direccionInput = document.getElementById("direccion-domicilio")
      if (direccionInput) direccionInput.value = `Ubicación: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
    }
  })
}

// === PRODUCTOS Y CARRITO ===
function loadProductos(type) {
  const container = document.getElementById(type === "domicilio" ? "productos-domicilio" : "productos-local")
  if (!container) return

  const activeGroupKey = currentProductGroup[type]
  let groupData = gruposCategorias[activeGroupKey] // Usar 'let' para poder reasignar si es necesario

  console.log(`loadProductos(${type}): activeGroupKey=${activeGroupKey}`)

  // Asegurar que groupData y su propiedad 'categorias' existan y sean objetos
  if (!groupData || typeof groupData !== "object") {
    console.warn(`loadProductos: groupData para ${activeGroupKey} falta o es inválido. Usando fallback.`)
    // Intentar usar los datos por defecto si los cargados son inválidos
    groupData = DEFAULT_CATEGORIES[activeGroupKey] || { nombre: activeGroupKey, categorias: {} }
    if (!groupData.categorias) {
      // Asegurar que la propiedad categorias exista en el fallback
      groupData.categorias = {}
    }
  }
  if (!groupData.categorias || typeof groupData.categorias !== "object") {
    console.warn(`loadProductos: groupData.categorias para ${activeGroupKey} falta o es inválido. Inicializando.`)
    groupData.categorias = {}
  }

  let html = ""

  html = `<div class="mb-8"><h3 class="text-xl font-bold text-gray-800 mb-4">${groupData.nombre}</h3><div class="space-y-4">`

  // Ordenar categorías por la propiedad 'orden'
  const sortedCategories = Object.entries(groupData.categorias || {})
    .map(([catKey, catData]) => ({ key: catKey, ...catData }))
    .sort((a, b) => a.orden - b.orden)

  sortedCategories.forEach((cat) => {
    const categoryDisplayName = cat.nombre
    const productosEnCategoria = productos.filter((p) => p.categoria === cat.key)
    if (productosEnCategoria.length > 0) {
      html += `<div class="mb-6"><h4 class="text-lg font-semibold text-gray-700 mb-3">${categoryDisplayName}</h4><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`
      html += productosEnCategoria.map((p) => renderProductCard(p, type)).join("")
      html += `</div></div>`
    }
  })

  html += `</div></div>`

  container.innerHTML = html || '<p class="text-gray-500 text-center py-8">No hay productos disponibles</p>'
}

function renderProductCard(producto, type) {
  const tamanosHtml = Object.entries(producto.precios)
    .map(
      ([tamanoKey, precio]) =>
        `<div class="flex justify-between items-center p-1 bg-gray-50 rounded">
  <span class="capitalize font-medium text-xs">${tamanoKey.replace("_", " ")} ${formatCurrency(precio)}</span>
  <button onclick="selectProductForCart(${producto.id}, '${tamanoKey}', ${precio}, '${type}')" class="btn-xs py-0.5 px-1.5 text-xs">
    ${producto.combinable || producto.bordeRelleno || producto.permiteIngredientesExtra ? "Personalizar" : "Agregar"}
  </button>
</div>`,
    )
    .join("")

  return `<div class="card">
<div class="card-content p-4">
  <div class="flex items-center space-x-3 mb-3">
    <span class="text-3xl">${producto.emoji}</span>
    <div class="flex-1">
      <h5 class="font-semibold">${producto.nombre}</h5>
      <p class="text-sm text-gray-600">${producto.descripcion}</p>
      <div class="flex space-x-1 mt-2">
        ${producto.combinable ? '<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Combinable</span>' : ""}
        ${producto.bordeRelleno ? '<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Borde relleno</span>' : ""}
        ${producto.permiteIngredientesExtra ? '<span class="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Extras</span>' : ""}
      </div>
    </div>
  </div>
  <div class="space-y-2">
    ${tamanosHtml}
  </div>
</div>
</div>`
}

function selectProductForCart(productId, sizeKey, basePrice, type) {
  const product = productos.find((p) => p.id === productId)
  if (!product) return

  if (type === "local" && !mesaSeleccionada) {
    showNotification("Primero selecciona una mesa", "warning")
    return
  }

  if (product.combinable || product.bordeRelleno || product.permiteIngredientesExtra) {
    showPersonalizacionModal(product, sizeKey, basePrice, type)
  } else {
    addToCart(product, sizeKey, basePrice, type)
  }
}

function addToCart(product, sizeKey, price, type, personalization = null) {
  const item = { key: `${product.id}-${sizeKey}-${Date.now()}`, product, sizeKey, price, quantity: 1, personalization }

  if (type === "domicilio") {
    carrito.push(item)
  } else {
    carritoLocal.push(item)
  }

  updateCart(type)
  showNotification("Producto agregado exitosamente", "success")
}

function updateCart(type) {
  const cart = type === "domicilio" ? carrito : carritoLocal
  const container = document.getElementById(type === "domicilio" ? "carrito-items" : "carrito-local-items")
  const subtotalElement = document.getElementById(type === "domicilio" ? "carrito-subtotal" : "carrito-local-subtotal")
  const totalElement = document.getElementById(type === "domicilio" ? "carrito-total" : "carrito-local-total")
  const sendOrderButton = document.querySelector(type === "domicilio" ? "#btn-enviar-domicilio" : "#btn-enviar-local")

  if (!container || !subtotalElement || !totalElement || !sendOrderButton) return

  if (cart.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No has agregado productos aún</p>'
    subtotalElement.textContent = formatCurrency(0)
    totalElement.textContent = formatCurrency(type === "domicilio" ? costoEnvioActual : 0)
    sendOrderButton.disabled = true
    return
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const total = subtotal + (type === "domicilio" ? costoEnvioActual : 0)

  container.innerHTML = cart
    .map(
      (item) =>
        `<div class="flex items-center justify-between border-b border-gray-100 py-2">
  <div class="flex-1">
    <p class="font-medium text-sm">${item.product.nombre} (${item.sizeKey.replace("_", " ")})</p>
    <p class="text-xs text-gray-500">${formatCurrency(item.price)} x ${item.quantity}</p>
    ${renderPersonalizationText(item.personalization)}
  </div>
  <div class="flex items-center space-x-2">
    <button onclick="changeQuantity('${item.key}', ${item.quantity - 1}, '${type}')" class="btn-xs">-</button>
    <span class="font-medium text-sm">${item.quantity}</span>
    <button onclick="changeQuantity('${item.key}', ${item.quantity + 1}, '${type}')" class="btn-xs">+</button>
    <button onclick="removeFromCart('${item.key}', '${type}')" class="text-red-500 hover:text-red-700 text-sm ml-2">
      <i class="fas fa-trash"></i>
    </button>
  </div>
</div>`,
    )
    .join("")

  subtotalElement.textContent = formatCurrency(subtotal)
  totalElement.textContent = formatCurrency(total)
  sendOrderButton.disabled = false

  if (type === "domicilio") {
    const domicilioCostElement = document.getElementById("carrito-costo-envio")
    if (domicilioCostElement) domicilioCostElement.textContent = formatCurrency(costoEnvioActual)
  }
}

function renderPersonalizationText(personalization) {
  if (!personalization) return ""
  let text = ""
  if (personalization.saboresCombinados?.length > 0) {
    text += `<p class="text-xs text-gray-500">Sabores: ${personalization.saboresCombinados.map((s) => s.nombre).join(", ")}</p>`
  }
  if (personalization.borde && personalization.borde !== "normal") {
    text += `<p class="text-xs text-gray-500">Borde: ${personalization.bordeNombre}</p>`
  }
  if (personalization.ingredientesExtras?.length > 0) {
    text += `<p class="text-xs text-gray-500">Extras: ${personalization.ingredientesExtras.map((i) => `${i.nombre} (${formatCurrency(i.precio)})`).join(", ")}</p>`
  }
  if (personalization.observaciones) {
    text += `<p class="text-xs text-gray-500">Obs: ${personalization.observaciones}</p>`
  }
  return text
}

function changeQuantity(itemKey, newQuantity, type) {
  if (newQuantity <= 0) {
    removeFromCart(itemKey, type)
    return
  }

  const cart = type === "domicilio" ? carrito : carritoLocal
  const item = cart.find((i) => i.key === itemKey)
  if (item) {
    item.quantity = newQuantity
    updateCart(type)
  }
}

function removeFromCart(itemKey, type) {
  if (type === "domicilio") {
    carrito = carrito.filter((i) => i.key !== itemKey)
  } else {
    carritoLocal = carritoLocal.filter((i) => i.key !== itemKey)
  }
  updateCart(type)
  showNotification("Producto eliminado del carrito", "success")
}

// === PERSONALIZACIÓN DE PRODUCTOS (PARA EL CLIENTE) ===
function showPersonalizacionModal(product, sizeKey, basePrice, type) {
  const modal = document.getElementById("personalizacion-modal")
  const title = document.getElementById("personalizacion-title")
  const emoji = document.getElementById("personalizacion-emoji")
  const productName = document.getElementById("personalizacion-product-name")
  const productDescription = document.getElementById("personalizacion-product-description")
  const basePriceElement = document.getElementById("personalizacion-base-price")

  title.textContent = `Personalizar ${product.nombre}`
  emoji.textContent = product.emoji
  productName.textContent = `${product.nombre} (${sizeKey.replace("_", " ")})`
  productDescription.textContent = product.descripcion
  basePriceElement.textContent = formatCurrency(basePrice)

  setupPersonalizacionSections(product, sizeKey, basePrice, type)

  modal.classList.remove("hidden")
}

function setupPersonalizacionSections(product, sizeKey, basePrice, type) {
  const saboresContainer = document.getElementById("personalizacion-sabores-container")
  const bordeContainer = document.getElementById("personalizacion-borde-container")
  const ingredientesContainer = document.getElementById("personalizacion-ingredientes-container")

  saboresContainer.classList.add("hidden")
  bordeContainer.classList.add("hidden")
  ingredientesContainer.classList.add("hidden")

  if (product.combinable) {
    setupSaboresCombinados(product, sizeKey)
    saboresContainer.classList.remove("hidden")
  }

  if (product.bordeRelleno) {
    setupBordeRelleno(sizeKey)
    bordeContainer.classList.remove("hidden")
  }

  // Solo mostrar ingredientes extras si el producto lo permite y hay ingredientes asociados
  if (product.permiteIngredientesExtra && product.ingredientesAsociados && product.ingredientesAsociados.length > 0) {
    setupIngredientesExtrasForCustomer(product.ingredientesAsociados)
    ingredientesContainer.classList.remove("hidden")
  } else {
    // Si no permite o no tiene asociados, asegurarse de que el contenedor esté vacío
    document.getElementById("ingredientes-extras-options").innerHTML =
      '<p class="text-gray-500 text-sm">No hay ingredientes extras disponibles para este producto.</p>'
  }

  const addButton = document.getElementById("btn-add-to-cart-personalizado")
  addButton.onclick = () => addPersonalizedToCart(product, sizeKey, basePrice, type)
}

function setupSaboresCombinados(product, sizeKey) {
  const container = document.getElementById("sabores-combinados-options")
  const productosCompatibles = productos.filter((p) => p.categoria === product.categoria && p.id !== product.id)

  container.innerHTML = productosCompatibles
    .map(
      (p) =>
        `<label class="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50">
  <input type="checkbox" name="sabor-combinado" value="${p.id}" data-nombre="${p.nombre}" data-precio="${p.precios[sizeKey] || 0}">
  <span class="text-sm">${p.emoji} ${p.nombre}</span>
  <span class="text-xs text-gray-500 ml-auto">+${formatCurrency(getCostoSaborAdicional(p.id, sizeKey))}</span>
</label>`,
    )
    .join("")
}

function getCostoSaborAdicional(productId, sizeKey) {
  const customCosts = configuracionMenu.costosCombinacion?.saboresCombinacionPersonalizados || []
  const customCost = customCosts.find((c) => c.productId === productId)

  if (customCost) {
    return customCost.precios?.[sizeKey] || customCost.precio || 0
  }

  const defaultCost = configuracionMenu.costosCombinacion?.defaultCostoAdicional || 2000
  return defaultCost
}

function setupBordeRelleno(sizeKey) {
  const container = document.getElementById("borde-relleno-options")
  const tiposBorde = configuracionMenu.tiposBorde || []

  container.innerHTML = tiposBorde
    .map(
      (borde) =>
        `<label class="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50">
  <input type="radio" name="tipo-borde" value="${borde.key}" data-nombre="${borde.nombre}" data-precio="${borde.precios[sizeKey] || 0}" ${borde.key === "normal" ? "checked" : ""}>
  <span class="text-sm">${borde.nombre}</span>
  <span class="text-xs text-gray-500 ml-auto">${borde.precios[sizeKey] > 0 ? "+" + formatCurrency(borde.precios[sizeKey]) : "Gratis"}</span>
</label>`,
    )
    .join("")
}

// Función para cargar ingredientes extras en el modal de personalización del cliente
function setupIngredientesExtrasForCustomer(associatedIngredientIds) {
  const container = document.getElementById("ingredientes-extras-options")
  const ingredientesDisponibles = ingredientesExtras.filter(
    (ing) => ing.disponible && associatedIngredientIds.includes(ing.id),
  )

  if (ingredientesDisponibles.length === 0) {
    container.innerHTML =
      '<p class="text-gray-500 text-sm">No hay ingredientes extras disponibles para este producto.</p>'
    return
  }

  container.innerHTML = ingredientesDisponibles
    .map(
      (ing) =>
        `<label class="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50">
  <input type="checkbox" name="ingrediente-extra" value="${ing.id}" data-nombre="${ing.nombre}" data-precio="${ing.precio || 0}">
  <span class="text-sm">${ing.nombre}</span>
  <span class="text-xs text-gray-500 ml-auto">${ing.precio > 0 ? "+" + formatCurrency(ing.precio) : "Gratis"}</span>
</label>`,
    )
    .join("")
}

function addPersonalizedToCart(product, sizeKey, basePrice, type) {
  const personalization = {
    saboresCombinados: [],
    borde: "normal",
    bordeNombre: "Borde normal",
    ingredientesExtras: [],
    observaciones: document.getElementById("personalizacion-observaciones").value,
  }

  let totalPrice = basePrice

  const saboresSeleccionados = document.querySelectorAll('input[name="sabor-combinado"]:checked')
  saboresSeleccionados.forEach((input) => {
    const costoAdicional = getCostoSaborAdicional(Number.parseInt(input.value), sizeKey)
    personalization.saboresCombinados.push({
      id: Number.parseInt(input.value),
      nombre: input.dataset.nombre,
      precio: costoAdicional,
    })
    totalPrice += costoAdicional
  })

  const bordeSeleccionado = document.querySelector('input[name="tipo-borde"]:checked')
  if (bordeSeleccionado) {
    personalization.borde = bordeSeleccionado.value
    personalization.bordeNombre = bordeSeleccionado.dataset.nombre
    totalPrice += Number.parseInt(bordeSeleccionado.dataset.precio)
  }

  const ingredientesSeleccionados = document.querySelectorAll('input[name="ingrediente-extra"]:checked')
  ingredientesSeleccionados.forEach((input) => {
    // Asegurarse de que el precio sea un número antes de sumarlo
    const precio = Number.parseFloat(input.dataset.precio) || 0
    personalization.ingredientesExtras.push({
      id: Number.parseInt(input.value),
      nombre: input.dataset.nombre,
      precio: precio,
    })
    totalPrice += precio
  })

  addToCart(product, sizeKey, totalPrice, type, personalization)
  closePersonalizacionModal()
}

function closePersonalizacionModal() {
  document.getElementById("personalizacion-modal").classList.add("hidden")
}

// === GESTIÓN DE MESAS ===
function loadMesas() {
  const container = document.getElementById("mesas-visuales")
  if (!container) return

  container.innerHTML = mesas
    .map(
      (mesa) =>
        `<div class="mesa-card ${mesa.estado}" onclick="selectMesa(${mesa.numero})">
    <div class="mesa-header">
      <span class="mesa-numero">Mesa ${mesa.numero}</span>
      <span class="mesa-capacidad">${mesa.capacidad || "N/A"} personas</span>
    </div>
    <div class="mesa-body">
      <div class="mesa-estado ${mesa.estado}">
        ${mesa.estado === "libre" ? "🟢 Libre" : mesa.estado === "ocupada" ? "🔴 Ocupada" : "🟡 Reservada"}
      </div>
      <div class="mesa-ubicacion">${mesa.ubicacion || "N/A"}</div>
      ${mesa.pedido ? `<div class="mesa-pedido">Pedido #${mesa.pedido.id}<br>${formatCurrency(mesa.pedido.total)}</div>` : ""}
    </div>
  </div>`,
    )
    .join("")
}

function selectMesa(numeroMesa) {
  const mesa = mesas.find((m) => m.numero === numeroMesa)
  if (!mesa || mesa.estado !== "libre") {
    showNotification("Esta mesa no está disponible", "warning")
    return
  }

  mesaSeleccionada = numeroMesa
  document.getElementById("mesa-local").value = numeroMesa

  document.querySelectorAll(".mesa-card").forEach((card) => card.classList.remove("selected"))
  document.querySelector(`.mesa-card:nth-child(${numeroMesa})`).classList.add("selected")

  showNotification(`Mesa ${numeroMesa} seleccionada`, "success")
}

function liberarTodasLasMesas() {
  if (
    confirm(
      "¿Estás seguro de que quieres liberar todas las mesas? Esto las pondrá en estado 'libre' y eliminará cualquier pedido asociado.",
    )
  ) {
    mesas.forEach((mesa) => {
      mesa.estado = "libre"
      mesa.pedido = null
    })
    storage.mesas.guardar(mesas)
    loadMesas()
    showNotification("Todas las mesas han sido liberadas", "success")
  }
}

// === ENVÍO DE PEDIDOS ===
function sendOrder(type) {
  if (type === "domicilio") {
    sendDomicilioOrder()
  } else {
    sendLocalOrder()
  }
}

function sendDomicilioOrder() {
  const nombre = document.getElementById("nombre-domicilio").value.trim()
  const telefono = document.getElementById("telefono-domicilio").value.trim()
  const direccion = document.getElementById("direccion-domicilio").value.trim()

  if (!nombre || !telefono || !direccion || !coordenadasSeleccionadas || carrito.length === 0) {
    showNotification("Por favor completa todos los campos requeridos", "warning")
    return
  }

  if (telefono.length !== 10 || !/^\d{10}$/.test(telefono)) {
    showNotification("El teléfono debe tener exactamente 10 dígitos", "warning")
    return
  }

  const metodoPago = document.querySelector('input[name="metodo-pago"]:checked').value
  const efectivoPago = document.getElementById("efectivo-pago").value
  const referencia = document.getElementById("referencia-domicilio").value.trim()

  const subtotal = carrito.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const total = subtotal + costoEnvioActual

  const pedido = {
    id: Date.now(),
    type: "domicilio",
    timestamp: new Date().toISOString(),
    status: "pendiente",
    customer: { nombre, telefono, direccion, referencia, coordenadas: coordenadasSeleccionadas, tipoVivienda },
    items: carrito.map((item) => ({
      product: item.product.nombre,
      size: item.sizeKey,
      quantity: item.quantity,
      price: item.price,
      personalization: item.personalization,
    })),
    payment: { metodo: metodoPago, efectivo: efectivoPago || null },
    delivery: { distancia: distanciaKm, costo: costoEnvioActual, tiempoEstimado: tiempoEntregaEstimado },
    totals: { subtotal, envio: costoEnvioActual, total },
  }

  const whatsappMessage = generateWhatsAppMessage(pedido)
  const whatsappUrl = `https://wa.me/573147511474?text=${encodeURIComponent(whatsappMessage)}`

  pedidos.push(pedido)
  guardarPedido(pedido)

  carrito = []
  updateCart("domicilio")

  showNotification("Nuevo pedido a domicilio recibido!", "info") // Notificación visual
  window.open(whatsappUrl, "_blank")
  showNotification("Pedido enviado por WhatsApp", "success")
}

function sendLocalOrder() {
  if (!mesaSeleccionada || carritoLocal.length === 0) {
    showNotification("Selecciona una mesa y agrega productos", "warning")
    return
  }

  const nombreCliente = document.getElementById("nombre-local").value.trim()
  const observaciones = document.getElementById("observaciones-local").value.trim()

  const subtotal = carritoLocal.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const pedido = {
    id: Date.now(),
    type: "local",
    timestamp: new Date().toISOString(),
    status: "pendiente",
    mesa: mesaSeleccionada,
    customer: { nombre: nombreCliente || "Consumidor Final", observaciones },
    items: carritoLocal.map((item) => ({
      product: item.product.nombre,
      size: item.sizeKey,
      quantity: item.quantity,
      price: item.price,
      personalization: item.personalization,
    })),
    totals: { subtotal, total: subtotal },
  }

  const mesa = mesas.find((m) => m.numero === mesaSeleccionada)
  if (mesa) {
    mesa.estado = "ocupada"
    mesa.pedido = { id: pedido.id, total: subtotal, items: carritoLocal.length }
    storage.mesas.guardar(mesas)
  }

  pedidos.push(pedido)
  guardarPedido(pedido)

  carritoLocal = []
  mesaSeleccionada = null
  document.getElementById("mesa-local").value = ""
  document.getElementById("nombre-local").value = ""
  document.getElementById("observaciones-local").value = ""

  updateCart("local")
  loadMesas()
  showNotification("Nuevo pedido en local recibido!", "info") // Notificación visual
  showNotification("Pedido enviado al panel administrativo", "success")
}

function generateWhatsAppMessage(pedido) {
  let message = `🍕 *PIZZERIA MAMPANOS NUEVO DOMICILIO* 🍕

`
  message += `📋 *Pedido #${pedido.id}*
`
  message += `👤 *Cliente:* ${pedido.customer.nombre}
`
  message += `📞 *Teléfono:* ${pedido.customer.telefono}
`
  message += `📍 *Dirección:* ${pedido.customer.direccion}
`
  if (pedido.customer.referencia)
    message += `🏠 *Referencia:* ${pedido.customer.referencia}
`
  message += `🏘️ *Tipo de vivienda:* ${pedido.customer.tipoVivienda === "conjunto" ? "Conjunto/Edificio" : "Casa/Apartamento"}

`

  message += `🛒 *PRODUCTOS:*
`
  pedido.items.forEach((item, index) => {
    message += `${index + 1}. ${item.product} (${item.size})
`
    message += `   Cantidad: ${item.quantity} - ${formatCurrency(item.price)}
`
    if (item.personalization) {
      if (item.personalization.saboresCombinados?.length > 0) {
        message += `   Sabores: ${item.personalization.saboresCombinados.map((s) => s.nombre).join(", ")}
`
      }
      if (item.personalization.borde && item.personalization.borde !== "normal") {
        message += `   Borde: ${item.personalization.bordeNombre}
`
      }
      if (item.personalization.ingredientesExtras?.length > 0) {
        message += `   Extras: ${item.personalization.ingredientesExtras.map((i) => `${i.nombre} (${formatCurrency(i.precio)})`).join(", ")}`
      }
      if (item.personalization.observaciones) {
        message += `   Observaciones: ${item.personalization.observaciones}
`
      }
    }
    message += `
`
  })

  message += `💰 *RESUMEN:*
`
  message += `Subtotal: ${formatCurrency(pedido.totals.subtotal)}
`
  message += `Envío (${pedido.delivery.distancia}km): ${formatCurrency(pedido.totals.envio)}
`
  message += `*TOTAL: ${formatCurrency(pedido.totals.total)}*

`

  message += `💳 *Método de pago:* ${pedido.payment.metodo}
`
  if (pedido.payment.efectivo)
    message += `💵 *Paga con:* ${formatCurrency(pedido.payment.efectivo)}
`

  message += `
⏰ *Tiempo estimado:* ${pedido.delivery.tiempoEstimado} minutos
`
  message += `📅 *Fecha:* ${formatDateToColombia(pedido.timestamp)}`

  return message
}

// === PANEL ADMINISTRATIVO ===
function loadPedidosList() {
  const container = document.getElementById("lista-pedidos")
  if (!container) return

  // Limpiar el contenido existente para evitar duplicados en cada carga
  container.innerHTML = ""

  // Crear el contenedor para el botón de refresco
  const refreshButtonContainer = document.createElement("div")
  refreshButtonContainer.className = "flex justify-end mb-4"
  refreshButtonContainer.innerHTML = `
  <button onclick="refreshAdminPanel()" class="btn bg-gray-200 text-gray-800 hover:bg-gray-300">
    <i class="fas fa-sync-alt mr-2"></i>Refrescar Pedidos
  </button>
`
  container.appendChild(refreshButtonContainer) // Añadir el botón al inicio del contenedor

  const filtroEstado = document.getElementById("filtro-estado").value
  // Filtrar pedidos que no estén "despachados" para la lista activa
  let pedidosFiltrados = pedidos.filter((p) => p.status !== "despachado")

  if (filtroEstado !== "todos") {
    pedidosFiltrados = pedidosFiltrados.filter((p) => p.status === filtroEstado)
  }

  const ordersContentContainer = document.createElement("div") // Contenedor para las tarjetas de pedidos
  ordersContentContainer.className = "orders-content" // Puedes añadir una clase para estilos si es necesario

  if (pedidosFiltrados.length === 0) {
    ordersContentContainer.innerHTML =
      '<div class="card"><div class="card-content p-8 text-center text-gray-500">No hay pedidos activos para mostrar</div></div>'
  } else {
    ordersContentContainer.innerHTML = pedidosFiltrados
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map((pedido) => renderPedidoCard(pedido))
      .join("")
  }

  container.appendChild(ordersContentContainer) // Añadir el contenedor de pedidos después del botón
}

function loadHistorialPedidosList() {
  const container = document.getElementById("lista-historial-pedidos")
  if (!container) return

  const pedidosDespachados = pedidos.filter((p) => p.status === "despachado")

  if (pedidosDespachados.length === 0) {
    container.innerHTML =
      '<div class="card"><div class="card-content p-8 text-center text-gray-500">No hay pedidos despachados en el historial</div></div>'
    return
  }

  container.innerHTML = pedidosDespachados
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map((pedido) => renderPedidoCard(pedido))
    .join("")
}

function renderPedidoCard(pedido) {
  const statusColors = {
    pendiente: "bg-yellow-100 text-yellow-800",
    preparacion: "bg-blue-100 text-blue-800",
    listo: "bg-green-100 text-green-800",
    despachado: "bg-gray-100 text-gray-800",
  }

  const typeIcons = { domicilio: "fas fa-truck", local: "fas fa-utensils" }

  return `<div class="card" data-pedido-id="${pedido.id}">
<div class="card-header">
  <div class="flex items-center justify-between">
    <div class="flex items-center space-x-3">
      <i class="${typeIcons[pedido.type]} text-xl text-orange-600"></i>
      <div>
        <h4 class="font-semibold">Pedido #${pedido.id}</h4>
        <p class="text-sm text-gray-600">${formatDateToColombia(pedido.timestamp)}</p>
      </div>
    </div>
    <div class="flex items-center space-x-2">
      <span class="px-2 py-1 rounded-full text-xs font-medium ${statusColors[pedido.status]}">
        ${pedido.status.charAt(0).toUpperCase() + pedido.status.slice(1)}
      </span>
      <span class="font-bold text-lg text-orange-600">${formatCurrency(pedido.totals.total)}</span>
    </div>
  </div>
</div>
<div class="card-content">
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <h5 class="font-medium mb-2">Cliente:</h5>
      <p class="text-sm">${pedido.customer?.nombre ?? "N/A"}</p>
      ${pedido.type === "domicilio" ? `<p class="text-sm text-gray-600">${pedido.customer?.telefono ?? ""}</p><p class="text-sm text-gray-600">${pedido.customer?.direccion ?? ""}</p>` : `<p class="text-sm text-gray-600">Mesa ${pedido.mesa}</p>`}
    </div>
    <div>
      <h5 class="font-medium mb-2">Productos:</h5>
      ${(pedido.items ?? []) // Añadir comprobación defensiva aquí
        .map(
          (item) => `
        <p class="text-sm">${item.quantity}x ${item.product} (${item.size})</p>
        ${
          item.personalization && item.personalization.ingredientesExtras?.length > 0
            ? `<p class="text-xs text-gray-500 ml-4">Extras: ${item.personalization.ingredientesExtras.map((i) => `${i.nombre} (${formatCurrency(i.precio)})`).join(", ")}</p>`
            : ""
        }
        ${
          item.personalization && item.personalization.observaciones
            ? `<p class="text-xs text-gray-500 ml-4">Obs: ${item.personalization.observaciones}</p>`
            : ""
        }
      `,
        )
        .join("")}
    </div>
  </div>
  <div class="flex space-x-2 mt-4">
    ${pedido.status === "pendiente" ? `<button onclick="updatePedidoStatus(${pedido.id}, 'preparacion')" class="btn-sm bg-blue-600 text-white">Marcar en Preparación</button>` : ""}
    ${pedido.status === "preparacion" ? `<button onclick="updatePedidoStatus(${pedido.id}, 'listo')" class="btn-sm bg-green-600 text-white">Marcar Listo</button>` : ""}
    ${pedido.status === "listo" ? `<button onclick="updatePedidoStatus(${pedido.id}, 'despachado')" class="btn-sm bg-gray-600 text-white">Marcar Despachado</button>` : ""}
    <button onclick="imprimirPedido(${pedido.id})" class="btn-sm bg-purple-600 text-white">
      <i class="fas fa-print mr-1"></i>Imprimir Factura
    </button>
    <button onclick="imprimirComandaCocina(${pedido.id})" class="btn-sm bg-orange-600 text-white">
      <i class="fas fa-print mr-1"></i>Imprimir Comanda
    </button>
    ${renderDeleteButton(pedido.id, pedido.status)}
  </div>
</div>
</div>`
}

function renderDeleteButton(pedidoId, status) {
  // Solo mostrar botón si el pedido no está despachado
  if (status === "despachado") return ""

  return `
      <button class="btn-eliminar-pedido flex items-center justify-center p-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              data-pedido-id="${pedidoId}"
              onclick="deletePedido(${pedidoId})"
              title="Eliminar pedido">
          <i class="fas fa-trash mr-1"></i>
          <span class="hidden md:inline">Eliminar</span>
      </button>
  `
}

async function updatePedidoStatus(pedidoId, newStatus) {
  const pedido = pedidos.find((p) => p.id === pedidoId)
  if (pedido) {
    pedido.status = newStatus
    pedido.lastUpdated = new Date().toISOString()

    if (pedido.type === "local" && newStatus === "despachado") {
      const mesa = mesas.find((m) => m.numero === pedido.mesa)
      if (mesa) {
        mesa.estado = "libre"
        mesa.pedido = null
        storage.mesas.guardar(mesas)
      }
    }

    localStorage.setItem(STORAGE_KEYS.PEDIDOS, JSON.stringify(pedidos))
    // Intentar guardar en el servidor
    try {
      await fetchWithTimeout(`${SERVER_CONFIG.baseUrl}${SERVER_CONFIG.endpoints.pedidosSave}`, {
        method: "POST",
        body: JSON.stringify({ order: pedido }), // Enviar el pedido actualizado
      })
      showNotification(`Pedido #${pedidoId} actualizado a ${newStatus} en el servidor`, "success")
    } catch (error) {
      console.error("Error al actualizar el estado del pedido en el servidor:", error)
      showNotification(`Pedido #${pedidoId} actualizado localmente, error al sincronizar`, "warning")
      addToPendingSync({ endpoint: SERVER_CONFIG.endpoints.pedidosSave, method: "POST", data: { order: pedido } })
    }

    loadPedidosList() // Reload active orders
    loadHistorialPedidosList() // Reload historial orders
    updateAdminStats()
    showNotification(`Pedido #${pedidoId} actualizado a ${newStatus}`, "success")
  }
}

async function deletePedido(pedidoId) {
  if (!confirm("¿Estás seguro de que deseas eliminar este pedido? Esta acción no se puede deshacer.")) {
    return
  }

  try {
    // Mostrar indicador de carga
    const loadingIndicator = document.createElement("div")
    loadingIndicator.className = "fixed top-0 left-0 w-full h-1 bg-blue-500 z-50"
    loadingIndicator.id = "delete-loading-indicator"
    document.body.appendChild(loadingIndicator)

    // Enviar solicitud al servidor
    const response = await fetchWithTimeout(`${SERVER_CONFIG.baseUrl}${SERVER_CONFIG.endpoints.deleteOrder}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: pedidoId }),
    })

    // Eliminar indicador de carga
    document.getElementById("delete-loading-indicator")?.remove()

    if (response && response.success) {
      // Eliminar el pedido del array local 'pedidos'
      pedidos = pedidos.filter((p) => p.id !== pedidoId)
      localStorage.setItem(STORAGE_KEYS.PEDIDOS, JSON.stringify(pedidos))

      // Actualizar la interfaz
      const pedidoElement = document.querySelector(`[data-pedido-id="${pedidoId}"]`)
      if (pedidoElement) {
        pedidoElement.classList.add("opacity-0", "transition-opacity", "duration-300")
        setTimeout(() => pedidoElement.remove(), 300)
      }

      // Actualizar estadísticas
      updateAdminStats()

      // Mostrar notificación
      showNotification(`Pedido #${pedidoId} eliminado exitosamente`, "success")

      // Si el pedido era en local, liberar la mesa
      if (response.data?.mesa) {
        const mesa = mesas.find((m) => m.numero === response.data.mesa)
        if (mesa) {
          mesa.estado = "libre"
          mesa.pedido = null
          storage.mesas.guardar(mesas)
          loadMesas()
        }
      }
      // Recargar las listas para asegurar que se reflejen los cambios
      loadPedidosList()
      loadHistorialPedidosList()
    } else {
      showNotification(response?.message || "Error al eliminar el pedido", "error")
    }
  } catch (error) {
    document.getElementById("delete-loading-indicator")?.remove()
    console.error("Error al eliminar pedido:", error)

    if (error.message.includes("No encontrado")) {
      showNotification("El pedido ya no existe o fue eliminado", "warning")
    } else {
      showNotification("Error de conexión al eliminar pedido", "error")
    }
  }
}

function updateAdminStats() {
  const hoy = new Date().toDateString()
  const pedidosHoy = pedidos.filter((p) => new Date(p.timestamp).toDateString() === hoy)

  const ventasHoy = pedidosHoy.reduce((sum, p) => sum + p.totals.total, 0)
  const totalPedidos = pedidosHoy.length
  const pedidosDomicilio = pedidosHoy.filter((p) => p.type === "domicilio").length
  const pedidosLocal = pedidosHoy.filter((p) => p.type === "local").length
  const promedioPerPedido = totalPedidos > 0 ? ventasHoy / totalPedidos : 0
  const pedidosActivos = pedidos.filter((p) => ["pendiente", "preparacion", "listo"].includes(p.status)).length

  document.getElementById("pendientes-count").textContent = pedidos.filter((p) => p.status === "pendiente").length
  document.getElementById("preparacion-count").textContent = pedidos.filter((p) => p.status === "preparacion").length
  document.getElementById("listos-count").textContent = pedidos.filter((p) => p.status === "listo").length

  document.getElementById("ventas-dia").textContent = formatCurrency(ventasHoy)
  document.getElementById("total-pedidos").textContent = totalPedidos
  document.getElementById("distribucion-pedidos").textContent = `${pedidosDomicilio} domicilio, ${pedidosLocal} local`
  document.getElementById("promedio-pedido").textContent = formatCurrency(promedioPerPedido)
  document.getElementById("pedidos-activos").textContent = pedidosActivos

  const totalPorcentajeDomicilio = totalPedidos > 0 ? Math.round((pedidosDomicilio / totalPedidos) * 100) : 0
  const totalPorcentajeLocal = totalPedidos > 0 ? Math.round((pedidosLocal / totalPedidos) * 100) : 0

  document.getElementById("domicilios-count").textContent = `${pedidosDomicilio} pedidos`
  document.getElementById("domicilios-porcentaje").textContent = `${totalPorcentajeDomicilio}%`
  document.getElementById("local-count").textContent = `${pedidosLocal} pedidos`
  document.getElementById("local-porcentaje").textContent = `${totalPorcentajeLocal}%`
}

function loadTopSellingProducts() {
  const container = document.getElementById("productos-vendidos")
  if (!container) return

  const hoy = new Date().toDateString()
  const pedidosHoy = pedidos.filter((p) => new Date(p.timestamp).toDateString() === hoy)

  const productCount = {}
  pedidosHoy.forEach((pedido) => {
    ;(pedido.items ?? []).forEach((item) => {
      // Añadir comprobación defensiva aquí
      const productName = item.product?.nombre || item.product
      const productSize = item.size || item.sizeKey || "Tamaño Desconocido"
      const key = `${productName} (${productSize})`
      productCount[key] = (productCount[key] || 0) + item.quantity
    })
  })

  const sortedProducts = Object.entries(productCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  if (sortedProducts.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No hay ventas registradas hoy</p>'
    return
  }

  container.innerHTML = sortedProducts
    .map(
      ([product, count], index) =>
        `<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
    <div class="flex items-center space-x-3">
      <span class="w-6 h-6 bg-orange-600 text-white rounded-full flex items-center justify-center text-xs font-bold">${index + 1}</span>
      <span class="font-medium">${product}</span>
    </div>
    <span class="font-bold text-orange-600">${count}</span>
  </div>`,
    )
    .join("")
}

// === GESTIÓN DE MENÚ ===
function cargarListaProductos() {
  const container = document.getElementById("lista-productos")
  const filtroCategoria = document.getElementById("filtro-categoria-productos").value
  const busqueda = document.getElementById("buscar-productos").value.toLowerCase()

  let productosFiltrados = productos
  if (filtroCategoria) productosFiltrados = productosFiltrados.filter((p) => p.categoria === filtroCategoria)
  if (busqueda) productosFiltrados = productosFiltrados.filter((p) => p.nombre.toLowerCase().includes(busqueda))

  if (productosFiltrados.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No se encontraron productos</p>'
    return
  }

  container.innerHTML = productosFiltrados
    .map(
      (producto) =>
        `<div class="border rounded-lg p-4">
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center space-x-2">
        <span class="text-2xl">${producto.emoji}</span>
        <div>
          <h4 class="font-semibold">${producto.nombre}</h4>
          <p class="text-sm text-gray-600">${producto.descripcion}</p>
          <p class="text-xs text-gray-500">Categoría: ${getCategoryName(producto.categoria)}</p>
        </div>
      </div>
      <div class="flex space-x-2">
        <button onclick="editarProducto(${producto.id})" class="btn-sm bg-blue-600 text-white">
          <i class="fas fa-edit"></i>
        </button>
        <button onclick="eliminarProducto(${producto.id})" class="btn-sm bg-red-600 text-white">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
      ${Object.entries(producto.precios)
        .map(([size, price]) => `<span class="bg-gray-100 px-2 py-1 rounded">${size}: ${formatCurrency(price)}</span>`)
        .join("")}
    </div>
    <div class="flex space-x-2 mt-2">
      ${producto.combinable ? '<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Combinable</span>' : ""}
      ${producto.bordeRelleno ? '<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Borde relleno</span>' : ""}
      ${producto.permiteIngredientesExtra ? '<span class="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Extras</span>' : ""}
    </div>
  </div>`,
    )
    .join("")
}

function mostrarFormularioProducto(productId = null) {
  const card = document.getElementById("formulario-producto-card")
  const title = document.getElementById("titulo-formulario-producto")
  const form = document.getElementById("form-producto")
  const permiteIngredientesExtraCheckbox = document.getElementById("producto-permite-ingredientes-extra")
  const ingredientesExtraSelectionContainer = document.getElementById("ingredientes-extra-selection-container")

  if (productId) {
    const producto = productos.find((p) => p.id === productId)
    if (producto) {
      title.textContent = "Editar Producto"
      document.getElementById("producto-id").value = producto.id
      document.getElementById("producto-nombre").value = producto.nombre
      document.getElementById("producto-descripcion").value = producto.descripcion
      document.getElementById("producto-categoria").value = producto.categoria
      document.getElementById("producto-emoji").value = producto.emoji
      document.getElementById("producto-combinable").checked = producto.combinable
      document.getElementById("producto-borde-relleno").checked = producto.bordeRelleno
      permiteIngredientesExtraCheckbox.checked = producto.permiteIngredientesExtra || false // Asegurar valor por defecto

      // Almacenar el producto actual para el modal de ingredientes
      currentProductForIngredientSelection = { ...producto }

      loadPricesInForm(producto.precios)
    }
  } else {
    title.textContent = "Nuevo Producto"
    form.reset()
    document.getElementById("producto-id").value = ""
    permiteIngredientesExtraCheckbox.checked = false // Por defecto, no permite extras
    currentProductForIngredientSelection = { id: null, nombre: "", categoria: "", ingredientesAsociados: [] } // Reset para nuevo producto
    loadPricesInForm({})
  }

  // Mostrar/ocultar el botón de selección de ingredientes al cargar el formulario
  if (permiteIngredientesExtraCheckbox.checked) {
    ingredientesExtraSelectionContainer.classList.remove("hidden")
  } else {
    ingredientesExtraSelectionContainer.classList.add("hidden")
    // Limpiar ingredientes asociados si se desactiva la opción
    if (currentProductForIngredientSelection) {
      currentProductForIngredientSelection.ingredientesAsociados = []
    }
  }

  // Event listener para el checkbox de ingredientes extra
  permiteIngredientesExtraCheckbox.onchange = () => {
    if (permiteIngredientesExtraCheckbox.checked) {
      ingredientesExtraSelectionContainer.classList.remove("hidden")
    } else {
      ingredientesExtraSelectionContainer.classList.add("hidden")
      // Limpiar ingredientes asociados si se desactiva la opción
      if (currentProductForIngredientSelection) {
        currentProductForIngredientSelection.ingredientesAsociados = []
      }
    }
  }

  card.scrollIntoView({ behavior: "smooth" })
}

function loadPricesInForm(precios) {
  const container = document.getElementById("precios-container")
  const tamanos = configuracionMenu.tamanos || ["personal", "small", "medium", "large"]

  container.innerHTML = tamanos
    .map(
      (tamano) =>
        `<div class="flex items-center space-x-2 form-precio">
    <label class="w-20 text-sm capitalize">${tamano}:</label>
    <input type="number" name="precio" class="form-input flex-1" placeholder="0" value="${precios[tamano] || ""}">
    <input type="hidden" name="tamano" value="${tamano}">
    <button type="button" onclick="removePriceField(this)" class="btn-xs bg-red-600 text-white">
      <i class="fas fa-times"></i>
    </button>
  </div>`,
    )
    .join("")
}

function addPriceField() {
  const container = document.getElementById("precios-container")
  const newSize = prompt("Nombre del nuevo tamaño:")
  if (!newSize) return

  const div = document.createElement("div")
  div.className = "flex items-center space-x-2 form-precio"
  div.innerHTML = `
<label class="w-20 text-sm capitalize">${newSize}:</label>
<input type="number" name="precio" class="form-input flex-1" placeholder="0">
<input type="hidden" name="tamano" value="${newSize}">
<button type="button" onclick="removePriceField(this)" class="btn-xs bg-red-600 text-white">
<i class="fas fa-times"></i>
</button>
`
  container.appendChild(div)
}

function removePriceField(buttonElement) {
  buttonElement.closest(".form-precio").remove()
}

function editarProducto(productId) {
  console.log("Intentando editar producto con ID:", productId)
  mostrarFormularioProducto(productId)
}

function eliminarProducto(productId) {
  console.log("Intentando eliminar producto con ID:", productId)
  if (confirm("¿Estás seguro de que quieres eliminar este producto?")) {
    productos = productos.filter((p) => p.id !== productId)
    storage.productos.guardar(productos)
    cargarListaProductos()
    showNotification("Producto eliminado", "success")
  }
}

function cancelarFormularioProducto() {
  document.getElementById("form-producto").reset()
  document.getElementById("producto-id").value = ""
  document.getElementById("titulo-formulario-producto").textContent = "Nuevo Producto"
  document.getElementById("producto-permite-ingredientes-extra").checked = false
  document.getElementById("ingredientes-extra-selection-container").classList.add("hidden")
  currentProductForIngredientSelection = null // Limpiar
  loadPricesInForm({})
}

// === GESTIÓN DE INGREDIENTES ===
function cargarListaIngredientes() {
  const container = document.getElementById("lista-ingredientes")

  if (ingredientesExtras.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">No hay ingredientes registrados</p>'
    return
  }

  container.innerHTML = ingredientesExtras
    .map(
      (ingrediente) =>
        `<div class="border rounded-lg p-4">
    <div class="flex items-center justify-between mb-2">
      <div>
        <h4 class="font-semibold">${ingrediente.nombre}</h4>
        <p class="text-sm text-gray-600">Precio: ${formatCurrency(ingrediente.precio || 0)}</p>
        <p class="text-xs text-gray-500">Categoría: ${ingrediente.categoria ? getCategoryName(ingrediente.categoria) : "Todas"}</p>
      </div>
      <div class="flex items-center space-x-2">
        <span class="px-2 py-1 rounded-full text-xs ${ingrediente.disponible ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}">
          ${ingrediente.disponible ? "Disponible" : "No disponible"}
        </span>
        <button onclick="editarIngrediente(${ingrediente.id})" class="btn-sm bg-blue-600 text-white">
          <i class="fas fa-edit"></i>
        </button>
        <button onclick="eliminarIngrediente(${ingrediente.id})" class="btn-sm bg-red-600 text-white">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  </div>`,
    )
    .join("")
}

function cargarCategoriasEnSelectIngredientes() {
  const select = document.getElementById("ingrediente-categoria")
  if (!select) return

  let options = '<option value="">Todas las categorías</option>'
  Object.values(gruposCategorias).forEach((grupo) => {
    if (grupo.categorias) {
      Object.entries(grupo.categorias).forEach(([key, catData]) => {
        options += `<option value="${key}">${catData.nombre}</option>`
      })
    }
  })
  select.innerHTML = options
}

function mostrarFormularioIngrediente(ingredienteId = null) {
  const title = document.getElementById("titulo-formulario-ingrediente")
  const form = document.getElementById("form-ingrediente")

  if (ingredienteId) {
    const ingrediente = ingredientesExtras.find((i) => i.id === ingredienteId)
    if (ingrediente) {
      title.textContent = "Editar Ingrediente"
      document.getElementById("ingrediente-id").value = ingrediente.id
      document.getElementById("ingrediente-nombre").value = ingrediente.nombre
      document.getElementById("ingrediente-precio").value = ingrediente.precio || ""
      document.getElementById("ingrediente-categoria").value = ingrediente.categoria || ""
      document.getElementById("ingrediente-disponible").checked = ingrediente.disponible
    }
  } else {
    title.textContent = "Nuevo Ingrediente"
    form.reset()
    document.getElementById("ingrediente-id").value = ""
    document.getElementById("ingrediente-disponible").checked = true
  }
}

function editarIngrediente(ingredienteId) {
  mostrarFormularioIngrediente(ingredienteId)
}

function eliminarIngrediente(ingredienteId) {
  if (confirm("¿Estás seguro de que quieres eliminar este ingrediente?")) {
    ingredientesExtras = ingredientesExtras.filter((i) => i.id !== ingredienteId)
    storage.ingredientes.guardar(ingredientesExtras)
    cargarListaIngredientes()
    showNotification("Ingrediente eliminado", "success")
  }
}

function cancelarFormularioIngrediente() {
  document.getElementById("form-ingrediente").reset()
  document.getElementById("ingrediente-id").value = ""
  document.getElementById("titulo-formulario-ingrediente").textContent = "Nuevo Ingrediente"
}

// === MODAL DE SELECCIÓN DE INGREDIENTES EXTRA (PARA ADMINISTRACIÓN DE PRODUCTOS) ===
function openSeleccionarIngredientesModal() {
  const modal = document.getElementById("seleccionar-ingredientes-modal")
  const content = document.getElementById("ingredientes-modal-content")
  const productNameSpan = document.getElementById("ingredientes-modal-product-name")

  if (!currentProductForIngredientSelection) {
    showNotification("Primero selecciona o crea un producto.", "warning")
    return
  }

  productNameSpan.textContent = currentProductForIngredientSelection.nombre

  // Filtrar ingredientes por categoría del producto
  const productosCategoria = currentProductForIngredientSelection.categoria
  const ingredientesFiltrados = ingredientesExtras.filter(
    (ing) => ing.disponible && (!ing.categoria || ing.categoria === productosCategoria),
  )

  if (ingredientesFiltrados.length === 0) {
    content.innerHTML =
      '<p class="text-gray-500 text-center py-4">No hay ingredientes extra disponibles para esta categoría.</p>'
  } else {
    content.innerHTML = ingredientesFiltrados
      .map((ing) => {
        const isChecked = currentProductForIngredientSelection.ingredientesAsociados.includes(ing.id)
        return `
      <label class="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50">
        <input type="checkbox" name="selected-ingrediente" value="${ing.id}" ${isChecked ? "checked" : ""}>
        <span class="text-sm">${ing.nombre}</span>
        <span class="text-xs text-gray-500 ml-auto">${ing.precio > 0 ? "+" + formatCurrency(ing.precio) : "Gratis"}</span>
      </label>
    `
      })
      .join("")
  }

  modal.classList.remove("hidden")
}

function closeSeleccionarIngredientesModal() {
  document.getElementById("seleccionar-ingredientes-modal").classList.add("hidden")
}

function saveSelectedIngredientes() {
  if (!currentProductForIngredientSelection) return

  const selectedIds = []
  document
    .querySelectorAll('#ingredientes-modal-content input[name="selected-ingrediente"]:checked')
    .forEach((checkbox) => {
      selectedIds.push(Number.parseInt(checkbox.value))
    })

  currentProductForIngredientSelection.ingredientesAsociados = selectedIds
  showNotification("Ingredientes extra asociados al producto.", "success")
  closeSeleccionarIngredientesModal()
}

// === CONFIGURACIÓN ===
function cargarConfiguracion() {
  const tamanosList = document.getElementById("tamanos-list")
  tamanosList.innerHTML = (configuracionMenu.tamanos || [])
    .map(
      (tamano) =>
        `<div class="flex items-center space-x-2">
    <input type="text" value="${tamano}" class="form-input flex-1" data-tamano="${tamano}">
    <button onclick="removeGlobalSize('${tamano}')" class="btn-xs bg-red-600 text-white">
      <i class="fas fa-times"></i>
    </button>
  </div>`,
    )
    .join("")

  const borderTypesList = document.getElementById("border-types-list")
  borderTypesList.innerHTML = (configuracionMenu.tiposBorde || [])
    .map(
      (borde) =>
        `<div class="border rounded p-3 mb-2">
    <div class="flex items-center justify-between mb-2">
      <input type="text" value="${borde.nombre}" class="form-input flex-1" data-border-name="${borde.key}">
      <button onclick="removeBorderType('${borde.key}')" class="btn-xs bg-red-600 text-white ml-2">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
      ${(configuracionMenu.tamanos || [])
        .map(
          (tamano) =>
            `<div class="flex items-center space-x-1">
              <label class="text-xs capitalize">${tamano}:</label>
              <input type="number" value="${borde.precios[tamano] || 0}" class="form-input text-xs" data-border-price="${borde.key}-${tamano}">
            </div>`,
        )
        .join("")}
    </div>
  </div>`,
    )
    .join("")

  document.getElementById("default-costo-adicional").value =
    configuracionMenu.costosCombinacion?.defaultCostoAdicional || 2000

  const customCostsList = document.getElementById("custom-combination-costs-list")
  const customCosts = configuracionMenu.costosCombinacion?.saboresCombinacionPersonalizados || []
  customCostsList.innerHTML = customCosts
    .map(
      (cost, index) =>
        `<div class="border rounded p-3 mb-2">
    <div class="flex items-center justify-between mb-2">
      <select class="form-select flex-1" data-custom-cost-product="${index}">
        <option value="">Seleccionar producto</option>
        ${productos
          .map((p) => `<option value="${p.id}" ${p.id === cost.productId ? "selected" : ""}>${p.nombre}</option>`)
          .join("")}
      </select>
      <button onclick="removeCustomCombinationCost(${index})" class="btn-xs bg-red-600 text-white ml-2">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
      ${(configuracionMenu.tamanos || [])
        .map(
          (tamano) =>
            `<div class="flex items-center space-x-1">
              <label class="text-xs capitalize">${tamano}:</label>
              <input type="number" value="${cost.precios?.[tamano] || cost.precio || 0}" class="form-input text-xs" data-custom-cost-price="${index}-${tamano}">
            </div>`,
        )
        .join("")}
    </div>
  </div>`,
    )
    .join("")
}

function addGlobalSize() {
  const newSize = prompt("Nombre del nuevo tamaño:")
  if (!newSize) return

  if (!configuracionMenu.tamanos) configuracionMenu.tamanos = []
  configuracionMenu.tamanos.push(newSize)
  cargarConfiguracion()
}

function removeGlobalSize(tamano) {
  if (confirm(`¿Eliminar el tamaño "${tamano}"?`)) {
    configuracionMenu.tamanos = configuracionMenu.tamanos.filter((t) => t !== tamano)
    cargarConfiguracion()
  }
}

function addBorderType() {
  const newBorderName = prompt("Nombre del nuevo tipo de borde:")
  if (!newBorderName) return

  const newBorderKey = newBorderName.toLowerCase().replace(/\s+/g, "-")
  const newBorder = {
    key: newBorderKey,
    nombre: newBorderName,
    precios: {},
  }
  ;(configuracionMenu.tamanos || []).forEach((tamano) => {
    newBorder.precios[tamano] = 0
  })

  if (!configuracionMenu.tiposBorde) configuracionMenu.tiposBorde = []
  configuracionMenu.tiposBorde.push(newBorder)
  cargarConfiguracion()
}

function removeBorderType(borderKey) {
  if (confirm(`¿Eliminar este tipo de borde?`)) {
    configuracionMenu.tiposBorde = configuracionMenu.tiposBorde.filter((b) => b.key !== borderKey)
    cargarConfiguracion()
  }
}

function addCustomCombinationCostField() {
  if (!configuracionMenu.costosCombinacion) {
    configuracionMenu.costosCombinacion = { defaultCostoAdicional: 2000, saboresCombinacionPersonalizados: [] }
  }

  const newCost = {
    productId: null,
    precios: {},
  }
  ;(configuracionMenu.tamanos || []).forEach((tamano) => {
    newCost.precios[tamano] = 0
  })

  configuracionMenu.costosCombinacion.saboresCombinacionPersonalizados.push(newCost)
  cargarConfiguracion()
}

function removeCustomCombinationCost(index) {
  if (confirm("¿Eliminar esta configuración de costo específico?")) {
    configuracionMenu.costosCombinacion.saboresCombinacionPersonalizados.splice(index, 1)
    cargarConfiguracion()
  }
}

function saveConfiguration() {
  const tamanos = []
  document.querySelectorAll("[data-tamano]").forEach((input) => {
    if (input.value.trim()) tamanos.push(input.value.trim())
  })
  configuracionMenu.tamanos = tamanos

  const tiposBorde = []
  document.querySelectorAll("[data-border-name]").forEach((input) => {
    const borderKey = input.dataset.borderName
    const borderName = input.value.trim()
    if (borderName) {
      const border = { key: borderKey, nombre: borderName, precios: {} }
      tamanos.forEach((tamano) => {
        const priceInput = document.querySelector(`[data-border-price="${borderKey}-${tamano}"]`)
        border.precios[tamano] = Number.parseInt(priceInput?.value || 0)
      })
      tiposBorde.push(border)
    }
  })
  configuracionMenu.tiposBorde = tiposBorde

  const defaultCosto = Number.parseInt(document.getElementById("default-costo-adicional").value || 2000)
  const saboresCombinacionPersonalizados = []

  document.querySelectorAll("[data-custom-cost-product]").forEach((select, index) => {
    const productId = Number.parseInt(select.value)
    if (productId) {
      const customCost = { productId, precios: {} }
      tamanos.forEach((tamano) => {
        const priceInput = document.querySelector(`[data-custom-cost-price="${index}-${tamano}"]`)
        customCost.precios[tamano] = Number.parseInt(priceInput?.value || 0)
      })
      saboresCombinacionPersonalizados.push(customCost)
    }
  })

  configuracionMenu.costosCombinacion = { defaultCostoAdicional: defaultCosto, saboresCombinacionPersonalizados }

  storage.configuracion.guardar(configuracionMenu)
  showNotification("Configuración guardada exitosamente", "success")
}

// === FUNCIONES DE EXPORTACIÓN E IMPORTACIÓN ===
function exportarConfiguracionCompleta() {
  const configuracionCompleta = {
    productos,
    gruposCategorias,
    ingredientesExtras,
    configuracionMenu,
    timestamp: new Date().toISOString(),
  }

  const dataStr = JSON.stringify(configuracionCompleta, null, 2)
  const dataBlob = new Blob([dataStr], { type: "application/json" })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement("a")
  link.href = url
  link.download = `mampanos-menu-${new Date().toISOString().split("T")[0]}.json`
  link.click()
  URL.revokeObjectURL(url)
  showNotification("Configuración exportada exitosamente", "success")
}

function importarConfiguracionCompleta() {
  const input = document.createElement("input")
  input.type = "file"
  input.accept = ".json"
  input.onchange = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const configuracionImportada = JSON.parse(e.target.result)
        if (
          configuracionImportada.productos &&
          configuracionImportada.gruposCategorias &&
          configuracionImportada.configuracionMenu
        ) {
          productos = configuracionImportada.productos
          gruposCategorias = configuracionImportada.gruposCategorias
          ingredientesExtras = configuracionImportada.ingredientesExtras || []
          configuracionMenu = configuracionImportada.configuracionMenu

          storage.productos.guardar(productos)
          storage.categorias.guardar(gruposCategorias)
          ingredientesExtras = configuracionImportada.ingredientesExtras || []
          storage.ingredientes.guardar(ingredientesExtras)
          storage.configuracion.guardar(configuracionMenu)

          showNotification("Configuración importada exitosamente", "success")
          setTimeout(() => location.reload(), 1000)
        } else {
          showNotification("Archivo de configuración inválido", "error")
        }
      } catch (error) {
        showNotification("Error al importar configuración", "error")
        console.error("Error importing configuration:", error)
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

function resetearMenu() {
  if (confirm("¿Estás seguro de que quieres resetear todo el menú? Esta acción no se puede deshacer.")) {
    productos = DEFAULT_PRODUCTS
    gruposCategorias = DEFAULT_CATEGORIES
    ingredientesExtras = []
    configuracionMenu = DEFAULT_MENU_CONFIG

    storage.productos.guardar(productos)
    storage.categorias.guardar(gruposCategorias)
    storage.ingredientes.guardar(ingredientesExtras)
    storage.configuracion.guardar(configuracionMenu)

    showNotification("Menú reseteado exitosamente", "success")
    setTimeout(() => location.reload(), 1000)
  }
}

// === FUNCIONES DE EXPORTACIÓN DE PEDIDOS ===
function exportarPedidosAExcel(periodo) {
  const fechaActual = new Date()
  let fechaInicio, fechaFin

  switch (periodo) {
    case "daily":
      fechaInicio = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), fechaActual.getDate())
      fechaFin = new Date(fechaInicio)
      fechaFin.setDate(fechaFin.getDate() + 1)
      break
    case "weekly":
      const inicioSemana = fechaActual.getDate() - fechaActual.getDay()
      fechaInicio = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), inicioSemana)
      fechaFin = new Date(fechaInicio)
      fechaFin.setDate(fechaFin.getDate() + 7)
      break
    case "monthly":
      fechaInicio = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1)
      fechaFin = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 1)
      break
    case "yearly":
      fechaInicio = new Date(fechaActual.getFullYear(), 0, 1)
      fechaFin = new Date(fechaActual.getFullYear() + 1, 0, 1)
      break
  }

  const pedidosFiltrados = pedidos.filter((p) => {
    const fechaPedido = new Date(p.timestamp)
    return fechaPedido >= fechaInicio && fechaPedido < fechaFin
  })

  if (pedidosFiltrados.length === 0) {
    showNotification("No hay pedidos en el período seleccionado", "warning")
    return
  }

  let csvContent = "ID,Fecha,Tipo,Cliente,Teléfono,Mesa,Estado,Subtotal,Envío,Total,Método Pago\n"

  pedidosFiltrados.forEach((pedido) => {
    csvContent += [
      pedido.id,
      formatDateToColombia(pedido.timestamp),
      pedido.type,
      pedido.customer.nombre,
      pedido.customer.telefono || "",
      pedido.mesa || "",
      pedido.status,
      pedido.totals.subtotal,
      pedido.totals.envio || 0,
      pedido.totals.total,
      pedido.payment?.metodo || "",
    ].join(",")
    csvContent += "\n"
  })

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `pedidos-${periodo}-${fechaActual.toISOString().split("T")[0]}.csv`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  showNotification(`Pedidos ${periodo} exportados exitosamente`, "success")
}

function imprimirReporteCaja(periodo) {
  const fechaActual = new Date()
  let fechaInicio, fechaFin, titulo

  switch (periodo) {
    case "daily":
      fechaInicio = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), fechaActual.getDate())
      fechaFin = new Date(fechaInicio)
      fechaFin.setDate(fechaFin.getDate() + 1)
      titulo = "Reporte Diario de Caja"
      break
    case "weekly":
      const inicioSemana = fechaActual.getDate() - fechaActual.getDay()
      fechaInicio = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), inicioSemana)
      fechaFin = new Date(fechaInicio)
      fechaFin.setDate(fechaFin.getDate() + 7)
      break
    case "monthly":
      fechaInicio = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1)
      fechaFin = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 1)
      titulo = "Reporte Mensual de Caja"
      break
    case "yearly":
      fechaInicio = new Date(fechaActual.getFullYear(), 0, 1)
      fechaFin = new Date(fechaActual.getFullYear() + 1, 0, 1)
      titulo = "Reporte Anual de Caja"
      break
    case "quarterly":
      const trimestre = Math.floor(fechaActual.getMonth() / 3)
      fechaInicio = new Date(fechaActual.getFullYear(), trimestre * 3, 1)
      fechaFin = new Date(fechaActual.getFullYear(), (trimestre + 1) * 3, 1)
      titulo = "Reporte Trimestral de Caja"
      break
  }

  const pedidosFiltrados = pedidos.filter((p) => {
    const fechaPedido = new Date(p.timestamp)
    return fechaPedido >= fechaInicio && fechaPedido < fechaFin
  })

  if (pedidosFiltrados.length === 0) {
    showNotification("No hay pedidos en el período seleccionado", "warning")
    return
  }

  const ventasPorMetodo = {
    efectivo: 0,
    nequi: 0,
    daviplata: 0,
    transferencia: 0,
    otros: 0, // Para métodos de pago no especificados
  }

  pedidosFiltrados.forEach((p) => {
    const metodo = p.payment?.metodo?.toLowerCase() || "otros"
    const totalPedido = p.totals.total
    if (ventasPorMetodo.hasOwnProperty(metodo)) {
      ventasPorMetodo[metodo] += totalPedido
    } else {
      ventasPorMetodo.otros += totalPedido
    }
  })

  const totalVentas = pedidosFiltrados.reduce((sum, p) => sum + p.totals.total, 0)
  const ventasDomicilio = pedidosFiltrados
    .filter((p) => p.type === "domicilio")
    .reduce((sum, p) => sum + p.totals.total, 0)
  const ventasLocal = pedidosFiltrados.filter((p) => p.type === "local").reduce((sum, p) => sum + p.totals.total, 0)
  const totalEnvios = pedidosFiltrados
    .filter((p) => p.type === "domicilio")
    .reduce((sum, p) => sum + (p.totals.envio || 0), 0)

  const printWindow = window.open("", "_blank")
  printWindow.document.write(`
<html>
  <head>
    <title>${titulo}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; }
      .header { text-align: center; margin-bottom: 30px; }
      .header h1 { font-size: 1.8em; margin: 5px 0; }
      .logo { width: 80px; height: 80px; margin: 0 auto 10px auto; display: block; object-fit: cover; }
      .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin-bottom: 30px; }
      .stat-box { border: 1px solid #ddd; padding: 15px; border-radius: 5px; text-align: center; }
      .stat-title { font-weight: bold; color: #333; font-size: 0.9em; margin-bottom: 5px; }
      .stat-value { font-size: 1.4em; color: #e97316; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background-color: #f2f2f2; }
      .total-row { font-weight: bold; background-color: #f9f9f9; }
    </style>
  </head>
  <body>
    <div class="header">
      <img src="https://henry-h.websitex5.me/mampanospizza/imagen/logo.jpeg" alt="Mampanos Pizza Logo" class="logo">
      <h1>Mampanos Pizza</h1>
      <h2>${titulo}</h2>
      <p>Período: ${fechaInicio.toLocaleDateString()} - ${fechaFin.toLocaleDateString()}</p>
      <p>Generado: ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="stats">
      <div class="stat-box">
        <div class="stat-title">Total de Ventas</div>
        <div class="stat-value">${formatCurrency(totalVentas)}</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">Total de Pedidos</div>
        <div class="stat-value">${pedidosFiltrados.length}</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">Ventas Domicilio</div>
        <div class="stat-value">${formatCurrency(ventasDomicilio)}</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">Ventas Local</div>
        <div class="stat-value">${formatCurrency(ventasLocal)}</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">Efectivo</div>
        <div class="stat-value">${formatCurrency(ventasPorMetodo.efectivo)}</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">Nequi</div>
        <div class="stat-value">${formatCurrency(ventasPorMetodo.nequi)}</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">Daviplata</div>
        <div class="stat-value">${formatCurrency(ventasPorMetodo.daviplata)}</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">Transferencia</div>
        <div class="stat-value">${formatCurrency(ventasPorMetodo.transferencia)}</div>
      </div>
      ${
        ventasPorMetodo.otros > 0
          ? `
      <div class="stat-box">
        <div class="stat-title">Otros Métodos</div>
        <div class="stat-value">${formatCurrency(ventasPorMetodo.otros)}</div>
      </div>
      `
          : ""
      }
    </div>

    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Fecha</th>
          <th>Tipo</th>
          <th>Método de Pago</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${pedidosFiltrados
          .map(
            (p) => `
          <tr>
            <td>${p.id}</td>
            <td>${p.timestamp ? formatDateToColombia(p.timestamp) : "Fecha inválida"}</td>
            <td>${p.type}</td>
            <td>${p.payment?.metodo?.charAt(0).toUpperCase() + p.payment?.metodo?.slice(1) || "N/A"}</td>
            <td>${formatCurrency(p.totals.total)}</td>
          </tr>
        `,
          )
          .join("")}
        <tr class="total-row">
          <td colspan="4">TOTAL</td>
          <td>${formatCurrency(totalVentas)}</td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`)

  printWindow.document.close()
  printWindow.print()
}

function imprimirPedido(pedidoId) {
  console.log(`Attempting to print order with ID: ${pedidoId}`)
  const pedido = pedidos.find((p) => p.id === pedidoId)

  if (!pedido) {
    console.error(`Pedido with ID ${pedidoId} not found.`)
    showNotification(`Error: Pedido #${pedidoId} no encontrado.`, "error")
    return
  }

  const printWindow = window.open("", "_blank")

  if (!printWindow) {
    showNotification(
      "El bloqueador de pop-ups impidió la impresión. Por favor, deshabilítalo para este sitio.",
      "warning",
    )
    console.warn("Pop-up blocker prevented print window from opening.")
    return
  }

  try {
    printWindow.document.write(`
    <html>
      <head>
        <title>Factura POS #${pedido.id}</title>
        <style>
          body {
            font-family: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif;', monospace;
            margin: 0;
            padding: 10px;
            font-size: 18px;
            color: black; /* Todo el texto en negro */
            width: 80mm; /* Ancho típico de recibo POS */
            box-sizing: border-box;
          }
          .header, .footer {
            text-align: center;
            margin-bottom: 10px;
          }
          .header h1 {
            font-size: 22px;
            margin: 5px 0;
            color: black;
          }
          .header p {
            margin: 2px 0;
            color: black;
            font-size: 19px;
          }
          .logo {
            width: 80px; /* Ajusta el tamaño del logo */
            height: 80px;
            margin: 0 auto 5px auto; /* Centra el logo */
            display: block; /* Asegura que ocupe su propio espacio */
          }
          .divider {
            border-top: 1px dashed black;
            margin: 10px 0;
          }
          .section-title {
            font-weight: bold;
            margin-bottom: 5px;
            color: black;
            text-align: center;
            font-size: 19px;
          }
          .item-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 21px;
          }
          .item-qty {
            font-weight: bold;
            width: 30px;
            text-align: left;
          }
          .item-name {
            flex: 1;
            text-align: left;
            padding-right: 5px;
            font-weight: bold;
          }
          .personalization-detail {
            font-size: 12px;
            margin-left: 15px;
            color: #333;
          }
          .observaciones {
            font-style: italic;
            margin-top: 10px;
            border-top: 1px dashed black;
            padding-top: 5px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="https://henry-h.websitex5.me/mampanospizza/imagen/logo.jpeg" alt="Mampanos Pizza Logo" class="logo">
          <h1>Mampanos Pizza</h1>
          <p>NIT: 900.123.456-7</p>
          <p>Calle 22 # 18C- 08, Valledupar, Cesar</p>
          <p>Tel: +57 3147511474</p>
          <p>Regimen Simplificado</p>
          <div class="divider"></div>
          <p>FACTURA DE VENTA POS</p>
          <p>No. PEDIDO: ${pedido.id}</p>
          <p>FECHA: ${pedido.timestamp ? formatDateToColombia(pedido.timestamp) : "Fecha inválida"}</p>
        </div>

        <div class="divider"></div>

        <div class="section">
          <div class="section-title">CLIENTE:</div>
          <p>${pedido.customer?.nombre || "Consumidor Final"}</p>
          ${pedido.type === "domicilio" ? `<p>Tel: ${pedido.customer?.telefono || ""}</p><p>Dir: ${pedido.customer?.direccion || ""}</p>` : `<p>Mesa: ${pedido.mesa}</p>`}
          ${pedido.customer?.observaciones ? `<p>Obs: ${pedido.customer.observaciones}</p>` : ""}
        </div>

        <div class="divider"></div>

        <div class="section">
          <div class="section-title">PRODUCTOS:</div>
          <div class="item-row">
            <span class="item-name">DESCRIPCION</span>
            <span class="item-qty">CANT</span>
            <span class="item-price">V.UNIT</span>
            <span class="item-total">TOTAL</span>
          </div>
          <div class="divider"></div>
          ${(pedido.items ?? []) // Añadir comprobación defensiva aquí
            .map((item) => {
              // item.price ya contiene el precio unitario con personalización
              let itemHtml = `
                <div class="item-row">
                  <span class="item-name">${item.product} (${item.size})</span>
                  <span class="item-qty" style="margin-left: 5px">${item.quantity}</span>
                  <span class="item-price" style="margin-left: 5px">${formatCurrency(item.price)}</span>
                  <span class="item-total" style="margin-left: 5px">${formatCurrency(item.price * item.quantity)}</span>
                </div>
                `

              if (item.personalization) {
                if (item.personalization.saboresCombinados?.length > 0) {
                  itemHtml += `<p class="personalization-detail">Sabores: ${item.personalization.saboresCombinados.map((s) => s.nombre).join(", ")}</p>`
                }
                if (item.personalization.borde && item.personalization.borde !== "normal") {
                  itemHtml += `<p class="personalization-detail">Borde: ${item.personalization.bordeNombre}</p>`
                }
                if (item.personalization.ingredientesExtras?.length > 0) {
                  itemHtml += item.personalization.ingredientesExtras
                    .map(
                      (i) => `
                      <div class="item-row personalization-detail">
                        <span class="item-name">  Extras: ${i.nombre}</span>
                        <span class="item-qty"></span>
                        <span class="item-price"></span>
                        <span class="item-total">${formatCurrency(i.precio)}</span>
                      </div>
                    `,
                    )
                    .join("")
                }
                if (item.personalization.observaciones) {
                  itemHtml += `<p class="personalization-detail">Obs: ${item.personalization.observaciones}</p>`
                }
              }

              return itemHtml
            })
            .join("")}
        </div>

        <div class="divider"></div>

        <div class="section">
          <div class="summary-row">
            <span class="text-left">SUBTOTAL:</span>
            <span class="text-right">${formatCurrency(pedido.totals.subtotal)}</span>
          </div>
          ${
            pedido.type === "domicilio"
              ? `
          <div class="summary-row">
            <span class="text-left">ENVIO:</span>
            <span class="text-right">${formatCurrency(pedido.totals.envio)}</span>
          </div>
          `
              : ""
          }
          <div class="summary-row total-row">
            <span class="text-left">TOTAL A PAGAR:</span>
            <span class="text-right">${formatCurrency(pedido.totals.total)}</span>
          </div>
        </div>

        <div class="divider"></div>

        <div class="section">
          <div class="section-title">METODO DE PAGO:</div>
          <p>${(pedido.payment?.metodo ?? "N/A").toUpperCase()}</p>
          ${pedido.payment.efectivo ? `<p>Paga con: ${formatCurrency(pedido.payment.efectivo)}</p><p>Cambio: ${formatCurrency(pedido.payment.efectivo - pedido.totals.total)}</p>` : ""}
        </div>

        <div class="footer">
          <div class="divider"></div>
          <p>¡GRACIAS POR TU COMPRA!</p>
          <p>Vuelve pronto</p>
        </div>
      </body>
    </html>
  `)
    printWindow.document.close()
    printWindow.print()
  } catch (error) {
    console.error("Error generating or printing invoice:", error)
    showNotification("Error al generar la factura. Consulta la consola para más detalles.", "error")
    if (printWindow) {
      printWindow.close() // Close the window if an error occurs
    }
  }
}

// === MODAL DE INFORMACIÓN DEL MENÚ ===
function mostrarInfoMenuModal() {
  const modal = document.getElementById("info-menu-modal")
  const content = document.getElementById("info-menu-content")

  let html = `
<div class="space-y-6">
<div class="bg-blue-50 p-4 rounded-lg">
  <h4 class="font-semibold text-blue-900 mb-2">📊 Estadísticas del Menú</h4>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
    <div class="text-center">
      <div class="text-2xl font-bold text-blue-600">${productos.length}</div>
      <div class="text-blue-800">Productos</div>
    </div>
    <div class="text-center">
      <div class="text-2xl font-bold text-green-600">${Object.values(gruposCategorias).reduce((sum, grupo) => sum + Object.keys(grupo.categorias || {}).length, 0)}</div>
      <div class="text-green-800">Categorías</div>
    </div>
    <div class="text-center">
      <div class="text-2xl font-bold text-purple-600">${ingredientesExtras.length}</div>
      <div class="text-purple-800">Ingredientes</div>
    </div>
    <div class="text-center">
      <div class="text-2xl font-bold text-orange-600">${configuracionMenu.tamanos?.length || 0}</div>
      <div class="text-orange-800">Tamaños</div>
    </div>
  </div>
</div>
`

  Object.entries(gruposCategorias).forEach(([grupoKey, grupo]) => {
    const productosEnGrupo = productos.filter((p) => {
      return Object.keys(grupo.categorias || {}).includes(p.categoria)
    })

    html += `
<div class="border rounded-lg p-4">
<h4 class="font-semibold text-lg mb-3">${grupo.nombre}</h4>
<div class="space-y-3">
`

    Object.entries(grupo.categorias || {}).forEach(([catKey, catData]) => {
      const productosEnCategoria = productos.filter((p) => p.categoria === catKey)
      html += `
<div class="bg-gray-50 p-3 rounded">
  <div class="flex items-center justify-between mb-2">
    <h5 class="font-medium">${catData.nombre}</h5>
    <span class="text-sm text-gray-600">${productosEnCategoria.length} productos</span>
  </div>
  ${
    productosEnCategoria.length > 0
      ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
      ${productosEnCategoria
        .map(
          (p) => `
        <div class="flex items-center space-x-2">
          <span>${p.emoji}</span>
          <span>${p.nombre}</span>
          <span class="text-xs text-gray-500">
            ${Object.keys(p.precios).length} tamaños
          </span>
        </div>
      `,
        )
        .join("")}
    </div>`
      : '<p class="text-sm text-gray-500">No hay productos en esta categoría</p>'
  }
</div>
`
    })

    html += `
</div>
</div>
`
  })

  html += `
<div class="border rounded-lg p-4">
<h4 class="font-semibold text-lg mb-3">⚙️ Configuración</h4>
<div class="space-y-3">
  <div>
    <h5 class="font-medium mb-2">Tamaños disponibles:</h5>
    <div class="flex flex-wrap gap-2">
      ${(configuracionMenu.tamanos || []).map((tamano) => `<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">${tamano}</span>`).join("")}
    </div>
  </div>
  <div>
    <h5 class="font-medium mb-2">Tipos de borde:</h5>
    <div class="space-y-1">
      ${(configuracionMenu.tiposBorde || [])
        .map(
          (borde) => `
        <div class="text-sm">
          <strong>${borde.nombre}</strong>
          ${
            Object.entries(borde.precios).some(([, precio]) => precio > 0)
              ? `- Precios: ${Object.entries(borde.precios)
                  .filter(([, precio]) => precio > 0)
                  .map(([tamano, precio]) => `${tamano}: ${formatCurrency(precio)}`)
                  .join(", ")}`
              : "- Gratis"
          }
        </div>
      `,
        )
        .join("")}
    </div>
  </div>
  <div>
    <h5 class="font-medium mb-2">Ingredientes extras disponibles:</h5>
    ${
      ingredientesExtras.length > 0
        ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        ${ingredientesExtras
          .filter((ing) => ing.disponible)
          .map(
            (ing) => `
          <div class="text-sm flex justify-between">
            <span>${ing.nombre}</span>
            <span class="text-gray-600">${ing.precio > 0 ? formatCurrency(ing.precio) : "Gratis"}</span>
          </div>
        `,
          )
          .join("")}
      </div>`
        : '<p class="text-sm text-gray-500">No hay ingredientes extras configurados</p>'
    }
  </div>
</div>
</div>
`

  html += `</div>`

  content.innerHTML = html
  modal.classList.remove("hidden")
}

function closeInfoMenuModal() {
  document.getElementById("info-menu-modal").classList.add("hidden")
}

// === GESTIÓN DE PESTAÑAS DE MENÚ ===
function setupMenuTabs() {
  document.querySelectorAll(".menu-group-tab").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      const groupKey = e.target.dataset.menuGroupTab
      const type = e.target.dataset.type

      document.querySelectorAll(`.menu-group-tab[data-type="${type}"]`).forEach((t) => {
        t.classList.remove("active", "border-orange-500", "text-orange-600")
        t.classList.add("border-transparent", "text-gray-500", "hover:text-gray-700", "hover:border-gray-300")
      })

      e.target.classList.add("active", "border-orange-500", "text-orange-600")
      e.target.classList.remove("border-transparent", "text-gray-500", "hover:text-gray-700", "hover:border-gray-300")

      currentProductGroup[type] = groupKey

      const pizzaSubtabs = document.getElementById(`pizza-subtabs-${type}`)
      if (pizzaSubtabs) {
        // Check if element exists before trying to access classList
        pizzaSubtabs.classList.add("hidden") // Asegurarse de que las subpestañas de pizza estén ocultas
      }
      loadProductos(type)
    })
  })
}

// === COMANDA DE COCINA ===
function imprimirComandaCocina(pedidoId) {
  const pedido = pedidos.find((p) => p.id === pedidoId)
  if (!pedido) return

  const printWindow = window.open("", "_blank")
  printWindow.document.write(`
    <html>
      <head>
        <title>Comanda de Cocina #${pedido.id}</title>
        <style>
          body {
            font-family: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', monospace;
            margin: 0;
            padding: 10px;
            font-size: 20px;
            color: black;
            width: 80mm; /* Ancho típico de recibo POS */
            box-sizing: border-box;
          }
          .header {
            text-align: center;
            margin-bottom: 15px;
          }
          .header h1 {
            font-size: 20px;
            margin: 5px 0;
            color: black;
          }
          .header p {
            margin: 2px 0;
            color: black;
          }
          .divider {
            border-top: 1px dashed black;
            margin: 10px 0;
          }
          .section-title {
            font-weight: bold;
            margin-bottom: 5px;
            color: black;
            text-align: center;
            font-size: 19px;
          }
          .item-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 21px;
          }
          .item-qty {
            font-weight: bold;
            width: 30px;
            text-align: left;
          }
          .item-name {
            flex: 1;
            text-align: left;
            padding-right: 5px;
            font-weight: bold;
          }
          .personalization-detail {
            font-size: 12px;
            margin-left: 15px;
            color: #333;
          }
          .observaciones {
            font-style: italic;
            margin-top: 10px;
            border-top: 1px dashed black;
            padding-top: 5px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>COMANDA DE COCINA</h1>
          <p>Mampanos Pizza</p>
          <p>Fecha: ${pedido.timestamp ? formatDateToColombia(pedido.timestamp) : "Fecha inválida"}</p>
          <div class="divider"></div>
          ${
            pedido.type === "domicilio"
              ? `
            <p>PEDIDO #: ${pedido.id}</p>
            <p>CLIENTE: ${pedido.customer?.nombre ?? "N/A"}</p>
            <p>TIPO: DOMICILIO</p>
          `
              : `
            <p>MESA #: ${pedido.mesa}</p>
            <p>CLIENTE: ${pedido.customer?.nombre || "Consumidor Final"}</p>
            <p>TIPO: LOCAL</p>
          `
          }
        </div>

        <div class="divider"></div>

        <div class="section">
          <div class="section-title">DETALLE DEL PEDIDO</div>
          <div class="divider"></div>
          ${(pedido.items ?? []) // Añadir comprobación defensiva aquí
            .map(
              (item) => `
          <div class="item-row">
            <span class="item-qty">${item.quantity}x</span>
            <span class="item-name">${item.product} (${item.size})</span>
          </div>
          ${
            item.personalization
              ? `
            ${item.personalization.saboresCombinados?.length > 0 ? `<p class="personalization-detail">Sabores: ${item.personalization.saboresCombinados.map((s) => s.nombre).join(", ")}</p>` : ""}
            ${item.personalization.borde && item.personalization.borde !== "normal" ? `<p class="personalization-detail">Borde: ${item.personalization.bordeNombre}</p>` : ""}
            ${item.personalization.ingredientesExtras?.length > 0 ? `<p class="personalization-detail">Extras: ${item.personalization.ingredientesExtras.map((i) => i.nombre).join(", ")}</p>` : ""}
        `
              : ""
          }
        `,
            )
            .join("")}
        </div>

        ${
          pedido.customer?.observaciones
            ? `
        <div class="divider"></div>
        <div class="observaciones">
          <div class="section-title">OBSERVACIONES:</div>
          <p>${pedido.customer.observaciones}</p>
        </div>
      `
            : ""
        }

      <div class="footer">
        <div class="divider"></div>
        <p>¡A COCINAR!</p>
      </div>
    </body>
    </html>
  `)

  printWindow.document.close()
  printWindow.print()
}

// === FUNCIONES DE UTILIDAD PARA EL PANEL ADMIN ===
async function refreshAdminPanel() {
  showNotification("Refrescando pedidos...", "info")
  await cargarPedidos() // Vuelve a cargar los pedidos (fusionando con el servidor)
  loadPedidosList() // Vuelve a renderizar la lista de pedidos activos
  loadHistorialPedidosList() // Vuelve a renderizar el historial de pedidos
  updateAdminStats() // Vuelve a actualizar las estadísticas
  showNotification("Pedidos actualizados", "success")
}

// === EVENT LISTENERS Y INICIALIZACIÓN ===
function updateSuggestedCategoryOrder() {
  const categoriaIdInput = document.getElementById("categoria-key")
  if (!categoriaIdInput.value) {
    const selectedGrupo = document.getElementById("categoria-grupo").value
    document.getElementById("categoria-orden").value = getMaxOrderForGroup(selectedGrupo) + 1
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🍕 Iniciando Mampanos Pizza System...")

  await cargarDatos()

  // Mover setupMenuTabs para que se ejecute antes de showSection("domicilio")
  setupMenuTabs()

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const module = e.target.dataset.navModule || e.target.closest("[data-nav-module]").dataset.navModule
      if (["local", "admin", "menu-admin"].includes(module)) {
        checkAccess(module)
      } else {
        showSection(module)
      }
    })
  })

  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      const tabName = e.target.dataset.adminTab
      showAdminTab(tabName)
    })
  })

  document.querySelectorAll(".menu-admin-tab").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      const tabName = e.target.dataset.menuAdminTab
      showMenuAdminTab(tabName)
    })
  })

  document.getElementById("form-producto").addEventListener("submit", async (event) => {
    event.preventDefault()

    const id = document.getElementById("producto-id").value
    const nombre = document.getElementById("producto-nombre").value
    const emoji = document.getElementById("producto-emoji").value
    const categoria = document.getElementById("producto-categoria").value
    const descripcion = document.getElementById("producto-descripcion").value
    const combinable = document.getElementById("producto-combinable").checked
    const bordeRelleno = document.getElementById("producto-borde-relleno").checked
    const permiteIngredientesExtra = document.getElementById("producto-permite-ingredientes-extra").checked

    const precios = {}
    document.querySelectorAll(".form-precio").forEach((form) => {
      const tamano = form.querySelector("[name='tamano']").value
      const precio = Number.parseFloat(form.querySelector("[name='precio']").value)
      if (tamano && !isNaN(precio)) {
        precios[tamano] = precio
      }
    })

    // Usar currentProductForIngredientSelection para obtener los ingredientes asociados
    const ingredientesAsociados =
      permiteIngredientesExtra && currentProductForIngredientSelection
        ? currentProductForIngredientSelection.ingredientesAsociados
        : []

    const nuevoProducto = {
      id: id ? Number.parseInt(id) : Date.now(),
      nombre,
      emoji,
      categoria,
      descripcion,
      combinable,
      bordeRelleno,
      permiteIngredientesExtra, // Guardar el nuevo campo
      ingredientesAsociados, // Guardar el nuevo campo
      precios,
    }

    if (id) {
      const index = productos.findIndex((p) => p.id === Number.parseInt(id))
      if (index !== -1) {
        productos[index] = nuevoProducto
      }
    } else {
      productos.push(nuevoProducto)
    }

    // Guardar los productos actualizados en el almacenamiento local y en el servidor
    const guardarExito = await storage.productos.guardar(productos)

    if (guardarExito) {
      // Si el guardado es exitoso, actualizar la lista de productos y mostrar una notificación
      cargarListaProductos()
      cancelarFormularioProducto()
      showNotification("Producto guardado exitosamente", "success")

      // Recargar los datos para asegurar que la interfaz refleje los cambios
      await cargarDatos()
      loadProductos("domicilio")
      loadProductos("local")
    } else {
      showNotification("Error al guardar el producto", "error")
    }
  })

  document.getElementById("form-categoria").addEventListener("submit", async (e) => {
    // Agregado async
    e.preventDefault()
    const clave = document.getElementById("categoria-clave").value
    const nombre = document.getElementById("categoria-nombre").value
    const grupo = document.getElementById("categoria-grupo").value
    const orden = Number.parseInt(document.getElementById("categoria-orden").value) || 1
    const originalKey = document.getElementById("categoria-key").value

    if (!gruposCategorias[grupo]) gruposCategorias[grupo] = { nombre: "", categorias: {} }
    if (!gruposCategorias[grupo].categorias) gruposCategorias[grupo].categorias = {}

    if (originalKey && originalKey !== clave) {
      delete gruposCategorias[grupo].categorias[originalKey]
    }

    gruposCategorias[grupo].categorias[clave] = { nombre, orden }
    const guardarExito = await storage.categorias.guardar(gruposCategorias) // Esperar a guardar

    if (guardarExito) {
      cargarListaCategorias()
      cancelarFormularioCategoria()
      showNotification("Categoría guardada exitosamente", "success")
      await cargarDatos() // Recargar datos para actualizar la interfaz
      loadProductos("domicilio") // Actualizar productos en vista de domicilio
      loadProductos("local") // Actualizar productos en vista de local
    } else {
      showNotification("Error al guardar la categoría", "error")
    }
  })

  document.getElementById("form-ingrediente").addEventListener("submit", async (e) => {
    // Agregado async
    e.preventDefault()
    const ingredienteId = document.getElementById("ingrediente-id").value

    const ingrediente = {
      id: ingredienteId ? Number.parseInt(ingredienteId) : Date.now(),
      nombre: document.getElementById("ingrediente-nombre").value,
      precio: Number.parseInt(document.getElementById("ingrediente-precio").value) || 0,
      categoria: document.getElementById("ingrediente-categoria").value || null,
      disponible: document.getElementById("ingrediente-disponible").checked,
    }

    if (ingredienteId) {
      const index = ingredientesExtras.findIndex((i) => i.id === Number.parseInt(ingredienteId))
      if (index !== -1) ingredientesExtras[index] = ingrediente
    } else {
      ingredientesExtras.push(ingrediente)
    }

    const guardarExito = await storage.ingredientes.guardar(ingredientesExtras) // Esperar a guardar

    if (guardarExito) {
      cargarListaIngredientes()
      cancelarFormularioIngrediente()
      showNotification("Ingrediente guardado exitosamente", "success")
      await cargarDatos() // Recargar datos para actualizar la interfaz
    } else {
      showNotification("Error al guardar el ingrediente", "error")
    }
  })

  document.getElementById("filtro-estado").addEventListener("change", loadPedidosList)

  document.querySelectorAll('input[name="metodo-pago"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const metodo = e.target.value
      document.getElementById("efectivo-section").style.display = metodo === "efectivo" ? "block" : "none"
      document.getElementById("transferencia-section").style.display = metodo === "transferencia" ? "block" : "none"
      document.getElementById("nequi-section").style.display = metodo === "nequi" ? "block" : "none"
      document.getElementById("daviplata-section").style.display = metodo === "daviplata" ? "block" : "none"
    })
  })

  window.addEventListener("online", () => updateConnectionStatus(true))
  window.addEventListener("offline", () => updateConnectionStatus(false))

  document.getElementById("auth-password").addEventListener("keypress", (e) => {
    if (e.key === "Enter") validateAccess()
  })

  // Initial load for the default active module (domicilio)
  showSection("domicilio")

  document.getElementById("categoria-grupo").addEventListener("change", updateSuggestedCategoryOrder)

  console.log("✅ Sistema inicializado correctamente")
})

function getCategoryName(categoryId) {
  for (const grupoKey in gruposCategorias) {
    if (gruposCategorias[grupoKey].categorias && gruposCategorias[grupoKey].categorias[categoryId]) {
      return gruposCategorias[grupoKey].categorias[categoryId].nombre
    }
  }
  return "Categoría Desconocida"
}

function cargarListaCategorias() {
  const container = document.getElementById("lista-categorias")
  if (!container) return

  let html = ""
  for (const grupoKey in gruposCategorias) {
    const grupo = gruposCategorias[grupoKey]
    html += `<div class="mb-6"><h3 class="text-xl font-bold text-gray-800 mb-4">${grupo.nombre}</h3>`
    html += `<div class="space-y-4">`

    for (const catKey in grupo.categorias) {
      const catData = grupo.categorias[catKey]
      html += `<div class="border rounded-lg p-4 flex items-center justify-between">
              <div>
                <h4 class="font-semibold">${catData.nombre}</h4>
                <p class="text-sm text-gray-600">Clave: ${catKey}</p>
                <p class="text-xs text-gray-500">Orden: ${catData.orden}</p>
              </div>
              <div class="flex space-x-2">
                <button onclick="editarCategoria('${catKey}', '${grupoKey}')" class="btn-sm bg-blue-600 text-white">
                  <i class="fas fa-edit"></i>
                </button>
                <button onclick="eliminarCategoria('${catKey}', '${grupoKey}')" class="btn-sm bg-red-600 text-white">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>`
    }

    html += `</div></div>`
  }

  container.innerHTML = html || '<p class="text-gray-500 text-center py-4">No hay categorías registradas</p>'
}

function cargarCategoriasEnSelect(selectId) {
  const select = document.getElementById(selectId)
  if (!select) return

  let options = '<option value="">Seleccionar categoría</option>'
  Object.values(gruposCategorias).forEach((grupo) => {
    if (grupo.categorias) {
      Object.entries(grupo.categorias).forEach(([key, catData]) => {
        options += `<option value="${key}">${catData.nombre}</option>`
      })
    }
  })
  select.innerHTML = options
}

function mostrarFormularioCategoria(categoriaKey = null, grupoKey = null) {
  const title = document.getElementById("titulo-formulario-categoria")
  const form = document.getElementById("form-categoria")

  if (categoriaKey && grupoKey) {
    const catData = gruposCategorias[grupoKey].categorias[categoriaKey]
    if (catData) {
      title.textContent = "Editar Categoría"
      document.getElementById("categoria-key").value = categoriaKey
      document.getElementById("categoria-clave").value = categoriaKey
      document.getElementById("categoria-nombre").value = catData.nombre
      document.getElementById("categoria-grupo").value = grupoKey
      document.getElementById("categoria-orden").value = catData.orden
    }
  } else {
    title.textContent = "Nueva Categoría"
    form.reset()
    document.getElementById("categoria-key").value = ""
    document.getElementById("categoria-orden").value =
      getMaxOrderForGroup(document.getElementById("categoria-grupo").value) + 1
  }
}

function editarCategoria(categoriaKey, grupoKey) {
  mostrarFormularioCategoria(categoriaKey, grupoKey)
}

function eliminarCategoria(categoriaKey, grupoKey) {
  if (confirm("椹碋st璋﹕ seguro de que quieres eliminar esta categor閾哸?")) {
    delete gruposCategorias[grupoKey].categorias[categoriaKey]
    storage.categorias.guardar(gruposCategorias)
    cargarListaCategorias()
    showNotification("Categor閾哸 eliminada", "success")
  }
}

function cancelarFormularioCategoria() {
  document.getElementById("form-categoria").reset()
  document.getElementById("categoria-key").value = ""
  document.getElementById("titulo-formulario-categoria").textContent = "Nueva Categor闁惧摳"
}

function getMaxOrderForGroup(grupoKey) {
  let maxOrder = 0
  if (gruposCategorias[grupoKey] && gruposCategorias[grupoKey].categorias) {
    for (const catKey in gruposCategorias[grupoKey].categorias) {
      const catData = gruposCategorias[grupoKey].categorias[catKey]
      if (catData.orden > maxOrder) {
        maxOrder = catData.orden
      }
    }
  }
  return maxOrder
}

window.initMap = initMapModule
window.showSection = showSection
window.checkAccess = checkAccess
window.validateAccess = validateAccess
window.closeAuthModal = closeAuthModal
window.selectProductForCart = selectProductForCart
window.addToCart = addToCart
window.changeQuantity = changeQuantity
window.removeFromCart = removeFromCart
window.closePersonalizacionModal = closePersonalizacionModal
window.selectMesa = selectMesa
window.sendOrder = sendOrder
window.updatePedidoStatus = updatePedidoStatus
window.updateDeliveryCost = updateDeliveryCost
window.imprimirPedido = imprimirPedido
window.exportarPedidosAExcel = exportarPedidosAExcel
window.imprimirReporteCaja = imprimirReporteCaja
window.mostrarFormularioProducto = mostrarFormularioProducto
window.editarProducto = editarProducto
window.eliminarProducto = eliminarProducto
window.cancelarFormularioProducto = cancelarFormularioProducto
window.addPriceField = addPriceField
window.removePriceField = removePriceField
window.mostrarFormularioCategoria = mostrarFormularioCategoria
window.editarCategoria = editarCategoria
window.eliminarCategoria = eliminarCategoria
window.cancelarFormularioCategoria = cancelarFormularioCategoria
window.mostrarFormularioIngrediente = mostrarFormularioIngrediente
window.editarIngrediente = editarIngrediente
window.eliminarIngrediente = eliminarIngrediente
window.cancelarFormularioIngrediente = cancelarFormularioIngrediente
window.addGlobalSize = addGlobalSize
window.removeGlobalSize = removeGlobalSize
window.addBorderType = addBorderType
window.removeBorderType = removeBorderType
window.addCustomCombinationCostField = addCustomCombinationCostField
window.removeCustomCombinationCost = removeCustomCombinationCost
window.saveConfiguration = saveConfiguration
window.exportarConfiguracionCompleta = exportarConfiguracionCompleta
window.importarConfiguracionCompleta = importarConfiguracionCompleta
window.resetearMenu = resetearMenu
window.mostrarInfoMenuModal = mostrarInfoMenuModal
window.closeInfoMenuModal = closeInfoMenuModal
window.liberarTodasLasMesas = liberarTodasLasMesas
window.openSeleccionarIngredientesModal = openSeleccionarIngredientesModal // Exportar nueva funci鐠愮珱
window.closeSeleccionarIngredientesModal = closeSeleccionarIngredientesModal // Exportar nueva funci鐠愮珱
window.saveSelectedIngredientes = saveSelectedIngredientes // Exportar nueva funci鐠愮珱
window.imprimirComandaCocina = imprimirComandaCocina // Exportar nueva funci鐠愮珱
window.refreshAdminPanel = refreshAdminPanel
window.getCategoryName = getCategoryName
window.getMaxOrderForGroup = getMaxOrderForGroup
window.deletePedido = deletePedido
window.renderDeleteButton = renderDeleteButton
window.renderPedidoCard = renderPedidoCard
window.updatePedidoStatus = updatePedidoStatus
window.imprimirPedido = imprimirPedido
