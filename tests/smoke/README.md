# Native smoke harnesses

These scripts are release gates, not substitutes for a device run.

## Tauri Windows

Run from the workspace root in PowerShell:

```powershell
pwsh -File tests/smoke/tauri-smoke.ps1
```

The script builds the Vite bundle, checks the Tauri environment, builds the
Windows artifact, and starts the resulting executable long enough to verify
that the shell remains alive.

## Capacitor Android

Run from the workspace root with Java, an Android SDK, and an attached device
or emulator:

```sh
bash tests/smoke/android-smoke.sh
```

The script builds and syncs the local bundle, assembles the debug APK, installs
it, starts `MainActivity`, and verifies that the Ritmo package reaches the
foreground. It requires `ANDROID_SERIAL` when more than one device is
connected.

The full product checklist still requires manual verification of auth, editor,
draft restore, timer restore, keyboard, back/resume, and secure storage on the
native WebViews. A successful shell smoke does not approve those scenarios.
