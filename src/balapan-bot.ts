// ДЗ: Telegram-бот «Балапан» на ВСЕХ вариантах Promise
//
// Бот — карманная версия приложения Балапан (little-moments-growth-guide):
// берёт занятия, этапы развития и правила погоды прямо из данных приложения на GitHub.
//
// Запуск бота:            npm run bot        (нужен файл .env с BOT_TOKEN=...)
// Демо в консоли без ТГ:  npm run bot:demo
//
// Где какой Promise (ищи метки [1]...[8] в коде):
//  [1] new Promise              — sleep(): таймер занятия «▶️ Таймер 10 мин»; timeout()
//  [2] .then / .catch / .finally — «🎯 Занятие»: цепочка возраст → библиотека → случайное занятие
//  [3] async / await + try/catch — «🌤 Можно гулять?» и «⏱ Есть 5 минут?»
//  [4] Promise.all              — загрузка библиотеки: 3 файла занятий одновременно, нужны ВСЕ
//  [5] Promise.allSettled       — «📋 План на сегодня»: занятия обязательны, погода — по возможности
//  [6] Promise.race             — погода для плана должна успеть за 3 секунды
//  [7] Promise.any              — каждый файл данных качаем с двух зеркал, берём первое успешное
//  [8] Promise.resolve / reject — кэш библиотеки; requireAge(): нет возраста → сразу reject
//
// Что умеет бот кроме команд:
//  - возраст можно просто написать числом (26) или датой рождения (15.09.2024)
//  - меню из кнопок, кнопки под сообщениями («✅ Сделали», «🔄 Другое», «Да / Пока нет»)
//  - геолокация → можно ли гулять именно там, где ты
//  - квиз по этапам развития (CDC), таймер занятия, счётчик «минут вместе»
//  - переключение языка занятий: русский ↔ қазақша

// ===== Типы Telegram (только нужные поля) =====

interface TgUser {
  id: number;
  first_name: string;
  username?: string;
}

interface TgMessage {
  message_id: number;
  chat: { id: number };
  from?: TgUser;
  text?: string;
  location?: { latitude: number; longitude: number };
}

interface TgCallbackQuery {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
}

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

interface TgResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
}

// ===== Типы данных Балапана (как в src/lib/types.ts приложения) =====

type Category = "speech" | "gross_motor" | "fine_motor" | "creative_sensory" | "emotions_social";
type Lang = "ru" | "kz";
type QuickPlace = "home" | "kitchen" | "car" | "bath";
type WeatherReason = "cold" | "hot" | "rain" | "snow";

interface LocalizedText {
  title: string;
  why: string;
  steps: string[];
  materials: string[];
}

// Одно занятие из activities.json / quick-activities.json / infant-activities.json
interface LibraryActivity {
  id: string;
  category: Category;
  duration_min: number;
  age_min_months?: number;
  age_max_months?: number;
  outdoor?: boolean;
  place?: QuickPlace;
  ru: LocalizedText;
  kz: LocalizedText;
}

interface Library {
  activities: LibraryActivity[]; // основные занятия
  quick: LibraryActivity[]; // «Есть 5 минут?» по местам
  infant: LibraryActivity[]; // для малышей до года
}

// Этап развития из milestones.json (по материалам CDC)
interface Milestone {
  id: string;
  age_months: number;
  area: string;
  ru: string;
  kz: string;
  isRedFlag: boolean;
  discuss_after_months: number;
}

interface MilestonesFile {
  items: Milestone[];
}

interface DayWeather {
  now: number;
  min: number;
  max: number;
  code: number;
}

interface OpenMeteoResponse {
  current: { temperature_2m: number; weather_code: number };
  daily: { temperature_2m_min: number[]; temperature_2m_max: number[] };
}

interface Point {
  name: string;
  latitude: number;
  longitude: number;
}

// ===== Состояние каждого чата (живёт в памяти, пока бот запущен) =====

interface Quiz {
  items: Milestone[];
  index: number;
  notYet: Milestone[];
}

interface ChatState {
  months: number | null;
  lang: Lang;
  doneByCategory: Partial<Record<Category, number>>;
  minutesTogether: number;
  quiz: Quiz | null;
}

// ===== Настройки =====

