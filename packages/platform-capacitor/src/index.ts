import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import {
  createLifecycleController,
  type PlatformServices,
  type SecureStoragePort,
} from "@ritmo/platform";
import {
  createWebPlatformServices,
  validateExternalUrl,
} from "@ritmo/platform-web";

const INSTALLATION_MARKER = "ritmo:native-installation-v1";
let initializeSecureStoragePromise: Promise<void> | undefined;

function initializeSecureStorage() {
  initializeSecureStoragePromise ??= (async () => {
    await SecureStorage.setSynchronize(false);
    await SecureStorage.setKeyPrefix("ritmo_");

    // iOS preserves Keychain values after uninstall, while WebView storage is reset.
    if (localStorage.getItem(INSTALLATION_MARKER) !== "present") {
      await SecureStorage.clear(false);
      localStorage.setItem(INSTALLATION_MARKER, "present");
    }
  })();
  return initializeSecureStoragePromise;
}

function createSecureStorage(): SecureStoragePort {
  return {
    async get(key) {
      await initializeSecureStorage();
      return SecureStorage.getItem(key);
    },
    async set(key, value) {
      await initializeSecureStorage();
      await SecureStorage.setItem(key, value);
    },
    async remove(key) {
      await initializeSecureStorage();
      await SecureStorage.removeItem(key);
    },
  };
}

export async function createCapacitorPlatformServices(): Promise<PlatformServices> {
  await initializeSecureStorage();
  const base = createWebPlatformServices();
  const lifecycle = createLifecycleController();
  const listeners = await Promise.all([
    App.addListener("appStateChange", ({ isActive }) => {
      void lifecycle.emit(isActive ? "active" : "background");
    }),
    App.addListener("resume", () => {
      void lifecycle.emit("resume");
    }),
    App.addListener("backButton", ({ canGoBack }) => {
      void lifecycle.emit("back-requested").then((disposition) => {
        if (disposition === "continue") {
          if (canGoBack) {
            window.history.back();
          } else {
            void App.exitApp();
          }
        }
      });
    }),
  ]);

  return {
    ...base,
    lifecycle,
    secureStorage: createSecureStorage(),
    externalLinks: {
      async open(url) {
        window.open(
          validateExternalUrl(url).toString(),
          "_blank",
          "noopener,noreferrer",
        );
      },
    },
    info: {
      kind: "mobile",
      operatingSystem: Capacitor.getPlatform(),
      capabilities: {
        secureStorage: true,
        nativeBack: Capacitor.getPlatform() === "android",
        closeRequest: false,
      },
    },
    async dispose() {
      await Promise.all(listeners.map((listener) => listener.remove()));
      lifecycle.clear();
      await base.dispose();
    },
  };
}
