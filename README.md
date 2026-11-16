# us!!

A 2.5D isometric co-op world for Shaurya and Arushi. The 3D world opens **only while both phones are in the app**. When one of you is alone, the app shows the Waiting Gate, the Summon button and the five care drawers.

## Run and test

```bash
npm install
npx vite --mode demo --port 5199     # demo mode: no Firebase, data stays in this browser
# open  http://localhost:5199/?awake   and   http://localhost:5199/?as=shaurya&awake   in two windows
node tools/test-all.mjs out/          # full sweep (51 checks): gathering, crafting, all panels, 10 rooms, every
                                      # interior object, couple actions, drawers, mood/poke sync, disconnect
node tools/test-coop.mjs out/         # shorter two-phone run: gate → countdown → world → build → interior → disconnect
node tools/test-ui.mjs out/           # drawers, Creator Studio → update modal, QR page
node tools/test-cutout.mjs            # checks the bundled background-removal model runs with no CDN requests
```

## Passcode

There is one shared passcode, and you both enter it with your name. It never appears in the app or this repo:

- The app hashes the passcode into a room id.
- Only rooms that exist in Firestore are accepted, so every other passcode is refused.
- Register your passcode's room once with `node tools/create-room.mjs <passcode>`. Run it again if you ever change the passcode.
- Each name is held by one phone. **Settings → Unpair** frees it. A name also frees itself after its phone has been away for 10 minutes, for example after a reinstall.
- Demo mode (no Firebase) accepts any code, and each code makes its own local world on this PC.

## Build the APK locally (no Android Studio)

```bash
npm run build && npx cap sync android
cd android && JAVA_HOME="C:/Program Files/Unity/Hub/Editor/6000.0.85f1/Editor/Data/PlaybackEngines/AndroidPlayer/OpenJDK" ./gradlew assembleRelease
# -> android/app/build/outputs/apk/release/app-release.apk
```

The build uses the Android SDK that ships with Unity (`android/local.properties`). The SDK there only has build-tools 36, so `android/build.gradle` sets that version.

**Keep `android/release.keystore`.** Its password is `us-4325-love` and git ignores the file. Updates only install over the old app when they are signed with this same key.

## Where things live

| What | Where |
|---|---|
| Rooms, tools, pets, costs, whispers | `src/world/catalog.ts` |
| Meadow island (trees, pond, clouds, cables, house exterior) | `src/world/overworld.ts` |
| Interior: room layouts, hallways, stairs | `src/world/interior.ts` (`LAYOUT`) |
| Engine: camera, joystick, physics, love meter, fade, adaptive DPR | `src/world/engine.ts` |
| Live link (WebRTC peer-to-peer, Firestore fallback) | `src/world/net.ts` |
| Blocky pixel theme (fonts, textures, panels) | `src/theme-block.css`, textures from `tools/make_blocks.py` |
| Character looks | `src/config/people.ts` and `src/world/chibi.ts` |
| Card text for all games (keep it sweet) | `src/config/content.ts` |
| Mood photos | `public/photos/<who>/<who>-<mood>-N.webp` and `src/config/moodPhotos.ts` |
| Soundtrack (original, generated) | `tools/make_music.py` → `public/audio/` |
| Offline cutout model | `public/imgly/` (ISNet quint8 + ONNX runtime) |
| Closed-app notifications | `android/app/src/main/java/com/shaurya/us/UsPoller.java` |
| QR download page | `src/pages/DownloadQR.tsx` (published to GitHub Pages) |

## Data

All data lives in Firestore project `anniversay`, under `us/{sha256(partner code)}`:

- `state/{who}`: presence and mood.
- `events`: the push feed.
- `shared/world`: inventory, tools, rooms, nodes, pets, cables and wishes.
- `shared/updates`: Creator Studio updates.
- `live/{who}` and `rtc/session`: the live co-op link.

The rules are in `firestore.us.rules`. Add them to the main rules file and deploy, or live sync shows "blocked".

## Release

`.github/workflows/deploy.yml` builds the signed APK and publishes it as the latest GitHub Release asset `us-app.apk`. It also prints a QR code in the run summary and deploys the QR page to Pages. The Pages site contains only the download page, with no photos.

Add two repo secrets:

- `US_KEYSTORE_B64`: run `base64 -w0 android/release.keystore` and paste the output.
- `US_KS_PASS` (optional).
