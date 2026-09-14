const $ = (id) => document.getElementById(id);
const SUBJECT = "payments.authorize";
const help = {
  allow: "An authorized sender. A payment token. Everything this policy asks for.",
  retry: "Send the exact same message again. Its idempotency key stays the same.",
  pan: "Add a sample card number. The policy forbids raw card data in this message.",
  unauthorized: "Try sending from catalog-api. Only checkout-api is allowed to publish here."
};
const buttons = { allow: "Send a message", retry: "Retry the same message", pan: "Send forbidden data", unauthorized: "Try this sender" };
let scenario = "allow", busy = false, online = false, session = null, lastAccepted = null, messageId = null;
let selectedEvidence = "payload";
let evidence = { payload: {}, policy: {}, response: "Send a message to see its actual response.", audit: "Your run's audit records will appear here." };

function sample() {
  const orderId = `order_${crypto.randomUUID()}`;
  return { subject: SUBJECT, type: "payment.authorization.requested", source: "checkout-service",
    intent: "authorize_payment", idempotencyKey: `${orderId}:authorize`, classification: "pci", region: "uk",
    data: { merchantId: "merchant_demo", orderId, amount: 42.5, currency: "GBP", paymentToken: "tok_demo_visa" } };
}
let pendingMessage = sample();

function preparePayload() {
  const message = scenario === "retry" && lastAccepted ? structuredClone(lastAccepted) : structuredClone(pendingMessage);
  if (scenario === "pan") message.data.card = { pan: "4111111111111111" };
  return message;
}

function renderControls() {
  $("send-message").disabled = busy || !online;
  $("send-message").textContent = busy ? "Following your message…" : `${buttons[scenario]} →`;
  $("reset-demo").disabled = busy;
  for (const button of document.querySelectorAll("[data-scenario]")) {
    button.disabled = busy || (button.dataset.scenario === "retry" && !lastAccepted);
    button.setAttribute("aria-pressed", String(button.dataset.scenario === scenario));
  }
}

function selectScenario(next) {
  if (busy) return;
  scenario = next;
  $("scenario-help").textContent = help[scenario];
  $("sender-name").textContent = scenario === "unauthorized" ? "catalog-api" : "checkout-api";
  $("payment-data").textContent = scenario === "pan" ? "Raw card data added" : "Tokenized ✓";
  evidence.payload = preparePayload();
  renderEvidence();
  renderControls();
}

function renderEvidence() {
  $("evidence-content").textContent = typeof evidence[selectedEvidence] === "string" ? evidence[selectedEvidence] : JSON.stringify(evidence[selectedEvidence], null, 2);
  $("evidence-content").setAttribute("aria-labelledby", `tab-${selectedEvidence}`);
  for (const tab of document.querySelectorAll("[data-evidence]")) {
    const selected = tab.dataset.evidence === selectedEvidence;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
}

function stage(name, state, text) {
  $("route-" + name).dataset.state = state;
  $("route-" + name + "-state").textContent = text;
}

function outcome(state, title, description, symbol = "↗") {
  $("outcome").dataset.state = state;
  $("outcome-title").textContent = title;
  $("outcome-description").textContent = description;
  $("outcome-symbol").textContent = symbol;
}

async function request(path, { method = "GET", token, contractId, body, root = false } = {}) {
  const headers = { "content-type": "application/json", "x-pigeon-region": "uk" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (contractId) headers["x-pigeon-contract"] = contractId;
  const response = await fetch((root ? "" : session.basePath) + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000), cache: "no-store"
  });
  let json;
  try { json = await response.json(); } catch { throw new Error("The broker returned an unreadable response. Please try again."); }
  if (!response.ok) {
    const error = new Error(json.error?.message || `Request failed (${response.status}).`);
    error.code = json.error?.code;
    error.status = response.status;
    error.response = json;
    throw error;
  }
  return json;
}

async function connect(token) {
  return (await request("/v1/contracts", { method: "POST", token, body: { subjects: [SUBJECT] } })).contract;
}

async function ensureSession() {
  if (session && Date.parse(session.expiresAt) > Date.now() + 10_000) return;
  if (scenario === "retry" && session) {
    throw Object.assign(new Error("The original message's demo has expired. Start fresh to try again."), { code: "DEMO_EXPIRED" });
  }
  session = (await request("/demo/sessions", { method: "POST", body: {}, root: true })).session;
  lastAccepted = null;
  evidence.policy = (await request(`/v1/subjects/${SUBJECT}`)).subject;
}

