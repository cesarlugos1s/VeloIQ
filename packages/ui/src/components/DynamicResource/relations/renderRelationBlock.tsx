import React from "react";
import { Card, ConfigProvider, Typography } from "antd";
import {
    updateTemporaryRelationViewType, useTemporaryPageLayoutScope, useTemporaryRelationViewType,
} from "../temporaryLayout/temporaryPageLayoutStore";
import { RelationViewTypeButton, RelationViewTypeSwitchContext, useToolbarSlotCount } from "./RelationViewTypeSwitch";
import { buildRelationBlockId, buildViewStateBlockKey, getRelationIdentityName } from "../viewState/viewStateLayers";
import { getCalendarDateFieldOptions } from "../utils/calendar";
import { getModelTone } from "../../../utils/modelTone";
import type { ModelDef, RelationDef, RelationViewType } from "../types";
import { getFieldLabel, getRelationLabel } from "../utils/i18n";
import { renderToneTabLabel } from "../utils/colors";
import { findModelByName, getPolymorphicReferenceInfo, getRecordId } from "../utils/model";
import {
    DEFAULT_SHOW_RELATION_ROW_ACTIONS,
    DEFAULT_EDIT_RELATION_ROW_ACTIONS,
    DEFAULT_RELATION_CREATE_ACTIONS,
    getRelationViewType,
    isCrosstabViewType,
    isInlineRelationViewType,
    usesTableRelationBehavior,
} from "./helpers";
import { ddlTrace } from "../utils/ddlTrace";
import { RelatedObjectsInlineValues } from "./RelatedObjectsInlineValues";
import { RelatedObjectsCalendar } from "./RelatedObjectsCalendar";
import { RelatedObjectsPrimaryView } from "./RelatedObjectsPrimaryView";
import { RelatedObjectsGallery } from "./RelatedObjectsGallery";
import { RelatedObjectsEditableList } from "./RelatedObjectsEditableList";
import { RelatedObjectsEditableCsv } from "./RelatedObjectsEditableCsv";
import { PolymorphicRelatedObjectsTable, RelatedObjectsTable } from "./RelatedObjectsTable";
import { RelatedObjectSingleSelect } from "./RelatedObjectSingleSelect";
import { MillerBrowserLayout } from "./MillerBrowserLayout";
import { DynamicList } from "../../DynamicResource";

const { Title } = Typography;

