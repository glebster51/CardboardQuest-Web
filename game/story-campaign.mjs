export const CAMPAIGN_SAVE_KEY = 'cardboardquest-campaign-v1';

const node = (id, title, biome, intro, scene, options = []) => ({ id, title, biome, intro, scene, options });

export const CAMPAIGN = [
  node('home', 'Дом у старой сосны', 'home', 'Утро пахнет золой. Дед ушёл за дровами до рассвета, но его сапоги всё ещё стоят у печи.', 'У печи остыли угли. На столе — нетронутая кружка деда.', [
    { id: 'pack', label: 'Взять дорожный мешок', text: 'Ты находишь в мешке сухарь и две кислые ягоды. Дед всегда говорил: сначала проверь, чем будешь делиться.', items: { hardtack: 1, berries: 2 } },
    { id: 'letter', label: 'Прочитать записку', text: 'На обороте старой карты: «Если вернусь поздно — не иди за мной». Чернила расплылись от воды.', flags: { readGrandpaNote: true }, items: { bandage: 1 } },
  ]),
  node('forest', 'Лесная опушка', 'forest', 'Следы деда обрываются у примятой травы. Между деревьями шепчутся двое гоблинов.', 'Первый гоблин бросается на тебя. Второй отступает и кричит, что старика увели к колоколу.', [
    { id: 'spare', label: 'Пощадить раненого', text: 'Он отдаёт дорогу к ручью и кусок вяленого мяса. «Старик сам пошёл. Он знал, куда» — говорит гоблин.', flags: { sparedScout: true, knowsGrandpaWent: true }, items: { jerky: 1 } },
    { id: 'search', label: 'Обыскать стоянку', text: 'Под мокрой корой лежат ягоды и обломок дедова резного свистка. Кто-то унёс вторую половину.', items: { berries: 2 }, flags: { foundWhistleHalf: true } },
  ]),
  node('stump-hollow', 'Пень с тремя окнами', 'forest', 'В корнях пня спрятан крошечный лаз. Изнутри доносится тихое постукивание.', 'Внутри — мышиный склад: орехи, сухие листья и медная пуговица с дедовой куртки.', 'secret'),
  node('squirrel-cache', 'Белка и тайник', 'forest', 'Белка сердито топает на коре. За ней виден аккуратно сложенный свёрток.', 'Белка принимает орехи за плату и позволяет забрать найденный в лесу запас.', 'secret'),
  node('brook', 'Ручей под папоротником', 'river', 'Следы пересекают мелкий ручей. На дальнем берегу кто-то волок тяжёлые поленья.', 'В воде плавает дедова рукавица. На ладони ниткой вышит знак трёх зубцов.', [
    { id: 'cross', label: 'Перейти по камням', text: 'Ты не промочил мешок и находишь у коряги сухой хлеб. Следы идут к мосту.', items: { hardtack: 1 }, flags: { crossedBrook: true } },
    { id: 'fish', label: 'Осмотреть омут', text: 'В омуте застрял жестяной коробок с наживкой и двумя лечебными ягодами.', items: { berries: 2 }, flags: { searchedBrook: true } },
  ]),
  node('cave-cache', 'Нора под берегом', 'cave', 'У воды открылась нора. В темноте блестит стекло.', 'В норе лежат перевязанные травы и жестяная пуговица. Камешки на стене сложены стрелкой.', 'secret'),
  node('broken-bridge', 'Сломанный мост', 'river', 'Река прорезала поляну поперёк и подмыла даже террасы. Мост рухнул посередине; перебраться на другой берег можно только в обход — слева или справа.', 'Гоблин-носильщик застрял среди обломков. Свежие зарубки на опоре оставил дед: он успел перейти реку по мосту до обвала и ушёл дальше.', [
    { id: 'help', label: 'Вытащить носильщика', text: 'Гоблин отдаёт свой паёк и обещает больше не трогать твой дом. На его ладони знак трёх зубцов.', items: { jerky: 1 }, flags: { helpedCarrier: true, knowsBellMark: true } },
    { id: 'take', label: 'Забрать припасы', text: 'Ты забираешь перевязь с едой и проходишь дальше. За спиной долго скрипит мост.', items: { berries: 1, hardtack: 1 }, flags: { carrierAbandoned: true } },
  ]),
  node('moss-shrine', 'Святилище мха', 'ruins', 'Три каменных зубца повторяются на плитах. Здесь кто-то недавно зажигал лампу.', 'На алтаре вырезано имя деда. Рядом — пустая ниша для деревянного ключа.', [
    { id: 'listen', label: 'Прислушаться к камню', text: 'Из-под плиты доносится глухой звон. Святилище предупреждает: колокол не должен прозвучать дважды.', flags: { heardBellWarning: true }, items: { berries: 1 } },
    { id: 'take-charm', label: 'Забрать оберег', text: 'Оберег раскалывается, но его медная вставка укрепляет шайбу. Теперь она держит удар чуть лучше.', flags: { puckGuard: true } },
  ]),
  node('camp', 'Лагерь гоблинов', 'camp', 'Четверо гоблинов держат лагерь. За ними дымится гора сухих поленьев — дедовы зарубки видны на каждом.', 'После пятой победы из большой хижины выходит огр. Он называет деда «ключником» и требует остановиться.', [
    { id: 'search', label: 'Осмотреть хижины', text: 'В опустевшей хижине спрятаны сухари и заточенный осколок картона. Острее клинок не станет, но удар будет точнее.', items: { hardtack: 2, bladeShard: 1 }, flags: { searchedCamp: true } },
    { id: 'free', label: 'Открыть клетку', text: 'В клетке сидит маленький гоблин-разведчик. Он отдаёт короткий путь к пепельному склону.', flags: { freedScout: true }, items: { berries: 1 } },
  ]),
  node('ash-road', 'Пепельная дорога', 'ridge', 'Серый пепел хрустит под ногами. Между обугленных стволов землю роет лесной кабан. Слева склон уходит в осыпь.', 'На камне оставлена короткая метка: «Не дай им разбудить воду».', [
    { id: 'wrap', label: 'Перевязать шайбу', text: 'Полоса плотной коры смягчает толчки. Теперь каждый вражеский удар слабее на четверть сердца.', flags: { barkPadding: true } },
    { id: 'rations', label: 'Подобрать золу и пайки', text: 'Ты находишь немного еды и мешочек древесного угля.', items: { jerky: 1, scrap: 1 } },
  ]),
  node('goblin-watch', 'Сторожевой уступ', 'ridge', 'Два пращника в синих капюшонах охраняют уступ. Они держатся подальше и раскручивают пращи, прежде чем бросить камень.', 'В карте отмечен старый карьер и тонкая линия к болоту. На полях написано: «дед знает нижний ход».', [
    { id: 'mark', label: 'Скопировать карту', text: 'Ты отмечаешь безопасные проходы. В будущих переходах будет проще находить боковые тропы.', flags: { copiedMap: true }, items: { scrap: 1 } },
    { id: 'cache', label: 'Открыть ящик часового', text: 'В ящике — сушёные ягоды и медная пружина для шайбы.', items: { berries: 2, scrap: 1 } },
  ]),
  node('herb-glen', 'Лощина лекаря', 'meadow', 'Здесь пахнет чабрецом. Между камнями растут ягоды, которые дед собирал от простуды.', 'У старого пня лежит тряпичная сумка с травами и запиской: «Огр тоже боится тишины».', 'secret'),
  node('black-creek', 'Чёрный ручей', 'river', 'Вода темна от торфа. По берегу тянется верёвка с узлами — дедов счёт шагов.', 'На одном узле застрял клочок его шарфа. Ни крови, ни следов борьбы.', [
    { id: 'follow', label: 'Идти по узлам', text: 'Ты находишь целый узелок с травами. Дед оставлял метки осознанно.', items: { bandage: 1 }, flags: { trustsGrandpaTrail: true } },
    { id: 'drink', label: 'Набрать воды', text: 'Вода горчит, но смывает пепел. У берега спрятаны две ягоды.', items: { berries: 2 } },
  ]),
  node('old-mill', 'Мельница без колеса', 'ruins', 'Старая мельница давно не мелет зерно. Но кто-то недавно топил печь.', 'Под жерновом хранился дедов дневник. Последняя страница вырвана, осталась только строка: «я сам отдал ключ».', 'secret'),
  node('quarry', 'Заброшенный карьер', 'quarry', 'В уступах карьера видны ровные срезы, будто гору вырезали слоями картона.', 'Здесь гоблины добывают камень для колокольной арки. Их старший знает, что дед пришёл добровольно.', [
    { id: 'challenge', label: 'Потребовать объяснений', text: 'Старший сдаётся. Он отдаёт запас ягод и говорит: дед удерживает подземный источник ценой собственной жизни.', items: { berries: 2 }, flags: { knowsGrandpaSacrifice: true } },
    { id: 'trade', label: 'Обменять припасы', text: 'Гоблин меняет железный лом на еду. Он не знает, зачем нужен ключ, и не хочет знать.', items: { jerky: 1 }, flags: { tradedWithQuarry: true } },
  ]),
  node('cartographer', 'Дом картографа', 'home', 'Картограф живёт в домике, собранном из обрывков старых карт. Он помнит твоего деда.', '«Он спас не деревню, а вас», — говорит картограф. На карте три дороги к старым болотным воротам.', [
    { id: 'ask', label: 'Попросить правду', text: 'Дед запечатал древний водный колокол, который однажды уже затопил долину. Печать держится на его голосе и деревянном ключе.', flags: { knowsTruth: true } },
    { id: 'prepare', label: 'Попросить снаряжение', text: 'Картограф отдаёт тёплый хлеб и крепкую верёвку. Он не смотрит тебе в глаза.', items: { hardtack: 1, bandage: 1 }, flags: { gotRope: true } },
  ]),
  node('peat-marsh', 'Торфяное море', 'marsh', 'Кочки качаются, как острова. Далеко впереди вспыхивает свет — будто фонарь деда.', 'Огни оказываются светлячками. Но за болотом кто-то отвечает на твой свист.', [
    { id: 'raise', label: 'Позвать деда', text: 'В ответ звучат два коротких свиста. Точно так дед звал тебя домой.', flags: { heardGrandpaReply: true } },
    { id: 'stay-quiet', label: 'Не отвечать', text: 'Ты молчишь. В тишине слышно, как под землёй медленно проворачивается механизм.', flags: { keptQuiet: true }, items: { scrap: 1 } },
  ]),
  node('sunken-cart', 'Затонувшая телега', 'marsh', 'Из торфа торчит ручка старой телеги. Внутри что-то звякает.', 'Под тентом лежит походная еда и маленькая резная фигурка мальчика.', 'secret'),
  node('bone-gate', 'Ворота из корней', 'ruins', 'Корни сплелись в арку и обросли белыми пластинами. Дальше воздух холоднее.', 'Гоблины заперли проход. Их командир знает, что дед уже перешёл нижний мост.', [
    { id: 'fight', label: 'Пробиться к мосту', text: 'После короткой стычки ты находишь припасы у ворот. Командир отступает, не поднимая оружия.', items: { jerky: 1, berries: 1 }, flags: { passedBoneGate: true } },
    { id: 'sneak', label: 'Пройти тихо', text: 'Ты отвлекаешь стражу камешком и проходишь без боя. В кармане остаётся чужой сухарь.', items: { hardtack: 1 }, flags: { sneakedBoneGate: true } },
  ]),
  node('hollow-tree', 'Дупло с голосами', 'forest', 'Старое дерево стонет на ветру. У корней сопит кабан, а из дупла будто зовут тебя по имени.', 'Это эхо детских разговоров: дед учил тебя различать настоящее и повторённое.', [
    { id: 'remember', label: 'Вспомнить урок', text: 'Ты понимаешь: колокол повторяет последний голос. Дед не сможет удерживать его вечно.', flags: { understandsBell: true } },
    { id: 'cache', label: 'Заглянуть в дупло', text: 'Внутри спрятан сухой свёрток и медная застёжка от деда.', items: { hardtack: 1, scrap: 1 } },
  ]),
  node('scree-pass', 'Осыпной проход', 'ridge', 'Каждый шаг срывает камешки вниз. На стене царапины от деревянного ключа.', 'Следы сходятся у каменной арки. На земле лежит дедова рука, нарисованная углём, и рядом знак «не звони».', [
    { id: 'brace', label: 'Подпереть склон', text: 'Кора и верёвка укрепляют твою шайбу. Ты выдержишь ещё один тяжёлый удар.', flags: { barkPadding: true }, items: { berries: 1 } },
    { id: 'descend', label: 'Спуститься коротким путём', text: 'Ты скатываешься по мягкому мху и находишь целый паёк.', items: { jerky: 1, hardtack: 1 } },
  ]),
  node('bell-gate', 'Нижняя арка', 'ruins', 'В арке три пустые выемки. Дедов ключ подходит к средней, но её ещё можно не трогать.', 'С другой стороны слышен его голос. Он говорит: «Если ты пришёл, значит, я не успел».', [
    { id: 'wait', label: 'Ответить деду', text: '«Не открывай печать», — отвечает он. «Но и не уходи. Я хочу увидеть тебя напоследок».', flags: { spokeThroughGate: true } },
    { id: 'key', label: 'Вставить ключ', text: 'Ключ поворачивается сам. Каменная арка начинает звучать без удара.', flags: { openedBellGate: true } },
  ]),
  node('bell-vault', 'Хранилище колокола', 'vault', 'В центре висит деревянный колокол, обёрнутый цепями из корней. Дед держит ладонь на трещине.', 'Его волосы поседели. Он улыбается, будто ты просто задержался к завтраку.', [
    { id: 'embrace', label: 'Обнять деда', text: 'Он наконец отпускает печать. Колокол отвечает его голосом, и трещина расползается по всей долине.', flags: { choseGoodbye: true } },
    { id: 'seal', label: 'Попытаться заменить его', text: 'Ты кладёшь руку на печать. Дед отталкивает тебя: «Ты ещё должен жить дальше». Колокол всё равно трескается.', flags: { triedToReplaceGrandpa: true } },
  ]),
  node('grandpa', 'Последняя тишина', 'vault', 'Колокол замолкает. Дед лежит на своей шайбе. Вода медленно отступает, открывая крыши нижних домов.', 'Дед больше не ответит. Мальчик забирает свисток. Домой придётся вернуться одному — и рассказать всю правду, которую взрослые прятали друг от друга.', [
    { id: 'keep-whistle', label: 'Оставить свисток у окна', text: 'Каждое утро ты открываешь окно, чтобы услышать лес. Он молчит. Ты всё равно отвечаешь коротким свистом.', flags: { ending: 'quiet-morning' } },
    { id: 'tell-story', label: 'Записать историю деда', text: 'Ты записываешь всё — даже то, чего не понимаешь. На последней строке рука дрогнула, но рассказ не оборвался.', flags: { ending: 'the-story-remains' } },
  ]),
];