const TOKEN = process.env.BOT_TOKEN;
const TG_API = `https://api.telegram.org/bot${TOKEN}`;

// Данные приложения лежат в публичном репозитории. Два зеркала одних и тех же файлов.
const DATA_MIRRORS = [
  "https://raw.githubusercontent.com/timaarsenal/little-moments-growth-guide/main/src/data/",
  "https://cdn.jsdelivr.net/gh/timaarsenal/little-moments-growth-guide@main/src/data/",
];

const ASTANA: Point = { name: "Астана", latitude: 51.1694, longitude: 71.4491 };

// Правила погоды — те же, что в src/lib/weather.ts приложения
const COLD_LIMIT = -15;
const HOT_LIMIT = 32;
const HEAVY_RAIN = new Set([65, 67, 82, 95, 96, 99]);
const HEAVY_SNOW = new Set([75, 86]);
const HOME_GAME_ID = "gm-02"; // активная игра дома вместо прогулки

const CATEGORY_RU: Record<Category, string> = {
  speech: "Речь",
  gross_motor: "Крупная моторика",
  fine_motor: "Мелкая моторика",
  creative_sensory: "Творчество и сенсорика",
  emotions_social: "Эмоции и общение",
};

const PLACE_RU: Record<QuickPlace, string> = {
  home: "🏠 Дома",
  kitchen: "🍳 Кухня",
  car: "🚗 Машина",
  bath: "🛁 Ванная",
};

const AREA_RU: Record<string, string> = {
  social: "Общение и эмоции",
  language: "Речь и понимание",
  cognitive: "Мышление",
  movement: "Движение",
};

const REASON_RU: Record<WeatherReason, string> = {
  cold: "сильный мороз",
  hot: "сильная жара",
  rain: "ливень или гроза",
  snow: "сильный снег или метель",
};

const WEATHER_TEXT: Record<number, string> = {
  0: "ясно",
  1: "почти ясно",
  2: "переменная облачность",
  3: "пасмурно",
  45: "туман",
  51: "лёгкая морось",
  53: "морось",
  61: "небольшой дождь",
  63: "дождь",
  65: "сильный дождь",
  71: "небольшой снег",
  73: "снег",
  75: "сильный снег",
  80: "ливень",
  86: "сильный снегопад",
  95: "гроза",
};

const MENU = {
  keyboard: [
    [{ text: "🎯 Занятие" }, { text: "⏱ Есть 5 минут?" }],
    [{ text: "📋 План на сегодня" }, { text: "🌤 Можно гулять?" }],
    [{ text: "🧩 Этапы развития" }, { text: "📊 Прогресс" }],
    [{ text: "📍 Погода у меня", request_location: true }, { text: "🇰🇿 Қазақша / Русский" }],
  ],
  resize_keyboard: true,
};

// ===== [1] new Promise: превращаем setTimeout в Promise =====

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function timeout(ms: number, what: string): Promise<never> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => reject(new Error(`${what} не успела за ${ms / 1000} с`)), ms);
  });
}

// ===== Общие помощники =====

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${new URL(url).hostname} ответил ${response.status}`);
  }
  return (await response.json()) as T;
}

async function tg<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`${TG_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = (await response.json()) as TgResponse<T>;
  if (!data.ok) {
    throw new Error(`Telegram ${method}: ${data.description ?? "неизвестная ошибка"}`);
  }
  return data.result;
}

async function send(chatId: number, text: string, extra: Record<string, unknown> = {}): Promise<void> {
  await tg("sendMessage", { chat_id: chatId, text, ...extra });
}

function typing(chatId: number): Promise<unknown> {
  return tg("sendChatAction", { chat_id: chatId, action: "typing" });
}

function pickRandom<T>(list: T[], emptyMessage: string): T {
  const item = list[Math.floor(Math.random() * list.length)];
  if (item === undefined) {
    throw new Error(emptyMessage);
  }
  return item;
}

