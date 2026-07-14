import { PigeonError } from "./errors.js";

export class PolicyEngine {
  evaluate(action, subject, context) {
    const rules = subject.policy?.[action] ?? [];
    const principal = context.principal;

    for (const rule of rules) {
      if (matchesRule(rule, principal, context)) {
        return { allow: rule.effect === "allow", rule };
      }
    }

    return { allow: false, rule: null };
  }

  assertAllowed(action, subject, context) {
    const decision = this.evaluate(action, subject, context);
    if (!decision.allow) {
      throw new PigeonError(
        "POLICY_DENIED",
        `${context.principal.id} is not allowed to ${action} on ${subject.name}.`,
        { action, subject: subject.name }
      );
    }
    return decision;
  }
}

function matchesRule(rule, principal, context) {
  if (rule.principals && !rule.principals.includes(principal.id)) {
    return false;
  }

  if (rule.intents && !rule.intents.includes(context.intent)) {
    return false;
  }

  // Region is enforced once, authoritatively, by the subject's regionPolicy in
  // broker.enforceSubjectPolicy (REGION_DENIED). It is intentionally NOT re-checked
  // here - identity-level region scoping happens at contract negotiation time
  // (see compile.candidateRules). This collapses the previously doubled region gate
  // (FND-12).

  if (rule.requireReason && !context.reason) {
    return false;
  }

  for (const [key, expected] of Object.entries(rule.attributes ?? {})) {
    if (principal.attributes?.[key] !== expected) {
      return false;
    }
  }

  return true;
}
