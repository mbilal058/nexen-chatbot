const PAKISTAN_TIME_ZONE = "Asia/Karachi";

const pakistanTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PAKISTAN_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const pakistanDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PAKISTAN_TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

function validDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatPakistanTime(value: string | Date): string {
  const date = validDate(value);
  return date ? `${pakistanTimeFormatter.format(date)} PKT` : "—";
}

export function formatPakistanDateTime(value: string | Date): string {
  const date = validDate(value);
  return date ? `${pakistanDateTimeFormatter.format(date)} PKT` : "—";
}