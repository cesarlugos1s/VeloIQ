# Configuration Reference

All SafeMantIQ configuration is handled through `SafemConfig`.  Every field
reads from an environment variable if not set explicitly, so you can configure
the app entirely through a `.env` file.

## Quick example

```python
from safemantiq_framework import create_safem_app, SafemConfig

app = create_safem_app(SafemConfig(
    title="Acme Admin",
    database_url="postgresql://user:pass@localhost/acme",
    cors_origins=["http://localhost:5173"],
    admin_title="Acme Back-Office",
))
```

Or rely entirely on environment variables in your `.env`:

```
DATABASE_URL=postgresql://user:pass@localhost/acme
CORS_ORIGINS=http://localhost:5173,https://app.acme.com
SAFEM_MODULES_DIR=app/modules
AUTH_SECRET=your-secret-key
```

And keep `main.py` to one line:

```python
from safemantiq_framework import create_safem_app
app = create_safem_app()
```

## SafemConfig fields

### Database

| Field | Env var | Default | Description |
|---|---|---|---|
| `database_url` | `DATABASE_URL` | — | SQLAlchemy database URL. Required. |
| `echo_sql` | `ECHO_SQL` | `False` | Log all SQL statements to stdout. |
| `create_tables_on_startup` | — | `True` | Call `SQLModel.metadata.create_all()` on startup. Set to `False` when using Alembic migrations. |

### Application

| Field | Env var | Default | Description |
|---|---|---|---|
| `title` | — | `"SafeMantIQ App"` | FastAPI app title, shown in `/docs`. |
| `modules_dir` | `SAFEM_MODULES_DIR` | `"app/modules"` | Path to the modules directory, relative to the working directory. |
| `static_dir` | — | `None` | Directory to mount at `/static`. |

### CORS

| Field | Env var | Default | Description |
|---|---|---|---|
| `cors_origins` | `CORS_ORIGINS` | `["*"]` | Comma-separated list of allowed origins. |

### Auth

| Field | Env var | Default | Description |
|---|---|---|---|
| `auth_enabled` | `AUTH_ENABLED` | `True` | Enable JWT Bearer token middleware. |
| `auth_secret` | `AUTH_SECRET` | `"change-me"` | Secret key for JWT signing. Change in production. |
| `auth_algorithm` | `AUTH_ALGORITHM` | `"HS256"` | JWT algorithm. |
| `auth_token_expire_minutes` | `AUTH_TOKEN_EXPIRE_MINUTES` | `60` | Token validity in minutes. |

### Admin panel

| Field | Env var | Default | Description |
|---|---|---|---|
| `admin_title` | — | Same as `title` | Title shown in the SQLAdmin back-office. |
| `admin_logo_url` | — | `None` | URL of the logo image in the admin panel. |
| `admin_templates_dir` | — | `None` | Custom Jinja2 templates directory for SQLAdmin. |

## Database migrations with Alembic

For production use, disable table auto-creation and manage schema changes
with Alembic:

```python
app = create_safem_app(SafemConfig(
    create_tables_on_startup=False,
))
```

```bash
safem db migrate -m "add product table"   # create a new revision
safem db upgrade                           # apply pending migrations
safem db history                           # show revision history
safem db current                           # show current revision
```

## Environment variable reference

```bash
# Required
DATABASE_URL=postgresql://user:password@localhost/dbname

# Optional
SAFEM_MODULES_DIR=app/modules
CORS_ORIGINS=http://localhost:5173,https://yourdomain.com
AUTH_ENABLED=true
AUTH_SECRET=your-secret-key-here
AUTH_ALGORITHM=HS256
AUTH_TOKEN_EXPIRE_MINUTES=60
ECHO_SQL=false
```
