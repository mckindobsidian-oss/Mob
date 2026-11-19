# Mob deployment audit

Updated 2026-11-19. This is the current release audit and supersedes earlier entries.

## Latest update: precise limits and launch branding

- Create/edit limit now has hours, minutes and seconds (1 second through 24 hours). Saved rules preserve exact seconds; existing minute-based rules remain compatible. Threshold tests cover the one-second boundary. Browser enforcement still follows its sampling/alarm cadence, so a seconds-based setting is not a hard real-time guarantee.
- Removed duplicate create-limit shortcuts from YouTube protection and the old onboarding daily-limit input. Limits have one primary editor. Usage rows show distinct bordered Hide and Set limit buttons.
- Leaderboards display Google profile photos with initial fallbacks. Deployed `mob_leaderboard_photos` through Mob from `supabase/leaderboard-photos.sql`. Only opted-in leaderboard users appear; URLs are validated and bounded. Anonymous RPC access is denied. Local SQL checks verify photo projection and retained Social retry/isolation behavior.
- Created separate `branding-site/`: Mob identity, product descriptions, actual product screenshots using sample tasks, responsive layouts, credits to Lakshya and Khushaank, installation guidance and working APK/EXE/extension downloads. Preview http://127.0.0.1:4180. This branding website is local only, awaiting the user's later hosting/domain instruction. No new cloud Site was created.
- Branding layout checks passed at 1440, 390 and 360 pixels; images load and all three download URLs return HTTP 200 with correct lengths. Download copies match source artifacts. No Supabase traffic serves branding assets or downloads.
- Final patch builds: Android 1.5.1 (versionCode 7), Windows installer 1.5.1, extension 1.6.2. APK and extension assets match source; installer extraction is checked against the final web assets. Hash manifest: `.mob-build/final-artifacts-v1.5.1.json`.

## Completed

- Web and Windows Flow track active tabs/foreground apps, exclude idle/locked/sleep periods and avoid browser/native duplication. Existing visited-item selection, search, permanent/scheduled/daily/session/Pomodoro limits, hide/unhide and clear-generation recovery remain in place.
- Android has tasks, local Pomodoro, local Shorts blocking and Social. Flow shows Coming soon. Android does not collect, display, upload or sync app usage. It does not upload individual focus-session histories.
- Android Social sends only a compact, opted-in cumulative completed-focus score per device. It refreshes every five minutes while the app is active, and sooner after an edit/completed session/reconnection when appropriate. Private owner-scoped totals reconcile monotonically, preventing retry duplication and old uploads reducing a score.
- Corrected mobile logo alignment, which inherited a later desktop margin. The mobile account button now renders the fetched Google photo, with an initial/icon fallback on image failure. Google identity metadata supplies a fallback photo source.
- Android bottom navigation has all six tabs and can be reordered in Settings / Navigation. Order stays on this device.
- Settings no longer exposes the Supabase connection panel. Android Settings / Shorts provides the local blocker toggle, permission status and Accessibility setup link. The service recognizes visible YouTube Shorts identifiers only.
- Theater/fullscreen has one compact Spotify player on web, Windows and Android. Leaving theater restores the normal audio column. Spotify requires internet and the provider's normal playback interaction.
- New users receive a three-step platform introduction followed by optional feature permissions. Android explains local Shorts, Social and the Flow placeholder; Windows explains tray tracking; web and extension explain linking and active-tab tracking. The extension popup now shows setup steps and link/tracking status.
- Achievement popups, Spotify above focus sounds, local/offline task queues, guest migration and account isolation remain.

## Supabase and website

- All calls used Mob, link `link_6afda90192cc81918593e5e1f4d2a557`, for North `xrvqyraafmwpfenysmfo` in ap-south-1. Never Primary.
- Existing account, task-owner, background, audio and selective-rule SQL is deployed. This update applied `mob_android_social_score` from `supabase/android-social.sql`. No SQL is pending for this release.
- North readback confirmed the Social RPC exists, permits authenticated callers, denies anonymous callers, and has RLS on its private aggregate table. Private tables intentionally have no client policies. Security advisors report informational private-table notices and the existing leaked-password protection warning: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Public test website: https://mob-focus-test-nov19.candidleopard2.chatgpt.site
- Commit `5be3a51607d2eac21edb812ba7ab5695efe045ad`.
- Saved version `appgprj_6afed1a7e5ac8191b98a8ebcd25b0c54~appgver_280e5e9418fc81919a04e7ae430e2bb4`.
- Successful deployment `appgdep_6aff147adb6c8191abbdd54b85b0bf8d`.
- Original Site identity and audience are unchanged. Reuse `.mob-build/mob-test-publish` for temporary-Site updates; root hosting identity still points to the inaccessible original.

