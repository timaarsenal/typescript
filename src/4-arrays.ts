// ДЗ: массивы и типы
// Запуск: npm run arrays
//
// Над каждым console.log: прогноз (до запуска) и результат (после запуска).

// ===== Часть 1. Массив с фруктами (код Рустема) =====

const xyz: string[] = ["apple", "banana", "chery"];
// Прогноз: [ 'apple', 'banana', 'chery' ]
// Результат: [ 'apple', 'banana', 'chery' ]: совпало
console.log(xyz);

xyz.push("orange");
// Прогноз: [ 'apple', 'banana', 'chery', 'orange' ]: push добавляет в конец
// Результат: [ 'apple', 'banana', 'chery', 'orange' ]: совпало
console.log(xyz);

xyz.splice(2, 1, "kiwi", "peach");
// Прогноз: [ 'apple', 'banana', 'kiwi', 'peach', 'orange' ]: на месте 2 убрали 'chery', вставили два новых
// Результат: [ 'apple', 'banana', 'kiwi', 'peach', 'orange' ]: совпало
console.log(xyz);

// Прогноз: 5
// Результат: 5: совпало
console.log(xyz.length);

xyz.splice(0, xyz.length - 1);
// Прогноз: [ 'orange' ]: удаляем с начала 4 элемента из 5, остаётся последний
// Результат: [ 'orange' ]: совпало
console.log(xyz);

xyz.push("alice", "bob");
// Прогноз: [ 'orange', 'alice', 'bob' ]
// Результат: [ 'orange', 'alice', 'bob' ]: совпало
console.log(xyz);

// Прогноз: orange: shift убирает первый элемент и возвращает его
// Результат: orange: совпало
console.log(xyz.shift());

// Прогноз: [ 'alice', 'bob' ]
// Результат: [ 'alice', 'bob' ]: совпало
console.log(xyz);

// ===== Часть 2. Типы (код Куралай) =====
// У Куралай третья переменная тоже называлась xyz, но в одном файле
// два xyz объявить нельзя (имя уже занято массивом выше), поэтому
// здесь она переименована в isLess.

let abc: number = 3.14;
// Прогноз: 3.14
// Результат: 3.14: совпало
console.log(abc);

let def: string = (15).toString();
// Прогноз: 15 (но это уже строка "15", а не число)
// Результат: 15: совпало
console.log(def);

let isLess: boolean = abc < 2;
// Прогноз: false: 3.14 не меньше 2
// Результат: false: совпало
console.log(isLess);

// ===== Часть 3. Мои 3 новые операции над массивом =====
// Отдельный массив, потому что xyz к этому моменту уже почти пустой.

const fruits: string[] = ["apple", "banana", "chery"];

// includes: проверяет, есть ли элемент в массиве
// Прогноз: true
// Результат: true: совпало
console.log(fruits.includes("banana"));

// map: делает новый массив, изменив каждый элемент
// Прогноз: [ 'APPLE', 'BANANA', 'CHERY' ]
// Результат: [ 'APPLE', 'BANANA', 'CHERY' ]: совпало
console.log(fruits.map((f) => f.toUpperCase()));

// at: берёт элемент по номеру, отрицательный номер считается с конца
// Прогноз: chery
// Результат: chery: совпало
console.log(fruits.at(-1));

// ===== Часть 4. const ↔ let =====
// Поменял везде const на let и let на const: ошибок не появилось.
// Почему: const запрещает только присвоить переменной новое значение
// (знак =). push, splice и shift не присваивают новый массив, они меняют
// содержимое того же самого массива, поэтому с const это можно.
// А abc, def, isLess нигде не получают нового значения, поэтому
// их тоже спокойно можно сделать const.
// Ошибка появляется, только если написать, например:
//   const abc = 3.14;
//   abc = 5;   // TS: Cannot assign to 'abc' because it is a constant
//              // Node: TypeError: Assignment to constant variable
