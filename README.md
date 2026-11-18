# Daily Tracker

An offline Android app for personal daily tracking: **habits & to-dos**, **expenses** and **calories**, with interactive charts, all stored locally in SQLite. No account, no server, no internet required.

Built with **Expo SDK 58 · React Native 0.88 · TypeScript · expo-router · expo-sqlite · react-native-gifted-charts**.

---

## Features

| Area | What you can do |
| --- | --- |
| **Home** | Today's date, task completion ring (% done, completed / remaining), today's spending (vs. yesterday), calories vs. goal, quick-add buttons for expense / calories / task, a written summary of the day, and the next tasks to tick off. |
| **Tasks** | *Every-day* (permanent) tasks that appear daily and reset automatically each new day, and *one-time* tasks bound to a date. Each task can have an optional description, shown when you tap the task. Add, rename, delete, complete, browse any day (← → or date picker). History is kept per day. Insights: completed vs. incomplete stacked bars, completion % trend, daily / weekly / monthly. |
| **Expenses** | Three-step entry: amount → category → Confirm. 8 default categories plus your own (add / rename / delete). "Other" asks for a description. Every record stores amount, category, optional note, date and time. History with filters (all, today, this week, this month, any day) and per-day totals; tap any entry to edit or delete it. Insights: spending per day / week / month, category donut, period comparison, total and average daily spend. |
| **Calories** | Type a number → Confirm (presets for one-tap entry). Optionally tag the entry: Breakfast, Lunch, Dinner, Snack, Drink, or your own text. Today's total vs. an adjustable daily goal, history per day, edit / delete, charts with the goal line, and a 30-day goal check. |
| **Statistics** | One page for every report: completion rate today / this week / this month, task trends, most consistent tasks (with streaks), spending trends, category breakdown, this-period vs. last-period comparison, and calorie trends against your goal. One switch sets daily / weekly / monthly for every chart. |
| **Languages** | **Arabic (العربية)** and English, with a full right-to-left layout in Arabic. All screens, dates, times, chart labels, default category names and error messages are translated. Choose *Phone language*, *العربية* or *English* in Settings. |
| **Settings** | Language, light / dark / system theme, calorie goal, currency (₪ shekel, $ dollar, or any symbol), category manager, **JSON backup export / restore**, and **reset all data** (double confirmation). |

All charts are tappable. Tap a bar or point to show that day, week or month. They refresh automatically after any add, edit or delete.

---

## Architecture

```
src/
  app/                    expo-router routes (screens only)
    _layout.tsx           SQLiteProvider → AppDataProvider → ThemeProvider → Stack
    (tabs)/_layout.tsx    bottom tab bar: Home · Tasks · Expenses · Calories · Statistics
    (tabs)/index.tsx      dashboard
    (tabs)/tasks.tsx      to-do list + task insights
    (tabs)/expenses.tsx   quick entry · history · insights
    (tabs)/calories.tsx   quick entry · history · insights · goal
    (tabs)/stats.tsx      reports & analytics
    settings.tsx          theme, preferences, backup/restore, reset
    categories.tsx        expense category manager
  db/                     data layer, no React (pure async functions taking a DB)
    schema.ts             migrations (PRAGMA user_version), default categories
    tasks.ts expenses.ts calories.ts settings.ts backup.ts
  lib/                    pure logic: dates.ts (local-day keys), stats.ts (aggregations), format.ts
  features/               screen building blocks: forms, rows, stats sections, read models
  components/             design system: ui.tsx, charts.tsx, pickers.tsx
  hooks/useAppData.tsx    db + settings context, `mutate()` and live `useQuery()`
  theme/                  light/dark tokens
  i18n/                   translate.ts (t(), English source strings as keys), ar.ts (Arabic), I18nProvider (RTL)
tests/                    Jest tests against a real SQLite engine (node:sqlite)
```

**Data flow.** Screens read through `useQuery(fn, deps)`. Every write goes through `mutate(fn)`, which bumps a version counter, so every query on screen re-runs. That is how charts stay live. `useQuery` also re-runs when the calendar day changes: the app checks every 30 s and whenever it returns to the foreground. That means "today" rolls over even if the app stays open past midnight.

**Translations.** UI strings are written in English and wrapped in `t('…')`. Arabic lives in `src/i18n/ar.ts`. The test suite fails if any `t()` string, tab name, period, default category or data-layer error is missing an Arabic translation. To add another language, add a dictionary next to `ar.ts` and extend `Lang`.

**Extending.** To add a tracker, such as water or sleep:
1. Append a migration in `db/schema.ts` (never edit shipped ones).
2. Add a repository file in `db/`.
3. Add its table to `db/backup.ts`.
4. Add a route in `src/app/(tabs)`.
5. Reuse `TrendBars`, `getBuckets` and `aggregateSumBuckets` for charts.

