#!/usr/bin/env sh

set -eu

if ! command -v pnpm >/dev/null 2>&1; then
  printf '%s\n' "pnpm is required to run the Android smoke harness." >&2
  exit 1
fi

if ! command -v java >/dev/null 2>&1; then
  printf '%s\n' "Java is required to build and smoke-test Android." >&2
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  printf '%s\n' "adb is required to launch the Android smoke target." >&2
  exit 1
fi

if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ]; then
  printf '%s\n' "ANDROID_HOME or ANDROID_SDK_ROOT is required." >&2
  exit 1
fi

pnpm build
pnpm mobile:sync

# Capacitor adds its two Cordova bridge files; every Vite-owned asset must match.
if ! diff -rq -x cordova.js -x cordova_plugins.js \
  dist apps/mobile/android/app/src/main/assets/public; then
  printf '%s\n' "Capacitor Vite assets differ from the dist bundle." >&2
  exit 1
fi

sh apps/mobile/android/gradlew -p apps/mobile/android assembleDebug

apk="apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$apk" ]; then
  printf '%s\n' "Android build did not produce $apk." >&2
  exit 1
fi

serial="${ANDROID_SERIAL:-}"
if [ -z "$serial" ]; then
  serial="$(adb devices | while IFS=' ' read -r candidate state _; do
    case "$state" in
      device)
        printf '%s' "$candidate"
        break
        ;;
    esac
  done)"
fi

if [ -z "$serial" ]; then
  printf '%s\n' "No Android device or emulator is connected." >&2
  exit 1
fi

adb -s "$serial" wait-for-device
adb -s "$serial" install -r "$apk"
adb -s "$serial" shell am force-stop com.ritmo.app
adb -s "$serial" shell am start -n com.ritmo.app/.MainActivity

for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  window_state="$(adb -s "$serial" shell dumpsys window windows)"
  case "$window_state" in
    *com.ritmo.app*)
      printf '%s\n' "Android startup smoke passed on $serial."
      exit 0
      ;;
  esac
  sleep 1
done

printf '%s\n' "Ritmo did not reach the Android foreground window." >&2
exit 1
