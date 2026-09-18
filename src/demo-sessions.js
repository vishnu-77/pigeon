import { randomUUID } from "node:crypto";
import { PigeonBroker } from "./broker.js";
import { createSessionDemoBroker } from "./subjects.js";
import { PigeonError } from "./errors.js";

// Capability-scoped, disposable demo brokers. They never touch the host broker's
// messages, consumers or durable storage. No cross-visitor global audit reads.
export class DemoSessions {
  constructor({ now = Date.now, ttlMs = 5 * 60_000, capacity = 100 } = {}) {
    this.now = now;
    this.ttlMs = ttlMs;
    this.capacity = capacity;
    this.sessions = new Map();
  }

  sweep() {
    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= this.now()) this.sessions.delete(id);
    }
  }

  create() {
    this.sweep();
    if (this.sessions.size >= this.capacity) {
      throw new PigeonError("RATE_LIMITED", "The demo is busy. Please try again shortly.");
    }
    const id = randomUUID();
    const expiresAt = this.now() + this.ttlMs;
    this.sessions.set(id, { broker: createSessionDemoBroker(PigeonBroker), expiresAt, operations: 0 });
    return { id, expiresAt: new Date(expiresAt).toISOString(), basePath: `/demo/sessions/${id}` };
  }

  get(id) {
    this.sweep();
    const session = this.sessions.get(id);
    if (!session) throw new PigeonError("DEMO_EXPIRED", "This demo has expired. Start a new run.");
    session.operations += 1;
    if (session.operations > 150) throw new PigeonError("RATE_LIMITED", "This demo has reached its limit. Start a new run.");
    return session.broker;
  }

  remove(id) {
    this.sessions.delete(id);
  }
}
