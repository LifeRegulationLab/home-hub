import { describe, expect, it } from 'vitest';
import { defaultVacuum } from '../lib/model';
import { addClean, lastWeek, partDone, partsDue } from '../lib/vacuum/parts';
import { faultWords, inQuietHours, statusLine } from '../lib/vacuum/status';
import { applyLocally, roomCommands, sceneFromNow } from '../lib/scenes';
import { showcaseState } from '../lib/showcase';
import { countOn, readState } from '../lib/model';

describe('status words', () => {
  it('says what the robot is doing', () => {
    expect(statusLine('Dustin', undefined)).toBe('Dustin: not answering');
    expect(statusLine('Dustin', { online: true, status: 'charging', battery: 82, seenAt: 0 })).toBe('Dustin: charging, 82%');
    expect(statusLine('Dustin', { online: true, status: 'cleaning', cleanTime: 12, seenAt: 0 })).toBe('Dustin: cleaning, 12 minutes in');
    expect(statusLine('Dustin', { online: true, error: 'I am stuck; give me a hand', seenAt: 0 })).toBe('Dustin: I am stuck; give me a hand');
  });
  it('turns fault bits into sentences', () => {
    expect(faultWords(32)).toContain('wheel');
    expect(faultWords(4096)).toBe('Fault 4096');
  });
  it('knows quiet hours across midnight', () => {
    expect(inQuietHours('23:00', '22:00', '08:00')).toBe(true);
    expect(inQuietHours('03:00', '22:00', '08:00')).toBe(true);
    expect(inQuietHours('12:00', '22:00', '08:00')).toBe(false);
    expect(inQuietHours('12:00', '09:00', '09:00')).toBe(false);
  });
});

describe('parts and history', () => {
  it('counts cleans left and resets a part', () => {
    let v = defaultVacuum();
    v = addClean(v, { startedAt: 1, minutes: 45, area: 40, finished: true });
    const bin = partsDue(v).find((p) => p.id === 'bin');
    expect(bin?.cleansLeft).toBe(Math.floor((10 * 60 - 45) / 45));
    v = partDone(v, 'bin');
    expect(partsDue(v).find((p) => p.id === 'bin')?.percentUsed).toBe(0);
    expect(v.history).toHaveLength(1);
  });
  it('builds a seven-day view', () => {
    const week = lastWeek(showcaseState().vacuum.history, Date.now());
    expect(week).toHaveLength(7);
    expect(week.reduce((a, d) => a + d.cleans, 0)).toBeGreaterThan(0);
  });
});

describe('scenes and state', () => {
  const state = showcaseState();
  it('saves how the house is now', () => {
    const scene = sceneFromNow(state, 'Now');
    expect(scene.steps.some((s) => s.thingId === 'd1')).toBe(false);
    expect(scene.steps.find((s) => s.thingId === 'w1' && s.command.type === 'brightness')).toBeTruthy();
  });
  it('sends power to a room and not the robot', () => {
    const steps = roomCommands(state.things, false);
    expect(steps.some((s) => s.thingId === 'd1')).toBe(false);
    expect(steps.every((s) => s.command.type === 'power')).toBe(true);
  });
  it('applies a command locally', () => {
    expect(applyLocally(undefined, { type: 'brightness', value: 30 })).toMatchObject({ on: true, brightness: 30 });
    expect(applyLocally({ online: true, seenAt: 0 }, { type: 'vacuum', action: 'locate' }).status).toBeUndefined();
  });
  it('counts what is on and reads an old save', () => {
    expect(countOn(state)).toEqual({ on: 7, offline: 1 });
    expect(readState({ rooms: [] }).rooms).toEqual([]);
    expect(readState('nonsense').rooms.length).toBe(4);
  });
});
