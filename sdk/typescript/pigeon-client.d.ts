// Type declarations for the Pigeon client SDK (FND-15).

export interface PigeonClientOptions {
  /** Broker base URL. Default: http://localhost:8787 */
  url?: string;
  /** Bearer token that authenticates as a principal. */
  token?: string;
  /** Region header sent with every request. Default: "uk" */
  region?: string;
  /** Custom fetch implementation (defaults to global fetch). */
  fetchImpl?: typeof fetch;
}

export interface ContractSubject {
  name: string;
  subjectId: number;
  schemaId: string | null;
  policyId: string;
  operations: string[];
}

export interface Contract {
  id: string;
  principal: string;
  subjects: ContractSubject[];
  policyIds: string[];
  issuedAt: string;
  expiresAt: string;
}

export interface RequestOptions {
  intent?: string;
  idempotencyKey?: string;
  classification?: string;
  region?: string;
  type?: string;
  correlationId?: string;
}

export interface PublishResult {
  status: "accepted" | "duplicate";
  message: Record<string, unknown>;
}

export class PigeonClientError extends Error {
  code: string;
  status: number;
  details: Record<string, unknown>;
  constructor(code: string, message: string, status: number, details?: Record<string, unknown>);
}

export class PigeonClient {
  constructor(options?: PigeonClientOptions);
  contract: Contract | null;
  contractId: string | null;
  connect(subjects: string[], options?: { ttlMs?: number }): Promise<Contract>;
  publish(message: Record<string, unknown>): Promise<PublishResult>;
  request(subject: string, data: unknown, options?: RequestOptions): Promise<PublishResult>;
  receive(subject: string, options?: { max?: number }): Promise<Array<Record<string, unknown>>>;
  subjects(): Promise<Array<Record<string, unknown>>>;
  quarantine(): Promise<Array<Record<string, unknown>>>;
}
