/**
 * Configuration Constants & Mappings for Google Sheets & Google Apps Script
 */

export const CONFIG = {
    SPREADSHEET_ID: localStorage.getItem('gas_spreadsheet_id') || '11kcA7CYcaAHAreSGt9uFOTciSFfXLYTumFiWJvkRRcU',
    SHEET_FILTER: 'FILTER',
    SHEET_DESPACHOS: 'DESPACHOS',
    API_KEY: localStorage.getItem('gas_api_key') || '',
    RANGE_FILTER: 'A:U',
    RANGE_DESPACHOS: 'A:I',
    DEFAULT_GAS_URL: 'https://script.google.com/macros/s/AKfycbzzox2Ki2k0oQEK8cpdo87Ryd4NEtF0JlK96rRY1bb1hrrAlkeQcFgzVN7NY6kEYHnQ/exec'
};

export const COLUMN_INDICES = {
    op: 0,
    ref: 1,
    undCort: 4,
    fechaCorte: 5,
    estadoIntegracion: 6,
    bodegaDespacho: 7,
    descripcion: 15,
    cuento: 16,
    genero: 17,
    tipoTejido: 18,
    pvp: 19,
    clase: 20
};

export const COL_DESP = {
    id: 0,
    fecha: 1,
    op: 2,
    ref: 3,
    cantidad: 4,
    taller: 5,
    despachado: 6,
    observacion: 7,
    fechaDespacho: 8
};

export const DATA_HEADERS = [
    'OP', 'Ref', 'Coleccion', 'UndProg', 'UndCort', 'FechaCorte',
    'Estado de integracion', 'Bodega Despacho', 'InvPlanta', 'NombrePlanta',
    'FSalidaConf', 'FEntregaConf', 'Proceso', 'InvBPT', 'Saldo BPT',
    'Descripcion', 'Cuento', 'Genero', 'Tipo Tejido', 'pvp',
    'TEMPLO DE LA MODA', 'BARRANCA', 'VALOR FACTURACION'
];

export const MONTH_NAMES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

export const MONTHS_MAP = {
    ene: 0, ener: 0, enero: 0,
    feb: 1, febr: 1, febrero: 1,
    mar: 2, marz: 2, marzo: 2,
    abr: 3, abri: 3, abril: 3,
    may: 4, mayo: 4,
    jun: 5, juni: 5, junio: 5,
    jul: 6, juli: 6, julio: 6,
    ago: 7, agos: 7, agosto: 7,
    sep: 8, sept: 8, set: 8, septi: 8, septiembre: 8, setiembre: 8,
    oct: 9, octu: 9, octubre: 9,
    nov: 10, novi: 10, noviembre: 10,
    dic: 11, dici: 11, diciembre: 11
};
