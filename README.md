# Home hub

One app on Stuart's iPhone and iPad for every smart thing at home: the Gosund plugs, the Govee lights, the Levoit purifiers, the WiZ bulbs and Dustin Bieber the robot vacuum. It replaces GHome, Govee Home, VeSync, WiZ and Ultenic for daily use. Personal only.

The map of the five apps and the design are in the Claude Doc "Home hub: map and design" (28 October 2026); the short version is in `docs/DESIGN.md`.

## Run it

```
npm install
npm run dev            # the web version at http://localhost:5173
npm run check          # types, lint, build, tests
npm run screenshots    # every page of the showcase, light and dark, into screenshots/
npm run build:shell    # the iPhone and iPad app into ios/ (needs Xcode on the Mac)
```

To see the app with a made-up house and no keys: `VITE_SHOWCASE=true npm run dev`, then open `http://localhost:5173/?showcase=1`.

## How it reaches each brand

| Brand | Route | You do once |
| --- | --- | --- |
| Gosund plugs and the robot | Tuya Cloud API, signed requests | Put the devices in the Smart Life app; make a free Tuya developer project; link the account; paste the Access ID and Secret into Settings |
| Govee | Govee Developer API | Apply for a key in Govee Home (Me, Settings, Apply for API Key); paste it in |
| Levoit purifiers | VeSync's own cloud interface | Type the VeSync email and password into Settings |
| WiZ | UDP on the home Wi-Fi | Nothing; the app finds them when the phone is at home |

## Layout

```
src/
  main.tsx App.tsx index.css
  lib/
    model.ts          every type, the default state, pure helpers
    store.ts          the one store (localStorage), useAppState()
    secrets.ts        keys in the keychain (plugin, phone only) or localStorage (web)
    http.ts           one way to call a cloud: native inside the app, fetch on the web
    bridges/          types.ts, tuya.ts, govee.ts, vesync.ts, wiz.ts, md5.ts, index.ts (registry, discover, send, refresh)
    schedules/        sun.ts, next.ts (next runs, what is due), words.ts (the sentence), runner.ts (runs them while open)
    vacuum/           status.ts (Tuya codes to words, faults, quiet hours), parts.ts (counters, history)
    scenes.ts         save how the house is, room switches, local state after a command
    showcase.ts       the made-up house
  components/         Layout, ui, ThingTile
  pages/              Home, Things, ThingPage, Scenes, Schedules, EditSchedule, Dustin, Settings
  test/               bridges, schedules, vacuum
scripts/screenshots.mjs
```
