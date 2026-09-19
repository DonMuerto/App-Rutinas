import type { PlatformServices } from "@ritmo/platform";

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

function isCapacitorRuntime() {
  const capacitor = (
    window as Window & {
      Capacitor?: { isNativePlatform?: () => boolean };
    }
  ).Capacitor;
  return capacitor?.isNativePlatform?.() === true;
}

export async function loadPlatformServices(): Promise<PlatformServices> {
  if (isTauriRuntime()) {
    const { createTauriPlatformServices } =
      await import("@ritmo/platform-tauri");
    return createTauriPlatformServices();
  }

  if (isCapacitorRuntime()) {
    const { createCapacitorPlatformServices } =
      await import("@ritmo/platform-capacitor");
    return createCapacitorPlatformServices();
  }

  const { createWebPlatformServices } = await import("@ritmo/platform-web");
  return createWebPlatformServices();
}
