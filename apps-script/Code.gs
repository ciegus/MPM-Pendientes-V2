// ============================================================
// MPM Pendientes V2 — Apps Script Backend
// Titan Empaques Mega Planta Mexicali
//
// SETUP (una sola vez):
//   1. Cambia SS_ID por el ID de tu Google Sheet
//   2. Ejecuta setupSheets() en el editor
//   3. Publica como Web App: ejecutar como "Yo", acceso "Cualquier usuario"
//   4. Copia la URL /exec y pégala en app.js → CONFIG.API_URL
// ============================================================

const SS_ID = '1Q40nVwgspk_aWVxWAfO3vy_8llEL_TPCEZNgf2MrFO8';

// Columnas de Pendientes:
// id | equipo | seccion | descripcion | prioridad | responsable | notas |
// fechaLimite | estatus | origen | creadoPor | fechaCreacion |
// fechaActualizacion | aprobadoPor | aprobacionEstado | fechaCierre | notaCierre

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'MPM Pendientes API v2 activa' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try {
    const p = JSON.parse(e.postData.contents);
    let r;
    switch (p.action) {
      case 'login':            r = login(p);            break;
      case 'getPendientes':    r = getPendientes(p);    break;
      case 'savePendiente':    r = savePendiente(p);    break;
      case 'updateEstatus':    r = updateEstatus(p);    break;
      case 'aprobarPropuesta': r = aprobarPropuesta(p); break;
      default: r = { error: 'Acción desconocida: ' + p.action };
    }
    return ContentService
      .createTextOutput(JSON.stringify(r))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ── SETUP ────────────────────────────────────────────────────
function setupSheets() {
  const ss = SpreadsheetApp.openById(SS_ID);

  // Usuarios
  let us = ss.getSheetByName('Usuarios') || ss.insertSheet('Usuarios');
  us.clearContents();
  us.appendRow(['id', 'nombre', 'password', 'rol']);
  us.getRange(2, 1, 7, 4).setValues([
    ['1', 'Luis Manuel Lima Díaz', 'titan2025', 'gerente'],
    ['2', 'Daniel Cervantes',      'titan2025', 'supervisor'],
    ['3', 'Efrain Ruiz',           'titan2025', 'supervisor'],
    ['4', 'Jesus Ley',             'titan2025', 'supervisor'],
    ['5', 'Arol Lopez',            'titan2025', 'supervisor'],
    ['6', 'Ramon Alarcon',         'titan2025', 'supervisor'],
    ['7', 'Nohemi Hernández',      'titan2025', 'planeador'],
  ]);

  // Pendientes
  let ps = ss.getSheetByName('Pendientes') || ss.insertSheet('Pendientes');
  ps.clearContents();
  ps.appendRow([
    'id', 'equipo', 'seccion', 'descripcion', 'prioridad', 'responsable',
    'notas', 'fechaLimite', 'estatus', 'origen', 'creadoPor',
    'fechaCreacion', 'fechaActualizacion', 'aprobadoPor',
    'aprobacionEstado', 'fechaCierre', 'notaCierre'
  ]);

  Logger.log('Hojas V2 inicializadas correctamente.');
}

// ── LOGIN ─────────────────────────────────────────────────────
function login(p) {
  const data = SpreadsheetApp.openById(SS_ID)
    .getSheetByName('Usuarios').getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === p.nombre && data[i][2] === p.password) {
      return {
        success: true,
        usuario: { id: data[i][0], nombre: data[i][1], rol: data[i][3] }
      };
    }
  }
  return { success: false, error: 'Usuario o contraseña incorrectos' };
}

// ── GET PENDIENTES ────────────────────────────────────────────
function getPendientes(p) {
  const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName('Pendientes');
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, pendientes: [], propuestasPendientes: 0 };

  const headers = data[0];
  const toObj = row => {
    const o = {};
    headers.forEach((h, i) => {
      o[h] = row[i] instanceof Date ? row[i].toISOString() : row[i];
    });
    return o;
  };

  const all = data.slice(1).map(toObj);
  let pendientes;

  if (p.rol === 'gerente') {
    pendientes = all;
  } else {
    pendientes = all.filter(r =>
      (r.responsable === p.nombre && r.aprobacionEstado !== 'pendiente') ||
      (r.origen === 'personal'  && r.creadoPor === p.nombre) ||
      (r.origen === 'propuesta' && r.creadoPor === p.nombre)
    );
  }

  const propuestasPendientes = p.rol === 'gerente'
    ? all.filter(r => r.origen === 'propuesta' && r.aprobacionEstado === 'pendiente').length
    : 0;

  return { success: true, pendientes, propuestasPendientes };
}

