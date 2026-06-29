// ================================================================
// MPM Pendientes V2 — App Logic
// Titan Empaques Mega Planta Mexicali
// ================================================================

const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbyM1OOQ9eHZgfdugEBSkmeoQhOwPE0vQehsZvmNaNan33Fs6SPnAPRTBBFBI0eDB2qi/exec',
  USUARIOS: [
    'Luis Manuel Lima Díaz', 'Daniel Cervantes', 'Efrain Ruiz',
    'Jesus Ley', 'Arol Lopez', 'Ramon Alarcon', 'Nohemi Hernández'
  ],
  SUPERVISORES: [
    'Daniel Cervantes', 'Efrain Ruiz', 'Jesus Ley',
    'Arol Lopez', 'Ramon Alarcon', 'Nohemi Hernández'
  ]
};

let S = {
  user:                null,
  pendientes:          [],
  propuestasPendientes: 0,
  fSt:                 'todos',
  search:              '',
  prevView:            'view-dashboard',
  detId:               null,
  editId:              null,
};

// ── Utilidades ────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d) {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showLoading(show) {
  document.getElementById('loading-overlay').classList.toggle('visible', show);
}

function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (type ? ' toast-' + type : '');
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2800);
}

async function api(action, params) {
  const r = await fetch(CONFIG.API_URL, {
    method: 'POST',
    body: JSON.stringify(Object.assign({ action }, params || {})),
  });
  return r.json();
}

// ── Contador de días ──────────────────────────────────────────

function daysLabel(fl, st) {
  if (!fl || st === 'cerrado') return null;
  const now  = new Date(new Date().toDateString());
  const d    = new Date(fl + 'T00:00:00');
  const diff = Math.round((d - now) / 86400000);
  if (diff === 0)  return { text: 'Hoy',                   cls: 'warn' };
  if (diff === 1)  return { text: 'Mañana',                cls: 'warn' };
  if (diff > 1)    return { text: diff + ' días',          cls: 'ok'   };
  if (diff === -1) return { text: 'Vencido 1d',            cls: 'venc' };
  return               { text: 'Vencido ' + Math.abs(diff) + 'd', cls: 'venc' };
}

// ── Estatus ───────────────────────────────────────────────────

const EST_LABEL = {
  pendiente:  'Pendiente',
  en_proceso: 'En Proceso',
  esperando:  'Esperando',
  cerrado:    'Cerrado',
};

const EST_COLOR = {
  pendiente:  '#E63946',
  en_proceso: '#F4A261',
  esperando:  '#8B949E',
  cerrado:    '#3FB950',
};

function estadoBadge(est) {
  const c = EST_COLOR[est] || '#8B949E';
  const l = EST_LABEL[est] || est;
  return '<span class="estado-badge" style="background:' + c + '22;color:' + c + ';border:1px solid ' + c + '44">' + l + '</span>';
}

// ── Filtro ────────────────────────────────────────────────────

function getFiltered() {
  const q = S.search.trim().toLowerCase();
  return S.pendientes.filter(function(p) {
    var stOk;
    if (S.fSt === 'todos') stOk = true;
    else if (S.fSt === 'propuestas')
      stOk = p.origen === 'propuesta' && p.aprobacionEstado === 'pendiente';
    else stOk = p.estatus === S.fSt;
    if (!stOk) return false;
    if (!q)    return true;
    return (
      (p.descripcion || '').toLowerCase().includes(q) ||
      (p.equipo      || '').toLowerCase().includes(q) ||
      (p.seccion     || '').toLowerCase().includes(q) ||
      (p.responsable || '').toLowerCase().includes(q)
    );
  });
}

// ── Tarjeta ───────────────────────────────────────────────────

