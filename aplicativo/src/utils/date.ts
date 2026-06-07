export function formatLocalISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalISODate(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

export function addLocalDays(date: Date, days: number) {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

export function todayLocalISO() {
  return formatLocalISODate(new Date());
}