## Verified

- Core checks and guest-to-account stable-ID migration/account isolation pass. Android subscribes to tasks only; Social uses its separate bounded RPC.
- Focused browser fixtures pass Android logo centering, Google-photo rendering/fallback, navigation order, Social's five-minute throttle, Flow placeholder, Shorts policy/permission bridge, one compact theater Spotify iframe on Android/web/Windows, and new-user intro navigation/dismissal. Screenshots: `.mob-build/release-polish-results`.
- Android Social SQL tests pass opt-in, mixed desktop/mobile focus scores, repeated/old offline uploads, cross-account isolation, anonymous rejection and private-table permissions.
- Installed extension checks pass popup setup, navigation enforcement, permanent/scheduled/session rules, focus expiry and sync throttling. Existing browser hide/unhide, chart filters, privacy and clear/limit tests pass.
- Windows installer silent extraction completed with exit code 0. The installed app passed native bridge/helper, tracking-running status, hidden-window background work and second-launch recovery in an isolated profile. The user's older Desktop Mob was left running and unchanged.
- Android 1.5 debug assembly succeeds. APK assets, the extracted installer payload and extension ZIP match current source. Hashes are in `.mob-build/final-artifacts-v1.5.json`.
- Earlier real desktop Google login and live desktop/hosted-web task create/read/edit/delete plus audio-preference sync passed. A separate web client reused the valid session with an independent device ID. Evidence: `.mob-build/live-desktop-sync-result.json`. That is not a new Android Social or two-physical-device test.
- Existing Flow engine/SQL checks cover cumulative retries, scoped tokens, hidden-inclusive totals and clear generations. Native shield tests use simulated foreground samples; this is not a physical lock/sleep/foreground test.

## Downloads

- `Mob-Android-v1.5.1.apk`: Android 1.5.1, versionCode 7, debug-signed.
- `Mob-Setup-v1.5.1.exe`: one unsigned Windows installer, with the entire application embedded. Installs for the current user in LocalAppData/Programs/Mob, adds desktop/Start Menu shortcuts and opens Mob. No separate ZIP or extra download is needed. Quit the old Mob from its tray before installing; setup checks rather than killing it.
- `Mob-Browser-Extension-v1.6.2.zip`: extract, Load unpacked, then link it from Mob Flow. Supports both temporary and original Mob origins.
- Local preview: `node dev-server.mjs`, http://127.0.0.1:4173. Web source/output is `dist/`.

## Remaining before a production release

1. Physical Android testing is unavailable. Verify Shorts/accessibility on the current YouTube version, actual Spotify playback, notifications, offline tasks, upgrade behavior and Social sync with a real signed-in phone. UI and bridge fixtures cannot establish hardware behavior.
2. Test new Social/rule syncing with real signed-in devices. Manually verify Windows switching, lock/sleep/restart and simultaneous offline reconciliation. No destructive clear/account-deletion test was run against the user's live data; local SQL/clear-generation checks passed.
3. Sign Android with the owner's release key; sign Windows and its installer. Prepare store submissions if desired. Current downloads are testing builds. Installer extraction/launch was tested silently; normal shortcut creation is implemented but was not exercised by writing shortcuts to the user's desktop.
4. Inspect Supabase organization Billing/Usage for actual egress consumed and remaining allowance. North's Free plan was previously confirmed, but current consumption is unmeasured. The published allowance is 5 GB uncached and a separate 5 GB cached per cycle. Batching, bounded payloads, coalesced writes and no Realtime reduce traffic, but no provider-enforced project-wide ceiling was available through the connection. Do not claim a strict guarantee. See EGRESS-CONTROL.md.
5. Choose the permanent host or obtain original Site edit access, publish this source there, then update exact OAuth redirects and extension Mob origins. Mob Test is already public and published.

## Behavior to communicate

- Cross-device totals/policies may lag roughly five minutes; browser rule reevaluation is approximately 30 seconds and can be delayed by the browser. Concurrent offline clients can exceed a shared daily budget before reconciliation.
- Daily limits use UTC; schedules use each device's timezone. Session limits are per tracker and reset after roughly one minute away.
- Windows blocking is a reversible focus shield, not tamper-resistant OS access control. Mob remains available to edit limits.
- The 60-second idle cutoff may stop counting passive reading/playback. Usage history is retained for seven days. Clear conservatively discards ambiguous older queued hours.
