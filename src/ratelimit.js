// Rate limiting (FND-07).
//
// A token bucket per (subject, principal). Subjects opt in with:
//   rateLimit: { perSecond: <number>, burst: <number> }
// Absent config means unlimited. Exceeding the bucket fails closed with RATE_LIMITED
// so an ungoverned publish rate cannot undercut the governance guarantees.
//
// Zero runtime dependencies.

import { PigeonError } from "./errors.js";

export class RateLimiter {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.buckets = new Map();
  }

  check(subject, principalId) {
    const config = subject.rateLimit;
    if (!config || !(config.perSecond > 0)) {
      return; // unlimited
    }

    const capacity = config.burst ?? config.perSecond;
    const key = `${subject.name}:${principalId}`;
    const now = this.now();
    const bucket = this.buckets.get(key) ?? { tokens: capacity, updated: now };

    // Refill based on elapsed time, capped at capacity.
    const elapsedSeconds = (now - bucket.updated) / 1000;
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSeconds * config.perSecond);
    bucket.updated = now;

    if (bucket.tokens < 1) {
      this.buckets.set(key, bucket);
      throw new PigeonError(
        "RATE_LIMITED",
        `Rate limit exceeded for ${principalId} on ${subject.name} (${config.perSecond}/s).`
      );
    }

    bucket.tokens -= 1;
    this.buckets.set(key, bucket);
  }
}
