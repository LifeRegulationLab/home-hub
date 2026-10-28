# Home hub

Read `README.md` first. Stack: Vite 6, React 19, TypeScript strict, React Router 7, Tailwind 4, Capacitor 8 (iPhone and iPad). `npm run check` must pass before saying anything is done.

- Stuart's own app for every smart thing at home. Personal only: never on the App Store, no sign-in, no account, no server of ours. Keys live in the device keychain (`src/lib/secrets.ts`) and never in the repo, the state or a log.
- Four bridges, one shape (`src/lib/bridges/types.ts`): Tuya (the Gosund plugs and the Ultenic robot, through the Smart Life app and a free Tuya developer project), Govee (official API), VeSync (the app's own interface; unofficial, patch `vesync.ts` if it changes), WiZ (local UDP on the home Wi-Fi; phone app only). Every brand call goes through `src/lib/http.ts`, which uses the native layer inside the app.
- Everything that decides something is a pure function with a test: schedules (`src/lib/schedules/`), the robot's words and parts (`src/lib/vacuum/`), scenes (`src/lib/scenes.ts`). Pages only show state and call bridges.
- Copy is British English, plain and short, no exclamation marks, no cheer. The app states facts ("Dustin: charging, 82%"); it never nudges, rewards or counts streaks. No adverts, shop or community.
- Look: the shared Life Regulation Lab teal (pace `docs/DESIGN.md`) as tokens in `src/index.css`. Dark by default, 44 px targets.
- Showcase: `?showcase=1` on a `VITE_SHOWCASE=true` build opens a made-up house with no real device; `npm run screenshots` photographs every page.
- Repository files carry Stuart Houlihan as author. No tool or AI names in anything people see.
