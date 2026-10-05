/* Интерфейс калькулятора: шаги расчёта, итог, прайс, сохранённые расчёты. */
(function () {
  'use strict';
  const E = window.Engine;
  const api = window.api;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const fmt = E.fmt;
  const rub = n => fmt(n) + ' ₽';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));

  const LEVELS = { min: 'Минимальные цены', base: 'Базовые цены', max: 'Максимальные цены' };
  const LEVELS_SHORT = { min: 'Эконом', base: 'Базовый', max: 'Максимум' };

  const S = {
    price: null, index: null, input: clone(E.DEFAULT_INPUT), step: 0, res: null, lastTotal: 0,
    savedFile: null, view: 'home', priceFilter: { q: '', sec: 'all', status: 'all' },
  };

  // ---------- утилиты состояния ----------
  const getP = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setP = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => (a[k] = a[k] || {}), o)[last] = v; };
  const it = key => S.index && S.index.found[key];
  const unitShort = u => String(u || '').replace('площади дома', 'дома').replace('комплект на дом', 'компл.');
  function ph(key, mult) {
    const x = it(key);
    if (!x) return '<span style="color:var(--bad)">нет в прайсе</span>';
    const k = Number(S.input.regionK) > 0 ? Number(S.input.regionK) : 1;
    const v = x[S.input.priceLevel || 'base'] * k * (mult || 1);
    return (/%/.test(x.unit) ? fmt(v, 1) + ' %' : fmt(v) + ' ₽') + ' / ' + esc(unitShort(x.unit));
  }

  // ---------- тосты, модалки, подсказки ----------
  function toast(msg, err) {
    const t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.innerHTML = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, err ? 6500 : 3200);
  }
  function modal(html, bind) {
    $('#modalBox').innerHTML = html;
    $('#modal').classList.add('show');
    const close = () => $('#modal').classList.remove('show');
    $$('[data-close]', $('#modalBox')).forEach(b => b.onclick = close);
    if (bind) bind($('#modalBox'), close);
  }
  $('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') $('#modal').classList.remove('show'); });
  function confirmBox(title, text, okText, onOk) {
    modal(`<h3>${title}</h3><p>${text}</p><div class="row"><button class="btn ghost" data-close>Отмена</button>
      <button class="btn primary" id="mOk">${okText}</button></div>`, (b, close) => { $('#mOk', b).onclick = () => { close(); onOk(); }; });
  }
  const tip = $('#tip');
  document.addEventListener('mousemove', e => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { tip.classList.remove('show'); return; }
    tip.innerHTML = t.getAttribute('data-tip');
    tip.classList.add('show');
    const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 10);
    tip.style.left = x + 'px'; tip.style.top = (e.clientY + 16) + 'px';
  });
  // «волна» по нажатию на кнопки
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('.btn, .opt, .chip');
    if (!b) return;
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height);
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.style.overflow = 'hidden';
    b.appendChild(s);
    setTimeout(() => s.remove(), 600);
  });
  async function busy(btn, fn) {
    btn && btn.classList.add('loading');
    try { return await fn(); } finally { btn && btn.classList.remove('loading'); }
  }

  // ---------- навигация ----------
  function go(view) {
    S.view = view;
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
    $('#main').scrollTop = 0;
    if (view === 'result') renderResult();
    if (view === 'price') renderPrice();
    if (view === 'saved') renderSaved();
    if (view === 'home') renderHome();
    if (view === 'calc') renderStep();
  }
  $$('.nav-btn').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
  document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) go(g.dataset.go); });

  // ---------- прайс ----------
  function setPrice(p) {
    S.price = p;
    S.index = E.buildIndex(p.items);
    S.price.index = S.index;
    const m = p.meta || {};
    $('#dcFile').textContent = m.fileName || '—';
    const d = m.loadedAt ? new Date(m.loadedAt) : null;
    $('#dcMeta').textContent = `${p.items.length} позиций · ${d ? d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''}`;
    $('#navCount').textContent = p.items.length;
    recalc();
    if (S.view === 'price') renderPrice();
    if (S.view === 'home') renderHome();
    if (S.view === 'calc') renderStep();
  }
  function afterLoad(p) {
    if (!p || p.canceled) return;
    setPrice(p);
    const miss = (p.meta && p.meta.missing) || [];
    toast(`<b>Прайс загружен:</b> ${p.items.length} позиций. Расчёт обновлён.` +
      (miss.length ? `<br><span style="color:var(--warn)">Не найдено ${miss.length} позиций для расчёта — см. раздел «Прайс».</span>` : ''));
  }
  async function loadFile(btn) {
    try { afterLoad(await busy(btn, () => api.loadFile())); } catch (e) { toast('<b>Не удалось загрузить таблицу.</b><br>' + esc(cleanErr(e)), true); }
  }
  const cleanErr = e => String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  async function linkDialog() {
    const s = await api.getSettings();
    modal(`<h3>Обновить прайс по ссылке</h3>
      <p>Вставьте публичную ссылку на файл .xlsx на Яндекс.Диске (доступ «для всех, у кого есть ссылка»). Подойдёт и Google Таблица или прямая ссылка на файл.</p>
      <input class="inp" id="mLink" placeholder="https://disk.yandex.ru/i/…" value="${esc(s.link || '')}">
      <div class="row"><button class="btn ghost" data-close>Отмена</button><button class="btn primary" id="mGo">Загрузить</button></div>`,
    (b, close) => {
      const inp = $('#mLink', b); inp.focus(); inp.select();
      const run = async () => {
        try { const p = await busy($('#mGo', b), () => api.loadLink(inp.value)); close(); afterLoad(p); }
        catch (e) { toast('<b>Ошибка загрузки по ссылке.</b><br>' + esc(cleanErr(e)), true); }
      };
      $('#mGo', b).onclick = run;
      inp.onkeydown = e => { if (e.key === 'Enter') run(); };
    });
  }
  $('#btnLoad').onclick = e => loadFile(e.currentTarget);
  $('#btnLink').onclick = linkDialog;

  // ---------- схема шагов ----------
  const T = (p, key, l, s, show) => ({ t: 'toggle', p, key, l, s, show });
  const STEPS = [
    { id: 'obj', title: 'Объект', cards: [
      { title: 'Клиент', sub: 'Попадёт в шапку сметы и в карточку сохранённого расчёта', fields: [
        { t: 'text', p: 'client.name', l: 'Клиент', ph: 'ФИО или компания' },
        { t: 'text', p: 'client.phone', l: 'Телефон', ph: '+7 …' },
        { t: 'text', p: 'client.address', l: 'Адрес участка', ph: 'Населённый пункт, участок', w: 1 },
        { t: 'text', p: 'client.note', l: 'Пожелания клиента', ph: 'Например: большая кухня-гостиная, котельная, въезд для техники', w: 1 },
      ] },
      { title: 'Параметры дома', sub: 'Основа расчёта: от площади зависят объёмы материалов и работ', fields: [
        { t: 'slider', p: 'area', l: 'Общая площадь дома', u: 'м²', min: 30, max: 400, step: 1, w: 1 },
        { t: 'seg', p: 'floors', l: 'Этажность', o: [['1', '1 этаж'], ['1.5', 'С мансардой'], ['2', '2 этажа']] },
        { t: 'seg', p: 'priceLevel', l: 'Уровень цен', o: [['min', 'Мин.'], ['base', 'Базовый'], ['max', 'Макс.']] },
        { t: 'seg', p: 'roofType', l: 'Форма крыши', w: 1, o: [['gable', 'Двускатная'], ['hip', 'Вальмовая'], ['shed', 'Односкатная'], ['flat', 'Плоская']] },
        { t: 'num', p: 'buildMonths', l: 'Срок строительства', u: 'мес.', min: 1, hint: 'для аренды туалета' },
      ], geo: true },
      { title: 'Геометрия дома', sub: 'Считается автоматически из площади. Если размеры есть в проекте — впишите свои.', fields: [
        { t: 'auto', p: 'geo.perimeter', l: 'Периметр дома', u: 'м', a: r => r.geometry.Pauto },
        { t: 'auto', p: 'geo.wallArea', l: 'Площадь наружных стен', u: 'м²', a: r => r.geometry.wallAuto },
        { t: 'auto', p: 'geo.roofArea', l: 'Площадь кровли', u: 'м²', a: r => r.geometry.roofAuto },
        { t: 'auto', p: 'geo.glazing', l: 'Площадь остекления', u: 'м²', a: r => r.geometry.glazingAuto },
      ] },
    ] },
    { id: 'site', title: 'Участок', cards: [
      { title: 'Изыскания и проект', sub: 'Что нужно сделать до начала стройки', toggles: [
        T('prep.topo', 'topo', 'Топографическая съёмка'), T('prep.geo', 'geo', 'Геология участка', '2–3 скважины'),
        T('prep.engProject', 'projEng', 'Проект инженерных систем', 'электрика, вода, отопление, вентиляция'),
      ], fields: [
        { t: 'opts', p: 'prep.project', l: 'Архитектурный проект', w: 1, o: [
          { v: 'typ', l: 'Типовой проект', s: 'Готовый проект с адаптацией', k: 'projTyp' },
          { v: 'ind', l: 'Индивидуальный', s: 'Архитектура + конструктив', k: 'projInd' },
          { v: 'none', l: 'Проект есть у клиента', s: 'Не включать в смету' }] },
      ] },
      { title: 'Подготовка участка', fields: [
        { t: 'num', p: 'prep.clearM2', l: 'Расчистка участка', u: 'м²', k: 'clear' },
        { t: 'num', p: 'prep.stumps', l: 'Корчевание деревьев', u: 'шт.', k: 'stump' },
        { t: 'auto', p: 'prep.containers', l: 'Вывоз мусора', u: 'конт.', k: 'trash', a: r => Math.ceil(r.geometry.A / 60) },
      ] },
      { title: 'Временная инфраструктура', toggles: [
        T('prep.tmpPower', 'tmpPower', 'Временное электричество', 'щит, кабель, заземление'),
        T('prep.cabin', 'cabin', 'Бытовка для бригады'),
        T('prep.toilet', 'toilet', 'Временный туалет', 'на весь срок стройки'),
      ] },
    ] },
    { id: 'found', title: 'Фундамент', cards: [
      { title: 'Тип фундамента', sub: 'Цена рядом — за единицу по выбранному уровню цен', fields: [
        { t: 'opts', p: 'found.type', w: 1, o: [
          { v: 'screw89', l: 'Винтовые сваи 89 мм', s: 'Лёгкие дома и бани', k: 'pile89' },
          { v: 'screw108', l: 'Винтовые сваи 108 мм', s: 'Оптимально для каркаса', k: 'pile108' },
          { v: 'screw133', l: 'Винтовые сваи 133 мм', s: 'Повышенная нагрузка', k: 'pile133' },
          { v: 'rc', l: 'ЖБ сваи', s: 'Пересчёт по эталонам 79 и 154 м²', k: 'rc79' },
          { v: 'slab', l: 'Монолитная плита', s: '200–300 мм, сложные грунты', k: 'slab' },
          { v: 'ushp', l: 'УШП', s: 'Утеплённая шведская плита', k: 'ushp' }] },
      ] },
      { title: 'Параметры фундамента', fields: [
        { t: 'auto', p: 'found.piles', l: 'Количество свай', u: 'шт.', a: r => Math.ceil(r.geometry.S / r.norms.pileStep), show: i => i.found.type.startsWith('screw') },
        { t: 'auto', p: 'found.excavShifts', l: 'Экскаватор', u: 'смен', k: 'excav', a: () => 1, show: i => ['slab', 'ushp'].includes(i.found.type) },
        { t: 'auto', p: 'found.vibroDays', l: 'Виброплита', u: 'сут.', k: 'vibro', a: () => 3, show: i => ['slab', 'ushp'].includes(i.found.type) },
      ], toggles: [
        T('found.blind', 'blind', 'Утеплённая отмостка', 'по периметру, ширина 1 м'),
        T('found.drain', 'drain', 'Кольцевой дренаж', 'для влажных участков'),
        T('found.xps', 'xps', 'Утепление плиты XPS', null, i => i.found.type === 'slab'),
      ] },
    ] },
    { id: 'box', title: 'Каркас', cards: [
      { title: 'Каркас и перекрытия', sub: 'Сборка каркаса, доска, ОСП, крепёж и антисептик считаются всегда', toggles: [
        T('frame.floorOsb', 'osb22', 'Черновые полы ОСП 22 мм', 'пол 1 этажа на сваях и перекрытия'),
        T('frame.quickdeck', 'quickdeck', 'Плиты QuickDeck', 'монтаж на перекрытия'),
        T('frame.innerSeparate', 'innerFrame', 'Внутренние стены отдельной строкой', 'если бригада считает их отдельно'),
      ] },
      { title: 'Утепление', fields: [
        { t: 'opts', p: 'insul.material', w: 1, o: [
          { v: 'wool', l: 'Базальтовая вата', s: 'Плиты 35–50 кг/м³, монтаж по толщине', k: 'wool' },
          { v: 'eco', l: 'Эковата', s: 'Задувка спецоборудованием', k: 'eco' }] },
        { t: 'seg', p: 'insul.wallThk', l: 'Толщина утепления стен', w: 1, o: [[150, '150 мм'], [200, '200 мм'], [250, '250 мм']] },
      ] },
    ] },
    { id: 'roof', title: 'Кровля', cards: [
      { title: 'Кровельное покрытие', fields: [
        { t: 'opts', p: 'roof.cover', w: 1, o: [
          { v: 'prof', l: 'Профнастил', s: 'Бюджетно и быстро', k: 'profnastil' },
          { v: 'metal', l: 'Металлочерепица', s: 'Самый частый выбор', k: 'metalTile' },
          { v: 'soft', l: 'Гибкая черепица', s: '+ сплошной настил ОСП 9 мм', k: 'softTile' }] },
      ], toggles: [
        T('roof.gutter', 'gutter', 'Водосточная система', 'материал + монтаж'),
        T('roof.snow', 'snowTube', 'Снегозадержатели', 'трубчатые, по длине ската'),
      ] },
      { title: 'Фасад', fields: [
        { t: 'opts', p: 'facade.type', w: 1, o: [
          { v: 'vinyl', l: 'Виниловый сайдинг', s: 'С монтажом', k: 'vinyl' },
          { v: 'fibro', l: 'Фиброцемент', s: 'С монтажом', k: 'fibro' },
          { v: 'imitation', l: 'Имитация бруса', s: 'Дерево, с монтажом', k: 'imitation' },
          { v: 'plaster', l: 'Штукатурка', s: 'По утеплителю', k: 'plaster' }] },
      ], toggles: [
        T('facade.paint', 'woodPaint', 'Подготовка и окраска в 2 слоя', 'для имитации бруса', i => i.facade.type === 'imitation'),
      ] },
    ] },
    { id: 'fin', title: 'Отделка', cards: [
      { title: 'Окна и двери', fields: [
        { t: 'auto', p: 'geo.glazing', l: 'Площадь остекления', u: 'м²', k: 'windows', a: r => r.geometry.glazingAuto },
        { t: 'num', p: 'win.entry', l: 'Входные двери', u: 'шт.', k: 'entryDoor' },
        { t: 'num', p: 'win.terrace', l: 'Террасные двери', u: 'шт.', k: 'terraceDoor' },
        { t: 'auto', p: 'win.inner', l: 'Межкомнатные двери', u: 'шт.', k: 'innerDoor', a: r => Math.ceil(r.geometry.A / 20), show: i => i.finish.mode !== 'none' },
      ] },
      { title: 'Внутренняя отделка', fields: [
        { t: 'opts', p: 'finish.mode', w: 1, o: [
          { v: 'none', l: 'Без отделки', s: 'Тёплый контур' },
          { v: 'basic', l: 'Базовая', s: 'ГКЛ, покраска, ламинат', k: 'finBasic' },
          { v: 'mid', l: 'Средняя', s: 'Улучшенные материалы', k: 'finMid' },
          { v: 'prem', l: 'Премиальная', s: 'Дизайнерские решения', k: 'finPrem' },
          { v: 'items', l: 'Поэлементно', s: 'ГКЛ, покраска, ламинат, плитка, потолки' }] },
        { t: 'num', p: 'finish.baths', l: 'Санузлов', u: 'шт.', hint: 'плитка, гидроизоляция, сантехника' },
      ] },
    ] },
    { id: 'eng', title: 'Инженерия', cards: [
      { title: 'Электрика', fields: [
        { t: 'seg', p: 'elec.mode', l: 'Расчёт', w: 1, o: [['kit', 'Комплектом'], ['items', 'Поэлементно'], ['none', 'Не нужна']] },
      ], toggles: [T('elec.connect', 'elConnect', 'Подключение к сети 15 кВт', 'технологическое присоединение')] },
      { title: 'Отопление', fields: [
        { t: 'opts', p: 'heat.system', w: 1, o: [
          { v: 'none', l: 'Без отопления' },
          { v: 'gas', l: 'Газовое', s: 'Котёл, радиаторы, дымоход', k: 'gasBoiler' },
          { v: 'el', l: 'Электрическое', s: 'Котёл, радиаторы или тёплый пол', k: 'elBoiler' },
          { v: 'hp', l: 'Тепловой насос', s: 'Воздух–вода', k: 'hp' }] },
        { t: 'seg', p: 'heat.mode', l: 'Расчёт', w: 1, o: [['items', 'Поэлементно'], ['kit', 'Комплектом']], show: i => i.heat.system !== 'none' },
      ] },
      { title: 'Вода и канализация', fields: [
        { t: 'seg', p: 'water.mode', l: 'Расчёт', w: 1, o: [['items', 'Поэлементно'], ['kit', 'Комплектом'], ['none', 'Не нужно']] },
      ], toggles: [
        T('water.well', 'well', 'Скважина на воду', null, i => i.water.mode === 'items'),
        T('water.treat', 'waterTreat', 'Водоподготовка', 'фильтры', i => i.water.mode === 'items'),
        T('water.septic', 'septic', 'Септик / станция очистки', null, i => i.water.mode === 'items'),
      ] },
      { title: 'Вентиляция', fields: [
        { t: 'opts', p: 'vent.type', w: 1, o: [
          { v: 'none', l: 'Не нужна' },
          { v: 'natural', l: 'Естественная', s: 'Приточные клапаны и каналы', k: 'ventNat' },
          { v: 'recup', l: 'С рекуперацией', s: 'Приточно-вытяжная установка', k: 'recup' }] },
        { t: 'seg', p: 'vent.mode', l: 'Расчёт', w: 1, o: [['items', 'Поэлементно'], ['kit', 'Комплектом']], show: i => i.vent.type === 'recup' },
      ] },
    ] },
    { id: 'extra', title: 'Логистика', cards: [
      { title: 'Дополнительные конструкции', fields: [
        { t: 'num', p: 'extra.terrace', l: 'Терраса', u: 'м²', k: 'terrace' },
        { t: 'num', p: 'extra.balcony', l: 'Балкон', u: 'м²', k: 'balcony' },
        { t: 'num', p: 'extra.carport', l: 'Навес для авто', u: 'м²', k: 'carport' },
        { t: 'num', p: 'extra.storm', l: 'Ливневая канализация', u: 'пог. м', k: 'storm' },
        { t: 'num', p: 'extra.leveling', l: 'Выравнивание участка', u: 'м²', k: 'leveling' },
      ], toggles: [T('extra.porch', 'porch', 'Крыльцо с навесом')] },
      { title: 'Доставка и техника', fields: [
        { t: 'auto', p: 'logi.deliveries', l: 'Доставка материалов', u: 'рейсов', k: 'delivery', a: r => Math.ceil(r.geometry.A / 40) + 1 },
        { t: 'num', p: 'logi.manip', l: 'Манипулятор', u: 'смен', k: 'manip' },
        { t: 'num', p: 'logi.crane', l: 'Автокран', u: 'смен', k: 'crane' },
      ], toggles: [T('logi.cleanup', 'cleanup', 'Финальная уборка и вывоз остатков')] },
      { title: 'Проценты, наценка, регион', sub: 'Накладные и надзор — от строительной сметы, резерв — от общей', fields: [
        { t: 'auto', p: 'logi.overheadPct', l: 'Накладные расходы', u: '%', a: () => pctOf('overhead') },
        { t: 'auto', p: 'logi.supervisionPct', l: 'Технический надзор', u: '%', a: () => pctOf('supervision'), show: i => i.logi.supervision },
        { t: 'auto', p: 'logi.reservePct', l: 'Резерв', u: '%', a: () => pctOf('reserve'), show: i => i.logi.reserve },
        { t: 'num', p: 'regionK', l: 'Региональный коэффициент', u: '×', step: 0.05, min: 0.5, hint: '1 — цены прайса' },
        { t: 'num', p: 'markup', l: 'Наценка компании', u: '%' },
        { t: 'num', p: 'discount', l: 'Скидка клиенту', u: '%' },
      ], toggles: [
        T('logi.supervision', 'supervision', 'Независимый технадзор'),
        T('logi.reserve', 'reserve', 'Резерв на непредвиденное'),
      ] },
    ] },
  ];
  const pctOf = k => { const x = it(k); return x ? x[S.input.priceLevel || 'base'] : 0; };

  // ---------- построение шага ----------
  let controls = [];
  function renderStepper() {
    $('#stepper').innerHTML = STEPS.map((s, i) =>
      `<button class="step-chip ${i === S.step ? 'active' : ''} ${i < S.step ? 'done' : ''}" data-step="${i}"><i>${i < S.step ? '✓' : i + 1}</i>${s.title}</button>`).join('');
    $$('.step-chip').forEach(b => b.onclick = () => { S.step = +b.dataset.step; renderStep(); });
    $('#progress').style.width = ((S.step + 1) / STEPS.length * 100) + '%';
    $('#btnPrev').style.visibility = S.step === 0 ? 'hidden' : 'visible';
    $('#btnNext').innerHTML = S.step === STEPS.length - 1 ? 'Показать итог →' : 'Далее →';
  }
  function renderStep() {
    renderStepper();
    controls = [];
    const step = STEPS[S.step];
    const wrap = document.createElement('div');
    wrap.className = 'step active';
    step.cards.forEach(c => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<h3>${c.title}</h3>${c.sub ? `<p class="sub">${c.sub}</p>` : '<div style="height:12px"></div>'}`;
      if (c.fields) {
        const f = document.createElement('div');
        f.className = 'fields';
        c.fields.forEach(d => f.appendChild(buildField(d)));
        card.appendChild(f);
      }
      if (c.toggles) {
        const tg = document.createElement('div');
        tg.className = 'tgls';
        if (c.fields) tg.style.marginTop = '16px';
        c.toggles.forEach(d => tg.appendChild(buildToggle(d)));
        card.appendChild(tg);
      }
      if (c.geo) {
        const g = document.createElement('div');
        g.className = 'geo-box';
        card.appendChild(g);
        controls.push({ update() {
          const r = S.res.geometry;
          g.innerHTML = [['Пятно застройки', fmt(r.S, 1) + ' м²'], ['Размер в плане', fmt(r.L, 1) + ' × ' + fmt(r.w, 1) + ' м'],
            ['Площадь фасада', fmt(r.facade, 1) + ' м²'], ['Высота стен', fmt(r.H, 1) + ' м']]
            .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
        } });
      }
      wrap.appendChild(card);
    });
    $('#steps').innerHTML = '';
    $('#steps').appendChild(wrap);
    refresh();
  }
  function fieldShell(d, inner) {
    const el = document.createElement('div');
    el.className = 'field' + (d.w ? ' wide' : '');
    if (d.l) el.innerHTML = `<div class="flabel"><span>${d.l}</span><span class="hint" data-hint></span></div>`;
    el.insertAdjacentHTML('beforeend', inner);
    return el;
  }
  function change(p, v) { setP(S.input, p, v); recalc(); refresh(); }
  function buildField(d) {
    let el;
    const cur = () => getP(S.input, d.p);
    const hintText = () => (d.k ? ph(d.k) : d.hint || '');
    if (d.t === 'text') {
      el = fieldShell(d, `<input class="inp" placeholder="${esc(d.ph || '')}">`);
      const i = $('input', el); i.value = cur() || '';
      i.oninput = () => { setP(S.input, d.p, i.value); save(); };
    } else if (d.t === 'num') {
      el = fieldShell(d, `<div class="unit-wrap"><input class="inp num" type="number" min="${d.min != null ? d.min : 0}" step="${d.step || 1}"><span class="unit">${d.u || ''}</span></div>`);
      const i = $('input', el); i.value = cur();
      i.oninput = () => change(d.p, i.value === '' ? 0 : Number(i.value));
    } else if (d.t === 'slider') {
      el = fieldShell(d, `<div class="slider-row"><input type="range" min="${d.min}" max="${d.max}" step="${d.step}">
        <div class="unit-wrap"><input class="inp num" type="number" min="${d.min}"><span class="unit">${d.u}</span></div></div>`);
      const r = $('input[type=range]', el), n = $('input[type=number]', el);
      const paint = () => r.style.setProperty('--p', ((r.value - d.min) / (d.max - d.min) * 100) + '%');
      r.value = n.value = cur(); paint();
      r.oninput = () => { n.value = r.value; paint(); change(d.p, Number(r.value)); };
      n.oninput = () => { if (n.value === '') return; r.value = n.value; paint(); change(d.p, Math.max(10, Number(n.value))); };
    } else if (d.t === 'seg') {
      el = fieldShell(d, `<div class="seg"><span class="pill"></span>${d.o.map(([v, l]) => `<button data-v="${v}">${l}</button>`).join('')}</div>`);
      const btns = $$('button', el), pill = $('.pill', el);
      btns.forEach(b => b.onclick = () => change(d.p, typeof d.o[0][0] === 'number' ? Number(b.dataset.v) : b.dataset.v));
      controls.push({ update() {
        const v = String(cur());
        btns.forEach(b => b.classList.toggle('on', b.dataset.v === v));
        const on = btns.find(b => b.dataset.v === v);
        if (on && on.offsetWidth) { pill.style.left = on.offsetLeft + 'px'; pill.style.width = on.offsetWidth + 'px'; pill.style.opacity = 1; }
        else if (on) requestAnimationFrame(() => { pill.style.left = on.offsetLeft + 'px'; pill.style.width = on.offsetWidth + 'px'; });
        else pill.style.opacity = 0;
      } });
    } else if (d.t === 'opts') {
      el = fieldShell(d, `<div class="opts">${d.o.map(o => `<button class="opt" data-v="${o.v}"><b>${o.l}</b>${o.s ? `<span>${o.s}</span>` : ''}${o.k ? '<div class="price"></div>' : ''}</button>`).join('')}</div>`);
      const btns = $$('.opt', el);
      btns.forEach(b => b.onclick = () => change(d.p, b.dataset.v));
      controls.push({ update() {
        btns.forEach((b, i) => {
          b.classList.toggle('on', b.dataset.v === String(cur()));
          const o = d.o[i];
          if (o.k) $('.price', b).innerHTML = o.k === 'rc79' ? rcHint() : ph(o.k);
        });
      } });
    } else if (d.t === 'auto') {
      el = fieldShell(d, `<div class="unit-wrap"><input class="inp num" type="number" min="0" step="any"><span class="unit">${d.u}</span></div>`);
      const i = $('input', el);
      const lbl = $('.flabel', el);
      const tag = document.createElement('span');
      lbl.firstElementChild.appendChild(document.createTextNode(' '));
      lbl.firstElementChild.appendChild(tag);
      const v0 = cur(); i.value = v0 == null ? '' : v0;
      i.oninput = () => change(d.p, i.value === '' ? null : Number(i.value));
      tag.onclick = () => { if (cur() != null) { i.value = ''; change(d.p, null); } };
      controls.push({ update() {
        const manual = cur() != null && cur() !== '';
        const a = d.a(S.res);
        i.placeholder = 'авто: ' + fmt(a, 1);
        tag.className = 'auto-tag' + (manual ? ' manual' : '');
        tag.textContent = manual ? 'вручную ✕' : 'авто';
        tag.title = manual ? 'Вернуть автоматический расчёт' : '';
      } });
    }
    const hintEl = $('[data-hint]', el);
    if (hintEl) controls.push({ update() { hintEl.innerHTML = hintText(); } });
    if (d.show) controls.push({ update() { el.style.display = d.show(S.input) ? '' : 'none'; } });
    return el;
  }
  function rcHint() {
    const a = it('rc79'), b = it('rc154');
    if (!a || !b) return '<span style="color:var(--bad)">нет в прайсе</span>';
    const l = S.input.priceLevel || 'base';
    return 'от ' + fmt(a[l] / 79) + ' ₽ / м² дома';
  }
  function buildToggle(d) {
    const el = document.createElement('div');
    el.className = 'tgl';
    el.innerHTML = `<div class="sw"></div><div class="t"><b>${d.l}</b>${d.s ? `<span>${d.s}</span>` : ''}</div><div class="p"></div>`;
    el.onclick = () => change(d.p, !getP(S.input, d.p));
    controls.push({ update() {
      el.classList.toggle('on', !!getP(S.input, d.p));
      $('.p', el).innerHTML = d.key ? ph(d.key) : '';
      if (d.show) el.style.display = d.show(S.input) ? '' : 'none';
    } });
    return el;
  }
  function refresh() { controls.forEach(c => c.update()); }

  $('#btnPrev').onclick = () => { if (S.step > 0) { S.step--; renderStep(); $('#main').scrollTop = 0; } };
  $('#btnNext').onclick = () => {
    if (S.step < STEPS.length - 1) { S.step++; renderStep(); $('#main').scrollTop = 0; }
    else go('result');
  };
  $('#btnStart').onclick = () => { S.step = 0; go('calc'); };
  $('#btnNew').onclick = newCalc;
  function newCalc() {
    confirmBox('Новый расчёт', 'Параметры текущего расчёта будут сброшены к значениям по умолчанию. Сохранённые расчёты клиентов останутся.', 'Начать заново', () => {
      S.input = clone(E.DEFAULT_INPUT); S.step = 0; S.savedFile = null; recalc(); go('calc'); toast('Начат новый расчёт');
    });
  }

  // ---------- пересчёт и правая панель ----------
  function recalc() {
    if (!S.price) return;
    S.res = E.calculate(S.price, S.input);
    renderSummary();
    save();
  }
  function save() { try { localStorage.setItem('calc.input', JSON.stringify(S.input)); localStorage.setItem('calc.file', S.savedFile || ''); } catch (e) { /* нет хранилища */ } }
  function animateNumber(el, from, to) {
    const t0 = performance.now(), dur = 450;
    const tick = t => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = rub(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function renderSummary() {
    const r = S.res, lv = r.level, t = r.totals;
    const total = t[lv].total;
    const maxSec = Math.max(1, ...r.bySection.map(s => s[lv]));
    const lo = t.min.total, hi = t.max.total;
    const pos = hi > lo ? (total - lo) / (hi - lo) * 100 : 50;
    $('#summary').innerHTML = `
      <div class="total-card">
        <div class="k">Стоимость дома · ${LEVELS[lv].toLowerCase()}</div>
        <div class="big money" id="bigTotal">${rub(S.lastTotal || total)}</div>
        <div class="m2">${fmt(r.perM2)} ₽ за м² · ${fmt(r.geometry.A)} м²</div>
        <div class="range">
          <div class="bar"><i style="left:${pos}%"></i></div>
          <div class="ends"><span>${fmt(lo / 1e6, 2)} млн</span><span>вилка по прайсу</span><span>${fmt(hi / 1e6, 2)} млн</span></div>
        </div>
      </div>
      <div class="actions">
        <button class="btn primary" data-act="result">Показать итог</button>
        <button class="btn" data-act="save">Сохранить</button>
        <button class="btn" data-act="new">Новый расчёт</button>
      </div>
      <div class="card" style="padding:16px 18px">
        <div class="row" style="justify-content:space-between;margin-bottom:12px"><b style="font-size:13.5px">По разделам</b>
          <span class="hint" style="color:var(--muted);font-size:12px">${r.lines.filter(l => !l.off).length} позиций</span></div>
        <div class="sec-bars">${r.bySection.filter(s => s[lv] > 0).map(s => `
          <div class="sb" data-tip="<b>${esc(s.name)}</b>${rub(s[lv])} · ${fmt(s[lv] / t[lv].build * 100, 1)}% строительной сметы<br><span>${s.count} поз. · вилка ${fmt(s.min)}–${fmt(s.max)} ₽</span>">
            <span class="n">${esc(s.name)}</span><span class="s money">${fmt(s[lv] / 1000)} тыс.</span>
            <span class="t"><i style="width:${s[lv] / maxSec * 100}%"></i></span></div>`).join('')}
        </div>
      </div>
`;
    const big = $('#bigTotal');
    if (S.lastTotal && S.lastTotal !== total) { animateNumber(big, S.lastTotal, total); big.classList.remove('bump'); void big.offsetWidth; big.classList.add('bump'); }
    S.lastTotal = total;
    $$('[data-act]', $('#summary')).forEach(b => b.onclick = () => ({ result: () => go('result'), save: saveCalc, new: newCalc })[b.dataset.act]());
  }

  // ---------- итог ----------
  function secName(id) { const s = E.SECTIONS.find(x => x.id === id); return s ? s.name : id; }
  function paramChips(r) {
    const i = r.input, g = r.geometry;
    const F = { screw89: 'винтовые сваи 89', screw108: 'винтовые сваи 108', screw133: 'винтовые сваи 133', rc: 'ЖБ сваи', slab: 'монолитная плита', ushp: 'УШП' };
    const C = { prof: 'профнастил', metal: 'металлочерепица', soft: 'гибкая черепица' };
    const FA = { vinyl: 'винил. сайдинг', fibro: 'фиброцемент', imitation: 'имитация бруса', plaster: 'штукатурка' };
    const FN = { none: 'без отделки', basic: 'отделка базовая', mid: 'отделка средняя', prem: 'отделка премиум', items: 'отделка поэлементно' };
    const H = { none: 'без отопления', gas: 'газ', el: 'электроотопление', hp: 'тепловой насос' };
    return [fmt(g.A) + ' м²', { 1: '1 этаж', 1.5: 'с мансардой', 2: '2 этажа' }[i.floors], 'крыша ' + E.ROOF_NAMES[i.roofType], F[i.found.type],
      (i.insul.material === 'eco' ? 'эковата ' : 'вата ') + i.insul.wallThk + ' мм', C[i.roof.cover], FA[i.facade.type], FN[i.finish.mode], H[i.heat.system],
      i.vent.type === 'recup' ? 'рекуперация' : null, i.regionK != 1 ? 'регион ×' + i.regionK : null].filter(Boolean);
  }
  function controlBlock(r) {
    const c = r.control;
    if (!c.length) return '';
    const lo = Math.min(...c.map(x => x.min)) * 0.8, hi = Math.max(...c.map(x => x.max), r.perM2) * 1.08;
    const X = v => ((v - lo) / (hi - lo) * 100);
    const colors = ['#3f7fcf', '#5aa9ff', '#a8d1ff'];
    const inside = c.find(x => r.perM2 >= x.min && r.perM2 <= x.max);
    const nb = r.nearestBudget;
    return `<div class="card">
      <div class="check"><div class="ic ${inside ? 'good' : 'warn'}">${inside ? '✓' : '!'}</div><div style="flex:1">
      <h3>Проверка по рынку: ${fmt(r.perM2)} ₽/м²</h3>
      <p class="sub" style="margin:2px 0 0">${inside ? 'Попадает в диапазон «' + esc(inside.name.replace('Каркасный дом под ключ, ', '')) + '».'
        : r.perM2 > c[c.length - 1].max ? 'Выше рыночных ориентиров «под ключ» — проверьте опции: в ориентиры обычно не входят участок, скважина, септик, технадзор и резерв.'
          : 'Ниже рыночных ориентиров — проверьте, всё ли включено.'}</p></div></div>
      <div class="ctl-scale">${c.map((x, i) => `<div class="zone" style="left:${X(x.min)}%;width:${X(x.max) - X(x.min)}%;background:${colors[i]};opacity:.75;${i ? 'top:' + (10 + i * 0) + 'px' : ''}"
        data-tip="<b>${esc(x.name)}</b>${fmt(x.min)}–${fmt(x.max)} ₽/м²"></div>`).join('')}
        <div class="me" style="left:${Math.min(99.5, X(r.perM2))}%"><span>ваш дом</span></div></div>
      <div class="legend">${c.map((x, i) => `<span><i style="background:${colors[i]}"></i>${esc(x.name.replace('Каркасный дом под ключ, ', ''))}: ${fmt(x.min / 1000)}–${fmt(x.max / 1000)} тыс.</span>`).join('')}</div>
      ${nb ? `<p class="sub" style="margin:14px 0 0">Ближайший контрольный бюджет: <b style="color:var(--text)">${esc(nb.name)}, ${fmt(nb.area)} м²</b> — ${fmt(nb.min / 1e6, 2)}–${fmt(nb.max / 1e6, 2)} млн ₽ (${esc(nb.note)})</p>` : ''}
    </div>`;
  }
  function renderResult() {
    const r = S.res, lv = r.level, t = r.totals[lv], c = S.input.client;
    const bySec = {};
    r.lines.forEach(l => (bySec[l.sec] = bySec[l.sec] || []).push(l));
    const maxSec = Math.max(1, ...r.bySection.map(s => s[lv]));
    let n = 0;
    const rows = E.SECTIONS.filter(s => bySec[s.id]).map(s => {
      const secSum = r.bySection.find(x => x.id === s.id)[lv];
      return `<tr class="sec"><td></td><td colspan="4">${esc(s.name)}</td><td class="r money">${rub(secSum)}</td></tr>` +
        bySec[s.id].map(l => `<tr class="${l.off ? 'off' : ''}">
          <td><span class="cb ${l.off ? '' : 'on'}" data-off="${l.key}" title="Включить / исключить из сметы"></span></td>
          <td>${++n}. ${esc(l.name)}${l.note ? `<span class="note">${esc(l.note)}</span>` : ''}</td>
          <td class="r"><input class="qty num ${l.overridden ? 'ovr' : ''}" data-qty="${l.key}" value="${l.qty}" title="${l.overridden ? 'Изменено вручную, авто: ' + l.qtyAuto : 'Можно изменить количество'}"></td>
          <td>${esc(l.unit)}</td>
          <td class="r money">${fmt(l.unitPrice)}</td>
          <td class="r money">${fmt(l.sum[lv])}</td></tr>`).join('');
    }).join('');
    const pctRows = r.percents.map(p => `<div><span>${esc(p.name)} (${fmt(p.pct, 1)}% ${p.base})</span><b class="money">${rub(p.sum)}</b></div>`).join('');
    $('#view-result').innerHTML = `
      <div class="page-head">
        <div><h1>Итог расчёта${c.name ? ' — ' + esc(c.name) : ''}</h1>
          <p>${c.address ? esc(c.address) + ' · ' : ''}${new Date().toLocaleDateString('ru-RU')} · прайс: ${esc(S.price.meta.fileName || '')}</p></div>
        <div class="row">
          <button class="btn ghost" data-go="calc">← Изменить параметры</button>
          <button class="btn" id="rRecalc">Пересчитать</button>
          <button class="btn" id="rSave">Сохранить</button>
          <button class="btn" id="rXlsx">Экспорт в Excel</button>
          <button class="btn primary" id="rPdf">Смета в PDF</button>
          <button class="btn ghost" id="rNew">Новый расчёт</button>
        </div>
      </div>
      <div class="chips-params" style="margin-bottom:16px">${paramChips(r).map(x => `<span>${esc(x)}</span>`).join('')}</div>
      ${r.warnings.length ? `<div class="warnbox" style="margin-bottom:16px">${r.warnings.map(esc).join('<br>')}</div>` : ''}
      <div class="levels">${['min', 'base', 'max'].map(v => `<div class="lvl ${v === lv ? 'on' : ''}" data-lvl="${v}">
        <div class="k">${LEVELS[v]}</div><div class="v money">${rub(r.totals[v].total)}</div>
        <div class="m">${fmt(r.totals[v].total / r.geometry.A)} ₽ за м²</div></div>`).join('')}</div>
      <div class="grid2" style="margin-top:16px">
        <div class="card"><h3>Структура стоимости</h3><p class="sub">Доля каждого раздела в строительной смете · ${LEVELS[lv].toLowerCase()}</p>
          <div class="sec-bars">${r.bySection.filter(s => s[lv] > 0).sort((a, b) => b[lv] - a[lv]).map(s => `
            <div class="sb" data-tip="<b>${esc(s.name)}</b>${rub(s[lv])}<br><span>${fmt(s[lv] / t.build * 100, 1)}% · ${s.count} поз.</span>">
            <span class="n">${esc(s.name)}</span><span class="s money">${rub(s[lv])} <span style="color:var(--muted);font-weight:400">· ${fmt(s[lv] / t.build * 100, 1)}%</span></span>
            <span class="t"><i style="width:${s[lv] / maxSec * 100}%"></i></span></div>`).join('')}</div></div>
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="card"><h3>Итого</h3><p class="sub">Как складывается сумма</p><div class="totals-list">
            <div><span>Строительная смета</span><b class="money">${rub(t.build)}</b></div>${pctRows}
            ${t.markup ? `<div><span>Наценка компании ${fmt(S.input.markup, 1)}%</span><b class="money">${rub(t.markup)}</b></div>` : ''}
            ${t.discount ? `<div><span>Скидка ${fmt(S.input.discount, 1)}%</span><b class="money">−${rub(t.discount)}</b></div>` : ''}
            <div class="grand"><span>Стоимость дома</span><b class="money">${rub(t.total)}</b></div></div></div>
          ${controlBlock(r)}
        </div>
      </div>
      <div class="card" style="margin-top:16px;padding:0;overflow:hidden">
        <div class="row" style="justify-content:space-between;padding:18px 20px 12px"><div><h3>Смета по позициям</h3>
          <p class="sub" style="margin:0">Галочка — включить или убрать строку. Количество можно поправить вручную (выделится цветом).</p></div>
          <button class="btn sm ghost" id="rResetOv" ${Object.keys(S.input.overrides).length ? '' : 'disabled'}>Сбросить ручные правки</button></div>
        <div class="tbl-wrap" style="border:0;border-top:1px solid var(--line);border-radius:0;max-height:none">
        <table class="tbl"><thead><tr><th style="width:36px"></th><th>Позиция</th><th class="r">Кол-во</th><th>Ед.</th><th class="r">Цена, ₽</th><th class="r">Сумма, ₽</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      </div>`;
    const v = $('#view-result');
    $$('[data-lvl]', v).forEach(b => b.onclick = () => { S.input.priceLevel = b.dataset.lvl; recalc(); renderResult(); });
    $$('[data-off]', v).forEach(b => b.onclick = () => {
      const k = b.dataset.off, o = S.input.overrides[k] = S.input.overrides[k] || {};
      if (o.off) delete o.off; else o.off = true;
      if (!Object.keys(o).length) delete S.input.overrides[k];
      recalc(); renderResult();
    });
    $$('[data-qty]', v).forEach(i => i.onchange = () => {
      const k = i.dataset.qty, val = E.num(i.value);
      const o = S.input.overrides[k] = S.input.overrides[k] || {};
      if (i.value.trim() === '' || !isFinite(val)) delete o.qty; else o.qty = val;
      if (!Object.keys(o).length) delete S.input.overrides[k];
      recalc(); renderResult();
    });
    $('#rResetOv').onclick = () => { S.input.overrides = {}; recalc(); renderResult(); toast('Ручные правки сброшены'); };
    $('#rRecalc').onclick = () => { recalc(); renderResult(); toast('Расчёт обновлён по текущему прайсу'); };
    $('#rSave').onclick = saveCalc;
    $('#rNew').onclick = newCalc;
    $('#rXlsx').onclick = e => exportXlsx(e.currentTarget);
    $('#rPdf').onclick = e => exportPdf(e.currentTarget);
  }

  // ---------- экспорт ----------
  const fileBase = () => 'Смета ' + (S.input.client.name || 'каркасный дом').replace(/[\\/:*?"<>|]/g, '').slice(0, 40) + ' ' + new Date().toLocaleDateString('ru-RU');
  async function exportXlsx(btn) {
    const r = S.res, lv = r.level, t = r.totals[lv], c = S.input.client;
    const head = [['Смета на строительство каркасного дома'], [],
      ['Клиент', c.name], ['Телефон', c.phone], ['Адрес участка', c.address], ['Пожелания', c.note],
      ['Параметры', paramChips(r).join(', ')], ['Уровень цен', LEVELS[lv]], ['Прайс', S.price.meta.fileName], ['Дата расчёта', new Date().toLocaleDateString('ru-RU')], []];
    const rows = [['№', 'Раздел', 'Позиция', 'Кол-во', 'Ед.', 'Цена, ₽', 'Сумма, ₽', 'Примечание']];
    let n = 0;
    r.lines.filter(l => !l.off).forEach(l => rows.push([++n, secName(l.sec), l.name, l.qty, l.unit, Math.round(l.unitPrice), l.sum[lv], l.note]));
    rows.push([], ['', '', 'Строительная смета', '', '', '', t.build]);
    r.percents.forEach(p => rows.push(['', '', p.name + ' (' + fmt(p.pct, 1) + '%)', '', '', '', p.sum]));
    if (t.markup) rows.push(['', '', 'Наценка компании', '', '', '', t.markup]);
    if (t.discount) rows.push(['', '', 'Скидка', '', '', '', -t.discount]);
    rows.push(['', '', 'ИТОГО', '', '', '', t.total], ['', '', 'Цена за м²', '', '', '', Math.round(r.perM2)]);
    const secs = [['Раздел', 'Мин. цены, ₽', 'Базовые цены, ₽', 'Макс. цены, ₽', 'Доля, %']].concat(
      r.bySection.filter(s => s.base > 0).map(s => [s.name, s.min, s.base, s.max, Math.round(s[lv] / t.build * 1000) / 10]),
      [[], ['Итого с процентами', r.totals.min.total, r.totals.base.total, r.totals.max.total]]);
    try {
      const res = await busy(btn, () => api.exportXlsx({ fileName: fileBase(), sheets: [
        { name: 'Смета', rows: head.concat(rows), cols: [6, 26, 56, 10, 14, 12, 14, 36] },
        { name: 'По разделам', rows: secs, cols: [34, 16, 16, 16, 10] }] }));
      if (!res.canceled) toast('Смета сохранена в Excel');
    } catch (e) { toast('Не удалось сохранить: ' + esc(cleanErr(e)), true); }
  }
  function pdfHtml() {
    const r = S.res, lv = r.level, t = r.totals[lv], c = S.input.client;
    const bySec = {};
    r.lines.filter(l => !l.off).forEach(l => (bySec[l.sec] = bySec[l.sec] || []).push(l));
    let n = 0;
    const body = E.SECTIONS.filter(s => bySec[s.id]).map(s => `<tr class="s"><td colspan="5">${esc(s.name)}</td><td class="r">${fmt(r.bySection.find(x => x.id === s.id)[lv])}</td></tr>` +
      bySec[s.id].map(l => `<tr><td>${++n}</td><td>${esc(l.name)}</td><td class="r">${fmt(l.qty, 1)}</td><td>${esc(l.unit)}</td><td class="r">${fmt(l.unitPrice)}</td><td class="r">${fmt(l.sum[lv])}</td></tr>`).join('')).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      body{font:11px/1.4 Arial,sans-serif;color:#1b1f27;margin:0}
      h1{font-size:20px;margin:0 0 4px}.muted{color:#6b7385}
      .top{display:flex;justify-content:space-between;border-bottom:3px solid #f3a93b;padding-bottom:12px;margin-bottom:14px}
      .tot{font-size:24px;font-weight:bold;text-align:right}.grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;margin-bottom:12px}
      table{width:100%;border-collapse:collapse}th{background:#f1f3f7;text-align:left;padding:6px;font-size:10px;color:#555}
      td{padding:5px 6px;border-bottom:1px solid #e6e8ee}.r{text-align:right;white-space:nowrap}tr.s td{background:#fff6e8;font-weight:bold}
      .sum{margin-left:auto;width:55%;margin-top:12px}.sum div{display:flex;justify-content:space-between;padding:3px 0}
      .sum .g{border-top:2px solid #1b1f27;font-size:15px;font-weight:bold;margin-top:4px;padding-top:6px}
      .levels{display:flex;gap:10px;margin:10px 0 14px}.levels div{flex:1;border:1px solid #e0e3ea;border-radius:8px;padding:8px}
      .levels .on{border-color:#f3a93b;background:#fff9ef}.levels b{display:block;font-size:14px}</style></head><body>
      <div class="top"><div><h1>Смета на каркасный дом</h1><div class="muted">${new Date().toLocaleDateString('ru-RU')} · прайс: ${esc(S.price.meta.fileName)}</div></div>
      <div><div class="muted" style="text-align:right">Итого (${LEVELS[lv].toLowerCase()})</div><div class="tot">${rub(t.total)}</div>
      <div class="muted" style="text-align:right">${fmt(r.perM2)} ₽ за м²</div></div></div>
      <div class="grid"><div><b>Клиент:</b> ${esc(c.name || '—')}</div><div><b>Телефон:</b> ${esc(c.phone || '—')}</div>
      <div><b>Адрес:</b> ${esc(c.address || '—')}</div><div><b>Параметры:</b> ${esc(paramChips(r).join(', '))}</div>
      ${c.note ? `<div style="grid-column:1/-1"><b>Пожелания:</b> ${esc(c.note)}</div>` : ''}</div>
      <div class="levels">${['min', 'base', 'max'].map(v => `<div class="${v === lv ? 'on' : ''}"><span class="muted">${LEVELS[v]}</span><b>${rub(r.totals[v].total)}</b></div>`).join('')}</div>
      <table><thead><tr><th>№</th><th>Позиция</th><th class="r">Кол-во</th><th>Ед.</th><th class="r">Цена, ₽</th><th class="r">Сумма, ₽</th></tr></thead><tbody>${body}</tbody></table>
      <div class="sum"><div><span>Строительная смета</span><b>${rub(t.build)}</b></div>
      ${r.percents.map(p => `<div><span>${esc(p.name)} (${fmt(p.pct, 1)}%)</span><b>${rub(p.sum)}</b></div>`).join('')}
      ${t.markup ? `<div><span>Наценка</span><b>${rub(t.markup)}</b></div>` : ''}${t.discount ? `<div><span>Скидка</span><b>−${rub(t.discount)}</b></div>` : ''}
      <div class="g"><span>ИТОГО</span><span>${rub(t.total)}</span></div></div>
      <p class="muted" style="margin-top:18px">Расчёт предварительный и основан на прайсе компании. Итоговая стоимость уточняется после выезда на участок и утверждения проекта.</p>
      </body></html>`;
  }
  async function exportPdf(btn) {
    try { const res = await busy(btn, () => api.exportPdf({ fileName: fileBase(), html: pdfHtml() })); if (!res.canceled) toast('PDF со сметой сохранён'); }
    catch (e) { toast('Не удалось сохранить PDF: ' + esc(cleanErr(e)), true); }
  }

  // ---------- сохранённые расчёты ----------
  async function saveCalc() {
    const r = S.res, c = S.input.client;
    const head = { client: c.name || 'Без имени', address: c.address, area: r.geometry.A, total: r.totals[r.level].total,
      level: r.level, savedAt: new Date().toISOString(), params: paramChips(r).slice(1, 6).join(', ') };
    S.savedFile = await api.saveCalc({ file: S.savedFile, head, input: S.input });
    save(); updateSavedCount();
    toast(`Расчёт «${esc(head.client)}» сохранён`);
  }
  async function updateSavedCount() { const l = await api.listCalcs(); $('#navSaved').textContent = l.length; return l; }
  async function renderSaved() {
    const list = await updateSavedCount();
    $('#view-saved').innerHTML = `<div class="page-head"><div><h1>Расчёты клиентов</h1><p>Сохранённые сметы — откройте, чтобы продолжить или пересчитать по новому прайсу</p></div>
      <button class="btn primary" id="sNew">Новый расчёт</button></div>
      ${list.length ? `<div class="saved">${list.map(x => `<div class="card" data-open="${esc(x.file)}">
        <div class="row" style="justify-content:space-between"><b>${esc(x.client)}</b><span class="tag">${new Date(x.savedAt).toLocaleDateString('ru-RU')}</span></div>
        <div class="v money">${rub(x.total)}</div><div style="color:var(--text2);font-size:12.5px">${fmt(x.area)} м² · ${esc(x.params || '')}</div>
        ${x.address ? `<div style="color:var(--muted);font-size:12px;margin-top:4px">${esc(x.address)}</div>` : ''}
        <div class="row" style="margin-top:14px"><button class="btn sm" data-o="${esc(x.file)}">Открыть</button>
        <button class="btn sm ghost danger" data-del="${esc(x.file)}">Удалить</button></div></div>`).join('')}</div>`
        : '<div class="empty">Пока нет сохранённых расчётов.<br>Нажмите «Сохранить» на панели итога.</div>'}`;
    $('#sNew').onclick = newCalc;
    $$('[data-open]').forEach(cd => cd.onclick = async e => {
      const del = e.target.closest('[data-del]');
      if (del) {
        confirmBox('Удалить расчёт?', 'Карточка расчёта будет удалена без возможности восстановления.', 'Удалить', async () => {
          await api.deleteCalc(del.dataset.del); if (S.savedFile === del.dataset.del) S.savedFile = null; renderSaved(); toast('Расчёт удалён');
        });
        return;
      }
      const d = await api.openCalc(cd.dataset.open);
      if (!d) return toast('Файл расчёта не найден', true);
      S.input = E.merge(clone(E.DEFAULT_INPUT), d.input); S.savedFile = d.file; S.lastTotal = 0;
      recalc(); go('result'); toast('Открыт расчёт «' + esc(d.head.client) + '» — пересчитан по текущему прайсу');
    });
  }

  // ---------- экран прайса ----------
  function renderPrice() {
    const p = S.price, m = p.meta || {}, f = S.priceFilter;
    const secs = [...new Set(p.items.map(i => i.section))];
    const statuses = [...new Set(p.items.map(i => i.status).filter(Boolean))];
    const miss = S.index.missing;
    $('#view-price').innerHTML = `<div class="page-head"><div><h1>Прайс</h1>
      <p>Файл: <b style="color:var(--text)">${esc(m.fileName)}</b> · ${p.items.length} позиций · ${secs.length} разделов · загружен ${m.loadedAt ? new Date(m.loadedAt).toLocaleString('ru-RU') : '—'}</p></div>
      <div class="row"><button class="btn primary" id="pLoad">Загрузить данные</button><button class="btn" id="pLink">По ссылке (Я.Диск)</button>
      <button class="btn ghost" id="pTpl">Скачать шаблон</button><button class="btn ghost" id="pReset">Встроенный прайс</button></div></div>
      ${miss.length ? `<div class="warnbox" style="margin-bottom:14px"><b>В загруженной таблице не найдено ${miss.length} позиций, нужных для расчёта:</b><br>${miss.map(x => esc(x.name)).join(', ')}.<br>Эти строки не попадут в смету. Верните их в таблицу с теми же названиями.</div>`
        : `<div class="card" style="padding:14px 18px;display:flex;gap:14px;align-items:center"><div class="check"><div class="ic good">✓</div></div>
        <div><b>Все позиции, нужные для расчёта (${Object.keys(E.REF).length}), найдены в прайсе.</b><div style="color:var(--muted);font-size:12.5px">Позиции ищутся по названию, поэтому строки можно переставлять и добавлять новые.</div></div></div>`}
      <div class="row" style="margin-top:16px"><div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input class="inp" id="pQ" placeholder="Поиск по названию, разделу, комментарию" value="${esc(f.q)}"></div>
        <select class="inp" id="pStatus" style="width:auto;min-width:200px"><option value="all">Все статусы</option>${statuses.map(s => `<option ${f.status === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
        <span id="pCount" style="color:var(--muted);font-size:12.5px"></span></div>
      <div class="filters" id="pChips"><button class="chip ${f.sec === 'all' ? 'on' : ''}" data-sec="all">Все<span class="c">${p.items.length}</span></button>
        ${secs.map(s => `<button class="chip ${f.sec === s ? 'on' : ''}" data-sec="${esc(s)}">${esc(s.replace(/^\d+\.\s*/, ''))}<span class="c">${p.items.filter(i => i.section === s).length}</span></button>`).join('')}</div>
      <div class="tbl-wrap" style="max-height:calc(100vh - 330px)"><table class="tbl"><thead><tr><th>ID</th><th>Раздел / подраздел</th><th>Наименование</th><th>Ед.</th>
        <th class="r">Мин., ₽</th><th class="r">Базовая, ₽</th><th class="r">Макс., ₽</th><th>Статус</th></tr></thead><tbody id="pBody"></tbody></table></div>`;
    const draw = () => {
      const q = f.q.toLowerCase();
      const list = p.items.filter(i => (f.sec === 'all' || i.section === f.sec) && (f.status === 'all' || i.status === f.status) &&
        (!q || (i.name + ' ' + i.section + ' ' + i.sub + ' ' + i.comment).toLowerCase().includes(q)));
      $('#pCount').textContent = 'Показано: ' + list.length;
      $('#pBody').innerHTML = list.map((i, k) => `<tr class="appear" style="animation-delay:${Math.min(k, 30) * 12}ms"><td class="num" style="color:var(--muted)">${esc(i.id)}</td>
        <td><span style="color:var(--text2)">${esc(i.section.replace(/^\d+\.\s*/, ''))}</span><span class="note">${esc(i.sub)}</span></td>
        <td>${esc(i.name)}${i.comment ? `<span class="note">${esc(i.comment)}</span>` : ''}</td><td>${esc(i.unit)}</td>
        <td class="r money">${fmt(i.min)}</td><td class="r money" style="color:var(--accent2)">${fmt(i.base)}</td><td class="r money">${fmt(i.max)}</td>
        <td><span class="tag ${/обязат/i.test(i.status) ? 'req' : /опци|вариант/i.test(i.status) ? 'optional' : ''}">${esc(i.status)}</span></td></tr>`).join('')
        || '<tr><td colspan="8"><div class="empty" style="border:0">Ничего не найдено</div></td></tr>';
    };
    draw();
    $('#pQ').oninput = e => { f.q = e.target.value; draw(); };
    $('#pStatus').onchange = e => { f.status = e.target.value; draw(); };
    $$('#pChips .chip').forEach(b => b.onclick = () => { f.sec = b.dataset.sec; $$('#pChips .chip').forEach(x => x.classList.toggle('on', x === b)); draw(); });
    $('#pLoad').onclick = e => loadFile(e.currentTarget);
    $('#pLink').onclick = linkDialog;
    $('#pTpl').onclick = async () => { const r = await api.saveTemplate(); if (!r.canceled) toast('Шаблон прайса сохранён: ' + esc(r.path)); };
    $('#pReset').onclick = () => confirmBox('Вернуть встроенный прайс?', 'Загруженный прайс будет заменён на прайс, поставляемый с приложением.', 'Вернуть',
      async () => { afterLoad(await api.resetPrice()); });
  }

  // ---------- главная ----------
  async function renderHome() {
    if (!S.price) return;
    const r = S.res;
    const list = await api.listCalcs();
    $('#homeStats').innerHTML = [
      ['Позиций в прайсе', S.price.items.length], ['Разделов', new Set(S.price.items.map(i => i.section)).size],
      ['Текущий расчёт', fmt(r.totals[r.level].total / 1e6, 2) + ' млн ₽'], ['Сохранено расчётов', list.length]]
      .map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v money">${v}</div></div>`).join('');
  }

  // ---------- запуск ----------
  (async function init() {
    try {
      const saved = localStorage.getItem('calc.input');
      if (saved) S.input = E.merge(clone(E.DEFAULT_INPUT), JSON.parse(saved));
      S.savedFile = localStorage.getItem('calc.file') || null;
    } catch (e) { /* пустое хранилище */ }
    try { setPrice(await api.getPrice()); } catch (e) { toast('Не удалось прочитать прайс: ' + esc(cleanErr(e)), true); }
    updateSavedCount();
    renderHome();
    window.addEventListener('resize', () => refresh());
  })();

  window.__app = { S, go, recalc };
})();
