// ДЗ: погода и курс валют ОДНОВРЕМЕННО
// Запуск: npm run weather
//
// Оба API бесплатные и без ключа, отвечают в формате JSON:
//   погода — Open-Meteo:        https://open-meteo.com
//   валюты — ExchangeRate-API:  https://open.er-api.com
//
// "Одновременно" = Promise.all: оба запроса уходят сразу, и мы ждём,
// пока придут оба ответа. Если делать их по очереди (await, потом
// ещё await), второй запрос начнётся только после первого — дольше.

// ===== Типы: как выглядит JSON, который присылает каждый API =====
// Описываем только те поля, которые используем. Остальные просто игнорируем.

interface WeatherResponse {
  timezone: string;
  current: {
    time: string;            // "2026-11-25T19:15"
    temperature_2m: number;  // °C
    wind_speed_10m: number;  // км/ч
    weather_code: number;    // код погоды WMO, расшифровка ниже
  };
}

interface CurrencyResponse {
  result: "success" | "error";
  base_code: string;                // "USD"
  time_last_update_utc: string;
  rates: Record<string, number>;    // { "KZT": 512.3, "EUR": 0.86, ... }
}

// ===== Настройки =====

const CITY = { name: "Астана", latitude: 51.18, longitude: 71.45 };
const CURRENCIES = ["USD", "EUR", "RUB", "CNY"]; // сколько тенге стоит 1 единица

const WEATHER_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${CITY.latitude}&longitude=${CITY.longitude}` +
  `&current=temperature_2m,wind_speed_10m,weather_code&timezone=auto`;
const CURRENCY_URL = "https://open.er-api.com/v6/latest/USD";

// Коды погоды WMO → понятный текст (основные)
const WEATHER_TEXT: Record<number, string> = {
  0: "ясно",
  1: "почти ясно",
  2: "переменная облачность",
  3: "пасмурно",
  45: "туман",
  48: "изморозь",
  51: "морось",
  61: "небольшой дождь",
  63: "дождь",
  65: "сильный дождь",
  71: "небольшой снег",
  73: "снег",
  75: "сильный снег",
  80: "ливень",
  95: "гроза",
};

// ===== Запрос JSON =====
// fetch получает ответ, response.json() превращает текст JSON в объект JS.
// "as T" — мы говорим TypeScript, какой формы будет этот объект.

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Запрос ${url} вернул ошибку ${response.status}`);
  }
  return (await response.json()) as T;
}

// ===== Главная функция =====

async function main(): Promise<void> {
  // Оба запроса стартуют одновременно
  const [weather, currency] = await Promise.all([
    getJson<WeatherResponse>(WEATHER_URL),
    getJson<CurrencyResponse>(CURRENCY_URL),
  ]);

  // --- Погода ---
  const now = weather.current;
  const description = WEATHER_TEXT[now.weather_code] ?? `код ${now.weather_code}`;

  console.log(`Погода: ${CITY.name} (${now.time.replace("T", " ")})`);
  console.log(`  Температура: ${now.temperature_2m} °C`);
  console.log(`  Ветер:       ${now.wind_speed_10m} км/ч`);
  console.log(`  Небо:        ${description}`);
  console.log();

  // --- Курс валют ---
  if (currency.result !== "success") {
    throw new Error("API валют вернул ошибку");
  }
  const kztPerUsd = currency.rates["KZT"];
  if (kztPerUsd === undefined) {
    throw new Error("В ответе нет курса тенге (KZT)");
  }

  console.log(`Курс к тенге (обновлено: ${currency.time_last_update_utc})`);
  for (const code of CURRENCIES) {
    const perUsd = currency.rates[code]; // сколько этой валюты за 1 USD
    if (perUsd === undefined) {
      console.log(`  1 ${code} = нет данных`);
      continue;
    }
    const kzt = kztPerUsd / perUsd;
    console.log(`  1 ${code} = ${kzt.toFixed(2)} ₸`);
  }
}

main().catch((error: unknown) => {
  console.error("Не получилось получить данные:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
