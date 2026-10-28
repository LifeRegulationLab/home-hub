import { describe, expect, it } from 'vitest';
import type { Schedule, State } from '../lib/model';
import { dueNow, nextRuns, whenOnDay } from '../lib/schedules/next';
import { sunTimes } from '../lib/schedules/sun';
import { runWords, scheduleSentence } from '../lib/schedules/words';
import { showcaseState } from '../lib/showcase';
import { stepsFor } from '../lib/schedules/runner';

const guernsey = { lat: 49.45, lon: -2.58 };

function sched(partial: Partial<Schedule>): Schedule {
  return { id: 's', target: { kind: 'thing', id: 't2' }, command: { type: 'power', on: true }, when: { kind: 'time', hhmm: '17:30' }, repeat: 'daily', days: [], enabled: true, ...partial };
}

describe('sun', () => {
  it('puts a Guernsey sunset in late October just before 17:00 UTC', () => {
    const t = sunTimes(new Date(2026, 9, 28), guernsey.lat, guernsey.lon);
    expect(t).not.toBeNull();
    const h = (t?.sunset.getUTCHours() ?? 0) + (t?.sunset.getUTCMinutes() ?? 0) / 60;
    expect(h).toBeGreaterThan(16.7);
    expect(h).toBeLessThan(17.3);
  });
  it('gives null where the sun does not set', () => {
    expect(sunTimes(new Date(2026, 5, 21), 80, 0)).toBeNull();
  });
});

describe('next runs', () => {
  it('lists the next three daily runs after now', () => {
    const from = new Date(2026, 9, 28, 18, 0);
    const runs = nextRuns(sched({}), from, null, 3);
    expect(runs.map((r) => r.getDate())).toEqual([29, 30, 31]);
    expect(runs[0]?.getHours()).toBe(17);
  });
  it('keeps to weekdays and chosen days', () => {
    const from = new Date(2026, 9, 30, 20, 0); // Friday evening
    expect(nextRuns(sched({ repeat: 'weekdays' }), from, null, 1)[0]?.getDay()).toBe(1);
    expect(nextRuns(sched({ repeat: 'weekends' }), from, null, 1)[0]?.getDay()).toBe(6);
    expect(nextRuns(sched({ repeat: 'days', days: [3] }), from, null, 1)[0]?.getDay()).toBe(3);
  });
  it('runs once then stops', () => {
    expect(nextRuns(sched({ repeat: 'once' }), new Date(2026, 9, 28, 9, 0), null, 3)).toHaveLength(1);
  });
  it('needs a place for sunset', () => {
    expect(whenOnDay({ kind: 'sunset', offsetMin: -30 }, new Date(2026, 9, 28), null)).toBeNull();
    const at = whenOnDay({ kind: 'sunset', offsetMin: -30 }, new Date(2026, 9, 28), guernsey);
    expect(at).not.toBeNull();
  });
  it('finds what is due since the last check and not run yet', () => {
    const a = sched({ id: 'a', when: { kind: 'time', hhmm: '17:30' } });
    const b = sched({ id: 'b', when: { kind: 'time', hhmm: '19:00' } });
    const ran = sched({ id: 'c', when: { kind: 'time', hhmm: '17:30' }, lastRun: new Date(2026, 9, 28, 17, 30).getTime() });
    const pushed = sched({ id: 'd', pushedTo: 'Smart Life' });
    const due = dueNow([a, b, ran, pushed], new Date(2026, 9, 28, 17, 29), new Date(2026, 9, 28, 17, 31), null);
    expect(due.map((s) => s.id)).toEqual(['a']);
  });
});

describe('words', () => {
  const state: State = showcaseState();
  it('reads as one sentence', () => {
    expect(scheduleSentence(state, sched({}))).toBe('Bedroom salt lamp on at 17:30 every day');
    expect(scheduleSentence(state, sched({ when: { kind: 'sunset', offsetMin: -30 }, repeat: 'weekdays' }))).toBe('Bedroom salt lamp on 30 minutes before sunset on weekdays');
    expect(scheduleSentence(state, sched({ target: { kind: 'scene', id: 's1' }, command: null, when: { kind: 'time', hhmm: '23:00' } }))).toBe('Bedtime runs at 23:00 every day');
  });
  it('says when in plain words', () => {
    const now = new Date(2026, 9, 28, 12, 0);
    expect(runWords(new Date(2026, 9, 28, 17, 30), now)).toBe('Tonight 17:30');
    expect(runWords(new Date(2026, 9, 29, 7, 0), now)).toBe('Tomorrow 07:00');
    expect(runWords(new Date(2026, 9, 31, 7, 0), now)).toBe('Saturday 07:00');
  });
  it('expands a room schedule to its things', () => {
    const steps = stepsFor(state, sched({ target: { kind: 'room', id: 'bedroom' }, command: { type: 'power', on: false } }));
    expect(steps.map((s) => s.thingId).sort()).toEqual(['t2', 't3', 'v2']);
  });
});
