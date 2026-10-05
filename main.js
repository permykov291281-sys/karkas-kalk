// Главный процесс: окно, работа с файлами прайса, экспорт сметы.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const Engine = require('./src/engine.js');

const USER = () => app.getPath('userData');
const PRICE_JSON = () => path.join(USER(), 'price.json');
const SETTINGS_JSON = () => path.join(USER(), 'settings.json');
const CALCS_DIR = () => path.join(USER(), 'calcs');
const DEFAULT_XLSX = path.join(__dirname, 'data', 'prays_karkas.xlsx');

let win;

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 1), 'utf8');
}

// Разбор книги Excel/CSV: лист с ценами ищем по колонке «Наименование», остальные — по названию листа.
function parseWorkbook(buf, fileName) {
  const wb = XLSX.read(buf, { type: 'buffer', raw: false, codepage: 65001 });
  let items = null, err = null, sheetUsed = '';
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });
    try { items = Engine.parsePriceRows(rows); sheetUsed = name; break; } catch (e) { err = err || e; }
  }
  if (!items) throw new Error(err ? err.message : 'В файле нет листа с прайсом.');
  const find = re => wb.SheetNames.find(n => re.test(n));
  const rowsOf = n => (n ? XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }) : []);
  const norms = Engine.parseNormRows(rowsOf(find(/норм|коэфф/i)));
  const control = Engine.parseControlRows(rowsOf(find(/контрол/i)));
  const idx = Engine.buildIndex(items);
  return { items, norms, control, meta: { fileName, sheet: sheetUsed, loadedAt: new Date().toISOString(), count: items.length,
    missing: idx.missing.map(m => m.name), sections: [...new Set(items.map(i => i.section))].length } };
}

function savePrice(price, source) {
  price.meta.source = source;
  writeJson(PRICE_JSON(), price);
  return price;
}

function getPrice() {
  const p = readJson(PRICE_JSON(), null);
  if (p && p.items && p.items.length) return p;
  return savePrice(parseWorkbook(fs.readFileSync(DEFAULT_XLSX), 'prays_karkas.xlsx (встроенный)'), 'builtin');
}

// Публичная ссылка Яндекс.Диска → прямая ссылка на скачивание. Любая другая ссылка качается как есть.
async function downloadByLink(url) {
  url = String(url || '').trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('Вставьте ссылку, начинающуюся с https://');
  let direct = url;
  if (/(disk\.yandex\.|yadi\.sk)/i.test(url)) {
    const api = 'https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=' + encodeURIComponent(url);
    const r = await fetch(api);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.href) throw new Error('Яндекс.Диск не отдал файл: ' + (j.description || j.message || r.status) +
      '. Проверьте, что это ссылка на сам файл .xlsx и доступ открыт «для всех, у кого есть ссылка».');
    direct = j.href;
  } else if (/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/.test(url)) {
    direct = 'https://docs.google.com/spreadsheets/d/' + url.match(/\/d\/([\w-]+)/)[1] + '/export?format=xlsx';
  }
  const res = await fetch(direct, { redirect: 'follow' });
  if (!res.ok) throw new Error('Не удалось скачать файл (код ' + res.status + ').');
  return { buf: Buffer.from(await res.arrayBuffer()), name: fileNameOf(res, direct) };
}

// Имя файла: из заголовка ответа, из параметра filename ссылки Яндекса или из адреса
function fileNameOf(res, url) {
  const cd = res.headers.get('content-disposition') || '';
  const m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^";]+)"?/i);
  if (m) { try { return decodeURIComponent(m[1]); } catch { return m[1]; } }
  try {
    const u = new URL(url);
    const f = u.searchParams.get('filename') || decodeURIComponent(u.pathname.split('/').pop() || '');
    if (/\.(xlsx|xls|xlsm|ods|csv)$/i.test(f)) return f;
  } catch { /* не адрес */ }
  return 'таблица';
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700,
    backgroundColor: '#0d1016', title: 'КаркасКальк', show: false,
    icon: path.join(__dirname, 'src', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

ipcMain.handle('price:get', () => getPrice());

ipcMain.handle('price:loadFile', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Загрузить прайс', properties: ['openFile'],
    filters: [{ name: 'Таблицы', extensions: ['xlsx', 'xls', 'xlsm', 'ods', 'csv'] }],
  });
  if (r.canceled || !r.filePaths[0]) return { canceled: true };
  const f = r.filePaths[0];
  const price = parseWorkbook(fs.readFileSync(f), path.basename(f));
  return savePrice(price, 'file');
});