// ── SAVE PENDIENTE (crear o editar) ──────────────────────────
function savePendiente(p) {
  const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName('Pendientes');

  if (p.id) {
    // Editar existente
    const data = sheet.getDataRange().getValues();
    const h    = data[0];
    const col  = name => h.indexOf(name) + 1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][h.indexOf('id')] === p.id) {
        sheet.getRange(i + 1, col('equipo')).setValue(p.equipo || '');
        sheet.getRange(i + 1, col('seccion')).setValue(p.seccion || '');
        sheet.getRange(i + 1, col('descripcion')).setValue(p.descripcion || '');
        sheet.getRange(i + 1, col('prioridad')).setValue(p.prioridad || 'normal');
        sheet.getRange(i + 1, col('responsable')).setValue(p.responsable || '');
        sheet.getRange(i + 1, col('notas')).setValue(p.notas || '');
        sheet.getRange(i + 1, col('fechaLimite')).setValue(p.fechaLimite || '');
        sheet.getRange(i + 1, col('fechaActualizacion')).setValue(new Date().toISOString());
        return { success: true, id: p.id };
      }
    }
    return { success: false, error: 'Pendiente no encontrado' };
  }

  // Crear nuevo
  const id = Utilities.getUuid();
  const now = new Date().toISOString();
  let aprobacionEstado, responsable;

  if (p.origen === 'personal') {
    aprobacionEstado = 'na';
    responsable = p.creadoPor;
  } else if (p.origen === 'propuesta') {
    aprobacionEstado = 'pendiente';
    responsable = '';
  } else { // asignado (gerente)
    aprobacionEstado = 'aprobado';
    responsable = p.responsable || '';
  }

  sheet.appendRow([
    id, p.equipo || '', p.seccion || '', p.descripcion || '',
    p.prioridad || 'normal', responsable, p.notas || '',
    p.fechaLimite || '', 'pendiente', p.origen || 'personal',
    p.creadoPor, now, now, '', aprobacionEstado, '', ''
  ]);

  return { success: true, id };
}

// ── UPDATE ESTATUS ────────────────────────────────────────────
function updateEstatus(p) {
  const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName('Pendientes');
  const data  = sheet.getDataRange().getValues();
  const h     = data[0];
  const col   = name => h.indexOf(name) + 1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][h.indexOf('id')] === p.id) {
      sheet.getRange(i + 1, col('estatus')).setValue(p.estatus);
      sheet.getRange(i + 1, col('fechaActualizacion')).setValue(new Date().toISOString());
      if (p.estatus === 'cerrado') {
        sheet.getRange(i + 1, col('fechaCierre')).setValue(new Date().toISOString());
        sheet.getRange(i + 1, col('notaCierre')).setValue(p.notaCierre || '');
      } else {
        // Reabrir: limpiar campos de cierre
        sheet.getRange(i + 1, col('fechaCierre')).setValue('');
        sheet.getRange(i + 1, col('notaCierre')).setValue('');
      }
      return { success: true };
    }
  }
  return { success: false, error: 'Pendiente no encontrado' };
}

// ── APROBAR PROPUESTA ─────────────────────────────────────────
function aprobarPropuesta(p) {
  const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName('Pendientes');
  const data  = sheet.getDataRange().getValues();
  const h     = data[0];
  const col   = name => h.indexOf(name) + 1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][h.indexOf('id')] === p.id) {
      if (p.decision === 'aprobado') {
        sheet.getRange(i + 1, col('aprobacionEstado')).setValue('aprobado');
        sheet.getRange(i + 1, col('aprobadoPor')).setValue(p.aprobadoPor);
        sheet.getRange(i + 1, col('responsable')).setValue(p.responsable);
      } else {
        sheet.getRange(i + 1, col('aprobacionEstado')).setValue('rechazado');
        sheet.getRange(i + 1, col('estatus')).setValue('cerrado');
      }
      sheet.getRange(i + 1, col('fechaActualizacion')).setValue(new Date().toISOString());
      return { success: true };
    }
  }
  return { success: false, error: 'Pendiente no encontrado' };
}
