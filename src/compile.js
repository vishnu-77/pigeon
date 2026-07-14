// Policy compilation (FND-04).
//
// Subjects are authored as plain objects. Before they are used on the hot path they
// are *compiled*: assigned deterministic numeric/string IDs and turned into lookup
// tables so runtime enforcement and contract negotiation do not re-scan raw rule
// arrays. The broker keeps the compiled catalog; messages and audit events reference
// the compiled IDs (subjectId, policyId, schemaId) rather than repeating policy.
//
// Zero runtime dependencies - standard library only.

// A small, stable, non-cryptographic hash so IDs are deterministic across runs
// (same input -> same id) without pulling in a dependency. Used for schema ids.
function stableHash(input) {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) & 0xffffffff;
  }
  return (hash >>> 0).toString(36);
}

// Build a per-operation index from principal id -> matching rules, plus a bucket of
// "wildcard" rules that carry no `principals` constraint (they apply to everyone).
// Negotiation and identity checks consult this instead of scanning every rule.
function buildPermissionIndex(policy = {}) {
  const index = {};
  for (const [operation, rules] of Object.entries(policy)) {
    const byPrincipal = new Map();
    const wildcard = [];
    for (const rule of rules ?? []) {
      if (Array.isArray(rule.principals) && rule.principals.length > 0) {
        for (const principal of rule.principals) {
          if (!byPrincipal.has(principal)) byPrincipal.set(principal, []);
          byPrincipal.get(principal).push(rule);
        }
      } else {
        wildcard.push(rule);
      }
    }
    index[operation] = { byPrincipal, wildcard };
  }
  return index;
}

export function compileSubject(subject, subjectId) {
  const version = subject.version ?? "v1";
  return {
    ...subject,
    subjectId,
    policyId: `${subject.name}@${version}`,
    schemaId: subject.schema?.name ? `${subject.schema.name}#${stableHash(subject.schema.name)}` : null,
    permissionIndex: buildPermissionIndex(subject.policy)
  };
}

// Rules that could apply to a principal for an operation, at *identity* level:
// principal match + region + attributes, but NOT per-message fields (intent, reason).
// Used by contract negotiation to decide which operations a principal may hold.
export function candidateRules(compiledSubject, operation, principal, context = {}) {
  const bucket = compiledSubject.permissionIndex?.[operation];
  if (!bucket) return [];
  const specific = bucket.byPrincipal.get(principal.id) ?? [];
  return [...specific, ...bucket.wildcard].filter((rule) => matchesIdentity(rule, principal, context));
}

function matchesIdentity(rule, principal, context) {
  if (rule.regions && context.region !== undefined && !rule.regions.includes(context.region)) {
    return false;
  }
  for (const [key, expected] of Object.entries(rule.attributes ?? {})) {
    if (principal.attributes?.[key] !== expected) return false;
  }
  return true;
}
