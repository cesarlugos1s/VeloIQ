from sqladmin import ModelView
from app.modules.team.models import TeamMember


class TeamMemberAdmin(ModelView, model=TeamMember):
    column_list = [TeamMember.id, TeamMember.name, TeamMember.email, TeamMember.role]
    column_searchable_list = [TeamMember.name, TeamMember.email]
    icon = "fa-solid fa-users"
