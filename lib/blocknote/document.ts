import { defaultBlockSpecs } from "@blocknote/core";

import { routineDocumentSchema, type RoutineDocument } from "@/lib/contracts";

import { activityPropSchema } from "./activity-block-config";
import type { RitmoBlock, RitmoPartialBlock } from "./activity-block-spec";
import { isRecord } from "./unknown";

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

export type DocumentDiagnosticCode =
  | "DOCUMENT_ROOT_INVALID"
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
  | "BLOCK_PROP_UNSUPPORTED";

export interface DocumentDiagnostic {
  readonly code: DocumentDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly path: readonly (string | number)[];
  readonly blockId?: string;
  readonly blocksEditorMount: boolean;
  readonly message: string;
}

export type DocumentInspection =
  | {
      readonly kind: "editable";
      readonly original: RoutineDocument;
      readonly initialContent: RitmoPartialBlock[];
      readonly diagnostics: readonly DocumentDiagnostic[];
      readonly syntheticEmptyBlock: boolean;
      readonly ambiguousBlockIds: ReadonlySet<string>;
      readonly stableBlockIds: ReadonlySet<string>;
    }
  | {
      readonly kind: "recovery";
      readonly original: unknown;
      readonly diagnostics: readonly DocumentDiagnostic[];
    };

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

interface RuntimePropSchema {
  readonly default: unknown;
  readonly type?: "boolean" | "number" | "string";
  readonly values?: readonly unknown[];
}

function getPropSchema(
  blockType: SupportedBlockType,
): Record<string, RuntimePropSchema> {
  if (blockType === "activity") {
    return activityPropSchema;
  }

  return defaultBlockSpecs[blockType].config.propSchema as Record<
    string,
    RuntimePropSchema
  >;
}

function isValidProp(
  blockType: SupportedBlockType,
  key: string,
  value: unknown,
) {
  const schema = getPropSchema(blockType)[key];
  if (!schema) return false;
  if (value === undefined) return true;

  if (schema.values) {
    return schema.values.some((candidate) => Object.is(candidate, value));
  }

  const expectedType = schema.type ?? typeof schema.default;
  return (
    typeof value === expectedType &&
    (expectedType !== "number" || Number.isFinite(value))
  );
}

function addDiagnostic(
  diagnostics: DocumentDiagnostic[],
  diagnostic: DocumentDiagnostic,
) {
  diagnostics.push(diagnostic);
}

function inspectStyles(
  value: unknown,
  path: readonly (string | number)[],
  diagnostics: DocumentDiagnostic[],
) {
  if (!isRecord(value)) {
    addDiagnostic(diagnostics, {
      code: "INLINE_CONTENT_INVALID",
      severity: "error",
      path,
      blocksEditorMount: true,
      message: "Los estilos inline no tienen un formato valido.",
    });
    return;
  }

  for (const [key, styleValue] of Object.entries(value)) {
    if (!styleKeys.has(key)) {
      addDiagnostic(diagnostics, {
        code: "INLINE_STYLE_UNKNOWN",
        severity: "error",
        path: [...path, key],
        blocksEditorMount: true,
        message: `El estilo inline '${key}' no esta registrado.`,
      });
      continue;
    }

    const expectsString = key === "textColor" || key === "backgroundColor";
    if (
      (expectsString && typeof styleValue !== "string") ||
      (!expectsString && typeof styleValue !== "boolean")
    ) {
      addDiagnostic(diagnostics, {
        code: "INLINE_CONTENT_INVALID",
        severity: "error",
        path: [...path, key],
        blocksEditorMount: true,
        message: "El valor del estilo inline no es valido.",
      });
    }
  }
}

function inspectLinkContent(
  value: unknown,
  path: readonly (string | number)[],
  diagnostics: DocumentDiagnostic[],
) {
  if (typeof value === "string") return;
  if (!Array.isArray(value)) {
    addDiagnostic(diagnostics, {
      code: "INLINE_CONTENT_INVALID",
      severity: "error",
      path,
      blocksEditorMount: true,
      message: "El texto del enlace no es valido.",
    });
    return;
  }

  value.forEach((inline, index) => {
    const inlinePath = [...path, index];
    if (
      !isRecord(inline) ||
      inline.type !== "text" ||
      typeof inline.text !== "string" ||
      Object.keys(inline).some((key) => !inlineKeys.text.has(key))
    ) {
      addDiagnostic(diagnostics, {
        code: "INLINE_CONTENT_INVALID",
        severity: "error",
        path: inlinePath,
        blocksEditorMount: true,
        message: "El texto del enlace no es valido.",
      });
      return;
    }
    inspectStyles(inline.styles ?? {}, [...inlinePath, "styles"], diagnostics);
  });
}

