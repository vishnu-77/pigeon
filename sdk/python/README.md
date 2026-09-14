# Pigeon Python SDK

Official Python client for the Pigeon contract-native message broker.

> PyPI and TestPyPI Trusted Publishing are wired into `.github/workflows/release.yml`. Until the first registry release is cut, install from the repository subdirectory for development.

```bash
pip install ./sdk/python
```

After the first PyPI release:

```bash
pip install pigeonmq
```

```python
from pigeonmq import PigeonClient, PigeonClientError

client = PigeonClient(token="checkout-token")
client.connect(["payments.authorize"])

try:
    result = client.request(
        "payments.authorize",
        {
            "merchantId": "m",
            "orderId": "order_42",
            "amount": 42.0,
            "currency": "GBP",
            "paymentToken": "tok",
        },
        intent="authorize_payment",
        idempotency_key="order_42:authorize",
        classification="pci",
        region="uk",
    )
    print(result["status"])
except PigeonClientError as error:
    print(error.code, error.status)
```

The client exposes `connect`, `publish`, `request`, `receive`, `subjects`, `audit`, and `quarantine`. Errors surface as `PigeonClientError` with `code`, `status`, and `details`.
