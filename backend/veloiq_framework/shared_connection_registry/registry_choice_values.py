"""Closed lists of values of the shared connection registry (the allowed values of the entity definitions)."""

# Endpoint types a connection can have. Installed connectivity packs add their own.
ENDPOINT_TYPES = (
    "rest_api", "veloiq_app", "file", "sftp_folder", "database",
    "outgoing_webhook", "incoming_webhook", "incoming_api_endpoint",
)
OPERATION_METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE")
OPERATION_SOURCES = ("openapi_import", "url_discovery", "by_hand")
SECRET_KEYS = ("password", "token", "client_secret", "api_key", "private_key")
REST_AUTHENTICATIONS = ("none", "user_name_and_password", "bearer_token", "api_key_header", "api_key_query", "oauth2_client_credentials")
REST_AUTHENTICATIONS_THAT_USE_OAUTH = ("oauth2_client_credentials",)
REST_PAGING_STYLES = ("none", "offset", "page_number", "cursor", "json_link", "header_link")
USAGE_SELECTION_ITEM_KINDS = (
    "api_operation", "connection", "webhook_subscription", "job_type", "business_rule_set", "database_connection",
)
USAGES = ("ai_agents", "integration_hub")

# Values of the secret that the API returns instead of the stored one.
MASKED_SECRET_VALUE = "********"
