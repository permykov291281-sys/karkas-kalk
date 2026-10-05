// Прописывает иконку и сведения о версии в .exe без Wine (сборка под Windows на Linux).
const path = require('path');
const fs = require('fs');


exports.default = async function (ctx) {
  const ResEdit = await import('resedit');
  if (ctx.electronPlatformName !== 'win32') return;
  const name = ctx.packager.appInfo.productFilename + '.exe';
  const exePath = path.join(ctx.appOutDir, name);
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const id = groups.length ? groups[0].id : 1;
  const lang = groups.length ? groups[0].lang : 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, id, lang, ico.icons.map(i => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
  if (vi) {
    const v = ctx.packager.appInfo.version.split('.').map(Number);
    vi.setFileVersion(v[0], v[1], v[2], 0, 1033);
    vi.setProductVersion(v[0], v[1], v[2], 0, 1033);
    vi.setStringValues({ lang: 1033, codepage: 1200 }, {
      FileDescription: 'КаркасКальк — калькулятор каркасного дома',
      ProductName: 'КаркасКальк', CompanyName: 'Пермяков Сергей', OriginalFilename: name, InternalName: 'KarkasCalc',
      LegalCopyright: '© 2026',
    });
    vi.outputToResourceEntries(res.entries);
  }
  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log('  • иконка и версия записаны в', name);
};