function formatTemp(n: number): string {
  const r = Math.round(n);
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r)} °C`;
}

// Полных месяцев между датами "YYYY-MM-DD" (как ageInMonths в src/lib/age.ts)
function ageInMonths(birthISO: string, todayISO: string): number {
  const [by, bm, bd] = birthISO.split("-").map(Number);
  const [ty, tm, td] = todayISO.split("-").map(Number);
  if (!by || !bm || !bd || !ty || !tm || !td) return 0;
  let months = (ty - by) * 12 + (tm - bm);
  if (td < bd) months -= 1;
  return Math.max(0, months);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ===== Состояние чатов =====

const chats = new Map<number, ChatState>();

function getState(chatId: number): ChatState {
  let state = chats.get(chatId);
  if (!state) {
    state = { months: null, lang: "ru", doneByCategory: {}, minutesTogether: 0, quiz: null };
    chats.set(chatId, state);
  }
  return state;
}

// [8] Promise.resolve / Promise.reject: сразу готовый Promise, без ожидания.
// Удобно начинать с него цепочку: нет возраста → цепочка сразу уходит в .catch.
function requireAge(state: ChatState): Promise<number> {
  if (state.months === null) {
    return Promise.reject(new Error("Сначала напиши, сколько месяцев малышу: числом (26) или датой рождения (15.09.2024)."));
  }
  return Promise.resolve(state.months);
}

// ===== Загрузка данных приложения =====

// [7] Promise.any: один и тот же файл просим у двух зеркал.
// Берём ПЕРВЫЙ УСПЕШНЫЙ ответ; если одно зеркало упало — не страшно.
// Упадут оба — придёт AggregateError.
function fetchData<T>(file: string): Promise<T> {
  return Promise.any(DATA_MIRRORS.map((base) => getJson<T>(base + file))).catch((error: unknown) => {
    const count = error instanceof AggregateError ? error.errors.length : 0;
    throw new Error(`не удалось скачать ${file}: упали все ${count} зеркала`);
  });
}

// [4] Promise.all: три файла качаются ОДНОВРЕМЕННО, без любого из них библиотека неполная.
// [8] Promise.resolve: если библиотека уже в кэше — отдаём её сразу.
let libraryCache: Library | null = null;

function getLibrary(): Promise<Library> {
  if (libraryCache) {
    return Promise.resolve(libraryCache);
  }
  return Promise.all([
    fetchData<LibraryActivity[]>("activities.json"),
    fetchData<LibraryActivity[]>("quick-activities.json"),
    fetchData<LibraryActivity[]>("infant-activities.json"),
  ]).then(([activities, quick, infant]) => {
    libraryCache = { activities, quick, infant };
    return libraryCache;
  });
}

let milestonesCache: Milestone[] | null = null;

function getMilestones(): Promise<Milestone[]> {
  if (milestonesCache) {
    return Promise.resolve(milestonesCache);
  }
  return fetchData<MilestonesFile>("milestones.json").then((file) => {
    milestonesCache = file.items;
    return file.items;
  });
}

function findActivity(lib: Library, id: string): LibraryActivity | undefined {
  return [...lib.activities, ...lib.quick, ...lib.infant].find((a) => a.id === id);
}

// Занятия, подходящие по возрасту. До года — отдельная подборка для младенцев.
function forAge(lib: Library, months: number): LibraryActivity[] {
  if (months < 12) {
    return lib.infant;
  }
  return [...lib.activities, ...lib.quick].filter(
    (a) => (a.age_min_months ?? 0) <= months && months <= (a.age_max_months ?? 36),
  );
}

// [3] async/await: погода на день (Open-Meteo, как в приложении)
async function getDayWeather(point: Point): Promise<DayWeather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${point.latitude}&longitude=${point.longitude}` +
    `&current=temperature_2m,weather_code&daily=temperature_2m_min,temperature_2m_max&timezone=auto&forecast_days=1`;
  const data = await getJson<OpenMeteoResponse>(url);
  const min = data.daily.temperature_2m_min[0];
  const max = data.daily.temperature_2m_max[0];
  if (min === undefined || max === undefined) {
    throw new Error("Open-Meteo не прислал прогноз на день");
  }
  return { now: data.current.temperature_2m, min, max, code: data.current.weather_code };
}

// [6] Promise.race: погода против таймера. Кто первый закончил — тот и результат.
function getWeatherFast(point: Point, ms: number = 3000): Promise<DayWeather> {
  return Promise.race([getDayWeather(point), timeout(ms, "Погода")]);
}

