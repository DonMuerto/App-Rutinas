import { DomainError } from "@ritmo/core";

function property<T extends "code" | "status">(
  error: unknown,
  name: T,
): unknown {
  if (typeof error === "object" && error !== null && name in error) {
    return (error as Record<string, unknown>)[name];
  }

  return undefined;
}

export function dataError(error: unknown): DomainError {
  if (error instanceof DomainError) {
    return error;
  }

  if (property(error, "status") === 401) {
    return new DomainError(
      "UNAUTHENTICATED",
      "Tu sesion no es valida o ha expirado.",
      { cause: error },
    );
  }

  const code = property(error, "code");

  if (code === "PGRST301" || code === "PGRST302") {
    return new DomainError(
      "UNAUTHENTICATED",
      "Tu sesion no es valida o ha expirado.",
      { cause: error },
    );
  }

  if (code === "42501") {
    return new DomainError("RLS", "No tienes acceso a este recurso.", {
      cause: error,
    });
  }

  if (
    (typeof code === "string" && code.startsWith("23")) ||
    code === "22023" ||
    code === "22P02"
  ) {
    return new DomainError("VALIDATION", "La operacion no es valida.", {
      cause: error,
    });
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "ZodError"
  ) {
    return new DomainError("VALIDATION", "Los datos enviados no son validos.", {
      cause: error,
    });
  }

  return new DomainError(
    "NETWORK",
    "No se pudo completar la operacion. Intenta nuevamente.",
    { cause: error },
  );
}

export function inaccessibleResource() {
  return new DomainError(
    "NOT_FOUND",
    "El recurso no existe o no es accesible.",
  );
}

export function invalidDocument(cause: unknown) {
  return new DomainError(
    "INVALID_DOCUMENT",
    "La rutina contiene un documento que no se puede interpretar de forma segura.",
    { cause },
  );
}
