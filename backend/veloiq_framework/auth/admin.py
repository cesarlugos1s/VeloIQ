"""SQLAdmin views for User, Role, and Tenant."""
from sqladmin import ModelView

from veloiq_framework.auth.models import Role, Tenant, User


class UserAdmin(ModelView, model=User):
    name_plural = "Users"
    category = "Access Control"
    icon = "fa-solid fa-shield-halved"

    column_list = [User.id, User.username, User.email, User.first_name, User.last_name, User.status]
    column_details_exclude_list = [User.password_hash]
    column_searchable_list = [User.username, User.email, User.first_name, User.last_name, User.status]
    column_sortable_list = [User.id, User.username, User.email, User.status]

    form_columns = [
        User.username,
        User.email,
        User.first_name,
        User.last_name,
        User.status,
        User.roles,
        User.tenants,
    ]


class RoleAdmin(ModelView, model=Role):
    name_plural = "Roles"
    category = "Access Control"
    icon = "fa-solid fa-shield-halved"

    column_list = [Role.id, Role.name, Role.description, Role.allowed_methods, Role.is_preset]
    column_searchable_list = [Role.name, Role.description]
    column_sortable_list = [Role.id, Role.name, Role.is_preset]

    form_columns = [Role.name, Role.description, Role.allowed_methods, Role.is_preset]


class TenantAdmin(ModelView, model=Tenant):
    name_plural = "Tenants"
    category = "Access Control"
    icon = "fa-solid fa-shield-halved"

    column_list = [Tenant.id, Tenant.name, Tenant.domain, Tenant.status]
    column_searchable_list = [Tenant.name, Tenant.domain, Tenant.status]
    column_sortable_list = [Tenant.id, Tenant.name, Tenant.status]

    form_columns = [Tenant.name, Tenant.domain, Tenant.status]


AUTH_ADMIN_VIEWS = [UserAdmin, RoleAdmin, TenantAdmin]