// То же правило, что weatherReason() в приложении
function weatherReason(w: DayWeather): WeatherReason | null {
  if (w.min < COLD_LIMIT) return "cold";
  if (w.max > HOT_LIMIT) return "hot";
  if (HEAVY_SNOW.has(w.code)) return "snow";
  if (HEAVY_RAIN.has(w.code)) return "rain";
  return null;
}

// ===== Как показываем занятие =====

function activityText(a: LibraryActivity, lang: Lang): string {
  const t = a[lang];
  const lines = [
    `🐣 ${t.title}`,
    `${CATEGORY_RU[a.category]} · ${a.duration_min} мин`,
    "",
    `💡 ${t.why}`,
    "",
    ...t.steps.map((step, i) => `${i + 1}. ${step}`),
  ];
  if (t.materials.length > 0) {
    lines.push("", `🧺 ${t.materials.join(", ")}`);
  }
  return lines.join("\n");
}

function activityButtons(a: LibraryActivity): Record<string, unknown> {
  return {
    inline_keyboard: [
      [
        { text: "✅ Сделали", callback_data: `done:${a.id}` },
        { text: `▶️ Таймер ${a.duration_min} мин`, callback_data: `timer:${a.id}` },
      ],
      [{ text: "🔄 Другое занятие", callback_data: "another" }],
    ],
  };
}

function sendActivity(chatId: number, a: LibraryActivity, note: string = ""): Promise<void> {
  const state = getState(chatId);
  const text = note ? `${note}\n\n${activityText(a, state.lang)}` : activityText(a, state.lang);
  return send(chatId, text, { reply_markup: activityButtons(a) });
}

// ===== Действия бота =====

async function sendWelcome(chatId: number, name: string): Promise<void> {
  await send(
    chatId,
    `Привет, ${name}! 👋 Я Балапан-бот 🐣\n` +
      "Подбираю короткие развивающие занятия для малыша 0–3 лет — в те минуты, которые у вас уже есть.",
    { reply_markup: MENU },
  );
  await send(chatId, "Сколько месяцев малышу? Нажми кнопку или напиши число / дату рождения.", {
    reply_markup: {
      inline_keyboard: [
        [6, 12, 18].map((m) => ({ text: `${m} мес`, callback_data: `age:${m}` })),
        [24, 30, 36].map((m) => ({ text: `${m} мес`, callback_data: `age:${m}` })),
      ],
    },
  });
}

function setAge(chatId: number, months: number): Promise<void> {
  getState(chatId).months = months;
  const hint = months < 12 ? "Покажу занятия для самых маленьких." : "Жми «🎯 Занятие» или «📋 План на сегодня».";
  return send(chatId, `Запомнил: ${months} мес. ${hint}`, { reply_markup: MENU });
}

// [2] Цепочка .then → .then → .catch → .finally.
// Внутри первого .then — ещё один Promise (getLibrary): это и есть «матрёшка».
function sendRandomActivity(chatId: number): Promise<void> {
  const state = getState(chatId);
  return requireAge(state)
    .then((months) => getLibrary().then((lib) => pickRandom(forAge(lib, months), "Для этого возраста занятий пока нет.")))
    .then((activity) => sendActivity(chatId, activity))
    .catch((error: unknown) => send(chatId, `🐣 ${errorText(error)}`))
    .finally(() => console.log(`[занятие] чат ${chatId}`));
}

function askPlace(chatId: number): Promise<void> {
  const places: QuickPlace[] = ["home", "kitchen", "car", "bath"];
  return send(chatId, "⏱ Есть 5 минут? Где вы сейчас?", {
    reply_markup: {
      inline_keyboard: [places.slice(0, 2), places.slice(2)].map((row) =>
        row.map((place) => ({ text: PLACE_RU[place], callback_data: `place:${place}` })),
      ),
    },
  });
}

// [3] async/await + try/catch: то же, что цепочка .then, но читается сверху вниз
async function sendQuickIdea(chatId: number, place: QuickPlace): Promise<void> {
  const state = getState(chatId);
  try {
    const months = await requireAge(state);
    const lib = await getLibrary();
    const options = lib.quick.filter(
      (a) => a.place === place && (a.age_min_months ?? 0) <= months && months <= (a.age_max_months ?? 36),
    );
    const activity = pickRandom(options, `Для ${months} мес. здесь занятий пока нет — попробуй «🎯 Занятие».`);
    await sendActivity(chatId, activity, `${PLACE_RU[place]} · ${activity.duration_min} мин`);
  } catch (error) {
    await send(chatId, `🐣 ${errorText(error)}`);
  }
}

