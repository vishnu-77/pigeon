export default function handler(_request, response) {
  response.status(200).json({
    ok: true,
    service: "pigeon-demo-sender",
    broker: process.env.PIGEON_URL || "https://broker.pigeonmq.cc",
    supportedScenarios: ["message", "payments", "notifications"]
  });
}
