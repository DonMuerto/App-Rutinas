import type {
  DraftCompareExchangeResult,
  DraftJournal,
  DraftStoragePort,
  StoredDraft,
  TimerSnapshotEnvelope,
  TimerStoragePort,
} from "@ritmo/platform";

const DATABASE_NAME = "ritmo-platform-v1";
const DATABASE_VERSION = 1;
const DRAFT_STORE = "drafts";
const TIMER_STORE = "timers";

function resourceKey(userId: string, resourceId: string) {
  return `${userId}:${resourceId}`;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DRAFT_STORE)) {
        database.createObjectStore(DRAFT_STORE);
      }
      if (!database.objectStoreNames.contains(TIMER_STORE)) {
        database.createObjectStore(TIMER_STORE);
      }
    };
  });
}

async function runRequest<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      let result: T;
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

async function removeMatching<T>(
  storeName: string,
  matches: (value: T) => boolean,
) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const cursorRequest = store.openCursor();
      cursorRequest.onerror = () => reject(cursorRequest.error);
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          return;
        }
        if (matches(cursor.value as T)) {
          cursor.delete();
        }
        cursor.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

async function compareExchangeDraft(input: {
  userId: string;
  routineId: string;
  expectedStorageVersion: string | null;
  next: DraftJournal | null;
}): Promise<DraftCompareExchangeResult> {
  const database = await openDatabase();
  try {
    return await new Promise<DraftCompareExchangeResult>((resolve, reject) => {
      const transaction = database.transaction(DRAFT_STORE, "readwrite");
      const store = transaction.objectStore(DRAFT_STORE);
      const key = resourceKey(input.userId, input.routineId);
      const getRequest = store.get(key) as IDBRequest<StoredDraft | undefined>;
      let result: DraftCompareExchangeResult | undefined;

      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const current = getRequest.result ?? null;
        if (
          (current?.storageVersion ?? null) !== input.expectedStorageVersion
        ) {
          result = { applied: false, current };
          return;
        }

        if (!input.next) {
          store.delete(key);
          result = { applied: true, current: null };
          return;
        }

        const stored = {
          storageVersion: crypto.randomUUID(),
          journal: input.next,
        } satisfies StoredDraft;
        store.put(stored, key);
        result = { applied: true, current: stored };
      };
      transaction.oncomplete = () => {
        if (result) resolve(result);
        else reject(new Error("Draft transaction completed without a result."));
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export function createIndexedDbDraftStorage(): DraftStoragePort {
  return {
    async get(userId, routineId) {
      const value = await runRequest<StoredDraft | undefined>(
        DRAFT_STORE,
        "readonly",
        (store) => store.get(resourceKey(userId, routineId)),
      );
      return value ?? null;
    },
    async list(userId) {
      const values = await runRequest<StoredDraft[]>(
        DRAFT_STORE,
        "readonly",
        (store) => store.getAll(),
      );
      return values.filter(({ journal }) => journal.userId === userId);
    },
    compareExchange(input) {
      return compareExchangeDraft(input);
    },
    async clearUser(userId) {
      await removeMatching<StoredDraft>(
        DRAFT_STORE,
        ({ journal }) => journal.userId === userId,
      );
    },
  };
}

export function createIndexedDbTimerStorage(): TimerStoragePort {
  return {
    async get(userId, contextId) {
      const value = await runRequest<TimerSnapshotEnvelope | undefined>(
        TIMER_STORE,
        "readonly",
        (store) => store.get(resourceKey(userId, contextId)),
      );
      return value ?? null;
    },
    async set(snapshot) {
      await runRequest(TIMER_STORE, "readwrite", (store) =>
        store.put(snapshot, resourceKey(snapshot.userId, snapshot.contextId)),
      );
    },
    async remove(userId, contextId) {
      await runRequest(TIMER_STORE, "readwrite", (store) =>
        store.delete(resourceKey(userId, contextId)),
      );
    },
    async clearUser(userId) {
      await removeMatching<TimerSnapshotEnvelope>(
        TIMER_STORE,
        (snapshot) => snapshot.userId === userId,
      );
    },
  };
}
