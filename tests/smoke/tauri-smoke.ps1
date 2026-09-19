$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "pnpm is required to run the Tauri smoke harness."
}

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  throw "Cargo is required to build and smoke-test the Tauri target."
}

if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) {
  throw "rustc is required to build and smoke-test the Tauri target."
}

pnpm build
pnpm desktop:check
pnpm desktop:build

$releaseDirectory = Join-Path $PSScriptRoot "../../apps/desktop/src-tauri/target/release"
$executable = Get-ChildItem -Path $releaseDirectory -Filter "ritmo.exe" -File -Recurse |
  Select-Object -First 1

if ($null -eq $executable) {
  throw "Tauri build did not produce ritmo.exe under src-tauri/target/release."
}

$process = Start-Process -FilePath $executable.FullName -PassThru
try {
  for ($attempt = 0; $attempt -lt 15; $attempt++) {
    Start-Sleep -Seconds 1
    if ($process.HasExited) {
      throw "Ritmo exited during the Tauri startup smoke. Exit code: $($process.ExitCode)."
    }
  }
} finally {
  if (-not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }
}

Write-Host "Tauri Windows startup smoke passed for $($executable.FullName)."
