// Compatibility entry point for users who previously imported the SDK directly.
// The canonical Pigeon Protocol v1 JavaScript client now ships from src/client.js and
// is exported from the root `pigeonmq` package.
export { PigeonClient, PigeonClientError } from "../../src/client.js";