// [3] async/await: можно ли гулять (правила приложения: мороз, жара, ливень, метель)
async function sendWalkAdvice(chatId: number, point: Point): Promise<void> {
  await typing(chatId);
  try {
    const w = await getDayWeather(point);
    const sky = WEATHER_TEXT[w.code] ?? `код погоды ${w.code}`;
    const head = `🌤 ${point.name}: сейчас ${formatTemp(w.now)}, ${sky}; днём от ${formatTemp(w.min)} до ${formatTemp(w.max)}.`;
    const reason = weatherReason(w);
    if (!reason) {
      await send(chatId, `${head}\n\n✅ Можно гулять! Одевайтесь по погоде 🧣`);
      return;
    }
    await send(chatId, `${head}\n\n🏠 Сегодня ${REASON_RU[reason]} — прогулку лучше заменить активной игрой дома.`);
    const lib = await getLibrary();
    const homeGame = findActivity(lib, HOME_GAME_ID);
    if (homeGame) {
      await sendActivity(chatId, homeGame, "Вместо прогулки:");
    }
  } catch (error) {
    await send(chatId, `😕 Погода не загрузилась: ${errorText(error)}`);
  }
}

// [5] Promise.allSettled + [6] Promise.race.
// Библиотека и погода грузятся одновременно, и allSettled ждёт ОБЕ, не падая.
// Без занятий плана нет; без погоды (упала или не успела за 3 с) — план всё равно будет.
async function sendTodayPlan(chatId: number): Promise<void> {
  const state = getState(chatId);
  let months: number;
  try {
    months = await requireAge(state);
  } catch (error) {
    await send(chatId, `🐣 ${errorText(error)}`);
    return;
  }

  await typing(chatId);
  const [libResult, weatherResult] = await Promise.allSettled([getLibrary(), getWeatherFast(ASTANA)]);

  if (libResult.status === "rejected") {
    await send(chatId, `😕 Не получилось загрузить занятия: ${errorText(libResult.reason)}`);
    return;
  }
  const lib = libResult.value;

  let reason: WeatherReason | null = null;
  let weatherLine: string;
  if (weatherResult.status === "fulfilled") {
    const w = weatherResult.value;
    reason = weatherReason(w);
    weatherLine = `🌤 ${ASTANA.name}: от ${formatTemp(w.min)} до ${formatTemp(w.max)}`;
    weatherLine += reason ? ` — ${REASON_RU[reason]}, прогулку заменим игрой дома` : " — можно гулять";
  } else {
    weatherLine = `🌤 ${errorText(weatherResult.reason)} — план без учёта погоды`;
  }

  // 3 занятия разных категорий
  const shuffled = [...forAge(lib, months)].sort(() => Math.random() - 0.5);
  const plan: LibraryActivity[] = [];
  for (const activity of shuffled) {
    if (plan.length < 3 && !plan.some((p) => p.category === activity.category)) {
      plan.push(activity);
    }
  }

  // В плохую погоду уличное занятие меняем на активную игру дома (как applyWeather в приложении)
  const homeGame = findActivity(lib, HOME_GAME_ID);
  const finalPlan = plan.map((a) => (reason && a.outdoor && homeGame ? homeGame : a));

  if (finalPlan.length === 0) {
    await send(chatId, "Для этого возраста занятий пока нет.");
    return;
  }

  const slots = ["🌅 Утро", "🌇 Вечер", "⚡ В свободную минуту"];
  const total = finalPlan.reduce((sum, a) => sum + a.duration_min, 0);
  const lines = finalPlan.map((a, i) => `${slots[i] ?? "•"}: ${a[state.lang].title} (${a.duration_min} мин, ${CATEGORY_RU[a.category]})`);

  await send(chatId, `📋 План на сегодня — ${total} мин вместе\n${weatherLine}\n\n${lines.join("\n")}\n\nНажми на занятие, чтобы открыть его:`, {
    reply_markup: {
      inline_keyboard: finalPlan.map((a) => [{ text: a[state.lang].title, callback_data: `show:${a.id}` }]),
    },
  });
}

// ===== Квиз по этапам развития =====

