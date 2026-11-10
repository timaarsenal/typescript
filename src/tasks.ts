// Мои задачи на неделю
interface WeekTask {
  id: number;
  title: string;
  done: boolean;
  withSon: boolean; // идём ли с сыном
  deadline?: string; // необязательное поле
}

const weekTasks: WeekTask[] = [
  { id: 1, title: "Съездить на теннис на такси", done: false, withSon: false, deadline: "12.11" },
  { id: 2, title: "Поехать с сыном в ТРЦ на ЛРТ", done: false, withSon: true, deadline: "14.11" },
  { id: 3, title: "Погулять с сыном в парке", done: false, withSon: true, deadline: "15.11" },
];

function markDone(list: WeekTask[], id: number): void {
  const task = list.find((t) => t.id === id);
  if (task) {
    task.done = true;
  }
}

function pendingWeekTasks(list: WeekTask[]): WeekTask[] {
  return list.filter((t) => !t.done);
}

function tasksWithSon(list: WeekTask[]): WeekTask[] {
  return list.filter((t) => t.withSon);
}

markDone(weekTasks, 1);
console.log(pendingWeekTasks(weekTasks)); // остались 2 задачи: ТРЦ и парк
console.log(tasksWithSon(weekTasks).length); // 2 задачи с сыном
