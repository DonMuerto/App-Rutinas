import type { JsonValue, LocalDate, RoutineDocument } from "@ritmo/core";

export type PlatformKind = "web" | "desktop" | "mobile";
export type LifecycleEventType =
  "active" | "background" | "resume" | "close-requested" | "back-requested";
export type LifecycleDisposition = "handled" | "continue";
export type LifecycleListener = (
  event: LifecycleEventType,
) => LifecycleDisposition | Promise<LifecycleDisposition> | void;
export type Unsubscribe = () => void;

export interface LifecycleSubscriptionOptions {
  readonly priority?: number;
}

export interface LifecyclePort {
  subscribe(
    listener: LifecycleListener,
    options?: LifecycleSubscriptionOptions,
  ): Unsubscribe;
}

export interface SecureStoragePort {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface DraftJournal {
  version: 1;
  userId: string;
  routineId: string;
  baseRevision: number;
  generation: number;
  documentEnvelope: RoutineDocument;
  localDate: LocalDate;
  updatedAt: number;
}

export interface StoredDraft {
  storageVersion: string;
  journal: DraftJournal;
}

export type DraftCompareExchangeResult =
  | { applied: true; current: StoredDraft | null }
  | { applied: false; current: StoredDraft | null };

export interface DraftStoragePort {
  get(userId: string, routineId: string): Promise<StoredDraft | null>;
  list(userId: string): Promise<StoredDraft[]>;
  compareExchange(input: {
    userId: string;
    routineId: string;
    expectedStorageVersion: string | null;
    next: DraftJournal | null;
  }): Promise<DraftCompareExchangeResult>;
  clearUser(userId: string): Promise<void>;
}

export interface TimerSnapshotEnvelope {
  version: 1;
  userId: string;
  contextId: string;
  payload: JsonValue;
  updatedAt: number;
}

export interface TimerStoragePort {
  get(userId: string, contextId: string): Promise<TimerSnapshotEnvelope | null>;
  set(snapshot: TimerSnapshotEnvelope): Promise<void>;
  remove(userId: string, contextId: string): Promise<void>;
  clearUser(userId: string): Promise<void>;
}

export type AudioSignal = "phase" | "done";

export interface AudioPort {
  prepare(): Promise<void>;
  play(signal: AudioSignal): Promise<void>;
}

export interface NavigationPort {
  current(): string;
  push(path: string): void;
  replace(path: string): void;
  back(): void;
}

export interface ExternalLinksPort {
  open(url: string): Promise<void>;
}

export interface PlatformInfo {
  kind: PlatformKind;
  operatingSystem?: string;
  capabilities: {
    secureStorage: boolean;
    nativeBack: boolean;
    closeRequest: boolean;
  };
}

export interface PlatformServices {
  lifecycle: LifecyclePort;
  secureStorage: SecureStoragePort;
  drafts: DraftStoragePort;
  timerStorage: TimerStoragePort;
  audio: AudioPort;
  navigation: NavigationPort;
  externalLinks: ExternalLinksPort;
  info: PlatformInfo;
  dispose(): Promise<void>;
}