const CAMPAIGN_BY_ID = new Map(CAMPAIGN.map(entry => [entry.id, entry]));
export const CAMPAIGN_LOCATION_COUNT = CAMPAIGN.length;

export function createCampaignState(raw = null) {
  const state = raw && raw.version === 1 ? structuredClone(raw) : {};
  state.version = 1;
  state.currentLocationId = CAMPAIGN_BY_ID.has(state.currentLocationId) ? state.currentLocationId : 'home';
  state.visited = Array.isArray(state.visited) ? [...new Set(state.visited.filter(id => CAMPAIGN_BY_ID.has(id)))] : [];
  state.introSeen = state.introSeen && typeof state.introSeen === 'object' ? state.introSeen : {};
  state.seen = state.seen && typeof state.seen === 'object' ? state.seen : {};
  state.collected = state.collected && typeof state.collected === 'object' ? state.collected : {};
  state.flags = state.flags && typeof state.flags === 'object' ? state.flags : {};
  state.items = state.items && typeof state.items === 'object' ? state.items : {};
  state.maxHealthBonus = Math.max(0, Math.min(8, Math.trunc(Number(state.maxHealthBonus) || 0)));
  state.defenseBonus = Math.max(0, Math.min(2, Math.trunc(state.defenseBonus || 0)));
  state.damageBonus = Math.max(0, Math.min(2, Math.trunc(state.damageBonus || 0)));
  return state;
}

