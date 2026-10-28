import { useState } from 'react';

/** The time when the page opened, read once so a render is pure. */
export function useNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}
