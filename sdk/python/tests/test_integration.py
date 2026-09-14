import os
import unittest

from pigeonmq import PigeonClient, PigeonClientError


BASE = os.environ.get("PIGEON_URL", "http://localhost:8787")


class PigeonIntegrationTests(unittest.TestCase):
    def test_contract_and_publish(self):
        client = PigeonClient(BASE, token="checkout-token")
        contract = client.connect(["payments.authorize"])
        self.assertTrue(contract["id"])

        result = client.request(
            "payments.authorize",
            {
                "merchantId": "m",
                "orderId": "python_1",
                "amount": 12.5,
                "currency": "GBP",
                "paymentToken": "tok",
            },
            intent="authorize_payment",
            idempotency_key="python_1:authorize",
            classification="pci",
            region="uk",
        )
        self.assertEqual(result["status"], "accepted")

    def test_unauthorized_principal_is_denied_at_negotiation(self):
        client = PigeonClient(BASE, token="catalog-token")
        with self.assertRaises(PigeonClientError) as raised:
            client.connect(["payments.authorize"])
        self.assertEqual(raised.exception.code, "NO_PERMITTED_SUBJECTS")
        self.assertEqual(raised.exception.status, 403)

    def test_sensitive_field_violation_is_denied(self):
        client = PigeonClient(BASE, token="checkout-token")
        client.connect(["payments.authorize"])
        with self.assertRaises(PigeonClientError) as raised:
            client.request(
                "payments.authorize",
                {
                    "merchantId": "m",
                    "orderId": "python_sensitive",
                    "amount": 12.5,
                    "currency": "GBP",
                    "paymentToken": "tok",
                    "card": {"pan": "TEST_ONLY"},
                },
                intent="authorize_payment",
                idempotency_key="python_sensitive:authorize",
                classification="pci",
                region="uk",
            )
        self.assertIn(raised.exception.code, {"SENSITIVE_FIELD_DENIED", "RAW_PAN_DETECTED"})


if __name__ == "__main__":
    unittest.main()
