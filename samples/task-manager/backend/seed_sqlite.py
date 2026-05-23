"""Seed script — creates and populates taskmanager.db with sample data.

Run from the backend/ directory:
    python seed_sqlite.py

The script is idempotent: it drops and recreates all tables each time.

Pre-seeded users:
  admin / admin       — Admin role   (full access)
  alice / alice123    — Manager role (no delete)
  bob   / bob123      — Manager role (no delete)
  carol / carol123    — Viewer role  (read-only)
"""
import datetime
import os
import sys

# Point at the bundled SQLite file so the app uses it out of the box
os.environ.setdefault("DATABASE_URL", "sqlite:///./taskmanager.db")
os.environ.setdefault("AUTH_SECRET", "task-manager-dev-secret-change-this")

# Make sure the app modules are importable
sys.path.insert(0, ".")

from sqlalchemy import create_engine
from sqlmodel import Session, SQLModel, select

from app.modules.projects.models import Project  # noqa: F401 — registers table
from app.modules.tasks.models import Task  # noqa: F401 — registers table
from app.modules.team.models import TeamMember  # noqa: F401 — registers table

# Auth models must be imported so their tables are included in metadata
from veloiq_framework.auth.models import (  # noqa: F401
    Role, Tenant, User,
    user_has_role_link,
    user_has_tenant_link,
)
from veloiq_framework.auth.permissions import DEFAULT_ROLES
from veloiq_framework.auth.utils import hash_password, seed_roles

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SQLModel.metadata.drop_all(engine)
SQLModel.metadata.create_all(engine)

# Seed the three default roles with their allowed HTTP methods.
# seed_roles() upserts — safe to run after create_all on a fresh DB.
seed_roles(engine, DEFAULT_ROLES)

today = datetime.date.today()


def d(offset: int) -> datetime.date:
    return today + datetime.timedelta(days=offset)


# ── Markdown descriptions ──────────────────────────────────────────────────────

PROJECT_WEBSITE_DESC = """\
## Website Relaunch

Redesign and relaunch the **company website** to improve UX and conversion rates.

### Goals
- Modernize the visual design with [new brand guidelines](https://example.com/brand)
- Improve page load performance to **under 2 seconds**
- Increase conversion rate by **15%** *(revised from the original 10% target)*

> **Stakeholder note:** This project is aligned with Q3 OKRs. \
See the [project brief](https://example.com/brief) for full details.

*Owner: Alice Chen — Target: Q3 2025*
"""

PROJECT_API_DESC = """\
## API v2

Build the **next-generation REST API** to replace the legacy v1 endpoints.

### Scope
- Full **OpenAPI 3.1** specification and interactive docs
- JWT-based authentication with refresh tokens
- Rate limiting and an **SLA of 99.9% uptime**

> Reference: [REST API Design Guide](https://restfulapi.net) for naming conventions.

*Owner: Bob Martin — Target: Q4 2025*
"""

PROJECT_BRAND_DESC = """\
## Brand Refresh

Update the **visual identity** across all channels and touchpoints.

### Deliverables
- New **logo** with 3 concept variants, iterated to a final approved version
- Updated **colour palette** and typography scale
- Revised [brand guidelines](https://example.com/brand) document

> *Inspired by [Refactoring UI](https://www.refactoringui.com) design principles.*

*Owner: Carol Davies — Target: Q1 2026*
"""

TASK_LAUNCH_DESC = """\
## Launch Website

Coordinate all sub-tasks and **flip the switch** on the new site.

### Pre-launch checklist
- All copy reviewed and *approved by legal*
- Hosting and DNS confirmed live
- Final QA passed on **Chrome, Firefox, Safari**

> See [deployment runbook](https://example.com/runbook) for the go-live sequence.
"""

TASK_WRITE_COPY_DESC = """\
## Write Copy

Draft all page text and **calls to action** for the relaunched site.

### Pages in scope
- Landing page — *hero headline + 3 value-prop sections*
- About Us — company story and **team bios**
- Product pages — [feature matrix](https://example.com/features) reference

> Tone guide: **confident**, concise, jargon-free.
"""

