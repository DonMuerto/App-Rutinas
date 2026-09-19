import type { JsonObject, JsonValue, RoutineDocument } from "@ritmo/core";

import { migrateDocumentEnvelope } from "./envelope";
import {
  isRecord,
  isSupportedBlockType,
  type DocumentBlock,
  type DocumentDiagnostic,
  type DocumentInspection,
  type SupportedBlockType,
} from "./types";

const blockKeys = new Set(["id", "type", "props", "content", "children"]);
const inlineKeys = {
  text: new Set(["type", "text", "styles"]),
  link: new Set(["type", "href", "content"]),
};
const styleKeys = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "textColor",
  "backgroundColor",
]);
const propsByType: Record<SupportedBlockType, ReadonlySet<string>> = {
  paragraph: new Set(["backgroundColor", "textColor", "textAlignment"]),
  heading: new Set([
    "backgroundColor",
    "textColor",
    "textAlignment",
    "level",
    "isToggleable",
  ]),
  bulletListItem: new Set(["backgroundColor", "textColor", "textAlignment"]),
  numberedListItem: new Set([
    "backgroundColor",
    "textColor",
    "textAlignment",
    "start",
  ]),
  checkListItem: new Set([
    "backgroundColor",
    "textColor",
    "textAlignment",
    "checked",
  ]),
  quote: new Set(["backgroundColor", "textColor"]),
  divider: new Set(),
  activity: new Set([
    "schemaVersion",
    "scheduledTime",
    "timerType",
    "countdownSeconds",
    "prepareSeconds",
    "workSeconds",
    "restSeconds",
    "cycles",
    "sets",
    "restBetweenSetsSeconds",
  ]),
};

function diagnostic(
  diagnostics: DocumentDiagnostic[],
  value: DocumentDiagnostic,
) {
  diagnostics.push(value);
}

function inspectStyles(
  value: unknown,
  path: readonly (string | number)[],
  diagnostics: DocumentDiagnostic[],
) {
  if (!isRecord(value)) {
    diagnostic(diagnostics, {
      code: "INLINE_CONTENT_INVALID",
      severity: "error",
      path,
      preventsEditing: true,
      message: "Los estilos inline no tienen un formato valido.",
    });
    return;
  }

  for (const [key, styleValue] of Object.entries(value)) {
    const expectsString = key === "textColor" || key === "backgroundColor";
    if (!styleKeys.has(key)) {
      diagnostic(diagnostics, {
        code: "INLINE_STYLE_UNKNOWN",
        severity: "error",
        path: [...path, key],
        preventsEditing: true,
        message: `El estilo inline '${key}' no esta registrado.`,
      });
    } else if (
      (expectsString && typeof styleValue !== "string") ||
      (!expectsString && typeof styleValue !== "boolean")
    ) {
      diagnostic(diagnostics, {
        code: "INLINE_CONTENT_INVALID",
        severity: "error",
        path: [...path, key],
        preventsEditing: true,
        message: "El valor del estilo inline no es valido.",
      });
    }
  }
}

function inspectInlineContent(
  value: unknown,
  path: readonly (string | number)[],
  diagnostics: DocumentDiagnostic[],
) {
  if (typeof value === "string") return;
  if (!Array.isArray(value)) {
    diagnostic(diagnostics, {
      code: "BLOCK_CONTENT_INVALID",
      severity: "error",
      path,
      preventsEditing: true,
      message: "El contenido inline del bloque no es valido.",
    });
    return;
  }

  value.forEach((inline, index) => {
    const inlinePath = [...path, index];
    if (!isRecord(inline) || typeof inline.type !== "string") {
      diagnostic(diagnostics, {
        code: "INLINE_CONTENT_INVALID",
        severity: "error",
        path: inlinePath,
        preventsEditing: true,
        message: "El elemento inline no es valido.",
      });
      return;
    }

    if (inline.type === "text") {
      if (
        Object.keys(inline).some((key) => !inlineKeys.text.has(key)) ||
        typeof inline.text !== "string"
      ) {
        diagnostic(diagnostics, {
          code: "INLINE_CONTENT_INVALID",
          severity: "error",
          path: inlinePath,
          preventsEditing: true,
          message: "El fragmento de texto inline no es valido.",
        });
      }
      inspectStyles(
        inline.styles ?? {},
        [...inlinePath, "styles"],
        diagnostics,
      );
      return;
    }

    if (inline.type === "link") {
      if (
        Object.keys(inline).some((key) => !inlineKeys.link.has(key)) ||
        typeof inline.href !== "string"
      ) {
        diagnostic(diagnostics, {
          code: "INLINE_CONTENT_INVALID",
          severity: "error",
          path: inlinePath,
          preventsEditing: true,
          message: "El enlace inline no es valido.",
        });
      }
      inspectInlineContent(
        inline.content,
        [...inlinePath, "content"],
        diagnostics,
      );
      return;
    }

    diagnostic(diagnostics, {
      code: "INLINE_CONTENT_UNKNOWN",
      severity: "error",
      path: inlinePath,
      preventsEditing: true,
      message: `El contenido inline '${inline.type}' no esta registrado.`,
    });
  });
}

