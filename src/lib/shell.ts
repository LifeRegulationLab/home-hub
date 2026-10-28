import { Capacitor } from '@capacitor/core';

/** True inside the phone app. The only place that asks Capacitor where the app is running. */
export function inShell(): boolean {
  return Capacitor.isNativePlatform();
}

/** iPad or iPhone, so the app knows whether it can be the hub that runs schedules. */
export function isTablet(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
