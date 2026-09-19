import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  createLifecycleController,
  type PlatformServices,
  type SecureStoragePort,
} from "@ritmo/platform";
import {
  createWebPlatformServices,
  validateExternalUrl,
} from "@ritmo/platform-web";

function createSecureStorage(): SecureStoragePort {
  return {
    get: (key) => invoke<string | null>("secure_get", { key }),
    set: (key, value) => invoke<void>("secure_set", { key, value }),
    remove: (key) => invoke<void>("secure_remove", { key }),
  };
}

export async function createTauriPlatformServices(): Promise<PlatformServices> {
  const base = createWebPlatformServices();
  const lifecycle = createLifecycleController();
  const currentWindow = getCurrentWindow();
  const unlistenFocus = await currentWindow.onFocusChanged(({ payload }) => {
    if (payload) {
      void lifecycle.emit("active");
      void lifecycle.emit("resume");
    } else {
      void lifecycle.emit("background");
    }
  });
  const unlistenClose = await currentWindow.onCloseRequested(async (event) => {
    event.preventDefault();
    if ((await lifecycle.emit("close-requested")) === "continue") {
      await currentWindow.destroy();
    }
  });

  return {
    ...base,
    lifecycle,
    secureStorage: createSecureStorage(),
    externalLinks: {
      async open(url) {
        await openUrl(validateExternalUrl(url).toString());
      },
    },
    info: {
      kind: "desktop",
      capabilities: {
        secureStorage: true,
        nativeBack: false,
        closeRequest: true,
      },
    },
    async dispose() {
      unlistenFocus();
      unlistenClose();
      lifecycle.clear();
      await base.dispose();
    },
  };
}
