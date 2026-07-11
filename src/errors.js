export class PigeonError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PigeonError";
    this.code = code;
    this.details = details;
  }
}

export function isPigeonError(error) {
  return error instanceof PigeonError;
}
