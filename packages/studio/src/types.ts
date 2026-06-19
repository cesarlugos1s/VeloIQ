export interface AppInfo {
  app_name: string;
  framework_version: string;
  dev_mode: boolean;
}

export interface FieldInfo {
  key: string;
  label: string;
  type: string;
  required: boolean;
  read_only: boolean;
  reference: string | null;
  default: unknown;
  options: string[];
  read_roles: string[];
  write_roles: string[];
  description: string | null;
  show_view_type: string | null;
  edit_view_type: string | null;
}

export interface RelationInfo {
  resource: string;
  target_key: string;
  label: string;
  is_recursive: boolean;
  other_resource: string | null;
  other_key: string | null;
  resource_path: string | null;
}

export interface ModelInfo {
  name: string;
  label: string;
  resource: string;
  pk_field: string;
  module_name: string;
  fields: FieldInfo[];
  relations: RelationInfo[];
  is_named_query: boolean;
  in_dashboard: boolean;
  dashboard_tab: string | null;
  in_search: boolean;
  permissions: Record<string, string[]>;
  has_rebac: boolean;
  custom_pages: string[];
  models_path: string | null;
  description: string | null;
  title_fields: string[];
  referenced_by: [string, string, string][];
}

export interface ModuleInfo {
  name: string;
  path: string;
  models: ModelInfo[];
}

export interface ExtInfo {
  name: string;
  installed: boolean;
  enabled: boolean;
}

export interface AppSchema {
  name: string;
  root: string;
  modules: ModuleInfo[];
  search_models: string[];
  search_fields: string[];
  db_url_sanitized: string;
  auth_disabled: boolean;
  generate_run: boolean;
  extensions: ExtInfo[];
}

export interface DashboardModel {
  name: string;
  label: string;
  resource: string;
  tab: string | null;
  module: string;
}

export interface SearchConfig {
  models: string[];
  fields: string[];
}

export type Page =
  | "summary"
  | "schema"
  | "dashboard"
  | "search"
  | "extensions"
  | "health"
  | "commands";

// ── Named query types ─────────────────────────────────────────────────────────

export interface NQJoin {
  resource: string;
  alias: string;
}

export interface NQField {
  from_alias: string;
  key: string;
  alias: string;
  label: string;
  type: string;
}

export interface NQFilter {
  field: string;
  operator: string;
  value: unknown;
}

export interface NQSort {
  field: string;
  order: "asc" | "desc";
}

export interface NamedQueryDef {
  name: string;
  label: string;
  module: string;
  root_resource: string;
  joins: NQJoin[];
  fields: NQField[];
  default_filters: NQFilter[];
  default_sort: NQSort[];
  list_view_type: string;
}
