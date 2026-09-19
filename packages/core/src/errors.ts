export const domainErrorCodes = [
  "UNAUTHENTICATED",
  "NOT_FOUND",
  "VALIDATION",
  "DOCUMENT_CONFLICT",
  "TIMER_CONFLICT",
  "NETWORK",
  "RLS",
  "INVALID_DOCUMENT",
  "STORAGE",
] as const;

export type DomainErrorCode = (typeof domainErrorCodes)[number];

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DomainError";
  }
}