function inspectInlineContent(
  value: unknown,
  path: readonly (string | number)[],
  diagnostics: DocumentDiagnostic[],
) {
  if (typeof value === "string") {
    return;
  }

  if (!Array.isArray(value)) {
    addDiagnostic(diagnostics, {
      code: "BLOCK_CONTENT_INVALID",
      severity: "error",
      path,
      blocksEditorMount: true,
      message: "El contenido inline del bloque no es valido.",
    });
    return;
  }

  value.forEach((inline, index) => {
    const inlinePath = [...path, index];

    if (!isRecord(inline) || typeof inline.type !== "string") {
      addDiagnostic(diagnostics, {
        code: "INLINE_CONTENT_INVALID",
        severity: "error",
        path: inlinePath,
        blocksEditorMount: true,
        message: "El elemento inline no es valido.",
      });
      return;
    }

    if (inline.type === "text") {
      if (
        Object.keys(inline).some((key) => !inlineKeys.text.has(key)) ||
        typeof inline.text !== "string"
      ) {
        addDiagnostic(diagnostics, {
          code: "INLINE_CONTENT_INVALID",
          severity: "error",
          path: inlinePath,
          blocksEditorMount: true,
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
        addDiagnostic(diagnostics, {
          code: "INLINE_CONTENT_INVALID",
          severity: "error",
          path: inlinePath,
          blocksEditorMount: true,
          message: "El enlace inline no es valido.",
        });
      }
      inspectLinkContent(
        inline.content,
        [...inlinePath, "content"],
        diagnostics,
      );
      return;
    }

    addDiagnostic(diagnostics, {
      code: "INLINE_CONTENT_UNKNOWN",
      severity: "error",
      path: inlinePath,
      blocksEditorMount: true,
      message: `El contenido inline '${inline.type}' no esta registrado.`,
    });
  });
}

function isSupportedBlockType(value: string): value is SupportedBlockType {
  return supportedBlockTypes.some((type) => type === value);
}

function inspectBlocks(
  blocks: unknown[],
  path: readonly (string | number)[],
  diagnostics: DocumentDiagnostic[],
  ids: Map<string, number>,
) {
  blocks.forEach((block, index) => {
    const blockPath = [...path, index];

    if (!isRecord(block)) {
      addDiagnostic(diagnostics, {
        code: "BLOCK_INVALID",
        severity: "error",
        path: blockPath,
        blocksEditorMount: true,
        message: "El bloque no tiene un formato valido.",
      });
      return;
    }

    for (const key of Object.keys(block)) {
      if (!blockKeys.has(key)) {
        addDiagnostic(diagnostics, {
          code: "BLOCK_INVALID",
          severity: "error",
          path: [...blockPath, key],
          blockId: typeof block.id === "string" ? block.id : undefined,
          blocksEditorMount: true,
          message: `La propiedad de bloque '${key}' no puede conservarse.`,
        });
      }
    }

    if (typeof block.type !== "string") {
      addDiagnostic(diagnostics, {
        code: "BLOCK_TYPE_MISSING",
        severity: "error",
        path: [...blockPath, "type"],
        blocksEditorMount: true,
        message: "El bloque no declara un tipo.",
      });
      return;
    }

    if (!isSupportedBlockType(block.type)) {
      addDiagnostic(diagnostics, {
        code: "UNKNOWN_BLOCK_TYPE",
        severity: "error",
        path: [...blockPath, "type"],
        blockId: typeof block.id === "string" ? block.id : undefined,
        blocksEditorMount: true,
        message: `El tipo de bloque '${block.type}' no esta registrado.`,
      });
      return;
    }

    if (typeof block.id !== "string" || block.id.length === 0) {
      addDiagnostic(diagnostics, {
        code: "BLOCK_ID_MISSING",
        severity: "warning",
        path: [...blockPath, "id"],
        blocksEditorMount: false,
        message: "El bloque no tiene un ID estable.",
      });
    } else {
      ids.set(block.id, (ids.get(block.id) ?? 0) + 1);
    }

    const props = block.props === undefined ? {} : block.props;
    if (!isRecord(props)) {
      addDiagnostic(diagnostics, {
        code: "BLOCK_PROP_UNSUPPORTED",
        severity: "error",
        path: [...blockPath, "props"],
        blockId: typeof block.id === "string" ? block.id : undefined,
        blocksEditorMount: true,
        message: "Las propiedades del bloque no tienen un formato valido.",
      });
    } else {
      for (const [key, propValue] of Object.entries(props)) {
        if (
          !propsByType[block.type].has(key) ||
          !isValidProp(block.type, key, propValue)
        ) {
          addDiagnostic(diagnostics, {
            code: "BLOCK_PROP_UNSUPPORTED",
            severity: "error",
            path: [...blockPath, "props", key],
            blockId: typeof block.id === "string" ? block.id : undefined,
            blocksEditorMount: true,
            message: `La propiedad '${key}' no puede conservarse en este bloque.`,
          });
        }
      }
    }

    if (block.type === "divider") {
      if (block.content !== undefined) {
        addDiagnostic(diagnostics, {
          code: "BLOCK_CONTENT_INVALID",
          severity: "error",
          path: [...blockPath, "content"],
          blockId: typeof block.id === "string" ? block.id : undefined,
          blocksEditorMount: true,
          message: "Un divisor no puede tener contenido inline.",
        });
      }
    } else {
      inspectInlineContent(
        block.content === undefined ? [] : block.content,
        [...blockPath, "content"],
        diagnostics,
      );
    }

    if (block.children !== undefined && !Array.isArray(block.children)) {
      addDiagnostic(diagnostics, {
        code: "BLOCK_CHILDREN_INVALID",
        severity: "error",
        path: [...blockPath, "children"],
        blockId: typeof block.id === "string" ? block.id : undefined,
        blocksEditorMount: true,
        message: "Los bloques descendientes no tienen un formato valido.",
      });
      return;
    }

    inspectBlocks(
      block.children ?? [],
      [...blockPath, "children"],
      diagnostics,
      ids,
    );
  });
}

export function inspectDocument(input: unknown): DocumentInspection {
  const root = routineDocumentSchema.safeParse(input);

  if (!root.success) {
    return {
      kind: "recovery",
      original: input,
      diagnostics: [
        {
          code: "DOCUMENT_ROOT_INVALID",
          severity: "error",
          path: [],
          blocksEditorMount: true,
          message: "El documento no contiene una lista de bloques valida.",
        },
      ],
    };
  }

  const diagnostics: DocumentDiagnostic[] = [];
  const ids = new Map<string, number>();
  inspectBlocks(root.data, [], diagnostics, ids);

  for (const [id, count] of ids) {
    if (count > 1) {
      addDiagnostic(diagnostics, {
        code: "BLOCK_ID_DUPLICATE",
        severity: "warning",
        path: [],
        blockId: id,
        blocksEditorMount: false,
        message: `El ID de bloque '${id}' esta duplicado.`,
      });
    }
  }

  if (diagnostics.some((diagnostic) => diagnostic.blocksEditorMount)) {
    return {
      kind: "recovery",
      original: input,
      diagnostics,
    };
  }

  const syntheticEmptyBlock = root.data.length === 0;
  const toSafeInitialContent = (blocks: RoutineDocument): RitmoPartialBlock[] =>
    blocks.map((candidate) => {
      const block = candidate as Record<string, unknown>;
      const id =
        typeof block.id === "string" && ids.get(block.id) === 1
          ? block.id
          : undefined;
      const initialBlock: Record<string, unknown> = {
        ...block,
        children: toSafeInitialContent(
          (Array.isArray(block.children)
            ? block.children
            : []) as RoutineDocument,
        ),
      };
      if (!id) delete initialBlock.id;

      return initialBlock as RitmoPartialBlock;
    });
  const initialContent = syntheticEmptyBlock
    ? ([{ type: "paragraph" }] satisfies RitmoPartialBlock[])
    : toSafeInitialContent(root.data);

  return {
    kind: "editable",
    original: root.data,
    initialContent,
    diagnostics,
    syntheticEmptyBlock,
    ambiguousBlockIds: new Set(
      [...ids].filter(([, count]) => count > 1).map(([id]) => id),
    ),
    stableBlockIds: new Set(
      [...ids].filter(([, count]) => count === 1).map(([id]) => id),
    ),
  };
}

export function getStableBlockIds(
  blocks: readonly RitmoBlock[],
): ReadonlySet<string> {
  const counts = new Map<string, number>();

  const visit = (current: readonly RitmoBlock[]) => {
    for (const block of current) {
      counts.set(block.id, (counts.get(block.id) ?? 0) + 1);
      visit(block.children as RitmoBlock[]);
    }
  };
  visit(blocks);

  return new Set(
    [...counts].filter(([, count]) => count === 1).map(([id]) => id),
  );
}

export function normalizeActivityChecklists(
  blocks: readonly RitmoBlock[],
  insideActivity = false,
): RitmoBlock[] {
  return blocks.map((block) => {
    const descendantsInsideActivity =
      insideActivity || block.type === "activity";
    const children = normalizeActivityChecklists(
      block.children as RitmoBlock[],
      descendantsInsideActivity,
    );

    if (
      insideActivity &&
      block.type === "checkListItem" &&
      block.props.checked
    ) {
      return {
        ...block,
        props: { ...block.props, checked: false },
        children,
      } as RitmoBlock;
    }

    return { ...block, children } as RitmoBlock;
  });
}
