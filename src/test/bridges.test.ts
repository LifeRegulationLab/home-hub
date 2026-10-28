import { describe, expect, it } from 'vitest';
import { md5 } from '../lib/bridges/md5';
import { commandToDps, hmacSha256Hex, kindFromCategory, sha256Hex, stateFromDps, stringToSign } from '../lib/bridges/tuya';
import { capsFromGovee, goveeCapability, intToRgb, rgbToInt, stateFromGovee } from '../lib/bridges/govee';
import { purifierPayload, purifierStateFromResult } from '../lib/bridges/vesync';
import { pilotFromCommand, stateFromPilot } from '../lib/bridges/wiz';
import type { Thing } from '../lib/model';

const plug: Thing = { id: 'x', brand: 'tuya', externalId: 'd', name: 'Lamp', kind: 'plug', rooms: [], hidden: false, meta: {}, caps: ['power'] };
const robot: Thing = { ...plug, kind: 'vacuum', caps: ['vacuum', 'power'] };

describe('md5', () => {
  it('matches the known digests', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5('The quick brown fox jumps over the lazy dog')).toBe('9e107d9d372bb6826bd81d3542a419d6');
    expect(md5('password')).toBe('5f4dcc3b5aa765d61d8327deb882cf99');
  });
});

describe('tuya signing', () => {
  it('hashes an empty body to the published value', async () => {
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  it('builds the string to sign with the query sorted', () => {
    expect(stringToSign('GET', 'h', '/v1.0/token?grant_type=1')).toBe('GET\nh\n\n/v1.0/token?grant_type=1');
    expect(stringToSign('GET', 'h', '/v1.0/x?b=2&a=1')).toBe('GET\nh\n\n/v1.0/x?a=1&b=2');
    expect(stringToSign('POST', 'h', '/v1.0/x')).toBe('POST\nh\n\n/v1.0/x');
  });
  it('signs with HMAC-SHA256 in upper-case hex', async () => {
    expect(await hmacSha256Hex('key', 'The quick brown fox jumps over the lazy dog')).toBe('F7BC83F430538424B13298E6AA6FB143EF4D59A14946175997479DBC2D1A3CD8');
  });
  it('maps categories and data points', () => {
    expect(kindFromCategory('cz')).toBe('plug');
    expect(kindFromCategory('sd')).toBe('vacuum');
    expect(kindFromCategory('zzz')).toBeNull();
    const s = stateFromDps('plug', true, [{ code: 'switch_1', value: true }]);
    expect(s.on).toBe(true);
    const v = stateFromDps('vacuum', true, [
      { code: 'status', value: 'charging' },
      { code: 'residual_electricity', value: 82 },
      { code: 'fault', value: 32 },
    ]);
    expect(v.status).toBe('charging');
    expect(v.battery).toBe(82);
    expect(v.error).toContain('wheel');
  });
  it('turns commands into data points', () => {
    expect(commandToDps(plug, { type: 'power', on: false })).toEqual([{ code: 'switch_1', value: false }]);
    expect(commandToDps({ ...plug, meta: { switchCode: 'switch' } }, { type: 'power', on: true })).toEqual([{ code: 'switch', value: true }]);
    expect(commandToDps(robot, { type: 'vacuum', action: 'dock' })).toEqual([{ code: 'switch_charge', value: true }]);
    expect(commandToDps(robot, { type: 'vacuum', action: 'start' }).map((d) => d.code)).toEqual(['power', 'mode', 'switch_go']);
    expect(() => commandToDps(plug, { type: 'colour', r: 1, g: 2, b: 3 })).toThrow();
  });
});

describe('govee', () => {
  it('packs colours both ways', () => {
    expect(rgbToInt(255, 140, 60)).toBe(16747580);
    expect(intToRgb(16747580)).toEqual({ r: 255, g: 140, b: 60 });
  });
  it('reads capabilities and state', () => {
    const caps = [
      { type: 'devices.capabilities.on_off', instance: 'powerSwitch', state: { value: 1 } },
      { type: 'devices.capabilities.range', instance: 'brightness', state: { value: 40 } },
      { type: 'devices.capabilities.color_setting', instance: 'colorRgb', state: { value: 16747580 } },
      { type: 'devices.capabilities.online', instance: 'online', state: { value: true } },
    ];
    expect(capsFromGovee(caps)).toEqual(['power', 'brightness', 'colour']);
    const s = stateFromGovee(caps);
    expect(s).toMatchObject({ online: true, on: true, brightness: 40, colour: { r: 255, g: 140, b: 60 } });
  });
  it('clamps control values', () => {
    expect(goveeCapability({ type: 'brightness', value: 150 }).value).toBe(100);
    expect(goveeCapability({ type: 'temperature', kelvin: 100 }).value).toBe(2000);
    expect(goveeCapability({ type: 'power', on: false })).toEqual({ type: 'devices.capabilities.on_off', instance: 'powerSwitch', value: 0 });
  });
});

describe('vesync', () => {
  it('reads a purifier status', () => {
    const s = purifierStateFromResult(true, { enabled: true, level: 2, mode: 'manual', display: true, child_lock: false, filter_life: 62 });
    expect(s).toMatchObject({ on: true, speed: 2, mode: 'manual', display: true, lock: false, filterLife: 62 });
  });
  it('builds the app payloads', () => {
    expect(purifierPayload({ type: 'speed', value: 9 })).toEqual({ method: 'setLevel', data: { id: 0, level: 3, type: 'wind' } });
    expect(purifierPayload({ type: 'mode', value: 'sleep' })).toEqual({ method: 'setPurifierMode', data: { mode: 'sleep' } });
    expect(() => purifierPayload({ type: 'colour', r: 0, g: 0, b: 0 })).toThrow();
  });
});

describe('wiz', () => {
  it('builds pilots and reads them back', () => {
    expect(pilotFromCommand({ type: 'brightness', value: 5 })).toEqual({ state: true, dimming: 10 });
    expect(pilotFromCommand({ type: 'scene', id: '4' })).toEqual({ state: true, sceneId: 4 });
    const s = stateFromPilot({ state: true, dimming: 60, temp: 2700, sceneId: 11, mac: 'abc' });
    expect(s).toMatchObject({ on: true, brightness: 60, temperature: 2700, mode: 'Warm white' });
  });
});
