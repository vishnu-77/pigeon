"""Small standard-library client for Pigeon Protocol v1."""

from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen


class PigeonClientError(RuntimeError):
    def __init__(self, code: str, message: str, status: int, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.status = status
        self.details = details or {}


class PigeonClient:
    def __init__(
        self,
        url: str = "http://localhost:8787",
        *,
        token: str | None = None,
        region: str = "uk",
        timeout: float = 10.0,
    ) -> None:
        self.url = url.rstrip("/")
        self.token = token
        self.region = region
        self.timeout = timeout
        self.contract: dict[str, Any] | None = None
        self.contract_id: str | None = None

    def connect(self, subjects: list[str], *, ttl_ms: int | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {"subjects": subjects}
        if ttl_ms is not None:
            body["ttlMs"] = ttl_ms
        payload = self._post("/v1/contracts", body, with_contract=False)
        self.contract = payload["contract"]
        self.contract_id = self.contract["id"]
        return self.contract

    def publish(self, message: dict[str, Any]) -> dict[str, Any]:
        self._require_contract()
        return self._post("/v1/messages", message, with_contract=True)

    def request(
        self,
        subject: str,
        data: dict[str, Any],
        *,
        intent: str | None = None,
        idempotency_key: str | None = None,
        classification: str | None = None,
        region: str | None = None,
        message_type: str | None = None,
        source: str = "sdk-python",
        correlation_id: str | None = None,
    ) -> dict[str, Any]:
        message = {
            "subject": subject,
            "type": message_type or f"{subject}.request",
            "source": source,
            "intent": intent,
            "idempotencyKey": idempotency_key,
            "classification": classification,
            "region": region or self.region,
            "correlationId": correlation_id,
            "data": data,
        }
        return self.publish({key: value for key, value in message.items() if value is not None})

    def receive(self, subject: str, *, max_messages: int = 1) -> list[dict[str, Any]]:
        self._require_contract()
        payload = self._post(
            f"/v1/subjects/{subject}/receive",
            {"max": max_messages},
            with_contract=True,
        )
        return payload["messages"]

    def subjects(self) -> list[dict[str, Any]]:
        return self._get("/v1/subjects")["subjects"]

    def audit(self) -> list[dict[str, Any]]:
        return self._get("/v1/audit")["records"]

    def quarantine(self) -> list[dict[str, Any]]:
        return self._get("/v1/quarantine")["records"]

    def _require_contract(self) -> None:
        if not self.contract_id:
            raise PigeonClientError(
                "CONTRACT_REQUIRED",
                "Call connect() to negotiate a contract first.",
                0,
            )

    def _headers(self, with_contract: bool) -> dict[str, str]:
        headers = {
            "content-type": "application/json",
            "x-pigeon-region": self.region,
        }
        if self.token:
            headers["authorization"] = f"Bearer {self.token}"
        if with_contract and self.contract_id:
            headers["x-pigeon-contract"] = self.contract_id
        return headers

    def _post(self, path: str, body: dict[str, Any], *, with_contract: bool) -> dict[str, Any]:
        request = Request(
            f"{self.url}{path}",
            data=json.dumps(body).encode("utf-8"),
            headers=self._headers(with_contract),
            method="POST",
        )
        return self._send(request)

    def _get(self, path: str) -> dict[str, Any]:
        request = Request(
            f"{self.url}{path}",
            headers=self._headers(False),
            method="GET",
        )
        return self._send(request)

    def _send(self, request: Request) -> dict[str, Any]:
        try:
            with urlopen(request, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            try:
                payload = json.loads(error.read().decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                payload = {}
            details = payload.get("error", {})
            raise PigeonClientError(
                details.get("code", "REQUEST_FAILED"),
                details.get("message", f"HTTP {error.code}"),
                error.code,
                details.get("details", {}),
            ) from error
