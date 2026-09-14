// Pigeon Protocol v1 HTTP client.
//
// This client is intentionally small: it authenticates, negotiates a communication
// contract, then publishes/receives messages under that contract. It is exported from
// the root `pigeonmq` package so the first integration does not require a second package.

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
      source: options.source ?? "sdk",
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

  async ack(subject, messageId) {
    this.#requireContract();
    return this.#post(`/v1/subjects/${encodeURIComponent(subject)}/messages/${encodeURIComponent(messageId)}/ack`, {}, true);
  }

  async subjects() {
    return (await this.#get("/v1/subjects")).subjects;
  }

  async audit() {
    return (await this.#get("/v1/audit")).records;
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
    return this.#parse(await this.fetch(`${this.url}${path}`, { headers: this.#headers(false) }));
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
      throw new PigeonClientError(
        error.code ?? "REQUEST_FAILED",
        error.message ?? `HTTP ${response.status}`,
        response.status,
        error.details ?? {}
      );
    }
    return payload;
  }
}