export function campaignLocation(id) { return CAMPAIGN_BY_ID.get(id) ?? null; }

export function hasGrandpaDied(state) {
  return Boolean(state.flags?.grandpaDead || state.flags?.ending || state.visited?.includes('grandpa'));
}

export function visitCampaignLocation(state, id) {
  const location = CAMPAIGN_BY_ID.get(id);
  if (!location) return null;
  state.currentLocationId = id;
  if (!state.visited.includes(id)) state.visited.push(id);
  const firstVisit = !state.introSeen[id];
  state.introSeen[id] = true;
  return { firstVisit, location };
}

export function campaignCacheRewards(id) {
  return id === 'stump-hollow' ? { berries: 2, scrap: 1 }
    : id === 'squirrel-cache' ? { nuts: 2, hardtack: 1 }
      : id === 'cave-cache' ? { bandage: 1, berries: 1 }
        : id === 'herb-glen' ? { berries: 3, bandage: 1 }
          : id === 'old-mill' ? { scrap: 2, hardtack: 1 }
            : id === 'sunken-cart' ? { hardtack: 1, berries: 2 } : null;
}

/** Open a physical cache once and return its contents for world-space pickup. */
export function openCampaignCache(state, id) {
  const location = CAMPAIGN_BY_ID.get(id);
  const rewards = campaignCacheRewards(id);
  if (!location || state.currentLocationId !== id || location.options !== 'secret' || state.collected[id] || !rewards) return null;
  state.seen[id] = true;
  state.collected[id] = true;
  if (id === 'stump-hollow') state.flags.foundButton = true;
  if (id === 'herb-glen') state.flags.knowsOgreFear = true;
  if (id === 'old-mill') state.flags.foundDiary = true;
  if (id === 'sunken-cart') state.flags.foundToy = true;
  return { title: location.title, text: location.scene, rewards };
}