TASK_DESIGN_DESC = """\
## Design Mockups

Create **Figma mockups** for every page template.

### Deliverables
- Desktop + mobile breakpoints for each template
- *Interactive prototype* for stakeholder review
- Exported assets in **SVG and WebP**

> Figma file: [Website Relaunch – Designs](https://figma.com/example)
"""

TASK_HOSTING_DESC = """\
## Set Up Hosting

Configure the **production server** and CI/CD pipeline.

### Steps
1. Provision cloud instance — *t3.medium minimum*
2. Set up **GitHub Actions** deploy workflow
3. Configure SSL certificate via Let's Encrypt

> Infrastructure guide: [DevOps Runbook](https://example.com/devops)
"""

TASK_API_ROOT_DESC = """\
## Build API v2

End-to-end delivery of the **new REST API**.

### Architecture
- FastAPI + SQLModel backend
- *PostgreSQL* for production, SQLite for development
- Deployed via **Docker** on the existing infrastructure

> See [API v2 RFC](https://example.com/rfc-api-v2) for the full technical proposal.
"""

TASK_AUTH_DESC = """\
## Implement Authentication

JWT-based auth with **refresh tokens** and role-based access control.

### Endpoints
- `POST /auth/login` — returns *access token* + refresh token
- `POST /auth/refresh` — rotates the refresh token
- `DELETE /auth/logout` — invalidates the session

> Security reference: [OWASP Auth Cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
"""

TASK_DOCS_DESC = """\
## Write OpenAPI Docs

Document **all endpoints** with request/response examples.

### Coverage
- Every route annotated with `summary`, `description`, and *example values*
- **Error responses** (400, 401, 403, 404, 422) fully documented
- Postman collection exported from the OpenAPI spec

> Style guide: [OpenAPI Best Practices](https://example.com/openapi-guide)
"""

TASK_BRAND_ROOT_DESC = """\
## Brand Refresh Rollout

Deliver the **new visual identity** across all channels.

### Channels
- Website, app UI, *print collateral*
- Social media templates — **LinkedIn, Twitter, Instagram**
- Email signatures and [letterhead templates](https://example.com/templates)

> Brand strategy reference: [Positioning Doc](https://example.com/positioning)
"""

TASK_LOGO_DESC = """\
## Redesign Logo

Create **3 concept variants** and iterate to the final approved version.

### Process
1. Mood board and *competitive analysis*
2. Initial concepts — **3 directions**
3. Stakeholder review and one round of refinement
4. Final delivery in SVG, PNG, and PDF

> Inspiration: [Dribbble Logo Collection](https://dribbble.com/tags/logo)
"""

TASK_STYLE_GUIDE_DESC = """\
## Update Style Guide

Document the **new colour palette**, typography, and spacing system.

### Sections
- *Primary and secondary* colour tokens with hex and RGB values
- **Type scale** — headings H1–H6, body, caption, code
- Spacing grid and [component examples](https://example.com/components)

> Tooling: [Style Dictionary](https://amzn.github.io/style-dictionary/) for design tokens.
"""

TASK_DRAFT_LANDING_DESC = (
    "Write **3 headline variants** for the landing page hero "
    "and get stakeholder approval before finalising."
)
TASK_DRAFT_ABOUT_DESC = (
    "Write the *company story* and **team bios** for the About Us section. "
    "Max 120 words per bio."
)
TASK_DNS_DESC = (
    "Point the domain to the new server, set up **SSL via Let's Encrypt**, "
    "and verify DNS propagation."
)


