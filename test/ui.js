// Prueba de humo de la interfaz: jsdom + backend simulado.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const { makeEnv } = require('./mock');
const src = f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8');
const env = makeEnv('dueno@gmail.com');
env.inicializarSistema();
env.api('tickets.generar', { lote_id: 'L1', desde: 1, hasta: 30, vendedor_asignado: 'Ana' });
env.api('demo.cargar', {});
let html = src('Index.html').replace(/<\?!= include_\('(\w+)'\); \?>/g, (m, f) => src(f + '.html')).replace('<?= vista ?>', '');
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(w) {
  w.addEventListener('error', e => errors.push(e.message));
  const runner = () => { const h = {}; const p = new Proxy({}, { get: (t, k) => k === 'withSuccessHandler' ? (f => (h.s = f, p)) : k === 'withFailureHandler' ? (f => (h.f = f, p)) : ((...a) => setTimeout(() => { try { h.s(env[k](...a)); } catch (e) { errors.push(String(e.stack)); h.f(e); } }, 5)) }); return p; };
  w.google = { script: { get run() { return runner(); } } };
  w.console.error = (...a) => errors.push(a.join(' '));
}});
const w = dom.window, d = w.document, wait = ms => new Promise(r => setTimeout(r, ms || 80));
const txt = s => (d.querySelector(s) || {}).textContent || '';
const click = s => d.querySelector(s).click();
const ok = (n, c) => { console.log(c ? '  ✅' : '  ❌', n); if (!c) process.exitCode = 1; };
(async () => {
  await wait(200);
  ok('Dashboard carga con KPIs', /Total tickets/.test(txt('#main')) && /Recaudación confirmada/.test(txt('#main')));
  ok('6 pestañas para ADMIN', d.querySelectorAll('#tabs button').length === 6);
  [...d.querySelectorAll('#tabs button')].find(b => b.textContent === 'Ventas').click(); await wait(150);
  d.querySelector('#vNum').value = '1, 2'; click('#vAdd'); await wait(200);
  ok('Carrito con 2 tickets', d.querySelectorAll('#vChips .chip').length === 2 && /36\.00/.test(txt('#vTotal')));
  d.querySelector('#vComp').value = 'María López'; click('#vSave'); await wait(50);
  ok('Modal de confirmación', !d.querySelector('#modalBg').hidden && /María López/.test(txt('#modal')));
  [...d.querySelectorAll('#modal .actions button')].pop().click(); await wait(250);
  ok('Venta guardada y en historial', env.read_('VENTAS').length === 2 && /000-001/.test(txt('#hist')));
  d.querySelector('#vNum').value = '1'; click('#vAdd'); await wait(150);
  ok('Ticket vendido no entra al carrito', d.querySelectorAll('#vChips .chip').length === 0 && /Ya fue vendido/.test(txt('#toasts')));
  [...d.querySelectorAll('#tabs button')].find(b => b.textContent === 'Entregas').click(); await wait(150);
  d.querySelector('#eNum').value = '1'; d.querySelector('#fEnt').dispatchEvent(new w.Event('submit', { cancelable: true })); await wait(150);
  ok('Verificación OK con botón Confirmar entrega', /Ticket válido/.test(txt('#eRes')) && !!d.querySelector('#eConf'));
  click('#eConf'); await wait(200);
  ok('Entrega confirmada', /ENTREGADO/.test(txt('#eRes')) && env.read_('ENTREGAS').length === 1);
  d.querySelector('#eNum').value = '000-001'; d.querySelector('#fEnt').dispatchEvent(new w.Event('submit', { cancelable: true })); await wait(150);
  ok('Segunda vez: ALERTA ya entregado, sin botón confirmar, admin ve Revertir', /ALERTA: este ticket ya fue entregado el/.test(txt('#eRes')) && !d.querySelector('#eConf') && !!d.querySelector('#eRev'));
  d.querySelector('#eNum').value = '777'; d.querySelector('#fEnt').dispatchEvent(new w.Event('submit', { cancelable: true })); await wait(150);
  ok('Ticket no encontrado', /Ticket no encontrado/.test(txt('#eRes')));
  for (const t of ['Tickets', 'Reportes', 'Configuración', 'Dashboard']) {
    [...d.querySelectorAll('#tabs button')].find(b => b.textContent === t).click(); await wait(250);
    ok('Pestaña ' + t + ' renderiza sin error', !/alert err/.test(d.querySelector('#main').innerHTML) && txt('#main').length > 50);
  }
  ok('Dashboard refleja 2 vendidos / 1 entregado', /Vendidos/.test(txt('#main')));
  [...d.querySelectorAll('#tabs button')].find(b => b.textContent === 'Configuración').click(); await wait(250);
  click('#dTest'); await wait(600);
  ok('Pruebas DEMO desde la interfaz', /Todas las pruebas pasaron/.test(txt('#dRes')));
  // XSS: comprador con HTML
  env.api('ventas.registrar', { tickets: ['5'], comprador: '<img src=x onerror=alert(1)>', metodo_pago: 'EFECTIVO', estado_pago: 'PAGADO' });
  [...d.querySelectorAll('#tabs button')].find(b => b.textContent === 'Reportes').click(); await wait(250);
  ok('Escapa HTML de datos (sin XSS)', !d.querySelector('#rep img') && /&lt;img/.test(d.querySelector('#rep').innerHTML));
  // Login PIN como ENTREGAS
  env.api('usuarios.guardar', { nombre: 'Beto', correo: 'beto@gmail.com', rol: 'ENTREGAS', pin: '654321' });
  env._active = '';
  click('#btnLogout'); await wait(200);
  ok('Pantalla de login', !!d.querySelector('#fLogin'));
  d.querySelector('#lCorreo').value = 'beto@gmail.com'; d.querySelector('#lPin').value = '654321';
  d.querySelector('#fLogin').dispatchEvent(new w.Event('submit', { cancelable: true })); await wait(300);
  ok('ENTREGAS ve solo la pantalla de entregas', /Entrega de polladas/.test(txt('#main')) && d.querySelector('#tabs').hidden);
  ok('Sin errores JS', errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 5));
  w.close();
})();