async function startQuiz(chatId: number): Promise<void> {
  const state = getState(chatId);
  try {
    const months = await requireAge(state);
    const all = await getMilestones();
    const bands = [...new Set(all.map((m) => m.age_months))].filter((band) => band <= months);
    if (bands.length === 0) {
      throw new Error("Этапы развития в Балапане начинаются с 12 месяцев.");
    }
    const band = Math.max(...bands);
    state.quiz = { items: all.filter((m) => m.age_months === band), index: 0, notYet: [] };
    await send(chatId, `🧩 Этапы к ${band} мес. (по материалам CDC). Отвечай честно — это не экзамен 🙂`);
    await askQuizQuestion(chatId);
  } catch (error) {
    await send(chatId, `🐣 ${errorText(error)}`);
  }
}

async function askQuizQuestion(chatId: number): Promise<void> {
  const state = getState(chatId);
  const quiz = state.quiz;
  if (!quiz) {
    return;
  }
  const item = quiz.items[quiz.index];
  if (!item) {
    return finishQuiz(chatId);
  }
  await send(chatId, `${quiz.index + 1}/${quiz.items.length} · ${AREA_RU[item.area] ?? item.area}\n\n${item[state.lang]}`, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Да", callback_data: "ms:yes" },
          { text: "⏳ Пока нет", callback_data: "ms:no" },
        ],
      ],
    },
  });
}

async function answerQuiz(chatId: number, yes: boolean): Promise<void> {
  const quiz = getState(chatId).quiz;
  if (!quiz) {
    return send(chatId, "Квиз не начат — нажми «🧩 Этапы развития».");
  }
  const item = quiz.items[quiz.index];
  if (item && !yes) {
    quiz.notYet.push(item);
  }
  quiz.index += 1;
  return askQuizQuestion(chatId);
}

async function finishQuiz(chatId: number): Promise<void> {
  const state = getState(chatId);
  const quiz = state.quiz;
  if (!quiz) {
    return;
  }
  state.quiz = null;
  const total = quiz.items.length;
  const lines = [`🎉 Готово! Уже получается: ${total - quiz.notYet.length} из ${total} 👏`];
  if (quiz.notYet.length > 0) {
    lines.push("", "Ещё впереди:", ...quiz.notYet.map((m) => `• ${m[state.lang]}`));
  }
  const toDiscuss = quiz.notYet.filter((m) => m.isRedFlag && (state.months ?? 0) >= m.discuss_after_months);
  if (toDiscuss.length > 0) {
    lines.push("", "🩺 Это стоит обсудить с педиатром на ближайшем приёме:", ...toDiscuss.map((m) => `• ${m[state.lang]}`));
  }
  lines.push("", "Балапан не заменяет консультацию педиатра.");
  await send(chatId, lines.join("\n"));
}

// ===== Прогресс, таймер, отметка «Сделали» =====

function sendProgress(chatId: number): Promise<void> {
  const state = getState(chatId);
  const entries = Object.entries(state.doneByCategory) as [Category, number][];
  const count = entries.reduce((sum, [, n]) => sum + n, 0);
  if (count === 0) {
    return send(chatId, "📊 Пока нет отмеченных занятий. Выбери «🎯 Занятие» и нажми «✅ Сделали» после игры!");
  }
  const lines = entries.map(([category, n]) => `• ${CATEGORY_RU[category]}: ${n}`);
  return send(chatId, `📊 Занятий сделано: ${count}\n⏱ Минут вместе: ${state.minutesTogether}\n\n${lines.join("\n")}`);
}

async function markDone(chatId: number, activity: LibraryActivity): Promise<void> {
  const state = getState(chatId);
  state.doneByCategory[activity.category] = (state.doneByCategory[activity.category] ?? 0) + 1;
  state.minutesTogether += activity.duration_min;
  await send(chatId, `✅ «${activity[state.lang].title}» отмечено! Минут вместе: ${state.minutesTogether} 💛`);
}

