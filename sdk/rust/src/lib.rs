use reqwest::{Client as HttpClient, StatusCode};
use serde_json::{json, Map, Value};
use thiserror::Error;

#[derive(Debug, Error)]
#[error("{code} ({status}): {message}")]
pub struct PigeonClientError {
    pub code: String,
    pub message: String,
    pub status: u16,
    pub details: Value,
}

#[derive(Clone)]
pub struct PigeonClient {
    url: String,
    token: Option<String>,
    region: String,
    http: HttpClient,
    contract_id: Option<String>,
    contract: Option<Value>,
}

impl PigeonClient {
    pub fn new(url: impl Into<String>, token: impl Into<String>) -> Self {
        Self {
            url: url.into().trim_end_matches('/').to_string(),
            token: Some(token.into()),
            region: "uk".to_string(),
            http: HttpClient::new(),
            contract_id: None,
            contract: None,
        }
    }

    pub fn without_token(url: impl Into<String>) -> Self {
        Self {
            url: url.into().trim_end_matches('/').to_string(),
            token: None,
            region: "uk".to_string(),
            http: HttpClient::new(),
            contract_id: None,
            contract: None,
        }
    }

    pub fn region(mut self, region: impl Into<String>) -> Self {
        self.region = region.into();
        self
    }

    pub fn contract(&self) -> Option<&Value> {
        self.contract.as_ref()
    }

    pub async fn connect(&mut self, subjects: &[&str]) -> Result<Value, PigeonClientError> {
        let payload = self
            .post("/v1/contracts", json!({ "subjects": subjects }), false)
            .await?;
        let contract = payload.get("contract").cloned().unwrap_or(Value::Null);
        self.contract_id = contract
            .get("id")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned);
        self.contract = Some(contract.clone());
        Ok(contract)
    }

    pub async fn publish(&self, message: Value) -> Result<Value, PigeonClientError> {
        self.require_contract()?;
        self.post("/v1/messages", message, true).await
    }

    pub async fn request(
        &self,
        subject: &str,
        data: Value,
        options: RequestOptions,
    ) -> Result<Value, PigeonClientError> {
        let mut message = Map::new();
        message.insert("subject".into(), json!(subject));
        message.insert(
            "type".into(),
            json!(options
                .message_type
                .unwrap_or_else(|| format!("{subject}.request"))),
        );
        message.insert(
            "source".into(),
            json!(options.source.unwrap_or_else(|| "sdk-rust".into())),
        );
        message.insert(
            "region".into(),
            json!(options.region.unwrap_or_else(|| self.region.clone())),
        );
        message.insert("data".into(), data);
        insert_optional(&mut message, "intent", options.intent);
        insert_optional(&mut message, "idempotencyKey", options.idempotency_key);
        insert_optional(&mut message, "classification", options.classification);
        insert_optional(&mut message, "correlationId", options.correlation_id);
        self.publish(Value::Object(message)).await
    }

    pub async fn receive(
        &self,
        subject: &str,
        max: usize,
    ) -> Result<Vec<Value>, PigeonClientError> {
        self.require_contract()?;
        let path = format!("/v1/subjects/{subject}/receive");
        let payload = self.post(&path, json!({ "max": max }), true).await?;
        Ok(payload
            .get("messages")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default())
    }

    pub async fn subjects(&self) -> Result<Vec<Value>, PigeonClientError> {
        let payload = self.get("/v1/subjects").await?;
        Ok(payload
            .get("subjects")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default())
    }

    pub async fn audit(&self) -> Result<Vec<Value>, PigeonClientError> {
        let payload = self.get("/v1/audit").await?;
        Ok(payload
            .get("records")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default())
    }

    pub async fn quarantine(&self) -> Result<Vec<Value>, PigeonClientError> {
        let payload = self.get("/v1/quarantine").await?;
        Ok(payload
            .get("records")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default())
    }

    fn require_contract(&self) -> Result<(), PigeonClientError> {
        if self.contract_id.is_none() {
            return Err(PigeonClientError {
                code: "CONTRACT_REQUIRED".into(),
                message: "Call connect() to negotiate a contract first.".into(),
                status: 0,
                details: json!({}),
            });
        }
        Ok(())
    }

    async fn get(&self, path: &str) -> Result<Value, PigeonClientError> {
        let response = self
            .apply_headers(self.http.get(format!("{}{}", self.url, path)), false)
            .send()
            .await
            .map_err(network_error)?;
        parse_response(response.status(), response).await
    }

    async fn post(
        &self,
        path: &str,
        body: Value,
        with_contract: bool,
    ) -> Result<Value, PigeonClientError> {
        let response = self
            .apply_headers(
                self.http.post(format!("{}{}", self.url, path)).json(&body),
                with_contract,
            )
            .send()
            .await
            .map_err(network_error)?;
        parse_response(response.status(), response).await
    }

    fn apply_headers(
        &self,
        mut request: reqwest::RequestBuilder,
        with_contract: bool,
    ) -> reqwest::RequestBuilder {
        request = request.header("x-pigeon-region", &self.region);
        if let Some(token) = &self.token {
            request = request.bearer_auth(token);
        }
        if with_contract {
            if let Some(contract_id) = &self.contract_id {
                request = request.header("x-pigeon-contract", contract_id);
            }
        }
        request
    }
}

#[derive(Default)]
pub struct RequestOptions {
    pub intent: Option<String>,
    pub idempotency_key: Option<String>,
    pub classification: Option<String>,
    pub region: Option<String>,
    pub message_type: Option<String>,
    pub source: Option<String>,
    pub correlation_id: Option<String>,
}

fn insert_optional(map: &mut Map<String, Value>, key: &str, value: Option<String>) {
    if let Some(value) = value {
        map.insert(key.to_string(), json!(value));
    }
}

fn network_error(error: reqwest::Error) -> PigeonClientError {
    PigeonClientError {
        code: "NETWORK_ERROR".into(),
        message: error.to_string(),
        status: 0,
        details: json!({}),
    }
}

async fn parse_response(
    status: StatusCode,
    response: reqwest::Response,
) -> Result<Value, PigeonClientError> {
    let payload = response.json::<Value>().await.unwrap_or_else(|_| json!({}));
    if status.is_success() {
        return Ok(payload);
    }

    let error = payload.get("error").cloned().unwrap_or_else(|| json!({}));
    Err(PigeonClientError {
        code: error
            .get("code")
            .and_then(Value::as_str)
            .unwrap_or("REQUEST_FAILED")
            .to_string(),
        message: error
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("Pigeon request failed")
            .to_string(),
        status: status.as_u16(),
        details: error.get("details").cloned().unwrap_or_else(|| json!({})),
    })
}
