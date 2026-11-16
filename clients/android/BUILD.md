# Build the Mob Android APK

1. Extract the ZIP and open its `Mob-Android` folder in Android Studio.
2. Use JDK 17, Gradle 8.9, and Android SDK Platform 35. Accept Android Studio’s prompt to download the SDK or choose the installed SDK in **Tools → SDK Manager**.
3. Sync the Gradle project. Choose **Build → Generate App Bundles or APKs → Generate APKs**. You can also run `gradle :app:assembleDebug` with Gradle 8.9 installed.
4. Android Studio writes `app/build/outputs/apk/debug/app-debug.apk`. The debug APK is signed with your local debug key.

The same project can be run from Android Studio on a connected device. To block Shorts inside the YouTube app, open **Flow → Permissions** and enable the Mob accessibility service. Allow Android usage access if you also want the daily YouTube limit. For timed tasks, enable Android notifications and optionally exact alarms.

Google login uses your system browser. The Mob Supabase project must have Google enabled, and `mobnorth://auth/callback` must be listed among its redirect URLs.
