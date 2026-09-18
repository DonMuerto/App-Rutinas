import { isRecord } from "./unknown";

export interface InlineTextIssue {
  readonly path: readonly (string | number)[];
  readonly message: string;
}

export function getInlinePlainText(
  value: unknown,
  path: readonly (string | number)[] = [],
  issues: InlineTextIssue[] = [],
): string {
  if (typeof value === "string") {
    return value;
  }

  if (!Array.isArray(value)) {
    issues.push({ path, message: "El contenido inline no es valido." });
    return "";
  }

  return value
    .map((inline, index) => {
      const inlinePath = [...path, index];
      if (!isRecord(inline)) {
        issues.push({
          path: inlinePath,
          message: "El elemento inline no es valido.",
        });
        return "";
      }

      if (inline.type === "text" && typeof inline.text === "string") {
        return inline.text;
      }

      if (inline.type === "link") {
        return getInlinePlainText(
          inline.content,
          [...inlinePath, "content"],
          issues,
        );
      }

      issues.push({
        path: inlinePath,
        message: "El elemento inline no es compatible.",
      });
      return "";
    })
    .join("");
}
