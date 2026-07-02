import type { SyncStatus, TimeSeriesPoint } from '../types';

export function formatCooldown(totalSeconds: number) {
  if (totalSeconds <= 0) {
    return '곧';
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}초`;
  }

  return `${minutes}분 ${seconds.toString().padStart(2, '0')}초`;
}

export function getRemainingCooldownSeconds(syncStatus: SyncStatus | null, nowMs: number) {
  if (!syncStatus?.nextAllowedAt) {
    return 0;
  }

  return Math.max(0, Math.ceil((new Date(syncStatus.nextAllowedAt).getTime() - nowMs) / 1000));
}

export function getSeoulDateString(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '00';
  const day = parts.find((part) => part.type === 'day')?.value ?? '00';
  return `${year}-${month}-${day}`;
}

export function getSeoulTimeString(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

export function hasMissingRecentWeekday(series: TimeSeriesPoint[], today: string) {
  if (series.length === 0) {
    return false;
  }

  const existingDates = new Set(series.map((point) => point.baseDate));
  for (let daysBack = 1; daysBack <= 7; daysBack += 1) {
    const date = addDaysToDateString(today, -daysBack);
    if (isWeekdayDateString(date) && !existingDates.has(date)) {
      return true;
    }
  }

  return false;
}

export function isWeekdayString(dateValue: string) {
  const [year, month, dayOfMonth] = dateValue.split('-').map(Number);
  const day = new Date(Date.UTC(year, month - 1, dayOfMonth, 12)).getUTCDay();
  return day >= 1 && day <= 5;
}

export function getPreviousDateString(dateValue: string) {
  const [year, month, dayOfMonth] = dateValue.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, dayOfMonth, 12));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul'
  }).format(new Date(value));
}

function addDaysToDateString(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

function isWeekdayDateString(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dayOfWeek !== 0 && dayOfWeek !== 6;
}
