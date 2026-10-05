// Мост между окном и главным процессом: только нужные функции, без доступа к node.
const { contextBridge, ipcRenderer } = require('electron');

const call = (ch, ...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('api', {
  getPrice: () => call('price:get'),
  loadFile: () => call('price:loadFile'),
  loadLink: url => call('price:loadLink', url),
  resetPrice: () => call('price:reset'),
  saveTemplate: () => call('price:saveTemplate'),
  getSettings: () => call('settings:get'),
  setSettings: s => call('settings:set', s),
  listCalcs: () => call('calc:list'),
  saveCalc: d => call('calc:save', d),
  openCalc: f => call('calc:open', f),
  deleteCalc: f => call('calc:delete', f),
  exportXlsx: d => call('export:xlsx', d),
  exportPdf: d => call('export:pdf', d),
  info: () => call('app:info'),
  openData: () => call('app:openData'),
});
