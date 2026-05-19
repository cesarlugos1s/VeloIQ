"""Generate api.py endpoints and TypeScript schemas from SQLModel definitions.

Run:
    python api_schema_gen.py
    # or from the project root:
    veloiq generate
"""
from veloiq_framework.api_schema_gen import run_api_schema_gen

if __name__ == "__main__":
    run_api_schema_gen()
