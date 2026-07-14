// Pigeon client SDK (FND-15).
//
// A small, dependency-free client for the Pigeon HTTP broker. It authenticates with a
// bearer token, negotiates a session contract, and runs publish/receive/request under
// it - surfacing policy denials as typed errors. Works in Node (>=18) and the browser
// (anywhere global fetch exists). Types ship alongside in pigeon-client.d.ts.
//
//   import { PigeonClient } from "./pigeon-client.mjs";
//   const client = new PigeonClient({ url, token: "checkout-token" });
//   await client.connect(["payments.authorize"]);
//   await client.request("payments.authorize", data, { intent: "authorize_payment", ... });

export class PigeonClientError extends Error {
  constructor(code, message, status, details = {}) {
    super(message);
    this.name = "PigeonClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class PigeonClient {
  constructor({ url = "http://localhost:8787", token, region = "uk", fetchImpl } = {}) {
    this.url = url.replace(/\/$/, "");
    this.token = token;
    this.region = region;
    this.fetch = fetchImpl ?? globalThis.fetch;
    this.contractId = null;
    this.contract = null;
    if (typeof this.fetch !== "function") {
      throw new PigeonClientError("NO_FETCH", "No fetch implementation available; pass fetchImpl.", 0);
    }
  }

  // Authenticate + negotiate a session contract for the given subjects.
  async connect(subjects, { ttlMs } = {}) {
    const { contract } = await this.#post("/v1/contracts", { subjects, ttlMs }, false);
    this.contract = contract;
    this.contractId = contract.id;
    return contract;
  }

  async publish(message) {
    this.#requireContract();
    return this.#post("/v1/messages", message, true);
  }

  async request(subject, data, options = {}) {
    return this.publish({
      subject,
      type: options.type ?? `${subject}.request`,
      source: "sdk",
      intent: options.intent,
      idempotencyKey: options.idempotencyKey,
      classification: options.classification,
      region: options.region ?? this.region,
      correlationId: options.correlationId,
      data
    });
  }

  async receive(subject, { max = 1 } = {}) {
    this.#requireContract();
    const { messages } = await this.#post(`/v1/subjects/${encodeURIComponent(subject)}/receive`, { max }, true);
    return messages;
  }

  async subjects() {
    return (await this.#get("/v1/subjects")).subjects;
  }

  async quarantine() {
    return (await this.#get("/v1/quarantine")).records;
  }

  #requireContract() {
    if (!this.contractId) {
      throw new PigeonClientError("CONTRACT_REQUIRED", "Call connect() to negotiate a contract first.", 0);
    }
  }

  #headers(withContract) {
    const headers = { "content-type": "application/json", "x-pigeon-region": this.region };
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    if (withContract && this.contractId) headers["x-pigeon-contract"] = this.contractId;
    return headers;
  }

  async #post(path, body, withContract) {
    const response = await this.fetch(`${this.url}${path}`, {
      method: "POST",
      headers: this.#headers(withContract),
      body: JSON.stringify(body)
    });
    return this.#parse(response);
  }

  async #get(path) {
    return this.#parse(await this.fetch(`${this.url}${path}`, { headers: { "x-pigeon-region": this.region } }));
  }

  async #parse(response) {
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      // fall through with empty payload
    }
    if (!response.ok) {
      const error = payload.error ?? {};
      throw new PigeonClientError(error.code ?? "REQUEST_FAILED", error.message ?? `HTTP ${response.status}`, response.status, error.details ?? {});
    }
    return payload;
  }
}
