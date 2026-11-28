export type ServiceErrorCode = "NOT_FOUND" | "CONFLICT" | "INVALID";

export class ServiceError extends Error {
  constructor(
    public code: ServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}