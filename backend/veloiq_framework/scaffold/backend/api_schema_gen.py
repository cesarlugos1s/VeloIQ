"""Code generator — backend SQLModel → api.py endpoints + frontend TypeScript schemas.

Run:
    python api_schema_gen.py
    # or
    veloiq generate
"""
from veloiq_framework.api_schema_gen import run_api_schema_gen

if __name__ == "__main__":
    run_api_schema_gen()
