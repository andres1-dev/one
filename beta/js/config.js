// Configuración y constantes
const CONFIG = {
  VERSION: "4.0.0",
  CACHE_TTL: 24 * 60 * 60 * 1000, // 24 horas en milisegundos
  MAX_IMAGE_SIZE: 800, // Tamaño máximo para redimensionar imágenes
  MAX_CHUNK_SIZE: 50000, // ~50KB por solicitud
};

// API URLs
const API_URL_GET = "https://script.google.com/macros/s/AKfycbzja5L4QU5qLBO0vSG2cGga18h_Mea3aJEHKyYrWx5_YssSKVLW4Q_Q6egqhel9M0dlKg/exec";
const API_URL_POST = "https://script.google.com/macros/s/AKfycbwgnkjVCMWlWuXnVaxSBD18CGN3rXGZtQZIvX9QlBXSgbQndWC4uqQ2sc00DuNH6yrb/exec";

// Constantes para la cola de carga - INTENTOS ILIMITADOS
const UPLOAD_QUEUE_KEY = 'pdaUploadQueue';
const MAX_RETRIES = -1; // -1 para intentos ilimitados

// Variables globales - SOLO DECLARAR
let database;
let cameraStream;
let currentDocumentData;
let photoBlob;
let preventKeyboardTimer;
let currentQRParts;
let dataLoaded;
let keyboardEnabled;
let uploadQueue;
let qrScanner;

// Elementos DOM globales
let loadingScreen, scanner, barcodeInput, statusDiv, resultsDiv, dataStats, offlineBanner, installBtn;

// Inicializar elementos DOM
function initializeDOMElements() {
  loadingScreen = document.getElementById('loadingScreen');
  scanner = document.getElementById('scanner');
  barcodeInput = document.getElementById('barcode');
  statusDiv = document.getElementById('status');
  resultsDiv = document.getElementById('results');
  dataStats = document.getElementById('data-stats');
  offlineBanner = document.getElementById('offline-banner');
  installBtn = document.getElementById('installBtn');
}

// Inicializar variables globales
function initializeGlobalVariables() {
  database = [];
  cameraStream = null;
  currentDocumentData = null;
  photoBlob = null;
  preventKeyboardTimer = null;
  currentQRParts = null;
  dataLoaded = false;
  keyboardEnabled = false;
  uploadQueue = null;
  qrScanner = null;
}
