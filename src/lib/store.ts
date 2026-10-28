import { useSyncExternalStore } from 'react';
import { STORAGE_PREFIX } from './brand';
import { defaultState, readState, type State } from './model';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

const KEY = `${STORAGE_PREFIX}:state`;

/** Everything lives on the device. Keys live in the keychain (secrets.ts), never here. */
export class Store {
  private state: State;
  private listeners = new Set<() => void>();

  constructor(
    private storage: Storage | undefined,
    initial?: State,
  ) {
    this.state = initial ?? Store.load(storage);
  }

  static load(storage: Storage | undefined): State {
    try {
      const raw = storage?.getItem(KEY);
      return raw ? readState(JSON.parse(raw)) : defaultState();
    } catch {
      return defaultState();
    }
  }

  get = () => this.state;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };

  update = (change: (s: State) => State) => {
    this.state = change(this.state);
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.state));
    } catch {
      // Full storage: the change still holds for now.
    }
    for (const fn of this.listeners) fn();
  };
}

let shared: Store | undefined;

export function store(): Store {
  shared ??= new Store(typeof localStorage === 'undefined' ? undefined : localStorage);
  return shared;
}

/** For the showcase and tests: a store with made-up content that is never saved. */
export function setStore(state: State) {
  shared = new Store(undefined, state);
}

export function useAppState(): State {
  const s = store();
  return useSyncExternalStore(s.subscribe, s.get, s.get);
}
