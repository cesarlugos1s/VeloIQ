"""Storage for role access policies (RBAC layer 2, configurable at runtime).

A role has zero or one :class:`RoleAccessPolicy`. Its ``mode`` is ``allow``
(allowlist) or ``block`` (blocklist) and it holds one or more
:class:`RoleAccessEntry` rows, one per module or model. Every change made
through the Access Policies endpoints is recorded in :class:`RoleAccessAudit`.

Apart from it, a role has zero or one :class:`RoleFeaturePolicy`: an
allowlist or a blocklist of registered features (capabilities such as an
extension's answering methods), one :class:`RoleFeatureEntry` per feature.
Its changes are recorded in the same audit table.

Tables follow the framework's ``veloiq_`` prefix convention.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlmodel import Field, SQLModel


#: Allowed values of :attr:`RoleAccessPolicy.mode`.
POLICY_MODE_ALLOW = "allow"
POLICY_MODE_BLOCK = "block"
POLICY_MODES = (POLICY_MODE_ALLOW, POLICY_MODE_BLOCK)


def _utcnow() -> datetime:
    """Return the current UTC time (column default for audit timestamps)."""
    return datetime.now(timezone.utc)


class RoleAccessPolicy(SQLModel, table=True):
    """A role's single access rule set (allowlist or blocklist)."""
    __tablename__ = "veloiq_role_access_policy"

    id: Optional[int] = Field(default=None, primary_key=True)
    # Unique: a role has at most one policy (AC-B1). Cascade: deleting the
    # role deletes its policy (AC-B8).
    role_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("veloiq_role.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        )
    )
    mode: str = Field(sa_column=Column(String(10), nullable=False))
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class RoleAccessEntry(SQLModel, table=True):
    """One resource of a policy with the CRUD actions it names.

    ``model_key`` is ``None`` for an entry that covers the whole module.
    In an allowlist the flagged actions are granted; in a blocklist they are
    denied.
    """
    __tablename__ = "veloiq_role_access_entry"
    __table_args__ = (
        UniqueConstraint("policy_id", "module_key", "model_key", name="uq_veloiq_role_access_entry"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    policy_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("veloiq_role_access_policy.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    module_key: str = Field(sa_column=Column(String(200), nullable=False))
    model_key: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True))
    can_create: bool = Field(default=False)
    can_read: bool = Field(default=False)
    can_update: bool = Field(default=False)
    can_delete: bool = Field(default=False)


class RoleFeaturePolicy(SQLModel, table=True):
    """A role's single feature rule set (allowlist or blocklist of features).

    Kept apart from :class:`RoleAccessPolicy`, so a role can restrict its
    modules and its features independently, each with its own mode.
    """
    __tablename__ = "veloiq_role_feature_policy"

    id: Optional[int] = Field(default=None, primary_key=True)
    # Unique: a role has at most one feature policy. Cascade: deleting the
    # role deletes its feature policy.
    role_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("veloiq_role.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        )
    )
    mode: str = Field(sa_column=Column(String(10), nullable=False))
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class RoleFeatureEntry(SQLModel, table=True):
    """One feature listed by a feature policy.

    A feature has a single action, using it, so the entry has no flags: in an
    allowlist a listed feature is allowed, in a blocklist it is denied.
    """
    __tablename__ = "veloiq_role_feature_entry"
    __table_args__ = (
        UniqueConstraint("policy_id", "feature_key", name="uq_veloiq_role_feature_entry"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    policy_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("veloiq_role_feature_policy.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    feature_key: str = Field(sa_column=Column(String(200), nullable=False))


class RoleAccessAudit(SQLModel, table=True):
    """Audit trail of access-policy changes (AC-A5).

    ``before`` and ``after`` hold the policy as JSON (``null`` when there was
    no policy). ``event`` is a stable code: ``save``, ``delete``,
    ``feature_save``, ``feature_delete`` (feature policies) or a system event
    such as ``role_get_migration``. ``role_id`` is kept as a plain
    integer (no foreign key) so the history survives the role's deletion;
    ``role_name`` records the name at the time of the change.
    """
    __tablename__ = "veloiq_role_access_audit"

    id: Optional[int] = Field(default=None, primary_key=True)
    event: str = Field(sa_column=Column(String(50), nullable=False))
    role_id: Optional[int] = Field(default=None, index=True)
    role_name: str = Field(default="", sa_column=Column(String(100)))
    actor_id: Optional[int] = Field(default=None)
    actor_username: str = Field(default="", sa_column=Column(String(100)))
    before: str = Field(default="null", sa_column=Column(Text))
    after: str = Field(default="null", sa_column=Column(Text))
    created_at: datetime = Field(default_factory=_utcnow)
