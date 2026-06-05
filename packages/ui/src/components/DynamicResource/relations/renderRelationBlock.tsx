import React from "react";
import { Card, Typography } from "antd";
import { getModelTone } from "../../../utils/modelTone";
import type { ModelDef, RelationDef, RelationViewType } from "../types";
import { getRelationLabel } from "../utils/i18n";
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

export const renderRelationBlock = ({
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
    const parentModel = findModelByName(allModels, parentResource);
    const relationTone = getModelTone(relatedModel || relationModel || rel.resource);
    const usesTableBehavior = usesTableRelationBehavior(viewType);
    const isCrosstab = isCrosstabViewType(viewType);
    const allowInlineEdit = viewType === "editable-table" || viewType === "editable-crosstab";
    const crosstabViewMode: "table" | "crosstab" = isCrosstab ? "crosstab" : "table";
    const tableViewVariant: "default" | "totals-details" = viewType === "totals-details" ? "totals-details" : "default";
    const showRelationActions = showActions;
    const showCreateButton = showCreate;
    const layoutPreferenceType = mode === "show" ? "ShowLayout" : "EditLayout";
    const relationLabel = getRelationLabel(rel) || rel.label || rel.relationName || rel.resource || "";
    const title = renderToneTabLabel(relationLabel, relationTone);
    const shouldShowRelatedObjects = relatedModel && rel.otherResource && rel.otherKey;
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

    if (isInlineListView && !polymorphicInfo) {
        return (
            <div style={{ marginBottom: 0 }}>
                <div style={resolvedLayoutStyle}>
                    {showLabel && <div style={resolvedLabelStyle}>{relationLabel}</div>}
                    <div style={resolvedValueStyle}>
                        <RelatedObjectsInlineValues rel={rel} record={record} viewType={viewType as "list" | "csv"} allModels={allModels} />
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
                    model={relationModel}
                    allModels={allModels}
                    filter={{ field: rel.targetKey, operator: "eq", value: getRecordId(record) }}
                    relationConfig={rel}
                    isEmbedded={true}
                    showActions={showRelationActions}
                    showCreate={showCreateButton}
                    layoutPreferenceType={layoutPreferenceType}
                    listViewType="calendar"
                />
            </div>
        );
    }

    if (viewType === "primary") {
        const primaryModel = relatedModel || relationModel;
        const customPageName = mode === "show" ? rel.showCustomPageName : rel.editCustomPageName;
        return (
            <div key={rel.resource} style={{ marginTop: 12 }}>
                {showLabel && <div style={{ ...resolvedLabelStyle, marginBottom: 6 }}>{relationLabel}</div>}
                <RelatedObjectsPrimaryView rel={rel} record={record} model={primaryModel} allModels={allModels} customPageName={customPageName} />
            </div>
        );
    }

    if (viewType === "gallery") {
        const galleryModel = relatedModel || relationModel;
        return (
            <div key={rel.resource} style={{ marginTop: 12 }}>
                {showLabel && <div style={{ ...resolvedLabelStyle, marginBottom: 6 }}>{relationLabel}</div>}
                <RelatedObjectsGallery rel={rel} record={record} relatedModel={galleryModel} allModels={allModels} />
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
            model={relationModel}
            allModels={allModels}
            filter={{ field: rel.targetKey, operator: "eq", value: getRecordId(record) }}
            relationConfig={rel}
            isEmbedded={true}
            showActions={showRelationActions}
            showCreate={showCreateButton}
            layoutPreferenceType={layoutPreferenceType}
            listViewType={isCrosstab ? viewType as "crosstab" | "editable-crosstab" : (usesTableBehavior ? "table" : undefined)}
        />
    );

    const content = rel.isRecursive && relatedModel && rel.otherResource && rel.otherKey ? (
        recursiveFallback
    ) : rel.isRecursive ? (
        <DynamicList
            model={relationModel}
            allModels={allModels}
            filter={{ field: rel.targetKey, operator: "eq", value: getRecordId(record) }}
            relationConfig={rel}
            isEmbedded={true}
            showActions={showRelationActions}
            showCreate={showCreateButton}
            layoutPreferenceType={layoutPreferenceType}
            listViewType={isCrosstab ? viewType as "crosstab" | "editable-crosstab" : (usesTableBehavior ? "table" : undefined)}
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
            model={relationModel}
            allModels={allModels}
            filter={{ field: rel.targetKey, operator: "eq", value: getRecordId(record) }}
            relationConfig={rel}
            isEmbedded={true}
            showActions={showRelationActions}
            showCreate={showCreateButton}
            layoutPreferenceType={layoutPreferenceType}
            listViewType={isCrosstab ? viewType as "crosstab" | "editable-crosstab" : (usesTableBehavior ? "table" : undefined)}
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

    if (viewType === "editable-list" && rel.otherResource && rel.otherKey) {
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
