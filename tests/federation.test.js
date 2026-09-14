import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import {
  assertFederationAttenuation,
  issueFederationGrant,
  localFederationContext,
  verifyFederationGrant
} from "../src/federation.js";
import { PigeonError } from "../src/errors.js";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const NOW = Date.parse("2026-09-14T12:00:00.000Z");

function parentGrant(overrides = {}) {
  return issueFederationGrant({
    issuer: "pigeon://acme.uk",
    audience: "pigeon://analytics.eu",
    principal: "spiffe://acme.uk/ns/agents/sa/research-agent",
    subjects: [
      {
        name: "agents.delegate.task",
        operations: ["publish", "receive"],
        intents: ["investigate_issue"],
        regions: ["uk", "eu"],
        scopes: ["repo.read", "test.run"]
      }
    ],
    ttlMs: 10 * 60 * 1000,
    now: NOW,
    nonce: "grant-1",
    privateKey,
    ...overrides
  });
}

test("issues and verifies an audience-bound signed federation grant", () => {
  const grant = parentGrant();
  const verified = verifyFederationGrant(grant, publicKey, {
    audience: "pigeon://analytics.eu",
    issuer: "pigeon://acme.uk",
    now: NOW + 1_000
  });

  assert.equal(verified.principal, "spiffe://acme.uk/ns/agents/sa/research-agent");
  assert.equal(verified.subjects[0].name, "agents.delegate.task");
  assert.deepEqual(verified.subjects[0].scopes, ["repo.read", "test.run"]);
});

test("rejects a federation grant for the wrong audience", () => {
  const grant = parentGrant();
  assert.throws(
    () => verifyFederationGrant(grant, publicKey, { audience: "pigeon://other.example", now: NOW + 1_000 }),
    (error) => error instanceof PigeonError && error.code === "FEDERATION_AUDIENCE_MISMATCH"
  );
});

test("rejects a tampered federation grant", () => {
  const grant = parentGrant();
  const tampered = structuredClone(grant);
  tampered.subjects[0].scopes.push("production.deploy");

  assert.throws(
    () => verifyFederationGrant(tampered, publicKey, { audience: grant.audience, now: NOW + 1_000 }),
    (error) => error instanceof PigeonError && error.code === "FEDERATION_SIGNATURE_INVALID"
  );
});

test("detects replay when a nonce has already been consumed", () => {
  const grant = parentGrant();
  const seenNonces = new Set();

  verifyFederationGrant(grant, publicKey, {
    audience: grant.audience,
    now: NOW + 1_000,
    seenNonces
  });

  assert.throws(
    () => verifyFederationGrant(grant, publicKey, { audience: grant.audience, now: NOW + 2_000, seenNonces }),
    (error) => error instanceof PigeonError && error.code === "FEDERATION_REPLAY_DETECTED"
  );
});

test("accepts authority attenuation across a federation boundary", () => {
  const parent = parentGrant();
  const child = {
    ...structuredClone(parent),
    audience: "pigeon://worker.eu",
    expiresAt: new Date(NOW + 2 * 60 * 1000).toISOString(),
    subjects: [
      {
        name: "agents.delegate.task",
        operations: ["receive"],
        intents: ["investigate_issue"],
        regions: ["eu"],
        scopes: ["repo.read"]
      }
    ]
  };

  assert.equal(assertFederationAttenuation(parent, child), true);
});

test("rejects authority expansion across a federation boundary", () => {
  const parent = parentGrant();
  const child = {
    ...structuredClone(parent),
    expiresAt: new Date(NOW + 2 * 60 * 1000).toISOString(),
    subjects: [
      {
        name: "agents.delegate.task",
        operations: ["receive"],
        intents: ["investigate_issue"],
        regions: ["eu"],
        scopes: ["repo.read", "production.deploy"]
      }
    ]
  };

  assert.throws(
    () => assertFederationAttenuation(parent, child),
    (error) => error instanceof PigeonError && error.code === "FEDERATION_AUTHORITY_EXPANDED"
  );
});

test("local federation context models a single-node broker as one trust domain", () => {
  assert.deepEqual(localFederationContext("pigeon://local.dev"), {
    originDomain: "pigeon://local.dev",
    destinationDomain: "pigeon://local.dev",
    federated: false
  });
});