const renderRelationBlockContent = ({
    rel,
    relationModel,
    relatedModel,
    record,
    mode,
    parentResource,
    allModels,
    showLabel = true,
    showActions = mode === "edit" ? DEFAULT_EDIT_RELATION_ROW_ACTIONS : DEFAULT_SHOW_RELATION_ROW_ACTIONS,
    showCreate = DEFAULT_RELATION_CREATE_ACTIONS,
    relationViewTypeDefaults,
    labelStyle,
    valueStyle,
    fieldLayoutStyle,
}: {
    rel: RelationDef;
    relationModel: ModelDef;
    relatedModel?: ModelDef;
    record: any;
    mode: "show" | "edit";
    parentResource: string;
    allModels?: ModelDef[];
    showLabel?: boolean;
    showActions?: boolean;
    showCreate?: boolean;
    relationViewTypeDefaults?: { show: RelationViewType; edit: RelationViewType };
    labelStyle?: React.CSSProperties;
    valueStyle?: React.CSSProperties;
    fieldLayoutStyle?: React.CSSProperties;
}) => {
    const viewType = getRelationViewType(rel, mode, relationViewTypeDefaults);
    ddlTrace("renderRelationBlock viewType", { rel: rel.relationName || rel.resource || "?", mode, viewType, relShowVT: (rel as any).showViewType ?? null, relEditVT: (rel as any).editViewType ?? null, defaults: relationViewTypeDefaults, m2m: !!(relatedModel && rel.otherResource && rel.otherKey), hasRelatedModel: !!relatedModel, hasOtherResource: !!rel.otherResource, hasOtherKey: !!rel.otherKey });
    const parentModel = findModelByName(allModels, parentResource);
    const relationTone = getModelTone(relatedModel || relationModel || rel.resource);
    const usesTableBehavior = usesTableRelationBehavior(viewType);
    const isCrosstab = isCrosstabViewType(viewType);
    const allowInlineEdit = viewType === "editable-table" || viewType === "editable-crosstab";
    const crosstabViewMode: "table" | "crosstab" | "kanban" = isCrosstab ? "crosstab" : viewType === "kanban" ? "kanban" : "table";
    const tableViewVariant: "default" | "totals-details" = viewType === "totals-details" ? "totals-details" : "default";
    const showRelationActions = showActions;
    const showCreateButton = showCreate;
    const layoutPreferenceType = mode === "show" ? "ShowLayout" : "EditLayout";
    const baseRelationLabel = getRelationLabel(rel) || rel.label || rel.relationName || rel.resource || "";
    // Several relations of a page can point at one resource through different keys; the key's
    // field label tells their titles apart.
    const hasSiblingRelationToSameResource = (parentModel?.relations || []).filter(
        (other) => other.resource === rel.resource && !other.relationName,
    ).length > 1;
    const linkField = hasSiblingRelationToSameResource && !rel.relationName
        ? relationModel.fields.find((field) => field.key === rel.targetKey)
        : undefined;
    const relationLabel = linkField ? `${baseRelationLabel} (${getFieldLabel(linkField)})` : baseRelationLabel;
    const title = renderToneTabLabel(relationLabel, relationTone);
    const shouldShowRelatedObjects = relatedModel && rel.otherResource && rel.otherKey;
    // View type of the DynamicList that shows a one-to-many relation: table-like
    // types as they are, and the editable table / list, which edit rows inline.
    const dynamicListViewType = isCrosstab
        ? viewType as "crosstab" | "editable-crosstab"
        : usesTableBehavior
            ? viewType as "table" | "totals-details"
            : (viewType === "editable-table" || viewType === "editable-list" || viewType === "kanban") ? viewType : undefined;
    const polymorphicInfo = getPolymorphicReferenceInfo(rel, relationModel, allModels);
    const isInlineListView = isInlineRelationViewType(viewType);
    const resolvedLabelStyle: React.CSSProperties = labelStyle ?? {
        flex: "0 0 200px",
        fontSize: 12,
        fontWeight: 600,
        color: relationTone.text,
        background: "transparent",
        borderRadius: 6,
        padding: "2px 8px",
        display: "inline-flex",
        alignItems: "center",
        margin: 0,
    };
    const resolvedValueStyle: React.CSSProperties = valueStyle ?? {
        flex: "1 0 200px",
        padding: "2px 4px",
        overflowWrap: "anywhere",
        lineHeight: 1.15,
    };
    const resolvedLayoutStyle: React.CSSProperties = fieldLayoutStyle ?? {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-start",
        gap: "4px 8px",
    };

    if (rel.maxItems === 1 && rel.otherResource && rel.otherKey) {
        const isRequired = (rel.minItems ?? 0) >= 1;
        const singleLabel = showLabel ? (
            <div style={resolvedLabelStyle}>
                {isRequired && <span style={{ color: "#ff4d4f", marginRight: 4 }}>*</span>}
                {relationLabel}
            </div>
        ) : null;
        if (mode === "edit") {
            return (
                <div style={{ marginBottom: 0 }}>
                    <div style={resolvedLayoutStyle}>
                        {singleLabel}
                        <div style={resolvedValueStyle}>
                            <RelatedObjectSingleSelect
                                rel={rel}
                                record={record}
                                allModels={allModels}
                                required={isRequired}
                            />
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <div style={{ marginBottom: 0 }}>
                <div style={resolvedLayoutStyle}>
                    {singleLabel}
                    <div style={resolvedValueStyle}>
                        <RelatedObjectsInlineValues rel={rel} record={record} viewType="csv" allModels={allModels} />
                    </div>
                </div>
            </div>
        );
    }

    if (viewType === "editable-csv" || viewType === "read-and-edit-csv") {
        if (rel.otherResource && rel.otherKey) {
            return (
                <div style={{ marginBottom: 0 }}>
                    <div style={resolvedLayoutStyle}>
                        {showLabel && <div style={resolvedLabelStyle}>{relationLabel}</div>}
                        <div style={resolvedValueStyle}>
                            <RelatedObjectsEditableCsv rel={rel} record={record} allModels={allModels} />
                        </div>
                    </div>
                </div>
            );
        }
        // Non-M2M: fall through to DynamicList (content) as the closest editable fallback
    }

    if (viewType === "read-and-edit-list") {
        if (rel.otherResource && rel.otherKey) {
            return (
                <div style={{ marginBottom: 16, boxShadow: `0 8px 20px -16px ${relationTone.shadow}` }}>
                    <div style={{ ...resolvedLabelStyle, marginBottom: 4 }}>{showLabel ? relationLabel : null}</div>
                    <RelatedObjectsEditableList rel={rel} record={record} allModels={allModels} />
                </div>
            );
        }
        // Non-M2M: fall through to inline list view
        return (
            <div style={{ marginBottom: 0 }}>
                <div style={resolvedLayoutStyle}>
                    {showLabel && <div style={resolvedLabelStyle}>{relationLabel}</div>}
                    <div style={resolvedValueStyle}>
                        <RelatedObjectsInlineValues rel={rel} record={record} viewType="list" allModels={allModels} />
                    </div>
                </div>
            </div>
        );
    }

    // Skip inline for "editable-csv" — it falls through to DynamicList (content)
    // as the closest editable fallback for non-M2M relations.
    if (isInlineListView && !polymorphicInfo && viewType !== "editable-csv") {
        return (
            <div style={{ marginBottom: 0 }}>
                <div style={resolvedLayoutStyle}>
                    {showLabel && <div style={resolvedLabelStyle}>{relationLabel}</div>}
                    <div style={resolvedValueStyle}>
                        <RelatedObjectsInlineValues rel={rel} record={record} viewType={(viewType === "read-and-edit-csv" || viewType === "csv") ? "csv" : "list"} allModels={allModels} />
                    </div>
                </div>
            </div>
        );
    }

    if (viewType === "tree" || viewType === "tree-details") {
        return (
            <div key={rel.resource} style={{ marginTop: 12 }}>
                {showLabel && <div style={{ ...resolvedLabelStyle, marginBottom: 6 }}>{relationLabel}</div>}
                <MillerBrowserLayout
                    rel={rel}
                    record={record}
                    allModels={allModels}
                    showDetails={viewType === "tree-details"}
                />
            </div>
        );
    }

    if (viewType === "calendar") {
        if (shouldShowRelatedObjects) {
            return (
                <div key={rel.resource} style={{ marginTop: 12 }}>
                    {showLabel && <div style={{ ...resolvedLabelStyle, marginBottom: 6 }}>{relationLabel}</div>}
                    <RelatedObjectsCalendar rel={rel} record={record} relatedModel={relatedModel} allModels={allModels} />
                </div>
            );
        }
        return (
            <div key={rel.resource} style={{ marginTop: 12 }}>
                {showLabel && <div style={{ ...resolvedLabelStyle, marginBottom: 6 }}>{relationLabel}</div>}
                <DynamicList
                key={`${(rel as any).relationName || rel.resource || "dl"}-ddl-${(window as any).__veloiq_dataDetailLevel ?? 0}`}
                    model={relationModel}
                    allModels={allModels}
                    filter={{ field: rel.targetKey, operator: "eq", value: getRecordId(record) }}
                    relationConfig={rel}
                    isEmbedded={true}
                    showActions={showRelationActions}
                    showCreate={showCreateButton}
                    layoutPreferenceType={layoutPreferenceType}
                    listViewType="calendar"
                    defaultListVisible={rel.defaultListVisible}
                />
            </div>
        );
    }

    if (viewType === "primary" || viewType === "primary-carousel") {
        const primaryModel = relatedModel || relationModel;
        const customPageName = mode === "show" ? rel.showCustomPageName : rel.editCustomPageName;
        return (
            <div key={rel.resource} style={{ marginTop: 12 }}>
                {showLabel && <div style={{ ...resolvedLabelStyle, marginBottom: 6 }}>{relationLabel}</div>}
                <RelatedObjectsPrimaryView rel={rel} record={record} model={primaryModel} allModels={allModels} customPageName={customPageName} layout={viewType === "primary-carousel" ? "carousel" : "scroll"} />
            </div>
        );
    }

    if (viewType === "gallery" || viewType === "image") {
        const galleryModel = relatedModel || relationModel;
        return (
            <div key={rel.resource} style={{ marginTop: 12 }}>
                {showLabel && <div style={{ ...resolvedLabelStyle, marginBottom: 6 }}>{relationLabel}</div>}
                <RelatedObjectsGallery rel={rel} record={record} relatedModel={galleryModel} allModels={allModels} variant={viewType} />
            </div>
        );
    }
    const recursiveFallback = relatedModel && rel.otherResource && rel.otherKey ? (
        <RelatedObjectsTable
            rel={rel}
            record={record}
            relatedModel={relatedModel}
            parentModel={parentModel}
            showActions={showRelationActions}
            showCreate={showCreateButton}
            title={allowInlineEdit ? undefined : title}
            allowInlineEdit={allowInlineEdit}
            layoutPreferenceType={layoutPreferenceType}
            viewVariant={tableViewVariant}
            viewMode={crosstabViewMode}
            allModels={allModels}
        />
    ) : (
        <DynamicList
                key={`${(rel as any).relationName || rel.resource || "dl"}-ddl-${(window as any).__veloiq_dataDetailLevel ?? 0}`}
            model={relationModel}
            allModels={allModels}
            filter={{ field: rel.targetKey, operator: "eq", value: getRecordId(record) }}
            relationConfig={rel}
            isEmbedded={true}
            showActions={showRelationActions}
            showCreate={showCreateButton}
            layoutPreferenceType={layoutPreferenceType}
            listViewType={dynamicListViewType}
                    defaultListVisible={rel.defaultListVisible}
        />
    );

    const content = rel.isRecursive && relatedModel && rel.otherResource && rel.otherKey ? (
        recursiveFallback
    ) : rel.isRecursive ? (
        <DynamicList
                key={`${(rel as any).relationName || rel.resource || "dl"}-ddl-${(window as any).__veloiq_dataDetailLevel ?? 0}`}
            model={relationModel}
            allModels={allModels}
            filter={{ field: rel.targetKey, operator: "eq", value: getRecordId(record) }}
            relationConfig={rel}
            isEmbedded={true}
            showActions={showRelationActions}
            showCreate={showCreateButton}
            layoutPreferenceType={layoutPreferenceType}
            listViewType={dynamicListViewType}
                    defaultListVisible={rel.defaultListVisible}
        />
    ) : polymorphicInfo ? (
        <PolymorphicRelatedObjectsTable
            rel={rel}
            record={record}
            relationModel={relationModel}
            parentModel={parentModel}
            allModels={allModels || []}
            showActions={showRelationActions}
            showCreate={showCreateButton}
            allowInlineEdit={allowInlineEdit}
            layoutPreferenceType={layoutPreferenceType}
            viewVariant={tableViewVariant}
            viewMode={crosstabViewMode}
        />
    ) : shouldShowRelatedObjects ? (
        <RelatedObjectsTable
            rel={rel}
            record={record}
            relatedModel={relatedModel}
            parentModel={parentModel}
            showActions={showRelationActions}
            showCreate={showCreateButton}
            title={allowInlineEdit ? undefined : title}
            allowInlineEdit={allowInlineEdit}
            layoutPreferenceType={layoutPreferenceType}
            viewVariant={tableViewVariant}
            viewMode={crosstabViewMode}
            allModels={allModels}
        />
    ) : (
        <DynamicList
                key={`${(rel as any).relationName || rel.resource || "dl"}-ddl-${(window as any).__veloiq_dataDetailLevel ?? 0}`}
            model={relationModel}
            allModels={allModels}
            filter={{ field: rel.targetKey, operator: "eq", value: getRecordId(record) }}
            relationConfig={rel}
            isEmbedded={true}
            showActions={showRelationActions}
            showCreate={showCreateButton}
            layoutPreferenceType={layoutPreferenceType}
            listViewType={dynamicListViewType}
                    defaultListVisible={rel.defaultListVisible}
        />
    );

    if (viewType === "editable-table" || isCrosstab) {
        return (
            <Card
                key={rel.resource}
                size="small"
                title={title}
                variant="borderless"
                style={{ marginBottom: 16, boxShadow: `0 8px 20px -16px ${relationTone.shadow}` }}
                styles={{
                    header: {
                        background: "transparent",
                        color: relationTone.text,
                    },
                    body: { paddingTop: 8 },
                }}
            >
                {content}
            </Card>
        );
    }

    if (viewType === "editable-list") {
        if (rel.otherResource && rel.otherKey) {
            return (
                <Card
                    key={rel.resource}
                    size="small"
                    title={title}
                    variant="borderless"
                    style={{ marginBottom: 16, boxShadow: `0 8px 20px -16px ${relationTone.shadow}` }}
                    styles={{
                        header: {
                            background: "transparent",
                            color: relationTone.text,
                        },
                        body: { paddingTop: 8 },
                    }}
                >
                    <RelatedObjectsEditableList rel={rel} record={record} allModels={allModels} />
                </Card>
            );
        }
        // Non-M2M: fall through to DynamicList (content) as the closest editable fallback
    }

    if (shouldShowRelatedObjects) {
        return (
            <div key={rel.resource} style={{ marginTop: 12 }}>
                {content}
            </div>
        );
    }

    return (
        <div key={rel.resource} style={{ marginTop: 12 }}>
            <Title level={5} style={{ color: relationTone.text, margin: 0 }}>{title}</Title>
            {content}
        </div>
    );
};

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

/** View types a user may pick for a relation block for now; the editable ones only on edit pages. */
const RELATION_VIEW_TYPES_SHOWN = ["table", "totals-details", "crosstab", "list", "csv", "kanban", "gallery", "image", "calendar", "primary", "primary-carousel"];
const RELATION_VIEW_TYPES_EDIT_ONLY = ["editable-table", "editable-crosstab", "editable-list", "editable-csv"];

type RelationBlockArguments = Parameters<typeof renderRelationBlockContent>[0];

/**
 * One relation block of a record page. Shows the block in the configured view
 * type, or in the one the user picked with the small selector above it. The
 * choice is temporary: it is kept until the page is reloaded and never saved.
 */
const RelationBlockHost: React.FC<{ blockArguments: RelationBlockArguments }> = ({ blockArguments }) => {
    const { rel, mode, relatedModel, relationModel, relationViewTypeDefaults } = blockArguments;
    const scope = useTemporaryPageLayoutScope();
    const isSingleItemRelation = rel.maxItems === 1 && Boolean(rel.otherResource) && Boolean(rel.otherKey);
    const blockKey = scope && !isSingleItemRelation
        ? buildViewStateBlockKey(scope.pageKey, buildRelationBlockId(getRelationIdentityName(rel, (relatedModel || relationModel).name)))
        : null;
    const temporaryViewType = useTemporaryRelationViewType(blockKey);
    const configuredViewType = getRelationViewType(rel, mode, relationViewTypeDefaults);
    const effectiveViewType = (temporaryViewType || configuredViewType) as RelationViewType;
    const effectiveRel: RelationDef = temporaryViewType
        ? { ...rel, ...(mode === "show" ? { showViewType: effectiveViewType } : { editViewType: effectiveViewType }) }
        : rel;
    const block = renderRelationBlockContent(temporaryViewType ? { ...blockArguments, rel: effectiveRel } : blockArguments);

    const hasCalendarDate = getCalendarDateFieldOptions((relatedModel || relationModel).fields).length > 0;
    const offeredTypes = [
        ...RELATION_VIEW_TYPES_SHOWN,
        ...(mode === "edit" ? RELATION_VIEW_TYPES_EDIT_ONLY : []),
    ].filter((token) => token !== "calendar" || hasCalendarDate);
    // A configured type outside the list (a tree, a single-select) is left alone.
    const canSwitch = blockKey !== null && offeredTypes.includes(configuredViewType);
    const { hasToolbarSlot, registerToolbarSlot } = useToolbarSlotCount();
    const switchContext = React.useMemo(() => ({
        registerToolbarSlot,
        button: canSwitch ? (
            <RelationViewTypeButton
                temporaryViewType={temporaryViewType}
                offeredViewTypes={offeredTypes}
                onChange={(viewType) => updateTemporaryRelationViewType(blockKey as string, viewType)}
            />
        ) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [registerToolbarSlot, canSwitch, temporaryViewType, offeredTypes.join("|"), blockKey]);
    // A view without a toolbar gets the button floating at the top right, so no row is added.
    const wrapped = canSwitch ? (
        <RelationViewTypeSwitchContext.Provider value={switchContext}>
            <div style={{ position: "relative" }}>
                {!hasToolbarSlot && <div style={{ position: "absolute", top: 0, right: 0, zIndex: 2 }}>{switchContext.button}</div>}
                {block}
            </div>
        </RelationViewTypeSwitchContext.Provider>
    ) : block;
    if (mode !== "show") return wrapped;
    return <ConfigProvider componentDisabled={false}>{wrapped}</ConfigProvider>;
};

/**
 * A relation's block on a record page. On a show page the relation's rows are
 * other records, governed by their own permissions, so the block does not
 * inherit the disabled state of a read-only record form around it: its views,
 * totals/details switch and navigation stay usable on records the user may
 * only read. On an edit page it keeps the form's disabled state.
 */
export const renderRelationBlock = (relationBlockArguments: RelationBlockArguments) => (
    // Keyed like the blocks themselves, since some pages collect the blocks in arrays.
    <RelationBlockHost key={`${relationBlockArguments.rel.relationName || relationBlockArguments.rel.resource}|${relationBlockArguments.rel.targetKey}|${relationBlockArguments.rel.label}`} blockArguments={relationBlockArguments} />
);
