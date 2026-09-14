# Pigeon Rust SDK

Official Rust client for the Pigeon contract-native message broker.

> crates.io Trusted Publishing is wired into `.github/workflows/release.yml`. Until the first registry release is cut, use the in-repository crate.

```toml
[dependencies]
pigeonmq = { path = "sdk/rust" }
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
serde_json = "1"
```

After the first crates.io release:

```toml
[dependencies]
pigeonmq = "1"
```

```rust
use pigeonmq::{PigeonClient, RequestOptions};
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut client = PigeonClient::new("http://localhost:8787", "checkout-token");
    client.connect(&["payments.authorize"]).await?;

    let result = client.request(
        "payments.authorize",
        json!({
            "merchantId": "m",
            "orderId": "rust_1",
            "amount": 42.0,
            "currency": "GBP",
            "paymentToken": "tok"
        }),
        RequestOptions {
            intent: Some("authorize_payment".into()),
            idempotency_key: Some("rust_1:authorize".into()),
            classification: Some("pci".into()),
            ..Default::default()
        },
    ).await?;

    println!("{}", result["status"]);
    Ok(())
}
```

The client exposes contract negotiation, publish/request, receive, subject discovery, audit, and quarantine against Pigeon Protocol v1.
