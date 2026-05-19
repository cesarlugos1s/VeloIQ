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
from safemantiq_framework.auth.models import (  # noqa: F401
    Role, Tenant, User,
    user_has_role_link,
    user_has_tenant_link,
)
from safemantiq_framework.auth.permissions import DEFAULT_ROLES
from safemantiq_framework.auth.utils import hash_password, seed_roles

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


with Session(engine) as session:
    # ── Team members ──────────────────────────────────────────────────────────
    alice = TeamMember(name="Alice Chen", email="alice@example.com", role="lead",
                       avatar_url="https://i.pravatar.cc/150?img=47")
    bob = TeamMember(name="Bob Martin", email="bob@example.com", role="developer",
                     avatar_url="https://i.pravatar.cc/150?img=12")
    carol = TeamMember(name="Carol Davies", email="carol@example.com", role="designer",
                       avatar_url="https://i.pravatar.cc/150?img=32")
    session.add_all([alice, bob, carol])
    session.flush()

    # ── Projects ──────────────────────────────────────────────────────────────
    website = Project(
        name="Website Relaunch",
        description="Redesign and relaunch the company website.",
        status="active",
        owner_id=alice.id,
    )
    api_proj = Project(
        name="API v2",
        description="Build the next generation REST API.",
        status="active",
        owner_id=bob.id,
    )
    brand = Project(
        name="Brand Refresh",
        description="Update visual identity across all assets.",
        status="planning",
        owner_id=carol.id,
    )
    session.add_all([website, api_proj, brand])
    session.flush()

    # ── Tasks — Website Relaunch ──────────────────────────────────────────────
    launch = Task(
        title="Launch website",
        description="Coordinate all sub-tasks and flip the switch.",
        status="in_progress",
        priority="critical",
        due_date=d(30),
        project_id=website.id,
        assignee_id=alice.id,
        planned_work_hours=2.0,
        actual_work_hours=0.5,
    )
    session.add(launch)
    session.flush()

    write_copy = Task(
        title="Write copy",
        description="Draft all page text and CTAs.",
        status="in_progress",
        priority="high",
        due_date=d(10),
        project_id=website.id,
        assignee_id=bob.id,
        parent_task_id=launch.id,
        planned_work_hours=8.0,
        actual_work_hours=3.0,
    )
    design = Task(
        title="Design mockups",
        description="Create Figma mockups for every page template.",
        status="done",
        priority="high",
        due_date=d(-5),
        project_id=website.id,
        assignee_id=carol.id,
        parent_task_id=launch.id,
        planned_work_hours=16.0,
        actual_work_hours=18.0,
    )
    hosting = Task(
        title="Set up hosting",
        description="Configure the production server and CI pipeline.",
        status="todo",
        priority="medium",
        due_date=d(20),
        project_id=website.id,
        assignee_id=bob.id,
        parent_task_id=launch.id,
        planned_work_hours=4.0,
        actual_work_hours=0.0,
    )
    session.add_all([write_copy, design, hosting])
    session.flush()

    # Sub-sub-tasks under "Write copy"
    draft_landing = Task(
        title="Draft landing page headline",
        description="Write 3 headline variants and get approval.",
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
        description="Write the company story and team bios.",
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
        description="Point the domain to the new server and set up SSL.",
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
        description="End-to-end delivery of the new REST API.",
        status="todo",
        priority="high",
        due_date=d(60),
        project_id=api_proj.id,
        assignee_id=bob.id,
        planned_work_hours=40.0,
        actual_work_hours=0.0,
    )
    session.add(api_root)
    session.flush()

    auth_task = Task(
        title="Implement authentication",
        description="JWT-based auth with refresh tokens.",
        status="in_progress",
        priority="critical",
        due_date=d(14),
        project_id=api_proj.id,
        assignee_id=bob.id,
        parent_task_id=api_root.id,
        planned_work_hours=12.0,
        actual_work_hours=6.0,
    )
    docs_task = Task(
        title="Write OpenAPI docs",
        description="Document all endpoints with examples.",
        status="todo",
        priority="low",
        due_date=d(45),
        project_id=api_proj.id,
        assignee_id=alice.id,
        parent_task_id=api_root.id,
        planned_work_hours=8.0,
        actual_work_hours=0.0,
    )
    session.add_all([auth_task, docs_task])
    session.flush()

    # ── Tasks — Brand Refresh ─────────────────────────────────────────────────
    brand_root = Task(
        title="Brand refresh rollout",
        description="Deliver the new visual identity across all channels.",
        status="todo",
        priority="medium",
        due_date=d(90),
        project_id=brand.id,
        assignee_id=carol.id,
        planned_work_hours=20.0,
        actual_work_hours=0.0,
    )
    session.add(brand_root)
    session.flush()

    logo = Task(
        title="Redesign logo",
        description="Create 3 concepts, iterate to final approved version.",
        status="in_progress",
        priority="high",
        due_date=d(15),
        project_id=brand.id,
        assignee_id=carol.id,
        parent_task_id=brand_root.id,
        planned_work_hours=10.0,
        actual_work_hours=4.0,
    )
    style_guide = Task(
        title="Update style guide",
        description="Document new colour palette, typography, and spacing.",
        status="todo",
        priority="medium",
        due_date=d(30),
        project_id=brand.id,
        assignee_id=carol.id,
        parent_task_id=brand_root.id,
        planned_work_hours=6.0,
        actual_work_hours=0.0,
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
print(f"  TeamMembers : 3")
print(f"  Projects    : 3")
print(f"  Tasks       : 13  (2-level hierarchy showcasing Miller columns)")
print(f"  Roles       : 3   (Admin, Manager, Viewer)")
print(f"  Users       : 4   (admin/admin, alice/alice123, bob/bob123, carol/carol123)")
