import type { Command, Thing, ThingState } from '../model';
import { http } from '../http';
import { getSecret, setSecret } from '../secrets';
import { BridgeError, nowState, type Bridge, type Found } from './types';
import { vacuumStateFromTuya } from '../vacuum/status';

/**
 * Tuya Cloud: the Gosund plugs and the Ultenic robot, once they are in the Smart Life app and the
 * account is linked to a free Tuya developer project. Requests are signed with HMAC-SHA256 as Tuya's
 * "Sign Request" page describes; the Access ID and Secret live in the keychain.
 */
export const TUYA_HOSTS = {
  eu: 'https://openapi.tuyaeu.com',
  us: 'https://openapi.tuyaus.com',
  cn: 'https://openapi.tuyacn.com',
  in: 'https://openapi.tuyain.com',
} as const;
export type TuyaRegion = keyof typeof TUYA_HOSTS;

const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(text: string): Promise<string> {
  if (!text) return EMPTY_SHA256;
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

export async function hmacSha256Hex(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text))).toUpperCase();
}

/** The string Tuya signs: method, body hash, (no signature headers), path with sorted query. Pure. */
export function stringToSign(method: string, bodyHash: string, pathWithQuery: string): string {
  const [path = '', query = ''] = pathWithQuery.split('?');
  const sorted = query
    ? query
        .split('&')
        .filter(Boolean)
        .sort((a, b) => (a.split('=')[0] ?? '').localeCompare(b.split('=')[0] ?? ''))
        .join('&')
    : '';
  return `${method}\n${bodyHash}\n\n${sorted ? `${path}?${sorted}` : path}`;
}

interface TuyaReply {
  success: boolean;
  result?: unknown;
  msg?: string;
  code?: number;
}

export interface TuyaKeys {
  accessId: string;
  accessSecret: string;
  region: TuyaRegion;
}

interface Token {
  value: string;
  expiresAt: number;
}

export class TuyaClient {
  private token: Token | null = null;

  constructor(private keys: TuyaKeys) {}

  private host(): string {
    return TUYA_HOSTS[this.keys.region];
  }

  private async call(method: 'GET' | 'POST', pathWithQuery: string, body?: unknown, withToken = true): Promise<unknown> {
    const t = String(Date.now());
    const bodyText = body === undefined ? '' : JSON.stringify(body);
    const sts = stringToSign(method, await sha256Hex(bodyText), pathWithQuery);
    const access = withToken ? (await this.accessToken()).value : '';
    const sign = await hmacSha256Hex(this.keys.accessSecret, `${this.keys.accessId}${access}${t}${sts}`);
    const headers: Record<string, string> = {
      client_id: this.keys.accessId,
      sign,
      t,
      sign_method: 'HMAC-SHA256',
      ...(withToken ? { access_token: access } : {}),
    };
    const r = await http({ method, url: this.host() + pathWithQuery, headers, ...(body !== undefined ? { body: bodyText } : {}) });
    const reply = r.data as TuyaReply;
    if (!reply || typeof reply !== 'object') throw new BridgeError('Tuya did not answer');
    if (!reply.success) throw new BridgeError(`Tuya: ${reply.msg ?? 'request refused'} (${reply.code ?? r.status})`);
    return reply.result;
  }

  async accessToken(): Promise<Token> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token;
    const saved = await getSecret('tuya.token');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Token;
        if (parsed.expiresAt > Date.now() + 60_000) {
          this.token = parsed;
          return parsed;
        }
      } catch {
        // A bad saved token is just fetched again.
      }
    }
    const result = (await this.call('GET', '/v1.0/token?grant_type=1', undefined, false)) as { access_token: string; expire_time: number };
    this.token = { value: result.access_token, expiresAt: Date.now() + result.expire_time * 1000 };
    await setSecret('tuya.token', JSON.stringify(this.token));
    return this.token;
  }

  /** The devices the linked Smart Life account owns. */
  async devices(): Promise<TuyaDevice[]> {
    const result = (await this.call('GET', '/v1.3/iot-03/devices?page_size=100')) as { list?: TuyaDevice[] } | TuyaDevice[];
    return Array.isArray(result) ? result : (result.list ?? []);
  }

  async status(deviceId: string): Promise<TuyaDp[]> {
    return (await this.call('GET', `/v1.0/iot-03/devices/${deviceId}/status`)) as TuyaDp[];
  }

  async commands(deviceId: string, commands: { code: string; value: unknown }[]): Promise<void> {
    await this.call('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, { commands });
  }

  /** The device's instruction set, used once to learn what the robot reports. */
  async functions(deviceId: string): Promise<unknown> {
    return this.call('GET', `/v1.0/iot-03/devices/${deviceId}/specification`);
  }
}

export interface TuyaDevice {
  id: string;
  name: string;
  category: string;
  product_name?: string;
  online: boolean;
  status?: TuyaDp[];
}

