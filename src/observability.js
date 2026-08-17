import { metrics, trace } from "@opentelemetry/api";

const meter = metrics.getMeter("pigeon");
const tracer = trace.getTracer("pigeon");

const decisions = meter.createCounter("pigeon_broker_decisions_total", {
  description: "Broker decisions by operation and outcome"
});

const gateLatency = meter.createHistogram("pigeon_broker_gate_latency_ms", {
  description: "Broker gate latency in milliseconds",
  unit: "ms"
});

export function createObservability() {
  return {
    startSpan(name, attributes = {}) {
      const span = tracer.startSpan(name);
      span.setAttributes(attributes);
      return span;
    },

    recordDecision(operation, outcome, attributes = {}) {
      decisions.add(1, {
        operation,
        outcome,
        ...attributes
      });
    },

    recordGateLatency(operation, gate, durationMs, attributes = {}) {
      gateLatency.record(durationMs, {
        operation,
        gate,
        ...attributes
      });
    }
  };
}

export const noopObservability = {
  startSpan() {
    return {
      setAttribute() {},
      setAttributes() {},
      recordException() {},
      setStatus() {},
      end() {}
    };
  },

  recordDecision() {},
  recordGateLatency() {}
};