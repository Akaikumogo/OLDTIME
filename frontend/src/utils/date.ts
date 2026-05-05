import dayjs from 'dayjs';

export function getTodayISO() {
  return dayjs().format('YYYY-MM-DD');
}

export function formatDisplayDate(value: string) {
  return dayjs(value).format('DD.MM.YYYY');
}

export function formatDateTime(value: string) {
  return dayjs(value).format('DD.MM.YYYY HH:mm:ss');
}

export function formatClock(value?: string | null) {
  if (!value) return '-';
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('HH:mm') : value;
}

export function formatClockWithSeconds(value?: string | null) {
  if (!value) return '-';
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 8);
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('HH:mm:ss') : value;
}