function renderCard(p) {
  const color = EST_COLOR[p.estatus] || '#8B949E';
  const dl    = daysLabel(p.fechaLimite, p.estatus);
  const dlHtml = dl ? '<span class="dl ' + dl.cls + '">' + dl.text + '</span>' : '';
  const prioIcon = { baja: '🔵', normal: '🟡', alta: '🔴' }[p.prioridad] || '🟡';

  var meta = '';
  if (p.responsable && p.responsable !== p.creadoPor)
    meta += '<span>👤 ' + esc(p.responsable) + '</span>';
  if (p.fechaLimite)
    meta += '<span>📅 ' + fmtDate(p.fechaLimite) + '</span>';
  meta += dlHtml;

  var extraBadge = '';
  if (p.origen === 'propuesta' && p.aprobacionEstado === 'pendiente')
    extraBadge = '<span class="badge badge-proposal">Propuesta</span>';
  else if (p.origen === 'propuesta' && p.aprobacionEstado === 'rechazado')
    extraBadge = '<span class="badge badge-rejected">Rechazada</span>';

  return '<div class="card pendiente-card" data-estado="' + p.estatus + '" onclick="openDetail(\'' + p.id + '\')">' +
    '<div class="card-top">' +
      (p.equipo  ? '<span class="maquina-tag">' + esc(p.equipo)  + '</span>' : '') +
      (p.seccion ? '<span class="seccion-tag">' + esc(p.seccion) + '</span>' : '') +
      '<span style="margin-left:auto;display:flex;gap:6px;align-items:center">' +
        estadoBadge(p.estatus) + extraBadge +
      '</span>' +
      '<button class="qs-btn" onclick="openQsMenu(event,\'' + p.id + '\')" title="Cambiar estatus">⋮</button>' +
    '</div>' +
    '<p class="descripcion">' + esc(p.descripcion) + '</p>' +
    '<div class="card-meta">' + prioIcon + ' ' + meta + '</div>' +
  '</div>';
}

// ── Dashboard ─────────────────────────────────────────────────

function renderDashboard() {
  var all = S.pendientes;

  document.getElementById('dash-nombre').textContent = S.user.nombre.split(' ')[0];
  document.getElementById('dash-rol').textContent =
    { gerente: 'Gerente', supervisor: 'Supervisor', planeador: 'Planeador' }[S.user.rol] || '';

  document.getElementById('cnt-pend').textContent = all.filter(function(p){ return p.estatus === 'pendiente';  }).length;
  document.getElementById('cnt-proc').textContent = all.filter(function(p){ return p.estatus === 'en_proceso'; }).length;
  document.getElementById('cnt-cerr').textContent = all.filter(function(p){ return p.estatus === 'cerrado';    }).length;

  var propBanner = document.getElementById('dash-propuestas');
  if (S.user.rol === 'gerente' && S.propuestasPendientes > 0) {
    document.getElementById('badge-prop').textContent = S.propuestasPendientes;
    propBanner.hidden = false;
  } else {
    propBanner.hidden = true;
  }

  var gerenteSec = document.getElementById('dash-gerente');
  if (S.user.rol === 'gerente') {
    gerenteSec.hidden = false;
    document.getElementById('supervisor-chips').innerHTML =
      CONFIG.SUPERVISORES.map(function(s) {
        return '<button class="btn btn-ghost btn-sm" onclick="openListaPersona(\'' + s + '\')">' + s.split(' ')[0] + '</button>';
      }).join('');
  } else {
    gerenteSec.hidden = true;
  }

  var recientes = all
    .filter(function(p){ return p.estatus !== 'cerrado'; })
    .sort(function(a,b){ return (b.fechaActualizacion||'').localeCompare(a.fechaActualizacion||''); })
    .slice(0, 5);

  document.getElementById('dash-recent').innerHTML = recientes.length
    ? recientes.map(renderCard).join('')
    : '<div class="empty-msg">Sin pendientes activos 🎉</div>';
}

function renderList() {
  var items = getFiltered();
  document.getElementById('lista-items').innerHTML = items.length
    ? items.map(renderCard).join('')
    : '<div class="empty-msg">Sin resultados</div>';
}

function renderStats() {
  var all = S.pendientes;
  document.getElementById('cnt-pend').textContent = all.filter(function(p){ return p.estatus === 'pendiente';  }).length;
  document.getElementById('cnt-proc').textContent = all.filter(function(p){ return p.estatus === 'en_proceso'; }).length;
  document.getElementById('cnt-cerr').textContent = all.filter(function(p){ return p.estatus === 'cerrado';    }).length;
}

// ── Navegación ────────────────────────────────────────────────

function openLista(fst) {
  S.fSt      = fst;
  S.search   = '';
  S.prevView = 'view-dashboard';

  var titles = { todos:'Todos', pendiente:'Pendiente', en_proceso:'En Proceso',
    esperando:'Esperando', cerrado:'Cerrado', propuestas:'Propuestas' };
  document.getElementById('lista-title').textContent = titles[fst] || fst;

  document.querySelectorAll('.filter-pill').forEach(function(el) {
    el.classList.toggle('active', el.dataset.f === fst);
  });

  // Reset búsqueda si estaba abierta
  var inp = document.getElementById('search-input-lista');
  if (inp) inp.value = '';
  document.getElementById('search-bar-lista').classList.remove('open');
  document.getElementById('btn-search-lista').classList.remove('active');

  renderList();
  showView('view-lista');
}

