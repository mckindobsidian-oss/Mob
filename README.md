# Mob

Mob is a workspace for tasks, Pomodoro sessions, and planning. Today includes the heatmap and achievements. Flow combines usage across devices and controls focus blocking. Social ranks accounts that opt in by completed focus minutes.

## Account backend

1. For a fresh Supabase instance, apply [schema.sql](schema.sql), then [the account migration](supabase/migrations/20261115140000_mob_accounts.sql), [flow-budget.sql](supabase/flow-budget.sql), [the Flow migration](supabase/migrations/20261115150000_mob_flow.sql), [the photo bandwidth migration](supabase/migrations/20261115151000_mob_photo_etag.sql), and [flow-background.sql](supabase/flow-background.sql), in that order. The background changes were deployed to North through the Mob connection on 2026-11-18, including the owner-RLS correction. Use Mob explicitly; Primary belongs to a different account.
2. Deploy the [mob-login Edge Function](supabase/functions/mob-login/index.ts) with gateway JWT verification disabled because username login happens before a session exists. The function verifies passwords through Supabase Auth and uses the runtime service-role key to resolve account IDs privately. Apply the migration before enabling this endpoint.
3. In **Authentication → URL Configuration**, set the Site URL to `https://usemob.netlify.app/` and add the same URL to Redirect URLs. Keep `mobnorth://auth/callback` for Android and `http://127.0.0.1:43172/auth/callback` for Windows. For local web development, allow the localhost or 127.0.0.1 address you use on port 4173.
4. Enable the Google provider in the same Supabase project. Use a Google OAuth web client, add the Supabase provider callback URL shown in the dashboard, and set the Google client ID and secret in Supabase. See [Google configuration](https://supabase.com/docs/guides/auth/social-sign-in/auth-google). Keep secrets out of the client.
5. Users choose a unique username after account verification. Google users can set a password in **Account → Set a password** to use password login. Link the extension in **Flow → Link browser**, then enable website tracking on the devices where you want it.

Windows and Android bundle the Mob interface and connect to Supabase directly. The browser extension opens the [Mob workspace](https://usemob.netlify.app/). The separate [launch page](https://moblabs.vercel.app/) links to the workspace and downloads.

## Use Mob

- **Flow** shows Today by default, with Yesterday, Last 7 days, and Last 30 days available. Ranges use UTC and apply to the chart, totals, and usage list. Windows samples the foreground application every 250 ms while Mob runs, including when minimized or hidden to its tray. It stops counting on lock, sleep, or after 60 seconds without input. Closing the window keeps tracking running. Choose **Quit Mob** in the tray to exit. Chrome and Edge use the linked extension to track the selected tab in the focused window. Browser processes are excluded from native Windows totals to avoid double-counting website time. Browser and native tracking estimate time around transitions.
- **Android** syncs tasks and an optional aggregate Social focus score every five minutes while active. Pomodoro and YouTube Shorts blocking are local. Enable accessibility only for Shorts blocking, and notifications only for reminders. Android Flow shows Coming soon; there is no app usage access, background usage collection or mobile usage upload. Settings includes Shorts blocking and bottom navigation reordering.
- Hide individual entries and recover them from **Hidden usage**. **Clear usage** clears synced dashboard history and invalidates queued uploads from before the clear. The separate YouTube limit retains its current daily counters. **Account → Delete account** permanently removes the signed-in account and its synced data.
- The extension blocks new navigation to configured domains while a focus timer runs. A timer in the linked browser updates its rules immediately. A timer started on another device can take until the next policy sync to reach that browser. The tracking and YouTube sync paths send bounded batches on a 5-minute cadence. This cadence does not cap total Supabase egress across the project.
- **In-app blocking** filters Shorts links opened from the web app. Chrome and Edge use the extension's YouTube site access for Shorts and daily limits. Android accessibility dismisses YouTube Shorts locally and never collects usage.
- Shared YouTube totals reconcile on a 5-minute cadence. Local enforcement continues offline using the last policy and known other-device total. Concurrent devices can exceed a shared total before reconciliation. This is a supported delayed budget, with no strict global offline-limit guarantee.
- **Tasks** accepts a due date and reminder time. Web and Windows notify while Mob is open. Android schedules reminders locally and can ask for exact alarms. Reminders synced from another device get scheduled after the app receives the updated task list.
- Guest tasks and focus records stay local, then migrate with stable IDs on first login. Task writes are queued by account, coalesced and retried. Android refreshes tasks every five minutes while active and earlier after edits/reconnect.

## Build

- **Web** — run `node dev-server.mjs` for local preview and `node check.mjs` for checks. Sites serves `dist/` without a separate build step.
- **Windows x64** — run `npm ci --prefix clients/windows`, then `.\clients\windows\package.ps1`. Open `.mob-build/Mob-Windows/Mob.exe` and distribute the full directory. It contains the Electron runtime and the foreground activity helper.
- **Browser extension** — zip the contents of `clients/extension/` with `manifest.json` at the archive root. Extract it, open Chrome or Edge Extensions, enable Developer mode, and select **Load unpacked**. The toolbar popup opens Mob Flow.
- **Android** syncs tasks and an optional aggregate Social focus score every five minutes while active. Pomodoro and YouTube Shorts blocking are local. Enable accessibility only for Shorts blocking, and notifications only for reminders. Android Flow shows Coming soon; there is no app usage access, background usage collection or mobile usage upload. Settings includes Shorts blocking and bottom navigation reordering.

The Focus background is adapted from [Aerial View of Ocean Waves by ArtHouse Studio](https://www.pexels.com/video/aerial-view-of-ocean-waves-4631568/). The lake poster used elsewhere is from [A Misty Lake in the Forest by K](https://www.pexels.com/video/a-misty-lake-in-the-forest-4296652/). Both are provided under the [Pexels License](https://www.pexels.com/license/).

## Focus sounds and themed pickers

Focus includes seven locally generated sound presets, Play/Pause and volume. Binaural presets use headphones for stereo separation. Built-in audio works offline and consumes no Supabase media egress. Web/Windows signed-in preferences use the deployed `focus_audio` column in `supabase/flow-background.sql`; Android preferences remain local. External listening tools open separately. All selects and date/time pickers use the current Mob theme.

## Selective usage limits

For fresh databases, apply `supabase/usage-rules.sql`, `supabase/flow-report.sql` `supabase/android-social.sql`, `supabase/leaderboard-photos.sql` and `supabase/profile-leaderboard.sql` after the migrations listed above. This is already deployed to North through Mob. Flow's Add limit opens a searchable dropdown of visited apps and websites. Select one or more items and choose permanent, scheduled, daily, session or Pomodoro blocking. Windows uses a reversible foreground focus shield; websites require the linked extension. Daily totals include hidden items and reconcile across devices on the existing sync cadence. Daily budgets use UTC, schedules use device-local time, and session budgets are per tracker with a one-minute-away reset. Mob remains available to edit limits.

Current test builds are Android 1.5.1, Windows installer 1.5.1 and extension 1.6.3. Get them from the [Mob launch page](https://moblabs.vercel.app/) or [GitHub Releases](https://github.com/mckindobsidian-oss/Mob-Platform/releases/tag/v1.5.1). Run `clients/windows/installer.ps1` to package the single-file Windows installer. All platforms include a new-user introduction; theater includes a compact Spotify player. See DEPLOYMENT-AUDIT.md for verification coverage and release limitations.
