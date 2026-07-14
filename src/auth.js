// Authentication (FND-01).
//
// The broker must never trust a principal asserted in a message or a plain header.
// An Authenticator resolves a bearer credential to a principal *server-side*; the
// broker then binds that principal to the session/contract. Client-supplied identity
// is ignored.
//
// This is a deliberately small, stdlib-only credential registry suitable for the MVP
// (static bearer tokens mapped to principals). It implements the seam a real
// authenticator (mTLS CN, SPIFFE SVID, signed JWT) would plug into: authenticate()
// takes an opaque credential and returns a principal, or throws UNAUTHENTICATED.

import { PigeonError } from "./errors.js";

export class Authenticator {
  constructor() {
    this.tokens = new Map();
  }

  // Register a bearer token that authenticates as `principal`.
  // `principal` is { id, attributes? }.
  registerToken(token, principal) {
    if (!token || typeof token !== "string") {
      throw new PigeonError("BAD_REQUEST", "A token must be a non-empty string.");
    }
    this.tokens.set(token, { attributes: {}, ...principal });
    return this;
  }

  // Resolve a bearer credential to a principal. Throws UNAUTHENTICATED when the
  // credential is absent or unknown - the broker fails closed.
  authenticate(credential) {
    const token = extractBearer(credential);
    if (!token) {
      throw new PigeonError("UNAUTHENTICATED", "Missing or malformed bearer credential.");
    }
    const principal = this.tokens.get(token);
    if (!principal) {
      throw new PigeonError("UNAUTHENTICATED", "Credential is not recognized.");
    }
    return { id: principal.id, attributes: { ...principal.attributes } };
  }
}

// Accepts either a raw token or an "Authorization: Bearer <token>" header value.
// Parsed with plain string ops (no regex) so a hostile Authorization header cannot
// trigger polynomial regex backtracking (ReDoS).
function extractBearer(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.slice(0, 7).toLowerCase() === "bearer ") {
    return trimmed.slice(7).trim() || null;
  }
  return trimmed || null;
}
