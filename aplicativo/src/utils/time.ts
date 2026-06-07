const onlyDigits = (value: string) => value.replace(/\D/g, "");
const pad2 = (value: number) => value.toString().padStart(2, "0");

export function formatGoalTimeInput(raw: string) {
  const digits = onlyDigits(raw).slice(0, 4);

  if (digits.length <= 2) return digits;
  if (digits.length === 3) return `${digits.slice(0, 1)}:${digits.slice(1)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function isValidGoalTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export function normalizeGoalTime(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const digits = onlyDigits(trimmed);
  if (digits.length < 1 || digits.length > 4) return null;

  const hoursText =
    digits.length <= 2
      ? digits
      : digits.length === 3
        ? digits.slice(0, 1)
        : digits.slice(0, 2);
  const minutesText = digits.length <= 2 ? "00" : digits.slice(-2);
  const normalized = `${pad2(Number(hoursText))}:${pad2(Number(minutesText))}`;

  return isValidGoalTime(normalized) ? normalized : null;
}