with Session(engine) as session:
    # ── Team members ──────────────────────────────────────────────────────────
    alice = TeamMember(
        name="Alice Chen",
        email="alice@example.com",
        role="lead",
        phone="+1 555 010 1234",
        avatar_url="https://i.pravatar.cc/150?img=47",
    )
    bob = TeamMember(
        name="Bob Martin",
        email="bob@example.com",
        role="developer",
        phone="+1 555 020 5678",
        avatar_url="https://i.pravatar.cc/150?img=12",
    )
    carol = TeamMember(
        name="Carol Davies",
        email="carol@example.com",
        role="designer",
        phone="+1 555 030 9012",
        avatar_url="https://i.pravatar.cc/150?img=32",
    )
    session.add_all([alice, bob, carol])
    session.flush()

    # ── Projects ──────────────────────────────────────────────────────────────
    website = Project(
        name="Website Relaunch",
        description=PROJECT_WEBSITE_DESC,
        status="active",
        owner_id=alice.id,
    )
    api_proj = Project(
        name="API v2",
        description=PROJECT_API_DESC,
        status="active",
        owner_id=bob.id,
    )
    brand = Project(
        name="Brand Refresh",
        description=PROJECT_BRAND_DESC,
        status="planning",
        owner_id=carol.id,
    )
    session.add_all([website, api_proj, brand])
    session.flush()

    # ── Tasks — Website Relaunch ──────────────────────────────────────────────
    launch = Task(
        title="Launch website",
        description=TASK_LAUNCH_DESC,
        status="in_progress",
        priority="critical",
        due_date=d(30),
        project_id=website.id,
        assignee_id=alice.id,
        planned_work_hours=2.0,
        actual_work_hours=0.5,
        planned_cost=15000.00,
        actual_cost=3500.00,
        actual_progress=25,
        rating=4,
    )
    session.add(launch)
    session.flush()

    write_copy = Task(
        title="Write copy",
        description=TASK_WRITE_COPY_DESC,
        status="in_progress",
        priority="high",
        due_date=d(10),
        project_id=website.id,
        assignee_id=bob.id,
        parent_task_id=launch.id,
        planned_work_hours=8.0,
        actual_work_hours=3.0,
        planned_cost=8000.00,
        actual_cost=3000.00,
        actual_progress=40,
        rating=3,
    )
    design = Task(
        title="Design mockups",
        description=TASK_DESIGN_DESC,
        status="done",
        priority="high",
        due_date=d(-5),
        project_id=website.id,
        assignee_id=carol.id,
        parent_task_id=launch.id,
        planned_work_hours=16.0,
        actual_work_hours=18.0,
        planned_cost=12000.00,
        actual_cost=14000.00,
        actual_progress=100,
        rating=5,
    )
    hosting = Task(
        title="Set up hosting",
        description=TASK_HOSTING_DESC,
        status="todo",
        priority="medium",
        due_date=d(20),
        project_id=website.id,
        assignee_id=bob.id,
        parent_task_id=launch.id,
        planned_work_hours=4.0,
        actual_work_hours=0.0,
        planned_cost=5000.00,
        actual_cost=0.00,
        actual_progress=0,
    )
    session.add_all([write_copy, design, hosting])
    session.flush()

    # Sub-sub-tasks under "Write copy"
    draft_landing = Task(
        title="Draft landing page headline",
        description=TASK_DRAFT_LANDING_DESC,
        status="done",
        priority="high",
        due_date=d(2),
        project_id=website.id,
        assignee_id=bob.id,
        parent_task_id=write_copy.id,
        planned_work_hours=2.0,
        actual_work_hours=1.5,
    )
    draft_about = Task(
        title="Draft About Us section",
        description=TASK_DRAFT_ABOUT_DESC,
        status="in_progress",
        priority="medium",
        due_date=d(7),
        project_id=website.id,
        assignee_id=bob.id,
        parent_task_id=write_copy.id,
        planned_work_hours=3.0,
        actual_work_hours=1.0,
    )
    session.add_all([draft_landing, draft_about])
    session.flush()

    # Sub-sub-task under "Set up hosting"
    dns = Task(
        title="Configure DNS records",
        description=TASK_DNS_DESC,
        status="todo",
        priority="medium",
        due_date=d(18),
        project_id=website.id,
        assignee_id=bob.id,
        parent_task_id=hosting.id,
        planned_work_hours=1.0,
        actual_work_hours=0.0,
    )
    session.add(dns)
    session.flush()

    # ── Tasks — API v2 ────────────────────────────────────────────────────────
    api_root = Task(
        title="Build API v2",
        description=TASK_API_ROOT_DESC,
        status="todo",
        priority="high",
        due_date=d(60),
        project_id=api_proj.id,
        assignee_id=bob.id,
        planned_work_hours=40.0,
        actual_work_hours=0.0,
        planned_cost=50000.00,
        actual_cost=12000.00,
        actual_progress=20,
    )
    session.add(api_root)
    session.flush()

    auth_task = Task(
        title="Implement authentication",
        description=TASK_AUTH_DESC,
        status="in_progress",
        priority="critical",
        due_date=d(14),
        project_id=api_proj.id,
        assignee_id=bob.id,
        parent_task_id=api_root.id,
        planned_work_hours=12.0,
        actual_work_hours=6.0,
        planned_cost=15000.00,
        actual_cost=7500.00,
        actual_progress=50,
        rating=4,
    )
    docs_task = Task(
        title="Write OpenAPI docs",
        description=TASK_DOCS_DESC,
        status="todo",
        priority="low",
        due_date=d(45),
        project_id=api_proj.id,
        assignee_id=alice.id,
        parent_task_id=api_root.id,
        planned_work_hours=8.0,
        actual_work_hours=0.0,
        planned_cost=5000.00,
        actual_cost=0.00,
        actual_progress=0,
    )
    session.add_all([auth_task, docs_task])
    session.flush()

    # ── Tasks — Brand Refresh ─────────────────────────────────────────────────
    brand_root = Task(
        title="Brand refresh rollout",
        description=TASK_BRAND_ROOT_DESC,
        status="todo",
        priority="medium",
        due_date=d(90),
        project_id=brand.id,
        assignee_id=carol.id,
        planned_work_hours=20.0,
        actual_work_hours=0.0,
        planned_cost=25000.00,
        actual_cost=5000.00,
        actual_progress=20,
    )
    session.add(brand_root)
    session.flush()

    logo = Task(
        title="Redesign logo",
        description=TASK_LOGO_DESC,
        status="in_progress",
        priority="high",
        due_date=d(15),
        project_id=brand.id,
        assignee_id=carol.id,
        parent_task_id=brand_root.id,
        planned_work_hours=10.0,
        actual_work_hours=4.0,
        planned_cost=8000.00,
        actual_cost=3200.00,
        actual_progress=40,
        rating=3,
    )
    style_guide = Task(
        title="Update style guide",
        description=TASK_STYLE_GUIDE_DESC,
        status="todo",
        priority="medium",
        due_date=d(30),
        project_id=brand.id,
        assignee_id=carol.id,
        parent_task_id=brand_root.id,
        planned_work_hours=6.0,
        actual_work_hours=0.0,
        planned_cost=4000.00,
        actual_cost=0.00,
        actual_progress=0,
    )
    session.add_all([logo, style_guide])
    session.flush()

    # ── Auth: roles — fetched from DB (created by seed_roles() above) ─────────
    admin_role   = session.exec(select(Role).where(Role.name == "Admin")).first()
    manager_role = session.exec(select(Role).where(Role.name == "Manager")).first()
    viewer_role  = session.exec(select(Role).where(Role.name == "Viewer")).first()

    # ── Auth: users ───────────────────────────────────────────────────────────
    admin_user = User(
        username="admin", email="admin@example.com",
        first_name="System", last_name="Admin",
        status="Active", password_hash=hash_password("admin"),
    )
    alice_user = User(
        username="alice", email="alice@example.com",
        first_name="Alice", last_name="Chen",
        status="Active", password_hash=hash_password("alice123"),
    )
    bob_user = User(
        username="bob", email="bob@example.com",
        first_name="Bob", last_name="Martin",
        status="Active", password_hash=hash_password("bob123"),
    )
    carol_user = User(
        username="carol", email="carol@example.com",
        first_name="Carol", last_name="Davies",
        status="Active", password_hash=hash_password("carol123"),
    )
    session.add_all([admin_user, alice_user, bob_user, carol_user])
    session.flush()

    session.add(user_has_role_link(user_id=admin_user.id, role_id=admin_role.id))
    session.add(user_has_role_link(user_id=alice_user.id, role_id=manager_role.id))
    session.add(user_has_role_link(user_id=bob_user.id,   role_id=manager_role.id))
    session.add(user_has_role_link(user_id=carol_user.id, role_id=viewer_role.id))

    session.commit()

print("taskmanager.db seeded successfully.")
print(f"  TeamMembers : 3  (with phone numbers)")
print(f"  Projects    : 3  (with markdown descriptions)")
print(f"  Tasks       : 13 (with markdown descriptions, cost, progress, rating)")
print(f"  Roles       : 3  (Admin, Manager, Viewer)")
print(f"  Users       : 4  (admin/admin, alice/alice123, bob/bob123, carol/carol123)")
