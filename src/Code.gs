/****************************************************************
 * Pollada CCATina 2026 — Sistema de control de ventas y entregas
 * Backend Google Apps Script (proyecto VINCULADO a la hoja)
 * Versión 1.0.0
 *
 * Las funciones que terminan en "_" son privadas: Apps Script no
 * permite llamarlas desde el navegador (google.script.run).
 * El único punto de entrada público del frontend es api().
 ****************************************************************/

const APP = {
  VERSION: '1.0.0',
  TZ: 'America/Lima',
  SHEETS: {
    CONFIG: ['clave', 'valor', 'descripcion'],
    LOTES: ['lote_id', 'nombre_lote', 'area', 'responsable', 'cantidad_asignada', 'estado', 'observaciones', 'rango_inicio', 'rango_fin'],
    USUARIOS: ['usuario_id', 'nombre', 'correo', 'rol', 'area', 'estado', 'pin_hash', 'ultimo_acceso'],
    TICKETS: ['ticket_id', 'numero_ticket', 'lote_id', 'area', 'vendedor_asignado', 'estado_ticket', 'fecha_asignacion', 'observaciones', 'es_demo'],
    VENTAS: ['venta_id', 'operacion_id', 'ticket_id', 'numero_ticket', 'lote_id', 'vendedor', 'comprador', 'telefono_comprador', 'fecha_venta', 'precio_unitario', 'monto_total', 'metodo_pago', 'estado_pago', 'registrado_por', 'observaciones', 'fecha_pago', 'pago_confirmado_por', 'es_demo'],
    ENTREGAS: ['entrega_id', 'ticket_id', 'numero_ticket', 'comprador', 'fecha_hora_entrega', 'entregado_por', 'estado_entrega', 'motivo_correccion', 'observaciones', 'es_demo'],
    AUDITORIA: ['fecha_hora', 'usuario', 'accion', 'modulo', 'id_registro', 'valor_anterior', 'valor_nuevo', 'motivo']
  },
  TEXT_COLS: {
    CONFIG: ['valor'],
    LOTES: ['lote_id', 'rango_inicio', 'rango_fin'],
    TICKETS: ['ticket_id', 'numero_ticket', 'lote_id'],
    VENTAS: ['venta_id', 'operacion_id', 'ticket_id', 'numero_ticket', 'lote_id', 'telefono_comprador'],
    ENTREGAS: ['entrega_id', 'ticket_id', 'numero_ticket']
  },
  DEMO_LOTE: 'LDEMO'
};

const ROLES = ['ADMIN', 'VENTAS', 'ENTREGAS', 'LECTURA'];

const CONFIG_DEFAULTS = [
  ['nombre_actividad', 'Pollada CCATina 2026', 'Nombre visible del evento'],
  ['fecha_actividad', '2026-11-20', 'Fecha de recojo (AAAA-MM-DD)'],
  ['precio_unitario', '18', 'Precio por pollada en soles'],
  ['lugar_recojo', 'Instalaciones del CCAT', 'Lugar donde se entregan las polladas'],
  ['formato_numeracion', '000-000', 'Cada 0 es un dígito. Ej.: 000-000 → 000-001'],
  ['requiere_pago_confirmado', 'SI', 'SI: no se entrega un ticket con pago PENDIENTE'],
  ['metodos_pago', 'EFECTIVO,YAPE,PLIN,TRANSFERENCIA,OTRO', 'Separados por coma'],
  ['restringir_ventas_por_area', 'NO', 'SI: un usuario VENTAS solo vende tickets de lotes de su área'],
  ['permitir_login_pin', 'SI', 'SI: quien no sea reconocido por su cuenta Google entra con correo + PIN'],
  ['version_sistema', APP.VERSION, 'No editar']
];

const ROUTES = {
  'sesion.info':          ['*', sesionInfo_],
  'tickets.consultar':    [['ADMIN', 'VENTAS'], consultarTicketVenta_],
  'tickets.listar':       [['ADMIN', 'VENTAS', 'LECTURA'], listarTickets_],
  'tickets.generar':      [['ADMIN'], generarTickets_],
  'tickets.importar':     [['ADMIN'], importarTickets_],
  'tickets.asignar':      [['ADMIN'], asignarTickets_],
  'tickets.anular':       [['ADMIN'], anularTicket_],
  'tickets.reactivar':    [['ADMIN'], reactivarTicket_],
  'ventas.registrar':     [['ADMIN', 'VENTAS'], registrarVenta_],
  'ventas.listar':        [['ADMIN', 'VENTAS', 'LECTURA'], listarVentas_],
  'ventas.confirmarPago': [['ADMIN', 'VENTAS'], confirmarPago_],
  'ventas.anular':        [['ADMIN'], anularVenta_],
  'ventas.corregir':      [['ADMIN'], corregirVenta_],
  'entregas.consultar':   [['ADMIN', 'ENTREGAS'], consultarEntrega_],
  'entregas.confirmar':   [['ADMIN', 'ENTREGAS'], confirmarEntrega_],
  'entregas.revertir':    [['ADMIN'], revertirEntrega_],
  'entregas.recientes':   [['ADMIN', 'ENTREGAS'], entregasRecientes_],
  'dashboard.get':        [['ADMIN', 'VENTAS', 'LECTURA'], dashboard_],
  'reportes.get':         [['ADMIN', 'VENTAS', 'LECTURA'], reportes_],
  'config.guardar':       [['ADMIN'], guardarConfig_],
  'lotes.guardar':        [['ADMIN'], guardarLote_],
  'usuarios.listar':      [['ADMIN'], listarUsuarios_],
  'usuarios.guardar':     [['ADMIN'], guardarUsuario_],
  'auditoria.listar':     [['ADMIN'], listarAuditoria_],
  'demo.cargar':          [['ADMIN'], cargarDemo_],
  'demo.pruebas':         [['ADMIN'], ejecutarPruebasDemo_],
  'demo.archivar':        [['ADMIN'], archivarDemo_]
};

let CFG_CACHE = null;
let HEAD_CACHE = {};

/* =============================================================
 * WEB APP
 * ============================================================= */