function openListaPersona(nombre) {
  S.fSt      = 'todos';
  S.search   = '';
  S.prevView = 'view-dashboard';
  document.getElementById('lista-title').textContent = nombre.split(' ')[0];
  document.querySelectorAll('.filter-pill').forEach(function(el){ el.classList.remove('active'); });

  var items = S.pendientes.filter(function(p) {
    return p.responsable === nombre && p.estatus !== 'cerrado';
  });
  document.getElementById('lista-items').innerHTML = items.length
    ? items.map(renderCard).join('')
    : '<div class="empty-msg">Sin pendientes activos para ' + nombre.split(' ')[0] + '</div>';

  showView('view-lista');
}

function setFiltro(f) {
  S.fSt = f;
  document.querySelectorAll('.filter-pill').forEach(function(el) {
    el.classList.toggle('active', el.dataset.f === f);
  });
  renderList();
}

function goBackFromDetalle() {
  S.detId = null;
  showView(S.prevView || 'view-dashboard');
}

// ── Detalle ───────────────────────────────────────────────────

function openDetail(id) {
  S.detId    = id;
  S.prevView = (document.querySelector('.view.active') || {}).id || 'view-dashboard';
  var p = S.pendientes.find(function(x){ return x.id === id; });
  if (!p) return;

  var isGerente = S.user.rol === 'gerente';
  var isMine    = p.creadoPor === S.user.nombre || p.responsable === S.user.nombre;
  var canEdit   = (isGerente || isMine) && p.estatus !== 'cerrado';

  document.getElementById('btn-edit-det').style.display = canEdit ? '' : 'none';

  var dl    = daysLabel(p.fechaLimite, p.estatus);
  var prioMap = { baja: '🔵 Baja', normal: '🟡 Normal', alta: '🔴 Alta' };

  var html = '<div class="detail-card">' +
    '<div class="detail-row"><span class="detail-label">Estatus</span><span class="detail-value">' + estadoBadge(p.estatus) + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">Equipo</span><span class="detail-value">' + (esc(p.equipo) || '—') + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">Sección</span><span class="detail-value">' + (esc(p.seccion) || '—') + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">Prioridad</span><span class="detail-value">' + (prioMap[p.prioridad] || '—') + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">Responsable</span><span class="detail-value">' + (esc(p.responsable) || '—') + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">Creado por</span><span class="detail-value">' + (esc(p.creadoPor) || '—') + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">Fecha límite</span><span class="detail-value">' +
      (p.fechaLimite ? fmtDate(p.fechaLimite) : '—') +
      (dl ? '<span class="dl ' + dl.cls + '" style="margin-left:8px">' + dl.text + '</span>' : '') +
    '</span></div>' +
    '<div class="detail-row"><span class="detail-label">Creación</span><span class="detail-value">' + fmtDate(p.fechaCreacion) + '</span></div>' +
    (p.fechaCierre ? '<div class="detail-row"><span class="detail-label">Cierre</span><span class="detail-value" style="color:#3FB950">' + fmtDate(p.fechaCierre) + '</span></div>' : '') +
    (p.aprobadoPor ? '<div class="detail-row"><span class="detail-label">Aprobado por</span><span class="detail-value">' + esc(p.aprobadoPor) + '</span></div>' : '') +
  '</div>' +
  '<div class="descripcion-card"><span class="detail-label">Descripción</span><p class="descripcion-text">' + esc(p.descripcion) + '</p></div>';

  if (p.notas) {
    html += '<div class="descripcion-card"><span class="detail-label">Notas adicionales</span><p class="descripcion-text">' + esc(p.notas) + '</p></div>';
  }

  if (p.notaCierre) {
    html += '<div class="bitacora-card"><span class="detail-label">📋 Nota de cierre</span><p class="bitacora-text">' + esc(p.notaCierre) + '</p></div>';
  }

  html += '<div class="actions-section">';

  // Panel aprobación (gerente)
  if (p.origen === 'propuesta' && p.aprobacionEstado === 'pendiente' && isGerente) {
    html += '<div class="aprobacion-panel">' +
      '<p class="aprobacion-label">Esta propuesta espera tu aprobación.</p>' +
      '<label>Asignar a</label>' +
      '<select id="ap-responsable" class="form-select" style="margin-bottom:0">' +
        CONFIG.SUPERVISORES.map(function(s){ return '<option value="' + s + '">' + s + '</option>'; }).join('') +
      '</select>' +
      '<div class="aprobacion-btns">' +
        '<button class="btn btn-danger"  onclick="decidirPropuesta(\'rechazado\')">Rechazar</button>' +
        '<button class="btn btn-success" onclick="decidirPropuesta(\'aprobado\')">Aprobar y asignar</button>' +
      '</div></div>';
  }

  // Botones de estatus
  if (p.estatus !== 'cerrado' && (isGerente || isMine)) {
    var opciones = ['pendiente', 'en_proceso', 'esperando', 'cerrado'].filter(function(e){ return e !== p.estatus; });
    html += '<div class="estado-change-panel"><span class="detail-label">Cambiar estatus</span><div class="estado-change-btns">';
    opciones.forEach(function(e) {
      html += '<button class="btn btn-sm" style="background:' + EST_COLOR[e] + '22;color:' + EST_COLOR[e] + ';border:1px solid ' + EST_COLOR[e] + '44" onclick="qSt(\'' + p.id + '\',\'' + e + '\')">' + EST_LABEL[e] + '</button>';
    });
    html += '</div></div>';
  }

  if (p.estatus === 'cerrado' && (isGerente || isMine)) {
    html += '<button class="btn btn-outline btn-full" onclick="qSt(\'' + p.id + '\',\'pendiente\')">↩ Reabrir pendiente</button>';
  }

  html += '</div>';

  document.getElementById('det-content').innerHTML = html;
  showView('view-detalle');
}