function isValidNativeProp(
  blockType: Exclude<SupportedBlockType, "activity">,
  key: string,
  value: unknown,
) {
  if (key === "backgroundColor" || key === "textColor") {
    return typeof value === "string";
  }
  if (key === "textAlignment") {
    return ["left", "center", "right", "justify"].includes(String(value));
  }
  if (blockType === "heading" && key === "level") {
    return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 6;
  }
  if (blockType === "heading" && key === "isToggleable") {
    return typeof value === "boolean";
  }
  if (blockType === "numberedListItem" && key === "start") {
    return (
      value === undefined ||
      (typeof value === "number" && Number.isFinite(value))
    );
  }
  if (blockType === "checkListItem" && key === "checked") {
    return typeof value === "boolean";
  }
  return false;
}

function isValidActivityPrimitive(key: string, value: unknown) {
  if (key === "scheduledTime" || key === "timerType") {
    return typeof value === "string";
  }
  return typeof value === "number" && Number.isFinite(value);
}

function inspectBlocks(
  blocks: readonly JsonValue[],
  path: readonly (string | number)[],
  diagnostics: DocumentDiagnostic[],
  ids: Map<string, number>,
) {
  blocks.forEach((block, index) => {
    const blockPath = [...path, index];
    if (!isRecord(block)) {
      diagnostic(diagnostics, {
        code: "BLOCK_INVALID",
        severity: "error",
        path: blockPath,
        preventsEditing: true,
        message: "El bloque no tiene un formato valido.",
      });
      return;
    }

    for (const key of Object.keys(block)) {
      if (!blockKeys.has(key)) {
        diagnostic(diagnostics, {
          code: "BLOCK_INVALID",
          severity: "error",
          path: [...blockPath, key],
          blockId: typeof block.id === "string" ? block.id : undefined,
          preventsEditing: true,
          message: `La propiedad de bloque '${key}' no puede conservarse.`,
        });
      }
    }

    if (typeof block.type !== "string") {
      diagnostic(diagnostics, {
        code: "BLOCK_TYPE_MISSING",
        severity: "error",
        path: [...blockPath, "type"],
        preventsEditing: true,
        message: "El bloque no declara un tipo.",
      });
      return;
    }
    if (!isSupportedBlockType(block.type)) {
      diagnostic(diagnostics, {
        code: "UNKNOWN_BLOCK_TYPE",
        severity: "error",
        path: [...blockPath, "type"],
        blockId: typeof block.id === "string" ? block.id : undefined,
        preventsEditing: true,
        message: `El tipo de bloque '${block.type}' no esta registrado.`,
      });
      return;
    }

    if (typeof block.id !== "string" || block.id.length === 0) {
      diagnostic(diagnostics, {
        code: "BLOCK_ID_MISSING",
        severity: "warning",
        path: [...blockPath, "id"],
        preventsEditing: false,
        message: "El bloque no tiene un ID estable.",
      });
    } else {
      ids.set(block.id, (ids.get(block.id) ?? 0) + 1);
    }

    const props = block.props ?? {};
    if (!isRecord(props)) {
      diagnostic(diagnostics, {
        code: "BLOCK_PROP_UNSUPPORTED",
        severity: "error",
        path: [...blockPath, "props"],
        preventsEditing: true,
        message: "Las propiedades del bloque no tienen un formato valido.",
      });
    } else {
      for (const [key, value] of Object.entries(props)) {
        if (!propsByType[block.type].has(key)) {
          diagnostic(diagnostics, {
            code: "BLOCK_PROP_UNSUPPORTED",
            severity: "error",
            path: [...blockPath, "props", key],
            preventsEditing: true,
            message: `La propiedad '${key}' no puede conservarse.`,
          });
          continue;
        }

        const valid =
          block.type === "activity"
            ? isValidActivityPrimitive(key, value)
            : isValidNativeProp(block.type, key, value);
        if (!valid) {
          diagnostic(diagnostics, {
            code:
              block.type === "activity"
                ? "ACTIVITY_PROP_INVALID"
                : "BLOCK_PROP_UNSUPPORTED",
            severity: block.type === "activity" ? "warning" : "error",
            path: [...blockPath, "props", key],
            blockId: typeof block.id === "string" ? block.id : undefined,
            preventsEditing: block.type !== "activity",
            message:
              block.type === "activity"
                ? `La propiedad Activity '${key}' requiere correccion.`
                : `La propiedad '${key}' no puede conservarse.`,
          });
        }
      }
    }

    if (block.type === "divider") {
      if (block.content !== undefined) {
        diagnostic(diagnostics, {
          code: "BLOCK_CONTENT_INVALID",
          severity: "error",
          path: [...blockPath, "content"],
          preventsEditing: true,
          message: "Un divisor no puede tener contenido inline.",
        });
      }
    } else {
      inspectInlineContent(
        block.content ?? [],
        [...blockPath, "content"],
        diagnostics,
      );
    }

    if (block.children !== undefined && !Array.isArray(block.children)) {
      diagnostic(diagnostics, {
        code: "BLOCK_CHILDREN_INVALID",
        severity: "error",
        path: [...blockPath, "children"],
        preventsEditing: true,
        message: "Los descendientes no tienen un formato valido.",
      });
      return;
    }
    inspectBlocks(
      (block.children ?? []) as JsonValue[],
      [...blockPath, "children"],
      diagnostics,
      ids,
    );
  });
}

