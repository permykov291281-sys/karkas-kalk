// Собирает установщик Setup.exe из dist/win-unpacked через NSIS (makensis работает и на Linux, Wine не нужен).
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const { version } = require(path.join(root, 'package.json'));
const cache = path.join(os.homedir(), '.cache', 'electron-builder', 'nsis');
let nsisDir = null;
if (fs.existsSync(cache)) {
  const d = fs.readdirSync(cache).filter(n => /^nsis-\d/.test(n)).sort().pop();
  if (d) nsisDir = path.join(cache, d);
}
const makensis = nsisDir
  ? path.join(nsisDir, process.platform === 'win32' ? 'makensis.exe' : process.platform === 'darwin' ? 'mac/makensis' : 'linux/makensis')
  : 'makensis';
const out = path.join(root, 'dist', `KarkasCalc-Setup-${version}.exe`);
execFileSync(makensis, ['-V2', `-DVERSION=${version}`, `-DSRCDIR=${path.join(root, 'dist', 'win-unpacked')}`, `-DOUTFILE=${out}`,
  path.join(__dirname, 'installer.nsi')], { stdio: 'inherit', env: Object.assign({}, process.env, nsisDir ? { NSISDIR: nsisDir } : {}) });
console.log('Готово:', out, (fs.statSync(out).size / 1048576).toFixed(1) + ' МБ');