### SQLite schema

```sql
settings          (key TEXT PK, value TEXT)                      -- calorieGoal, currency, theme
daily_tasks       (id PK, name, description NULL, created_date, archived_date NULL, sort_order, created_at)
daily_task_logs   (task_id FK, date, completed_at, PK(task_id, date))
one_time_tasks    (id PK, title, description NULL, date, completed 0/1, completed_at, created_at)
expense_categories(id PK, name NOCASE, icon, color, is_other 0/1, sort_order, archived 0/1)
expenses          (id PK, amount_cents INT > 0, category_id FK, description NULL, date, time, created_at)
calorie_entries   (id PK, calories INT > 0, description NULL, date, time, created_at)
-- indexes on every date column
```

Design decisions:

- **Dates** are stored as local calendar days (`YYYY-MM-DD`) and times as `HH:MM`. They are never converted to UTC, so an entry at 23:30 always stays on its own day. Date math is DST-safe and tested in several time zones.
- **Daily reset without overwriting history.** A permanent task's completion is a row in `daily_task_logs` per day. A new day has no rows yet, so every task starts unchecked, and earlier days are never touched.
- **Deleting a permanent task** sets `archived_date = today`. It disappears from today onward, but past days keep it, so historical completion rates don't change. A task created and deleted on the same day is removed completely.
- **Deleting a category that has expenses** archives it: it's hidden from the picker, but history keeps its name and color. Re-adding the same name restores it. "Other" can't be deleted.
- **Money** is stored as integer cents to avoid floating-point errors.
- **Restore** validates every row first, then replaces all data in one transaction. A bad file changes nothing.

---

## Run & test

```bash
npm install
npm test              # 41 tests: CRUD, daily reset, history, stats, backup/restore, persistence, Arabic coverage
npm run test:tz       # same tests under America/New_York and Asia/Tokyo
npm run typecheck
npx expo start        # then press "a" for Android (needs a development build; see below)
npx expo start --web  # quick browser preview (data stored in the browser)
```

---

## Build the APK

The app uses native modules (SQLite, file system, date picker), so it runs as a **standalone APK**. End users don't need Expo Go or any account. Each phone gets its own private database in the app's sandbox.

### Option A: GitHub Actions (no setup, recommended)

`.github/workflows/android-apk.yml` builds a release APK on GitHub's servers:

1. Push to any branch. The **Android APK** workflow runs the tests, then builds the APK (about 15–25 minutes).
2. Open the run under the **Actions** tab and download the **DailyTracker-apk** artifact (a zip containing `DailyTracker-v1.0.0.apk`).
3. To publish a download link, push a tag: `git tag v1.0.0 && git push origin v1.0.0`. The workflow creates a GitHub Release with the APK attached.

**Use a permanent signing key** so users can install updates over an older version. Android refuses an update signed with a different key. Create the key once and keep it safe:

```bash
keytool -genkeypair -v -storetype JKS -keystore release.keystore -alias dailytracker \
        -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 release.keystore   # copy the output
```

Then add these repository secrets under **Settings → Secrets and variables → Actions**:

- `ANDROID_KEYSTORE_BASE64`: the base64 output
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`: for example `dailytracker`
- `ANDROID_KEY_PASSWORD`

Without these secrets, the APK is signed with a throwaway debug key. It installs fine, but each build has a different key.

### Option B: EAS Build (Expo's cloud)

```bash
npm install -g eas-cli
eas login                 # free Expo account, needed only by the developer
eas build:configure       # first time only: links the project
npm run apk:eas           # = eas build --platform android --profile preview
```

The `preview` profile in `eas.json` produces an `.apk`. EAS creates and stores a signing key for you, and prints a download link and QR code when the build finishes. The `production` profile builds an `.aab` for Google Play.

### Option C: Local build

Requirements: Node 20+, JDK 17, and the Android SDK (Android Studio), with `ANDROID_HOME` set.

```bash
npm install
npm run apk:local         # expo prebuild + ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

To sign with your own key locally, run `zipalign` and `apksigner` from the SDK build-tools on the APK, as in the workflow.

---

## Install & share the APK

1. Send the `.apk` file to the phone by any route: a GitHub Release link, Google Drive, email, USB, or a messaging app.
2. On the phone, open it. Android asks to allow **Install unknown apps** for the app you opened it from (browser, Files, Drive). Allow it once.
3. Tap **Install**. Play Protect may warn that the developer is unknown; choose **Install anyway**.
4. **Updating:** install a newer APK signed with the same key and data is kept. Bump `version` and `android.versionCode` in `app.json` for each release.

Everyone who installs the app gets an independent, empty database stored privately on their own phone. Nothing is shared or uploaded. To move data to a new phone, use **Settings → Export backup**, then **Restore from backup** on the new phone.
