use pigeonmq::{PigeonClient, RequestOptions};
use serde_json::json;

fn base() -> String {
    std::env::var("PIGEON_URL").unwrap_or_else(|_| "http://localhost:8787".into())
}

#[tokio::test]
async fn negotiates_contract_and_publishes() {
    let mut client = PigeonClient::new(base(), "checkout-token");
    let contract = client.connect(&["payments.authorize"]).await.unwrap();
    assert!(contract.get("id").and_then(|v| v.as_str()).is_some());

    let result = client
        .request(
            "payments.authorize",
            json!({
                "merchantId": "m",
                "orderId": "rust_1",
                "amount": 12.5,
                "currency": "GBP",
                "paymentToken": "tok"
            }),
            RequestOptions {
                intent: Some("authorize_payment".into()),
                idempotency_key: Some("rust_1:authorize".into()),
                classification: Some("pci".into()),
                ..Default::default()
            },
        )
        .await
        .unwrap();

    assert_eq!(result["status"], "accepted");
}

#[tokio::test]
async fn unauthorized_principal_is_denied_at_negotiation() {
    let mut client = PigeonClient::new(base(), "catalog-token");
    let error = client.connect(&["payments.authorize"]).await.unwrap_err();
    assert_eq!(error.code, "NO_PERMITTED_SUBJECTS");
    assert_eq!(error.status, 403);
}
