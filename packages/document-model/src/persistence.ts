import {
  ROUTINE_DOCUMENT_SCHEMA_VERSION,
  routineDocumentSchema,
  type JsonObject,
  type JsonValue,
  type RoutineDocument,
} from "@ritmo/core";

import type { DocumentBlock } from "./types";
import { isRecord } from "./types";

function normalizeBlocks(
  blocks: readonly DocumentBlock[],
  insideActivity: boolean,
): JsonValue[] {
  return blocks.map((block) => {
    const descendantsInsideActivity =
      insideActivity || block.type === "activity";
    const props: JsonObject = { ...block.props };

    if (
      insideActivity &&
      block.type === "checkListItem" &&
      props.checked === true
    ) {
      props.checked = false;
    }
    if (block.type === "activity" && props.scheduledTime === "") {
      delete props.scheduledTime;
    }

    return {
      ...(block.id ? { id: block.id } : {}),
      type: block.type,
      props,
      ...(block.content !== undefined ? { content: block.content } : {}),
      children: normalizeBlocks(block.children, descendantsInsideActivity),
    } satisfies JsonObject;
  });
}

export function serializeDocument(
  blocks: readonly DocumentBlock[],
): RoutineDocument {
  return routineDocumentSchema.parse({
    schemaVersion: ROUTINE_DOCUMENT_SCHEMA_VERSION,
    blocks: normalizeBlocks(blocks, false),
  });
}

export function normalizeActivityChecklists(
  document: RoutineDocument,
): RoutineDocument {
  const canonical = routineDocumentSchema.parse(document);
  const visit = (blocks: readonly JsonValue[], insideActivity: boolean) =>
    blocks.map((candidate): JsonValue => {
      if (!isRecord(candidate)) return candidate as JsonValue;
      const type = candidate.type;
      const descendantsInsideActivity = insideActivity || type === "activity";
      const props = isRecord(candidate.props)
        ? { ...candidate.props }
        : candidate.props;
      if (
        insideActivity &&
        type === "checkListItem" &&
        isRecord(props) &&
        props.checked === true
      ) {
        props.checked = false;
      }
      if (
        type === "activity" &&
        isRecord(props) &&
        props.scheduledTime === ""
      ) {
        delete props.scheduledTime;
      }
      return {
        ...candidate,
        ...(props !== undefined ? { props: props as JsonValue } : {}),
        ...(Array.isArray(candidate.children)
          ? {
              children: visit(
                candidate.children as JsonValue[],
                descendantsInsideActivity,
              ),
            }
          : {}),
      } as JsonObject;
    });

  return routineDocumentSchema.parse({
    ...canonical,
    blocks: visit(canonical.blocks, false),
  });
}
