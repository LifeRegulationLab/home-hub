// Photographs every page of the showcase build in light and dark, phone size.
// Usage: node scripts/screenshots.mjs showcase-dist screenshots
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { existsSync } from 'node:fs';

const [dir = 'showcase-dist', out = 'screenshots'] = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const path = (req.url ?? '/').split('?')[0];
  try {
    const file = extname(path) ? join(dir, path) : join(dir, 'index.html');
    res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
    res.end(await readFile(file));
  } catch {
    res.setHeader('Content-Type', 'text/html');
    res.end(await readFile(join(dir, 'index.html')));
  }
});
await new Promise((r) => server.listen(4175, r));
await mkdir(out, { recursive: true });
const pages = [
  ['home', '/'],
  ['things', '/things'],
  ['thing', '/things/w1'],
  ['scenes', '/scenes'],
  ['schedules', '/schedules'],
  ['new-schedule', '/schedules/new'],
  ['dustin', '/dustin'],
  ['settings', '/settings'],
];
// A cloud session has one Chromium at a fixed path; the Mac uses the one Playwright installed.
const shared = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(shared) ? { executablePath: shared } : {});
for (const theme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme });
  for (const [name, path] of pages) {
    await page.goto(`http://localhost:4175${path}?showcase=1&theme=${theme}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(out, `${theme}-${name}.png`), fullPage: false });
    console.log('ok', theme, name);
  }
  await page.close();
}
await browser.close();
server.close();