// ── Quick Status Menu ─────────────────────────────────────────

var _qsId = null;

function openQsMenu(e, id) {
  e.stopPropagation();
  _qsId = id;
  var menu  = document.getElementById('qs-menu');
  var rect  = e.currentTarget.getBoundingClientRect();
  var menuW = 160, menuH = 200;
  var top  = rect.bottom + 4;
  var left = rect.right - menuW;
  if (top + menuH > window.innerHeight - 10) top = rect.top - menuH - 4;
  if (left < 8) left = 8;
  menu.style.top  = top  + 'px';
  menu.style.left = left + 'px';
  menu.classList.add('open');
}

function qsSelect(est) {
  document.getElementById('qs-menu').classList.remove('open');
  if (!_qsId) return;
  qSt(_qsId, est);
  _qsId = null;
}

document.addEventListener('click', function() {
  document.getElementById('qs-menu').classList.remove('open');
});

// ── Cambio de estatus ─────────────────────────────────────────

async function qSt(id, est) {
  var p = S.pendientes.find(function(x){ return x.id === id; });
  if (!p) return;

  if (est === 'cerrado' && p.estatus !== 'cerrado') {
    openCloseModal(id);
    return;
  }

  showLoading(true);
  try {
    var r = await api('updateEstatus', { id: id, estatus: est });
    if (r.success) {
      p.estatus            = est;
      p.fechaActualizacion = new Date().toISOString();
      if (est !== 'cerrado') { p.fechaCierre = null; p.notaCierre = null; }
      renderStats();
      renderList();
      renderDashboard();
      if (S.detId === id) openDetail(id);
      toast(est === 'pendiente' ? 'Reabierto' : 'Estatus actualizado', 'success');
    } else {
      toast('Error al actualizar', 'error');
    }
  } catch(err) {
    toast('Error de conexión', 'error');
  } finally {
    showLoading(false);
  }
}

// ── Modal nota de cierre ──────────────────────────────────────

var _closeId = null;

function openCloseModal(id) {
  _closeId = id;
  document.getElementById('close-note').value = '';
  document.getElementById('close-modal').classList.add('open');
  setTimeout(function(){ document.getElementById('close-note').focus(); }, 100);
}

async function confirmClose() {
  var nota = document.getElementById('close-note').value.trim() || null;
  document.getElementById('close-modal').classList.remove('open');
  await doClose(_closeId, nota);
  _closeId = null;
}

async function skipClose() {
  document.getElementById('close-modal').classList.remove('open');
  await doClose(_closeId, null);
  _closeId = null;
}

