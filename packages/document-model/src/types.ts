import type { JsonObject, JsonValue, RoutineDocument } from "@ritmo/core";

export const supportedBlockTypes = [
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "quote",
  "divider",
  "activity",
] as const;

export type SupportedBlockType = (typeof supportedBlockTypes)[number];

export interface DocumentBlock {
  id?: string;
  type: SupportedBlockType;
  props: JsonObject;
  content?: JsonValue;
  children: DocumentBlock[];
}

export type DocumentDiagnosticCode =
  | "DOCUMENT_ROOT_INVALID"
  | "DOCUMENT_VERSION_UNSUPPORTED"
  | "LEGACY_DOCUMENT_MIGRATED"
  | "BLOCK_INVALID"
  | "BLOCK_TYPE_MISSING"
  | "UNKNOWN_BLOCK_TYPE"
  | "BLOCK_ID_MISSING"
  | "BLOCK_ID_DUPLICATE"
  | "BLOCK_CHILDREN_INVALID"
  | "BLOCK_CONTENT_INVALID"
  | "INLINE_CONTENT_INVALID"
  | "INLINE_CONTENT_UNKNOWN"
  | "INLINE_STYLE_UNKNOWN"
  | "BLOCK_PROP_UNSUPPORTED"
  | "ACTIVITY_PROP_INVALID";

export interface DocumentDiagnostic {
  code: DocumentDiagnosticCode;
  severity: "warning" | "error";
  path: readonly (string | number)[];
  blockId?: string;
  preventsEditing: boolean;
  message: string;
}

export type DocumentInspection =
  | {
      kind: "editable";
      document: RoutineDocument;
      initialBlocks: DocumentBlock[];
      diagnostics: readonly DocumentDiagnostic[];
      syntheticEmptyBlock: boolean;
      ambiguousBlockIds: ReadonlySet<string>;
      stableBlockIds: ReadonlySet<string>;
      migratedFromLegacyArray: boolean;
    }
  | {
      kind: "recovery";
      original: unknown;
      diagnostics: readonly DocumentDiagnostic[];
    };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSupportedBlockType(
  value: string,
): value is SupportedBlockType {
  return supportedBlockTypes.some((type) => type === value);
}
