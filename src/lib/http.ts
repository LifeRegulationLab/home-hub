import { CapacitorHttp } from '@capacitor/core';
import { inShell } from './shell';

export interface HttpRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

export interface HttpResponse {
  status: number;
  data: unknown;
}

/**
 * One way to call the brands' clouds. Inside the phone app the request goes through the native layer
 * (no browser CORS rules); on the web it is a plain fetch, which only works for clouds that allow it.
 */
export async function http(req: HttpRequest): Promise<HttpResponse> {
  const headers = { ...(req.headers ?? {}) };
  if (req.body !== undefined && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (inShell()) {
    const r = await CapacitorHttp.request({
      method: req.method,
      url: req.url,
      headers,
      ...(req.body !== undefined ? { data: req.body } : {}),
      connectTimeout: req.timeoutMs ?? 10000,
      readTimeout: req.timeoutMs ?? 10000,
      responseType: 'json',
    });
    return { status: r.status, data: r.data };
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), req.timeoutMs ?? 10000);
  try {
    const r = await fetch(req.url, {
      method: req.method,
      headers,
      ...(req.body !== undefined ? { body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body) } : {}),
      signal: controller.signal,
    });
    const text = await r.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      // Not JSON: keep the text.
    }
    return { status: r.status, data };
  } finally {
    clearTimeout(t);
  }
}