async function doClose(id, nota) {
  var p = S.pendientes.find(function(x){ return x.id === id; });
  if (!p) return;
  showLoading(true);
  try {
    var r = await api('updateEstatus', { id: id, estatus: 'cerrado', notaCierre: nota || '' });
    if (r.success) {
      p.estatus            = 'cerrado';
      p.fechaCierre        = today();
      p.notaCierre         = nota;
      p.fechaActualizacion = new Date().toISOString();
      renderStats();
      renderList();
      renderDashboard();
      if (S.detId === id) openDetail(id);
      toast('Pendiente cerrado ✓', 'success');
    } else {
      toast('Error al cerrar', 'error');
    }
  } catch(err) {
    toast('Error de conexión', 'error');
  } finally {
    showLoading(false);
  }
}

// ── Aprobar / rechazar propuesta ──────────────────────────────

async function decidirPropuesta(decision) {
  var p = S.pendientes.find(function(x){ return x.id === S.detId; });
  if (!p) return;

  var responsable = '';
  if (decision === 'aprobado') {
    var sel = document.getElementById('ap-responsable');
    responsable = sel ? sel.value : '';
    if (!responsable) { toast('Selecciona un responsable', 'error'); return; }
  }

  showLoading(true);
  try {
    var r = await api('aprobarPropuesta', {
      id: p.id, decision: decision,
      aprobadoPor: S.user.nombre, responsable: responsable
    });
    if (r.success) {
      await loadData();
      renderDashboard();
      var updated = S.pendientes.find(function(x){ return x.id === S.detId; });
      if (updated) openDetail(S.detId);
      else showView('view-dashboard');
      toast(decision === 'aprobado' ? 'Propuesta aprobada ✓' : 'Propuesta rechazada', 'success');
    } else {
      toast('Error', 'error');
    }
  } catch(err) {
    toast('Error de conexión', 'error');
  } finally {
    showLoading(false);
  }
}

// ── Formulario nuevo / editar ─────────────────────────────────

function openNuevo() {
  S.editId   = null;
  S.prevView = (document.querySelector('.view.active') || {}).id || 'view-dashboard';
  document.getElementById('nuevo-title').textContent = 'Nuevo Pendiente';
  document.getElementById('fg-origen').hidden         = false;

  var origenSel = document.getElementById('f-origen');
  if (S.user.rol === 'gerente') {
    origenSel.innerHTML =
      '<option value="asignado">📌 Asignado — directo a un supervisor</option>' +
      '<option value="personal">👤 Personal — solo yo lo veo</option>';
  } else {
    origenSel.innerHTML =
      '<option value="personal">👤 Personal — solo yo lo veo</option>' +
      '<option value="propuesta">📋 Propuesta — espera aprobación del gerente</option>';
  }

  onOrigenChange();

  document.getElementById('f-responsable').innerHTML =
    CONFIG.SUPERVISORES.map(function(s){ return '<option value="' + s + '">' + s + '</option>'; }).join('');

  ['f-equipo','f-seccion','f-descripcion','f-notas'].forEach(function(id) {
    document.getElementById(id).value = '';
  });
  document.getElementById('f-prioridad').value   = 'normal';
  document.getElementById('f-fechaLimite').value = '';

  showView('view-nuevo');
}

function openEdit() {
  var p = S.pendientes.find(function(x){ return x.id === S.detId; });
  if (!p) return;
  S.editId = p.id;

  document.getElementById('nuevo-title').textContent = 'Editar Pendiente';
  document.getElementById('fg-origen').hidden         = true;

  document.getElementById('f-equipo').value      = p.equipo      || '';
  document.getElementById('f-seccion').value     = p.seccion     || '';
  document.getElementById('f-descripcion').value = p.descripcion || '';
  document.getElementById('f-notas').value       = p.notas       || '';
  document.getElementById('f-prioridad').value   = p.prioridad   || 'normal';
  document.getElementById('f-fechaLimite').value = p.fechaLimite || '';

  var fgResp = document.getElementById('fg-responsable');
  if (S.user.rol === 'gerente') {
    fgResp.hidden = false;
    document.getElementById('f-responsable').innerHTML =
      CONFIG.SUPERVISORES.map(function(s) {
        return '<option value="' + s + '"' + (p.responsable === s ? ' selected' : '') + '>' + s + '</option>';
      }).join('');
  } else {
    fgResp.hidden = true;
  }

  showView('view-nuevo');
}

function cancelNuevo() {
  S.editId = null;
  showView(S.prevView || 'view-dashboard');
}

function onOrigenChange() {
  var origen = document.getElementById('f-origen').value;
  document.getElementById('fg-responsable').hidden = origen !== 'asignado';
}

