// Такси на теннис: расстояние в км, число поездок в месяц, цена за км
function tennisTaxiCost (km: number, rides: number, pricePerKm: number = 150): number {
  return km * pricePerKm * rides;
}

// День с сыном в ТРЦ: билет на ЛРТ туда-обратно на всех + еда + развлечения
function mallDayBudget(
  lrtFare: number,
  people: number,
  food: number,
  fun: number = 0,
): number {
  return lrtFare * people * 2 + food + fun;
}

// Прогулка в парке с сыном: минуты -> часы и минуты
function minutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} ч ${m} мин`;
}

console.log(tennisTaxiCost(12, 8)); // 14400
console.log(mallDayBudget(200, 2, 4500, 2000)); // 7300
console.log(minutesToHours(135)); // 2 ч 15 мин
