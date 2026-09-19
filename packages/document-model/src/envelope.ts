import {
  ROUTINE_DOCUMENT_SCHEMA_VERSION,
  routineDocumentSchema,
  type RoutineDocument,
} from "@ritmo/core";

import type { DocumentDiagnostic } from "./types";

export type DocumentEnvelopeMigrationResult =
  | {
      kind: "ready";
      document: RoutineDocument;
      migratedFromLegacyArray: boolean;
      diagnostics: readonly DocumentDiagnostic[];
    }
  | {
      kind: "recovery";
      original: unknown;
      diagnostics: readonly DocumentDiagnostic[];
    };

export function createEmptyDocument(): RoutineDocument {
  return { schemaVersion: ROUTINE_DOCUMENT_SCHEMA_VERSION, blocks: [] };
}

export function migrateDocumentEnvelope(
  input: unknown,
): DocumentEnvelopeMigrationResult {
  const migratedFromLegacyArray = Array.isArray(input);
  const candidate = migratedFromLegacyArray
    ? { schemaVersion: ROUTINE_DOCUMENT_SCHEMA_VERSION, blocks: input }
    : input;
  const parsed = routineDocumentSchema.safeParse(candidate);

  if (parsed.success) {
    return {
      kind: "ready",
      document: parsed.data,
      migratedFromLegacyArray,
      diagnostics: migratedFromLegacyArray
        ? [
            {
              code: "LEGACY_DOCUMENT_MIGRATED",
              severity: "warning",
              path: [],
              preventsEditing: false,
              message: "El documento historico se adapto al envelope actual.",
            },
          ]
        : [],
    };
  }

  const version =
    typeof input === "object" && input !== null && "schemaVersion" in input
      ? input.schemaVersion
      : undefined;
  const unsupportedVersion =
    version !== undefined && version !== ROUTINE_DOCUMENT_SCHEMA_VERSION;

  return {
    kind: "recovery",
    original: input,
    diagnostics: [
      {
        code: unsupportedVersion
          ? "DOCUMENT_VERSION_UNSUPPORTED"
          : "DOCUMENT_ROOT_INVALID",
        severity: "error",
        path: unsupportedVersion ? ["schemaVersion"] : [],
        preventsEditing: true,
        message: unsupportedVersion
          ? "La version del documento no es compatible."
          : "El documento no contiene un envelope valido.",
      },
    ],
  };
}
