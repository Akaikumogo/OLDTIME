import dayjs from 'dayjs';

const DAY_MINUTES = 24 * 60;

export function secondsToHuman(value?: number | null) {
  const seconds = Math.max(0, Number(value || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) return `${minutes} daq`;
  if (minutes === 0) return `${hours} soat`;
  return `${hours} soat ${minutes} daq`;
}

export function timeToMinutes(value?: string | null) {
  if (!value) return null;
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return Math.max(0, Math.min(DAY_MINUTES, hour * 60 + minute));
}

export function isoToMinutes(value: string) {
  const parsed = dayjs(value);
  if (!parsed.isValid()) return null;
  return parsed.hour() * 60 + parsed.minute() + parsed.second() / 60;
}

export function minutesToClock(value: number) {
  const clamped = Math.max(0, Math.min(DAY_MINUTES, Math.round(value)));
  const hour = Math.floor(clamped / 60) % 24;
  const minute = clamped % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function secondsBetweenClockTimes(start?: string | null, end?: string | null) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return 0;
  }
  return (endMinutes - startMinutes) * 60;
}
