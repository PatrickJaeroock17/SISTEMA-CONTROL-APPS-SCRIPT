// Simulación mínima de los servicios de Apps Script para probar Code.gs en Node.
const fs = require('fs'), vm = require('vm'), crypto = require('crypto'), path = require('path');

class Range {
  constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
  getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const R = this.sh.d[this.r - 1 + i]; row.push(R && R[this.c - 1 + j] !== undefined ? R[this.c - 1 + j] : ''); } out.push(row); } return out; }
  setValues(v) { v.forEach((row, i) => row.forEach((x, j) => this.sh.set(this.r + i, this.c + j, x))); return this; }
  setValue(x) { this.sh.set(this.r, this.c, x); return this; }
  setNumberFormat() { return this; } setFontWeight() { return this; } setBackground() { return this; } setFontColor() { return this; }
}
class Sheet {
  constructor(name) { this.name = name; this.d = []; this.prot = []; }
  set(r, c, x) { if (typeof x === 'string' && x[0] === "'") x = x.slice(1); while (this.d.length < r) this.d.push([]); this.d[r - 1][c - 1] = x; }
  getLastRow() { for (let i = this.d.length; i > 0; i--) if ((this.d[i - 1] || []).some(x => x !== '' && x !== undefined)) return i; return 0; }
  getLastColumn() { return Math.max(0, ...this.d.map(r => { let n = 0; r.forEach((x, j) => { if (x !== '' && x !== undefined) n = j + 1; }); return n; })); }
  getMaxRows() { return 1000; }
  getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
  getDataRange() { return new Range(this, 1, 1, this.getLastRow(), this.getLastColumn()); }
  setFrozenRows() {} deleteRow(r) { this.d.splice(r - 1, 1); }
  getProtections() { return this.prot; } protect() { const p = { setDescription() { return p; }, setWarningOnly() { return p; } }; this.prot.push(p); return p; }
}
function makeEnv(activeEmail) {
  const sheets = {}; const cache = {}; const props = {};
  const ss = { getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = new Sheet(n)), getSheets: () => Object.values(sheets) };
  const env = {
    console, JSON, Math, Date, Object, String, Number, Array, RegExp, Error, parseInt, isNaN,
    SpreadsheetApp: { getActive: () => ss, flush() {}, getUi() { throw new Error('sin UI'); }, ProtectionType: { SHEET: 'SHEET' } },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate: (d, tz, f) => { const p = n => String(n).padStart(2, '0'); return f === 'yyyy-MM-dd' ? `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` : `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; },
      computeDigest: (a, s) => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map(b => b > 127 ? b - 256 : b),
      DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 }
    },
    Session: { getActiveUser: () => ({ getEmail: () => env._active }), getEffectiveUser: () => ({ getEmail: () => 'dueno@gmail.com' }) },
    HtmlService: {}, _active: activeEmail, _sheets: sheets
  };
  vm.createContext(env);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/Code.gs'), 'utf8'), env);
  return env;
}

module.exports = { makeEnv };