function toMountableBlocks(
  blocks: readonly JsonValue[],
  ids: ReadonlyMap<string, number>,
): DocumentBlock[] {
  return blocks.map((candidate) => {
    const block = candidate as Record<string, JsonValue | undefined>;
    const id =
      typeof block.id === "string" && ids.get(block.id) === 1
        ? block.id
        : undefined;
    const mountable: DocumentBlock = {
      ...(id ? { id } : {}),
      type: block.type as SupportedBlockType,
      props: (block.props ?? {}) as JsonObject,
      ...(block.content !== undefined ? { content: block.content } : {}),
      children: toMountableBlocks(
        (Array.isArray(block.children) ? block.children : []) as JsonValue[],
        ids,
      ),
    };
    return mountable;
  });
}

export function inspectDocument(input: unknown): DocumentInspection {
  const migration = migrateDocumentEnvelope(input);
  if (migration.kind === "recovery") return migration;

  const diagnostics = [...migration.diagnostics];
  const ids = new Map<string, number>();
  inspectBlocks(migration.document.blocks, ["blocks"], diagnostics, ids);

  for (const [id, count] of ids) {
    if (count > 1) {
      diagnostic(diagnostics, {
        code: "BLOCK_ID_DUPLICATE",
        severity: "warning",
        path: ["blocks"],
        blockId: id,
        preventsEditing: false,
        message: `El ID de bloque '${id}' esta duplicado.`,
      });
    }
  }

  if (diagnostics.some(({ preventsEditing }) => preventsEditing)) {
    return { kind: "recovery", original: input, diagnostics };
  }

  const syntheticEmptyBlock = migration.document.blocks.length === 0;
  return {
    kind: "editable",
    document: migration.document,
    initialBlocks: syntheticEmptyBlock
      ? [{ type: "paragraph", props: {}, children: [] }]
      : toMountableBlocks(migration.document.blocks, ids),
    diagnostics,
    syntheticEmptyBlock,
    ambiguousBlockIds: new Set(
      [...ids].filter(([, count]) => count > 1).map(([id]) => id),
    ),
    stableBlockIds: new Set(
      [...ids].filter(([, count]) => count === 1).map(([id]) => id),
    ),
    migratedFromLegacyArray: migration.migratedFromLegacyArray,
  };
}

export function getStableBlockIds(
  blocks: readonly DocumentBlock[],
): ReadonlySet<string> {
  const counts = new Map<string, number>();
  const visit = (current: readonly DocumentBlock[]) => {
    for (const block of current) {
      if (block.id) counts.set(block.id, (counts.get(block.id) ?? 0) + 1);
      visit(block.children);
    }
  };
  visit(blocks);
  return new Set(
    [...counts].filter(([, count]) => count === 1).map(([id]) => id),
  );
}

export function isRoutineDocument(value: unknown): value is RoutineDocument {
  return migrateDocumentEnvelope(value).kind === "ready";
}