export function inspectCampaignLocation(state, id = state.currentLocationId) {
  const location = CAMPAIGN_BY_ID.get(id);
  if (!location) return null;
  if (id === 'bell-vault' && hasGrandpaDied(state)) return {
    title: location.title, text: 'Колокол молчит. Дед больше не ответит.', options: [],
  };
  if (location.options === 'secret') return {
    title: location.title, text: 'Ударь шайбой по сундуку, чтобы открыть его.', options: [],
  };
  if (state.collected[id]) return { title: location.title, text: 'Ты уже осмотрел это место.', options: [] };
  state.seen[id] = true;
  return { title: location.title, text: location.scene, options: location.options };
}

export function chooseCampaignOption(state, id, optionId) {
  if (state.currentLocationId !== id || state.collected[id]) return null;
  if (id === 'bell-vault' && hasGrandpaDied(state)) return null;
  const location = CAMPAIGN_BY_ID.get(id);
  const option = location?.options?.find(candidate => candidate.id === optionId);
  if (!option) return null;
  addItems(state, option.items);
  Object.assign(state.flags, option.flags ?? {});
  if (option.flags?.puckGuard || option.flags?.barkPadding) state.defenseBonus = Math.min(2, state.defenseBonus + 1);
  if (option.items?.bladeShard) state.damageBonus = Math.min(2, state.damageBonus + 1);
  state.seen[id] = true;
  state.collected[id] = true;
  return { title: location.title, text: option.text, rewards: option.items ?? {}, flags: option.flags ?? {} };
}

