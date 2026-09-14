import { randomUUID, sign as cryptoSign, verify as cryptoVerify } from "node:crypto";
import { PigeonError } from "./errors.js";

export const FEDERATION_VERSION = "pigeon.federation.v1";

/**
 * Create a signed, audience-bound federation grant.
 *
 * This is an authority object, not a transport token. A destination domain must
 * still apply its own local ingress policy before accepting communication.
 */
export function issueFederationGrant({
  issuer,
  audience,
  principal,
  subjects,
  ttlMs = 5 * 60 * 1000,
  now = Date.now(),
  nonce = randomUUID(),
  privateKey
}) {
  requireString("issuer", issuer);
  requireString("audience", audience);
  requireString("principal", principal);
  if (!Array.isArray(subjects) || subjects.length === 0) {
    throw new PigeonError("FEDERATION_SCOPE_REQUIRED", "A federation grant requires at least one subject scope.");
  }
  if (!privateKey) {
    throw new PigeonError("FEDERATION_SIGNING_KEY_REQUIRED", "A federation signing key is required.");
  }
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new PigeonError("FEDERATION_TTL_INVALID", "Federation grant ttlMs must be a positive number.");
  }

  const payload = {
    version: FEDERATION_VERSION,
    issuer,
    audience,
    principal,
    subjects: normalizeScopes(subjects),
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
    nonce
  };

  const signature = cryptoSign(null, Buffer.from(canonicalJson(payload)), privateKey).toString("base64url");
  return {
    ...payload,
    signature: {
      alg: "Ed25519",
      value: signature
    }
  };
}

/**
 * Verify cryptographic integrity and the basic federation boundary conditions.
 * Local ingress policy is intentionally not performed here.
 */
export function verifyFederationGrant(grant, publicKey, {
  audience,
  issuer,
  now = Date.now(),
  seenNonces
} = {}) {
  if (!grant || typeof grant !== "object" || Array.isArray(grant)) {
    throw new PigeonError("FEDERATION_GRANT_INVALID", "Federation grant must be an object.");
  }
  if (grant.version !== FEDERATION_VERSION) {
    throw new PigeonError("FEDERATION_VERSION_INVALID", `Unsupported federation grant version '${grant.version}'.`);
  }
  if (!grant.signature || grant.signature.alg !== "Ed25519" || typeof grant.signature.value !== "string") {
    throw new PigeonError("FEDERATION_SIGNATURE_INVALID", "Federation grant is missing an Ed25519 signature.");
  }
  if (!publicKey) {
    throw new PigeonError("FEDERATION_VERIFYING_KEY_REQUIRED", "A federation verifying key is required.");
  }
  if (audience && grant.audience !== audience) {
    throw new PigeonError("FEDERATION_AUDIENCE_MISMATCH", `Grant audience '${grant.audience}' does not match '${audience}'.`);
  }
  if (issuer && grant.issuer !== issuer) {
    throw new PigeonError("FEDERATION_ISSUER_MISMATCH", `Grant issuer '${grant.issuer}' does not match '${issuer}'.`);
  }

  const issuedAt = Date.parse(grant.issuedAt);
  const expiresAt = Date.parse(grant.expiresAt);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt) {
    throw new PigeonError("FEDERATION_TIME_INVALID", "Federation grant has an invalid validity window.");
  }
  if (expiresAt <= now) {
    throw new PigeonError("FEDERATION_GRANT_EXPIRED", "Federation grant has expired.");
  }
  if (issuedAt > now + 30_000) {
    throw new PigeonError("FEDERATION_GRANT_NOT_YET_VALID", "Federation grant was issued too far in the future.");
  }

  if (seenNonces) {
    if (seenNonces.has(grant.nonce)) {
      throw new PigeonError("FEDERATION_REPLAY_DETECTED", "Federation grant nonce has already been observed.");
    }
  }

  const { signature, ...payload } = grant;
  const valid = cryptoVerify(
    null,
    Buffer.from(canonicalJson(payload)),
    publicKey,
    Buffer.from(signature.value, "base64url")
  );
  if (!valid) {
    throw new PigeonError("FEDERATION_SIGNATURE_INVALID", "Federation grant signature is invalid.");
  }

  if (seenNonces) seenNonces.add(grant.nonce);
  return payload;
}

/**
 * Fail closed if a derived authority object expands the authority of its parent.
 * A destination may preserve or reduce authority, never add it.
 */
export function assertFederationAttenuation(parent, child) {
  if (!parent || !child) {
    throw new PigeonError("FEDERATION_ATTENUATION_INVALID", "Parent and child federation authority are required.");
  }
  if (parent.principal !== child.principal) {
    throw new PigeonError("FEDERATION_AUTHORITY_EXPANDED", "A derived grant cannot change the delegated principal.");
  }
  if (Date.parse(child.expiresAt) > Date.parse(parent.expiresAt)) {
    throw new PigeonError("FEDERATION_AUTHORITY_EXPANDED", "A derived grant cannot outlive its parent.");
  }

  const parentBySubject = new Map((parent.subjects || []).map((entry) => [entry.name, entry]));
  for (const childSubject of child.subjects || []) {
    const parentSubject = parentBySubject.get(childSubject.name);
    if (!parentSubject) {
      throw new PigeonError("FEDERATION_AUTHORITY_EXPANDED", `Subject '${childSubject.name}' is outside the parent authority.`);
    }
    assertSubset("operation", childSubject.operations, parentSubject.operations, childSubject.name);
    assertSubset("intent", childSubject.intents, parentSubject.intents, childSubject.name);
    assertSubset("region", childSubject.regions, parentSubject.regions, childSubject.name);
    assertSubset("scope", childSubject.scopes, parentSubject.scopes, childSubject.name);
  }
  return true;
}

export function localFederationContext(domain = "local") {
  requireString("domain", domain);
  return {
    originDomain: domain,
    destinationDomain: domain,
    federated: false
  };
}

function normalizeScopes(subjects) {
  return subjects.map((subject) => {
    requireString("subject.name", subject?.name);
    if (!Array.isArray(subject.operations) || subject.operations.length === 0) {
      throw new PigeonError("FEDERATION_SCOPE_INVALID", `Subject '${subject.name}' requires at least one operation.`);
    }
    return {
      name: subject.name,
      operations: uniqueSorted(subject.operations),
      intents: uniqueSorted(subject.intents || []),
      regions: uniqueSorted(subject.regions || []),
      scopes: uniqueSorted(subject.scopes || [])
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function assertSubset(kind, childValues = [], parentValues = [], subject) {
  const allowed = new Set(parentValues || []);
  for (const value of childValues || []) {
    if (!allowed.has(value)) {
      throw new PigeonError(
        "FEDERATION_AUTHORITY_EXPANDED",
        `${kind} '${value}' on '${subject}' is outside the parent authority.`
      );
    }
  }
}

function uniqueSorted(values) {
  return [...new Set(values.map((value) => String(value)))].sort();
}

function requireString(name, value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new PigeonError("FEDERATION_FIELD_INVALID", `${name} must be a non-empty string.`);
  }
}

function canonicalJson(value) {
  return JSON.stringify(sortForCanonicalisation(value));
}

function sortForCanonicalisation(value) {
  if (Array.isArray(value)) return value.map(sortForCanonicalisation);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortForCanonicalisation(value[key])])
  );
}
