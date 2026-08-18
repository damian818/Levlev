const today = new Date();
today.setHours(0,0,0,0);
const due = new Date("2026-08-20");
due.setHours(0,0,0,0);
const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 3600 * 24));
console.log(diffDays);