function doGet(e) {
  const t = HtmlService.createTemplateFromFile('Index');
  t.vista = (e && e.parameter && e.parameter.v) ? String(e.parameter.v) : '';
  return t.evaluate()
    .setTitle('Pollada CCATina 2026')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include_(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Único punto de entrada del frontend. */
function api(action, payload, token) {
  try {
    CFG_CACHE = null; HEAD_CACHE = {};
    if (action === 'auth.login') return ok_(login_(payload || {}));
    if (action === 'auth.logout') { if (token) CacheService.getScriptCache().remove('tok_' + token); return ok_({ salida: true }); }
    const c = ctx_(token);
    const r = ROUTES[action];
    if (!r) throw AppError('ACCION', 'Acción no válida.');
    if (r[0] !== '*' && r[0].indexOf(c.rol) < 0) throw AppError('PERMISO', 'No tienes permiso para esta acción.');
    return ok_(r[1](c, payload || {}));
  } catch (e) {
    if (!e.isApp) console.error(action, e && e.stack);
    return { ok: false, code: e.code || 'ERROR', message: e.isApp ? e.message : 'Error inesperado: ' + (e && e.message) };
  }
}

function ok_(data) { return { ok: true, data: JSON.parse(JSON.stringify(data === undefined ? null : data)) }; }

function AppError(code, msg) {
  const e = new Error(msg || code);
  e.code = msg ? code : 'ERROR';
  e.isApp = true;
  return e;
}

/* =============================================================
 * AUTENTICACIÓN
 * Modo 1 (GOOGLE): Session.getActiveUser() devuelve el correo y
 *   está registrado en USUARIOS (funciona siempre para el dueño y,
 *   en Google Workspace, para usuarios del mismo dominio).
 * Modo 2 (PIN): correo + PIN (hash SHA-256 con sal) → token
 *   temporal en CacheService (6 h). Necesario para cuentas @gmail
 *   cuando la app se ejecuta como el propietario.
 * ============================================================= */
function ctx_(token) {
  const users = read_('USUARIOS');
  let email = '';
  try { email = norm_(Session.getActiveUser().getEmail()); } catch (e) { email = ''; }
  let u = email ? users.find(x => norm_(x.correo) === email) : null;
  let via = 'GOOGLE';
  if (!u && token) {
    const e = CacheService.getScriptCache().get('tok_' + token);
    if (e) { u = users.find(x => norm_(x.correo) === e); via = 'PIN'; }
  }
  if (!u) {
    throw AppError('NO_AUTH', email
      ? 'La cuenta ' + email + ' no está autorizada. Ingresa con tu correo y PIN o pide acceso al administrador.'
      : 'Inicia sesión con tu correo y PIN.');
  }
  if (up_(u.estado) !== 'ACTIVO') throw AppError('NO_AUTH', 'Tu usuario está inactivo. Contacta al administrador.');
  const rol = up_(u.rol);
  if (ROLES.indexOf(rol) < 0) throw AppError('NO_AUTH', 'Tu usuario no tiene un rol válido.');
  return { email: norm_(u.correo), nombre: String(u.nombre || u.correo), rol: rol, area: String(u.area || ''), usuario_id: u.usuario_id, via: via };
}

function login_(p) {
  const correo = norm_(p.correo), pin = String(p.pin || '').trim();
  if (cfg_().permitir_login_pin !== 'SI') throw AppError('LOGIN', 'El ingreso con PIN está desactivado.');
  if (!correo || !pin) throw AppError('LOGIN', 'Ingresa correo y PIN.');
  const cache = CacheService.getScriptCache();
  const k = 'fail_' + correo;
  const fails = Number(cache.get(k) || 0);
  if (fails >= 5) throw AppError('LOGIN', 'Demasiados intentos fallidos. Espera 10 minutos.');
  const u = read_('USUARIOS').find(x => norm_(x.correo) === correo && up_(x.estado) === 'ACTIVO');
  if (!u || !u.pin_hash || String(u.pin_hash) !== hashPin_(correo, pin)) {
    cache.put(k, String(fails + 1), 600);
    throw AppError('LOGIN', 'Correo o PIN incorrectos.');
  }
  cache.remove(k);
  const token = Utilities.getUuid();
  cache.put('tok_' + token, correo, 21600);
  withLock_(() => updateRow_('USUARIOS', u._row, { ultimo_acceso: new Date() }));
  return { token: token };
}

function hashPin_(correo, pin) {
  const salt = PropertiesService.getScriptProperties().getProperty('PIN_SALT');
  if (!salt) throw AppError('CONFIG', 'Falta inicializar el sistema (PIN_SALT).');
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + correo + '|' + pin, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}

/* =============================================================
 * INICIALIZACIÓN Y MENÚ DE LA HOJA
 * ============================================================= */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🐔 Pollada CCAT')
    .addItem('1. Inicializar / reparar hojas', 'inicializarSistema')
    .addItem('2. Asignar PIN a un usuario', 'menuAsignarPin')
    .addSeparator()
    .addItem('Cargar tickets DEMO', 'menuCargarDemo')
    .addItem('Ejecutar pruebas DEMO', 'menuPruebasDemo')
    .addItem('Archivar datos DEMO', 'menuArchivarDemo')
    .addToUi();
}

/** Crea pestañas y encabezados faltantes. Nunca borra datos existentes. */
function inicializarSistema() {
  const ss = SpreadsheetApp.getActive();
  const me = norm_(Session.getEffectiveUser().getEmail());
  const resumen = [];
  withLock_(() => {
    Object.keys(APP.SHEETS).forEach(name => {
      const h = APP.SHEETS[name];
      let s = ss.getSheetByName(name);
      if (!s) {
        s = ss.insertSheet(name);
        s.getRange(1, 1, 1, h.length).setValues([h]);
        resumen.push('Creada ' + name);
      } else {
        const cur = s.getLastColumn() ? s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0].map(String) : [];
        if (!cur.some(x => x !== '')) {
          s.getRange(1, 1, 1, h.length).setValues([h]);
          resumen.push('Encabezados en ' + name);
        } else {
          const missing = h.filter(x => cur.indexOf(x) < 0);
          if (missing.length) {
            s.getRange(1, cur.length + 1, 1, missing.length).setValues([missing]);
            resumen.push(name + ': columnas añadidas ' + missing.join(', '));
          }
        }
      }
      s.setFrozenRows(1);
      s.getRange(1, 1, 1, s.getLastColumn()).setFontWeight('bold').setBackground('#0B1F4B').setFontColor('#FFFFFF');
      (APP.TEXT_COLS[name] || []).forEach(col => {
        const c = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0].indexOf(col);
        if (c >= 0 && s.getMaxRows() > 1) s.getRange(2, c + 1, s.getMaxRows() - 1, 1).setNumberFormat('@');
      });
    });
    HEAD_CACHE = {};

    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty('PIN_SALT')) props.setProperty('PIN_SALT', Utilities.getUuid() + Utilities.getUuid());

    const conf = read_('CONFIG');
    const nuevos = CONFIG_DEFAULTS.filter(d => !conf.some(r => String(r.clave) === d[0]))
      .map(d => ({ clave: d[0], valor: d[1], descripcion: d[2] }));
    if (nuevos.length) { append_('CONFIG', nuevos); resumen.push('CONFIG: ' + nuevos.length + ' parámetros'); }

    if (!read_('LOTES').length) {
      append_('LOTES', [
        { lote_id: 'L1', nombre_lote: 'Lote 1', area: 'Logística', responsable: '', cantidad_asignada: 0, estado: 'ACTIVO', observaciones: '' },
        { lote_id: 'L2', nombre_lote: 'Lote 2', area: 'Marketing', responsable: '', cantidad_asignada: 0, estado: 'ACTIVO', observaciones: '' },
        { lote_id: 'L3', nombre_lote: 'Lote 3', area: 'Por asignar', responsable: '', cantidad_asignada: 0, estado: 'PENDIENTE', observaciones: 'Pendiente de asignación' }
      ]);
      resumen.push('LOTES iniciales L1, L2, L3');
    }

    if (!read_('USUARIOS').length && me) {
      append_('USUARIOS', [{ usuario_id: 'U001', nombre: 'Administrador', correo: me, rol: 'ADMIN', area: 'Logística y Finanzas', estado: 'ACTIVO', pin_hash: '', ultimo_acceso: '' }]);
      resumen.push('Administrador inicial: ' + me);
    }

    ['VENTAS', 'ENTREGAS', 'AUDITORIA', 'USUARIOS', 'CONFIG'].forEach(name => {
      const s = ss.getSheetByName(name);
      if (s && s.getProtections(SpreadsheetApp.ProtectionType.SHEET).length === 0) {
        s.protect().setDescription('Gestionado por la app Pollada CCAT. Edita desde la aplicación.').setWarningOnly(true);
      }
    });
    audit_(me || 'sistema', 'INICIALIZAR', 'SISTEMA', '', '', resumen.join(' | '), '');
  });
  const msg = 'Sistema listo.\n' + (resumen.length ? resumen.join('\n') : 'No hubo cambios (todo existía).');
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* ejecución sin interfaz */ }
  return msg;
}

function menuCtx_() {
  const email = norm_(Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail());
  const u = read_('USUARIOS').find(x => norm_(x.correo) === email && up_(x.estado) === 'ACTIVO' && up_(x.rol) === 'ADMIN');
  if (!u) throw new Error('Solo un ADMIN registrado en USUARIOS puede usar este menú.');
  return { email: email, nombre: String(u.nombre), rol: 'ADMIN', area: String(u.area || ''), usuario_id: u.usuario_id, via: 'GOOGLE' };
}