export function addItems(state, items = {}) {
  for (const [id, amount] of Object.entries(items)) {
    if (!Number.isFinite(amount) || amount <= 0) continue;
    state.items[id] = Math.max(0, Math.min(99, Math.trunc(state.items[id] || 0) + Math.trunc(amount)));
  }
  return state.items;
}

export const ITEM_LABELS = Object.freeze({
  berries: 'Лесные ягоды', hardtack: 'Сухарь', jerky: 'Вяленое мясо', bandage: 'Перевязь',
  scrap: 'Медный лом', nuts: 'Орехи', bladeShard: 'Острый осколок',
});

export function consumeFood(state, health, maxHealth) {
  const healValue = state.items.bandage > 0 ? 6 : state.items.jerky > 0 ? 4
    : state.items.hardtack > 0 ? 3 : state.items.berries > 0 ? 2 : 0;
  if (!healValue || health >= maxHealth) return { health, consumed: null, healed: 0 };
  const item = state.items.bandage > 0 ? 'bandage' : state.items.jerky > 0 ? 'jerky'
    : state.items.hardtack > 0 ? 'hardtack' : 'berries';
  state.items[item]--;
  const nextHealth = Math.min(maxHealth, health + healValue);
  return { health: nextHealth, consumed: item, healed: nextHealth - health };
}

