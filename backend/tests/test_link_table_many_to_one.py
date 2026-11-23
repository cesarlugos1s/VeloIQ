"""A many-to-one relation stored in a link table is read and written like a foreign key."""
from typing import List, Optional

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlalchemy import Column, Integer
from sqlmodel import Field, Session, SQLModel, create_engine, select

from veloiq_framework import jm_relationship
from veloiq_framework.analyze import reference_titles_for
from veloiq_framework.api_schema_gen import _build_ts_schema_lines
from veloiq_framework.crud import create_crud_router, read_list_rows, reference_models_for
from veloiq_framework.db import get_session
from veloiq_framework.link_table_many_to_one import link_table_many_to_one_relations


class LtmoStockItem(SQLModel, table=True):
    __tablename__ = "ltmo_stock_item"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str


class LtmoStockPlace(SQLModel, table=True):
    __tablename__ = "ltmo_stock_place"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str


class LtmoInventoryItemLink(SQLModel, table=True):
    __tablename__ = "ltmo_inventory_item_link"
    inventory_id: Optional[int] = Field(default=None, foreign_key="ltmo_inventory.id", primary_key=True)
    item_id: Optional[int] = Field(default=None, foreign_key="ltmo_stock_item.id", primary_key=True)


class LtmoInventoryPlaceLink(SQLModel, table=True):
    __tablename__ = "ltmo_inventory_place_link"
    inventory_id: Optional[int] = Field(default=None, foreign_key="ltmo_inventory.id", primary_key=True)
    place_id: Optional[int] = Field(default=None, foreign_key="ltmo_stock_place.id", primary_key=True)


class LtmoInventory(SQLModel, table=True):
    __tablename__ = "ltmo_inventory"
    id: Optional[int] = Field(default=None, primary_key=True)
    on_hand: int = 0
    item: List[LtmoStockItem] = jm_relationship(link_model=LtmoInventoryItemLink, max_items=1, min_items=1)
    # No max_items: a genuine many-to-many relation, left as it is.
    places: List[LtmoStockPlace] = jm_relationship(link_model=LtmoInventoryPlaceLink)


@pytest.fixture
def engine():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        session.add_all([LtmoStockItem(name="Widget"), LtmoStockItem(name="Gadget"), LtmoStockPlace(name="North")])
        session.commit()
    return engine


@pytest.fixture
def client(engine):
    app = FastAPI()

    def session_for_request():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = session_for_request
    app.include_router(create_crud_router(LtmoInventory))
    return TestClient(app)


def test_only_relations_allowing_one_related_row_are_found():
    relations = link_table_many_to_one_relations(LtmoInventory)
    assert [relation.field_key for relation in relations] == ["item"]
    assert relations[0].related_model is LtmoStockItem
    assert relations[0].is_required


def test_the_related_row_is_selected_on_create_and_read_back_on_list_and_get(client):
    created = client.post("/ltmo_inventory", json={"on_hand": 5, "item": 1})
    assert created.status_code == 201, created.text
    assert created.json()["item"] == 1
    client.post("/ltmo_inventory", json={"on_hand": 7})

    rows = client.get("/ltmo_inventory").json()
    assert {row["on_hand"]: row["item"] for row in rows} == {5: 1, 7: None}
    assert client.get(f"/ltmo_inventory/{created.json()['id']}").json()["item"] == 1


def test_update_replaces_the_related_row_and_an_empty_value_clears_it(client):
    inventory_id = client.post("/ltmo_inventory", json={"on_hand": 1, "item": 1}).json()["id"]

    changed = client.patch(f"/ltmo_inventory/{inventory_id}", json={"item": "2"})
    assert changed.status_code == 200, changed.text
    assert changed.json()["item"] == 2

    cleared = client.put(f"/ltmo_inventory/{inventory_id}", json={"on_hand": 3, "item": ""})
    assert cleared.json()["item"] is None and cleared.json()["on_hand"] == 3
    assert client.get(f"/ltmo_inventory/{inventory_id}").json()["item"] is None


def test_an_update_without_the_relation_leaves_it_unchanged(client):
    inventory_id = client.post("/ltmo_inventory", json={"on_hand": 1, "item": 2}).json()["id"]
    client.patch(f"/ltmo_inventory/{inventory_id}", json={"on_hand": 9})
    assert client.get(f"/ltmo_inventory/{inventory_id}").json()["item"] == 2


def test_the_relation_counts_as_a_reference_for_analysis_and_row_reads(engine):
    assert reference_models_for(LtmoInventory)["item"] is LtmoStockItem
    with Session(engine) as session:
        session.add(LtmoInventory(on_hand=1))
        session.commit()
        rows = read_list_rows(LtmoInventory, request=_AnonymousRequest(), session=session)
    assert rows[0]["item"] is None


class _AnonymousRequest:
    class state:
        user = None


def test_the_generated_schema_has_a_reference_field_for_the_relation_only():
    lines = _build_ts_schema_lines("ltmo", [LtmoInventory])
    schema = "\n".join(lines)
    assert 'key: "item", label: "Item", type: "string", reference: "ltmo_stock_item", viaLinkTable: true, required: true' in schema
    assert 'key: "places"' not in schema


class LtmoRenamedKeyPlace(SQLModel, table=True):
    """A model whose key attribute is not named like its column, as in the JuiceMantics models."""
    __tablename__ = "ltmo_renamed_key_place"
    eid: Optional[int] = Field(default=None, sa_column=Column("cw_eid", Integer, primary_key=True))
    name: str


def test_reference_titles_are_read_by_the_key_attribute_not_its_column_name(engine):
    with Session(engine) as session:
        session.add(LtmoRenamedKeyPlace(name="Dock"))
        session.commit()
        place_id = session.exec(select(LtmoRenamedKeyPlace)).one().eid
        titles = reference_titles_for([{"place": place_id}], {"place": LtmoRenamedKeyPlace}, session,
                                      lambda record: record.name)
    assert titles == {"place": {str(place_id): "Dock"}}