async function run() {
  if (busy || !online) return;
  busy = true;
  renderControls();
  messageId = null;
  $("result-meta").hidden = true;
  const started = performance.now();
  const activeScenario = scenario;
  const payload = preparePayload();
  evidence.payload = payload;
  evidence.response = "Waiting for the broker…";
  evidence.audit = "Waiting for this run's audit records…";
  stage("sender", "active", "Negotiating a contract");
  stage("broker", "", "Awaiting the message");
  stage("receiver", "", "Waiting for a message");
  outcome("running", "Let’s see what gets through.", "Authenticating the sender and checking this subject’s policy.");
  const responses = {};
  try {
    await ensureSession();
    const before = (await request("/v1/audit")).records.length;
    let denied = null;
    try {
      const token = activeScenario === "unauthorized" ? "catalog-token" : "checkout-token";
      const contract = await connect(token);
      responses.senderContract = contract;
      stage("sender", "done", "Contract negotiated");
      stage("broker", "active", "Checking the message");
      responses.publish = await request("/v1/messages", { method: "POST", token, contractId: contract.id, body: payload });
    } catch (error) {
      const expected = activeScenario === "pan" ? "SENSITIVE_FIELD_DENIED" : activeScenario === "unauthorized" ? "NO_PERMITTED_SUBJECTS" : null;
      if (!expected || error.code !== expected) throw error;
      denied = error;
      responses.denial = { httpStatus: error.status, ...error.response };
    }
    if (!denied && ["pan", "unauthorized"].includes(activeScenario)) throw new Error("The broker unexpectedly allowed this test. The demo has stopped.");
    const gateway = await connect("gateway-token");
    const received = await request(`/v1/subjects/${SUBJECT}/receive`, {
      method: "POST", token: "gateway-token", contractId: gateway.id, body: { max: 10 }
    });
    responses.receive = received;
    if (denied) {
      if (received.messages.length !== 0) throw new Error("A blocked message reached the receiver. The demo has stopped.");
      const quarantine = (await request("/v1/quarantine")).records.filter((r) => r.message.idempotencyKey === payload.idempotencyKey);
      if (activeScenario === "pan" && (quarantine.length !== 1 || quarantine[0].message.data.card.pan !== "[REDACTED]")) throw new Error("The expected redacted evidence is missing.");
      responses.quarantine = quarantine;
      stage("sender", activeScenario === "unauthorized" ? "blocked" : "done", activeScenario === "unauthorized" ? "Not authorized" : "Message sent");
      stage("broker", "blocked", activeScenario === "pan" ? "Blocked & quarantined" : "Contract denied");
      stage("receiver", "", "Nothing delivered");
      outcome("blocked", activeScenario === "pan" ? "That data stays at the door." : "This sender isn’t on the list.", activeScenario === "pan" ? "The policy forbids card.pan. PigeonMQ blocked the message and kept redacted evidence in quarantine. The receiver got nothing." : "catalog-api has no permission to publish here. The broker refused to issue a contract, so the message never entered the delivery flow.", "⊘");
    } else if (activeScenario === "retry") {
      if (responses.publish.status !== "duplicate" || received.messages.length !== 0) throw new Error("The retry was not safely deduplicated.");
      messageId = responses.publish.message.id;
      stage("sender", "done", "Same message, same key");
      stage("broker", "done", "Original returned");
      stage("receiver", "", "No new delivery");
      outcome("duplicate", "Once was enough.", "The same idempotency key returned the original message. No second copy was accepted, and the receiver got no new delivery.", "↺");
    } else {
      if (responses.publish.status !== "accepted" || received.messages.length !== 1 || received.messages[0].id !== responses.publish.message.id) throw new Error("The sender and receiver results did not match.");
      messageId = responses.publish.message.id;
      stage("broker", "done", "Accepted by policy");
      stage("receiver", "active", "Acknowledging delivery");
      responses.ack = await request(`/v1/subjects/${SUBJECT}/messages/${encodeURIComponent(messageId)}/ack`, {
        method: "POST", token: "gateway-token", contractId: gateway.id, body: {}
      });
      if (responses.ack.status !== "acked" || !responses.ack.message.ackedBy.some((a) => a.principal === gateway.principal)) throw new Error("The receiver's acknowledgement was not recorded.");
      lastAccepted = structuredClone(payload);
      stage("sender", "done", "Sent under contract");
      stage("receiver", "done", "Received & acknowledged");
      outcome("success", "Delivered. With the rules intact.", "The sender was authorized, the payment data met the policy, and the receiver acknowledged the same message. You can now retry it or change one condition.", "✓");
    }
    evidence.audit = (await request("/v1/audit")).records.slice(before);
    if (activeScenario === "allow" && !evidence.audit.some((r) => r.type === "delivery.acked" && r.messageId === messageId)) throw new Error("The acknowledgement is missing from the audit trail.");
    evidence.response = responses;
    $("run-label").textContent = "This run only · real HTTP requests";
    $("result-id").textContent = messageId ? `${messageId.slice(0, 18)}…` : denied?.code ?? "";
    $("copy-message").hidden = !messageId;
    $("result-time").textContent = `${Math.round(performance.now() - started)} ms round trip`;
    $("result-meta").hidden = false;
    pendingMessage = sample();
  } catch (error) {
    evidence.response = { error: error.code || "REQUEST_FAILED", message: error.message, completed: responses };
    outcome("error", error.code === "DEMO_EXPIRED" ? "Time for a fresh start." : "The journey didn’t finish.", error.code === "DEMO_EXPIRED" ? error.message : `${error.message} Start fresh and try again.`, "!");
    stage("broker", "blocked", "Run incomplete");
    stage("receiver", "", "Not confirmed");
    if (error.code === "DEMO_EXPIRED") { session = null; lastAccepted = null; }
  } finally {
    busy = false;
    if (!lastAccepted && scenario === "retry") selectScenario("allow");
    renderEvidence();
    renderControls();
  }
}

