interface Task {
  id: number;
  title: string;
  done: boolean;
  deadline?: string; // optional field
}

const tasks: Task[] = [
  { id: 1, title: "Сделать ДЗ по Git", done: true },
  { id: 2, title: "Повторить типы", done: false, deadline: "11.11" },
  { id: 3, title: "Записаться на теннис", done: false, deadline: "12.11" },
  { id: 4, title: "Сходить с сыном в парк", done: false, deadline: "15.11" },
  { id: 5, title: "Съездить в ТРЦ", done: false },
];

function addTask(list: Task[], title: string): Task {
  const task: Task = { id: list.length + 1, title, done: false };
  list.push(task);
  return task;
}

function completeTask(list: Task[], id: number): void {
  const task = list.find((t) => t.id === id);
  if (task) {
    task.done = true;
  }
}

function pending(list: Task[]): Task[] {
  return list.filter((t) => !t.done);
}

function taxiPrice(km: number, pricePerKm: number = 150): number {
  return km * pricePerKm;
}

function minutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} ч ${m} мин`;
}

console.log(taxiPrice(8));
console.log(minutesToHours(135));

addTask(tasks, "Посмотреть запись урока");
completeTask(tasks, 2);
console.log(pending(tasks)); // выводятся 4 невыполненные задачи: id 3, 4, 5 и 6