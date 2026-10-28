import { inShell } from './shell';
import { STORAGE_PREFIX } from './brand';

/**
 * Keys and passwords. Inside the phone app they go in the iOS keychain through the secure storage plugin,
 * which is loaded only there. On the web (the showcase and development) they sit in localStorage.
 */
export type SecretKey =
  | 'tuya.accessId'
  | 'tuya.accessSecret'
  | 'govee.apiKey'
  | 'vesync.email'
  | 'vesync.password'
  | 'vesync.token'
  | 'vesync.accountId'
  | 'tuya.token';

type Plugin = {
  get(key: string): Promise<unknown>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<boolean>;
};

let plugin: Promise<Plugin> | undefined;
function keychain(): Promise<Plugin> {
  plugin ??= import('@aparajita/capacitor-secure-storage').then((m) => m.SecureStorage as unknown as Plugin);
  return plugin;
}

const prefix = `${STORAGE_PREFIX}:secret:`;

export async function getSecret(key: SecretKey): Promise<string | null> {
  if (inShell()) {
    const v = await (await keychain()).get(prefix + key);
    return typeof v === 'string' ? v : null;
  }
  try {
    return localStorage.getItem(prefix + key);
  } catch {
    return null;
  }
}

export async function setSecret(key: SecretKey, value: string | null): Promise<void> {
  if (inShell()) {
    const k = await keychain();
    if (value === null) await k.remove(prefix + key);
    else await k.set(prefix + key, value);
    return;
  }
  try {
    if (value === null) localStorage.removeItem(prefix + key);
    else localStorage.setItem(prefix + key, value);
  } catch {
    // Nothing to do: the page says when a key could not be kept.
  }
}
