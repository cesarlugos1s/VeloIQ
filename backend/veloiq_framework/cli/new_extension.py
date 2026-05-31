"""``veloiq new-extension`` — scaffold a new VeloIQ extension package."""
from __future__ import annotations

import re
from pathlib import Path

import click


@click.command("new-extension")
@click.argument("name")
@click.option("--title", default="", help="Human-readable extension title (default: derived from name).")
@click.option("--output-dir", default=".", show_default=True,
              help="Parent directory in which to create the extension folder.")
def new_extension(name: str, title: str, output_dir: str) -> None:
    """Scaffold a new VeloIQ extension package.

    NAME is the short identifier for the extension (e.g. 'vigilantiq').
    The command creates the directory structure at OUTPUT_DIR/NAME.
    """
    slug = _slugify(name)
    pkg_name = slug.replace("-", "_")
    display_title = title or pkg_name.replace("_", " ").title()

    root = Path(output_dir).resolve() / slug
    if root.exists():
        raise click.ClickException(f"Directory already exists: {root}")

    click.echo(f"\n🔧 Creating extension '{pkg_name}' at {root}…\n")

    # ── backend/{pkg_name}/ — the Python package ──────────────────────────────
    _write(root / "backend" / pkg_name / "__init__.py",
           f'from .manifest import ExtensionManifest\n\n__all__ = ["ExtensionManifest"]\n')

    _write(root / "backend" / pkg_name / "manifest.py",
           _MANIFEST_PY.format(pkg=pkg_name, title=display_title))

    # keys/ — RSA public key placeholder
    _write(root / "backend" / pkg_name / "keys" / ".gitkeep", "")
    _write(root / "backend" / pkg_name / "keys" / "README.md",
           "# Keys\n\nPlace your `public_key.pem` here after running the licensing CLI.\n"
           "Never commit the private key.\n")

    # modules/ — empty package ready for module sub-packages
    _write(root / "backend" / pkg_name / "modules" / "__init__.py", "")

    # frontend/pages/ — extension schema files (package data)
    _write(root / "backend" / pkg_name / "frontend" / "pages" / ".gitkeep", "")

    # static/ — pre-built JS bundles (package data)
    _write(root / "backend" / pkg_name / "static" / ".gitkeep", "")

    # pyproject.toml
    _write(root / "backend" / "pyproject.toml",
           _PYPROJECT_TOML.format(pkg=pkg_name, title=display_title))

    # requirements.txt
    _write(root / "backend" / "requirements.txt",
           "veloiq-framework>=0.5.0\npython-jose[cryptography]>=3.3.0\ncryptography>=41.0.0\n")

    # ── frontend/src/pages/ — development working area for schema files ───────
    _write(root / "frontend" / "src" / "pages" / ".gitkeep", "")

    # ── static/ — development working area for JS bundles ────────────────────
    _write(root / "static" / ".gitkeep", "")

    # ── licensing/ — JWT signing CLI ─────────────────────────────────────────
    _write(root / "licensing" / "generate_license.py",
           _GENERATE_LICENSE_PY.format(pkg=pkg_name, title=display_title))
    _write(root / "licensing" / "requirements.txt",
           "python-jose[cryptography]>=3.3.0\ncryptography>=41.0.0\n")
    _write(root / "licensing" / "README.md",
           _LICENSING_README.format(pkg=pkg_name))

    # ── Root files ────────────────────────────────────────────────────────────
    _write(root / ".gitignore",
           "*.pyc\n__pycache__/\n*.egg-info/\ndist/\nbuild/\n"
           ".venv/\nvenv/\n\n# Never commit private keys\nlicensing/keys/private_key.pem\n")
    _write(root / "README.md", _README_MD.format(pkg=pkg_name, title=display_title))

    click.echo(f"\n✅ Extension scaffold created at {root}")
    click.echo("\nNext steps:")
    click.echo(f"  cd {root}/backend")
    click.echo(f"  pip install -e .")
    click.echo(f"  # Add your modules under backend/{pkg_name}/modules/")
    click.echo(f"  # Run 'veloiq generate' from your host app to pick up the extension")
    click.echo(f"  # Generate license keys: cd {root}/licensing && python generate_license.py keygen")


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

_MANIFEST_PY = '''\
"""Extension manifest for {title}."""
from veloiq_framework import VeloIQExtension


class ExtensionManifest(VeloIQExtension):
    """Declare this extension to the VeloIQ framework."""

    name = "{pkg}"
    version = "0.1.0"

    # Dotted path to the Python package that contains this extension's modules.
    modules_package = "{pkg}.modules"

    # Path relative to the installed package directory where pre-built JS
    # bundles live.  Set to None if this extension has no custom UI bundles.
    static_dir = "static"

    # Path relative to the installed package directory where frontend schema
    # files (*.Schema.gen.ts etc.) are stored as package data.
    # veloiq generate copies these into the host app's frontend/src/pages/.
    frontend_pages_dir = "frontend/pages"
'''

_PYPROJECT_TOML = '''\
[build-system]
requires = ["setuptools>=68", "wheel"]
build-backend = "setuptools.backends.legacy:build"

[project]
name = "{pkg}"
version = "0.1.0"
description = "{title} — VeloIQ extension package"
requires-python = ">=3.10"
license = {{ text = "Proprietary" }}
dependencies = [
    "veloiq-framework>=0.5.0",
    "python-jose[cryptography]>=3.3.0",
    "cryptography>=41.0.0",
]

[project.entry-points."veloiq.extensions"]
{pkg} = "{pkg}.manifest:ExtensionManifest"

[tool.setuptools.packages.find]
where = ["."]

[tool.setuptools.package-data]
{pkg} = [
    "frontend/pages/**/*",
    "static/**/*",
    "keys/public_key.pem",
]
'''

