"""``veloiq generate`` for external portals: page schemas with only what the portal's roles read."""
from typing import List, Optional

from sqlmodel import Field, SQLModel

from veloiq_framework import jm_relationship, model_access, veloiq_field
from veloiq_framework.api_schema_gen import _build_ts_schema_lines
from veloiq_framework.portals.generate_portal_page_schemas import (
    generate_portal_page_schemas,
    portal_navigation_config_file_name,
)
from veloiq_framework.portals.portal_role_read_access import (
    field_readable_by_roles,
    model_readable_by_roles,
    tablename_readable_by_roles,
)


class PortalSchemaTestOffer(SQLModel, table=True):
    """An offer a shopper sees, with an internal cost they must not."""
    __tablename__ = "portal_schema_test_offer"
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(description="Offer title")
    internal_cost: float = veloiq_field(default=0.0, read_roles=["Admin", "Buyer"])
    reviews: List["PortalSchemaTestReview"] = jm_relationship(back_populates="offer")
    audits: List["PortalSchemaTestAudit"] = jm_relationship(back_populates="offer")


class PortalSchemaTestReview(SQLModel, table=True):
    __tablename__ = "portal_schema_test_review"
    id: Optional[int] = Field(default=None, primary_key=True)
    offer_id: int = Field(foreign_key="portal_schema_test_offer.id")
    offer: Optional[PortalSchemaTestOffer] = jm_relationship(back_populates="reviews")


@model_access(Shopper=[])
class PortalSchemaTestAudit(SQLModel, table=True):
    __tablename__ = "portal_schema_test_audit"
    id: Optional[int] = Field(default=None, primary_key=True)
    offer_id: int = Field(foreign_key="portal_schema_test_offer.id")
    offer: Optional[PortalSchemaTestOffer] = jm_relationship(back_populates="audits")


def test_read_access_follows_model_access_and_field_read_roles():
    assert model_readable_by_roles(PortalSchemaTestOffer, ["Shopper"])
    assert not model_readable_by_roles(PortalSchemaTestAudit, ["Shopper"])
    # A role @model_access doesn't mention keeps its global permissions; any role is enough.
    assert tablename_readable_by_roles("portal_schema_test_audit", ["Buyer"])
    assert tablename_readable_by_roles("portal_schema_test_audit", ["Shopper", "Buyer"])
    assert not field_readable_by_roles(PortalSchemaTestOffer, "internal_cost", ["Shopper"])
    assert field_readable_by_roles(PortalSchemaTestOffer, "internal_cost", ["Buyer"])
    assert field_readable_by_roles(PortalSchemaTestOffer, "title", ["Shopper"])


def test_portal_schema_leaves_out_unreadable_fields_and_relations():
    app_schema = "\n".join(_build_ts_schema_lines("offers", [PortalSchemaTestOffer]))
    portal_schema = "\n".join(_build_ts_schema_lines("offers", [PortalSchemaTestOffer], portal_roles=["Shopper"]))
    assert 'key: "internal_cost"' in app_schema and 'resource: "portal_schema_test_audit"' in app_schema
    assert 'key: "internal_cost"' not in portal_schema
    assert 'resource: "portal_schema_test_audit"' not in portal_schema
    assert 'key: "title"' in portal_schema and 'resource: "portal_schema_test_review"' in portal_schema


def test_generate_writes_each_portal_schemas_and_creates_its_menu_once(tmp_path):
    (tmp_path / "veloiq.toml").write_text(
        '[portals.store]\nfolder = "ext/store"\nroles = ["Shopper"]\n'
        '[portals.missing]\nfolder = "ext/missing"\nroles = ["Shopper"]\n'
    )
    (tmp_path / "ext" / "store").mkdir(parents=True)
    module_entity_models = {
        "offers": [PortalSchemaTestOffer, PortalSchemaTestReview],
        "audits": [PortalSchemaTestAudit],
    }

    generate_portal_page_schemas(tmp_path, module_entity_models)

    portal_src = tmp_path / "ext" / "store" / "src"
    offers_dir = portal_src / "pages" / "offers"
    assert {f.name for f in offers_dir.iterdir()} == {"offersSchema.gen.ts", "offersSchema.manual.ts", "offersSchema.ts"}
    assert 'portal "store" (roles: Shopper)' in (offers_dir / "offersSchema.gen.ts").read_text()
    # A module without readable models gets no pages and no registration.
    assert not (portal_src / "pages" / "audits").exists()
    registrations = (portal_src / "portalModels.gen.ts").read_text()
    assert 'moduleName: "offers"' in registrations and "audits" not in registrations
    navigation_file = portal_src / portal_navigation_config_file_name("store")
    assert "portal_schema_test_offer" in navigation_file.read_text()
    # A portal whose folder doesn't exist is skipped.
    assert not (tmp_path / "ext" / "missing").exists()

    # The site's own menu and overrides survive the next generate.
    navigation_file.write_text("[]")
    (offers_dir / "offersSchema.manual.ts").write_text("// the site's overrides")
    generate_portal_page_schemas(tmp_path, module_entity_models)
    assert navigation_file.read_text() == "[]"
    assert (offers_dir / "offersSchema.manual.ts").read_text() == "// the site's overrides"
