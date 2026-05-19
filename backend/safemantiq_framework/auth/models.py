"""Auth models: User, Role, Tenant.

Adapted from the JuiceMantics ``authobjs`` module but using plain ``id`` primary
keys and ``safem_`` table prefixes so they work on both SQLite and PostgreSQL
without any dependency on CubicWeb-style conventions.

ReBAC hierarchy permission links (bohierarchy, itemhierarchy, custhierarchy) are
intentionally omitted — they depend on JuiceMantics-specific models.
"""
from typing import ClassVar, Dict, List, Literal, Optional

from sqlalchemy import Column, ForeignKey, String, Text
from sqlmodel import Field, Relationship, SQLModel


# ---------------------------------------------------------------------------
# Junction tables (M2M links)
# ---------------------------------------------------------------------------

class user_has_role_link(SQLModel, table=True):
    __tablename__ = "safem_user_has_role"
    user_id: int = Field(
        sa_column=Column(ForeignKey("safem_user.id", ondelete="CASCADE"), primary_key=True)
    )
    role_id: int = Field(
        sa_column=Column(ForeignKey("safem_role.id", ondelete="CASCADE"), primary_key=True)
    )


class user_has_tenant_link(SQLModel, table=True):
    __tablename__ = "safem_user_has_tenant"
    user_id: int = Field(
        sa_column=Column(ForeignKey("safem_user.id", ondelete="CASCADE"), primary_key=True)
    )
    tenant_id: int = Field(
        sa_column=Column(ForeignKey("safem_tenant.id", ondelete="CASCADE"), primary_key=True)
    )


# ---------------------------------------------------------------------------
# Entity models
# ---------------------------------------------------------------------------

class Role(SQLModel, table=True):
    """Standard RBAC role with configurable HTTP-method permissions."""
    __tablename__ = "safem_role"

    # allowed_methods and is_preset are Admin-only — other roles must not read or write them.
    __safem_field_permissions__: ClassVar[Dict[str, Dict]] = {
        "allowed_methods": {"read_roles": ["Admin"], "write_roles": ["Admin"]},
        "is_preset":       {"read_roles": ["Admin"], "write_roles": ["Admin"]},
    }

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(sa_column=Column(String(50), unique=True, nullable=False))
    description: str = Field(default="", sa_column=Column(Text))
    # JSON list of allowed HTTP methods, e.g. '["GET","POST","PUT","PATCH","DELETE"]'
    allowed_methods: str = Field(default="[]", sa_column=Column(Text))
    is_preset: bool = Field(default=False)

    users: List["User"] = Relationship(
        back_populates="roles",
        link_model=user_has_role_link,
    )

    def __str__(self) -> str:
        return self.name


class Tenant(SQLModel, table=True):
    """Multi-tenant environment entry."""
    __tablename__ = "safem_tenant"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(sa_column=Column(String(100), unique=True, nullable=False))
    domain: str = Field(default="", sa_column=Column(String(100)))
    status: Literal["Active", "Suspended"] = Field(
        default="Active", sa_column=Column(String(20))
    )

    users: List["User"] = Relationship(
        back_populates="tenants",
        link_model=user_has_tenant_link,
    )

    def __str__(self) -> str:
        return self.name


class User(SQLModel, table=True):
    """Authenticated application user."""
    __tablename__ = "safem_user"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(
        sa_column=Column(String(100), unique=True, index=True, nullable=False)
    )
    email: str = Field(default="", sa_column=Column(String(255)))
    first_name: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    last_name: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    status: Literal["Active", "Inactive", "Suspended"] = Field(
        default="Active", sa_column=Column(String(20))
    )
    password_hash: Optional[str] = Field(
        default=None, sa_column=Column(String(255))
    )

    roles: List[Role] = Relationship(
        back_populates="users",
        link_model=user_has_role_link,
    )
    tenants: List[Tenant] = Relationship(
        back_populates="users",
        link_model=user_has_tenant_link,
    )

    def __str__(self) -> str:
        return self.username