_GENERATE_LICENSE_PY = '''\
#!/usr/bin/env python3
"""License key generator for {title}.

Usage
-----
# Generate RSA key pair (one-time setup):
python generate_license.py keygen --out-dir ./keys

# Issue a license key:
python generate_license.py generate \\
    --private-key ./keys/private_key.pem \\
    --installation-id <UUID from the running app> \\
    --module-group "My Module Group" \\
    --start-date 2026-01-01 \\
    --end-date 2026-12-31

Copy the printed JWT token and give it to the customer to paste into
the License Management page of their app.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path


def cmd_keygen(args: argparse.Namespace) -> None:
    """Generate a new RSA-2048 key pair."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    priv_path = out_dir / "private_key.pem"
    priv_path.write_bytes(
        private_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption(),
        )
    )
    priv_path.chmod(0o600)

    pub_path = out_dir / "public_key.pem"
    pub_path.write_bytes(
        private_key.public_key().public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
    )

    print(f"✅ Private key → {{priv_path}}")
    print(f"✅ Public key  → {{pub_path}}")
    print()
    print("Deploy public_key.pem to your extension package:")
    print(f"  cp {{pub_path}} ../backend/{pkg}/keys/public_key.pem")
    print()
    print("⚠️  Keep private_key.pem secret — never commit it or share it.")


def cmd_generate(args: argparse.Namespace) -> None:
    """Sign and print a license JWT."""
    from jose import jwt as jose_jwt

    priv_pem = Path(args.private_key).read_text()

    payload = {{
        "jti": str(uuid.uuid4()),
        "iat": int(datetime.now(tz=timezone.utc).timestamp()),
        "installation_id": args.installation_id,
        "module_group": args.module_group,
        "start_date": args.start_date,
        "end_date": args.end_date,
    }}

    # ── Add any custom quantity limits ────────────────────────────────────────
    # Uncomment and extend as needed for your module group's license parameters:
    # if args.max_something is not None:
    #     payload["max_something"] = args.max_something

    headers = {{"alg": "RS256"}}
    if args.kid:
        headers["kid"] = args.kid

    token = jose_jwt.encode(payload, priv_pem, algorithm="RS256", headers=headers)
    print(token)

    # Append to audit log.
    audit_path = Path("license_audit.jsonl")
    entry = {{**payload, "issued_at": datetime.now(tz=timezone.utc).isoformat()}}
    with audit_path.open("a") as f:
        f.write(json.dumps(entry) + "\\n")
    print(f"\\n📋 Logged to {{audit_path}}", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description="{title} license key generator")
    sub = parser.add_subparsers(dest="command", required=True)

    # keygen
    p_keygen = sub.add_parser("keygen", help="Generate RSA key pair")
    p_keygen.add_argument("--out-dir", default="./keys")

    # generate
    p_gen = sub.add_parser("generate", help="Issue a license JWT")
    p_gen.add_argument("--private-key", required=True)
    p_gen.add_argument("--installation-id", required=True)
    p_gen.add_argument("--module-group", required=True)
    p_gen.add_argument("--start-date", required=True, help="YYYY-MM-DD")
    p_gen.add_argument("--end-date", required=True, help="YYYY-MM-DD")
    p_gen.add_argument("--kid", default="v1", help="Key ID header")
    # Add module-group-specific quantity limit arguments here, e.g.:
    # p_gen.add_argument("--max-something", type=int, default=None)

    args = parser.parse_args()
    if args.command == "keygen":
        cmd_keygen(args)
    elif args.command == "generate":
        cmd_generate(args)


if __name__ == "__main__":
    main()
'''

_LICENSING_README = '''\
# {pkg} Licensing

## One-time setup

```bash
pip install -r requirements.txt
python generate_license.py keygen --out-dir ./keys
```

Copy `keys/public_key.pem` to the extension package and re-install:

```bash
cp keys/public_key.pem ../backend/{pkg}/keys/public_key.pem
cd ../backend && pip install -e .
```

**Never commit `keys/private_key.pem`.**

## Issuing a license key

1. Get the Installation ID from the customer\'s running app
   (shown in the License Management page).

2. Run:

```bash
python generate_license.py generate \\
    --private-key ./keys/private_key.pem \\
    --installation-id <UUID> \\
    --module-group "My Module Group" \\
    --start-date 2026-01-01 \\
    --end-date 2026-12-31
```

3. Give the printed JWT token to the customer.
   They paste it into the License Management page of their app.
'''

_README_MD = '''\
# {title}

A VeloIQ extension package.

## Installation

```bash
pip install {pkg}
```

After installing, regenerate the host app schemas:

```bash
cd your-host-app
veloiq generate
```

## Development

```bash
cd backend
pip install -e .
```

## Project structure

```
backend/{pkg}/
    manifest.py         — Extension manifest (entry point)
    modules/            — Python backend modules
    frontend/pages/     — Schema files (package data, copied by veloiq generate)
    static/             — Pre-built JS bundles served at /ext/{pkg}/
    keys/               — RSA public key for license verification
licensing/
    generate_license.py — CLI for issuing license JWTs
frontend/src/pages/     — Development area for schema files
static/                 — Development area for JS bundles
```
'''


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9_-]", "", name.lower().replace(" ", "_"))


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    click.echo(f"  created  {path}")
