// Статус занятия может быть только одним из трёх слов: запланировано, сделано или пропущено
type ActivityStatus = "planned" | "done" | "skipped";

// Описание одного занятия, которое родитель делает с ребёнком
interface Activity {
  // Номер занятия, у каждого свой
  id: number;
  // Название занятия, например «Лепка из пластилина»
  title: string;
  // С какого возраста ребёнку подходит занятие (в месяцах)
  fromAgeMonths: number;
  // До какого возраста занятие ещё интересно (в месяцах)
  toAgeMonths: number;
  // Сколько минут занимает занятие
  durationMin: number;
  // Нужен ли родитель рядом: true — да, false — ребёнок может сам
  withParent: boolean;
  // Что сейчас с занятием: запланировано, сделано или пропущено
  status: ActivityStatus;
}

// Список из трёх примеров занятий
const activities: Activity[] = [
  // Сказка перед сном: от 1 года до 4 лет, 15 минут, с родителем, уже сделана
  { id: 1, title: "Чтение сказки перед сном", fromAgeMonths: 12, toAgeMonths: 48, durationMin: 15, withParent: true, status: "done" },
  // Лепка: от 2 до 5 лет, 30 минут, с родителем, ещё впереди
  { id: 2, title: "Лепка из пластилина", fromAgeMonths: 24, toAgeMonths: 60, durationMin: 30, withParent: true, status: "planned" },
  // Пазл из 4 деталей: от 1,5 до 3 лет, 10 минут, ребёнок справится сам, ещё впереди
  { id: 3, title: "Сбор пазла из 4 деталей", fromAgeMonths: 18, toAgeMonths: 36, durationMin: 10, withParent: false, status: "planned" },
];

// Функция берёт список занятий и возраст ребёнка и возвращает только те занятия, которые ещё предстоит сделать и которые подходят по возрасту
function getPlannedForAge(list: Activity[], childAgeMonths: number): Activity[] {
  // Оставляем занятие, только если оно запланировано и возраст ребёнка попадает между «с какого» и «до какого»
  return list.filter(
    (a) => a.status === "planned" && a.fromAgeMonths <= childAgeMonths && childAgeMonths <= a.toAgeMonths,
  );
}