function menuAsignarPin() {
  const ui = SpreadsheetApp.getUi();
  const c = menuCtx_();
  const r1 = ui.prompt('Asignar PIN', 'Correo del usuario (debe existir en USUARIOS):', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  const r2 = ui.prompt('Asignar PIN', 'Nuevo PIN (6 a 10 dígitos). Entrégalo en privado:', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  const u = read_('USUARIOS').find(x => norm_(x.correo) === norm_(r1.getResponseText()));
  if (!u) { ui.alert('No existe ese correo en USUARIOS.'); return; }
  const res = api_interno_(c, guardarUsuario_, { usuario_id: u.usuario_id, nombre: u.nombre, correo: u.correo, rol: u.rol, area: u.area, estado: u.estado, pin: r2.getResponseText() });
  ui.alert(res.ok ? 'PIN asignado a ' + u.correo : res.message);
}

function menuCargarDemo() { const r = api_interno_(menuCtx_(), cargarDemo_, {}); SpreadsheetApp.getUi().alert(r.ok ? r.data.mensaje : r.message); }
function menuArchivarDemo() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('Archivar DEMO', 'Se moverán SOLO las filas DEMO a pestañas ARCHIVO_DEMO_*. Los datos reales no se tocan. ¿Continuar?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const r = api_interno_(menuCtx_(), archivarDemo_, {}); ui.alert(r.ok ? r.data.mensaje : r.message);
}
function menuPruebasDemo() {
  const r = api_interno_(menuCtx_(), ejecutarPruebasDemo_, {});
  SpreadsheetApp.getUi().alert(r.ok ? r.data.resultados.map(x => (x.ok ? '✅ ' : '❌ ') + x.caso + ' → ' + x.detalle).join('\n') : r.message);
}

function api_interno_(c, fn, p) {
  try { CFG_CACHE = null; HEAD_CACHE = {}; return ok_(fn(c, p)); }
  catch (e) { return { ok: false, code: e.code || 'ERROR', message: e.message }; }
}

/* =============================================================
 * SESIÓN / CATÁLOGOS
 * ============================================================= */
function sesionInfo_(c) {
  const cfg = cfg_();
  const lotes = read_('LOTES');
  const users = read_('USUARIOS');
  const tickets = read_('TICKETS');
  const vendedores = uniq_(
    users.filter(u => ['ADMIN', 'VENTAS'].indexOf(up_(u.rol)) >= 0 && up_(u.estado) === 'ACTIVO').map(u => String(u.nombre))
      .concat(tickets.map(t => String(t.vendedor_asignado || '')))
      .concat(lotes.map(l => String(l.responsable || '')))
  ).filter(Boolean).sort();
  const out = {
    usuario: { nombre: c.nombre, email: c.email, rol: c.rol, area: c.area, via: c.via },
    config: {
      nombre_actividad: cfg.nombre_actividad, fecha_actividad: cfg.fecha_actividad, precio_unitario: cfg.precio_unitario,
      lugar_recojo: cfg.lugar_recojo, formato_numeracion: cfg.formato_numeracion, requiere_pago_confirmado: cfg.requiere_pago_confirmado,
      metodos_pago: cfg.metodos, restringir_ventas_por_area: cfg.restringir_ventas_por_area, version: APP.VERSION
    },
    lotes: lotes.map(l => ({
      lote_id: String(l.lote_id), nombre_lote: l.nombre_lote, area: l.area, responsable: l.responsable,
      cantidad_asignada: Number(l.cantidad_asignada) || 0, estado: up_(l.estado), observaciones: l.observaciones,
      rango_inicio: String(l.rango_inicio || ''), rango_fin: String(l.rango_fin || '')
    })),
    vendedores: vendedores,
    areas: uniq_(lotes.map(l => String(l.area || '')).filter(Boolean))
  };
  if (c.rol === 'ADMIN') out.configRaw = read_('CONFIG').map(r => ({ clave: r.clave, valor: fmtAny_(r.valor), descripcion: r.descripcion }));
  return out;
}

/* =============================================================
 * TICKETS
 * ============================================================= */
function consultarTicketVenta_(c, p) {
  const n = normNum_(p.numero);
  if (!n) throw AppError('VALIDACION', 'Número de ticket inválido.');
  const d = loadAll_();
  const t = d.t.find(x => String(x.numero_ticket) === n);
  if (!t) return { numero: n, disponible: false, motivo: 'Ticket no encontrado' };
  const ix = index_(d);
  const lote = ix.lotes[String(t.lote_id)];
  let motivo = '';
  if (!lote || up_(lote.estado) !== 'ACTIVO') motivo = 'No está asignado a un lote activo';
  else if (up_(t.estado_ticket) === 'ANULADO') motivo = 'Ticket anulado';
  else if (up_(t.estado_ticket) !== 'DISPONIBLE' || ix.ventaAct[t.ticket_id]) motivo = 'Ya fue vendido';
  else if (cfg_().restringir_ventas_por_area === 'SI' && c.rol !== 'ADMIN' && norm_(lote.area) !== norm_(c.area)) motivo = 'Pertenece a otra área (' + lote.area + ')';
  return {
    numero: n, disponible: !motivo, motivo: motivo, lote_id: String(t.lote_id), nombre_lote: lote ? lote.nombre_lote : '',
    area: lote ? lote.area : t.area, vendedor_asignado: t.vendedor_asignado, es_demo: isTrue_(t.es_demo)
  };
}

function listarTickets_(c, p) {
  const d = loadAll_();
  let rows = filtrar_(view_(d, c), p);
  const total = rows.length;
  rows = rows.slice(0, 1500);
  return { total: total, rows: rows };
}

function generarTickets_(c, p) {
  const desde = parseInt(p.desde, 10), hasta = parseInt(p.hasta, 10);
  if (!(desde >= 0) || !(hasta >= desde)) throw AppError('VALIDACION', 'Rango inválido.');
  if (hasta - desde + 1 > 3000) throw AppError('VALIDACION', 'Máximo 3000 tickets por operación.');
  const lote = String(p.lote_id || '');
  const nums = [];
  for (let i = desde; i <= hasta; i++) {
    const n = lote === APP.DEMO_LOTE ? normNum_('DEMO-' + i) : normNum_(String(i));
    if (!n) throw AppError('VALIDACION', 'El número ' + i + ' no cabe en el formato ' + cfg_().formato_numeracion + '.');
    nums.push(n);
  }
  return crearTickets_(c, lote, nums, p.vendedor_asignado, 'GENERAR');
}

function importarTickets_(c, p) {
  const partes = String(p.lista || '').split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
  if (!partes.length) throw AppError('VALIDACION', 'La lista está vacía.');
  if (partes.length > 3000) throw AppError('VALIDACION', 'Máximo 3000 tickets por operación.');
  const invalidos = partes.filter(x => !normNum_(x));
  if (invalidos.length) throw AppError('VALIDACION', 'Números inválidos: ' + invalidos.slice(0, 20).join(', '));
  return crearTickets_(c, String(p.lote_id || ''), partes.map(normNum_), p.vendedor_asignado, 'IMPORTAR');
}

function crearTickets_(c, loteId, nums, vendedor, origen) {
  vendedor = String(vendedor || '').trim();
  return withLock_(() => {
    const d = loadAll_();
    const lote = d.l.find(l => String(l.lote_id) === loteId);
    if (!lote) throw AppError('VALIDACION', 'El lote ' + loteId + ' no existe.');
    if (up_(lote.estado) === 'ARCHIVADO') throw AppError('VALIDACION', 'El lote está archivado.');
    const esDemo = loteId === APP.DEMO_LOTE;
    if (nums.some(n => /^DEMO-/.test(n) !== esDemo)) throw AppError('VALIDACION', esDemo ? 'Los tickets DEMO deben tener el formato DEMO-001.' : 'No uses números DEMO en lotes reales.');
    const existentes = {};
    d.t.forEach(t => { existentes[String(t.numero_ticket)] = String(t.lote_id); });
    const vistos = {}, dupLista = [], dupHoja = [], nuevos = [];
    const now = new Date();
    nums.forEach(n => {
      if (vistos[n]) { dupLista.push(n); return; }
      vistos[n] = true;
      if (existentes[n] !== undefined) { dupHoja.push(n + ' (' + existentes[n] + ')'); return; }
      nuevos.push({ ticket_id: 'TK-' + n, numero_ticket: n, lote_id: loteId, area: lote.area, vendedor_asignado: vendedor, estado_ticket: 'DISPONIBLE', fecha_asignacion: now, observaciones: '', es_demo: esDemo });
    });
    append_('TICKETS', nuevos);
    actualizarLote_(loteId);
    if (nuevos.length) audit_(c.email, origen + '_TICKETS', 'TICKETS', loteId, '', nuevos.length + ' tickets: ' + nuevos[0].numero_ticket + ' … ' + nuevos[nuevos.length - 1].numero_ticket + (vendedor ? ' | vendedor: ' + vendedor : ''), '');
    return { creados: nuevos.length, duplicados_en_lista: dupLista, ya_existian: dupHoja };
  });
}

function actualizarLote_(loteId) {
  const tks = read_('TICKETS').filter(t => String(t.lote_id) === loteId).map(t => String(t.numero_ticket)).sort();
  const lote = read_('LOTES').find(l => String(l.lote_id) === loteId);
  if (lote) updateRow_('LOTES', lote._row, { cantidad_asignada: tks.length, rango_inicio: tks[0] || '', rango_fin: tks[tks.length - 1] || '' });
}

/** Reasigna vendedor y/o lote de tickets DISPONIBLES. */
function asignarTickets_(c, p) {
  const nums = listaNums_(p);
  const vendedor = p.vendedor_asignado === undefined ? null : String(p.vendedor_asignado || '').trim();
  const nuevoLote = p.lote_id ? String(p.lote_id) : null;
  if (vendedor === null && !nuevoLote) throw AppError('VALIDACION', 'Indica un vendedor o un lote.');
  return withLock_(() => {
    const d = loadAll_();
    const ix = index_(d);
    if (nuevoLote && !ix.lotes[nuevoLote]) throw AppError('VALIDACION', 'El lote no existe.');
    const errores = [], patches = [], lotesTocados = {};
    nums.forEach(n => {
      const t = d.t.find(x => String(x.numero_ticket) === n);
      if (!t) { errores.push(n + ': no existe'); return; }
      if (up_(t.estado_ticket) !== 'DISPONIBLE' || ix.ventaAct[t.ticket_id]) { errores.push(n + ': no está DISPONIBLE'); return; }
      if (nuevoLote && isTrue_(t.es_demo) !== (nuevoLote === APP.DEMO_LOTE)) { errores.push(n + ': no se mezclan DEMO y reales'); return; }
      const patch = {};
      if (vendedor !== null) patch.vendedor_asignado = vendedor;
      if (nuevoLote) { patch.lote_id = nuevoLote; patch.area = ix.lotes[nuevoLote].area; lotesTocados[String(t.lote_id)] = 1; lotesTocados[nuevoLote] = 1; }
      patches.push({ row: t._row, patch: patch });
    });
    if (errores.length) throw AppError('VALIDACION', 'No se hizo ningún cambio:\n' + errores.slice(0, 30).join('\n'));
    updateMany_('TICKETS', patches);
    Object.keys(lotesTocados).forEach(actualizarLote_);
    audit_(c.email, 'ASIGNAR_TICKETS', 'TICKETS', nums[0] + (nums.length > 1 ? ' … ' + nums[nums.length - 1] : ''), '', JSON.stringify({ n: nums.length, vendedor: vendedor, lote: nuevoLote }), p.motivo || '');
    return { actualizados: patches.length };
  });
}

function anularTicket_(c, p) {
  const n = normNum_(p.numero), motivo = String(p.motivo || '').trim();
  if (motivo.length < 5) throw AppError('VALIDACION', 'El motivo es obligatorio (mínimo 5 caracteres).');
  return withLock_(() => {
    const d = loadAll_(); const ix = index_(d);
    const t = d.t.find(x => String(x.numero_ticket) === n);
    if (!t) throw AppError('NO_ENCONTRADO', 'Ticket no encontrado');
    if (ix.ventaAct[t.ticket_id]) throw AppError('VALIDACION', 'El ticket tiene una venta activa. Anula primero la venta.');
    if (up_(t.estado_ticket) === 'ANULADO') throw AppError('VALIDACION', 'El ticket ya está anulado.');
    updateRow_('TICKETS', t._row, { estado_ticket: 'ANULADO', observaciones: ((t.observaciones ? t.observaciones + ' | ' : '') + 'Anulado: ' + motivo) });
    audit_(c.email, 'ANULAR_TICKET', 'TICKETS', t.ticket_id, t.estado_ticket, 'ANULADO', motivo);
    return { numero: n, estado: 'ANULADO' };
  });
}

function reactivarTicket_(c, p) {
  const n = normNum_(p.numero), motivo = String(p.motivo || '').trim();
  if (motivo.length < 5) throw AppError('VALIDACION', 'El motivo es obligatorio (mínimo 5 caracteres).');
  return withLock_(() => {
    const d = loadAll_(); const ix = index_(d);
    const t = d.t.find(x => String(x.numero_ticket) === n);
    if (!t) throw AppError('NO_ENCONTRADO', 'Ticket no encontrado');
    if (up_(t.estado_ticket) !== 'ANULADO') throw AppError('VALIDACION', 'Solo se reactivan tickets ANULADOS.');
    if (ix.ventaAct[t.ticket_id]) throw AppError('VALIDACION', 'Inconsistencia: el ticket tiene venta activa.');
    updateRow_('TICKETS', t._row, { estado_ticket: 'DISPONIBLE' });
    audit_(c.email, 'REACTIVAR_TICKET', 'TICKETS', t.ticket_id, 'ANULADO', 'DISPONIBLE', motivo);
    return { numero: n, estado: 'DISPONIBLE' };
  });
}

/* =============================================================
 * VENTAS
 * ============================================================= */
function registrarVenta_(c, p) {
  const cfg = cfg_();
  const nums = uniq_((p.tickets || []).map(normNum_));
  if ((p.tickets || []).some(x => !normNum_(x))) throw AppError('VALIDACION', 'Hay números de ticket inválidos.');
  if (!nums.length) throw AppError('VALIDACION', 'Agrega al menos un ticket.');
  if (nums.length > 50) throw AppError('VALIDACION', 'Máximo 50 tickets por operación.');
  const comprador = String(p.comprador || '').trim().replace(/\s+/g, ' ');
  if (comprador.length < 3) throw AppError('VALIDACION', 'El nombre del comprador es obligatorio.');
  const tel = String(p.telefono || '').trim();
  if (tel && !/^[+\d][\d\s-]{5,19}$/.test(tel)) throw AppError('VALIDACION', 'Teléfono inválido.');
  const metodo = up_(p.metodo_pago);
  if (cfg.metodos.indexOf(metodo) < 0) throw AppError('VALIDACION', 'Método de pago no válido.');
  const estadoPago = up_(p.estado_pago);
  if (['PAGADO', 'PENDIENTE'].indexOf(estadoPago) < 0) throw AppError('VALIDACION', 'Estado de pago debe ser PAGADO o PENDIENTE.');
  let precio = cfg.precio_unitario;
  if (p.precio_unitario !== undefined && p.precio_unitario !== '' && Number(p.precio_unitario) !== precio) {
    if (c.rol !== 'ADMIN') throw AppError('PERMISO', 'Solo un administrador puede cambiar el precio.');
    precio = Number(p.precio_unitario);
  }
  if (!(precio >= 0)) throw AppError('VALIDACION', 'Precio inválido.');
  const vendedorIn = String(p.vendedor || '').trim();
  const obs = String(p.observaciones || '').trim();

  return withLock_(() => {
    const d = loadAll_(); const ix = index_(d);
    const errores = [];
    const tks = nums.map(n => {
      const t = d.t.find(x => String(x.numero_ticket) === n);
      if (!t) { errores.push(n + ': Ticket no encontrado'); return null; }
      const lote = ix.lotes[String(t.lote_id)];
      if (!lote || up_(lote.estado) !== 'ACTIVO') errores.push(n + ': no está asignado a un lote activo');
      else if (up_(t.estado_ticket) === 'ANULADO') errores.push(n + ': ticket anulado');
      else if (up_(t.estado_ticket) !== 'DISPONIBLE' || ix.ventaAct[t.ticket_id]) errores.push(n + ': ya fue vendido');
      else if (cfg.restringir_ventas_por_area === 'SI' && c.rol !== 'ADMIN' && norm_(lote.area) !== norm_(c.area)) errores.push(n + ': pertenece a otra área');
      return t;
    });
    if (errores.length) throw AppError('DUPLICADO', 'No se registró la venta:\n' + errores.join('\n'));
    const demo = isTrue_(tks[0].es_demo);
    if (tks.some(t => isTrue_(t.es_demo) !== demo)) throw AppError('VALIDACION', 'No mezcles tickets DEMO con tickets reales.');
    const op = nextId_('OP', d.v.map(v => v.operacion_id));
    const vIds = nextIds_('V', d.v.map(v => v.venta_id), tks.length);
    const now = new Date();
    const total = round2_(precio * tks.length);
    const rows = tks.map((t, i) => ({
      venta_id: vIds[i], operacion_id: op, ticket_id: t.ticket_id, numero_ticket: t.numero_ticket, lote_id: t.lote_id,
      vendedor: vendedorIn || t.vendedor_asignado || c.nombre, comprador: comprador, telefono_comprador: tel, fecha_venta: now,
      precio_unitario: precio, monto_total: total, metodo_pago: metodo, estado_pago: estadoPago, registrado_por: c.email,
      observaciones: obs, fecha_pago: estadoPago === 'PAGADO' ? now : '', pago_confirmado_por: estadoPago === 'PAGADO' ? c.email : '', es_demo: demo
    }));
    append_('VENTAS', rows);
    updateMany_('TICKETS', tks.map(t => ({ row: t._row, patch: { estado_ticket: 'VENDIDO' } })));
    audit_(c.email, 'REGISTRAR_VENTA', 'VENTAS', op, '', JSON.stringify({ tickets: nums, comprador: comprador, total: total, estado_pago: estadoPago, metodo: metodo }), '');
    return { operacion_id: op, tickets: nums, total: total, estado_pago: estadoPago, fecha: fmt_(now) };
  });
}

function listarVentas_(c, p) {
  const v = read_('VENTAS');
  const q = norm_(p.q);
  const demo = p.demo || 'excluir';
  let rows = v.filter(x => {
    if (c.rol === 'VENTAS' && norm_(x.registrado_por) !== c.email && norm_(x.vendedor) !== norm_(c.nombre)) return false;
    const isD = isTrue_(x.es_demo);
    if (demo === 'excluir' && isD) return false;
    if (demo === 'solo' && !isD) return false;
    if (p.estado_pago && up_(x.estado_pago) !== up_(p.estado_pago)) return false;
    if (q && [x.numero_ticket, x.comprador, x.operacion_id, x.vendedor].map(norm_).join(' ').indexOf(q) < 0) return false;
    return true;
  }).reverse();
  const total = rows.length;
  rows = rows.slice(0, 500).map(x => ({
    venta_id: x.venta_id, operacion_id: x.operacion_id, numero_ticket: String(x.numero_ticket), lote_id: String(x.lote_id),
    vendedor: x.vendedor, comprador: x.comprador,
    telefono_comprador: (c.rol === 'ADMIN' || norm_(x.registrado_por) === c.email) ? String(x.telefono_comprador || '') : '',
    fecha_venta: fmt_(x.fecha_venta), precio_unitario: Number(x.precio_unitario) || 0, monto_total: Number(x.monto_total) || 0,
    metodo_pago: x.metodo_pago, estado_pago: up_(x.estado_pago), registrado_por: x.registrado_por, observaciones: x.observaciones,
    fecha_pago: fmt_(x.fecha_pago), es_demo: isTrue_(x.es_demo),
    puede_confirmar: up_(x.estado_pago) === 'PENDIENTE' && (c.rol === 'ADMIN' || norm_(x.registrado_por) === c.email)
  }));
  return { total: total, rows: rows };
}

/** Confirma pago de una venta (venta_id) o de toda la operación (operacion_id). */
function confirmarPago_(c, p) {
  return withLock_(() => {
    const v = read_('VENTAS');
    const objetivo = v.filter(x => (p.venta_id && x.venta_id === p.venta_id) || (p.operacion_id && x.operacion_id === p.operacion_id));
    if (!objetivo.length) throw AppError('NO_ENCONTRADO', 'Venta no encontrada.');
    const pend = objetivo.filter(x => up_(x.estado_pago) === 'PENDIENTE');
    if (!pend.length) throw AppError('VALIDACION', 'No hay pagos pendientes en esa venta.');
    if (c.rol !== 'ADMIN' && pend.some(x => norm_(x.registrado_por) !== c.email)) throw AppError('PERMISO', 'Solo puedes confirmar pagos de ventas que registraste. Pide validación al administrador.');
    const metodo = p.metodo_pago ? up_(p.metodo_pago) : null;
    if (metodo && cfg_().metodos.indexOf(metodo) < 0) throw AppError('VALIDACION', 'Método de pago no válido.');
    const now = new Date();
    updateMany_('VENTAS', pend.map(x => ({ row: x._row, patch: Object.assign({ estado_pago: 'PAGADO', fecha_pago: now, pago_confirmado_por: c.email }, metodo ? { metodo_pago: metodo } : {}) })));
    pend.forEach(x => audit_(c.email, 'CONFIRMAR_PAGO', 'VENTAS', x.venta_id, 'PENDIENTE', 'PAGADO' + (metodo ? ' (' + metodo + ')' : ''), p.motivo || ''));
    return { confirmadas: pend.length, tickets: pend.map(x => String(x.numero_ticket)) };
  });
}

function anularVenta_(c, p) {
  const motivo = String(p.motivo || '').trim();
  if (motivo.length < 5) throw AppError('VALIDACION', 'El motivo es obligatorio (mínimo 5 caracteres).');
  return withLock_(() => {
    const d = loadAll_(); const ix = index_(d);
    const objetivo = d.v.filter(x => up_(x.estado_pago) !== 'ANULADO' && ((p.venta_id && x.venta_id === p.venta_id) || (p.operacion_id && x.operacion_id === p.operacion_id)));
    if (!objetivo.length) throw AppError('NO_ENCONTRADO', 'Venta activa no encontrada.');
    const entregados = objetivo.filter(x => ix.entregaAct[x.ticket_id]);
    if (entregados.length) throw AppError('VALIDACION', 'Hay tickets ya entregados (' + entregados.map(x => x.numero_ticket).join(', ') + '). Revierte primero la entrega.');
    const nuevoEstadoTicket = p.anular_ticket ? 'ANULADO' : 'DISPONIBLE';
    updateMany_('VENTAS', objetivo.map(x => ({ row: x._row, patch: { estado_pago: 'ANULADO', observaciones: ((x.observaciones ? x.observaciones + ' | ' : '') + 'Anulada: ' + motivo) } })));
    const tPatches = objetivo.map(x => d.t.find(t => t.ticket_id === x.ticket_id)).filter(Boolean).map(t => ({ row: t._row, patch: { estado_ticket: nuevoEstadoTicket } }));
    updateMany_('TICKETS', tPatches);
    objetivo.forEach(x => audit_(c.email, 'ANULAR_VENTA', 'VENTAS', x.venta_id, up_(x.estado_pago), 'ANULADO; ticket ' + x.numero_ticket + ' → ' + nuevoEstadoTicket, motivo));
    return { anuladas: objetivo.length, estado_ticket: nuevoEstadoTicket };
  });
}

function corregirVenta_(c, p) {
  const motivo = String(p.motivo || '').trim();
  if (motivo.length < 5) throw AppError('VALIDACION', 'El motivo es obligatorio (mínimo 5 caracteres).');
  const permitidos = ['comprador', 'telefono_comprador', 'vendedor', 'metodo_pago', 'observaciones', 'precio_unitario'];
  const cambios = p.cambios || {};
  return withLock_(() => {
    const v = read_('VENTAS');
    const x = v.find(r => r.venta_id === p.venta_id);
    if (!x) throw AppError('NO_ENCONTRADO', 'Venta no encontrada.');
    if (up_(x.estado_pago) === 'ANULADO') throw AppError('VALIDACION', 'No se corrige una venta anulada.');
    const patch = {};
    Object.keys(cambios).forEach(k => {
      if (permitidos.indexOf(k) < 0) return;
      let val = String(cambios[k] === null || cambios[k] === undefined ? '' : cambios[k]).trim();
      if (k === 'metodo_pago') { val = up_(val); if (cfg_().metodos.indexOf(val) < 0) throw AppError('VALIDACION', 'Método de pago no válido.'); }
      if (k === 'precio_unitario') { val = Number(val); if (!(val >= 0)) throw AppError('VALIDACION', 'Precio inválido.'); }
      if (k === 'comprador' && val.length < 3) throw AppError('VALIDACION', 'Comprador inválido.');
      if (k === 'telefono_comprador' && val && !/^[+\d][\d\s-]{5,19}$/.test(val)) throw AppError('VALIDACION', 'Teléfono inválido.');
      if (String(fmtAny_(x[k])) !== String(val)) patch[k] = val;
    });
    if (!Object.keys(patch).length) throw AppError('VALIDACION', 'No hay cambios.');
    updateRow_('VENTAS', x._row, patch);
    Object.keys(patch).forEach(k => audit_(c.email, 'CORREGIR_VENTA', 'VENTAS', x.venta_id, k + ': ' + fmtAny_(x[k]), k + ': ' + patch[k], motivo));
    if (patch.precio_unitario !== undefined) {
      const ops = read_('VENTAS').filter(r => r.operacion_id === x.operacion_id);
      const total = round2_(ops.filter(r => up_(r.estado_pago) !== 'ANULADO').reduce((s, r) => s + (Number(r.precio_unitario) || 0), 0));
      updateMany_('VENTAS', ops.map(r => ({ row: r._row, patch: { monto_total: total } })));
    }
    return { venta_id: x.venta_id, cambios: patch };
  });
}

/* =============================================================
 * ENTREGAS / RECOJO
 * ============================================================= */
function evaluarEntrega_(d, ix, numero) {
  const cfg = cfg_();
  const t = d.t.find(x => String(x.numero_ticket) === numero);
  if (!t) return { ok: false, codigo: 'NO_ENCONTRADO', mensaje: 'Ticket no encontrado', ticket: null };
  const v = ix.ventaAct[t.ticket_id];
  const e = ix.entregaAct[t.ticket_id];
  const info = {
    ticket_id: t.ticket_id, numero: String(t.numero_ticket), lote_id: String(t.lote_id), estado_ticket: up_(t.estado_ticket),
    comprador: v ? v.comprador : '', vendedor: v ? v.vendedor : '', estado_pago: v ? up_(v.estado_pago) : 'SIN VENTA',
    venta_id: v ? v.venta_id : '', operacion_id: v ? v.operacion_id : '', metodo_pago: v ? v.metodo_pago : '',
    estado_entrega: e ? 'ENTREGADO' : 'PENDIENTE', entrega_id: e ? e.entrega_id : '',
    fecha_entrega: e ? fmt_(e.fecha_hora_entrega) : '', entregado_por: e ? e.entregado_por : '', es_demo: isTrue_(t.es_demo)
  };
  if (up_(t.estado_ticket) === 'ANULADO') return { ok: false, codigo: 'ANULADO', mensaje: 'Ticket ANULADO. No se puede entregar.', ticket: info };
  if (e) return { ok: false, codigo: 'YA_ENTREGADO', mensaje: 'ALERTA: este ticket ya fue entregado el ' + info.fecha_entrega + ' (por ' + info.entregado_por + ')', ticket: info };
  if (!v) return { ok: false, codigo: 'SIN_VENTA', mensaje: 'Este ticket no tiene una venta registrada. No se puede entregar.', ticket: info };
  if (up_(v.estado_pago) === 'PENDIENTE' && cfg.requiere_pago_confirmado === 'SI') return { ok: false, codigo: 'PAGO_PENDIENTE', mensaje: 'Pago pendiente. Solicita validación al administrador', ticket: info };
  return { ok: true, codigo: 'OK', mensaje: up_(v.estado_pago) === 'PENDIENTE' ? 'Puede entregarse (atención: pago PENDIENTE).' : 'Ticket válido. Puede entregarse.', ticket: info };
}

function consultarEntrega_(c, p) {
  const n = normNum_(p.numero);
  if (!n) return { ok: false, codigo: 'NO_ENCONTRADO', mensaje: 'Ticket no encontrado', ticket: null };
  const d = loadAll_();
  return evaluarEntrega_(d, index_(d), n);
}

function confirmarEntrega_(c, p) {
  const n = normNum_(p.numero);
  if (!n) throw AppError('NO_ENCONTRADO', 'Ticket no encontrado');
  const obs = String(p.observaciones || '').trim();
  return withLock_(() => {
    const d = loadAll_(); const ix = index_(d);
    const r = evaluarEntrega_(d, ix, n);   // re-validación en backend, dentro del bloqueo
    if (!r.ok) {
      audit_(c.email, r.codigo === 'YA_ENTREGADO' ? 'INTENTO_ENTREGA_DUPLICADA' : 'ENTREGA_BLOQUEADA', 'ENTREGAS', r.ticket ? r.ticket.ticket_id : n, '', r.codigo, r.mensaje);
      throw AppError(r.codigo, r.mensaje);
    }
    const id = nextId_('E', d.e.map(e => e.entrega_id));
    const now = new Date();
    append_('ENTREGAS', [{
      entrega_id: id, ticket_id: r.ticket.ticket_id, numero_ticket: n, comprador: r.ticket.comprador, fecha_hora_entrega: now,
      entregado_por: c.email, estado_entrega: 'ENTREGADO', motivo_correccion: '', observaciones: obs, es_demo: r.ticket.es_demo
    }]);
    audit_(c.email, 'CONFIRMAR_ENTREGA', 'ENTREGAS', id, 'PENDIENTE', 'ENTREGADO ' + n, '');
    return { entrega_id: id, numero: n, comprador: r.ticket.comprador, fecha: fmt_(now), entregado_por: c.email };
  });
}

function revertirEntrega_(c, p) {
  const motivo = String(p.motivo || '').trim();
  if (motivo.length < 5) throw AppError('VALIDACION', 'El motivo es obligatorio (mínimo 5 caracteres).');
  return withLock_(() => {
    const e = read_('ENTREGAS').find(x => x.entrega_id === p.entrega_id);
    if (!e) throw AppError('NO_ENCONTRADO', 'Entrega no encontrada.');
    if (up_(e.estado_entrega) !== 'ENTREGADO') throw AppError('VALIDACION', 'La entrega ya fue revertida.');
    updateRow_('ENTREGAS', e._row, { estado_entrega: 'REVERTIDO', motivo_correccion: motivo + ' (por ' + c.email + ' el ' + fmt_(new Date()) + ')' });
    audit_(c.email, 'REVERTIR_ENTREGA', 'ENTREGAS', e.entrega_id, 'ENTREGADO', 'REVERTIDO', motivo);
    return { entrega_id: e.entrega_id, numero: String(e.numero_ticket) };
  });
}

function entregasRecientes_(c, p) {
  return read_('ENTREGAS').filter(e => up_(e.estado_entrega) === 'ENTREGADO').slice(-15).reverse()
    .map(e => ({ numero: String(e.numero_ticket), comprador: e.comprador, fecha: fmt_(e.fecha_hora_entrega), por: e.entregado_por, es_demo: isTrue_(e.es_demo) }));
}

/* =============================================================
 * DASHBOARD Y REPORTES (siempre calculados desde Sheets)
 * ============================================================= */
function dashboard_(c, f) {
  const d = loadAll_();
  const all = view_(d, c);
  const rows = filtrar_(all, f);
  const k = { total: rows.length, disponibles: 0, vendidos: 0, anulados: 0, pagados: 0, pendientes: 0, entregados: 0, por_recoger: 0, recaudado: 0, por_cobrar: 0 };
  const porLote = {}, porVend = {}, porArea = {};
  const g = (m, key, extra) => m[key] || (m[key] = Object.assign({ asignados: 0, vendidos: 0, pagados: 0, pendientes: 0, entregados: 0, recaudado: 0, por_cobrar: 0 }, extra));
  rows.forEach(r => {
    if (r.estado_ticket === 'DISPONIBLE') k.disponibles++;
    if (r.estado_ticket === 'ANULADO') k.anulados++;
    const L = g(porLote, r.lote_id, { lote_id: r.lote_id, nombre: r.nombre_lote, area: r.area });
    L.asignados++;
    if (!r.venta_id) return;
    k.vendidos++;
    const V = g(porVend, r.vendedor || '(sin vendedor)', { vendedor: r.vendedor || '(sin vendedor)' });
    const A = g(porArea, r.area || '(sin área)', { area: r.area || '(sin área)' });
    [L, V, A].forEach(o => {
      if (o !== L) o.asignados = undefined;
      o.vendidos++;
      if (r.estado_pago === 'PAGADO') { o.pagados++; o.recaudado += r.precio; }
      if (r.estado_pago === 'PENDIENTE') { o.pendientes++; o.por_cobrar += r.precio; }
      if (r.entregado) o.entregados++;
    });
    if (r.estado_pago === 'PAGADO') { k.pagados++; k.recaudado += r.precio; }
    if (r.estado_pago === 'PENDIENTE') { k.pendientes++; k.por_cobrar += r.precio; }
    if (r.entregado) k.entregados++; else k.por_recoger++;
  });
  k.recaudado = round2_(k.recaudado); k.por_cobrar = round2_(k.por_cobrar);
  const fix = o => Object.keys(o).map(x => o[x]).map(x => { x.recaudado = round2_(x.recaudado); x.por_cobrar = round2_(x.por_cobrar); return x; });
  return {
    kpis: k,
    por_lote: fix(porLote).sort((a, b) => String(a.lote_id).localeCompare(String(b.lote_id))),
    por_vendedor: fix(porVend).sort((a, b) => b.vendidos - a.vendidos),
    por_area: fix(porArea).sort((a, b) => b.vendidos - a.vendidos),
    alertas: integridad_(d),
    generado: fmt_(new Date())
  };
}

function reportes_(c, f) {
  const d = loadAll_();
  const rows = filtrar_(view_(d, c), f);
  const rend = {};
  rows.filter(r => r.venta_id).forEach(r => {
    const k = r.vendedor || '(sin vendedor)';
    const o = rend[k] || (rend[k] = { vendedor: k, tickets: 0, cobrado: 0, por_cobrar: 0, efectivo: 0, digital: 0 });
    o.tickets++;
    if (r.estado_pago === 'PAGADO') { o.cobrado += r.precio; if (r.metodo_pago === 'EFECTIVO') o.efectivo += r.precio; else o.digital += r.precio; }
    if (r.estado_pago === 'PENDIENTE') o.por_cobrar += r.precio;
  });
  return {
    total: rows.length,
    rows: rows.slice(0, 3000),
    rendicion: Object.keys(rend).map(k => rend[k]).sort((a, b) => b.tickets - a.tickets),
    generado: fmt_(new Date())
  };
}

function integridad_(d) {
  const al = [];
  const cv = {}, ce = {};
  d.v.forEach(v => { if (up_(v.estado_pago) !== 'ANULADO') cv[v.ticket_id] = (cv[v.ticket_id] || 0) + 1; });
  d.e.forEach(e => { if (up_(e.estado_entrega) === 'ENTREGADO') ce[e.ticket_id] = (ce[e.ticket_id] || 0) + 1; });
  const nums = {};
  d.t.forEach(t => {
    const n = String(t.numero_ticket);
    if (nums[n]) al.push('Número duplicado en TICKETS: ' + n);
    nums[n] = 1;
    if ((cv[t.ticket_id] || 0) > 1) al.push('Ticket ' + n + ' tiene ' + cv[t.ticket_id] + ' ventas activas');
    if ((ce[t.ticket_id] || 0) > 1) al.push('Ticket ' + n + ' tiene ' + ce[t.ticket_id] + ' entregas activas');
    if (up_(t.estado_ticket) === 'VENDIDO' && !cv[t.ticket_id]) al.push('Ticket ' + n + ' figura VENDIDO sin venta activa');
    if (up_(t.estado_ticket) !== 'VENDIDO' && cv[t.ticket_id]) al.push('Ticket ' + n + ' tiene venta activa pero estado ' + t.estado_ticket);
    if (ce[t.ticket_id] && !cv[t.ticket_id]) al.push('Ticket ' + n + ' entregado sin venta activa');
  });
  return al.slice(0, 50);
}

/* =============================================================
 * CONFIGURACIÓN, LOTES, USUARIOS, AUDITORÍA
 * ============================================================= */
function guardarConfig_(c, p) {
  const valores = p.valores || {};
  return withLock_(() => {
    const conf = read_('CONFIG');
    const patches = [];
    Object.keys(valores).forEach(k => {
      if (k === 'version_sistema') return;
      const r = conf.find(x => String(x.clave) === k);
      if (!r) return;
      let val = String(valores[k]).trim();
      if (['requiere_pago_confirmado', 'restringir_ventas_por_area', 'permitir_login_pin'].indexOf(k) >= 0) {
        val = up_(val); if (['SI', 'NO'].indexOf(val) < 0) throw AppError('VALIDACION', k + ' debe ser SI o NO.');
      }
      if (k === 'precio_unitario' && !(Number(val) >= 0)) throw AppError('VALIDACION', 'Precio inválido.');
      if (k === 'formato_numeracion' && !/0/.test(val)) throw AppError('VALIDACION', 'El formato debe contener al menos un 0.');
      if (k === 'fecha_actividad' && !/^\d{4}-\d{2}-\d{2}$/.test(val)) throw AppError('VALIDACION', 'Fecha en formato AAAA-MM-DD.');
      if (k === 'metodos_pago') val = val.split(',').map(s => s.trim().toUpperCase()).filter(Boolean).join(',');
      if (String(fmtAny_(r.valor)) !== val) { patches.push({ row: r._row, patch: { valor: val } }); audit_(c.email, 'EDITAR_CONFIG', 'CONFIG', k, fmtAny_(r.valor), val, p.motivo || ''); }
    });
    updateMany_('CONFIG', patches);
    return { actualizados: patches.length };
  });
}

function guardarLote_(c, p) {
  const nombre = String(p.nombre_lote || '').trim();
  if (!nombre) throw AppError('VALIDACION', 'El nombre del lote es obligatorio.');
  const estado = up_(p.estado || 'ACTIVO');
  if (['ACTIVO', 'PENDIENTE', 'CERRADO', 'ARCHIVADO'].indexOf(estado) < 0) throw AppError('VALIDACION', 'Estado de lote inválido.');
  return withLock_(() => {
    const lotes = read_('LOTES');
    const datos = { nombre_lote: nombre, area: String(p.area || '').trim(), responsable: String(p.responsable || '').trim(), estado: estado, observaciones: String(p.observaciones || '').trim() };
    if (p.lote_id) {
      const l = lotes.find(x => String(x.lote_id) === String(p.lote_id));
      if (!l) throw AppError('NO_ENCONTRADO', 'Lote no encontrado.');
      updateRow_('LOTES', l._row, datos);
      audit_(c.email, 'EDITAR_LOTE', 'LOTES', l.lote_id, JSON.stringify({ nombre_lote: l.nombre_lote, area: l.area, responsable: l.responsable, estado: l.estado }), JSON.stringify(datos), p.motivo || '');
      return { lote_id: String(l.lote_id) };
    }
    const max = lotes.map(l => parseInt(String(l.lote_id).replace(/^L/, ''), 10)).filter(n => !isNaN(n)).reduce((a, b) => Math.max(a, b), 0);
    const id = 'L' + (max + 1);
    append_('LOTES', [Object.assign({ lote_id: id, cantidad_asignada: 0 }, datos)]);
    audit_(c.email, 'CREAR_LOTE', 'LOTES', id, '', JSON.stringify(datos), '');
    return { lote_id: id };
  });
}

function listarUsuarios_(c) {
  return read_('USUARIOS').map(u => ({ usuario_id: u.usuario_id, nombre: u.nombre, correo: u.correo, rol: up_(u.rol), area: u.area, estado: up_(u.estado), tiene_pin: !!u.pin_hash, ultimo_acceso: fmt_(u.ultimo_acceso) }));
}

function guardarUsuario_(c, p) {
  const correo = norm_(p.correo);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw AppError('VALIDACION', 'Correo inválido.');
  const rol = up_(p.rol);
  if (ROLES.indexOf(rol) < 0) throw AppError('VALIDACION', 'Rol inválido.');
  const estado = up_(p.estado || 'ACTIVO');
  if (['ACTIVO', 'INACTIVO'].indexOf(estado) < 0) throw AppError('VALIDACION', 'Estado inválido.');
  const nombre = String(p.nombre || '').trim();
  if (nombre.length < 2) throw AppError('VALIDACION', 'Nombre obligatorio.');
  const pin = String(p.pin || '').trim();
  if (pin && !/^\d{6,10}$/.test(pin)) throw AppError('VALIDACION', 'El PIN debe tener de 6 a 10 dígitos.');
  return withLock_(() => {
    const users = read_('USUARIOS');
    const datos = { nombre: nombre, correo: correo, rol: rol, area: String(p.area || '').trim(), estado: estado };
    if (pin) datos.pin_hash = hashPin_(correo, pin);
    let id;
    if (p.usuario_id) {
      const u = users.find(x => x.usuario_id === p.usuario_id);
      if (!u) throw AppError('NO_ENCONTRADO', 'Usuario no encontrado.');
      if (users.some(x => x !== u && norm_(x.correo) === correo)) throw AppError('VALIDACION', 'Ya existe otro usuario con ese correo.');
      if (norm_(u.correo) !== correo && !pin) datos.pin_hash = '';   // el hash depende del correo
      const adminsRestantes = users.filter(x => x !== u && up_(x.rol) === 'ADMIN' && up_(x.estado) === 'ACTIVO').length + (rol === 'ADMIN' && estado === 'ACTIVO' ? 1 : 0);
      if (adminsRestantes === 0) throw AppError('VALIDACION', 'Debe quedar al menos un ADMIN activo.');
      updateRow_('USUARIOS', u._row, datos);
      id = u.usuario_id;
      audit_(c.email, 'EDITAR_USUARIO', 'USUARIOS', id, JSON.stringify({ correo: u.correo, rol: u.rol, estado: u.estado, area: u.area }), JSON.stringify({ correo: correo, rol: rol, estado: estado, area: datos.area }) + (pin ? ' | PIN actualizado' : ''), p.motivo || '');
    } else {
      if (users.some(x => norm_(x.correo) === correo)) throw AppError('VALIDACION', 'Ya existe un usuario con ese correo.');
      const max = users.map(u => parseInt(String(u.usuario_id).replace(/\D/g, ''), 10)).filter(n => !isNaN(n)).reduce((a, b) => Math.max(a, b), 0);
      id = 'U' + ('00' + (max + 1)).slice(-3);
      append_('USUARIOS', [Object.assign({ usuario_id: id, pin_hash: '', ultimo_acceso: '' }, datos)]);
      audit_(c.email, 'CREAR_USUARIO', 'USUARIOS', id, '', JSON.stringify({ correo: correo, rol: rol, area: datos.area }) + (pin ? ' | con PIN' : ''), '');
    }
    return { usuario_id: id };
  });
}

function listarAuditoria_(c, p) {
  return read_('AUDITORIA').slice(-200).reverse().map(a => ({ fecha_hora: fmt_(a.fecha_hora), usuario: a.usuario, accion: a.accion, modulo: a.modulo, id_registro: a.id_registro, valor_anterior: fmtAny_(a.valor_anterior), valor_nuevo: fmtAny_(a.valor_nuevo), motivo: a.motivo }));
}

function audit_(usuario, accion, modulo, id, antes, despues, motivo) {
  append_('AUDITORIA', [{ fecha_hora: new Date(), usuario: usuario, accion: accion, modulo: modulo, id_registro: id, valor_anterior: String(antes || '').slice(0, 1000), valor_nuevo: String(despues || '').slice(0, 1000), motivo: motivo || '' }]);
}

/* =============================================================
 * DATOS DEMO (separados por es_demo = TRUE y numeración DEMO-###)
 * ============================================================= */
function cargarDemo_(c, p) {
  withLock_(() => {
    if (!read_('LOTES').some(l => String(l.lote_id) === APP.DEMO_LOTE)) {
      append_('LOTES', [{ lote_id: APP.DEMO_LOTE, nombre_lote: 'DEMO (pruebas)', area: 'DEMO', responsable: 'DEMO', cantidad_asignada: 0, estado: 'ACTIVO', observaciones: 'Solo pruebas. Archivar antes del evento.' }]);
    } else {
      const l = read_('LOTES').find(x => String(x.lote_id) === APP.DEMO_LOTE);
      if (up_(l.estado) !== 'ACTIVO') updateRow_('LOTES', l._row, { estado: 'ACTIVO' });
    }
  });
  const existentes = read_('TICKETS').filter(t => isTrue_(t.es_demo)).length;
  const desde = existentes + 1;
  const r = crearTickets_(c, APP.DEMO_LOTE, Array.from({ length: 30 }, (_, i) => normNum_('DEMO-' + (desde + i))), 'Vendedor DEMO', 'GENERAR');
  return { mensaje: 'Tickets DEMO creados: ' + r.creados + ' (lote ' + APP.DEMO_LOTE + ').', creados: r.creados };
}

/** Ejecuta los casos de prueba obligatorios usando solo tickets DEMO. */
function ejecutarPruebasDemo_(c, p) {
  const libres = () => read_('TICKETS').filter(t => isTrue_(t.es_demo) && up_(t.estado_ticket) === 'DISPONIBLE').map(t => String(t.numero_ticket));
  if (libres().length < 5) cargarDemo_(c, {});
  const L = libres();
  const [a, b, cc, dd] = L;
  const res = [];
  const caso = (nombre, fn, esperado) => {
    let detalle, okk;
    try { const r = fn(); okk = esperado(r, null); detalle = JSON.stringify(r).slice(0, 160); }
    catch (e) { okk = esperado(null, e); detalle = (e.code ? e.code + ': ' : '') + e.message; }
    res.push({ caso: nombre, ok: !!okk, detalle: detalle });
  };
  const venta = (n, pago) => { CFG_CACHE = null; return registrarVenta_(c, { tickets: [n], comprador: 'Comprador DEMO', telefono: '', metodo_pago: 'EFECTIVO', estado_pago: pago, vendedor: 'Vendedor DEMO', observaciones: 'PRUEBA DEMO' }); };
  const reqPago = cfg_().requiere_pago_confirmado === 'SI';

  caso('Registrar ticket disponible (' + a + ')', () => venta(a, 'PAGADO'), (r) => r && r.operacion_id);
  caso('Vender de nuevo el mismo ticket', () => venta(a, 'PAGADO'), (r, e) => e && e.code === 'DUPLICADO');
  caso('Buscar ticket inexistente (DEMO-999)', () => consultarEntrega_(c, { numero: 'DEMO-999' }), (r) => r && r.codigo === 'NO_ENCONTRADO' && r.mensaje === 'Ticket no encontrado');
  caso('Entregar ticket no vendido (' + b + ')', () => confirmarEntrega_(c, { numero: b }), (r, e) => e && e.code === 'SIN_VENTA');
  venta(cc, 'PENDIENTE');
  caso('Entregar ticket con pago pendiente (' + cc + ')', () => confirmarEntrega_(c, { numero: cc }), (r, e) => reqPago ? (e && e.code === 'PAGO_PENDIENTE') : !!r);
  caso('Entregar ticket pagado (' + a + ')', () => confirmarEntrega_(c, { numero: a }), (r) => r && r.entrega_id);
  caso('Entregarlo otra vez (' + a + ')', () => confirmarEntrega_(c, { numero: a }), (r, e) => e && e.code === 'YA_ENTREGADO' && /ya fue entregado el \d{2}\/\d{2}\/\d{4}/.test(e.message));
  anularTicket_(c, { numero: dd, motivo: 'Prueba DEMO de anulación' });
  caso('Entregar ticket anulado (' + dd + ')', () => confirmarEntrega_(c, { numero: dd }), (r, e) => e && e.code === 'ANULADO');
  caso('Vender ticket anulado (' + dd + ')', () => venta(dd, 'PAGADO'), (r, e) => !!e);
  caso('Dos entregas del mismo ticket (secuencial bajo LockService)', () => {
    const v2 = libres()[0]; venta(v2, 'PAGADO');
    let okCount = 0;
    [1, 2].forEach(() => { try { confirmarEntrega_(c, { numero: v2 }); okCount++; } catch (e) { /* esperado */ } });
    return { ticket: v2, confirmadas: okCount };
  }, (r) => r && r.confirmadas === 1);
  const ent = read_('ENTREGAS').filter(e => String(e.numero_ticket) === a && up_(e.estado_entrega) === 'ENTREGADO')[0];
  caso('Revertir entrega sin motivo', () => revertirEntrega_(c, { entrega_id: ent && ent.entrega_id, motivo: '' }), (r, e) => e && e.code === 'VALIDACION');
  caso('Administrador revierte entrega con motivo', () => {
    const r = revertirEntrega_(c, { entrega_id: ent.entrega_id, motivo: 'Prueba DEMO de reversión' });
    const au = read_('AUDITORIA').filter(x => x.accion === 'REVERTIR_ENTREGA' && x.id_registro === ent.entrega_id);
    return { r: r, auditado: au.length > 0 };
  }, (r) => r && r.auditado);
  caso('Dashboard coincide con Sheets (lote DEMO)', () => {
    const dsh = dashboard_(c, { lote: APP.DEMO_LOTE, demo: 'solo' });
    const vts = read_('VENTAS').filter(v => isTrue_(v.es_demo) && up_(v.estado_pago) !== 'ANULADO');
    const ents = read_('ENTREGAS').filter(e => isTrue_(e.es_demo) && up_(e.estado_entrega) === 'ENTREGADO');
    const tks = read_('TICKETS').filter(t => isTrue_(t.es_demo));
    const pag = vts.filter(v => up_(v.estado_pago) === 'PAGADO').reduce((s, v) => s + Number(v.precio_unitario), 0);
    return { dash: [dsh.kpis.total, dsh.kpis.vendidos, dsh.kpis.entregados, dsh.kpis.recaudado], hoja: [tks.length, vts.length, ents.length, round2_(pag)] };
  }, (r) => r && JSON.stringify(r.dash) === JSON.stringify(r.hoja));
  audit_(c.email, 'PRUEBAS_DEMO', 'SISTEMA', '', '', res.filter(x => x.ok).length + '/' + res.length + ' OK', '');
  return { resultados: res, ok: res.every(x => x.ok) };
}

/** Mueve SOLO filas DEMO a pestañas ARCHIVO_DEMO_*. Nunca toca filas reales. */
function archivarDemo_(c, p) {
  return withLock_(() => {
    const ss = SpreadsheetApp.getActive();
    const resumen = [];
    ['ENTREGAS', 'VENTAS', 'TICKETS'].forEach(name => {
      const s = sh_(name);
      const h = headers_(name);
      const iDemo = h.indexOf('es_demo'), iNum = h.indexOf('numero_ticket');
      const vals = s.getDataRange().getValues();
      const filas = [];
      for (let i = vals.length - 1; i >= 1; i--) {
        if (isTrue_(vals[i][iDemo]) && /^DEMO-/.test(String(vals[i][iNum]))) filas.push(i);
      }
      if (!filas.length) return;
      const arch = 'ARCHIVO_DEMO_' + name;
      let a = ss.getSheetByName(arch);
      if (!a) { a = ss.insertSheet(arch); a.getRange(1, 1, 1, h.length + 1).setValues([h.concat(['archivado_el'])]); }
      const now = new Date();
      const data = filas.slice().reverse().map(i => vals[i].concat([now]));
      a.getRange(a.getLastRow() + 1, 1, data.length, data[0].length).setValues(data);
      filas.forEach(i => s.deleteRow(i + 1));   // de abajo hacia arriba
      resumen.push(name + ': ' + filas.length);
    });
    const l = read_('LOTES').find(x => String(x.lote_id) === APP.DEMO_LOTE);
    if (l) updateRow_('LOTES', l._row, { estado: 'ARCHIVADO', cantidad_asignada: 0, rango_inicio: '', rango_fin: '' });
    audit_(c.email, 'ARCHIVAR_DEMO', 'SISTEMA', '', '', resumen.join(' | ') || 'sin filas DEMO', '');
    return { mensaje: resumen.length ? 'Filas DEMO archivadas → ' + resumen.join(', ') : 'No había filas DEMO.' };
  });
}

/* =============================================================
 * VISTA UNIFICADA DE TICKETS
 * ============================================================= */
function loadAll_() {
  return { t: read_('TICKETS'), v: read_('VENTAS'), e: read_('ENTREGAS'), l: read_('LOTES') };
}

function index_(d) {
  const ventaAct = {}, entregaAct = {}, lotes = {};
  d.v.forEach(v => { if (up_(v.estado_pago) !== 'ANULADO') ventaAct[v.ticket_id] = v; });
  d.e.forEach(e => { if (up_(e.estado_entrega) === 'ENTREGADO') entregaAct[e.ticket_id] = e; });
  d.l.forEach(l => { lotes[String(l.lote_id)] = l; });
  return { ventaAct: ventaAct, entregaAct: entregaAct, lotes: lotes };
}

function view_(d, c) {
  const ix = index_(d);
  const verTel = c && c.rol === 'ADMIN';
  return d.t.map(t => {
    const v = ix.ventaAct[t.ticket_id], e = ix.entregaAct[t.ticket_id], l = ix.lotes[String(t.lote_id)];
    return {
      ticket_id: t.ticket_id, numero: String(t.numero_ticket), lote_id: String(t.lote_id), nombre_lote: l ? l.nombre_lote : '',
      area: l ? String(l.area || '') : String(t.area || ''), vendedor_asignado: String(t.vendedor_asignado || ''),
      estado_ticket: up_(t.estado_ticket), es_demo: isTrue_(t.es_demo),
      venta_id: v ? v.venta_id : '', operacion_id: v ? v.operacion_id : '', vendedor: v ? String(v.vendedor || '') : '',
      comprador: v ? String(v.comprador || '') : '', telefono: v && verTel ? String(v.telefono_comprador || '') : '',
      estado_pago: v ? up_(v.estado_pago) : '', precio: v ? (Number(v.precio_unitario) || 0) : 0, metodo_pago: v ? up_(v.metodo_pago) : '',
      fecha_venta: v ? fmt_(v.fecha_venta) : '', entregado: !!e, fecha_entrega: e ? fmt_(e.fecha_hora_entrega) : '',
      entregado_por: e ? String(e.entregado_por || '') : ''
    };
  });
}

function filtrar_(rows, f) {
  f = f || {};
  const demo = f.demo || 'excluir';
  const q = norm_(f.q);
  return rows.filter(r => {
    if (demo === 'excluir' && r.es_demo) return false;
    if (demo === 'solo' && !r.es_demo) return false;
    if (f.lote && r.lote_id !== String(f.lote)) return false;
    if (f.area && norm_(r.area) !== norm_(f.area)) return false;
    if (f.vendedor && norm_(r.vendedor) !== norm_(f.vendedor) && norm_(r.vendedor_asignado) !== norm_(f.vendedor)) return false;
    if (f.estado) {
      const s = up_(f.estado);
      if (['DISPONIBLE', 'VENDIDO', 'ANULADO'].indexOf(s) >= 0 && r.estado_ticket !== s) return false;
      if (['PAGADO', 'PENDIENTE'].indexOf(s) >= 0 && r.estado_pago !== s) return false;
      if (s === 'ENTREGADO' && !r.entregado) return false;
      if (s === 'POR_RECOGER' && (!r.venta_id || r.entregado)) return false;
    }
    if (q && (r.numero + ' ' + norm_(r.comprador)).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}

/* =============================================================
 * ACCESO A SHEETS
 * ============================================================= */
function sh_(name) {
  const s = SpreadsheetApp.getActive().getSheetByName(name);
  if (!s) throw AppError('CONFIG', 'Falta la pestaña ' + name + '. Ejecuta "Inicializar / reparar hojas" desde el menú de la hoja.');
  return s;
}

function headers_(name) {
  if (HEAD_CACHE[name]) return HEAD_CACHE[name];
  const s = sh_(name);
  const n = s.getLastColumn();
  return (HEAD_CACHE[name] = n ? s.getRange(1, 1, 1, n).getValues()[0].map(x => String(x).trim()) : []);
}

function read_(name) {
  const s = sh_(name);
  const v = s.getDataRange().getValues();
  if (v.length < 2) return [];
  const h = v[0].map(x => String(x).trim());
  HEAD_CACHE[name] = h;
  const out = [];
  for (let i = 1; i < v.length; i++) {
    if (v[i].every(x => x === '' || x === null)) continue;
    const o = { _row: i + 1 };
    h.forEach((k, j) => { if (k) o[k] = v[i][j]; });
    out.push(o);
  }
  return out;
}

function append_(name, objs) {
  if (!objs || !objs.length) return;
  const s = sh_(name), h = headers_(name);
  const data = objs.map(o => h.map(k => (k in o && o[k] !== undefined && o[k] !== null) ? clean_(o[k]) : ''));
  s.getRange(s.getLastRow() + 1, 1, data.length, h.length).setValues(data);
}

function updateRow_(name, row, patch) {
  const s = sh_(name), h = headers_(name);
  Object.keys(patch).forEach(k => {
    const col = h.indexOf(k);
    if (col < 0) throw AppError('CONFIG', 'Falta la columna ' + k + ' en ' + name + '. Ejecuta "Inicializar / reparar hojas".');
    s.getRange(row, col + 1).setValue(clean_(patch[k]));
  });
}

/** Varios cambios en una sola escritura por columna (usar dentro de withLock_). */
function updateMany_(name, patches) {
  if (!patches || !patches.length) return;
  const s = sh_(name), h = headers_(name);
  const cols = {};
  patches.forEach(p => Object.keys(p.patch).forEach(k => { cols[k] = 1; }));
  Object.keys(cols).forEach(k => {
    const col = h.indexOf(k);
    if (col < 0) throw AppError('CONFIG', 'Falta la columna ' + k + ' en ' + name + '.');
    const rows = patches.filter(p => k in p.patch);
    const min = Math.min.apply(null, rows.map(p => p.row)), max = Math.max.apply(null, rows.map(p => p.row));
    const rng = s.getRange(min, col + 1, max - min + 1, 1);
    const vals = rng.getValues();
    const touched = {};
    rows.forEach(p => { vals[p.row - min][0] = p.patch[k]; touched[p.row - min] = 1; });
    if (max - min + 1 <= rows.length * 3) {
      rng.setValues(vals.map((r, i) => [touched[i] ? clean_(r[0]) : keep_(r[0])]));
    } else {
      rows.forEach(p => s.getRange(p.row, col + 1).setValue(clean_(p.patch[k])));
    }
  });
}

function keep_(v) { return (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : v; }

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw AppError('OCUPADO', 'El sistema está ocupado. Intenta de nuevo en unos segundos.');
  try {
    const r = fn();
    SpreadsheetApp.flush();
    return r;
  } finally {
    lock.releaseLock();
  }
}

function nextId_(prefix, existentes) { return nextIds_(prefix, existentes, 1)[0]; }

/** IDs correlativos: máximo entre el contador persistente y los IDs presentes. Llamar dentro de withLock_. */
function nextIds_(prefix, existentes, n) {
  const props = PropertiesService.getScriptProperties();
  const re = new RegExp('^' + prefix + '-(\\d+)$');
  let max = Number(props.getProperty('SEQ_' + prefix) || 0);
  (existentes || []).forEach(x => { const m = re.exec(String(x)); if (m) max = Math.max(max, Number(m[1])); });
  const out = [];
  for (let i = 1; i <= n; i++) out.push(prefix + '-' + ('000000' + (max + i)).slice(-6));
  props.setProperty('SEQ_' + prefix, String(max + n));
  return out;
}

/* =============================================================
 * UTILIDADES
 * ============================================================= */
function cfg_() {
  if (CFG_CACHE) return CFG_CACHE;
  const m = {};
  read_('CONFIG').forEach(r => { if (r.clave) m[String(r.clave).trim()] = r.valor; });
  CONFIG_DEFAULTS.forEach(d => { if (m[d[0]] === undefined || m[d[0]] === '') m[d[0]] = d[1]; });
  ['requiere_pago_confirmado', 'restringir_ventas_por_area', 'permitir_login_pin'].forEach(k => { m[k] = isTrue_(m[k]) ? 'SI' : 'NO'; });
  m.precio_unitario = Number(m.precio_unitario);
  m.fecha_actividad = isDate_(m.fecha_actividad) ? Utilities.formatDate(m.fecha_actividad, APP.TZ, 'yyyy-MM-dd') : String(m.fecha_actividad);
  m.formato_numeracion = String(m.formato_numeracion);
  m.metodos = String(m.metodos_pago).split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  return (CFG_CACHE = m);
}

/** Normaliza: "1", "001", "000001", "000-001" → "000-001"; "demo 7" → "DEMO-007". */
function normNum_(input) {
  const s = String(input === undefined || input === null ? '' : input).trim().toUpperCase().replace(/\s+/g, '');
  if (!s) return '';
  let digits = s.replace(/\D/g, '');
  if (!digits) return '';
  if (/^DEMO/.test(s)) {
    if (digits.length > 3) digits = digits.replace(/^0+(?=\d)/, '');
    return digits.length > 3 ? '' : 'DEMO-' + ('000' + digits).slice(-3);
  }
  const fmt = cfg_().formato_numeracion;
  if (/[A-Z]/.test(s) && !/[A-Z]/.test(fmt.toUpperCase())) return '';
  const n = (fmt.match(/0/g) || []).length;
  if (digits.length > n) digits = digits.replace(/^0+(?=\d)/, '');
  if (digits.length > n) return '';
  const p = ('0'.repeat(n) + digits).slice(-n);
  let i = 0;
  return fmt.replace(/0/g, () => p[i++]);
}

function listaNums_(p) {
  let nums = [];
  if (p.lista) nums = String(p.lista).split(/[\s,;]+/).filter(Boolean).map(normNum_);
  else if (p.desde !== undefined && p.hasta !== undefined && p.desde !== '' && p.hasta !== '') {
    const a = parseInt(String(p.desde).replace(/\D/g, ''), 10), b = parseInt(String(p.hasta).replace(/\D/g, ''), 10);
    if (!(a >= 0) || !(b >= a) || b - a > 3000) throw AppError('VALIDACION', 'Rango inválido.');
    const demo = /^DEMO/i.test(String(p.desde));
    for (let i = a; i <= b; i++) nums.push(normNum_((demo ? 'DEMO-' : '') + i));
  }
  if (!nums.length || nums.some(x => !x)) throw AppError('VALIDACION', 'Indica números válidos (lista o rango).');
  return uniq_(nums);
}

function clean_(v) {
  if (typeof v === 'string') {
    v = v.trim().slice(0, 1000);
    if (/^[=+\-@]/.test(v)) return "'" + v;   // evita inyección de fórmulas
  }
  return v;
}

function isDate_(d) { return Object.prototype.toString.call(d) === '[object Date]'; }
function fmt_(d) { if (!d) return ''; if (isDate_(d)) return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, APP.TZ, 'dd/MM/yyyy HH:mm:ss'); return String(d); }
function fmtAny_(v) { return isDate_(v) ? fmt_(v) : (v === null || v === undefined ? '' : String(v)); }
function norm_(s) { return String(s === undefined || s === null ? '' : s).trim().toLowerCase(); }
function up_(s) { return String(s === undefined || s === null ? '' : s).trim().toUpperCase(); }
function isTrue_(v) { return v === true || ['TRUE', 'SI', 'SÍ', '1', 'YES', 'VERDADERO'].indexOf(up_(v)) >= 0; }
function uniq_(a) { const s = {}; return a.filter(x => (s[x] ? false : (s[x] = true))); }
function round2_(n) { return Math.round((Number(n) || 0) * 100) / 100; }
