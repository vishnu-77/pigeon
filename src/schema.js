import { PigeonError } from "./errors.js";

export class SchemaRegistry {
  constructor() {
    this.schemas = new Map();
  }

  register(name, schema) {
    this.schemas.set(name, schema);
  }

  validate(name, data) {
    const schema = this.schemas.get(name);
    if (!schema) {
      throw new PigeonError("SCHEMA_NOT_FOUND", `Schema '${name}' is not registered.`);
    }
    validateObject(schema, data, name);
    return true;
  }
}

function validateObject(schema, data, path) {
  if (schema.type === "object") {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new PigeonError("SCHEMA_INVALID", `${path} must be an object.`);
    }

    for (const required of schema.required ?? []) {
      if (!(required in data)) {
        throw new PigeonError("SCHEMA_INVALID", `${path}.${required} is required.`);
      }
    }

    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (key in data) {
        validateObject(child, data[key], `${path}.${key}`);
      }
    }
    return;
  }

  if (schema.type === "array") {
    if (!Array.isArray(data)) {
      throw new PigeonError("SCHEMA_INVALID", `${path} must be an array.`);
    }
    for (const [index, item] of data.entries()) {
      validateObject(schema.items, item, `${path}[${index}]`);
    }
    return;
  }

  if (schema.type === "string" && typeof data !== "string") {
    throw new PigeonError("SCHEMA_INVALID", `${path} must be a string.`);
  }

  if (schema.type === "number" && typeof data !== "number") {
    throw new PigeonError("SCHEMA_INVALID", `${path} must be a number.`);
  }

  if (schema.type === "integer" && (!Number.isInteger(data))) {
    throw new PigeonError("SCHEMA_INVALID", `${path} must be an integer.`);
  }

  if (schema.type === "boolean" && typeof data !== "boolean") {
    throw new PigeonError("SCHEMA_INVALID", `${path} must be a boolean.`);
  }

  if (schema.enum && !schema.enum.includes(data)) {
    throw new PigeonError("SCHEMA_INVALID", `${path} must be one of: ${schema.enum.join(", ")}.`);
  }

  if (schema.pattern && typeof data === "string" && !(new RegExp(schema.pattern).test(data))) {
    throw new PigeonError("SCHEMA_INVALID", `${path} does not match ${schema.pattern}.`);
  }
}