async function health() {
  try { online = (await fetch("/health", { signal: AbortSignal.timeout(12000), cache: "no-store" })).ok; } catch { online = false; }
  $("connection").dataset.state = online ? "online" : "offline";
  $("connection").replaceChildren();
  const dot = document.createElement("span"); dot.className = "tiny-dot";
  $("connection").append(dot, document.createTextNode(online ? "Live broker is ready" : "Broker unavailable · retrying"));
  renderControls();
}

async function reset() {
  if (busy) return;
  const previous = session;
  session = null; lastAccepted = null; messageId = null; pendingMessage = sample();
  if (previous) fetch(previous.basePath, { method: "DELETE", signal: AbortSignal.timeout(5000) }).catch(() => {});
  evidence = { payload: pendingMessage, policy: "Send a message to load the live subject policy.", response: "Send a message to see its actual response.", audit: "Your run's audit records will appear here." };
  $("result-meta").hidden = true;
  $("run-label").textContent = "Your own isolated demo";
  stage("sender", "", "Ready to send"); stage("broker", "", "Policy at the door"); stage("receiver", "", "Waiting for a message");
  outcome("idle", "Your first message is ready.", "Press send to watch PigeonMQ check the policy, deliver the message, and record the receiver’s acknowledgement.");
  selectScenario("allow");
  await health();
}

async function copy(text, button) {
  const original = button.textContent;
  try { await navigator.clipboard.writeText(text); button.textContent = "Copied ✓"; }
  catch { button.textContent = "Select & copy the text"; }
  setTimeout(() => { button.textContent = original; }, 2000);
}

for (const button of document.querySelectorAll("[data-scenario]")) button.addEventListener("click", () => selectScenario(button.dataset.scenario));
for (const tab of document.querySelectorAll("[data-evidence]")) {
  tab.addEventListener("click", () => { selectedEvidence = tab.dataset.evidence; renderEvidence(); });
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...document.querySelectorAll("[data-evidence]")];
    const index = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[index].focus(); tabs[index].click();
  });
}
$("send-message").addEventListener("click", run);
$("reset-demo").addEventListener("click", reset);
$("copy-message").addEventListener("click", (event) => copy(messageId, event.currentTarget));
$("copy-quickstart").addEventListener("click", (event) => copy($("quickstart-code").textContent.trim(), event.currentTarget));
evidence.payload = pendingMessage;
evidence.policy = "Send a message to load the live subject policy.";
renderEvidence();
health();
setInterval(() => { if (!document.hidden && !busy) health(); }, 15_000);

// "How it works": one step open at a time; the reference chain follows it.
const howSteps = [...document.querySelectorAll(".how-step")];
const chainNodes = [...document.querySelectorAll("#ref-chain [data-step]")];
function syncChain() {
  const open = howSteps.find((step) => step.open);
  const current = open ? Number(open.dataset.step) : 0;
  chainNodes.forEach((node) => node.classList.toggle("active", Number(node.dataset.step) === current));
}
howSteps.forEach((step) => step.addEventListener("toggle", () => {
  if (step.open) howSteps.forEach((other) => { if (other !== step && other.open) other.open = false; });
  syncChain();
}));
syncChain();
