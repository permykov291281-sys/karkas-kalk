/* Расчётное ядро калькулятора каркасного дома.
   Работает и в окне приложения (window.Engine), и в node (module.exports) — для тестов. */
(function (root) {
  'use strict';

  // Позиции прайса, которые использует расчёт. Ищем по названию (точно → по фрагменту), затем по ID.
  // Так прайс можно обновлять и переставлять строки: главное — не менять смысл названий.
  const REF = {
    topo: [1, 'Топографическая съёмка участка'], geo: [2, 'Инженерно-геологические изыскания'],
    projTyp: [3, 'Типовой архитектурный проект'], projInd: [4, 'Индивидуальный архитектурно-конструктивный проект'],
    projEng: [5, 'Проект инженерных систем'], clear: [6, 'Расчистка участка'], stump: [7, 'Корчевание дерева'],
    trash: [8, 'Вывоз мусора'], tmpPower: [9, 'Временное электроснабжение'], cabin: [10, 'Бытовка для бригады'],
    toilet: [11, 'Временный туалет'],
    digHand: [12, 'Выемка грунта вручную'], geoWork: [13, 'Укладка геотекстиля'], geoMat: [14, 'Геотекстиль'],
    sand: [15, 'Песчаная подушка'], gravel: [16, 'Щебёночная подушка'], excav: [17, 'Экскаватор-погрузчик'],
    vibro: [18, 'Виброплита'],
    pile89: [19, 'Винтовая свая 89 мм'], pile108: [20, 'Винтовая свая 108 мм'], pile133: [21, 'Винтовая свая 133 мм'],
    pileBeam: [22, 'Обвязка свай брусом'], rc79: [23, 'Фундамент на ЖБ сваях для дома около 79'],
    rc154: [24, 'Фундамент на ЖБ сваях для дома около 154'], slab: [25, 'Монолитная плита 200–300 мм'],
    ushp: [27, 'Утеплённая шведская плита'], slabHydro: [28, 'Гидроизоляция поверхности плиты'],
    xps: [29, 'Утепление фундамента XPS'], blind: [30, 'Бетонная утеплённая отмостка'], drain: [31, 'Кольцевой дренаж'],
    lumber: [32, 'Сухая строганая доска'], batten: [33, 'Обрешётка и контробрешётка'],
    osb9: [34, 'ОСП-3, 9 мм'], osb12: [35, 'ОСП-3, 12 мм'], osb18: [36, 'ОСП-3, 18 мм'], osb22: [37, 'ОСП-3, 22 мм'],
    fasteners: [38, 'Конструкционный крепёж'], antisept: [39, 'Антисептик и антипирен'],
    frameWork: [40, 'Сборка силового каркаса'], innerFrame: [41, 'Монтаж силового каркаса внутренних стен'],
    counterBatten: [42, 'Монтаж контробрешётки'], quickdeck: [43, 'Монтаж плит QuickDeck'],
    wool: [44, 'Базальтовая вата для стен и кровли'], woolFloor: [45, 'Базальтовая вата повышенной плотности'],
    eco: [46, 'Эковата для задувки'], ecoWork: [47, 'Задувка эковаты'], vapor: [48, 'Пароизоляционная мембрана'],
    wind: [49, 'Ветрозащитная мембрана'], tape: [50, 'Герметизирующая монтажная лента'],
    ins50: [51, 'Монтаж утеплителя 50 мм'], ins100: [52, 'Монтаж утеплителя 100 мм'], ins200: [53, 'Монтаж утеплителя 200 мм'],
    vaporWork: [54, 'Монтаж пароизоляции'], windWork: [55, 'Монтаж ветрозащиты'],
    rafters: [56, 'Монтаж стропильной системы'], roofBatten: [57, 'Дополнительная обрешётка утепления'],
    profnastil: [58, 'Профнастил'], metalTile: [59, 'Металлочерепица'], softTile: [60, 'Гибкая черепица'],
    metalWork: [61, 'Монтаж металлочерепицы'], softWork: [62, 'Монтаж мягкой кровли'],
    ridge: [63, 'Монтаж коньков и карнизов'], drip: [64, 'Монтаж капельников'], gutter: [65, 'Водосточная система'],
    gutterWork: [66, 'Монтаж водосточной системы'], snowTube: [67, 'Трубчатый снегозадержатель'],
    snowPoint: [68, 'Точечный снегозадержатель'],
    vinyl: [70, 'Виниловый сайдинг'], fibro: [71, 'Фиброцементный сайдинг'], imitation: [72, 'Имитация бруса с монтажом'],
    plaster: [73, 'Штукатурный фасад'], woodPrep: [74, 'Подготовка имитации бруса'], woodPaint: [75, 'Окраска имитации бруса'],
    fillets: [77, 'Монтаж галтелей'],
    windows: [78, 'ПВХ-окно'], winMount: [79, 'Тёплый монтаж окон'], entryDoor: [80, 'Входная дверь'],
    terraceDoor: [81, 'Балконная или террасная дверь'], innerDoor: [82, 'Межкомнатная дверь'],
    gklWork: [84, 'Монтаж гипсокартона'], gklMat: [85, 'Гипсокартон с профилем'], putty: [86, 'Шпаклёвка и подготовка стен'],
    paint: [87, 'Покраска стен'], laminate: [88, 'Ламинат с подложкой'], laminateWork: [89, 'Монтаж ламината'],
    tile: [90, 'Керамическая плитка'], tileWork: [91, 'Укладка плитки'], wetHydro: [92, 'Обмазочная гидроизоляция'],
    stretch: [93, 'Натяжной потолок'], plinth: [94, 'Плинтус с монтажом'],
    finBasic: [95, 'Базовая внутренняя отделка'], finMid: [96, 'Внутренняя отделка среднего уровня'],
    finPrem: [97, 'Премиальная внутренняя отделка'],
    elShield: [98, 'Распределительный щит'], elCable: [99, 'Кабельная продукция'], elSockets: [100, 'Розетки, выключатели'],
    elWork: [101, 'Работы по внутренней электрике'], elKit: [102, 'Внутренняя электрика полностью'],
    elConnect: [103, 'Технологическое присоединение'],
    gasBoiler: [104, 'Газовый котёл'], gasRad: [105, 'Радиаторы'], gasPipes: [106, 'Трубы и фитинги отопления'],
    chimney: [107, 'Дымоход'], gasWork: [108, 'Монтаж газового отопления'], gasKit: [109, 'Газовое отопление без газификации'],
    elBoiler: [110, 'Электрический котёл'], elRad: [111, 'Радиаторы или тёплые полы'],
    elHeatWork: [112, 'Монтаж электрического отопления'], elHeatKit: [113, 'Электрическое отопление полностью'],
    hp: [114, 'Тепловой насос воздух–вода'], hpWork: [115, 'Монтаж теплового насоса'],
    hpDist: [116, 'Система распределения тепла'], hpKit: [117, 'Тепловой насос с системой отопления'],
    well: [118, 'Скважина на воду'], waterTreat: [119, 'Система фильтрации'], waterPipes: [120, 'Внутренняя разводка водоснабжения'],
    sewerPipes: [121, 'Внутренняя разводка канализации'], septic: [122, 'Септик'], plumbing: [123, 'Базовый комплект сантехники'],
    waterKit: [124, 'Водоснабжение и канализация полностью'],
    ventNat: [125, 'Приточные клапаны'], recup: [126, 'Приточно-вытяжная установка'], ducts: [127, 'Воздуховоды'],
    ventWork: [128, 'Монтаж приточно-вытяжной'], ventKit: [129, 'Вентиляция с рекуперацией полностью'],
    terrace: [130, 'Терраса на каркасе'], porch: [131, 'Крыльцо с навесом'], balcony: [132, 'Балкон каркасный'],
    carport: [133, 'Навес для автомобиля'], storm: [134, 'Ливневая канализация'], leveling: [135, 'Черновое выравнивание'],
    delivery: [136, 'Доставка пиломатериалов'], manip: [137, 'Манипулятор'], crane: [138, 'Автокран'],
    overhead: [139, 'Доставка и накладные расходы'], supervision: [140, 'Независимый технический надзор'],
    cleanup: [141, 'Финальная уборка'], reserve: [142, 'Резерв на непредвиденные'],
    ctlBasic: [143, 'под ключ, базовый уровень'], ctlStd: [144, 'под ключ, стандартный уровень'],
    ctlPrem: [145, 'под ключ, повышенная комплектация'],
  };

  // Нормы расхода. Можно переопределить листом «Нормы» в загружаемой таблице (колонки: Ключ | Значение).
  const NORMS_DEFAULT = {
    wallHeight: { v: 3.0, t: 'Высота стены одного этажа, м' },
    kneeWall: { v: 1.2, t: 'Высота стенки мансарды, м' },
    aspect: { v: 1.25, t: 'Соотношение сторон дома (длина / ширина)' },
    mansardShare: { v: 0.6, t: 'Доля площади мансарды от первого этажа' },
    lumberPerM2: { v: 0.22, t: 'Доска каркаса, м³ на 1 м² дома' },
    battenPerM2: { v: 0.012, t: 'Обрешётка, м³ на 1 м² фасада и кровли' },
    innerWallPerM2: { v: 0.9, t: 'Внутренние стены, м² на 1 м² дома' },
    pileStep: { v: 3.2, t: 'Площадь пятна на одну сваю, м²' },
    kitArea: { v: 120, t: 'Площадь дома, на которую рассчитаны «комплекты на дом», м²' },
    osbSheet: { v: 3.125, t: 'Площадь листа ОСП, м²' },
    reserveWaste: { v: 1.1, t: 'Запас материала на подрезку' },
    membraneLap: { v: 1.15, t: 'Запас мембраны на нахлёсты' },
    tapeM2: { v: 40, t: 'м² мембраны на один рулон ленты' },
    roofInsThk: { v: 0.2, t: 'Толщина утепления кровли / перекрытия, м' },
    floorInsThk: { v: 0.2, t: 'Толщина утепления пола, м' },
    wetFloorPerBath: { v: 6, t: 'Площадь пола одного санузла, м²' },
    wetWallPerBath: { v: 22, t: 'Площадь стен под плитку в санузле, м²' },
  };

  const ROOF_K = { gable: 1.35, hip: 1.45, shed: 1.2, flat: 1.1 };
  const ROOF_NAMES = { gable: 'двускатная', hip: 'вальмовая', shed: 'односкатная', flat: 'плоская' };

  const SECTIONS = [
    { id: 'prep', name: 'Подготовка и проект' }, { id: 'found', name: 'Фундамент и земляные работы' },
    { id: 'frame', name: 'Каркас' }, { id: 'insul', name: 'Утепление и мембраны' }, { id: 'roof', name: 'Кровля' },
    { id: 'facade', name: 'Фасад' }, { id: 'win', name: 'Окна и двери' }, { id: 'finish', name: 'Внутренняя отделка' },
    { id: 'elec', name: 'Электрика' }, { id: 'heat', name: 'Отопление' }, { id: 'water', name: 'Вода и канализация' },
    { id: 'vent', name: 'Вентиляция' }, { id: 'extra', name: 'Дополнительные конструкции' },
    { id: 'logi', name: 'Логистика и управление' },
  ];

  const DEFAULT_INPUT = {
    client: { name: '', phone: '', address: '', note: '' },
    area: 120, floors: '1', roofType: 'gable', buildMonths: 4,
    priceLevel: 'base', regionK: 1, markup: 0, discount: 0,
    geo: { perimeter: null, glazing: null, wallArea: null, roofArea: null },
    prep: { topo: true, geo: true, project: 'typ', engProject: true, clearM2: 0, stumps: 0, containers: null,
      tmpPower: true, cabin: true, toilet: true },
    found: { type: 'screw108', piles: null, blind: true, drain: false, xps: true, excavShifts: null, vibroDays: null },
    frame: { floorOsb: true, quickdeck: false, innerSeparate: false },
    insul: { material: 'wool', wallThk: 200 },
    roof: { cover: 'metal', snow: true, gutter: true },
    facade: { type: 'imitation', paint: true },
    win: { entry: 1, terrace: 0, inner: null },
    finish: { mode: 'mid', baths: 1 },
    elec: { mode: 'kit', connect: true },
    heat: { system: 'gas', mode: 'items' },
    water: { mode: 'items', well: true, treat: true, septic: true },
    vent: { type: 'natural', mode: 'items' },
    extra: { terrace: 0, porch: true, balcony: 0, carport: 0, storm: 0, leveling: 0 },
    logi: { deliveries: null, manip: 2, crane: 0, cleanup: true, overheadPct: null, supervision: true, supervisionPct: null,
      reserve: true, reservePct: null },
    overrides: {}, // key → { qty?: число, off?: true }
  };

  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/ё/g, 'е').replace(/[\s ]+/g, ' ').trim();

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    if (v == null) return NaN;
    let s = String(v).replace(/[\s ₽%]/g, '').replace(/руб\.?/i, '');
    if (s === '') return NaN;
    if (/,\d{1,2}$/.test(s) && !/\.\d/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    const n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }

  // Разбор строк листа (массив массивов) в позиции прайса. Колонки определяются по заголовкам.
  function parsePriceRows(rows) {
    let h = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      if ((rows[i] || []).some(c => /наименование/i.test(String(c)))) { h = i; break; }
    }
    if (h < 0) throw new Error('Не найдена строка заголовков: нужна колонка «Наименование позиции».');
    const head = rows[h].map(c => norm(c));
    const col = re => head.findIndex(c => re.test(c));
    const C = {
      id: col(/^id$|^№|^код/), section: col(/^раздел/), sub: col(/подраздел/), name: col(/наименование/),
      type: col(/тип/), unit: col(/единиц|ед\./), min: col(/миним/), base: col(/базов|^цена/), max: col(/максим/),
      status: col(/статус/), comment: col(/коммент/),
    };
    if (C.base < 0) throw new Error('Не найдена колонка с ценой: нужна «Базовая цена, ₽».');
    const items = [];
    for (let i = h + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const name = String(r[C.name] == null ? '' : r[C.name]).trim();
      if (!name) continue;
      const base = num(r[C.base]);
      if (!isFinite(base)) continue;
      const min = C.min >= 0 && isFinite(num(r[C.min])) ? num(r[C.min]) : base;
      const max = C.max >= 0 && isFinite(num(r[C.max])) ? num(r[C.max]) : base;
      const g = k => (C[k] >= 0 && r[C[k]] != null ? String(r[C[k]]).trim() : '');
      items.push({ id: isFinite(num(g('id'))) ? num(g('id')) : items.length + 1, section: g('section') || 'Без раздела',
        sub: g('sub'), name, type: g('type'), unit: g('unit'), min, base, max, status: g('status'), comment: g('comment') });
    }
    if (items.length < 10) throw new Error('В таблице найдено слишком мало позиций с ценами (' + items.length + ').');
    return items;
  }

  function parseNormRows(rows) {
    const out = {};
    for (const r of rows || []) {
      const k = String((r || [])[0] || '').trim();
      if (NORMS_DEFAULT[k] && isFinite(num(r[1]))) out[k] = num(r[1]);
    }
    return out;
  }

  function parseControlRows(rows) {
    const out = [];
    for (let i = 1; i < (rows || []).length; i++) {
      const r = rows[i] || [];
      const area = num(r[1]);
      if (!String(r[0] || '').trim() || !isFinite(area)) continue;
      out.push({ name: String(r[0]).trim(), area, min: num(r[2]), base: num(r[3]), max: num(r[4]), note: String(r[7] || '') });
    }
    return out;
  }

  // Индекс для поиска позиций
  function buildIndex(items) {
    const byName = new Map(), byId = new Map();
    items.forEach(it => { byName.set(norm(it.name), it); byId.set(Number(it.id), it); });
    const found = {}, missing = [];
    for (const [key, [id, frag]] of Object.entries(REF)) {
      const f = norm(frag);
      let it = byName.get(f) || items.find(x => norm(x.name).startsWith(f)) || items.find(x => norm(x.name).includes(f));
      if (!it) { const c = byId.get(id); if (c) it = c; }
      if (it) found[key] = it; else missing.push({ key, name: frag });
    }
    return { found, missing };
  }

  function merge(a, b) {
    const o = Array.isArray(a) ? a.slice() : Object.assign({}, a);
    for (const k in b) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a && typeof a[k] === 'object' && a[k] !== null)
        o[k] = merge(a[k], b[k]);
      else o[k] = b[k];
    }
    return o;
  }

  const val = (v, auto) => (v === null || v === undefined || v === '' || !isFinite(Number(v)) ? auto : Number(v));

  function geometry(inp, N) {
    const A = Math.max(10, Number(inp.area) || 0);
    const floors = inp.floors;
    const ms = N.mansardShare;
    const S = floors === '2' ? A / 2 : floors === '1.5' ? A / (1 + ms) : A;          // пятно застройки
    const w = Math.sqrt(S / N.aspect), L = w * N.aspect;
    const Pauto = 2 * (L + w);
    const P = val(inp.geo.perimeter, Pauto);
    const H = floors === '2' ? 2 * N.wallHeight : floors === '1.5' ? N.wallHeight + N.kneeWall : N.wallHeight;
    const glazingAuto = A * 0.15;
    const G = val(inp.geo.glazing, glazingAuto);
    const wallAuto = P * H;
    const Wext = val(inp.geo.wallArea, wallAuto);
    const kRoof = (ROOF_K[inp.roofType] || 1.35) * (floors === '1.5' ? 1.12 : 1);
    const roofAuto = S * kRoof;
    const R = val(inp.geo.roofArea, roofAuto);
    const gables = inp.roofType === 'gable' ? w * w * Math.tan(Math.PI / 6) / 2 : inp.roofType === 'shed' ? w * w * 0.25 : 0;
    const facade = Math.max(0, Wext + gables - G);
    const innerWalls = A * N.innerWallPerM2;
    const roofIns = floors === '1' ? S : R;                                           // холодный чердак или тёплая кровля
    return { A, S, L, w, P, Pauto, H, G, glazingAuto, Wext, wallAuto, R, roofAuto, facade, innerWalls, roofIns,
      ridge: inp.roofType === 'flat' ? 0 : L };
  }

  function calculate(price, inputRaw) {
    const inp = merge(DEFAULT_INPUT, inputRaw || {});
    const N = {};
    for (const k in NORMS_DEFAULT) N[k] = price.norms && isFinite(price.norms[k]) ? price.norms[k] : NORMS_DEFAULT[k].v;
    const idx = price.index || buildIndex(price.items);
    const g = geometry(inp, N);
    const kHouse = g.A / N.kitArea;                   // масштаб «комплекта на дом около 120 м²»
    const lines = [], warnings = [];
    const lvl = ['min', 'base', 'max'].includes(inp.priceLevel) ? inp.priceLevel : 'base';

    function add(sec, key, qty, note) {
      if (!(qty > 0)) return;
      const it = idx.found[key];
      if (!it) { warnings.push('Нет в прайсе: «' + REF[key][1] + '» — позиция пропущена.'); return; }
      const ov = inp.overrides[key] || {};
      const q = ov.qty != null && isFinite(ov.qty) ? Number(ov.qty) : qty;
      lines.push({ key, sec, id: it.id, name: it.name, unit: it.unit, type: it.type, status: it.status, note: note || '',
        qtyAuto: qty, qty: q, overridden: ov.qty != null, off: !!ov.off,
        price: { min: it.min, base: it.base, max: it.max } });
    }
    const up = x => Math.ceil(x - 1e-9);
    const r1 = x => Math.round(x * 10) / 10;

    // 1. Подготовка
    const p = inp.prep;
    if (p.topo) add('prep', 'topo', 1);
    if (p.geo) add('prep', 'geo', 1);
    if (p.project === 'typ') add('prep', 'projTyp', 1);
    if (p.project === 'ind') add('prep', 'projInd', 1);
    if (p.engProject) add('prep', 'projEng', 1);
    add('prep', 'clear', Number(p.clearM2) || 0);
    add('prep', 'stump', Number(p.stumps) || 0);
    add('prep', 'trash', val(p.containers, up(g.A / 60)), 'авто: 1 контейнер на 60 м²');
    if (p.tmpPower) add('prep', 'tmpPower', 1);
    if (p.cabin) add('prep', 'cabin', 1);
    if (p.toilet) add('prep', 'toilet', Math.max(1, Number(inp.buildMonths) || 1), 'по сроку стройки');

    // 2. Фундамент
    const f = inp.found, t = f.type;
    if (t.startsWith('screw')) {
      const piles = val(f.piles, up(g.S / N.pileStep));
      add('found', t === 'screw89' ? 'pile89' : t === 'screw133' ? 'pile133' : 'pile108', piles, 'авто: 1 свая на ' + N.pileStep + ' м² пятна');
      add('found', 'pileBeam', r1(g.P * 1.5), 'периметр + внутренние балки');
    } else if (t === 'rc') {
      const a = idx.found.rc79, b = idx.found.rc154;
      if (a && b) {
        // ЖБ сваи: стоимость интерполируется по двум эталонным домам 79 и 154 м²
        const k = x => { const t2 = (g.A - 79) / (154 - 79); return x.a + (x.b - x.a) * t2; };
        const kit = { min: k({ a: a.min, b: b.min }), base: k({ a: a.base, b: b.base }), max: k({ a: a.max, b: b.max }) };
        const ov = inp.overrides.rc || {};
        lines.push({ key: 'rc', sec: 'found', id: a.id + '/' + b.id, name: 'Фундамент на ЖБ сваях (по эталонам 79 и 154 м²)', unit: 'дом',
          type: 'Комплект', status: 'Вариант', note: 'пересчитано на ' + Math.round(g.A) + ' м²', qtyAuto: 1,
          qty: ov.qty != null ? Number(ov.qty) : 1, overridden: ov.qty != null, off: !!ov.off,
          price: { min: Math.max(0, kit.min), base: Math.max(0, kit.base), max: Math.max(0, kit.max) } });
      } else warnings.push('Нет эталонов ЖБ свай в прайсе — фундамент не посчитан.');
    } else if (t === 'slab' || t === 'ushp') {
      const pad = g.S * N.reserveWaste;
      add('found', 'geoMat', r1(pad)); add('found', 'geoWork', r1(pad));
      add('found', 'sand', r1(pad)); add('found', 'gravel', r1(pad));
      add('found', 'excav', val(f.excavShifts, 1)); add('found', 'vibro', val(f.vibroDays, 3));
      add('found', t === 'slab' ? 'slab' : 'ushp', r1(pad));
      if (t === 'slab') { add('found', 'slabHydro', r1(pad)); if (f.xps) add('found', 'xps', r1(pad), 'под плитой'); }
    }
    if (f.blind) add('found', 'blind', r1(g.P + 4), 'ширина 1 м по периметру');
    if (f.drain) add('found', 'drain', r1(g.P + 8));

    // 3. Каркас
    const onPiles = t.startsWith('screw') || t === 'rc';
    add('frame', 'lumber', r1(g.A * N.lumberPerM2), 'норма ' + N.lumberPerM2 + ' м³/м²');
    add('frame', 'batten', r1((g.facade + g.R) * N.battenPerM2));
    add('frame', 'osb12', up(g.Wext * N.reserveWaste / N.osbSheet), 'обшивка наружных стен');
    const floorOsbArea = (onPiles ? g.S : 0) + (g.A - g.S);
    if (inp.frame.floorOsb) add('frame', 'osb22', up(floorOsbArea * N.reserveWaste / N.osbSheet), 'черновые полы');
    if (inp.roof.cover === 'soft') add('frame', 'osb9', up(g.R * N.reserveWaste / N.osbSheet), 'сплошной настил под мягкую кровлю');
    add('frame', 'fasteners', r1(kHouse)); add('frame', 'antisept', r1(kHouse));
    add('frame', 'frameWork', r1(g.A));
    if (inp.frame.innerSeparate) add('frame', 'innerFrame', r1(g.innerWalls), 'если внутренние стены считаются отдельно');
    if (inp.facade.type !== 'plaster') add('frame', 'counterBatten', r1(g.facade), 'вентзазор фасада');
    if (inp.frame.quickdeck) add('frame', 'quickdeck', r1(floorOsbArea));

    // 4. Утепление
    const thk = Number(inp.insul.wallThk) || 200;
    const floorIns = onPiles ? g.S : 0;
    const volWalls = g.Wext * thk / 1000, volRoof = g.roofIns * N.roofInsThk, volFloor = floorIns * N.floorInsThk;
    if (inp.insul.material === 'eco') {
      add('insul', 'eco', r1((volWalls + volRoof + volFloor) * 1.1), 'стены ' + thk + ' мм, кровля, пол');
      add('insul', 'ecoWork', r1(kHouse));
    } else {
      add('insul', 'wool', r1((volWalls + volRoof) * N.reserveWaste), 'стены ' + thk + ' мм + кровля');
      add('insul', 'woolFloor', r1(volFloor * N.reserveWaste));
      const insArea = { 150: ['ins100', 'ins50'], 200: ['ins200'], 250: ['ins200', 'ins50'], 100: ['ins100'] }[thk] || ['ins200'];
      insArea.forEach(k => add('insul', k, r1(g.Wext), 'стены'));
      add('insul', 'ins200', r1(g.roofIns + floorIns), 'кровля/перекрытие и пол');
    }
    const vaporArea = (g.Wext + g.roofIns + floorIns) * N.membraneLap;
    const windArea = (g.Wext + g.R) * N.membraneLap;
    add('insul', 'vapor', r1(vaporArea)); add('insul', 'wind', r1(windArea));
    add('insul', 'tape', up((vaporArea + windArea) / N.tapeM2));
    add('insul', 'vaporWork', r1(vaporArea / N.membraneLap)); add('insul', 'windWork', r1(windArea / N.membraneLap));

    // 5. Кровля
    const rf = inp.roof;
    add('roof', 'rafters', r1(g.R));
    if (inp.floors !== '1') add('roof', 'roofBatten', r1(g.R), 'тёплая мансардная кровля');
    const cover = rf.cover === 'soft' ? 'softTile' : rf.cover === 'prof' ? 'profnastil' : 'metalTile';
    add('roof', cover, r1(g.R * N.reserveWaste));
    add('roof', rf.cover === 'soft' ? 'softWork' : 'metalWork', r1(g.R));
    add('roof', 'ridge', r1(g.P + g.ridge), 'карнизы по периметру + конёк');
    add('roof', 'drip', r1(g.P));
    if (rf.gutter) { add('roof', 'gutter', r1(g.P)); add('roof', 'gutterWork', r1(g.P)); }
    if (rf.snow) add('roof', 'snowTube', up(g.L / 3) * (inp.roofType === 'shed' ? 1 : 2), 'секции по 3 м на скат');

    // 6. Фасад
    const fc = inp.facade;
    const fKey = { vinyl: 'vinyl', fibro: 'fibro', imitation: 'imitation', plaster: 'plaster' }[fc.type] || 'imitation';
    add('facade', fKey, r1(g.facade));
    if (fc.type === 'imitation') {
      if (fc.paint) { add('facade', 'woodPrep', r1(g.facade)); add('facade', 'woodPaint', r1(g.facade)); }
      add('facade', 'fillets', r1(4 * g.H + g.G * 2), 'углы + откосы окон');
    }

    // 7. Окна и двери
    const wn = inp.win;
    add('win', 'windows', r1(g.G), 'площадь остекления');
    add('win', 'winMount', r1(kHouse), 'комплект на дом, пересчёт по площади');
    add('win', 'entryDoor', Number(wn.entry) || 0);
    add('win', 'terraceDoor', Number(wn.terrace) || 0);

    // 8. Отделка
    const fn = inp.finish, baths = Math.max(0, Number(fn.baths) || 0);
    if (fn.mode !== 'none') add('win', 'innerDoor', val(wn.inner, up(g.A / 20)), 'авто: 1 дверь на 20 м²');
    if (fn.mode === 'basic') add('finish', 'finBasic', r1(g.A));
    if (fn.mode === 'mid') add('finish', 'finMid', r1(g.A));
    if (fn.mode === 'prem') add('finish', 'finPrem', r1(g.A));
    if (fn.mode === 'items') {
      const wetF = baths * N.wetFloorPerBath, wetW = baths * N.wetWallPerBath;
      const walls = Math.max(0, g.Wext - g.G + g.innerWalls * 2 - wetW);
      add('finish', 'gklMat', r1(walls + g.A)); add('finish', 'gklWork', r1(walls + g.A), 'стены и потолки');
      add('finish', 'putty', r1(walls)); add('finish', 'paint', r1(walls));
      add('finish', 'laminate', r1(g.A - wetF)); add('finish', 'laminateWork', r1(g.A - wetF));
      add('finish', 'tile', r1((wetF + wetW) * N.reserveWaste)); add('finish', 'tileWork', r1(wetF + wetW));
      add('finish', 'wetHydro', r1(wetF + wetW * 0.3));
      add('finish', 'stretch', r1(g.A)); add('finish', 'plinth', r1(g.A * 0.8));
    }

    // 9. Электрика
    const el = inp.elec;
    if (el.mode === 'kit') add('elec', 'elKit', r1(kHouse), 'пересчёт по площади');
    if (el.mode === 'items') {
      add('elec', 'elShield', 1); add('elec', 'elCable', r1(kHouse)); add('elec', 'elSockets', r1(kHouse)); add('elec', 'elWork', r1(kHouse));
    }
    if (el.connect) add('elec', 'elConnect', 1);

    // 10. Отопление
    const ht = inp.heat;
    if (ht.system === 'gas') {
      if (ht.mode === 'kit') add('heat', 'gasKit', r1(kHouse));
      else { add('heat', 'gasBoiler', 1); add('heat', 'gasRad', r1(kHouse)); add('heat', 'gasPipes', r1(kHouse)); add('heat', 'chimney', 1); add('heat', 'gasWork', r1(kHouse)); }
    } else if (ht.system === 'el') {
      if (ht.mode === 'kit') add('heat', 'elHeatKit', r1(kHouse));
      else { add('heat', 'elBoiler', 1); add('heat', 'elRad', r1(kHouse)); add('heat', 'gasPipes', r1(kHouse)); add('heat', 'elHeatWork', r1(kHouse)); }
    } else if (ht.system === 'hp') {
      if (ht.mode === 'kit') add('heat', 'hpKit', r1(kHouse));
      else { add('heat', 'hp', 1); add('heat', 'hpWork', 1); add('heat', 'hpDist', r1(kHouse)); }
    }

    // 11. Вода
    const wt = inp.water;
    if (wt.mode === 'kit') add('water', 'waterKit', r1(kHouse));
    if (wt.mode === 'items') {
      if (wt.well) add('water', 'well', 1);
      if (wt.treat) add('water', 'waterTreat', 1);
      add('water', 'waterPipes', r1(kHouse)); add('water', 'sewerPipes', r1(kHouse));
      if (wt.septic) add('water', 'septic', 1);
    }
    if (wt.mode !== 'none') add('water', 'plumbing', baths, 'по числу санузлов');

    // 12. Вентиляция
    const vn = inp.vent;
    if (vn.type === 'natural') add('vent', 'ventNat', r1(kHouse));
    if (vn.type === 'recup') {
      if (vn.mode === 'kit') add('vent', 'ventKit', r1(kHouse));
      else { add('vent', 'recup', 1); add('vent', 'ducts', r1(kHouse)); add('vent', 'ventWork', r1(kHouse)); }
    }

    // 13. Дополнительно
    const ex = inp.extra;
    add('extra', 'terrace', Number(ex.terrace) || 0);
    if (ex.porch) add('extra', 'porch', 1);
    add('extra', 'balcony', Number(ex.balcony) || 0);
    add('extra', 'carport', Number(ex.carport) || 0);
    add('extra', 'storm', Number(ex.storm) || 0);
    add('extra', 'leveling', Number(ex.leveling) || 0);

    // 14. Логистика (фиксированные)
    const lg = inp.logi;
    add('logi', 'delivery', val(lg.deliveries, up(g.A / 40) + 1), 'авто: 1 рейс на 40 м² + 1');
    add('logi', 'manip', Number(lg.manip) || 0);
    add('logi', 'crane', Number(lg.crane) || 0);
    if (lg.cleanup) add('logi', 'cleanup', 1);

    // Суммы строк по трём уровням цен
    const K = Number(inp.regionK) > 0 ? Number(inp.regionK) : 1;
    const levels = ['min', 'base', 'max'];
    lines.forEach(l => {
      l.sum = {};
      levels.forEach(v => { l.sum[v] = l.off ? 0 : Math.round(l.qty * l.price[v] * K); });
      l.unitPrice = l.price[lvl] * K;
    });

    // Проценты
    const sumBy = (v, filter) => lines.filter(filter || (() => true)).reduce((s, l) => s + l.sum[v], 0);
    const pct = (key, own) => {
      const it = idx.found[key];
      const d = it ? { min: it.min, base: it.base, max: it.max } : { min: 0, base: 0, max: 0 };
      if (own != null && own !== '' && isFinite(Number(own))) return { min: +own, base: +own, max: +own, custom: true, name: it ? it.name : key };
      return Object.assign(d, { name: it ? it.name : key });
    };
    const percents = [];
    const oh = pct('overhead', lg.overheadPct), sv = pct('supervision', lg.supervisionPct), rs = pct('reserve', lg.reservePct);
    const totals = {};
    levels.forEach(v => {
      const build = sumBy(v);
      const ohS = idx.found.overhead ? Math.round(build * oh[v] / 100) : 0;
      const svS = lg.supervision && idx.found.supervision ? Math.round(build * sv[v] / 100) : 0;
      const sub = build + ohS + svS;
      const rsS = lg.reserve && idx.found.reserve ? Math.round(sub * rs[v] / 100) : 0;
      const beforeMk = sub + rsS;
      const mk = Math.round(beforeMk * (Number(inp.markup) || 0) / 100);
      const ds = Math.round((beforeMk + mk) * (Number(inp.discount) || 0) / 100);
      totals[v] = { build, overhead: ohS, supervision: svS, reserve: rsS, markup: mk, discount: ds, total: beforeMk + mk - ds };
    });
    if (idx.found.overhead) percents.push({ key: 'overhead', name: oh.name, pct: oh[lvl], base: 'от строительной сметы', sum: totals[lvl].overhead });
    if (lg.supervision && idx.found.supervision) percents.push({ key: 'supervision', name: sv.name, pct: sv[lvl], base: 'от строительной сметы', sum: totals[lvl].supervision });
    if (lg.reserve && idx.found.reserve) percents.push({ key: 'reserve', name: rs.name, pct: rs[lvl], base: 'от общей сметы', sum: totals[lvl].reserve });

    // По разделам
    const bySection = SECTIONS.map(s => ({ id: s.id, name: s.name,
      min: sumBy('min', l => l.sec === s.id), base: sumBy('base', l => l.sec === s.id), max: sumBy('max', l => l.sec === s.id),
      count: lines.filter(l => l.sec === s.id && !l.off).length }));

    // Контроль: цена за м² против рыночных ориентиров
    const perM2 = totals[lvl].total / g.A;
    const ctl = ['ctlBasic', 'ctlStd', 'ctlPrem'].map(k => idx.found[k]).filter(Boolean)
      .map(it => ({ name: it.name, min: it.min, base: it.base, max: it.max }));
    let nearest = null;
    (price.control || []).forEach(c => { if (!nearest || Math.abs(c.area - g.A) < Math.abs(nearest.area - g.A)) nearest = c; });

    return { input: inp, geometry: g, norms: N, lines, bySection, totals, level: lvl, percents, perM2, control: ctl,
      nearestBudget: nearest, warnings, missing: idx.missing };
  }

  const fmt = (n, d) => (isFinite(n) ? Number(n).toLocaleString('ru-RU', { maximumFractionDigits: d == null ? 0 : d }) : '—');

  const api = { REF, NORMS_DEFAULT, DEFAULT_INPUT, SECTIONS, ROOF_NAMES, parsePriceRows, parseNormRows, parseControlRows,
    buildIndex, calculate, geometry, merge, fmt, num };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
