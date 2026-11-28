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
# Database types a database connection can have, with the SQLAlchemy dialect (and driver) that opens each one and its usual port.
# The matching Python driver must be installed in the host application; a missing driver is reported when the connection is used.
DATABASE_TYPE_DIALECTS = {
    "postgres": "postgresql", "mysql": "mysql+pymysql", "mariadb": "mysql+pymysql", "sqlite": "sqlite", "mssql": "mssql+pyodbc",
    "oracle": "oracle+oracledb", "db2": "db2+ibm_db", "informix": "informix", "snowflake": "snowflake", "duckdb": "duckdb",
    "clickhouse": "clickhouse", "bigquery": "bigquery",
}
DATABASE_TYPES = tuple(DATABASE_TYPE_DIALECTS)
DATABASE_USUAL_PORTS = {
    "postgres": 5432, "mysql": 3306, "mariadb": 3306, "mssql": 1433, "oracle": 1521, "db2": 50000, "informix": 9088,
    "clickhouse": 8123,
}
# Database types that are a file or a service addressed by name only: they need no host.
DATABASE_TYPES_WITHOUT_HOST = ("sqlite", "duckdb", "bigquery")
USAGE_SELECTION_ITEM_KINDS = (
    "api_operation", "connection", "webhook_subscription", "job_type", "business_rule_set", "database_connection",
)
USAGES = ("ai_agents", "integration_hub")

# Values of the secret that the API returns instead of the stored one.
MASKED_SECRET_VALUE = "********"
