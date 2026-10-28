import type { Command, Thing, ThingState } from '../model';
import { inShell } from '../shell';
import { BridgeError, nowState, type Bridge, type Found } from './types';

/**
 * WiZ bulbs answer JSON over UDP on port 38899 on the home Wi-Fi: no account, no cloud. Inside the phone
 * app the UDP plugin is loaded; on the web there is no UDP, so the bulbs show as "home only".
 */
export const WIZ_PORT = 38899;

export interface Pilot {
  state?: boolean;
  dimming?: number;
  temp?: number;
  r?: number;
  g?: number;
  b?: number;
  sceneId?: number;
  speed?: number;
  mac?: string;
  rssi?: number;
}

/** WiZ's built-in modes, by the ids the bulbs use. */
export const WIZ_SCENES: Record<number, string> = {
  1: 'Ocean', 2: 'Romance', 3: 'Sunset', 4: 'Party', 5: 'Fireplace', 6: 'Cosy', 7: 'Forest', 8: 'Pastel colours',
  9: 'Wake up', 10: 'Bedtime', 11: 'Warm white', 12: 'Daylight', 13: 'Cool white', 14: 'Night light', 15: 'Focus',
  16: 'Relax', 17: 'True colours', 18: 'TV time', 19: 'Plant growth', 20: 'Spring', 21: 'Summer', 22: 'Autumn',
  23: 'Deep dive', 24: 'Jungle', 25: 'Mojito', 26: 'Club', 27: 'Christmas', 28: 'Halloween', 29: 'Candlelight',
  30: 'Golden white', 31: 'Pulse', 32: 'Steampunk', 33: 'Diwali', 35: 'White',
};

export function pilotFromCommand(command: Command): Pilot {
  switch (command.type) {
    case 'power':
      return { state: command.on };
    case 'brightness':
      return { state: true, dimming: Math.max(10, Math.min(100, Math.round(command.value))) };
    case 'colour':
      return { state: true, r: command.r, g: command.g, b: command.b };
    case 'temperature':
      return { state: true, temp: Math.max(2200, Math.min(6500, Math.round(command.kelvin))) };
    case 'scene':
      return { state: true, sceneId: Number(command.id) };
    default:
      throw new BridgeError('This bulb cannot do that');
  }
}

export function stateFromPilot(p: Pilot): ThingState {
  const s = nowState();
  if (typeof p.state === 'boolean') s.on = p.state;
  if (typeof p.dimming === 'number') s.brightness = p.dimming;
  if (typeof p.temp === 'number') s.temperature = p.temp;
  if (typeof p.r === 'number' && typeof p.g === 'number' && typeof p.b === 'number') s.colour = { r: p.r, g: p.g, b: p.b };
  if (typeof p.sceneId === 'number' && p.sceneId > 0) s.mode = WIZ_SCENES[p.sceneId] ?? `Mode ${p.sceneId}`;
  return s;
}

type Udp = {
  create(o?: { properties?: { name?: string; bufferSize?: number } }): Promise<{ socketId: number }>;
  bind(o: { socketId: number; port: number; address?: string }): Promise<void>;
  send(o: { socketId: number; address: string; port: number; buffer: string }): Promise<unknown>;
  close(o: { socketId: number }): Promise<void>;
  setBroadcast(o: { socketId: number; enabled: boolean }): Promise<void>;
  addListener(ev: 'receive', fn: (e: { socketId: number; buffer: string; remoteAddress: string; remotePort: number }) => void): Promise<{ remove(): Promise<void> }>;
};

let udp: Promise<Udp> | undefined;
function plugin(): Promise<Udp> {
  udp ??= import('capacitor-udp-socket').then((m) => m.UdpSocket as unknown as Udp);
  return udp;
}

const b64 = {
  encode: (s: string) => btoa(unescape(encodeURIComponent(s))),
  decode: (s: string) => decodeURIComponent(escape(atob(s))),
};

/** Sends one JSON message and collects the replies for `waitMs`. */
async function exchange(address: string, message: unknown, waitMs: number, broadcast = false): Promise<{ from: string; reply: Record<string, unknown> }[]> {
  const u = await plugin();
  const { socketId } = await u.create({ properties: { name: 'wiz', bufferSize: 4096 } });
  const replies: { from: string; reply: Record<string, unknown> }[] = [];
  const handle = await u.addListener('receive', (e) => {
    if (e.socketId !== socketId) return;
    try {
      replies.push({ from: e.remoteAddress, reply: JSON.parse(b64.decode(e.buffer)) as Record<string, unknown> });
    } catch {
      // Not JSON: not a bulb.
    }
  });
  try {
    await u.bind({ socketId, port: 0 });
    if (broadcast) await u.setBroadcast({ socketId, enabled: true });
    await u.send({ socketId, address, port: WIZ_PORT, buffer: b64.encode(JSON.stringify(message)) });
    await new Promise((r) => setTimeout(r, waitMs));
  } finally {
    await handle.remove();
    await u.close({ socketId });
  }
  return replies;
}

export class WizBridge implements Bridge {
  brand = 'wiz' as const;

  async ready(): Promise<boolean> {
    return inShell();
  }

  async discover(): Promise<Found[]> {
    if (!inShell()) return [];
    const replies = await exchange('255.255.255.255', { method: 'getPilot', params: {} }, 2500, true);
    const found = new Map<string, Found>();
    for (const { from, reply } of replies) {
      const result = reply['result'] as Pilot | undefined;
      if (!result?.mac || found.has(result.mac)) continue;
      found.set(result.mac, {
        externalId: result.mac,
        name: `WiZ bulb ${result.mac.slice(-4)}`,
        kind: 'light',
        caps: ['power', 'brightness', 'colour', 'temperature', 'scene'],
        meta: { address: from },
        state: stateFromPilot(result),
      });
    }
    return [...found.values()];
  }

  async read(thing: Thing): Promise<ThingState> {
    if (!inShell()) return nowState({ online: false });
    const address = thing.meta['address'];
    if (!address) throw new BridgeError('No address for this bulb yet');
    const replies = await exchange(address, { method: 'getPilot', params: {} }, 800);
    const first = replies[0]?.reply['result'] as Pilot | undefined;
    if (!first) return nowState({ online: false });
    return stateFromPilot(first);
  }

  async send(thing: Thing, command: Command): Promise<void> {
    if (!inShell()) throw new BridgeError('WiZ bulbs only answer from the phone on the home Wi-Fi');
    const address = thing.meta['address'];
    if (!address) throw new BridgeError('No address for this bulb yet');
    const replies = await exchange(address, { method: 'setPilot', params: pilotFromCommand(command) }, 600);
    const ok = replies.some((r) => (r.reply['result'] as { success?: boolean } | undefined)?.success);
    if (!ok) throw new BridgeError('The bulb did not answer; is the phone on the home Wi-Fi?');
  }
}
