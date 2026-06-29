// ================================================================
// MPM Pendientes V2 — Lógica Google Sheets + UI legacy
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

const PRIO_LABEL = { alta: '⛔ Alta', normal: '⚠️ Normal', baja: '✅ Baja' };
const PRIO_COLOR = { alta: '#E63946', normal: '#F4A261', baja: '#00B4D8' };
const EST_LABEL  = { pendiente: 'Pendiente', en_proceso: 'En Proceso', esperando: 'Esperando', cerrado: 'Cerrado' };
const EST_COLOR  = { pendiente: '#E63946', en_proceso: '#F4A261', esperando: '#8B949E', cerrado: '#3FB950' };

let S = {
  user:                null,
  pendientes:          [],
  propuestasPendientes: 0,
  fEq:                 'todos',
  fSt:                 'todos',
  search:              '',
  detId:               null,
  editId:              null,
};

// ── Utilidades ────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10); }

function fmtDate(d) {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${+day} ${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][+m-1]} ${y}`;
}

function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function overdue(fl, st) {
  return fl && st !== 'cerrado' && new Date(fl + 'T00:00:00') < new Date(new Date().toDateString());
}

function daysLabel(fl, st) {
  if (!fl || st === 'cerrado') return null;
  const now  = new Date(new Date().toDateString());
  const d    = new Date(fl + 'T00:00:00');
  const diff = Math.round((d - now) / 86400000);
  if (diff === 0)  return { text: 'Hoy',                        cls: 'warn' };
  if (diff === 1)  return { text: 'Mañana',                     cls: 'warn' };
  if (diff > 1)    return { text: diff + ' días',               cls: 'ok'   };
  if (diff === -1) return { text: 'Vencido 1 día',              cls: 'venc' };
  return               { text: 'Vencido ' + Math.abs(diff) + ' días', cls: 'venc' };
}

function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (type ? ' toast-' + type : '');
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2800);
}

function showLoading(show) {
  document.getElementById('loading-overlay').classList.toggle('visible', show);
}

async function api(action, params) {
  const r = await fetch(CONFIG.API_URL, {
    method: 'POST',
    body: JSON.stringify(Object.assign({ action }, params || {})),
  });
  return r.json();
}

// ── Vistas ───────────────────────────────────────────────────

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function openOverlay(id)  { document.getElementById(id).classList.add('open'); }
function closeOverlay(id) { document.getElementById(id).classList.remove('open'); }

// ── Filtrado ──────────────────────────────────────────────────

function getFiltered() {
  const q = S.search.trim().toLowerCase();
  return S.pendientes.filter(p => {
    const eqOk = S.fEq === 'todos' || p.equipo === S.fEq;
    let stOk;
    if (S.fSt === 'todos')        stOk = true;
    else if (S.fSt === 'propuestas')
      stOk = p.origen === 'propuesta' && p.aprobacionEstado === 'pendiente';
    else                          stOk = p.estatus === S.fSt;
    if (!eqOk || !stOk) return false;
    if (!q) return true;
    return (
      (p.descripcion || '').toLowerCase().includes(q) ||
      (p.equipo      || '').toLowerCase().includes(q) ||
      (p.seccion     || '').toLowerCase().includes(q) ||
      (p.responsable || '').toLowerCase().includes(q)
    );
  });
}

// ── Stats Bar ────────────────────────────────────────────────

function renderStats() {
  const vis  = getFiltered();
  const all  = S.pendientes;
  const crit = vis.filter(p => p.prioridad === 'alta'    && p.estatus !== 'cerrado').length;
  const proc = vis.filter(p => p.estatus === 'en_proceso').length;
  const esp  = vis.filter(p => p.estatus === 'esperando').length;
  const venc = vis.filter(p => overdue(p.fechaLimite, p.estatus)).length;

  const srch = S.search.trim() ? ` · "${S.search.trim()}"` : '';
  const eqLbl = S.fEq !== 'todos' ? ` · ${S.fEq}` : '';
  document.getElementById('subtitle').textContent =
    `${vis.length} pendiente${vis.length !== 1 ? 's' : ''}${eqLbl}${srch}`;

  let html =
    `<div class="stat"><div class="stat-n">${all.length}</div><div class="stat-l">Total</div></div>` +
    `<div class="stat crit"><div class="stat-n">${crit}</div><div class="stat-l">Críticos</div></div>` +
    `<div class="stat proc"><div class="stat-n">${proc}</div><div class="stat-l">En Proceso</div></div>` +
    `<div class="stat"><div class="stat-n">${esp}</div><div class="stat-l">Esperando</div></div>` +
    (venc ? `<div class="stat venc"><div class="stat-n">${venc}</div><div class="stat-l">Vencidos</div></div>` : '');

  if (S.user && S.user.rol === 'gerente' && S.propuestasPendientes > 0) {
    html += `<div class="stat prop"><div class="stat-n">${S.propuestasPendientes}</div><div class="stat-l">Propuestas</div></div>`;
  }

  document.getElementById('stats-bar').innerHTML = html;
}

// ── Filtros ───────────────────────────────────────────────────

function renderFilters() {
  const equipos = ['todos', ...[...new Set(S.pendientes.map(p => p.equipo).filter(Boolean))].sort()];
  document.getElementById('eq-filters').innerHTML = equipos.map(e =>
    `<div class="chip ${S.fEq === e ? 'on' : ''}" data-eq="${esc(e)}">${e === 'todos' ? 'Todos' : esc(e)}</div>`
  ).join('');

  const statuses = ['todos', 'pendiente', 'en_proceso', 'esperando', 'cerrado'];
  if (S.user && S.user.rol === 'gerente') statuses.push('propuestas');
  const stLabels = { todos: 'Todos', pendiente: 'Pendiente', en_proceso: 'En Proceso', esperando: 'Esperando', cerrado: 'Cerrado', propuestas: 'Propuestas' };
  document.getElementById('st-filters').innerHTML = statuses.map(v =>
    `<div class="schip ${S.fSt === v ? 'on' : ''}" data-v="${v}">${stLabels[v]}</div>`
  ).join('');

  document.getElementById('eq-filters').querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => { S.fEq = c.dataset.eq; renderAll(); });
  });
  document.getElementById('st-filters').querySelectorAll('.schip').forEach(c => {
    c.addEventListener('click', () => { S.fSt = c.dataset.v; renderAll(); });
  });
}

// ── Lista agrupada ────────────────────────────────────────────

function renderContent() {
  const el    = document.getElementById('content');
  const items = getFiltered();

  if (!items.length) {
    el.innerHTML = `<div class="empty">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="2"/>
        <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
      </svg>
      <h3>Sin pendientes</h3>
      <p>Usa el botón + para agregar<br>un nuevo pendiente de mantenimiento.</p>
    </div>`;
    return;
  }

  const PO = { alta: 0, normal: 1, baja: 2 };
  const SO = { pendiente: 0, en_proceso: 1, esperando: 2, cerrado: 3 };
  const byEq = {};
  items.forEach(p => {
    const eq  = p.equipo  || 'Sin Equipo';
    const sec = p.seccion || 'General';
    if (!byEq[eq])      byEq[eq] = {};
    if (!byEq[eq][sec]) byEq[eq][sec] = [];
    byEq[eq][sec].push(p);
  });

  let html = '';
  Object.entries(byEq).forEach(([eq, secs]) => {
    const tot     = Object.values(secs).flat().length;
    const hasCrit = Object.values(secs).flat().some(p => p.prioridad === 'alta' && p.estatus !== 'cerrado');
    html += `<div class="eq-grp" data-eq="${esc(eq)}">`;
    html += `<div class="eq-hdr">
      <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      <h2>${esc(eq)}</h2>
      ${hasCrit ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E63946" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' : ''}
      <span class="eq-badge">${tot}</span>
    </div>`;

    Object.entries(secs).forEach(([sec, ps]) => {
      const sorted = [...ps].sort((a, b) => {
        const d = (PO[a.prioridad] || 1) - (PO[b.prioridad] || 1);
        return d || (SO[a.estatus] || 0) - (SO[b.estatus] || 0);
      });
      html += `<div class="sec-grp">
        <div class="sec-hdr">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          ${esc(sec)}<span class="sec-cnt">${sorted.length}</span>
        </div>`;
      sorted.forEach(p => {
        const od    = overdue(p.fechaLimite, p.estatus);
        const dl    = daysLabel(p.fechaLimite, p.estatus);
        const dlHtml = dl ? `<span class="dl ${dl.cls}">${dl.text}</span>` : '';
        const dateHtml = p.fechaLimite
          ? `<span class="mi ${od ? 'ov-lbl' : ''}">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${fmtDate(p.fechaLimite)}</span>` : '';
        const respHtml = (p.responsable && p.responsable !== p.creadoPor)
          ? `<span class="mi">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ${esc(p.responsable)}</span>` : '';
        let extraBadge = '';
        if (p.origen === 'propuesta' && p.aprobacionEstado === 'pendiente')
          extraBadge = '<span class="badge-prop">Propuesta</span>';
        else if (p.origen === 'propuesta' && p.aprobacionEstado === 'rechazado')
          extraBadge = '<span class="badge-rej">Rechazada</span>';

        html += `<div class="pcard" data-id="${p.id}">
          <div class="pbar" data-p="${p.prioridad || 'normal'}"></div>
          <div class="cbody">
            <div class="ctop">
              <div class="cdesc ${p.estatus === 'cerrado' ? 'done' : ''}">${esc(p.descripcion)}</div>
              <div class="sdot ${p.estatus}"></div>
            </div>
            <div class="cmeta">
              <span class="pbadge" data-p="${p.prioridad || 'normal'}">${PRIO_LABEL[p.prioridad] || p.prioridad}</span>
              ${dateHtml}${dlHtml}${respHtml}${extraBadge}
            </div>
          </div>
          <button class="qs-btn" data-qsid="${p.id}" title="Cambiar estatus">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </button>
        </div>`;
      });
      html += '</div>';
    });
    html += '</div>';
  });

  el.innerHTML = html;

  el.querySelectorAll('.eq-hdr').forEach(h =>
    h.addEventListener('click', () => h.closest('.eq-grp').classList.toggle('col'))
  );
  el.querySelectorAll('.pcard').forEach(c =>
    c.addEventListener('click', e => {
      if (e.target.closest('.qs-btn')) return;
      openDetail(c.dataset.id);
    })
  );
  el.querySelectorAll('.qs-btn').forEach(b =>
    b.addEventListener('click', e => {
      e.stopPropagation();
      openQsMenu(e, b.dataset.qsid);
    })
  );
}

function renderAll() { renderStats(); renderFilters(); renderContent(); }

// ── Quick Status Menu ─────────────────────────────────────────

let _qsId = null;

function openQsMenu(e, id) {
  _qsId = id;
  const menu  = document.getElementById('qs-menu');
  const rect  = e.currentTarget.getBoundingClientRect();
  const menuW = 170, menuH = 208;
  let top  = rect.bottom + 4;
  let left = rect.right - menuW;
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

document.addEventListener('click', e => {
  const menu = document.getElementById('qs-menu');
  if (menu.classList.contains('open') && !menu.contains(e.target))
    menu.classList.remove('open');
});

// ── Cambio de estatus ─────────────────────────────────────────

async function qSt(id, est) {
  const p = S.pendientes.find(x => x.id === id);
  if (!p) return;
  if (est === 'cerrado' && p.estatus !== 'cerrado') {
    openCloseModal(id);
    return;
  }
  showLoading(true);
  try {
    const r = await api('updateEstatus', { id, estatus: est });
    if (r.success) {
      p.estatus = est;
      p.fechaActualizacion = new Date().toISOString();
      if (est !== 'cerrado') { p.fechaCierre = null; p.notaCierre = null; }
      renderAll();
      if (S.detId === id) openDetail(id);
      toast(est === 'pendiente' ? 'Reabierto' : 'Estatus actualizado', 'success');
    } else {
      toast('Error al actualizar', 'error');
    }
  } catch (_) {
    toast('Error de conexión', 'error');
  } finally {
    showLoading(false);
  }
}

// ── Modal nota de cierre ──────────────────────────────────────

let _closeId = null;

function openCloseModal(id) {
  _closeId = id;
  document.getElementById('close-note').value = '';
  openOverlay('close-modal');
  setTimeout(() => document.getElementById('close-note').focus(), 100);
}

async function confirmClose() {
  const nota = document.getElementById('close-note').value.trim() || null;
  closeOverlay('close-modal');
  await doClose(_closeId, nota);
  _closeId = null;
}

async function skipClose() {
  closeOverlay('close-modal');
  await doClose(_closeId, null);
  _closeId = null;
}

async function doClose(id, nota) {
  const p = S.pendientes.find(x => x.id === id);
  if (!p) return;
  showLoading(true);
  try {
    const r = await api('updateEstatus', { id, estatus: 'cerrado', notaCierre: nota || '' });
    if (r.success) {
      p.estatus = 'cerrado';
      p.fechaCierre = today();
      p.notaCierre  = nota;
      p.fechaActualizacion = new Date().toISOString();
      renderAll();
      if (S.detId === id) openDetail(id);
      toast('Pendiente cerrado ✓', 'success');
    } else {
      toast('Error al cerrar', 'error');
    }
  } catch (_) {
    toast('Error de conexión', 'error');
  } finally {
    showLoading(false);
  }
}

document.getElementById('close-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('close-modal')) skipClose();
});

// ── Detalle ───────────────────────────────────────────────────

function openDetail(id) {
  const p = S.pendientes.find(x => x.id === id);
  if (!p) return;
  S.detId = id;

  const isGerente = S.user && S.user.rol === 'gerente';
  const isMine    = p.creadoPor === (S.user && S.user.nombre) || p.responsable === (S.user && S.user.nombre);
  const canEdit   = (isGerente || isMine) && p.estatus !== 'cerrado';

  document.getElementById('det-edit').style.display = canEdit ? '' : 'none';

  const od  = overdue(p.fechaLimite, p.estatus);
  const dl  = daysLabel(p.fechaLimite, p.estatus);
  const ec  = EST_COLOR[p.estatus]  || '#8B949E';
  const pc  = PRIO_COLOR[p.prioridad] || '#8B949E';

  let html = `
    <div class="dtitle">${esc(p.descripcion)}</div>
    <div class="dbadges">
      <span class="dbadge" style="background:${pc}22;color:${pc};border:1px solid ${pc}44">${PRIO_LABEL[p.prioridad] || p.prioridad}</span>
      <span class="dbadge" style="background:${ec}22;color:${ec};border:1px solid ${ec}44">${EST_LABEL[p.estatus] || p.estatus}</span>
      ${od ? '<span class="dbadge" style="background:#E6394622;color:#E63946;border:1px solid #E6394644">⚠ Vencido</span>' : ''}
      ${p.origen === 'propuesta' && p.aprobacionEstado === 'pendiente' ? '<span class="dbadge badge-prop">Propuesta</span>' : ''}
      ${p.origen === 'propuesta' && p.aprobacionEstado === 'rechazado' ? '<span class="dbadge badge-rej">Rechazada</span>' : ''}
    </div>
    <div class="dsec"><h3>Información</h3>
      <div class="drow"><span class="drl">Equipo</span><span class="drv">${esc(p.equipo) || '—'}</span></div>
      <div class="drow"><span class="drl">Sección</span><span class="drv">${esc(p.seccion) || '—'}</span></div>
      <div class="drow"><span class="drl">Responsable</span><span class="drv">${esc(p.responsable) || '—'}</span></div>
      <div class="drow"><span class="drl">Creado por</span><span class="drv">${esc(p.creadoPor) || '—'}</span></div>
      <div class="drow"><span class="drl">Fecha límite</span><span class="drv ${od ? 'ov-lbl' : ''}">
        ${p.fechaLimite ? (od ? '⚠ ' : '') + fmtDate(p.fechaLimite) : '—'}
        ${dl ? `<span class="dl ${dl.cls}" style="margin-left:6px">${dl.text}</span>` : ''}
      </span></div>
      <div class="drow"><span class="drl">Creación</span><span class="drv">${fmtDate(p.fechaCreacion)}</span></div>
      ${p.fechaCierre ? `<div class="drow"><span class="drl">Cierre</span><span class="drv" style="color:#3FB950">${fmtDate(p.fechaCierre)}</span></div>` : ''}
      ${p.aprobadoPor ? `<div class="drow"><span class="drl">Aprobado por</span><span class="drv">${esc(p.aprobadoPor)}</span></div>` : ''}
    </div>`;

  if (p.notas) {
    html += `<div class="dsec"><h3>Notas</h3><div class="dnotes">${esc(p.notas)}</div></div>`;
  }
  if (p.notaCierre) {
    html += `<div class="dsec"><h3>Nota de cierre</h3><div class="dnotes cierre">${esc(p.notaCierre)}</div></div>`;
  }

  // Panel aprobación (gerente)
  if (p.origen === 'propuesta' && p.aprobacionEstado === 'pendiente' && isGerente) {
    html += `<div class="aprov-panel">
      <p class="aprov-label">Esta propuesta espera tu aprobación.</p>
      <label>Asignar a</label>
      <select id="ap-responsable">
        ${CONFIG.SUPERVISORES.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <div class="aprov-btns">
        <button class="btn btn-danger btn-sm" onclick="decidirPropuesta('rechazado')">Rechazar</button>
        <button class="btn btn-success btn-sm" onclick="decidirPropuesta('aprobado')">Aprobar y asignar</button>
      </div>
    </div>`;
  }

  // Botones de estatus
  html += '<div class="det-btns">';
  if (canEdit) {
    html += `<button class="btn btn-p" onclick="openEditForm('${p.id}')">✏️ Editar</button>`;
    const opciones = ['pendiente', 'en_proceso', 'esperando', 'cerrado'].filter(e => e !== p.estatus);
    if (opciones.length) {
      html += '<div class="det-row">';
      opciones.forEach(e => {
        const c = EST_COLOR[e];
        html += `<button class="btn btn-sm" style="background:${c}22;color:${c};border:1px solid ${c}44;flex:1" onclick="qSt('${p.id}','${e}')">${EST_LABEL[e]}</button>`;
      });
      html += '</div>';
    }
  }
  if (p.estatus === 'cerrado' && (isGerente || isMine)) {
    html += `<button class="btn btn-s" onclick="qSt('${p.id}','pendiente')">↩ Reabrir</button>`;
  }
  html += '</div>';

  document.getElementById('det-content').innerHTML = html;
  openOverlay('det-ov');
}

// ── Aprobar / rechazar propuesta ──────────────────────────────

async function decidirPropuesta(decision) {
  const p = S.pendientes.find(x => x.id === S.detId);
  if (!p) return;
  let responsable = '';
  if (decision === 'aprobado') {
    const sel = document.getElementById('ap-responsable');
    responsable = sel ? sel.value : '';
    if (!responsable) { toast('Selecciona un responsable', 'error'); return; }
  }
  showLoading(true);
  try {
    const r = await api('aprobarPropuesta', {
      id: p.id, decision, aprobadoPor: S.user.nombre, responsable
    });
    if (r.success) {
      await loadData();
      renderAll();
      const updated = S.pendientes.find(x => x.id === S.detId);
      if (updated) openDetail(S.detId);
      else closeOverlay('det-ov');
      toast(decision === 'aprobado' ? 'Propuesta aprobada ✓' : 'Propuesta rechazada', 'success');
    } else {
      toast('Error', 'error');
    }
  } catch (_) {
    toast('Error de conexión', 'error');
  } finally {
    showLoading(false);
  }
}

// ── Formulario ────────────────────────────────────────────────

function setOpt(f, v) {
  document.querySelectorAll(`[data-f="${f}"]`).forEach(e => e.classList.toggle('on', e.dataset.v === v));
}
function getOpt(f) {
  const e = document.querySelector(`[data-f="${f}"].on`);
  return e ? e.dataset.v : '';
}

document.querySelectorAll('.sopt').forEach(e =>
  e.addEventListener('click', () => setOpt(e.dataset.f, e.dataset.v))
);

function populateDatalist(id, items) {
  document.getElementById(id).innerHTML = items.map(i => `<option value="${esc(i)}">`).join('');
}

function updateSecDatalist() {
  const eq   = document.getElementById('f-equipo').value.trim();
  const secs = [...new Set(S.pendientes.filter(p => p.equipo === eq).map(p => p.seccion).filter(Boolean))].sort();
  populateDatalist('sec-datalist', secs);
}

function openAddForm() {
  S.editId = null;
  document.getElementById('form-title').textContent = 'Nuevo Pendiente';
  document.getElementById('fg-origen').hidden = false;

  const origenSel = document.getElementById('f-origen');
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
    CONFIG.SUPERVISORES.map(s => `<option value="${s}">${s}</option>`).join('');

  ['f-equipo','f-seccion','f-descripcion','f-notas'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('f-fechaLimite').value = '';
  setOpt('prio', 'normal');

  // Poblar datalists
  const equipos = [...new Set(S.pendientes.map(p => p.equipo).filter(Boolean))].sort();
  populateDatalist('eq-datalist', equipos);
  populateDatalist('sec-datalist', []);

  // Si hay filtro de equipo activo, pre-llenar
  if (S.fEq !== 'todos') {
    document.getElementById('f-equipo').value = S.fEq;
    updateSecDatalist();
  }

  openOverlay('form-ov');
  setTimeout(() => document.getElementById('f-descripcion').focus(), 350);
}

function openEditForm(id) {
  const p = S.pendientes.find(x => x.id === id);
  if (!p) return;
  S.editId = id;
  closeOverlay('det-ov');

  document.getElementById('form-title').textContent = 'Editar Pendiente';
  document.getElementById('fg-origen').hidden = true;
  document.getElementById('f-equipo').value      = p.equipo      || '';
  document.getElementById('f-seccion').value     = p.seccion     || '';
  document.getElementById('f-descripcion').value = p.descripcion || '';
  document.getElementById('f-notas').value       = p.notas       || '';
  document.getElementById('f-fechaLimite').value = (p.fechaLimite || '').slice(0, 10);
  setOpt('prio', p.prioridad || 'normal');

  const fgResp = document.getElementById('fg-responsable');
  if (S.user.rol === 'gerente') {
    fgResp.hidden = false;
    document.getElementById('f-responsable').innerHTML =
      CONFIG.SUPERVISORES.map(s =>
        `<option value="${s}"${p.responsable === s ? ' selected' : ''}>${s}</option>`
      ).join('');
  } else {
    fgResp.hidden = true;
  }

  const equipos = [...new Set(S.pendientes.map(p2 => p2.equipo).filter(Boolean))].sort();
  populateDatalist('eq-datalist', equipos);
  updateSecDatalist();

  openOverlay('form-ov');
}

function onOrigenChange() {
  const origen = document.getElementById('f-origen').value;
  document.getElementById('fg-responsable').hidden = origen !== 'asignado';
}

function closeForm() { closeOverlay('form-ov'); }

document.getElementById('form-bg').addEventListener('click', closeForm);
document.getElementById('form-close').addEventListener('click', closeForm);
document.getElementById('form-cancel').addEventListener('click', closeForm);

async function submitForm() {
  const equipo      = document.getElementById('f-equipo').value.trim();
  const descripcion = document.getElementById('f-descripcion').value.trim();
  if (!equipo)      { toast('El equipo es requerido',      'error'); return; }
  if (!descripcion) { toast('La descripción es requerida', 'error'); return; }

  showLoading(true);
  try {
    const payload = {
      equipo,
      seccion:     document.getElementById('f-seccion').value.trim(),
      descripcion,
      prioridad:   getOpt('prio') || 'normal',
      fechaLimite: document.getElementById('f-fechaLimite').value,
      notas:       document.getElementById('f-notas').value.trim(),
      responsable: (document.getElementById('f-responsable').value || '').trim(),
      creadoPor:   S.user.nombre,
    };

    if (S.editId) {
      payload.id = S.editId;
    } else {
      payload.origen = document.getElementById('f-origen').value || 'personal';
    }

    const r = await api('savePendiente', payload);
    if (r.success) {
      const wasEdit = !!S.editId;
      S.editId = null;
      closeForm();
      await loadData();
      renderAll();
      toast(wasEdit ? 'Guardado ✓' : 'Pendiente creado ✓', 'success');
    } else {
      toast(r.error || 'Error al guardar', 'error');
    }
  } catch (err) {
    toast('Error: ' + (err.message || 'desconocido'), 'error');
  } finally {
    showLoading(false);
  }
}

// ── Settings (Mi cuenta) ──────────────────────────────────────

function openSettings() {
  const rol = { gerente: 'Gerente', supervisor: 'Supervisor', planeador: 'Planeador' }[S.user.rol] || S.user.rol;
  let html = `
    <div class="set-user">
      <div class="set-user-name">${esc(S.user.nombre)}</div>
      <div class="set-user-rol">${rol}</div>
    </div>`;

  if (S.user.rol === 'gerente' && S.propuestasPendientes > 0) {
    html += `<div class="prop-banner">
      ⚠️ <strong>${S.propuestasPendientes}</strong> propuesta${S.propuestasPendientes > 1 ? 's' : ''} esperan aprobación
    </div>`;
  }

  html += `<button class="btn btn-p" style="width:100%" onclick="doLogout()">Cerrar sesión</button>`;
  document.getElementById('set-content').innerHTML = html;
  openOverlay('set-ov');
}

// ── Auth ──────────────────────────────────────────────────────

function initLogin() {
  document.getElementById('login-nombre').innerHTML =
    '<option value="">— Selecciona —</option>' +
    CONFIG.USUARIOS.map(u => `<option value="${u}">${u}</option>`).join('');
}

async function doLogin() {
  const nombre   = document.getElementById('login-nombre').value;
  const password = document.getElementById('login-password').value;
  if (!nombre)   { toast('Selecciona tu nombre',  'error'); return; }
  if (!password) { toast('Ingresa la contraseña', 'error'); return; }
  showLoading(true);
  try {
    const r = await api('login', { nombre, password });
    if (r.success) {
      S.user = r.usuario;
      localStorage.setItem('mpm_user', JSON.stringify(S.user));
      await loadData();
      renderAll();
      showView('view-main');
    } else {
      toast(r.error || 'Credenciales incorrectas', 'error');
    }
  } catch (_) {
    toast('Error de conexión. Verifica tu internet.', 'error');
  } finally {
    showLoading(false);
  }
}

function doLogout() {
  localStorage.removeItem('mpm_user');
  S.user = null;
  S.pendientes = [];
  S.propuestasPendientes = 0;
  closeOverlay('set-ov');
  document.getElementById('login-password').value = '';
  showView('view-login');
}

// ── Datos ─────────────────────────────────────────────────────

async function loadData() {
  const r = await api('getPendientes', { nombre: S.user.nombre, rol: S.user.rol });
  if (r.success) {
    S.pendientes           = r.pendientes || [];
    S.propuestasPendientes = r.propuestasPendientes || 0;
  }
}

async function refreshMain() {
  showLoading(true);
  try {
    await loadData();
    renderAll();
    toast('Datos actualizados', 'success');
  } catch (_) {
    toast('Error al actualizar', 'error');
  } finally {
    showLoading(false);
  }
}

// ── Búsqueda ──────────────────────────────────────────────────

function initSearch() {
  const bar = document.getElementById('search-bar');
  const btn = document.getElementById('btn-search');
  const inp = document.getElementById('search-input');

  btn.addEventListener('click', () => {
    const isOpen = bar.classList.toggle('open');
    btn.classList.toggle('active', isOpen);
    if (isOpen) {
      S.search = '';
      setTimeout(() => inp.focus(), 260);
    } else {
      inp.value = '';
      S.search  = '';
      renderAll();
    }
  });

  inp.addEventListener('input', e => {
    S.search = e.target.value;
    renderAll();
  });
}

// ── Wiring ────────────────────────────────────────────────────

document.getElementById('btn-add').addEventListener('click', openAddForm);
document.getElementById('btn-settings').addEventListener('click', openSettings);
document.getElementById('det-back').addEventListener('click', () => { S.detId = null; closeOverlay('det-ov'); });
document.getElementById('det-edit').addEventListener('click', () => { if (S.detId) openEditForm(S.detId); });
document.getElementById('set-back').addEventListener('click', () => closeOverlay('set-ov'));

// ── Init ──────────────────────────────────────────────────────

async function init() {
  initLogin();
  initSearch();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data && e.data.type === 'SW_UPDATED') window.location.reload();
    });
  }

  const saved = localStorage.getItem('mpm_user');
  if (saved) {
    try {
      S.user = JSON.parse(saved);
      showLoading(true);
      await loadData();
      renderAll();
      showView('view-main');
    } catch (_) {
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
