#!/usr/bin/env sh

set -eu

api_level="${ANDROID_EMULATOR_API_LEVEL:-35}"
arch="${ANDROID_EMULATOR_ARCH:-x86_64}"
target="${ANDROID_EMULATOR_TARGET:-google_apis}"
profile="${ANDROID_EMULATOR_PROFILE:-pixel_6}"
avd_name="${ANDROID_AVD_NAME:-ritmo-smoke}"
port="${ANDROID_EMULATOR_PORT:-5554}"
serial="emulator-$port"
sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
system_image="system-images;android-$api_level;$target;$arch"
emulator_log="${RUNNER_TEMP:-/tmp}/ritmo-android-emulator.log"

if [ -z "$sdk_root" ]; then
  printf '%s\n' "ANDROID_HOME or ANDROID_SDK_ROOT is required." >&2
  exit 1
fi

for command_name in sdkmanager avdmanager adb timeout; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf '%s\n' "$command_name is required to run the Android emulator smoke." >&2
    exit 1
  fi
done

sdkmanager --install \
  "platform-tools" \
  "platforms;android-36" \
  "build-tools;36.0.0" \
  "emulator" \
  "$system_image" >/dev/null

printf 'no\n' | avdmanager create avd \
  --force \
  --name "$avd_name" \
  --package "$system_image" \
  --device "$profile" >/dev/null

"$sdk_root/emulator/emulator" \
  -port "$port" \
  -avd "$avd_name" \
  -no-window \
  -gpu swiftshader_indirect \
  -no-snapshot \
  -noaudio \
  -no-boot-anim \
  -camera-back none >"$emulator_log" 2>&1 &
emulator_pid=$!

print_emulator_log() {
  if [ -f "$emulator_log" ]; then
    while IFS= read -r line; do
      printf '%s\n' "$line" >&2
    done <"$emulator_log"
  fi
}

cleanup() {
  adb -s "$serial" emu kill >/dev/null 2>&1 || true
  kill "$emulator_pid" 2>/dev/null || true
  wait "$emulator_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if ! timeout 600 adb -s "$serial" wait-for-device; then
  printf '%s\n' "Android emulator did not connect to ADB within 10 minutes." >&2
  print_emulator_log
  exit 1
fi

attempt=0
while [ "$attempt" -lt 300 ]; do
  boot_completed="$(adb -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  package_service="$(adb -s "$serial" shell service check package 2>/dev/null || true)"

  case "$package_service" in
    *": found") package_ready=1 ;;
    *) package_ready=0 ;;
  esac

  if [ "$boot_completed" = "1" ] && [ "$package_ready" -eq 1 ]; then
    break
  fi

  if ! kill -0 "$emulator_pid" 2>/dev/null; then
    printf '%s\n' "Android emulator exited before completing boot. Log: $emulator_log" >&2
    print_emulator_log
    exit 1
  fi

  attempt=$((attempt + 1))
  sleep 2
done

if [ "$attempt" -eq 300 ]; then
  printf '%s\n' "Android emulator did not become ready within 10 minutes. Log: $emulator_log" >&2
  print_emulator_log
  exit 1
fi

ANDROID_SERIAL="$serial" sh tests/smoke/android-smoke.sh
