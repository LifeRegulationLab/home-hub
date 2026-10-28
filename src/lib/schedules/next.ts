import type { Schedule, When } from '../model';
import { sunTimes } from './sun';

export interface Place {
  lat: number;
  lon: number;
}

function sameDayAt(day: Date, hhmm: string): Date {
  const [h = '0', m = '0'] = hhmm.split(':');
  const d = new Date(day);
  d.setHours(Number(h), Number(m), 0, 0);
  return d;
}

/** The moment a `when` lands on a given day, or null when the sun does not rise or set there. Pure. */
export function whenOnDay(when: When, day: Date, place: Place | null): Date | null {
  if (when.kind === 'time') return sameDayAt(day, when.hhmm);
  if (!place) return null;
  const sun = sunTimes(day, place.lat, place.lon);
  if (!sun) return null;
  const base = when.kind === 'sunset' ? sun.sunset : sun.sunrise;
  return new Date(base.getTime() + when.offsetMin * 60_000);
}

export function dayAllowed(s: Schedule, day: Date): boolean {
  const dow = day.getDay();
  switch (s.repeat) {
    case 'daily':
    case 'once':
      return true;
    case 'weekdays':
      return dow >= 1 && dow <= 5;
    case 'weekends':
      return dow === 0 || dow === 6;
    case 'days':
      return s.days.includes(dow);
  }
}

/** The next `count` times a schedule will run after `from`. Pure. */
export function nextRuns(s: Schedule, from: Date, place: Place | null, count = 3): Date[] {
  const out: Date[] = [];
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  for (let i = 0; i < 400 && out.length < count; i++) {
    if (dayAllowed(s, day)) {
      const at = whenOnDay(s.when, day, place);
      if (at && at.getTime() > from.getTime()) {
        out.push(at);
        if (s.repeat === 'once') break;
      }
    }
    day.setDate(day.getDate() + 1);
  }
  return out;
}

/** Schedules that should run now: due since `lastChecked` and not run for this moment already. Pure. */
export function dueNow(schedules: Schedule[], lastChecked: Date, now: Date, place: Place | null): Schedule[] {
  const due: Schedule[] = [];
  for (const s of schedules) {
    if (!s.enabled || s.pushedTo) continue;
    const runs = nextRuns(s, new Date(lastChecked.getTime() - 1), place, 1);
    const at = runs[0];
    if (!at) continue;
    if (at.getTime() <= now.getTime() && (s.lastRun ?? 0) < at.getTime()) due.push(s);
  }
  return due;
}