ipcMain.handle('price:loadLink', async (_e, url) => {
  const { buf, name } = await downloadByLink(url);
  const src = /(disk\.yandex\.|yadi\.sk)/i.test(url) ? 'Яндекс.Диск' : /docs\.google/.test(url) ? 'Google Таблицы' : 'по ссылке';
  const price = parseWorkbook(buf, name + ' (' + src + ')');
  price.meta.link = url;
  const s = readJson(SETTINGS_JSON(), {}); s.link = url; writeJson(SETTINGS_JSON(), s);
  return savePrice(price, 'link');
});

ipcMain.handle('price:reset', () => savePrice(parseWorkbook(fs.readFileSync(DEFAULT_XLSX), 'prays_karkas.xlsx (встроенный)'), 'builtin'));

ipcMain.handle('price:saveTemplate', async () => {
  const r = await dialog.showSaveDialog(win, { title: 'Сохранить шаблон прайса', defaultPath: 'prays_karkas.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }] });
  if (r.canceled) return { canceled: true };
  fs.copyFileSync(DEFAULT_XLSX, r.filePath);
  return { path: r.filePath };
});

ipcMain.handle('settings:get', () => readJson(SETTINGS_JSON(), {}));
ipcMain.handle('settings:set', (_e, s) => { writeJson(SETTINGS_JSON(), Object.assign(readJson(SETTINGS_JSON(), {}), s)); return true; });

// Сохранённые расчёты клиентов
ipcMain.handle('calc:list', () => {
  try {
    return fs.readdirSync(CALCS_DIR()).filter(f => f.endsWith('.json'))
      .map(f => Object.assign({ file: f }, (readJson(path.join(CALCS_DIR(), f), {}).head) || {}))
      .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  } catch { return []; }
});
ipcMain.handle('calc:save', (_e, data) => {
  const file = path.basename(data.file || ('calc-' + Date.now() + '.json'));
  writeJson(path.join(CALCS_DIR(), file), Object.assign({}, data, { file }));
  return file;
});
ipcMain.handle('calc:open', (_e, file) => readJson(path.join(CALCS_DIR(), path.basename(file)), null));
ipcMain.handle('calc:delete', (_e, file) => { fs.rmSync(path.join(CALCS_DIR(), path.basename(file)), { force: true }); return true; });

// Экспорт сметы в Excel
ipcMain.handle('export:xlsx', async (_e, { fileName, sheets }) => {
  const r = await dialog.showSaveDialog(win, { title: 'Экспорт сметы в Excel', defaultPath: fileName + '.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }] });
  if (r.canceled) return { canceled: true };
  const wb = XLSX.utils.book_new();
  sheets.forEach(s => {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    if (s.cols) ws['!cols'] = s.cols.map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  });
  XLSX.writeFile(wb, r.filePath);
  shell.showItemInFolder(r.filePath);
  return { path: r.filePath };
});

// Экспорт сметы в PDF: печатаем подготовленный HTML в скрытом окне
ipcMain.handle('export:pdf', async (_e, { fileName, html }) => {
  const r = await dialog.showSaveDialog(win, { title: 'Сохранить смету в PDF', defaultPath: fileName + '.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (r.canceled) return { canceled: true };
  const tmp = path.join(USER(), 'print.html');
  fs.writeFileSync(tmp, html, 'utf8');
  const pw = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await pw.loadFile(tmp);
  const pdf = await pw.webContents.printToPDF({ pageSize: 'A4', printBackground: true,
    margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 } });
  pw.destroy();
  fs.writeFileSync(r.filePath, pdf);
  shell.openPath(r.filePath);
  return { path: r.filePath };
});

ipcMain.handle('app:info', () => ({ version: app.getVersion(), userData: USER() }));
ipcMain.handle('app:openData', () => shell.openPath(USER()));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