async function submitNuevo() {
  var equipo      = document.getElementById('f-equipo').value.trim();
  var descripcion = document.getElementById('f-descripcion').value.trim();

  if (!equipo)      { toast('El equipo es requerido',      'error'); return; }
  if (!descripcion) { toast('La descripción es requerida', 'error'); return; }

  var payload = {
    equipo:      equipo,
    seccion:     document.getElementById('f-seccion').value.trim(),
    descripcion: descripcion,
    prioridad:   document.getElementById('f-prioridad').value,
    fechaLimite: document.getElementById('f-fechaLimite').value,
    notas:       document.getElementById('f-notas').value.trim(),
    responsable: document.getElementById('f-responsable').value || '',
    creadoPor:   S.user.nombre,
  };

  if (S.editId) {
    payload.id = S.editId;
  } else {
    payload.origen = document.getElementById('f-origen').value;
  }

  showLoading(true);
  try {
    var r = await api('savePendiente', payload);
    if (r.success) {
      var wasEdit = !!S.editId;
      S.editId = null;
      await loadData();
      renderDashboard();
      showView('view-dashboard');
      toast(wasEdit ? 'Guardado ✓' : 'Pendiente creado ✓', 'success');
    } else {
      toast(r.error || 'Error al guardar', 'error');
    }
  } catch(err) {
    toast('Error de conexión', 'error');
  } finally {
    showLoading(false);
  }
}

// ── Auth ──────────────────────────────────────────────────────

function initLogin() {
  var sel = document.getElementById('login-nombre');
  sel.innerHTML = '<option value="">— Selecciona —</option>' +
    CONFIG.USUARIOS.map(function(u){ return '<option value="' + u + '">' + u + '</option>'; }).join('');
}

async function doLogin() {
  var nombre   = document.getElementById('login-nombre').value;
  var password = document.getElementById('login-password').value;
  if (!nombre)   { toast('Selecciona tu nombre',  'error'); return; }
  if (!password) { toast('Ingresa la contraseña', 'error'); return; }

  showLoading(true);
  try {
    var r = await api('login', { nombre: nombre, password: password });
    if (r.success) {
      S.user = r.usuario;
      localStorage.setItem('mpm_user', JSON.stringify(S.user));
      await loadData();
      renderDashboard();
      showView('view-dashboard');
    } else {
      toast(r.error || 'Credenciales incorrectas', 'error');
    }
  } catch(err) {
    toast('Error de conexión. Verifica tu internet.', 'error');
  } finally {
    showLoading(false);
  }
}

function doLogout() {
  localStorage.removeItem('mpm_user');
  S.user       = null;
  S.pendientes = [];
  document.getElementById('login-password').value = '';
  showView('view-login');
}

// ── Datos ─────────────────────────────────────────────────────

async function loadData() {
  var r = await api('getPendientes', { nombre: S.user.nombre, rol: S.user.rol });
  if (r.success) {
    S.pendientes           = r.pendientes || [];
    S.propuestasPendientes = r.propuestasPendientes || 0;
  }
}

async function refreshDash() {
  showLoading(true);
  try {
    await loadData();
    renderDashboard();
    toast('Datos actualizados', 'success');
  } catch(err) {
    toast('Error al actualizar', 'error');
  } finally {
    showLoading(false);
  }
}

// ── Búsqueda ──────────────────────────────────────────────────

function initSearch() {
  ['dash', 'lista'].forEach(function(ctx) {
    var btn = document.getElementById('btn-search-' + ctx);
    var bar = document.getElementById('search-bar-' + ctx);
    var inp = document.getElementById('search-input-' + ctx);

    btn.addEventListener('click', function() {
      var isOpen = bar.classList.toggle('open');
      btn.classList.toggle('active', isOpen);
      if (isOpen) {
        S.search = '';
        setTimeout(function(){ inp.focus(); }, 260);
      } else {
        inp.value = '';
        S.search  = '';
        if (ctx === 'lista') renderList();
      }
    });

    inp.addEventListener('input', function(e) {
      S.search = e.target.value;
      if (ctx === 'lista') renderList();
    });
  });
}

// ── Init ──────────────────────────────────────────────────────

async function init() {
  initLogin();
  initSearch();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'SW_UPDATED') window.location.reload();
    });
  }

  var saved = localStorage.getItem('mpm_user');
  if (saved) {
    try {
      S.user = JSON.parse(saved);
      showLoading(true);
      await loadData();
      renderDashboard();
      showView('view-dashboard');
    } catch(err) {
      localStorage.removeItem('mpm_user');
      showView('view-login');
    } finally {
      showLoading(false);
    }
  } else {
    showView('view-login');
  }
}

init();
