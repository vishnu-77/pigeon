// File-based policy authoring, loading, and linting (FND-14).
//
// Subjects and schemas can be authored as JSON files on disk instead of inline JS,
// so policy is data that can be reviewed, versioned, and linted independently of the
// broker. Layout:
//
//   <dir>/schemas/<schema-id>.json    - a JSON-shape schema
//   <dir>/subjects/<name>.json        - a subject definition (governance + policy)
//
// loadCatalog() reads them, lintCatalog() checks them, and applyCatalog() registers a
// validated catalog on a broker (which compiles it - FND-04). Zero dependencies
// (node:fs). JSON today; a YAML front-end is a thin future addition (see backlog).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PigeonError } from "./errors.js";

const OPERATIONS = ["publish", "receive", "ack", "replay"];

export function loadCatalog(dir) {
  const schemas = {};
  const schemaDir = join(dir, "schemas");
  if (existsSync(schemaDir)) {
    for (const file of jsonFiles(schemaDir)) {
      const id = file.replace(/\.json$/, "");
      schemas[id] = readJson(join(schemaDir, file));
    }
  }

  const subjects = [];
  const subjectDir = join(dir, "subjects");
  if (existsSync(subjectDir)) {
    for (const file of jsonFiles(subjectDir)) {
      subjects.push(readJson(join(subjectDir, file)));
    }
  }

  return { schemas, subjects };
}

// Returns { errors: [...], warnings: [...] }. Errors mean the catalog must not be
// loaded; warnings are advisory (e.g. a subject nobody can publish to).
export function lintCatalog(catalog) {
  const errors = [];
  const warnings = [];
  const schemaIds = new Set(Object.keys(catalog.schemas ?? {}));
  const seen = new Set();

  for (const subject of catalog.subjects ?? []) {
    const where = subject?.name ? `subject '${subject.name}'` : "a subject";

    if (!subject?.name || typeof subject.name !== "string") {
      errors.push(`${where}: missing a string 'name'.`);
      continue;
    }
    if (seen.has(subject.name)) {
      errors.push(`${where}: duplicate subject name.`);
    }
    seen.add(subject.name);

    if (!Array.isArray(subject.intents) || subject.intents.length === 0) {
      errors.push(`${where}: 'intents' must be a non-empty array.`);
    }

    if (subject.schema?.name && !schemaIds.has(subject.schema.name)) {
      errors.push(`${where}: references unknown schema '${subject.schema.name}'.`);
    }

    for (const path of subject.data?.forbiddenFields ?? []) {
      if (typeof path !== "string") {
        errors.push(`${where}: forbiddenFields entries must be strings.`);
      }
    }

    const policy = subject.policy ?? {};
    for (const [operation, rules] of Object.entries(policy)) {
      if (!OPERATIONS.includes(operation)) {
        warnings.push(`${where}: unknown operation '${operation}' in policy.`);
      }
      if (!Array.isArray(rules)) {
        errors.push(`${where}: policy.${operation} must be an array of rules.`);
        continue;
      }
      for (const rule of rules) {
        if (rule.effect !== "allow" && rule.effect !== "deny") {
          errors.push(`${where}: a policy.${operation} rule has an invalid effect '${rule.effect}'.`);
        }
      }
    }

    const publishRules = policy.publish ?? [];
    if (!publishRules.some((rule) => rule.effect === "allow")) {
      warnings.push(`${where}: no principal is allowed to publish (nothing can be sent).`);
    }
  }

  return { errors, warnings };
}

// Register a validated catalog on a broker. Throws if lint finds errors.
export function applyCatalog(broker, catalog) {
  const { errors } = lintCatalog(catalog);
  if (errors.length > 0) {
    throw new PigeonError("POLICY_INVALID", `Policy catalog failed lint:\n- ${errors.join("\n- ")}`, { errors });
  }
  for (const [id, schema] of Object.entries(catalog.schemas ?? {})) {
    broker.registerSchema(id, schema);
  }
  for (const subject of catalog.subjects ?? []) {
    broker.registerSubject(subject);
  }
  return broker;
}

function jsonFiles(dir) {
  return readdirSync(dir).filter((file) => file.endsWith(".json")).sort();
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new PigeonError("POLICY_INVALID", `Failed to parse ${path}: ${error.message}`);
  }
}
