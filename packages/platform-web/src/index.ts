import {
  createLifecycleController,
  type AudioPort,
  type ExternalLinksPort,
  type NavigationPort,
  type PlatformServices,
  type SecureStoragePort,
} from "@ritmo/platform";

import {
  createIndexedDbDraftStorage,
  createIndexedDbTimerStorage,
} from "./indexed-db";

const STORAGE_PREFIX = "ritmo:v1:";

export function validateExternalUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Unsupported external URL scheme.");
  }
  return parsed;
}

function createSecureStorage(): SecureStoragePort {
  return {
    async get(key) {
      return localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    },
    async set(key, value) {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, value);
    },
    async remove(key) {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    },
  };
}

function createNavigation(): NavigationPort {
  const normalize = (path: string) =>
    path.startsWith("/") ? path : `/${path}`;
  return {
    current: () => window.location.hash.replace(/^#/, "") || "/",
    push(path) {
      window.location.hash = normalize(path);
    },
    replace(path) {
      window.location.replace(`#${normalize(path)}`);
    },
    back() {
      window.history.back();
    },
  };
}

function createAudio(): AudioPort {
  let context: AudioContext | null = null;

  return {
    async prepare() {
      context ??= new AudioContext();
      if (context.state === "suspended") {
        await context.resume();
      }
    },
    async play(signal) {
      try {
        context ??= new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = signal === "done" ? 880 : 660;
        gain.gain.setValueAtTime(0.08, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          context.currentTime + 0.15,
        );
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.15);
      } catch {
        // Audio failure must never affect timer state.
      }
    },
  };
}

export function createWebPlatformServices(): PlatformServices {
  const lifecycle = createLifecycleController();
  const cleanups: Array<() => void> = [];
  const listen = <K extends keyof WindowEventMap>(
    target: Window,
    event: K,
    listener: (event: WindowEventMap[K]) => void,
  ) => {
    target.addEventListener(event, listener);
    cleanups.push(() => target.removeEventListener(event, listener));
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      void lifecycle.emit("background");
      return;
    }
    void lifecycle.emit("active");
    void lifecycle.emit("resume");
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  cleanups.push(() =>
    document.removeEventListener("visibilitychange", onVisibilityChange),
  );
  listen(window, "pagehide", () => {
    void lifecycle.emit("close-requested");
  });
  const externalLinks: ExternalLinksPort = {
    async open(url) {
      const parsed = validateExternalUrl(url);
      window.open(parsed.toString(), "_blank", "noopener,noreferrer");
    },
  };

  return {
    lifecycle,
    secureStorage: createSecureStorage(),
    drafts: createIndexedDbDraftStorage(),
    timerStorage: createIndexedDbTimerStorage(),
    audio: createAudio(),
    navigation: createNavigation(),
    externalLinks,
    info: {
      kind: "web",
      capabilities: {
        secureStorage: false,
        nativeBack: false,
        closeRequest: false,
      },
    },
    async dispose() {
      cleanups.forEach((cleanup) => cleanup());
      lifecycle.clear();
    },
  };
}
