/**
 * Infraestructura: Configuración de Google Sheets
 * Almacena y provee las credenciales y URLs dinámicas obtenidas desde la Edge Function.
 * Ya NO contiene credenciales hardcodeadas.
 */
const STORAGE_KEY_API_KEY = "tiempos_google_sheets_api_key";
const STORAGE_KEY_SPREADSHEET_ID = "tiempos_google_sheets_spreadsheet_id";
const STORAGE_KEY_SHEET_NAME = "tiempos_google_sheets_sheet_name";
const STORAGE_KEY_GAS_URL = "tiempos_google_sheets_gas_url";

export class GoogleSheetsConfig {
  static getApiKey() {
    return localStorage.getItem(STORAGE_KEY_API_KEY) || "";
  }

  static setApiKey(key) {
    if (key) localStorage.setItem(STORAGE_KEY_API_KEY, String(key).trim());
  }

  static getSpreadsheetId() {
    return localStorage.getItem(STORAGE_KEY_SPREADSHEET_ID) || "";
  }

  static setSpreadsheetId(id) {
    if (id) localStorage.setItem(STORAGE_KEY_SPREADSHEET_ID, String(id).trim());
  }

  static getSheetName() {
    return localStorage.getItem(STORAGE_KEY_SHEET_NAME) || "Ingresos";
  }

  static setSheetName(name) {
    if (name) localStorage.setItem(STORAGE_KEY_SHEET_NAME, String(name).trim());
  }

  static getGasUrl() {
    return localStorage.getItem(STORAGE_KEY_GAS_URL) || "";
  }

  static setGasUrl(url) {
    if (url) localStorage.setItem(STORAGE_KEY_GAS_URL, String(url).trim());
  }

  static setConfig(config) {
    if (!config) return;
    if (config.apiKey) this.setApiKey(config.apiKey);
    if (config.spreadsheetId) this.setSpreadsheetId(config.spreadsheetId);
    if (config.sheetName) this.setSheetName(config.sheetName);
    if (config.gasUrl) this.setGasUrl(config.gasUrl);
  }

  static hasConfig() {
    return Boolean(this.getApiKey() && this.getSpreadsheetId());
  }

  static resetConfig() {
    localStorage.removeItem(STORAGE_KEY_API_KEY);
    localStorage.removeItem(STORAGE_KEY_SPREADSHEET_ID);
    localStorage.removeItem(STORAGE_KEY_SHEET_NAME);
    localStorage.removeItem(STORAGE_KEY_GAS_URL);
  }
}