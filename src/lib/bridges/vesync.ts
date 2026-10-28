import type { Command, Thing, ThingState } from '../model';
import { http } from '../http';
import { getSecret, setSecret } from '../secrets';
import { md5 } from './md5';
import { BridgeError, nowState, type Bridge, type Found } from './types';

/**
 * VeSync's cloud, the way the VeSync app talks to it (the same interface pyvesync and Home Assistant use).
 * Unofficial: if VeSync changes it, this file is the one to patch. The EU server is used for the UK.
 */
const HOSTS = { eu: 'https://smartapi.vesync.eu', us: 'https://smartapi.vesync.com' } as const;
const APP_VERSION = '5.6.60';
const APP_ID = 'eldodkfj';
const TZ = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London';

function base() {
  return {
    acceptLanguage: 'en',
    appVersion: APP_VERSION,
    phoneBrand: 'iPhone',
    phoneOS: 'iOS',
    timeZone: TZ(),
    traceId: String(Date.now()),
    debugMode: false,
  };
}

interface Session {
  token: string;
  accountId: string;
  region: keyof typeof HOSTS;
}

interface VesyncDevice {
  cid: string;
  uuid?: string;
  deviceName: string;
  deviceType: string;
  configModule: string;
  deviceRegion?: string;
  connectionStatus?: string;
  deviceStatus?: string;
  subDeviceNo?: number;
}

const PURIFIERS = /Core|LAP-|LV-PUR|Vital/i;

export function purifierStateFromResult(online: boolean, r: Record<string, unknown>): ThingState {
  const s = nowState({ online });
  if (typeof r['enabled'] === 'boolean') s.on = r['enabled'];
  if (typeof r['level'] === 'number') s.speed = r['level'];
  if (typeof r['mode'] === 'string') s.mode = r['mode'];
  if (typeof r['display'] === 'boolean') s.display = r['display'];
  if (typeof r['child_lock'] === 'boolean') s.lock = r['child_lock'];
  if (typeof r['filter_life'] === 'number') s.filterLife = r['filter_life'];
  return s;
}

export function purifierPayload(command: Command): { method: string; data: Record<string, unknown> } {
  switch (command.type) {
    case 'power':
      return { method: 'setSwitch', data: { enabled: command.on, id: 0 } };
    case 'speed':
      return { method: 'setLevel', data: { id: 0, level: Math.max(1, Math.min(3, Math.round(command.value))), type: 'wind' } };
    case 'mode':
      return { method: 'setPurifierMode', data: { mode: command.value } };
    case 'display':
      return { method: 'setDisplay', data: { state: command.on } };
    case 'lock':
      return { method: 'setChildLock', data: { child_lock: command.on } };
    default:
      throw new BridgeError('This purifier cannot do that');
  }
}

export class VesyncBridge implements Bridge {
  brand = 'vesync' as const;
  private session: Session | null = null;

  async ready(): Promise<boolean> {
    return Boolean((await getSecret('vesync.email')) && (await getSecret('vesync.password')));
  }