// [1] new Promise внутри sleep(): бот «засыпает» на время занятия и потом напоминает.
// Главный цикл при этом не ждёт — бот продолжает отвечать на другие сообщения.
async function startTimer(chatId: number, activity: LibraryActivity): Promise<void> {
  const state = getState(chatId);
  await send(chatId, `⏱ Таймер на ${activity.duration_min} мин запущен. Играйте, я напомню!`);
  await sleep(activity.duration_min * 60_000);
  await send(chatId, `⏰ ${activity.duration_min} мин прошло! Как прошло «${activity[state.lang].title}»?`, {
    reply_markup: { inline_keyboard: [[{ text: "✅ Сделали", callback_data: `done:${activity.id}` }]] },
  });
}

// ===== Разбор ввода без команд =====

// Возраст: «26», «2024-09-15» или «15.09.2024»
function parseAge(text: string): number | null {
  const trimmed = text.trim();
  if (/^\d{1,2}$/.test(trimmed)) {
    return Number(trimmed);
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) {
    return ageInMonths(trimmed, todayISO());
  }
  const dotted = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmed);
  if (dotted) {
    return ageInMonths(`${dotted[3]}-${dotted[2]}-${dotted[1]}`, todayISO());
  }
  return null;
}

function isQuickPlace(value: string): value is QuickPlace {
  return value === "home" || value === "kitchen" || value === "car" || value === "bath";
}

// ===== Маршрутизация =====

async function handleMessage(message: TgMessage): Promise<void> {
  const chatId = message.chat.id;

  if (message.location) {
    const { latitude, longitude } = message.location;
    return sendWalkAdvice(chatId, { name: "там, где ты", latitude, longitude });
  }

  const text = message.text ?? "";
  switch (text) {
    case "/start":
      return sendWelcome(chatId, message.from?.first_name ?? "друг");
    case "🎯 Занятие":
      return sendRandomActivity(chatId);
    case "⏱ Есть 5 минут?":
      return askPlace(chatId);
    case "📋 План на сегодня":
      return sendTodayPlan(chatId);
    case "🌤 Можно гулять?":
      return sendWalkAdvice(chatId, ASTANA);
    case "🧩 Этапы развития":
      return startQuiz(chatId);
    case "📊 Прогресс":
      return sendProgress(chatId);
    case "🇰🇿 Қазақша / Русский": {
      const state = getState(chatId);
      state.lang = state.lang === "ru" ? "kz" : "ru";
      return send(chatId, state.lang === "kz" ? "Енді сабақтар қазақша 🇰🇿" : "Теперь занятия на русском 🇷🇺");
    }
  }

  const months = parseAge(text);
  if (months !== null) {
    if (months > 36) {
      return send(chatId, "Балапан рассчитан на малышей от 0 до 36 месяцев 🐣");
    }
    return setAge(chatId, months);
  }

  if (/гуля|погод/i.test(text)) {
    return sendWalkAdvice(chatId, ASTANA);
  }
  return send(chatId, "Не понял 🤔 Нажми кнопку в меню или напиши возраст малыша числом.", { reply_markup: MENU });
}

async function handleCallback(query: TgCallbackQuery): Promise<void> {
  await tg("answerCallbackQuery", { callback_query_id: query.id }); // убираем «часики» на кнопке
  const message = query.message;
  if (!message) {
    return;
  }
  const chatId = message.chat.id;
  const [action = "", value = ""] = (query.data ?? "").split(":");

  // Квиз и выбор возраста — одноразовые кнопки: убираем их, чтобы не нажали дважды.
  // Ответ не ждём (без await), а ошибку глушим: это просто украшение.
  if (action === "ms" || action === "age" || action === "done") {
    tg("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: message.message_id,
      reply_markup: { inline_keyboard: [] },
    }).catch(() => {});
  }

  switch (action) {
    case "age":
      return setAge(chatId, Number(value));
    case "ms":
      return answerQuiz(chatId, value === "yes");
    case "another":
      return sendRandomActivity(chatId);
    case "place":
      return isQuickPlace(value) ? sendQuickIdea(chatId, value) : undefined;
    case "done":
    case "timer":
    case "show": {
      const activity = findActivity(await getLibrary(), value);
      if (!activity) {
        return send(chatId, "Это занятие не нашлось 🤔");
      }
      if (action === "done") return markDone(chatId, activity);
      if (action === "timer") return startTimer(chatId, activity);
      return sendActivity(chatId, activity);
    }
  }
}

async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.message) {
    return handleMessage(update.message);
  }
  if (update.callback_query) {
    return handleCallback(update.callback_query);
  }
}

