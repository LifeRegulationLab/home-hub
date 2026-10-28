import type { Command, Thing, ThingState } from '../model';
import { http } from '../http';
import { getSecret } from '../secrets';
import { BridgeError, nowState, type Bridge, type Found } from './types';

/** Govee's official Developer API (beta). One key, applied for inside Govee Home. */
const HOST = 'https://openapi.api.govee.com';

interface GoveeCap {
  type: string;
  instance: string;
  state?: { value?: unknown };
  parameters?: { range?: { min: number; max: number } };
}
interface GoveeDevice {
  sku: string;
  device: string;
  deviceName: string;
  type?: string;
  capabilities: GoveeCap[];
}

export function rgbToInt(r: number, g: number, b: number): number {
  return ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
}
export function intToRgb(v: number): { r: number; g: number; b: number } {
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

/** Govee's capability list to our caps. Pure. */
export function capsFromGovee(caps: GoveeCap[]): Thing['caps'] {
  const out = new Set<Thing['caps'][number]>();
  for (const c of caps) {
    if (c.type.endsWith('on_off')) out.add('power');
    if (c.instance === 'brightness') out.add('brightness');
    if (c.instance === 'colorRgb') out.add('colour');
    if (c.instance === 'colorTemperatureK') out.add('temperature');
    if (c.type.endsWith('dynamic_scene')) out.add('scene');
  }
  return [...out];
}

export function stateFromGovee(caps: GoveeCap[]): ThingState {
  const s = nowState();
  for (const c of caps) {
    const v = c.state?.value;
    if (c.type.endsWith('online')) s.online = v === true || v === 'true';
    else if (c.instance === 'powerSwitch' && typeof v === 'number') s.on = v === 1;
    else if (c.instance === 'brightness' && typeof v === 'number') s.brightness = v;
    else if (c.instance === 'colorRgb' && typeof v === 'number') s.colour = intToRgb(v);
    else if (c.instance === 'colorTemperatureK' && typeof v === 'number' && v > 0) s.temperature = v;
  }
  return s;
}

export function goveeCapability(command: Command): { type: string; instance: string; value: unknown } {
  switch (command.type) {
    case 'power':
      return { type: 'devices.capabilities.on_off', instance: 'powerSwitch', value: command.on ? 1 : 0 };
    case 'brightness':
      return { type: 'devices.capabilities.range', instance: 'brightness', value: Math.max(1, Math.min(100, Math.round(command.value))) };
    case 'colour':
      return { type: 'devices.capabilities.color_setting', instance: 'colorRgb', value: rgbToInt(command.r, command.g, command.b) };
    case 'temperature':
      return { type: 'devices.capabilities.color_setting', instance: 'colorTemperatureK', value: Math.max(2000, Math.min(9000, Math.round(command.kelvin))) };
    case 'scene':
      return { type: 'devices.capabilities.dynamic_scene', instance: 'lightScene', value: Number(command.id) };
    default:
      throw new BridgeError('This light cannot do that');
  }
}

export class GoveeBridge implements Bridge {
  brand = 'govee' as const;

  private async headers(): Promise<Record<string, string>> {
    const key = await getSecret('govee.apiKey');
    if (!key) throw new BridgeError('Govee key is not set');
    return { 'Govee-API-Key': key, 'Content-Type': 'application/json' };
  }

  async ready(): Promise<boolean> {
    return Boolean(await getSecret('govee.apiKey'));
  }

  async discover(): Promise<Found[]> {
    const r = await http({ method: 'GET', url: `${HOST}/router/api/v1/user/devices`, headers: await this.headers() });
    if (r.status === 401) throw new BridgeError('Govee refused the key');
    const data = (r.data as { data?: GoveeDevice[] }).data ?? [];
    const found: Found[] = [];
    for (const d of data) {
      const kind: Thing['kind'] = d.type?.includes('purifier') ? 'purifier' : d.type?.includes('socket') ? 'plug' : 'light';
      found.push({
        externalId: d.device,
        name: d.deviceName,
        kind,
        caps: capsFromGovee(d.capabilities),
        meta: { sku: d.sku },
        state: nowState(),
      });
    }
    return found;
  }

  async read(thing: Thing): Promise<ThingState> {
    const r = await http({
      method: 'POST',
      url: `${HOST}/router/api/v1/device/state`,
      headers: await this.headers(),
      body: { requestId: crypto.randomUUID(), payload: { sku: thing.meta['sku'], device: thing.externalId } },
    });
    const caps = (r.data as { payload?: { capabilities?: GoveeCap[] } }).payload?.capabilities ?? [];
    return stateFromGovee(caps);
  }

  async send(thing: Thing, command: Command): Promise<void> {
    const r = await http({
      method: 'POST',
      url: `${HOST}/router/api/v1/device/control`,
      headers: await this.headers(),
      body: { requestId: crypto.randomUUID(), payload: { sku: thing.meta['sku'], device: thing.externalId, capability: goveeCapability(command) } },
    });
    if (r.status === 429) throw new BridgeError('Govee: too many requests, wait a moment');
    if (r.status >= 400) throw new BridgeError(`Govee refused (${r.status})`);
  }
}