export interface TuyaDp {
  code: string;
  value: unknown;
}

const PLUG_CATEGORIES = new Set(['cz', 'pc', 'kg', 'tdq']);
const VACUUM_CATEGORIES = new Set(['sd']);

export function kindFromCategory(category: string): Thing['kind'] | null {
  if (PLUG_CATEGORIES.has(category)) return 'plug';
  if (VACUUM_CATEGORIES.has(category)) return 'vacuum';
  if (category === 'dj' || category === 'dd' || category === 'xdd') return 'light';
  if (category === 'kj') return 'purifier';
  return null;
}

/** Turns Tuya's data points into our state. Pure. */
export function stateFromDps(kind: Thing['kind'], online: boolean, dps: TuyaDp[]): ThingState {
  const map = new Map(dps.map((d) => [d.code, d.value]));
  const s = nowState({ online });
  if (kind === 'vacuum') return { ...s, ...vacuumStateFromTuya(map) };
  const sw = map.get('switch_1') ?? map.get('switch') ?? map.get('switch_led');
  if (typeof sw === 'boolean') s.on = sw;
  const bright = map.get('bright_value_v2') ?? map.get('bright_value');
  if (typeof bright === 'number') s.brightness = Math.round(bright / 10);
  return s;
}

export function commandToDps(thing: Thing, command: Command, usualSuction?: string): { code: string; value: unknown }[] {
  const sw = thing.meta['switchCode'] ?? 'switch_1';
  switch (command.type) {
    case 'power':
      if (thing.kind === 'vacuum') return [{ code: 'power', value: command.on }];
      return [{ code: sw, value: command.on }];
    case 'brightness':
      return [{ code: thing.meta['brightCode'] ?? 'bright_value_v2', value: command.value * 10 }];
    case 'vacuum':
      switch (command.action) {
        case 'start':
          return [
            { code: 'power', value: true },
            { code: 'mode', value: command.value ?? 'smart' },
            { code: 'switch_go', value: true },
          ];
        case 'pause':
          return [{ code: 'switch_go', value: false }];
        case 'dock':
          return [{ code: 'switch_charge', value: true }];
        case 'locate':
          return [{ code: 'seek', value: true }];
        case 'suction':
          return [{ code: 'suction', value: command.value ?? usualSuction ?? 'normal' }];
        case 'water':
          return [{ code: 'cistern', value: command.value ?? 'middle' }];
        case 'mode':
          return [{ code: 'mode', value: command.value ?? 'smart' }];
      }
      break;
    default:
      break;
  }
  throw new BridgeError('This thing cannot do that');
}

export class TuyaBridge implements Bridge {
  brand = 'tuya' as const;
  private client: TuyaClient | null = null;

  constructor(private region: TuyaRegion) {}

  private async getClient(): Promise<TuyaClient> {
    if (this.client) return this.client;
    const accessId = await getSecret('tuya.accessId');
    const accessSecret = await getSecret('tuya.accessSecret');
    if (!accessId || !accessSecret) throw new BridgeError('Smart Life keys are not set');
    this.client = new TuyaClient({ accessId, accessSecret, region: this.region });
    return this.client;
  }

  async ready(): Promise<boolean> {
    return Boolean((await getSecret('tuya.accessId')) && (await getSecret('tuya.accessSecret')));
  }

  async discover(): Promise<Found[]> {
    const client = await this.getClient();
    const devices = await client.devices();
    const found: Found[] = [];
    for (const d of devices) {
      const kind = kindFromCategory(d.category);
      if (!kind) continue;
      const dps = d.status ?? (await client.status(d.id));
      const codes = new Set(dps.map((x) => x.code));
      const meta: Record<string, string> = { category: d.category, product: d.product_name ?? '' };
      if (codes.has('switch')) meta['switchCode'] = 'switch';
      if (codes.has('switch_led')) meta['switchCode'] = 'switch_led';
      found.push({
        externalId: d.id,
        name: d.name,
        kind,
        caps: kind === 'vacuum' ? ['vacuum', 'power'] : codes.has('bright_value_v2') || codes.has('bright_value') ? ['power', 'brightness'] : ['power'],
        meta,
        state: stateFromDps(kind, d.online, dps),
      });
    }
    return found;
  }

  async read(thing: Thing): Promise<ThingState> {
    const client = await this.getClient();
    const dps = await client.status(thing.externalId);
    return stateFromDps(thing.kind, true, dps);
  }

  async send(thing: Thing, command: Command): Promise<void> {
    const client = await this.getClient();
    await client.commands(thing.externalId, commandToDps(thing, command));
  }

  /** Raw data points, for the robot's page to learn what the model reports. */
  async specification(thing: Thing): Promise<unknown> {
    return (await this.getClient()).functions(thing.externalId);
  }
}