// ===== Главный цикл: long polling =====

async function startBot(): Promise<void> {
  const me = await tg<TgUser>("getMe");
  console.log(`Бот @${me.username ?? me.first_name} запущен. Остановить: Ctrl+C`);

  // Библиотеку загружаем заранее, но не ждём: если не выйдет — загрузим при первом запросе
  getLibrary()
    .then((lib) => console.log(`Библиотека: ${lib.activities.length + lib.quick.length + lib.infant.length} занятий`))
    .catch((error: unknown) => console.error("Библиотека пока не загрузилась:", errorText(error)));

  let offset = 0;
  while (true) {
    let updates: TgUpdate[];
    try {
      updates = await tg<TgUpdate[]>("getUpdates", {
        offset,
        timeout: 30,
        allowed_updates: ["message", "callback_query"],
      });
    } catch (error) {
      console.error("getUpdates:", errorText(error));
      await sleep(3000);
      continue;
    }

    for (const update of updates) {
      offset = update.update_id + 1;
      // Без await: каждое сообщение обрабатывается параллельно (таймер на 10 мин никого не блокирует).
      // .catch обязателен — иначе необработанный reject уронит весь процесс.
      handleUpdate(update).catch((error: unknown) => {
        console.error("Ошибка обработки:", errorText(error));
      });
    }
  }
}

// ===== Демо в консоли: те же Promise на данных Балапана, без Telegram =====

async function demo(): Promise<void> {
  let started = Date.now();
  const lib = await getLibrary();
  console.log(
    `[4]+[7] Promise.all из Promise.any: ${lib.activities.length} занятий, ${lib.quick.length} быстрых, ` +
      `${lib.infant.length} для младенцев — за ${Date.now() - started} мс`,
  );

  started = Date.now();
  await getLibrary();
  console.log(`[8] Promise.resolve: библиотека из кэша за ${Date.now() - started} мс`);

  const empty: ChatState = { months: null, lang: "ru", doneByCategory: {}, minutesTogether: 0, quiz: null };
  await requireAge(empty).catch((error: unknown) => console.log(`[8] Promise.reject: ${errorText(error)}`));

  const child: ChatState = { ...empty, months: 26 };
  await requireAge(child)
    .then((months) => getLibrary().then((l) => pickRandom(forAge(l, months), "пусто")))
    .then((a) => console.log(`[2] .then-цепочка: занятие для 26 мес. — «${a.ru.title}» (${a.duration_min} мин)`))
    .catch((error: unknown) => console.log("[2] ошибка:", errorText(error)))
    .finally(() => console.log("    .finally: цепочка закончилась"));

  const w = await getDayWeather(ASTANA);
  const reason = weatherReason(w);
  console.log(
    `[3] async/await: ${ASTANA.name} ${formatTemp(w.min)}…${formatTemp(w.max)} → ` +
      (reason ? `${REASON_RU[reason]}, прогулка дома` : "можно гулять"),
  );

  await getWeatherFast(ASTANA, 1)
    .then(() => console.log("[6] Promise.race: погода успела за 1 мс?!"))
    .catch((error: unknown) => console.log(`[6] Promise.race: ${errorText(error)} — победил таймер`));

  const settled = await Promise.allSettled([getLibrary(), getWeatherFast(ASTANA, 1)]);
  console.log(`[5] Promise.allSettled: библиотека — ${settled[0].status}, погода — ${settled[1].status} → план всё равно будет`);

  const milestones = await getMilestones();
  console.log(`[7] Promise.any: этапов развития загружено — ${milestones.length}`);

  started = Date.now();
  await sleep(300);
  console.log(`[1] new Promise: sleep(300) длился ${Date.now() - started} мс`);
}

// ===== Точка входа =====

if (process.argv.includes("--demo")) {
  demo().catch((error: unknown) => {
    console.error("Демо упало:", errorText(error));
    process.exitCode = 1;
  });
} else if (!TOKEN) {
  console.error("Нет BOT_TOKEN. Создай файл .env рядом с package.json и впиши: BOT_TOKEN=токен_от_BotFather");
  process.exitCode = 1;
} else {
  startBot().catch((error: unknown) => {
    console.error("Бот остановился:", errorText(error));
    process.exitCode = 1;
  });
}
