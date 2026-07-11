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

  if (rule.regions && !rule.regions.includes(context.region)) {
    return false;
  }

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
