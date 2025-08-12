import { format } from 'date-fns';

export function toDateKey(epochMs: number): string {
  return format(epochMs, 'yyyy-MM-dd');
}

export function formatTime(epochMs: number): string {
  return format(epochMs, 'p');
}

export function mlToOz(ml: number): number {
  return Math.round((ml / 29.5735) * 10) / 10;
}

export function ozToMl(oz: number): number {
  return Math.round(oz * 29.5735);
}

export function nowMs(): number {
  return Date.now();
}

export function generateId(prefix: string = ''): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}