  private async login(): Promise<Session> {
    if (this.session) return this.session;
    const token = await getSecret('vesync.token');
    const accountId = await getSecret('vesync.accountId');
    if (token && accountId) {
      this.session = { token, accountId, region: 'eu' };
      return this.session;
    }
    const email = await getSecret('vesync.email');
    const password = await getSecret('vesync.password');
    if (!email || !password) throw new BridgeError('VeSync email and password are not set');
    const region: keyof typeof HOSTS = 'eu';
    const common = {
      ...base(),
      accountID: '',
      authProtocolType: 'generic',
      clientInfo: 'iPhone',
      clientType: 'vesyncApp',
      clientVersion: `VeSync ${APP_VERSION}`,
      osInfo: 'iOS',
      terminalId: 'homehub' + md5(email).slice(0, 24),
      token: '',
      userCountryCode: 'GB',
    };
    const step1 = await http({
      method: 'POST',
      url: `${HOSTS[region]}/globalPlatform/api/accountAuth/v1/authByPWDOrOTM`,
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'User-Agent': 'okhttp/3.12.1' },
      body: { ...common, email, password: md5(password), method: 'authByPWDOrOTM', appID: APP_ID, sourceAppID: APP_ID },
    });
    const r1 = step1.data as { code?: number; msg?: string; result?: { accountID?: string; authorizeCode?: string } };
    if (r1.code !== 0 || !r1.result?.authorizeCode) throw new BridgeError(`VeSync sign-in failed: ${r1.msg ?? 'no code'}`);
    let body: Record<string, unknown> = {
      ...common,
      method: 'loginByAuthorizeCode4Vesync',
      authorizeCode: r1.result.authorizeCode,
      emailSubscriptions: false,
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const step2 = await http({
        method: 'POST',
        url: `${HOSTS[region]}/user/api/accountManage/v1/loginByAuthorizeCode4Vesync`,
        headers: { 'Content-Type': 'application/json; charset=UTF-8', 'User-Agent': 'okhttp/3.12.1' },
        body,
      });
      const r2 = step2.data as { code?: number; msg?: string; result?: { token?: string; accountID?: string; bizToken?: string; countryCode?: string } };
      if (r2.code === 0 && r2.result?.token && r2.result.accountID) {
        this.session = { token: r2.result.token, accountId: r2.result.accountID, region };
        await setSecret('vesync.token', this.session.token);
        await setSecret('vesync.accountId', this.session.accountId);
        return this.session;
      }
      if (r2.result?.bizToken) {
        body = { ...body, bizToken: r2.result.bizToken, regionChange: 'lastRegion', userCountryCode: r2.result.countryCode ?? 'GB' };
        continue;
      }
      throw new BridgeError(`VeSync sign-in failed: ${r2.msg ?? 'refused'}`);
    }
    throw new BridgeError('VeSync sign-in failed');
  }

  private async forgetSession() {
    this.session = null;
    await setSecret('vesync.token', null);
    await setSecret('vesync.accountId', null);
  }

  private async bypass(thing: Thing, method: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const s = await this.login();
    const r = await http({
      method: 'POST',
      url: `${HOSTS[s.region]}/cloud/v2/deviceManaged/bypassV2`,
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'User-Agent': 'okhttp/3.12.1' },
      body: {
        ...base(),
        accountID: s.accountId,
        token: s.token,
        cid: thing.externalId,
        configModule: thing.meta['configModule'] ?? '',
        deviceRegion: thing.meta['deviceRegion'] ?? 'EU',
        method: 'bypassV2',
        payload: { data, method, source: 'APP' },
      },
    });
    const reply = r.data as { code?: number; msg?: string; result?: { code?: number; result?: Record<string, unknown> } };
    if (reply.code === -11001000 || reply.code === -11003000) {
      await this.forgetSession();
      throw new BridgeError('VeSync signed out; try again');
    }
    if (reply.code !== 0) throw new BridgeError(`VeSync: ${reply.msg ?? 'refused'}`);
    return reply.result?.result ?? {};
  }

  async discover(): Promise<Found[]> {
    const s = await this.login();
    const r = await http({
      method: 'POST',
      url: `${HOSTS[s.region]}/cloud/v1/deviceManaged/devices`,
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'User-Agent': 'okhttp/3.12.1' },
      body: { ...base(), accountID: s.accountId, token: s.token, method: 'devices', pageNo: 1, pageSize: 100 },
    });
    const reply = r.data as { code?: number; msg?: string; result?: { list?: VesyncDevice[] } };
    if (reply.code !== 0) {
      if (reply.code === -11001000 || reply.code === -11003000) await this.forgetSession();
      throw new BridgeError(`VeSync: ${reply.msg ?? 'refused'}`);
    }
    const found: Found[] = [];
    for (const d of reply.result?.list ?? []) {
      if (!PURIFIERS.test(d.deviceType)) continue;
      const thing: Thing = {
        id: '',
        brand: 'vesync',
        externalId: d.cid,
        name: d.deviceName,
        kind: 'purifier',
        rooms: [],
        hidden: false,
        meta: { configModule: d.configModule, deviceRegion: d.deviceRegion ?? 'EU', type: d.deviceType },
        caps: ['power', 'speed', 'sleep', 'display', 'lock'],
      };
      let state = nowState({ online: d.connectionStatus === 'online', on: d.deviceStatus === 'on' });
      try {
        state = await this.read(thing);
      } catch {
        // The list is enough to show it; the state fills on the next read.
      }
      found.push({ externalId: thing.externalId, name: thing.name, kind: thing.kind, caps: thing.caps, meta: thing.meta, state });
    }
    return found;
  }

  async read(thing: Thing): Promise<ThingState> {
    const r = await this.bypass(thing, 'getPurifierStatus', {});
    return purifierStateFromResult(true, r);
  }

  async send(thing: Thing, command: Command): Promise<void> {
    const p = purifierPayload(command);
    await this.bypass(thing, p.method, p.data);
  }
}
