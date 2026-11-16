# Mob

Mob is a workspace for tasks, Pomodoro sessions, and planning. Today includes the heatmap and achievements. Flow combines usage across devices and controls focus blocking. Social ranks accounts that opt in by completed focus minutes.

## Account backend

1. For a fresh Supabase instance, apply [schema.sql](schema.sql), then [the account migration](supabase/migrations/20261115140000_mob_accounts.sql), [flow-budget.sql](supabase/flow-budget.sql), and [the Flow migration](supabase/migrations/20261115150000_mob_flow.sql), in that order. North already has the SQL installed.
2. Deploy the [mob-login Edge Function](supabase/functions/mob-login/index.ts) with gateway JWT verification disabled because username login happens before a session exists. The function verifies passwords through Supabase Auth and uses the runtime service-role key to resolve account IDs privately. Apply the migration before enabling this endpoint.
3. In **Authentication → URL Configuration**, set the Site URL to the production website. Allow that exact URL, `mobnorth://auth/callback` for Android, `http://127.0.0.1:43172/auth/callback` for Windows, and `http://localhost:4173/` for local development if needed.
4. Enable the Google provider in the same Supabase project. Use a Google OAuth web client, add the Supabase provider callback URL shown in the dashboard, and set the Google client ID and secret in Supabase. See [Google configuration](https://supabase.com/docs/guides/auth/social-sign-in/auth-google). Keep secrets out of the client.
5. Users choose a unique username after account verification. Google users can set a password in **Account → Set a password** to use password login. Link the extension in **Flow → Link browser**, then enable website tracking on the devices where you want it.

Windows and Android bundle the Mob interface and connect to Supabase directly. The browser extension opens the website, so browser users need access to the final hosted URL.

## Use Mob

- **Flow** shows seven days of synced usage and an hourly chart for the current UTC day. It covers time in Mob, tracked website domains from Chrome or Edge, and foreground Windows app names while Mob is running. Sampling estimates session counts. Android tracks time in Mob and has a separate YouTube limit. Browser tracking stores domains, duration and session counts. It does not upload URLs, page titles or content.
- Hide individual entries and recover them from **Hidden usage**. **Clear usage** clears synced dashboard history and invalidates queued uploads from before the clear. The separate YouTube limit retains its current daily counters. **Account → Delete account** permanently removes the signed-in account and its synced data.
- The extension blocks new navigation to configured domains while a focus timer runs. A timer in the linked browser updates its rules immediately. A timer started on another device can take until the next policy sync to reach that browser. The tracking and YouTube sync paths send bounded batches on a 15-minute cadence. This cadence does not cap total Supabase egress across the project.
- **In-app blocking** filters Shorts links opened from the web app. Chrome and Edge use the optional YouTube permission to block Shorts in regular browsing and count active YouTube time. Android uses its optional YouTube-only accessibility service and usage access to enforce the limit.
- **Tasks** accepts a due date and reminder time. Web and Windows notify while Mob is open. Android schedules reminders locally and can ask for exact alarms. Reminders synced from another device get scheduled after the app receives the updated task list.
- Browser guests can keep their data on the current device. Account data syncs separately.

## Build

- **Web** — run `node serve.mjs` for local preview and `node check.mjs` for checks. Sites serves `dist/` without a separate build step.
- **Windows x64** — run `npm ci --prefix clients/windows`, then `.\clients\windows\package.ps1`. Open `.mob-build/Mob-Windows/Mob.exe` and distribute the full directory. It contains the Electron runtime and the foreground activity helper.
- **Browser extension** — zip the contents of `clients/extension/` with `manifest.json` at the archive root. Extract it, open Chrome or Edge Extensions, enable Developer mode, and select **Load unpacked**. The toolbar popup opens Mob Flow.
- **Android** — open `clients/android/` in Android Studio with JDK 17 and Android SDK 35, sync Gradle 8.9 or later within 8.x, and run `assembleDebug` or use **Build → Generate App Bundles or APKs → Generate APKs**. The output is `app/build/outputs/apk/debug/app-debug.apk`.

Focus video and poster are from [A Misty Lake in the Forest by K on Pexels](https://www.pexels.com/video/a-misty-lake-in-the-forest-4296652/) under the [Pexels License](https://www.pexels.com/license/).
