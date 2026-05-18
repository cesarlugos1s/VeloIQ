"""{{app_title}} — main entry point.

Start the development server:
    safem run

Or directly with uvicorn:
    uvicorn app.main:app --reload
"""
from safemantiq_framework import create_safem_app

app = create_safem_app()
