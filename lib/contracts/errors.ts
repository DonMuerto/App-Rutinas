export const domainErrorCodes = [
  "UNAUTHENTICATED",
  "NOT_FOUND",
  "VALIDATION",
  "TIMER_CONFLICT",
  "NETWORK",
  "RLS",
  "INVALID_DOCUMENT",
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
