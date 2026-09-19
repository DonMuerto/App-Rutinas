import type {
  AudioSignal,
  DraftCompareExchangeResult,
  DraftStoragePort,
  ExternalLinksPort,
  LifecycleEventType,
  NavigationPort,
  PlatformServices,
  SecureStoragePort,
  StoredDraft,
  TimerSnapshotEnvelope,
  TimerStoragePort,
} from "./types";
import { createLifecycleController } from "./lifecycle";

function compositeKey(userId: string, resourceId: string) {
  return `${userId}:${resourceId}`;
}

class MemorySecureStorage implements SecureStoragePort {
  readonly values = new Map<string, string>();

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string) {
    this.values.set(key, value);
  }

  async remove(key: string) {
    this.values.delete(key);
  }
}

class MemoryDraftStorage implements DraftStoragePort {
  readonly values = new Map<string, StoredDraft>();
  private storageVersion = 0;

  async get(userId: string, routineId: string) {
    return this.values.get(compositeKey(userId, routineId)) ?? null;
  }

  async list(userId: string) {
    return [...this.values.values()].filter(
      ({ journal }) => journal.userId === userId,
    );
  }

  async compareExchange({
    userId,
    routineId,
    expectedStorageVersion,
    next,
  }: Parameters<
    DraftStoragePort["compareExchange"]
  >[0]): Promise<DraftCompareExchangeResult> {
    const key = compositeKey(userId, routineId);
    const current = this.values.get(key) ?? null;
    if ((current?.storageVersion ?? null) !== expectedStorageVersion) {
      return { applied: false, current };
    }

    if (next) {
      const stored = {
        storageVersion: `memory-${++this.storageVersion}`,
        journal: next,
      } satisfies StoredDraft;
      this.values.set(key, stored);
      return { applied: true, current: stored };
    }

    this.values.delete(key);
    return { applied: true, current: null };
  }

  async clearUser(userId: string) {
    for (const [key, { journal }] of this.values) {
      if (journal.userId === userId) {
        this.values.delete(key);
      }
    }
  }
}

class MemoryTimerStorage implements TimerStoragePort {
  readonly values = new Map<string, TimerSnapshotEnvelope>();

  async get(userId: string, contextId: string) {
    return this.values.get(compositeKey(userId, contextId)) ?? null;
  }

  async set(snapshot: TimerSnapshotEnvelope) {
    this.values.set(
      compositeKey(snapshot.userId, snapshot.contextId),
      snapshot,
    );
  }

  async remove(userId: string, contextId: string) {
    this.values.delete(compositeKey(userId, contextId));
  }

  async clearUser(userId: string) {
    for (const [key, snapshot] of this.values) {
      if (snapshot.userId === userId) {
        this.values.delete(key);
      }
    }
  }
}

export interface FakePlatformServices extends PlatformServices {
  emitLifecycle(event: LifecycleEventType): Promise<void>;
  readonly playedAudio: AudioSignal[];
  readonly openedUrls: string[];
  readonly navigationHistory: string[];
}

export function createFakePlatformServices(): FakePlatformServices {
  const lifecycle = createLifecycleController();
  const secureStorage = new MemorySecureStorage();
  const drafts = new MemoryDraftStorage();
  const timerStorage = new MemoryTimerStorage();
  const playedAudio: AudioSignal[] = [];
  const openedUrls: string[] = [];
  const navigationHistory = ["/"];

  const navigation: NavigationPort = {
    current: () => navigationHistory.at(-1) ?? "/",
    push: (path) => navigationHistory.push(path),
    replace: (path) => {
      navigationHistory[navigationHistory.length - 1] = path;
    },
    back: () => {
      if (navigationHistory.length > 1) {
        navigationHistory.pop();
      }
    },
  };

  const externalLinks: ExternalLinksPort = {
    async open(url) {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Unsupported external URL scheme.");
      }
      openedUrls.push(parsed.toString());
    },
  };

  return {
    lifecycle,
    secureStorage,
    drafts,
    timerStorage,
    audio: {
      async prepare() {},
      async play(signal) {
        playedAudio.push(signal);
      },
    },
    navigation,
    externalLinks,
    info: {
      kind: "web",
      capabilities: {
        secureStorage: false,
        nativeBack: false,
        closeRequest: false,
      },
    },
    playedAudio,
    openedUrls,
    navigationHistory,
    async emitLifecycle(event) {
      await lifecycle.emit(event);
    },
    async dispose() {
      lifecycle.clear();
    },
  };
}