export function eligibleTransitions(id) {
  const location = CAMPAIGN_BY_ID.get(id);
  if (!location) return [];
  return CAMPAIGN_EDGES.filter(([from]) => from === id).map(([from, to]) => ({ from, to }));
}

export const CAMPAIGN_EDGES = [
  ['home', 'forest'], ['forest', 'home'], ['forest', 'stump-hollow'], ['stump-hollow', 'forest'],
  ['stump-hollow', 'squirrel-cache'], ['squirrel-cache', 'stump-hollow'], ['forest', 'brook'], ['brook', 'forest'],
  ['brook', 'cave-cache'], ['cave-cache', 'brook'], ['brook', 'broken-bridge'], ['broken-bridge', 'brook'],
  ['broken-bridge', 'moss-shrine'], ['moss-shrine', 'broken-bridge'], ['moss-shrine', 'camp'], ['camp', 'moss-shrine'],
  ['camp', 'ash-road'], ['ash-road', 'camp'], ['ash-road', 'goblin-watch'], ['goblin-watch', 'ash-road'],
  ['goblin-watch', 'herb-glen'], ['herb-glen', 'goblin-watch'], ['herb-glen', 'black-creek'], ['black-creek', 'herb-glen'],
  ['ash-road', 'black-creek'], ['black-creek', 'ash-road'], ['black-creek', 'old-mill'], ['old-mill', 'black-creek'],
  ['black-creek', 'quarry'], ['quarry', 'black-creek'], ['quarry', 'cartographer'], ['cartographer', 'quarry'],
  ['cartographer', 'peat-marsh'], ['peat-marsh', 'cartographer'], ['peat-marsh', 'sunken-cart'], ['sunken-cart', 'peat-marsh'],
  ['peat-marsh', 'bone-gate'], ['bone-gate', 'peat-marsh'], ['bone-gate', 'hollow-tree'], ['hollow-tree', 'bone-gate'],
  ['hollow-tree', 'scree-pass'], ['scree-pass', 'hollow-tree'], ['scree-pass', 'bell-gate'], ['bell-gate', 'scree-pass'],
  ['bell-gate', 'bell-vault'], ['bell-vault', 'bell-gate'], ['bell-vault', 'grandpa'], ['grandpa', 'bell-vault'],
];

export function validateCampaign() {
  const ids = new Set(CAMPAIGN.map(location => location.id));
  if (ids.size !== CAMPAIGN.length) return { valid: false, reason: 'duplicate location id' };
  for (const [from, to] of CAMPAIGN_EDGES) if (!ids.has(from) || !ids.has(to)) return { valid: false, reason: `unknown edge: ${from} -> ${to}` };
  const reached = new Set(['home']), queue = ['home'];
  while (queue.length) {
    const from = queue.shift();
    for (const [, to] of CAMPAIGN_EDGES.filter(([source]) => source === from)) {
      if (!reached.has(to)) { reached.add(to); queue.push(to); }
    }
  }
  return { valid: reached.size === ids.size, reached: reached.size, count: ids.size,
    reason: reached.size === ids.size ? null : `unreachable locations: ${[...ids].filter(id => !reached.has(id)).join(', ')}` };
}
