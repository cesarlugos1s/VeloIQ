import type { ModelDef } from "../components/DynamicResource/types";

export const helpSystemModels: ModelDef[] = [
    {
        name: "HelpDocument",
        label: "Help Document",
        resource: "veloiq_help_document",
        pkField: "id",
        module: "help",
        fields: [
            { key: "id", label: "ID", type: "number", isPk: true },
            {
                key: "page_key",
                label: "Page Key",
                type: "string",
                required: true,
                unique: true,
                description: "e.g. \"task:list\", \"task:show\", \"task:edit\", \"task:create\", \"task:dashboard-cell\", \"dashboard-tab:<tab id>\", or the fixed \"_dashboard:main\" for the Dashboard page itself",
            },
            { key: "title", label: "Title", type: "string", required: true },
            {
                key: "body",
                label: "Body",
                type: "string",
                showViewType: "read-only-markdown",
                editViewType: "editable-markdown",
            },
        ],
        relations: [
            { resource: "veloiq_help_action", targetKey: "document_id", label: "Actions" },
        ],
    },
    {
        name: "HelpAction",
        label: "Help Action",
        resource: "veloiq_help_action",
        pkField: "id",
        module: "help",
        hideInMenu: true,
        fields: [
            { key: "id", label: "ID", type: "number", isPk: true },
            { key: "document_id", label: "Document", type: "number" },
            { key: "label", label: "Label", type: "string", required: true },
            {
                key: "action_key",
                label: "Action",
                type: "string",
                required: true,
                description: "A fixed catalog of safe, single-target actions the Help drawer can execute for the user. Not every button on a page has one — Delete, Save, Duplicate, and the Actions-preferences gear are deliberately excluded (destructive, or dependent on live in-memory state) and stay description-only in the markdown body.",
                options: [
                    // List page
                    { label: "Create New", value: "create_new" },
                    { label: "Export to CSV", value: "export_csv" },
                    { label: "Open Import CSV", value: "open_import" },
                    { label: "Open Metadata", value: "open_metadata" },
                    { label: "Open View Configuration", value: "open_view_config" },
                    { label: "Switch to Gallery view", value: "switch_view_type:gallery" },
                    { label: "Switch to Calendar view", value: "switch_view_type:calendar" },
                    // Show page (current record)
                    { label: "Go to Edit", value: "go_to_edit" },
                    { label: "Back to List", value: "go_to_list" },
                    { label: "Pin to Dashboard", value: "pin_to_dashboard" },
                    { label: "Open Explore", value: "open_explore" },
                    // Edit page (current record)
                    { label: "Go to Show", value: "go_to_show" },
                ],
            },
            { key: "order", label: "Order", type: "number", default: 0 },
        ],
    },
];
