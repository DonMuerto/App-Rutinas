import { ZodError } from "zod";

import { DomainError } from "@/lib/contracts";

function databaseErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return undefined;
}

function databaseErrorStatus(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }

  return undefined;
}

export function repositoryError(error: unknown): DomainError {
  if (error instanceof DomainError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new DomainError("VALIDATION", "Los datos enviados no son validos.", {
      cause: error,
    });
  }

  const code = databaseErrorCode(error);
  const status = databaseErrorStatus(error);

  if (status === 401 || code === "PGRST301" || code === "PGRST302") {
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

  if (code?.startsWith("23") || code === "22023" || code === "22P02") {
    return new DomainError("VALIDATION", "La operacion no es valida.", {
      cause: error,
    });
  }

  return new DomainError(
    "NETWORK",
    "No se pudo completar la operacion. Intenta nuevamente.",
    { cause: error },
  );
}

export function inaccessibleResource(): DomainError {
  return new DomainError(
    "NOT_FOUND",
    "El recurso no existe o no es accesible.",
  );
}

export function invalidPersistedRoutine(cause: unknown): DomainError {
  return new DomainError(
    "INVALID_DOCUMENT",
    "La rutina contiene datos que no se pueden interpretar de forma segura.",
    { cause },
  );
}
