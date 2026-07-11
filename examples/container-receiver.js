const pigeonUrl = process.env.PIGEON_URL ?? "http://localhost:8787";
const principal = "spiffe://merchant-prod/ns/payments/sa/gateway-adapter";

await waitForBroker();

console.log("[receiver] receiving governed payment messages from Pigeon");
const received = await receiveUntilMessage();
console.log("[receiver] received response");
console.log(JSON.stringify(received, null, 2));

console.log("[receiver] fetching audit trail");
const audit = await getJson("/v1/audit");
console.log(JSON.stringify(audit, null, 2));

console.log("[receiver] fetching quarantine");
const quarantine = await getJson("/v1/quarantine");
console.log(JSON.stringify(quarantine, null, 2));

async function receive() {
  const response = await fetch(`${pigeonUrl}/v1/subjects/payments.authorize/receive`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-pigeon-principal": principal,
      "x-pigeon-region": "uk"
    },
    body: JSON.stringify({ max: 10 })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Receive failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function receiveUntilMessage() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const payload = await receive();
    if (payload.messages?.length > 0) {
      return payload;
    }
    console.log("[receiver] no messages yet, waiting");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("No governed payment messages arrived.");
}

async function getJson(path) {
  const response = await fetch(`${pigeonUrl}${path}`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function waitForBroker() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await fetch(`${pigeonUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until Docker health and service DNS settle.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Broker did not become healthy at ${pigeonUrl}`);
}
