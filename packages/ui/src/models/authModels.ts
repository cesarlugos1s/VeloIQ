import type { ModelDef } from "../components/DynamicResource/types";

export const authSystemModels: ModelDef[] = [
    {
        name: "User",
        label: "User",
        resource: "user",
        pkField: "id",
        module: "access_control",
        fields: [
            { key: "id", label: "ID", type: "number", isPk: true },
            { key: "username", label: "Username", type: "string", required: true, unique: true },
            { key: "email", label: "Email", type: "string" },
            { key: "first_name", label: "First Name", type: "string", nullable: true },
            { key: "last_name", label: "Last Name", type: "string", nullable: true },
            {
                key: "status",
                label: "Status",
                type: "string",
                options: [
                    { label: "Active", value: "Active" },
                    { label: "Inactive", value: "Inactive" },
                    { label: "Suspended", value: "Suspended" },
                ],
                valueColors: { Active: "#52c41a", Inactive: "#d9d9d9", Suspended: "#ff4d4f" },
            },
        ],
        relations: [
            {
                resource: "role",
                resourcePath: "user_role",
                targetKey: "user_id",
                otherKey: "role_id",
                otherResource: "role",
                label: "Roles",
            },
            {
                resource: "tenant",
                resourcePath: "user_tenant",
                targetKey: "user_id",
                otherKey: "tenant_id",
                otherResource: "tenant",
                label: "Tenants",
            },
        ],
    },
    {
        name: "Role",
        label: "Role",
        resource: "role",
        pkField: "id",
        module: "access_control",
        fields: [
            { key: "id", label: "ID", type: "number", isPk: true },
            { key: "name", label: "Name", type: "string", required: true, unique: true },
            { key: "description", label: "Description", type: "string" },
            { key: "allowed_methods", label: "Allowed Methods", type: "string", readRoles: ["Admin"], writeRoles: ["Admin"], description: "JSON array of permitted HTTP methods, e.g. [\"GET\",\"POST\",\"PUT\",\"PATCH\",\"DELETE\"]" },
            { key: "is_preset", label: "Is Preset", type: "boolean", readRoles: ["Admin"], writeRoles: ["Admin"], description: "Preset roles are seeded from code on startup and appear in the Roles UI as built-in." },
        ],
        relations: [
            {
                resource: "user",
                resourcePath: "user_role",
                targetKey: "role_id",
                otherKey: "user_id",
                otherResource: "user",
                label: "Users",
            },
        ],
    },
    {
        name: "Tenant",
        label: "Tenant",
        resource: "tenant",
        pkField: "id",
        module: "access_control",
        fields: [
            { key: "id", label: "ID", type: "number", isPk: true },
            { key: "name", label: "Name", type: "string", required: true, unique: true },
            { key: "domain", label: "Domain", type: "string" },
            {
                key: "status",
                label: "Status",
                type: "string",
                options: [
                    { label: "Active", value: "Active" },
                    { label: "Suspended", value: "Suspended" },
                ],
                valueColors: { Active: "#52c41a", Suspended: "#ff4d4f" },
            },
        ],
        relations: [
            {
                resource: "user",
                resourcePath: "user_tenant",
                targetKey: "tenant_id",
                otherKey: "user_id",
                otherResource: "user",
                label: "Users",
            },
        ],
    },
];
