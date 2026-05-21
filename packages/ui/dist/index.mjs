import React6, { createContext, useContext, useMemo, useState, useRef, useEffect, useCallback, useLayoutEffect, useSyncExternalStore, useId, useImperativeHandle } from 'react';
import { ThemedLayoutV2, Show, List, useForm, DeleteButton, useTable, RefineThemes, Breadcrumb as Breadcrumb$1, Create, useSelect, Edit, ListButton, EditButton, RefreshButton } from '@refinedev/antd';
import { useMenu, useGo, useGetIdentity, useLogout, useOne, useApiUrl, useInvalidate, useCan, useCustom, useLogin, useWarnAboutChange } from '@refinedev/core';
import { Typography, Menu, theme, Layout, Space, AutoComplete, Input, Spin, Grid, Form, Drawer, Modal, Button, Tooltip, Skeleton, message, Switch, Divider, Tabs, Alert, Card, Table, Select, DatePicker, InputNumber, Checkbox, Pagination, Collapse, Breadcrumb, Tree, ConfigProvider, Empty, Tag, List as List$1, Popover, Dropdown, Avatar, TimePicker, Upload } from 'antd';
import { SearchOutlined, LockOutlined, LogoutOutlined, InfoCircleOutlined, SaveOutlined, UnorderedListOutlined, DownloadOutlined, SettingOutlined, PlusOutlined, LinkOutlined, ShareAltOutlined, BarChartOutlined, ColumnHeightOutlined, SwapOutlined, FilterOutlined, ArrowUpOutlined, ArrowDownOutlined, DeleteOutlined, ArrowLeftOutlined, ArrowRightOutlined, FileTextOutlined, BugOutlined, EyeOutlined, EditOutlined, FilePdfOutlined, CloseCircleOutlined, DownOutlined, UserOutlined, ReloadOutlined, ClockCircleOutlined, PushpinFilled, PushpinOutlined, DashboardOutlined, CheckCircleOutlined, CopyOutlined, ApartmentOutlined, SaveFilled, CalendarOutlined, MenuOutlined, MenuUnfoldOutlined, MenuFoldOutlined, LayoutOutlined, AppstoreOutlined, CommentOutlined, MinusSquareOutlined, FullscreenOutlined, CloseOutlined, DatabaseOutlined, ShopOutlined, BookOutlined, UploadOutlined, FolderOutlined, FileOutlined, RightOutlined } from '@ant-design/icons';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { useNavigate, useParams, useSearchParams, useLocation, Link, UNSAFE_RouteContext } from 'react-router-dom';
import { createPortal } from 'react-dom';
import dayjs7 from 'dayjs';
import axios from 'axios';

var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), member.set(obj, value), value);
var ColorModeContext = createContext({ mode: "light", setMode: () => {
} });

// src/utils/modelTone.ts
var MODEL_TONES_LIGHT = [
  { solid: "#2563eb", soft: "#dbeafe", softer: "#eff6ff", text: "#1e3a8a", border: "#93c5fd", shadow: "rgba(37, 99, 235, 0.22)" },
  { solid: "#0f766e", soft: "#ccfbf1", softer: "#f0fdfa", text: "#115e59", border: "#5eead4", shadow: "rgba(15, 118, 110, 0.22)" },
  { solid: "#059669", soft: "#d1fae5", softer: "#ecfdf5", text: "#065f46", border: "#6ee7b7", shadow: "rgba(5, 150, 105, 0.22)" },
  { solid: "#d97706", soft: "#fef3c7", softer: "#fffbeb", text: "#92400e", border: "#fcd34d", shadow: "rgba(217, 119, 6, 0.24)" },
  { solid: "#7c3aed", soft: "#ede9fe", softer: "#f5f3ff", text: "#5b21b6", border: "#c4b5fd", shadow: "rgba(124, 58, 237, 0.22)" },
  { solid: "#e11d48", soft: "#ffe4e6", softer: "#fff1f2", text: "#9f1239", border: "#fda4af", shadow: "rgba(225, 29, 72, 0.22)" }
];
var MODEL_TONES_DARK = [
  { solid: "#3b82f6", soft: "#1e3a5f", softer: "#0f2040", text: "#93c5fd", border: "#3b82f6", shadow: "rgba(59, 130, 246, 0.35)" },
  { solid: "#14b8a6", soft: "#134e4a", softer: "#0c3330", text: "#5eead4", border: "#14b8a6", shadow: "rgba(20, 184, 166, 0.35)" },
  { solid: "#10b981", soft: "#064e3b", softer: "#032b20", text: "#6ee7b7", border: "#10b981", shadow: "rgba(16, 185, 129, 0.35)" },
  { solid: "#f59e0b", soft: "#451a03", softer: "#2d1000", text: "#fcd34d", border: "#f59e0b", shadow: "rgba(245, 158, 11, 0.35)" },
  { solid: "#8b5cf6", soft: "#2e1065", softer: "#1a0840", text: "#c4b5fd", border: "#8b5cf6", shadow: "rgba(139, 92, 246, 0.35)" },
  { solid: "#f43f5e", soft: "#4c0519", softer: "#2d0310", text: "#fda4af", border: "#f43f5e", shadow: "rgba(244, 63, 94, 0.35)" }
];
var PLAIN_TONE_LIGHT = {
  solid: "#374151",
  soft: "#f3f4f6",
  softer: "#f9fafb",
  text: "#374151",
  border: "#9ca3af",
  shadow: "rgba(55, 65, 81, 0.18)"
};
var PLAIN_TONE_DARK = {
  solid: "#ffffff",
  soft: "#1e293b",
  softer: "#0f172a",
  text: "#ffffff",
  border: "#94a3b8",
  shadow: "rgba(255, 255, 255, 0.15)"
};
var _modulesColorSchema = typeof localStorage !== "undefined" && localStorage.getItem("jm_modulesColorSchema") || "plain-color";
var _modelsColorSchema = typeof localStorage !== "undefined" && localStorage.getItem("jm_modelsColorSchema") || "plain-color";
var _customPlainToneLight = null;
var _customPlainToneDark = null;
var hexToRgb = (hex) => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16)
  };
};
var isDarkColor = (hexColor) => {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return false;
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance < 0.53;
};
var setColorSchemas = (schemas) => {
  if (schemas.modulesColorSchema) {
    _modulesColorSchema = schemas.modulesColorSchema;
    try {
      localStorage.setItem("jm_modulesColorSchema", schemas.modulesColorSchema);
    } catch (_e3) {
    }
  }
  if (schemas.modelsColorSchema) {
    _modelsColorSchema = schemas.modelsColorSchema;
    try {
      localStorage.setItem("jm_modelsColorSchema", schemas.modelsColorSchema);
    } catch (_e3) {
    }
  }
  if (schemas.plainColorBaseHex) {
    try {
      localStorage.setItem("jm_plainColorBaseHex", schemas.plainColorBaseHex);
    } catch (_e3) {
    }
    const rgb = hexToRgb(schemas.plainColorBaseHex);
    if (rgb) {
      const { r, g, b } = rgb;
      const hex = schemas.plainColorBaseHex;
      _customPlainToneLight = {
        solid: hex,
        soft: `rgba(${r}, ${g}, ${b}, 0.12)`,
        softer: `rgba(${r}, ${g}, ${b}, 0.05)`,
        text: isDarkColor(hex) ? hex : "#0f172a",
        border: `rgba(${r}, ${g}, ${b}, 0.3)`,
        shadow: `rgba(${r}, ${g}, ${b}, 0.18)`
      };
      _customPlainToneDark = {
        solid: "#ffffff",
        soft: `rgba(${r}, ${g}, ${b}, 0.35)`,
        softer: `rgba(${r}, ${g}, ${b}, 0.15)`,
        text: "#ffffff",
        border: `rgba(${r}, ${g}, ${b}, 0.5)`,
        shadow: `rgba(${r}, ${g}, ${b}, 0.3)`
      };
      if (typeof document !== "undefined") {
        let styleEl = document.getElementById("jm-dynamic-theme-styles");
        if (!styleEl) {
          styleEl = document.createElement("style");
          styleEl.id = "jm-dynamic-theme-styles";
          document.head.appendChild(styleEl);
        }
        const tint = (val, amount) => Math.floor(val + (255 - val) * amount);
        const lightBgContent = `rgb(${tint(r, 0.97)}, ${tint(g, 0.97)}, ${tint(b, 0.97)})`;
        const lightBgElements = `rgb(${tint(r, 0.93)}, ${tint(g, 0.93)}, ${tint(b, 0.93)})`;
        const lightBgHover = `rgb(${tint(r, 0.85)}, ${tint(g, 0.85)}, ${tint(b, 0.85)})`;
        const shade = (val, amount) => Math.floor(val * amount);
        const darkBgContent = `rgb(${shade(r, 0.06)}, ${shade(g, 0.06)}, ${shade(b, 0.06)})`;
        const darkBgElements = `rgb(${shade(r, 0.11)}, ${shade(g, 0.11)}, ${shade(b, 0.11)})`;
        const darkBgHover = `rgb(${shade(r, 0.16)}, ${shade(g, 0.16)}, ${shade(b, 0.16)})`;
        styleEl.innerHTML = `
                    /* --- LIGHT MODE OVERRIDES --- */
                    body.jm-light .ant-layout,
                    body.jm-light .ant-layout-content,
                    body.jm-light .ant-tabs-content-holder,
                    body.jm-light .ant-tabs-content,
                    body.jm-light .ant-tabs-tabpane {
                        background-color: ${lightBgContent} !important;
                    }
                    body.jm-light .ant-layout-sider,
                    body.jm-light .ant-menu,
                    body.jm-light .ant-menu-submenu,
                    body.jm-light .ant-menu-submenu-title,
                    body.jm-light .ant-layout-header,
                    body.jm-light .ant-card,
                    body.jm-light .ant-table-wrapper .ant-table,
                    body.jm-light .ant-table-thead > tr > th,
                    body.jm-light .ant-tabs-nav,
                    body.jm-light .ant-tabs-nav::before,
                    body.jm-light .ant-tabs-tab {
                        background-color: ${lightBgElements} !important;
                    }
                    body.jm-light .ant-tabs-tab-active {
                        background-color: ${lightBgContent} !important;
                    }
                    body.jm-light .ant-menu-light .ant-menu-item-selected,
                    body.jm-light .ant-menu-light .ant-menu-item-active,
                    body.jm-light .ant-menu-light .ant-menu-submenu-title-active {
                        background-color: ${lightBgHover} !important;
                    }

                    /* --- DARK MODE OVERRIDES --- */
                    body.jm-dark .ant-layout,
                    body.jm-dark .ant-layout-content,
                    body.jm-dark .ant-tabs-content-holder,
                    body.jm-dark .ant-tabs-content,
                    body.jm-dark .ant-tabs-tabpane {
                        background-color: ${darkBgContent} !important;
                    }
                    body.jm-dark .ant-layout-sider,
                    body.jm-dark .ant-menu,
                    body.jm-dark .ant-menu-submenu,
                    body.jm-dark .ant-menu-submenu-title,
                    body.jm-dark .ant-layout-header,
                    body.jm-dark .ant-card,
                    body.jm-dark .ant-table-wrapper .ant-table,
                    body.jm-dark .ant-table-thead > tr > th,
                    body.jm-dark .ant-tabs-nav,
                    body.jm-dark .ant-tabs-nav::before,
                    body.jm-dark .ant-tabs-tab {
                        background-color: ${darkBgElements} !important;
                    }
                    body.jm-dark .ant-tabs-tab-active {
                        background-color: ${darkBgContent} !important;
                    }
                    body.jm-dark .ant-menu-dark .ant-menu-item-selected,
                    body.jm-dark .ant-menu-dark .ant-menu-item-active,
                    body.jm-dark .ant-menu-dark .ant-menu-submenu-title-active {
                        background-color: ${darkBgHover} !important;
                    }
                `;
      }
    }
  }
};
var hashString = (input) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) hash = hash * 31 + input.charCodeAt(i) | 0;
  return Math.abs(hash);
};
var normalizeToneKey = (value) => (value || "").toLowerCase().replace(/[_\s-]+/g, "").replace(/[^a-z0-9:]/g, "");
var toneSeedFromModel = (modelLike) => {
  if (typeof modelLike === "string") return normalizeToneKey(modelLike) || "default";
  const resourceKey = normalizeToneKey(modelLike?.resource);
  const nameKey = normalizeToneKey(modelLike?.name);
  const labelKey = normalizeToneKey(modelLike?.label);
  return resourceKey || nameKey || labelKey || "default";
};
var getModelTone = (modelLike, darkMode) => {
  const dark = darkMode !== void 0 ? darkMode : typeof document !== "undefined" && document.body.classList.contains("jm-dark");
  const seed = toneSeedFromModel(modelLike);
  const isModule = seed.startsWith("module:");
  const schema = isModule ? _modulesColorSchema : _modelsColorSchema;
  if (schema === "plain-color") {
    if (_customPlainToneLight && _customPlainToneDark) {
      return dark ? _customPlainToneDark : _customPlainToneLight;
    }
    return dark ? PLAIN_TONE_DARK : PLAIN_TONE_LIGHT;
  }
  const tones = dark ? MODEL_TONES_DARK : MODEL_TONES_LIGHT;
  return tones[hashString(seed) % tones.length];
};
var useModelTone = (modelLike) => {
  const { mode } = useContext(ColorModeContext);
  return getModelTone(modelLike, mode === "dark");
};
if (typeof localStorage !== "undefined") {
  const cachedHex = localStorage.getItem("jm_plainColorBaseHex");
  if (cachedHex) {
    setColorSchemas({
      modulesColorSchema: _modulesColorSchema,
      modelsColorSchema: _modelsColorSchema,
      plainColorBaseHex: cachedHex
    });
  }
}
var HorizontalMenu = () => {
  const { menuItems, selectedKey } = useMenu();
  const go = useGo();
  const resolveModelSeed = (item) => {
    const route = String(item?.route || "");
    const routeParts = route.split("/").filter(Boolean);
    const routeCandidate = [...routeParts].reverse().find((part) => part && !/^\d+$/.test(part) && !["list", "show", "edit", "create", "embedded"].includes(part.toLowerCase())) || "";
    const key = String(item?.key || "");
    const keyCandidate = key.startsWith("module:") ? "" : key;
    const label = String(item?.label || item?.name || "");
    return normalizeToneKey(routeCandidate || keyCandidate || label || "default");
  };
  const renderLabel = (item, depth, hasChildren) => {
    const label = String(item?.label || item?.name || item?.key || "");
    const isModule = depth === 0 || hasChildren;
    const tone = isModule ? getModelTone(`module:${item?.key || label}`) : getModelTone(resolveModelSeed(item));
    return /* @__PURE__ */ jsx(
      "span",
      {
        style: {
          display: "inline-flex",
          alignItems: "center",
          padding: isModule ? "2px 5px" : "1px 5px",
          borderRadius: 8,
          background: "transparent",
          color: tone.text,
          fontWeight: 400
        },
        children: label
      }
    );
  };
  const transformItems = (items2, depth = 0) => {
    return items2.map((item) => {
      const hasChildren = item.children && item.children.length > 0;
      return {
        key: item.key,
        label: renderLabel(item, depth, hasChildren),
        icon: item.icon,
        onClick: hasChildren ? void 0 : () => go({ to: item.route }),
        children: hasChildren ? transformItems(item.children, depth + 1) : void 0
      };
    });
  };
  const items = transformItems(menuItems);
  return /* @__PURE__ */ jsx(
    Menu,
    {
      mode: "horizontal",
      selectedKeys: [selectedKey],
      items,
      style: {
        borderBottom: "none",
        flex: 1,
        background: "transparent"
      }
    }
  );
};
var CustomSider = ({ collapsed, logo, appTitle }) => {
  const { token } = theme.useToken();
  const { mode } = useContext(ColorModeContext);
  const { menuItems, selectedKey } = useMenu();
  const go = useGo();
  const getIcon = (item) => {
    const key = String(item?.key || "").toLowerCase();
    switch (key) {
      case "dashboard":
        return /* @__PURE__ */ jsx(DashboardOutlined, {});
      case "module:pim":
        return /* @__PURE__ */ jsx(DatabaseOutlined, {});
      case "module:alloplan":
        return /* @__PURE__ */ jsx(BarChartOutlined, {});
      case "module:catim":
        return /* @__PURE__ */ jsx(BookOutlined, {});
      case "module:bsim":
        return /* @__PURE__ */ jsx(ShopOutlined, {});
      default:
        return /* @__PURE__ */ jsx(DatabaseOutlined, {});
    }
  };
  const resolveModelSeed = (item) => {
    const route = String(item?.route || "");
    const routeParts = route.split("/").filter(Boolean);
    const routeCandidate = [...routeParts].reverse().find((part) => part && !/^\d+$/.test(part) && !["list", "show", "edit", "create", "embedded"].includes(part.toLowerCase())) || "";
    const key = String(item?.key || "");
    const keyCandidate = key.startsWith("module:") ? "" : key;
    const label = String(item?.label || item?.name || "");
    return normalizeToneKey(routeCandidate || keyCandidate || label || "default");
  };
  const renderLabel = (item, depth, hasChildren) => {
    const label = String(item?.label || item?.name || item?.key || "");
    const isModule = depth === 0 || hasChildren;
    const tone = isModule ? getModelTone(`module:${item?.key || label}`) : getModelTone(resolveModelSeed(item));
    return /* @__PURE__ */ jsx(
      "span",
      {
        style: {
          display: "inline-flex",
          alignItems: "center",
          padding: isModule ? "3px 8px" : "2px 8px",
          borderRadius: 8,
          background: "transparent",
          color: tone.text,
          fontWeight: 400
        },
        children: label
      }
    );
  };
  const transformItems = (items2, depth = 0) => {
    return items2.map((item) => {
      const hasChildren = item.children && item.children.length > 0;
      return {
        key: item.key,
        label: renderLabel(item, depth, hasChildren),
        icon: item.icon || getIcon(item),
        onClick: hasChildren ? void 0 : () => go({ to: item.route }),
        children: hasChildren ? transformItems(item.children, depth + 1) : void 0
      };
    });
  };
  const items = useMemo(() => transformItems(menuItems), [menuItems, mode]);
  return /* @__PURE__ */ jsx(
    Layout.Sider,
    {
      width: 280,
      trigger: null,
      collapsible: true,
      collapsed,
      theme: mode === "dark" ? "dark" : "light",
      style: {
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        height: "100vh",
        position: "sticky",
        top: 0,
        left: 0,
        zIndex: 999,
        display: "flex",
        flexDirection: "column"
      },
      children: /* @__PURE__ */ jsxs("div", { style: { height: "100%", display: "flex", flexDirection: "column" }, children: [
        /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              height: "64px",
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              padding: collapsed ? "0" : "0 24px",
              borderBottom: `1px solid ${token.colorBorderSecondary}`
            },
            children: [
              typeof logo === "string" ? /* @__PURE__ */ jsx("img", { src: logo, alt: appTitle || "App", style: { height: "40px", width: "auto" } }) : logo ? /* @__PURE__ */ jsx("span", { style: { display: "flex", alignItems: "center" }, children: logo }) : null,
              !collapsed && appTitle && /* @__PURE__ */ jsx(
                Typography.Title,
                {
                  level: 4,
                  style: {
                    margin: "0 0 0 12px",
                    whiteSpace: "nowrap",
                    fontWeight: 350,
                    fontSize: "18px",
                    color: token.colorText
                  },
                  children: appTitle
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ jsx(
          "div",
          {
            style: {
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              paddingBottom: 12
            },
            children: /* @__PURE__ */ jsx(
              Menu,
              {
                mode: "inline",
                inlineCollapsed: collapsed,
                selectedKeys: [selectedKey],
                items,
                style: { borderRight: "none", marginTop: "8px" }
              }
            )
          }
        )
      ] })
    }
  );
};
var AllModelsContext = createContext([]);
var AllModelsProvider = ({
  models,
  children
}) => /* @__PURE__ */ jsx(AllModelsContext.Provider, { value: models, children });
var useAllModels = () => useContext(AllModelsContext);

// src/utils/authenticatedFetch.ts
var TOKEN_KEY = "jm_access_token";
var authenticatedFetch = (url, options = {}) => {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = {
    ...options.headers
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
};
var _2 = window._ || ((text) => text);
var API_URL = "/api";
var flattenMenuItems = (items, parentLabel = "") => {
  const result = [];
  for (const item of items) {
    if (item.children?.length) {
      result.push(...flattenMenuItems(item.children, item.label || item.name || ""));
    } else if (item.route && !item.meta?.hide) {
      result.push({
        name: item.name,
        label: item.label || item.name,
        moduleLabel: parentLabel,
        listPath: item.route
      });
    }
  }
  return result;
};
var GlobalSearch = () => {
  const { menuItems } = useMenu();
  const allSystemModels = useAllModels();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [backendResults, setBackendResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const [searchConfig, setSearchConfig] = useState(null);
  useEffect(() => {
    authenticatedFetch(`${API_URL}/config/search`).then((r) => {
      if (!r.ok) throw new Error("unavailable");
      return r.json();
    }).then((data) => setSearchConfig(data)).catch(() => {
    });
  }, []);
  const searchableResources = useMemo(() => flattenMenuItems(menuItems), [menuItems]);
  const searchableModels = useMemo(() => {
    if (!searchConfig) return [];
    const entityTypesLower = searchConfig.entity_types.map((e) => e.toLowerCase());
    const preferredFields = searchConfig.attribute_types;
    const useAllStringFields = preferredFields.length === 0;
    return allSystemModels.filter((m) => entityTypesLower.includes((m.name || "").toLowerCase())).map((m) => {
      const stringFields = (m.fields || []).filter((f) => f.type === "string");
      if (useAllStringFields) {
        return {
          name: m.name,
          label: m.label || m.name,
          resource: m.resource || m.name,
          searchFields: stringFields.map((f) => f.key)
        };
      }
      const matched = /* @__PURE__ */ new Set();
      for (const pref of preferredFields) {
        if (stringFields.some((f) => f.key === pref)) matched.add(pref);
      }
      for (const pref of preferredFields) {
        const suffix = stringFields.find(
          (f) => !matched.has(f.key) && f.key !== pref && f.key.endsWith(`_${pref}`)
        );
        if (suffix) matched.add(suffix.key);
      }
      return {
        name: m.name,
        label: m.label || m.name,
        resource: m.resource || m.name,
        searchFields: Array.from(matched)
      };
    }).filter((m) => m.searchFields.length > 0);
  }, [allSystemModels, searchConfig]);
  const resourceResults = useMemo(() => {
    const q2 = searchText.toLowerCase().trim();
    if (!q2) return [];
    const matches = searchableResources.filter(
      (r) => r.label.toLowerCase().includes(q2) || r.name.toLowerCase().includes(q2) || r.moduleLabel.toLowerCase().includes(q2)
    );
    if (matches.length === 0) return [];
    return [
      {
        label: /* @__PURE__ */ jsx(Typography.Text, { type: "secondary", strong: true, style: { fontSize: 11 }, children: _2("Go to") }),
        options: matches.slice(0, 10).map((r) => ({
          value: `nav:${r.listPath}`,
          key: `nav-${r.name}`,
          label: /* @__PURE__ */ jsxs(Space, { size: 4, children: [
            /* @__PURE__ */ jsx(Typography.Text, { children: r.label }),
            /* @__PURE__ */ jsx(Typography.Text, { type: "secondary", style: { fontSize: 11 }, children: r.moduleLabel })
          ] })
        }))
      }
    ];
  }, [searchText, searchableResources]);
  const doBackendSearch = useCallback(
    (query) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
      const q2 = query.trim();
      if (q2.length < 2) {
        setBackendResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      debounceRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;
        const modelsToSearch = searchableModels.slice(0, 8);
        const results = [];
        try {
          const fetches = modelsToSearch.map(async (m) => {
            try {
              const fieldFetches = m.searchFields.map(async (field) => {
                const url = `${API_URL}/${m.resource}?_start=0&_end=5&${field}__ilike=${encodeURIComponent(q2)}`;
                const resp = await authenticatedFetch(url, { signal: controller.signal });
                if (!resp.ok) return [];
                const data = await resp.json();
                return Array.isArray(data) ? data : [];
              });
              const allResults = (await Promise.all(fieldFetches)).flat();
              const seen = /* @__PURE__ */ new Set();
              const unique = allResults.filter((r) => {
                const id = r.eid ?? r.id;
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
              });
              if (unique.length === 0) return null;
              return { model: m, records: unique };
            } catch {
              return null;
            }
          });
          const responses = await Promise.all(fetches);
          for (const resp of responses) {
            if (!resp) continue;
            results.push({
              label: /* @__PURE__ */ jsx(Typography.Text, { type: "secondary", strong: true, style: { fontSize: 11 }, children: resp.model.label }),
              options: resp.records.slice(0, 5).map((record) => {
                const id = record.eid ?? record.id;
                const label = record._label || `#${id}`;
                return {
                  value: `record:/${resp.model.resource}/show/${id}`,
                  key: `record-${resp.model.name}-${id}`,
                  label: /* @__PURE__ */ jsx(Typography.Text, { children: String(label) })
                };
              })
            });
          }
        } catch {
        }
        if (!controller.signal.aborted) {
          setBackendResults(results);
          setSearching(false);
        }
      }, 300);
    },
    [searchableModels]
  );
  const onSearch = useCallback(
    (value) => {
      setSearchText(value);
      doBackendSearch(value);
    },
    [doBackendSearch]
  );
  const onSelect = useCallback(
    (value) => {
      const path = value.replace(/^(nav:|record:)/, "");
      navigate(path);
      setSearchText("");
      setBackendResults([]);
    },
    [navigate]
  );
  const options = useMemo(() => {
    const groups = [...resourceResults, ...backendResults];
    return groups;
  }, [resourceResults, backendResults]);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return /* @__PURE__ */ jsx("div", { style: { position: "relative", width: focused ? 320 : 56, transition: "width 0.25s ease" }, children: /* @__PURE__ */ jsx(
    AutoComplete,
    {
      options,
      onSearch,
      onSelect: (value) => {
        onSelect(value);
        setFocused(false);
        inputRef.current?.blur();
      },
      value: searchText,
      style: { width: focused ? 320 : 56 },
      popupMatchSelectWidth: 400,
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
      children: /* @__PURE__ */ jsx(
        Input,
        {
          ref: inputRef,
          placeholder: focused ? `${_2("Search")}...` : "",
          prefix: searching ? /* @__PURE__ */ jsx(Spin, { size: "small" }) : /* @__PURE__ */ jsx(SearchOutlined, {}),
          suffix: !focused ? /* @__PURE__ */ jsx(Typography.Text, { type: "secondary", style: { fontSize: 9 }, children: "\u2303K" }) : void 0,
          allowClear: true,
          size: "small",
          style: !focused ? { paddingInline: 2 } : void 0
        }
      )
    }
  ) });
};
var API_URL2 = "/api";
var DefaultLogo = ({ logo, appTitle, collapsed, isHeader = false, hideTitle = false }) => {
  const logoEl = typeof logo === "string" ? /* @__PURE__ */ jsx("img", { src: logo, alt: appTitle || "App", style: { height: isHeader ? "32px" : "40px", width: "auto", marginRight: collapsed || hideTitle ? 0 : 10 } }) : logo ? /* @__PURE__ */ jsx("span", { style: { marginRight: collapsed || hideTitle ? 0 : 10, display: "flex", alignItems: "center" }, children: logo }) : null;
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", padding: isHeader ? 0 : "10px 0" }, children: [
    logoEl,
    !collapsed && !hideTitle && appTitle && /* @__PURE__ */ jsx(Typography.Title, { level: 4, style: { margin: 0, whiteSpace: "nowrap", fontWeight: 350, fontSize: "18px" }, children: appTitle })
  ] });
};
var MobileMenuContent = ({ onClose }) => {
  const { menuItems, selectedKey } = useMenu();
  const go = useGo();
  const transformItems = (items) => items.map((item) => ({
    key: item.key,
    label: item.label || item.name || item.key,
    icon: item.icon,
    onClick: item.children?.length ? void 0 : () => {
      go({ to: item.route });
      onClose();
    },
    children: item.children?.length ? transformItems(item.children) : void 0
  }));
  return /* @__PURE__ */ jsx(
    Menu,
    {
      mode: "inline",
      selectedKeys: [selectedKey],
      items: transformItems(menuItems),
      style: { borderRight: "none" }
    }
  );
};
var LayoutWrapper = ({
  children,
  logo,
  appTitle,
  extraUserMenuItems = []
}) => {
  const [layoutMode, setLayoutMode] = useState(
    () => localStorage.getItem("layoutMode") || "vertical"
  );
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { mode, setMode } = useContext(ColorModeContext);
  const { token } = theme.useToken();
  const { data: identity } = useGetIdentity();
  const { mutate: logout } = useLogout();
  useGo();
  const displayName = identity ? [identity.first_name, identity.last_name].filter(Boolean).join(" ") || identity.username || "User" : "User";
  const [siderCollapsed, setSiderCollapsed] = useState(() => localStorage.getItem("siderCollapsed") === "true");
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdForm] = Form.useForm();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toggleSider = () => {
    const next = !siderCollapsed;
    setSiderCollapsed(next);
    localStorage.setItem("siderCollapsed", String(next));
  };
  const handleChangePassword = async (values) => {
    setPwdLoading(true);
    try {
      const res = await authenticatedFetch(`${API_URL2}/auth/change-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        message.error(body?.detail || "Failed to change password");
        return;
      }
      message.success(body?.message || "Password changed successfully");
      setPwdModalOpen(false);
      pwdForm.resetFields();
    } catch {
      message.error("Network error");
    } finally {
      setPwdLoading(false);
    }
  };
  const userItems = [
    { key: "change-password", label: "Change Password", icon: /* @__PURE__ */ jsx(LockOutlined, {}), onClick: () => setPwdModalOpen(true) },
    ...extraUserMenuItems,
    { type: "divider" },
    { key: "logout", label: "Logout", icon: /* @__PURE__ */ jsx(LogoutOutlined, {}), danger: true, onClick: () => logout() }
  ];
  const CustomHeader = () => /* @__PURE__ */ jsxs(Layout.Header, { style: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "2px 10px",
    height: "auto",
    lineHeight: "normal",
    background: token.colorBgContainer,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    position: "sticky",
    top: 0,
    zIndex: 999
  }, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", flex: 1, minWidth: 0 }, children: [
      layoutMode === "vertical" && /* @__PURE__ */ jsx(Tooltip, { title: isMobile ? "Open menu" : siderCollapsed ? "Expand sidebar" : "Collapse sidebar", children: /* @__PURE__ */ jsx(
        Button,
        {
          type: "text",
          icon: isMobile ? /* @__PURE__ */ jsx(MenuOutlined, {}) : siderCollapsed ? /* @__PURE__ */ jsx(MenuUnfoldOutlined, {}) : /* @__PURE__ */ jsx(MenuFoldOutlined, {}),
          onClick: isMobile ? () => setDrawerOpen(true) : toggleSider,
          style: { marginRight: 6, flexShrink: 0 }
        }
      ) }),
      layoutMode === "horizontal" && /* @__PURE__ */ jsxs(Fragment, { children: [
        isMobile && /* @__PURE__ */ jsx(Tooltip, { title: "Open menu", children: /* @__PURE__ */ jsx(Button, { type: "text", icon: /* @__PURE__ */ jsx(MenuOutlined, {}), onClick: () => setDrawerOpen(true), style: { marginRight: 6, flexShrink: 0 } }) }),
        /* @__PURE__ */ jsx("div", { style: { marginRight: isMobile ? 4 : 10, flexShrink: 0 }, children: /* @__PURE__ */ jsx(DefaultLogo, { logo, appTitle, isHeader: true, hideTitle: isMobile }) }),
        !isMobile && /* @__PURE__ */ jsx("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ jsx(HorizontalMenu, {}) })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { style: { flexShrink: 0, marginLeft: 4, marginRight: 4 }, children: /* @__PURE__ */ jsx(GlobalSearch, {}) }),
    /* @__PURE__ */ jsxs(Space, { size: isMobile ? "small" : "middle", style: { flexShrink: 0, marginLeft: 6 }, children: [
      /* @__PURE__ */ jsx(Tooltip, { title: layoutMode === "vertical" ? "Top Menu" : "Sidebar", children: /* @__PURE__ */ jsx(
        Button,
        {
          icon: layoutMode === "vertical" ? /* @__PURE__ */ jsx(LayoutOutlined, {}) : /* @__PURE__ */ jsx(AppstoreOutlined, {}),
          onClick: () => {
            const next = layoutMode === "vertical" ? "horizontal" : "vertical";
            setLayoutMode(next);
            localStorage.setItem("layoutMode", next);
          },
          type: "text"
        }
      ) }),
      /* @__PURE__ */ jsx(Tooltip, { title: mode === "dark" ? "Light mode" : "Dark mode", children: /* @__PURE__ */ jsx(
        Switch,
        {
          checkedChildren: "\u{1F31C}",
          unCheckedChildren: "\u{1F31E}",
          checked: mode === "dark",
          onChange: () => setMode(mode === "light" ? "dark" : "light")
        }
      ) }),
      /* @__PURE__ */ jsx(Dropdown, { menu: { items: userItems }, trigger: ["click"], children: /* @__PURE__ */ jsxs(Space, { style: { cursor: "pointer" }, children: [
        /* @__PURE__ */ jsx(Avatar, { size: 24, style: { backgroundColor: "#1677ff" }, icon: /* @__PURE__ */ jsx(UserOutlined, {}) }),
        !isMobile && /* @__PURE__ */ jsx(Typography.Text, { strong: true, children: displayName }),
        /* @__PURE__ */ jsx(DownOutlined, { style: { fontSize: 10 } })
      ] }) })
    ] })
  ] });
  const SiderToRender = layoutMode === "vertical" && !isMobile ? () => /* @__PURE__ */ jsx(CustomSider, { collapsed: siderCollapsed, logo, appTitle }) : () => null;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      ThemedLayoutV2,
      {
        Title: ({ collapsed }) => /* @__PURE__ */ jsx(DefaultLogo, { logo, appTitle, collapsed }),
        Sider: SiderToRender,
        Header: CustomHeader,
        children
      },
      layoutMode
    ),
    /* @__PURE__ */ jsx(
      Drawer,
      {
        title: /* @__PURE__ */ jsx(DefaultLogo, { logo, appTitle, isHeader: true }),
        placement: "left",
        open: drawerOpen,
        onClose: () => setDrawerOpen(false),
        width: 280,
        styles: { body: { padding: 0 } },
        children: /* @__PURE__ */ jsx(MobileMenuContent, { onClose: () => setDrawerOpen(false) })
      }
    ),
    /* @__PURE__ */ jsx(
      Modal,
      {
        title: "Change Password",
        open: pwdModalOpen,
        onCancel: () => {
          setPwdModalOpen(false);
          pwdForm.resetFields();
        },
        footer: null,
        destroyOnHidden: true,
        children: /* @__PURE__ */ jsxs(Form, { form: pwdForm, layout: "vertical", onFinish: handleChangePassword, children: [
          /* @__PURE__ */ jsx(Form.Item, { name: "current_password", label: "Current Password", rules: [{ required: true }], children: /* @__PURE__ */ jsx(Input.Password, { prefix: /* @__PURE__ */ jsx(LockOutlined, {}) }) }),
          /* @__PURE__ */ jsx(Form.Item, { name: "new_password", label: "New Password", rules: [{ required: true }, { min: 4 }], children: /* @__PURE__ */ jsx(Input.Password, { prefix: /* @__PURE__ */ jsx(LockOutlined, {}) }) }),
          /* @__PURE__ */ jsx(
            Form.Item,
            {
              name: "confirm_password",
              label: "Confirm Password",
              dependencies: ["new_password"],
              rules: [{ required: true }, ({ getFieldValue }) => ({
                validator(_39, value) {
                  if (!value || getFieldValue("new_password") === value) return Promise.resolve();
                  return Promise.reject(new Error("Passwords do not match"));
                }
              })],
              children: /* @__PURE__ */ jsx(Input.Password, { prefix: /* @__PURE__ */ jsx(LockOutlined, {}) })
            }
          ),
          /* @__PURE__ */ jsx(Form.Item, { style: { marginBottom: 0, textAlign: "right" }, children: /* @__PURE__ */ jsxs(Space, { children: [
            /* @__PURE__ */ jsx(Button, { onClick: () => {
              setPwdModalOpen(false);
              pwdForm.resetFields();
            }, children: "Cancel" }),
            /* @__PURE__ */ jsx(Button, { type: "primary", htmlType: "submit", loading: pwdLoading, children: "Change Password" })
          ] }) })
        ] })
      }
    )
  ] });
};
var PANE_TOOLBAR_HEIGHT = 28;
var PaneNavigationContext = createContext(null);
var usePaneNavigation = () => useContext(PaneNavigationContext);
function gt(e, t) {
  const n = getComputedStyle(e), o = parseFloat(n.fontSize);
  return t * o;
}
function yt(e, t) {
  const n = getComputedStyle(e.ownerDocument.body), o = parseFloat(n.fontSize);
  return t * o;
}
function St(e) {
  return e / 100 * window.innerHeight;
}
function vt(e) {
  return e / 100 * window.innerWidth;
}
function bt(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function ie({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let o;
  const [i, r] = bt(n);
  switch (r) {
    case "%": {
      o = i / 100 * e;
      break;
    }
    case "px": {
      o = i;
      break;
    }
    case "rem": {
      o = yt(t, i);
      break;
    }
    case "em": {
      o = gt(t, i);
      break;
    }
    case "vh": {
      o = St(i);
      break;
    }
    case "vw": {
      o = vt(i);
      break;
    }
  }
  return o;
}
function O(e) {
  return parseFloat(e.toFixed(3));
}
function ne({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((o, i) => (o += t === "horizontal" ? i.element.offsetWidth : i.element.offsetHeight, o), 0);
}
function ve(e) {
  const { panels: t } = e, n = ne({ group: e });
  return n === 0 ? t.map((o) => ({
    groupResizeBehavior: o.panelConstraints.groupResizeBehavior,
    collapsedSize: 0,
    collapsible: o.panelConstraints.collapsible === true,
    defaultSize: void 0,
    disabled: o.panelConstraints.disabled,
    minSize: 0,
    maxSize: 100,
    panelId: o.id
  })) : t.map((o) => {
    const { element: i, panelConstraints: r } = o;
    let f = 0;
    if (r.collapsedSize !== void 0) {
      const u = ie({
        groupSize: n,
        panelElement: i,
        styleProp: r.collapsedSize
      });
      f = O(u / n * 100);
    }
    let a;
    if (r.defaultSize !== void 0) {
      const u = ie({
        groupSize: n,
        panelElement: i,
        styleProp: r.defaultSize
      });
      a = O(u / n * 100);
    }
    let s = 0;
    if (r.minSize !== void 0) {
      const u = ie({
        groupSize: n,
        panelElement: i,
        styleProp: r.minSize
      });
      s = O(u / n * 100);
    }
    let l = 100;
    if (r.maxSize !== void 0) {
      const u = ie({
        groupSize: n,
        panelElement: i,
        styleProp: r.maxSize
      });
      l = O(u / n * 100);
    }
    return {
      groupResizeBehavior: r.groupResizeBehavior,
      collapsedSize: f,
      collapsible: r.collapsible === true,
      defaultSize: a,
      disabled: r.disabled,
      minSize: s,
      maxSize: l,
      panelId: o.id
    };
  });
}
function C(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function be(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? zt : xt
  );
}
function zt(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function xt(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function qe(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Ye(e, t) {
  return {
    x: e.x >= t.left && e.x <= t.right ? 0 : Math.min(
      Math.abs(e.x - t.left),
      Math.abs(e.x - t.right)
    ),
    y: e.y >= t.top && e.y <= t.bottom ? 0 : Math.min(
      Math.abs(e.y - t.top),
      Math.abs(e.y - t.bottom)
    )
  };
}
function Pt({
  orientation: e,
  rects: t,
  targetRect: n
}) {
  const o = {
    x: n.x + n.width / 2,
    y: n.y + n.height / 2
  };
  let i, r = Number.MAX_VALUE;
  for (const f of t) {
    const { x: a, y: s } = Ye(o, f), l = e === "horizontal" ? a : s;
    l < r && (r = l, i = f);
  }
  return C(i, "No rect found"), i;
}
var fe;
function wt() {
  return fe === void 0 && (typeof matchMedia == "function" ? fe = !!matchMedia("(pointer:coarse)").matches : fe = false), fe;
}
function Je(e) {
  const { element: t, orientation: n, panels: o, separators: i } = e, r = be(
    n,
    Array.from(t.children).filter(qe).map((z) => ({ element: z }))
  ).map(({ element: z }) => z), f = [];
  let a = false, s = false, l = -1, u = -1, h = 0, d, S = [];
  {
    let z = -1;
    for (const c of r)
      c.hasAttribute("data-panel") && (z++, c.hasAttribute("data-disabled") || (h++, l === -1 && (l = z), u = z));
  }
  if (h > 1) {
    let z = -1;
    for (const c of r)
      if (c.hasAttribute("data-panel")) {
        z++;
        const p = o.find(
          (m) => m.element === c
        );
        if (p) {
          if (d) {
            const m = d.element.getBoundingClientRect(), v = c.getBoundingClientRect();
            let b;
            if (s) {
              const y = n === "horizontal" ? new DOMRect(
                m.right,
                m.top,
                0,
                m.height
              ) : new DOMRect(
                m.left,
                m.bottom,
                m.width,
                0
              ), g = n === "horizontal" ? new DOMRect(v.left, v.top, 0, v.height) : new DOMRect(v.left, v.top, v.width, 0);
              switch (S.length) {
                case 0: {
                  b = [
                    y,
                    g
                  ];
                  break;
                }
                case 1: {
                  const P = S[0], M = Pt({
                    orientation: n,
                    rects: [m, v],
                    targetRect: P.element.getBoundingClientRect()
                  });
                  b = [
                    P,
                    M === m ? g : y
                  ];
                  break;
                }
                default: {
                  b = S;
                  break;
                }
              }
            } else
              S.length ? b = S : b = [
                n === "horizontal" ? new DOMRect(
                  m.right,
                  v.top,
                  v.left - m.right,
                  v.height
                ) : new DOMRect(
                  v.left,
                  m.bottom,
                  v.width,
                  v.top - m.bottom
                )
              ];
            for (const y of b) {
              let g = "width" in y ? y : y.element.getBoundingClientRect();
              const P = wt() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (g.width < P) {
                const w = P - g.width;
                g = new DOMRect(
                  g.x - w / 2,
                  g.y,
                  g.width + w,
                  g.height
                );
              }
              if (g.height < P) {
                const w = P - g.height;
                g = new DOMRect(
                  g.x,
                  g.y - w / 2,
                  g.width,
                  g.height + w
                );
              }
              const M = z <= l || z > u;
              !a && !M && f.push({
                group: e,
                groupSize: ne({ group: e }),
                panels: [d, p],
                separator: "width" in y ? void 0 : y,
                rect: g
              }), a = false;
            }
          }
          s = false, d = p, S = [];
        }
      } else if (c.hasAttribute("data-separator")) {
        c.ariaDisabled !== null && (a = true);
        const p = i.find(
          (m) => m.element === c
        );
        p ? S.push(p) : (d = void 0, S = []);
      } else
        s = true;
  }
  return f;
}
var _e;
var Ze = class {
  constructor() {
    __privateAdd(this, _e, {});
  }
  addListener(t, n) {
    const o = __privateGet(this, _e)[t];
    return o === void 0 ? __privateGet(this, _e)[t] = [n] : o.includes(n) || o.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const o = __privateGet(this, _e)[t];
    if (o !== void 0)
      if (o.length === 1)
        o[0].call(null, n);
      else {
        let i = false, r = null;
        const f = Array.from(o);
        for (let a = 0; a < f.length; a++) {
          const s = f[a];
          try {
            s.call(null, n);
          } catch (l) {
            r === null && (i = true, r = l);
          }
        }
        if (i)
          throw r;
      }
  }
  removeAllListeners() {
    __privateSet(this, _e, {});
  }
  removeListener(t, n) {
    const o = __privateGet(this, _e)[t];
    if (o !== void 0) {
      const i = o.indexOf(n);
      i >= 0 && o.splice(i, 1);
    }
  }
};
_e = new WeakMap();
var F = /* @__PURE__ */ new Map();
var Qe = new Ze();
function Lt(e) {
  F = new Map(F), F.delete(e);
}
function ke(e, t) {
  for (const [n] of F)
    if (n.id === e)
      return n;
}
function H(e, t) {
  for (const [n, o] of F)
    if (n.id === e)
      return o;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function X() {
  return F;
}
function ze(e, t) {
  return Qe.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function $(e, t) {
  const n = F.get(e);
  F = new Map(F), F.set(e, t), Qe.emit("groupChange", {
    group: e,
    prev: n,
    next: t
  });
}
function Ct(e, t, n) {
  let o, i = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const r of t) {
    const f = Ye(n, r.rect);
    switch (e) {
      case "horizontal": {
        f.x <= i.x && (o = r, i = f);
        break;
      }
      case "vertical": {
        f.y <= i.y && (o = r, i = f);
        break;
      }
    }
  }
  return o ? {
    distance: i,
    hitRegion: o
  } : void 0;
}
function Rt(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Mt(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Oe(e),
    b: Oe(t)
  };
  let o;
  for (; n.a.at(-1) === n.b.at(-1); )
    o = n.a.pop(), n.b.pop();
  C(
    o,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const i = {
    a: De(Ie(n.a)),
    b: De(Ie(n.b))
  };
  if (i.a === i.b) {
    const r = o.childNodes, f = {
      a: n.a.at(-1),
      b: n.b.at(-1)
    };
    let a = r.length;
    for (; a--; ) {
      const s = r[a];
      if (s === f.a) return 1;
      if (s === f.b) return -1;
    }
  }
  return Math.sign(i.a - i.b);
}
var Et = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function kt(e) {
  const t = getComputedStyle(et(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function It(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || kt(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Et.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Ie(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (C(n, "Missing node"), It(n)) return n;
  }
  return null;
}
function De(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Oe(e) {
  const t = [];
  for (; e; )
    t.push(e), e = et(e);
  return t;
}
function et(e) {
  const { parentNode: t } = e;
  return Rt(t) ? t.host : t;
}
function Dt(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Ot({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!qe(n) || n.contains(e) || e.contains(n))
    return true;
  if (Mt(n, e) > 0) {
    let o = n;
    for (; o; ) {
      if (o.contains(e))
        return true;
      if (Dt(o.getBoundingClientRect(), t))
        return false;
      o = o.parentElement;
    }
  }
  return true;
}
function xe(e, t) {
  const n = [];
  return t.forEach((o, i) => {
    if (i.disabled)
      return;
    const r = Je(i), f = Ct(i.orientation, r, {
      x: e.clientX,
      y: e.clientY
    });
    f && f.distance.x <= 0 && f.distance.y <= 0 && Ot({
      groupElement: i.element,
      hitRegion: f.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(f.hitRegion);
  }), n;
}
function Tt(e, t) {
  if (e.length !== t.length)
    return false;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return false;
  return true;
}
function I(e, t, n = 0) {
  return Math.abs(O(e) - O(t)) <= n;
}
function A(e, t) {
  return I(e, t) ? 0 : e > t ? 1 : -1;
}
function Z({
  overrideDisabledPanels: e,
  panelConstraints: t,
  prevSize: n,
  size: o
}) {
  const {
    collapsedSize: i = 0,
    collapsible: r,
    disabled: f,
    maxSize: a = 100,
    minSize: s = 0
  } = t;
  if (f && !e)
    return n;
  if (A(o, s) < 0)
    if (r) {
      const l = (i + s) / 2;
      A(o, l) < 0 ? o = i : o = s;
    } else
      o = s;
  return o = Math.min(a, o), o = O(o), o;
}
function le({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: o,
  prevLayout: i,
  trigger: r
}) {
  if (I(e, 0))
    return t;
  const f = r === "imperative-api", a = Object.values(t), s = Object.values(i), l = [...a], [u, h] = o;
  C(u != null, "Invalid first pivot index"), C(h != null, "Invalid second pivot index");
  let d = 0;
  switch (r) {
    case "keyboard": {
      {
        const c = e < 0 ? h : u, p = n[c];
        C(
          p,
          `Panel constraints not found for index ${c}`
        );
        const {
          collapsedSize: m = 0,
          collapsible: v,
          minSize: b = 0
        } = p;
        if (v) {
          const y = a[c];
          if (C(
            y != null,
            `Previous layout not found for panel index ${c}`
          ), I(y, m)) {
            const g = b - y;
            A(g, Math.abs(e)) > 0 && (e = e < 0 ? 0 - g : g);
          }
        }
      }
      {
        const c = e < 0 ? u : h, p = n[c];
        C(
          p,
          `No panel constraints found for index ${c}`
        );
        const {
          collapsedSize: m = 0,
          collapsible: v,
          minSize: b = 0
        } = p;
        if (v) {
          const y = a[c];
          if (C(
            y != null,
            `Previous layout not found for panel index ${c}`
          ), I(y, b)) {
            const g = y - m;
            A(g, Math.abs(e)) > 0 && (e = e < 0 ? 0 - g : g);
          }
        }
      }
      break;
    }
    default: {
      const c = e < 0 ? h : u, p = n[c];
      C(
        p,
        `Panel constraints not found for index ${c}`
      );
      const m = a[c], { collapsible: v, collapsedSize: b, minSize: y } = p;
      if (v && A(m, y) < 0)
        if (e > 0) {
          const g = y - b, P = g / 2, M = m + e;
          A(M, y) < 0 && (e = A(e, P) <= 0 ? 0 : g);
        } else {
          const g = y - b, P = 100 - g / 2, M = m - e;
          A(M, y) < 0 && (e = A(100 + e, P) > 0 ? 0 : -g);
        }
      break;
    }
  }
  {
    const c = e < 0 ? 1 : -1;
    let p = e < 0 ? h : u, m = 0;
    for (; ; ) {
      const b = a[p];
      C(
        b != null,
        `Previous layout not found for panel index ${p}`
      );
      const g = Z({
        overrideDisabledPanels: f,
        panelConstraints: n[p],
        prevSize: b,
        size: 100
      }) - b;
      if (m += g, p += c, p < 0 || p >= n.length)
        break;
    }
    const v = Math.min(Math.abs(e), Math.abs(m));
    e = e < 0 ? 0 - v : v;
  }
  {
    let p = e < 0 ? u : h;
    for (; p >= 0 && p < n.length; ) {
      const m = Math.abs(e) - Math.abs(d), v = a[p];
      C(
        v != null,
        `Previous layout not found for panel index ${p}`
      );
      const b = v - m, y = Z({
        overrideDisabledPanels: f,
        panelConstraints: n[p],
        prevSize: v,
        size: b
      });
      if (!I(v, y) && (d += v - y, l[p] = y, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: true
      }) >= 0))
        break;
      e < 0 ? p-- : p++;
    }
  }
  if (Tt(s, l))
    return i;
  {
    const c = e < 0 ? h : u, p = a[c];
    C(
      p != null,
      `Previous layout not found for panel index ${c}`
    );
    const m = p + d, v = Z({
      overrideDisabledPanels: f,
      panelConstraints: n[c],
      prevSize: p,
      size: m
    });
    if (l[c] = v, !I(v, m)) {
      let b = m - v, g = e < 0 ? h : u;
      for (; g >= 0 && g < n.length; ) {
        const P = l[g];
        C(
          P != null,
          `Previous layout not found for panel index ${g}`
        );
        const M = P + b, w = Z({
          overrideDisabledPanels: f,
          panelConstraints: n[g],
          prevSize: P,
          size: M
        });
        if (I(P, w) || (b -= w - P, l[g] = w), I(b, 0))
          break;
        e > 0 ? g-- : g++;
      }
    }
  }
  const S = Object.values(l).reduce(
    (c, p) => p + c,
    0
  );
  if (!I(S, 100, 0.1))
    return i;
  const z = Object.keys(i);
  return l.reduce((c, p, m) => (c[z[m]] = p, c), {});
}
function W(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return false;
  for (const n in e)
    if (t[n] === void 0 || A(e[n], t[n]) !== 0)
      return false;
  return true;
}
function U({
  layout: e,
  panelConstraints: t
}) {
  const n = Object.values(e), o = [...n], i = o.reduce(
    (a, s) => a + s,
    0
  );
  if (o.length !== t.length)
    throw Error(
      `Invalid ${t.length} panel layout: ${o.map((a) => `${a}%`).join(", ")}`
    );
  if (!I(i, 100) && o.length > 0)
    for (let a = 0; a < t.length; a++) {
      const s = o[a];
      C(s != null, `No layout data found for index ${a}`);
      const l = 100 / i * s;
      o[a] = l;
    }
  let r = 0;
  for (let a = 0; a < t.length; a++) {
    const s = n[a];
    C(s != null, `No layout data found for index ${a}`);
    const l = o[a];
    C(l != null, `No layout data found for index ${a}`);
    const u = Z({
      overrideDisabledPanels: true,
      panelConstraints: t[a],
      prevSize: s,
      size: l
    });
    l != u && (r += l - u, o[a] = u);
  }
  if (!I(r, 0))
    for (let a = 0; a < t.length; a++) {
      const s = o[a];
      C(s != null, `No layout data found for index ${a}`);
      const l = s + r, u = Z({
        overrideDisabledPanels: true,
        panelConstraints: t[a],
        prevSize: s,
        size: l
      });
      if (s !== u && (r -= u - s, o[a] = u, I(r, 0)))
        break;
    }
  const f = Object.keys(e);
  return o.reduce((a, s, l) => (a[f[l]] = s, a), {});
}
function tt({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const s = X();
    for (const [
      l,
      {
        defaultLayoutDeferred: u,
        derivedPanelConstraints: h,
        layout: d,
        groupSize: S,
        separatorToPanels: z
      }
    ] of s)
      if (l.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: h,
          group: l,
          groupSize: S,
          layout: d,
          separatorToPanels: z
        };
    throw Error(`Group ${e} not found`);
  }, o = () => {
    const s = n().derivedPanelConstraints.find(
      (l) => l.panelId === t
    );
    if (s !== void 0)
      return s;
    throw Error(`Panel constraints not found for Panel ${t}`);
  }, i = () => {
    const s = n().group.panels.find((l) => l.id === t);
    if (s !== void 0)
      return s;
    throw Error(`Layout not found for Panel ${t}`);
  }, r = () => {
    const s = n().layout[t];
    if (s !== void 0)
      return s;
    throw Error(`Layout not found for Panel ${t}`);
  }, f = ({
    nextSize: s,
    panels: l,
    prevLayout: u,
    derivedPanelConstraints: h
  }) => {
    const d = r(), S = l.findIndex((m) => m.id === t), z = S === 0, c = S === l.length - 1;
    if (c && s < d && (z || l.slice(0, S).every((m, v) => {
      const b = h[v];
      return b?.collapsible && I(b.collapsedSize, u[b.panelId]);
    }))) {
      const m = l.slice(0, S).reduce((v, b) => v + u[b.id], 0);
      return {
        ...u,
        [t]: O(100 - m)
      };
    }
    return le({
      delta: c ? d - s : s - d,
      initialLayout: u,
      panelConstraints: h,
      pivotIndices: c ? [S - 1, S] : [S, S + 1],
      prevLayout: u,
      trigger: "imperative-api"
    });
  }, a = (s) => {
    const l = r();
    if (s === l)
      return;
    const {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: h,
      group: d,
      groupSize: S,
      layout: z,
      separatorToPanels: c
    } = n(), p = f({
      nextSize: s,
      panels: d.panels,
      prevLayout: z,
      derivedPanelConstraints: h
    }), m = U({
      layout: p,
      panelConstraints: h
    });
    W(z, m) || $(d, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: h,
      groupSize: S,
      layout: m,
      separatorToPanels: c
    });
  };
  return {
    collapse: () => {
      const { collapsible: s, collapsedSize: l } = o(), { mutableValues: u } = i(), h = r();
      s && h !== l && (u.expandToSize = h, a(l));
    },
    expand: () => {
      const { collapsible: s, collapsedSize: l, minSize: u } = o(), { mutableValues: h } = i(), d = r();
      if (s && d === l) {
        let S = h.expandToSize ?? u;
        S === 0 && (S = 1), a(S);
      }
    },
    getSize: () => {
      const { group: s } = n(), l = r(), { element: u } = i(), h = s.orientation === "horizontal" ? u.offsetWidth : u.offsetHeight;
      return {
        asPercentage: l,
        inPixels: h
      };
    },
    isCollapsed: () => {
      const { collapsible: s, collapsedSize: l } = o(), u = r();
      return s && I(l, u);
    },
    resize: (s) => {
      const { group: l } = n(), { element: u } = i(), h = ne({ group: l }), d = ie({
        groupSize: h,
        panelElement: u,
        styleProp: s
      }), S = O(d / h * 100);
      a(S);
    }
  };
}
function Te(e) {
  if (e.defaultPrevented)
    return;
  const t = X();
  xe(e, t).forEach((o) => {
    if (o.separator && !o.separator.disableDoubleClick) {
      const i = o.panels.find(
        (r) => r.panelConstraints.defaultSize !== void 0
      );
      if (i) {
        const r = i.panelConstraints.defaultSize, f = tt({
          groupId: o.group.id,
          panelId: i.id
        });
        f && r !== void 0 && (f.resize(r), e.preventDefault());
      }
    }
  });
}
function pe(e) {
  const t = X();
  for (const [n] of t)
    if (n.separators.some(
      (o) => o.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function nt({
  groupId: e
}) {
  const t = () => {
    const n = X();
    for (const [o, i] of n)
      if (o.id === e)
        return { group: o, ...i };
    throw Error(`Could not find Group with id "${e}"`);
  };
  return {
    getLayout() {
      const { defaultLayoutDeferred: n, layout: o } = t();
      return n ? {} : o;
    },
    setLayout(n) {
      const {
        defaultLayoutDeferred: o,
        derivedPanelConstraints: i,
        group: r,
        groupSize: f,
        layout: a,
        separatorToPanels: s
      } = t(), l = U({
        layout: n,
        panelConstraints: i
      });
      return o ? a : (W(a, l) || $(r, {
        defaultLayoutDeferred: o,
        derivedPanelConstraints: i,
        groupSize: f,
        layout: l,
        separatorToPanels: s
      }), l);
    }
  };
}
function B(e, t) {
  const n = pe(e), o = H(n.id, true), i = n.separators.find(
    (h) => h.element === e
  );
  C(i, "Matching separator not found");
  const r = o.separatorToPanels.get(i);
  C(r, "Matching panels not found");
  const f = r.map((h) => n.panels.indexOf(h)), s = nt({ groupId: n.id }).getLayout(), l = le({
    delta: t,
    initialLayout: s,
    panelConstraints: o.derivedPanelConstraints,
    pivotIndices: f,
    prevLayout: s,
    trigger: "keyboard"
  }), u = U({
    layout: l,
    panelConstraints: o.derivedPanelConstraints
  });
  W(s, u) || $(n, {
    defaultLayoutDeferred: o.defaultLayoutDeferred,
    derivedPanelConstraints: o.derivedPanelConstraints,
    groupSize: o.groupSize,
    layout: u,
    separatorToPanels: o.separatorToPanels
  });
}
function Ge(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = pe(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && B(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && B(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && B(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && B(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), B(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const o = pe(t), i = H(o.id, true), { derivedPanelConstraints: r, layout: f, separatorToPanels: a } = i, s = o.separators.find(
          (d) => d.element === t
        );
        C(s, "Matching separator not found");
        const l = a.get(s);
        C(l, "Matching panels not found");
        const u = l[0], h = r.find(
          (d) => d.panelId === u.id
        );
        if (C(h, "Panel metadata not found"), h.collapsible) {
          const d = f[u.id], S = h.collapsedSize === d ? o.mutableState.expandedPanelSizes[u.id] ?? h.minSize : h.collapsedSize;
          B(t, S - d);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const i = pe(t).separators.map(
          (s) => s.element
        ), r = Array.from(i).findIndex(
          (s) => s === e.currentTarget
        );
        C(r !== null, "Index not found");
        const f = e.shiftKey ? r > 0 ? r - 1 : i.length - 1 : r + 1 < i.length ? r + 1 : 0;
        i[f].focus({
          preventScroll: true
        });
        break;
      }
      case "Home": {
        e.preventDefault(), B(t, -100);
        break;
      }
    }
}
var ee = {
  cursorFlags: 0,
  state: "inactive"
};
var Pe = new Ze();
function K() {
  return ee;
}
function Gt(e) {
  return Pe.addListener("change", e);
}
function At(e) {
  const t = ee, n = { ...ee };
  n.cursorFlags = e, ee = n, Pe.emit("change", {
    prev: t,
    next: n
  });
}
function te(e) {
  const t = ee;
  ee = e, Pe.emit("change", {
    prev: t,
    next: e
  });
}
function Ae(e) {
  if (e.defaultPrevented)
    return;
  if (e.pointerType === "mouse" && e.button > 0)
    return;
  const t = X(), n = xe(e, t), o = /* @__PURE__ */ new Map();
  let i = false;
  n.forEach((r) => {
    r.separator && (i || (i = true, r.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: false,
      preventScroll: true
    })));
    const f = t.get(r.group);
    f && o.set(r.group, f.layout);
  }), te({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: o,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
var Ft = (e) => e;
var ye = () => {
};
var ot = 1;
var it = 2;
var rt = 4;
var st = 8;
var Fe = 3;
var Ne = 12;
var de;
function _e2() {
  return de === void 0 && (de = false, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (de = true)), de;
}
function Nt({
  cursorFlags: e,
  groups: t,
  state: n
}) {
  let o = 0, i = 0;
  switch (n) {
    case "active":
    case "hover":
      t.forEach((r) => {
        if (!r.mutableState.disableCursor)
          switch (r.orientation) {
            case "horizontal": {
              o++;
              break;
            }
            case "vertical": {
              i++;
              break;
            }
          }
      });
  }
  if (!(o === 0 && i === 0)) {
    switch (n) {
      case "active": {
        if (e && _e2()) {
          const r = (e & ot) !== 0, f = (e & it) !== 0, a = (e & rt) !== 0, s = (e & st) !== 0;
          if (r)
            return a ? "se-resize" : s ? "ne-resize" : "e-resize";
          if (f)
            return a ? "sw-resize" : s ? "nw-resize" : "w-resize";
          if (a)
            return "s-resize";
          if (s)
            return "n-resize";
        }
        break;
      }
    }
    return _e2() ? o > 0 && i > 0 ? "move" : o > 0 ? "ew-resize" : "ns-resize" : o > 0 && i > 0 ? "grab" : o > 0 ? "col-resize" : "row-resize";
  }
}
var $e = /* @__PURE__ */ new WeakMap();
function we(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = $e.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const o = K();
  switch (o.state) {
    case "active":
    case "hover": {
      const i = Nt({
        cursorFlags: o.cursorFlags,
        groups: o.hitRegions.map((f) => f.group),
        state: o.state
      }), r = `*, *:hover {cursor: ${i} !important; }`;
      if (t === r)
        return;
      t = r, i ? n.cssRules.length === 0 ? n.insertRule(r) : n.replaceSync(r) : n.cssRules.length === 1 && n.deleteRule(0);
      break;
    }
    case "inactive": {
      t = void 0, n.cssRules.length === 1 && n.deleteRule(0);
      break;
    }
  }
  $e.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
function at({
  document: e,
  event: t,
  hitRegions: n,
  initialLayoutMap: o,
  mountedGroups: i,
  pointerDownAtPoint: r,
  prevCursorFlags: f
}) {
  let a = 0;
  n.forEach((l) => {
    const { group: u, groupSize: h } = l, { orientation: d, panels: S } = u, { disableCursor: z } = u.mutableState;
    let c = 0;
    r ? d === "horizontal" ? c = (t.clientX - r.x) / h * 100 : c = (t.clientY - r.y) / h * 100 : d === "horizontal" ? c = t.clientX < 0 ? -100 : 100 : c = t.clientY < 0 ? -100 : 100;
    const p = o.get(u), m = i.get(u);
    if (!p || !m)
      return;
    const {
      defaultLayoutDeferred: v,
      derivedPanelConstraints: b,
      groupSize: y,
      layout: g,
      separatorToPanels: P
    } = m;
    if (b && g && P) {
      const M = le({
        delta: c,
        initialLayout: p,
        panelConstraints: b,
        pivotIndices: l.panels.map((w) => S.indexOf(w)),
        prevLayout: g,
        trigger: "mouse-or-touch"
      });
      if (W(M, g)) {
        if (c !== 0 && !z)
          switch (d) {
            case "horizontal": {
              a |= c < 0 ? ot : it;
              break;
            }
            case "vertical": {
              a |= c < 0 ? rt : st;
              break;
            }
          }
      } else
        $(l.group, {
          defaultLayoutDeferred: v,
          derivedPanelConstraints: b,
          groupSize: y,
          layout: M,
          separatorToPanels: P
        });
    }
  });
  let s = 0;
  t.movementX === 0 ? s |= f & Fe : s |= a & Fe, t.movementY === 0 ? s |= f & Ne : s |= a & Ne, At(s), we(e);
}
function je(e) {
  const t = X(), n = K();
  switch (n.state) {
    case "active":
      at({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function He(e) {
  if (e.defaultPrevented)
    return;
  const t = K(), n = X();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        te({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((o) => {
          const i = H(o.group.id, true);
          $(o.group, i);
        });
        return;
      }
      for (const o of t.hitRegions)
        if (o.separator) {
          const { element: i } = o.separator;
          i.hasPointerCapture?.(e.pointerId) || i.setPointerCapture?.(e.pointerId);
        }
      at({
        document: e.currentTarget,
        event: e,
        hitRegions: t.hitRegions,
        initialLayoutMap: t.initialLayoutMap,
        mountedGroups: n,
        pointerDownAtPoint: t.pointerDownAtPoint,
        prevCursorFlags: t.cursorFlags
      });
      break;
    }
    default: {
      const o = xe(e, n);
      o.length === 0 ? t.state !== "inactive" && te({
        cursorFlags: 0,
        state: "inactive"
      }) : te({
        cursorFlags: 0,
        hitRegions: o,
        state: "hover"
      }), we(e.currentTarget);
      break;
    }
  }
}
function Ve(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (K().state) {
      case "hover":
        te({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Be(e) {
  if (e.defaultPrevented)
    return;
  if (e.pointerType === "mouse" && e.button > 0)
    return;
  const t = K();
  switch (t.state) {
    case "active":
      te({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (we(e.currentTarget), t.hitRegions.forEach((n) => {
        const o = H(n.group.id, true);
        $(n.group, o);
      }), e.preventDefault());
  }
}
function We(e) {
  let t = 0, n = 0;
  const o = {};
  for (const r of e)
    if (r.defaultSize !== void 0) {
      t++;
      const f = O(r.defaultSize);
      n += f, o[r.panelId] = f;
    } else
      o[r.panelId] = void 0;
  const i = e.length - t;
  if (i !== 0) {
    const r = O((100 - n) / i);
    for (const f of e)
      f.defaultSize === void 0 && (o[f.panelId] = r);
  }
  return o;
}
function _t(e, t, n) {
  if (!n[0])
    return;
  const i = e.panels.find((l) => l.element === t);
  if (!i || !i.onResize)
    return;
  const r = ne({ group: e }), f = e.orientation === "horizontal" ? i.element.offsetWidth : i.element.offsetHeight, a = i.mutableValues.prevSize, s = {
    asPercentage: O(f / r * 100),
    inPixels: f
  };
  i.mutableValues.prevSize = s, i.onResize(s, i.id, a);
}
function $t(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return false;
  for (const o in e)
    if (e[o] !== t[o])
      return false;
  return true;
}
function jt({
  group: e,
  nextGroupSize: t,
  prevGroupSize: n,
  prevLayout: o
}) {
  if (n <= 0 || t <= 0 || n === t)
    return o;
  let i = 0, r = 0, f = false;
  const a = /* @__PURE__ */ new Map(), s = [];
  for (const h of e.panels) {
    const d = o[h.id] ?? 0;
    switch (h.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        f = true;
        const S = d / 100 * n, z = O(
          S / t * 100
        );
        a.set(h.id, z), i += z;
        break;
      }
      case "preserve-relative-size":
      default: {
        s.push(h.id), r += d;
        break;
      }
    }
  }
  if (!f || s.length === 0)
    return o;
  const l = 100 - i, u = { ...o };
  if (a.forEach((h, d) => {
    u[d] = h;
  }), r > 0)
    for (const h of s) {
      const d = o[h] ?? 0;
      u[h] = O(
        d / r * l
      );
    }
  else {
    const h = O(
      l / s.length
    );
    for (const d of s)
      u[d] = h;
  }
  return u;
}
function Ht(e, t) {
  const n = e.map((i) => i.id), o = Object.keys(t);
  if (n.length !== o.length)
    return false;
  for (const i of n)
    if (!o.includes(i))
      return false;
  return true;
}
var J = /* @__PURE__ */ new Map();
function Vt(e) {
  let t = true;
  C(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, o = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), r = new n((c) => {
    for (const p of c) {
      const { borderBoxSize: m, target: v } = p;
      if (v === e.element) {
        if (t) {
          const b = ne({ group: e });
          if (b === 0)
            return;
          const y = H(e.id);
          if (!y)
            return;
          const g = ve(e), P = y.defaultLayoutDeferred ? We(g) : y.layout, M = jt({
            group: e,
            nextGroupSize: b,
            prevGroupSize: y.groupSize,
            prevLayout: P
          }), w = U({
            layout: M,
            panelConstraints: g
          });
          if (!y.defaultLayoutDeferred && W(y.layout, w) && $t(
            y.derivedPanelConstraints,
            g
          ) && y.groupSize === b)
            return;
          $(e, {
            defaultLayoutDeferred: false,
            derivedPanelConstraints: g,
            groupSize: b,
            layout: w,
            separatorToPanels: y.separatorToPanels
          });
        }
      } else
        _t(e, v, m);
    }
  });
  r.observe(e.element), e.panels.forEach((c) => {
    C(
      !o.has(c.id),
      `Panel ids must be unique; id "${c.id}" was used more than once`
    ), o.add(c.id), c.onResize && r.observe(c.element);
  });
  const f = ne({ group: e }), a = ve(e), s = e.panels.map(({ id: c }) => c).join(",");
  let l = e.mutableState.defaultLayout;
  l && (Ht(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[s] ?? l ?? We(a), h = U({
    layout: u,
    panelConstraints: a
  }), d = e.element.ownerDocument;
  J.set(
    d,
    (J.get(d) ?? 0) + 1
  );
  const S = /* @__PURE__ */ new Map();
  return Je(e).forEach((c) => {
    c.separator && S.set(c.separator, c.panels);
  }), $(e, {
    defaultLayoutDeferred: f === 0,
    derivedPanelConstraints: a,
    groupSize: f,
    layout: h,
    separatorToPanels: S
  }), e.separators.forEach((c) => {
    C(
      !i.has(c.id),
      `Separator ids must be unique; id "${c.id}" was used more than once`
    ), i.add(c.id), c.element.addEventListener("keydown", Ge);
  }), J.get(d) === 1 && (d.addEventListener("dblclick", Te, true), d.addEventListener("pointerdown", Ae, true), d.addEventListener("pointerleave", je), d.addEventListener("pointermove", He), d.addEventListener("pointerout", Ve), d.addEventListener("pointerup", Be, true)), function() {
    t = false, J.set(
      d,
      Math.max(0, (J.get(d) ?? 0) - 1)
    ), Lt(e), e.separators.forEach((p) => {
      p.element.removeEventListener("keydown", Ge);
    }), J.get(d) || (d.removeEventListener(
      "dblclick",
      Te,
      true
    ), d.removeEventListener(
      "pointerdown",
      Ae,
      true
    ), d.removeEventListener("pointerleave", je), d.removeEventListener("pointermove", He), d.removeEventListener("pointerout", Ve), d.removeEventListener("pointerup", Be, true)), r.disconnect();
  };
}
function Bt() {
  const [e, t] = useState({}), n = useCallback(() => t({}), []);
  return [e, n];
}
function Le(e) {
  const t = useId();
  return `${e ?? t}`;
}
var q = typeof window < "u" ? useLayoutEffect : useEffect;
function se(e) {
  const t = useRef(e);
  return q(() => {
    t.current = e;
  }, [e]), useCallback(
    (...n) => t.current?.(...n),
    [t]
  );
}
function Ce(...e) {
  return se((t) => {
    e.forEach((n) => {
      if (n)
        switch (typeof n) {
          case "function": {
            n(t);
            break;
          }
          case "object": {
            n.current = t;
            break;
          }
        }
    });
  });
}
function Re(e) {
  const t = useRef({ ...e });
  return q(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
var lt = createContext(null);
function Wt(e, t) {
  const n = useRef({
    getLayout: () => ({}),
    setLayout: Ft
  });
  useImperativeHandle(t, () => n.current, []), q(() => {
    Object.assign(
      n.current,
      nt({ groupId: e })
    );
  });
}
function Ut({
  children: e,
  className: t,
  defaultLayout: n,
  disableCursor: o,
  disabled: i,
  elementRef: r,
  groupRef: f,
  id: a,
  onLayoutChange: s,
  onLayoutChanged: l,
  orientation: u = "horizontal",
  resizeTargetMinimumSize: h = {
    coarse: 20,
    fine: 10
  },
  style: d,
  ...S
}) {
  const z = useRef({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), c = se((x) => {
    W(z.current.onLayoutChange, x) || (z.current.onLayoutChange = x, s?.(x));
  }), p = se((x) => {
    W(z.current.onLayoutChanged, x) || (z.current.onLayoutChanged = x, l?.(x));
  }), m = Le(a), v = useRef(null), [b, y] = Bt(), g = useRef({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: h,
    separators: []
  }), P = Ce(v, r);
  Wt(m, f);
  const M = se(
    (x, L) => {
      const k = K(), R = ke(x), E = H(x);
      if (E) {
        let D = false;
        switch (k.state) {
          case "active": {
            D = k.hitRegions.some(
              (V) => V.group === R
            );
            break;
          }
        }
        return {
          flexGrow: E.layout[L] ?? 1,
          pointerEvents: D ? "none" : void 0
        };
      }
      if (n?.[L])
        return {
          flexGrow: n?.[L]
        };
    }
  ), w = Re({
    defaultLayout: n,
    disableCursor: o
  }), G = useMemo(
    () => ({
      get disableCursor() {
        return !!w.disableCursor;
      },
      getPanelStyles: M,
      id: m,
      orientation: u,
      registerPanel: (x) => {
        const L = g.current;
        return L.panels = be(u, [
          ...L.panels,
          x
        ]), y(), () => {
          L.panels = L.panels.filter(
            (k) => k !== x
          ), y();
        };
      },
      registerSeparator: (x) => {
        const L = g.current;
        return L.separators = be(u, [
          ...L.separators,
          x
        ]), y(), () => {
          L.separators = L.separators.filter(
            (k) => k !== x
          ), y();
        };
      },
      updatePanelProps: (x, { disabled: L }) => {
        const R = g.current.panels.find(
          (V) => V.id === x
        );
        R && (R.panelConstraints.disabled = L);
        const E = ke(m), D = H(m);
        E && D && $(E, {
          ...D,
          derivedPanelConstraints: ve(E)
        });
      },
      updateSeparatorProps: (x, {
        disabled: L,
        disableDoubleClick: k
      }) => {
        const E = g.current.separators.find(
          (D) => D.id === x
        );
        E && (E.disabled = L, E.disableDoubleClick = k);
      }
    }),
    [M, m, y, u, w]
  ), N = useRef(null);
  return q(() => {
    const x = v.current;
    if (x === null)
      return;
    const L = g.current;
    let k;
    if (w.defaultLayout !== void 0 && Object.keys(w.defaultLayout).length === L.panels.length) {
      k = {};
      for (const j of L.panels) {
        const Y = w.defaultLayout[j.id];
        Y !== void 0 && (k[j.id] = Y);
      }
    }
    const R = {
      disabled: !!i,
      element: x,
      id: m,
      mutableState: {
        defaultLayout: k,
        disableCursor: !!w.disableCursor,
        expandedPanelSizes: g.current.lastExpandedPanelSizes,
        layouts: g.current.layouts
      },
      orientation: u,
      panels: L.panels,
      resizeTargetMinimumSize: L.resizeTargetMinimumSize,
      separators: L.separators
    };
    N.current = R;
    const E = Vt(R), { defaultLayoutDeferred: D, derivedPanelConstraints: V, layout: ue } = H(R.id, true);
    !D && V.length > 0 && (c(ue), p(ue));
    const oe = ze(m, (j) => {
      const { defaultLayoutDeferred: Y, derivedPanelConstraints: Ee, layout: ce } = j.next;
      if (Y || Ee.length === 0)
        return;
      const ut = R.panels.map(({ id: _39 }) => _39).join(",");
      R.mutableState.layouts[ut] = ce, Ee.forEach((_39) => {
        if (_39.collapsible) {
          const { layout: ge } = j.prev ?? {};
          if (ge) {
            const ft = I(
              _39.collapsedSize,
              ce[_39.panelId]
            ), dt = I(
              _39.collapsedSize,
              ge[_39.panelId]
            );
            ft && !dt && (R.mutableState.expandedPanelSizes[_39.panelId] = ge[_39.panelId]);
          }
        }
      });
      const ct = K().state !== "active";
      c(ce), ct && p(ce);
    });
    return () => {
      N.current = null, E(), oe();
    };
  }, [
    i,
    m,
    p,
    c,
    u,
    b,
    w
  ]), useEffect(() => {
    const x = N.current;
    x && (x.mutableState.defaultLayout = n, x.mutableState.disableCursor = !!o);
  }), /* @__PURE__ */ jsx(lt.Provider, { value: G, children: /* @__PURE__ */ jsx(
    "div",
    {
      ...S,
      className: t,
      "data-group": true,
      "data-testid": m,
      id: m,
      ref: P,
      style: {
        height: "100%",
        width: "100%",
        overflow: "hidden",
        ...d,
        display: "flex",
        flexDirection: u === "horizontal" ? "row" : "column",
        flexWrap: "nowrap",
        // Inform the browser that the library is handling touch events for this element
        // but still allow users to scroll content within panels in the non-resizing direction
        // NOTE This is not an inherited style
        // See github.com/bvaughn/react-resizable-panels/issues/662
        touchAction: u === "horizontal" ? "pan-y" : "pan-x"
      },
      children: e
    }
  ) });
}
Ut.displayName = "Group";
function Me() {
  const e = useContext(lt);
  return C(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function qt(e, t) {
  const { id: n } = Me(), o = useRef({
    collapse: ye,
    expand: ye,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => false,
    resize: ye
  });
  useImperativeHandle(t, () => o.current, []), q(() => {
    Object.assign(
      o.current,
      tt({ groupId: n, panelId: e })
    );
  });
}
function Yt({
  children: e,
  className: t,
  collapsedSize: n = "0%",
  collapsible: o = false,
  defaultSize: i,
  disabled: r,
  elementRef: f,
  groupResizeBehavior: a = "preserve-relative-size",
  id: s,
  maxSize: l = "100%",
  minSize: u = "0%",
  onResize: h,
  panelRef: d,
  style: S,
  ...z
}) {
  const c = !!s, p = Le(s), m = Re({
    disabled: r
  }), v = useRef(null), b = Ce(v, f), {
    getPanelStyles: y,
    id: g,
    orientation: P,
    registerPanel: M,
    updatePanelProps: w
  } = Me(), G = h !== null, N = se(
    (R, E, D) => {
      h?.(R, s, D);
    }
  );
  q(() => {
    const R = v.current;
    if (R !== null) {
      const E = {
        element: R,
        id: p,
        idIsStable: c,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: G ? N : void 0,
        panelConstraints: {
          groupResizeBehavior: a,
          collapsedSize: n,
          collapsible: o,
          defaultSize: i,
          disabled: m.disabled,
          maxSize: l,
          minSize: u
        }
      };
      return M(E);
    }
  }, [
    a,
    n,
    o,
    i,
    G,
    p,
    c,
    l,
    u,
    N,
    M,
    m
  ]), useEffect(() => {
    w(p, { disabled: r });
  }, [r, p, w]), qt(p, d);
  const x = () => {
    const R = y(g, p);
    if (R)
      return JSON.stringify(R);
  }, L = useSyncExternalStore(
    (R) => ze(g, R),
    x,
    x
  );
  let k;
  return L ? k = JSON.parse(L) : i !== void 0 ? k = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: i
  } : k = { flexGrow: 1 }, /* @__PURE__ */ jsx(
    "div",
    {
      ...z,
      "data-disabled": r || void 0,
      "data-panel": true,
      "data-testid": p,
      id: p,
      ref: b,
      style: {
        ...Jt,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...k
      },
      children: /* @__PURE__ */ jsx(
        "div",
        {
          className: t,
          style: {
            maxHeight: "100%",
            maxWidth: "100%",
            flexGrow: 1,
            overflow: "auto",
            ...S,
            // Inform the browser that the library is handling touch events for this element
            // but still allow users to scroll content within panels in the non-resizing direction
            // NOTE This is not an inherited style
            // See github.com/bvaughn/react-resizable-panels/issues/662
            touchAction: P === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
Yt.displayName = "Panel";
var Jt = {
  minHeight: 0,
  maxHeight: "100%",
  height: "auto",
  minWidth: 0,
  maxWidth: "100%",
  width: "auto",
  border: "none",
  borderWidth: 0,
  padding: 0,
  margin: 0
};
function Zt({
  layout: e,
  panelConstraints: t,
  panelId: n,
  panelIndex: o
}) {
  let i, r;
  const f = e[n], a = t.find(
    (s) => s.panelId === n
  );
  if (a) {
    const s = a.maxSize, l = a.collapsible ? a.collapsedSize : a.minSize, u = [o, o + 1];
    r = U({
      layout: le({
        delta: l - f,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], i = U({
      layout: le({
        delta: s - f,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n];
  }
  return {
    valueControls: n,
    valueMax: i,
    valueMin: r,
    valueNow: f
  };
}
function Qt({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: o,
  elementRef: i,
  id: r,
  style: f,
  ...a
}) {
  const s = Le(r), l = Re({
    disabled: n,
    disableDoubleClick: o
  }), [u, h] = useState({}), [d, S] = useState("inactive"), [z, c] = useState(false), p = useRef(null), m = Ce(p, i), {
    disableCursor: v,
    id: b,
    orientation: y,
    registerSeparator: g,
    updateSeparatorProps: P
  } = Me(), M = y === "horizontal" ? "vertical" : "horizontal";
  q(() => {
    const N = p.current;
    if (N !== null) {
      const x = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: N,
        id: s
      }, L = g(x), k = Gt(
        (E) => {
          S(
            E.next.state !== "inactive" && E.next.hitRegions.some(
              (D) => D.separator === x
            ) ? E.next.state : "inactive"
          );
        }
      ), R = ze(
        b,
        (E) => {
          const { derivedPanelConstraints: D, layout: V, separatorToPanels: ue } = E.next, oe = ue.get(x);
          if (oe) {
            const j = oe[0], Y = oe.indexOf(j);
            h(
              Zt({
                layout: V,
                panelConstraints: D,
                panelId: j.id,
                panelIndex: Y
              })
            );
          }
        }
      );
      return () => {
        k(), R(), L();
      };
    }
  }, [b, s, g, l]), useEffect(() => {
    P(s, { disabled: n, disableDoubleClick: o });
  }, [n, o, s, P]);
  let w;
  n && !v && (w = "not-allowed");
  let G;
  if (n)
    G = "disabled";
  else
    switch (d) {
      case "active": {
        G = "active";
        break;
      }
      default:
        z ? G = "focus" : G = d;
    }
  return /* @__PURE__ */ jsx(
    "div",
    {
      ...a,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": M,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": G,
      "data-testid": s,
      id: s,
      onBlur: () => c(false),
      onFocus: () => c(true),
      ref: m,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: w,
        ...f,
        flexGrow: 0,
        flexShrink: 0,
        // Inform the browser that the library is handling touch events for this element
        // See github.com/bvaughn/react-resizable-panels/issues/662
        touchAction: "none"
      },
      tabIndex: n ? void 0 : 0
    }
  );
}
Qt.displayName = "Separator";
var _3 = window._ || ((text) => text);
var NARROW_BREAKPOINT = 768;
var useIsNarrow = (breakpoint = NARROW_BREAKPOINT) => {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const handler = () => setNarrow(window.innerWidth < breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return narrow;
};
var ActionsButtonStack = ({ direction, children }) => /* @__PURE__ */ jsx(
  "div",
  {
    style: {
      display: "flex",
      alignItems: direction === "column" ? "stretch" : "center",
      flexDirection: direction,
      gap: 8,
      flexWrap: direction === "row" ? "wrap" : "nowrap"
    },
    children
  }
);
var VerticalActionsLayout = ({ position, onBarMount, children }) => {
  const { token } = theme.useToken();
  const narrow = useIsNarrow();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mountRef = useCallback(
    (el) => onBarMount(el),
    [onBarMount]
  );
  const isVertical = position === "left" || position === "right";
  const stickyOffset = 80;
  const sideOffset = 16;
  const sideKey = position === "left" ? "left" : "right";
  const useDrawer = isVertical && narrow;
  const useFixedBar = isVertical && !narrow;
  const contentSidePadding = useFixedBar ? 72 : 0;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    useFixedBar && /* @__PURE__ */ jsx(
      "div",
      {
        ref: mountRef,
        style: {
          position: "fixed",
          top: stickyOffset,
          [sideKey]: sideOffset,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 8,
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
          boxShadow: token.boxShadowTertiary,
          zIndex: 5
        }
      }
    ),
    useDrawer && /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "fixed",
          top: stickyOffset,
          [sideKey]: sideOffset,
          zIndex: 1001
        },
        children: /* @__PURE__ */ jsx(Tooltip, { title: _3("Actions"), placement: sideKey === "left" ? "right" : "left", children: /* @__PURE__ */ jsx(
          Button,
          {
            size: "small",
            icon: /* @__PURE__ */ jsx(MenuOutlined, {}),
            onClick: () => setDrawerOpen(true)
          }
        ) })
      }
    ),
    /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          paddingLeft: sideKey === "left" ? contentSidePadding : 0,
          paddingRight: sideKey === "right" ? contentSidePadding : 0
        },
        children
      }
    ),
    useDrawer && /* @__PURE__ */ jsx(
      Drawer,
      {
        title: _3("Actions"),
        placement: sideKey,
        open: drawerOpen,
        onClose: () => setDrawerOpen(false),
        width: 240,
        forceRender: true,
        children: /* @__PURE__ */ jsx(
          "div",
          {
            ref: mountRef,
            style: { display: "flex", flexDirection: "column", gap: 8 }
          }
        )
      }
    )
  ] });
};

// src/components/DynamicResource/utils/model.ts
var getRecordId = (record, fields) => {
  if (!record) return void 0;
  if (fields) {
    const pkField = fields.find((f) => f.isPk);
    if (pkField) return record[pkField.key];
  }
  return record.eid ?? record.id;
};
var getListViewFields = (model, filterField) => {
  const baseFields = filterField ? model.fields.filter((field) => field.key !== filterField) : model.fields;
  return baseFields.slice(0, 6);
};
var hasReferenceModel = (reference, allModels) => {
  if (!reference || !allModels) return false;
  const target = reference.toLowerCase();
  return allModels.some(
    (model) => model.name.toLowerCase() === target || model.label && model.label.toLowerCase() === target || model.resource && model.resource.toLowerCase() === target
  );
};
var normalizeModelKey = (value) => {
  let normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.includes(".")) {
    normalized = normalized.split(".").pop() || normalized;
  }
  if (normalized.includes("/")) {
    normalized = normalized.split("/").pop() || normalized;
  }
  normalized = normalized.replace(/^cw_/i, "");
  normalized = normalized.replace(/[^a-z0-9]/gi, "");
  return normalized.toLowerCase();
};
var resolveModelByEntityType = (allModels, typeValue) => {
  if (!typeValue) return void 0;
  const target = normalizeModelKey(typeValue);
  if (!target) return void 0;
  return allModels.find((model) => {
    const nameKey = normalizeModelKey(model.name);
    const labelKey = normalizeModelKey(model.label);
    return nameKey === target || labelKey === target;
  });
};
var matchesPolymorphicType = (rel, typeValue) => {
  if (!rel.polymorphicType) return true;
  if (!typeValue) return false;
  return String(typeValue).toLowerCase() === String(rel.polymorphicType).toLowerCase();
};
var isFileModel = (model) => {
  const name = (model?.name || "").toLowerCase();
  return name === "file";
};
var findModelByName = (models, name) => {
  if (!models || !name) return void 0;
  const target = name.toLowerCase();
  const normalizedTarget = normalizeModelKey(name);
  return models.find((model) => {
    if (model.name.toLowerCase() === target) return true;
    if (model.label.toLowerCase() === target) return true;
    if (model.resource && model.resource.toLowerCase() === target) return true;
    if (normalizedTarget) {
      const nameKey = normalizeModelKey(model.name);
      const labelKey = normalizeModelKey(model.label);
      const resourceKey = normalizeModelKey(model.resource || "");
      if (nameKey === normalizedTarget || labelKey === normalizedTarget || resourceKey === normalizedTarget) return true;
    }
    return false;
  });
};
var resolveResourcePath = (name, allModels) => {
  if (!name) return "";
  const model = findModelByName(allModels, name);
  if (model?.resource) return model.resource;
  if (model?.name) return model.name.toLowerCase();
  return name.toLowerCase();
};
var resolveModelName = (name, allModels) => {
  if (!name) return "";
  const model = findModelByName(allModels, name);
  return model?.name || name;
};
var getPolymorphicReferenceInfo = (rel, relationModel, allModels) => {
  if (!rel.otherKey || rel.otherResource || !allModels) return null;
  const field = relationModel.fields.find((f) => f.key === rel.otherKey);
  if (!field?.reference) return null;
  const referenceModel = findModelByName(allModels, field.reference);
  if (!referenceModel) return null;
  const hasTypeField = referenceModel.fields.some((f) => f.key === "type");
  if (!hasTypeField) return null;
  return { referenceResource: resolveResourcePath(field.referencePath || field.reference, allModels), referenceModel };
};
var getRecordDisplayLabel = (record) => {
  if (!record) return "-";
  if (record._label !== void 0 && record._label !== null) return String(record._label);
  if (record.label !== void 0 && record.label !== null) return String(record.label);
  if (record.name !== void 0 && record.name !== null) return String(record.name);
  if (record.title !== void 0 && record.title !== null) return String(record.title);
  const id = record.eid ?? record.id;
  return id !== void 0 && id !== null ? String(id) : "-";
};

// src/components/DynamicResource/utils/i18n.ts
var _4 = window._ || ((text) => text);
var asDisplayText = (value, fallback = "") => {
  if (value === null || value === void 0) return fallback;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
};
var translateText = (key, fallback) => {
  const safeKey = asDisplayText(key, "");
  if (!safeKey) return fallback ?? "";
  const translated = _4(safeKey);
  return asDisplayText(translated, fallback ?? safeKey);
};
var MODULE_LABEL_OVERRIDES = {
  pim: _4("Items"),
  bsim: _4("Business"),
  cusim: "Cusim",
  venim: "Venim",
  vendeals: "Vendeals",
  dismdm: _4("Master Data"),
  prices: _4("Prices"),
  pricing: _4("Pricing"),
  inventory: _4("Inventory"),
  supply: _4("Supply"),
  supplychain: _4("Supply Chain"),
  catman: _4("Category Management"),
  conflictresolution: _4("Resolution"),
  planscope: _4("Plan Scope"),
  alloplan: _4("Allocations"),
  pricingstrategy: _4("Pricing Strategy"),
  catim: _4("Catalog"),
  nlp: _4("Natural Language"),
  dbquery: _4("DB Query")
};
var getModuleLabel = (moduleName) => {
  if (!moduleName) return "";
  const key = moduleName.toLowerCase();
  if (MODULE_LABEL_OVERRIDES[key]) return MODULE_LABEL_OVERRIDES[key];
  return translateText(moduleName, moduleName);
};
var getFieldLabel = (field) => {
  const keySource = asDisplayText(field.key, "");
  if (keySource) {
    const keyTranslated = translateText(keySource, keySource);
    if (keyTranslated !== keySource) return keyTranslated;
  }
  const labelSource = asDisplayText(field.label, "");
  if (labelSource) {
    const labelTranslated = translateText(labelSource, labelSource);
    if (labelTranslated !== labelSource) return labelTranslated;
  }
  return labelSource || keySource;
};
var primaryTranslate = (key) => {
  const fn = window.__jmPrimaryTranslate;
  return typeof fn === "function" ? fn(key) ?? null : null;
};
var translateRelationKey = (rawKey) => {
  const key = String(rawKey || "").trim();
  if (!key) return "";
  if (key.endsWith("_reverse")) {
    const base = key.replace(/_reverse$/, "");
    const primaryDirect = primaryTranslate(key);
    if (primaryDirect) return primaryDirect;
    const primaryObject = primaryTranslate(`${base}_object`);
    if (primaryObject) return primaryObject;
    const primaryBase = primaryTranslate(base);
    if (primaryBase) return primaryBase;
    const direct = translateText(key, key);
    if (direct !== key) return direct;
    const objectTranslated = translateText(`${base}_object`, `${base}_object`);
    if (objectTranslated !== `${base}_object`) return objectTranslated;
    const baseTranslated = translateText(base, base);
    if (baseTranslated !== base) return baseTranslated;
    return key;
  }
  return translateText(key, key);
};
var getRelationLabel = (rel) => {
  const relationKey = String(rel.relationName || rel.resource || "").trim();
  if (!relationKey) return _4(rel.label || "");
  const translatedByKey = translateRelationKey(relationKey);
  if (translatedByKey && translatedByKey !== relationKey) return translatedByKey;
  const withoutRelationSuffix = relationKey.replace(/_relation$/, "");
  if (withoutRelationSuffix && withoutRelationSuffix !== relationKey) {
    const translatedWithoutSuffix = translateRelationKey(withoutRelationSuffix);
    if (translatedWithoutSuffix && translatedWithoutSuffix !== withoutRelationSuffix) {
      return translatedWithoutSuffix;
    }
  }
  if (relationKey.endsWith("_object")) {
    const baseKey = relationKey.replace(/_object$/, "");
    const translatedBaseKey = translateRelationKey(baseKey);
    if (translatedBaseKey && translatedBaseKey !== baseKey) return translatedBaseKey;
  }
  return asDisplayText(relationKey, asDisplayText(rel.label, relationKey));
};
var getModelLabel = (model) => {
  const primary = asDisplayText(model.label, "");
  const fallback = asDisplayText(model.name, "");
  const key = primary || fallback;
  return translateText(key, key || "Record");
};
var applyI18nLabelsToModel = (model) => {
  if (!model) return;
  model.label = getModelLabel(model);
  (model.fields || []).forEach((field) => {
    field.label = getFieldLabel(field);
  });
  (model.relations || []).forEach((rel) => {
    rel.label = getRelationLabel(rel);
  });
};
var applyI18nLabelsToModels = (models) => {
  (models || []).forEach((model) => applyI18nLabelsToModel(model));
};

// src/components/DynamicResource/utils/viewConfig.ts
var _5 = window._ || ((text) => text);
var DETAILS_TAB_NAME = "Details";
var getDefaultViewName = () => _5("default view");
var normalizeViewName = (name) => {
  const trimmed = String(name ?? "").trim();
  return trimmed || getDefaultViewName();
};
var splitRelations = (relations = []) => {
  const isReverse = (r) => {
    if (r.relationName && r.relationName.endsWith("_reverse")) return true;
    return !r.otherResource;
  };
  const embedded = relations.filter((r) => isReverse(r));
  const tabbed = relations.filter((r) => !isReverse(r));
  return { embedded, tabbed };
};
var useViewConfigurations = (modelName, viewType) => {
  const apiUrl = useApiUrl();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(!!modelName);
  useEffect(() => {
    if (!modelName) {
      setLoading(false);
      return;
    }
    let isMounted = true;
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const response = await authenticatedFetch(`${apiUrl}/views/configurations/${modelName}?view_type=${viewType}`);
        if (!response.ok) {
          if (isMounted) setRows([]);
          return;
        }
        const data = await response.json();
        if (isMounted) setRows(Array.isArray(data) ? data : []);
      } catch (error) {
        if (isMounted) setRows([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchConfig();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, modelName, viewType]);
  return { rows, loading };
};
var normalizeActionsPosition = (raw) => {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "left" || v === "right") return v;
  return "top-right";
};
var useViewSettings = () => {
  const apiUrl = useApiUrl();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const fetchSettings = async () => {
      try {
        const response = await authenticatedFetch(`${apiUrl}/config/views`);
        if (!response.ok) {
          if (!cancelled) setLoading(false);
          return;
        }
        const data = await response.json();
        if (cancelled) return;
        const modulesColorSchema = String(data?.modulesColorSchema || "color-coded");
        const modelsColorSchema = String(data?.modelsColorSchema || "color-coded");
        const plainColorBaseHex = String(data?.plainColorBaseHex || "");
        setColorSchemas({ modulesColorSchema, modelsColorSchema, plainColorBaseHex });
        setSettings({
          showViewType: String(data?.showViewType || ""),
          editViewType: String(data?.editViewType || ""),
          listViewType: String(data?.listViewType || ""),
          fileListViewType: String(data?.fileListViewType || ""),
          galleryImageWidth: Number(data?.galleryImageWidth || 180),
          galleryImageHeight: Number(data?.galleryImageHeight || 140),
          relationsMaxRowsToLoad: Number(data?.relationsMaxRowsToLoad || 1e3),
          maxDistinctColumnFilterValuesToRanges: Number(data?.maxDistinctColumnFilterValuesToRanges ?? 20),
          modulesColorSchema,
          modelsColorSchema,
          generalActionsButtonPosition: normalizeActionsPosition(data?.generalActionsButtonPosition),
          addTabsForNonConfiguredRelations: data?.addTabsForNonConfiguredRelations !== false
        });
      } catch {
        if (!cancelled) setSettings(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchSettings();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);
  return { settings, loading };
};
var filterConfigRowsForMode = (rows, mode) => {
  if (rows.length === 0) return rows;
  const allowedTypes = mode === "show" ? /* @__PURE__ */ new Set(["attributes", "details", "show"]) : /* @__PURE__ */ new Set(["main", "edit", "attributes"]);
  const filtered = rows.filter(
    (row) => (
      // Custom-tab rows are always included — form_type doesn't gate them
      !!row.tab_name || allowedTypes.has((row.form_type || "").trim().toLowerCase())
    )
  );
  return filtered.length > 0 ? filtered : rows;
};
var groupConfigRowsBySection = (rows) => {
  const groups = /* @__PURE__ */ new Map();
  rows.forEach((row) => {
    const key = row.section || DETAILS_TAB_NAME;
    const existing = groups.get(key) || [];
    existing.push(row);
    groups.set(key, existing);
  });
  return groups;
};
var groupConfigRowsBySectionId = (rows) => {
  const groups = /* @__PURE__ */ new Map();
  rows.forEach((row) => {
    const key = row.section_id || row.section || DETAILS_TAB_NAME;
    const name = row.section || DETAILS_TAB_NAME;
    if (!groups.has(key)) groups.set(key, { name, rows: [] });
    groups.get(key).rows.push(row);
  });
  return groups;
};
var normalizeSectionRows = (rows) => {
  const normalized = rows.map((row, index) => ({
    ...row,
    _order: index,
    row: row.row ?? index + 1,
    column: row.column ?? 1
  }));
  normalized.sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    if (a.column !== b.column) return a.column - b.column;
    return a._order - b._order;
  });
  return normalized;
};
var resolveFieldFromConfig = (model, item) => {
  const existing = model.fields.find((field) => field.key === item.object_name || field.key === item.name);
  if (existing) return existing;
  const key = item.object_name || item.name;
  return {
    key,
    label: _5(key),
    type: "string"
  };
};
var buildRelationNameVariants = (rawName) => {
  const name = rawName.toLowerCase();
  if (!name) return [];
  if (name.endsWith("_reverse")) {
    return [name, name.replace(/_reverse$/, "")];
  }
  return [name, `${name}_reverse`];
};
var findRelationContextForModel = (model, allModels) => {
  if (!allModels) return null;
  const modelResourceKey = resolveResourcePath(model.resource || model.name, allModels);
  for (const parentModel of allModels) {
    for (const rel of parentModel.relations || []) {
      const relResourceKey = resolveResourcePath(rel.resource, allModels);
      if (relResourceKey === modelResourceKey || rel.resourcePath === modelResourceKey) {
        return { rel, parentModel };
      }
    }
  }
  return null;
};
var applyRelationFieldOverrides = (model, allModels) => {
  const relationContext = findRelationContextForModel(model, allModels);
  if (!relationContext) return model.fields;
  const { rel, parentModel } = relationContext;
  return model.fields.map((field) => {
    if (field.reference) return field;
    if (rel.targetKey && field.key === rel.targetKey) {
      return {
        ...field,
        reference: parentModel.name,
        referencePath: parentModel.resource,
        optionLabel: field.optionLabel || "_label"
      };
    }
    if (rel.otherKey && field.key === rel.otherKey) {
      return {
        ...field,
        reference: rel.otherResource || field.reference,
        referencePath: rel.otherResourcePath,
        optionLabel: field.optionLabel || "_label"
      };
    }
    return field;
  });
};
var resolveRelationFromConfig = (relations, item) => {
  if (!relations) return void 0;
  const target = (item.relation_name || "").toLowerCase();
  const targetVariants = new Set(buildRelationNameVariants(target));
  const exact = relations.find(
    (rel) => (rel.relationName || "").toLowerCase() === target || (rel.resource || "").toLowerCase() === target || (rel.label || "").toLowerCase() === target
  );
  if (exact) return exact;
  return relations.find(
    (rel) => targetVariants.has((rel.relationName || "").toLowerCase()) || targetVariants.has((rel.resource || "").toLowerCase()) || targetVariants.has((rel.label || "").toLowerCase())
  );
};
var buildConfiguredRelationKeys = (rows) => {
  const keys = /* @__PURE__ */ new Set();
  rows.filter((row) => row.attribute_or_relation_type === "relation").forEach((row) => {
    const raw = (row.relation_name || "").toLowerCase();
    buildRelationNameVariants(raw).forEach((name) => {
      if (name) keys.add(name);
    });
  });
  return keys;
};
var relationMatchesConfigured = (rel, configuredKeys) => {
  const candidates = [
    rel.relationName
  ].filter(Boolean).flatMap((value) => buildRelationNameVariants(String(value)));
  return candidates.some((value) => configuredKeys.has(value));
};
var getRelationIdentityKeys = (rel) => {
  const base = [
    String(rel.relationName || "").trim().toLowerCase(),
    String(rel.resource || "").trim().toLowerCase()
  ].filter(Boolean);
  return Array.from(new Set(base.flatMap((value) => buildRelationNameVariants(value))));
};
var buildConfiguredResolvedRelationKeys = (relations, rows) => {
  const keys = /* @__PURE__ */ new Set();
  rows.filter((row) => row.attribute_or_relation_type === "relation").forEach((row) => {
    const resolved = resolveRelationFromConfig(relations, row);
    if (!resolved) return;
    getRelationIdentityKeys(resolved).forEach((key) => keys.add(key));
  });
  return keys;
};
var normalizeLooseRelationKey = (value) => value.toLowerCase().replace(/[\s_-]+/g, "");
var buildConfiguredRelationDisplayKeys = (relations, rows) => {
  const keys = /* @__PURE__ */ new Set();
  rows.filter((row) => row.attribute_or_relation_type === "relation").forEach((row) => {
    const rawRelationName = String(row.relation_name || "").trim();
    if (rawRelationName) keys.add(normalizeLooseRelationKey(rawRelationName));
    const resolved = resolveRelationFromConfig(relations, row);
    if (!resolved) return;
    const label = getRelationLabel(resolved) || resolved.label || resolved.relationName || resolved.resource || "";
    if (label) keys.add(normalizeLooseRelationKey(label));
  });
  return keys;
};
var isRelationConfiguredForDetails = (rel, configuredResolvedRelationKeys, configuredRelationKeys, configuredDisplayKeys) => {
  if (relationMatchesConfigured(rel, configuredResolvedRelationKeys)) return true;
  if (relationMatchesConfigured(rel, configuredRelationKeys)) return true;
  const label = getRelationLabel(rel) || rel.label || rel.relationName || rel.resource || "";
  return configuredDisplayKeys.has(normalizeLooseRelationKey(label));
};
var getConfigVid = (item, mode) => {
  if (mode === "show") {
    return item.show_vid ?? item.showVid ?? item.vid ?? "";
  }
  return item.edit_vid ?? item.editVid ?? item.vid ?? "";
};
var isAttributeValueEditable = (item, mode) => {
  if (!item) return true;
  const vid = String(getConfigVid(item, mode) || "").trim().toLowerCase().replace(/[\s_-]/g, "");
  if (vid === "readonly") return false;
  return true;
};
var normalizeRelationViewType = (rawVid) => {
  const normalized = String(rawVid || "").trim().toLowerCase().replace(/[\s_-]/g, "").replace(/view$/, "");
  if (normalized === "table") return "table";
  if (normalized === "editabletable" || normalized === "editable") return "editable-table";
  if (normalized === "editablelist") return "editable-list";
  if (normalized === "list") return "list";
  if (normalized === "csv") return "csv";
  if (normalized === "gallery" || normalized === "image") return "gallery";
  if (normalized === "calendar" || normalized === "week" || normalized === "month") return "calendar";
  if (normalized === "primary") return "primary";
  if (normalized === "totalsdetails" || normalized === "totaldetails") return "totals-details";
  if (normalized === "tree") return "tree";
  if (normalized === "treedetails") return "tree-details";
  return "";
};
var applyRelationViewOverride = (rel, item, mode) => {
  const rawVid = getConfigVid(item, mode);
  const vid = normalizeRelationViewType(rawVid);
  if (vid) {
    return mode === "show" ? { ...rel, showViewType: vid, showViewTypeFromCsv: true } : { ...rel, editViewType: vid, editViewTypeFromCsv: true };
  }
  const trimmed = String(rawVid || "").trim();
  if (!trimmed) return rel;
  return mode === "show" ? { ...rel, showViewType: "primary", showViewTypeFromCsv: true, showCustomPageName: trimmed } : { ...rel, editViewType: "primary", editViewTypeFromCsv: true, editCustomPageName: trimmed };
};
var _6 = window._ || ((text) => text);
var extractButtonLabel = (node) => {
  if (node === null || node === void 0 || typeof node === "boolean") return null;
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    for (const child of node) {
      const label = extractButtonLabel(child);
      if (label) return label;
    }
    return null;
  }
  if (React6.isValidElement(node)) {
    return extractButtonLabel(node.props?.children);
  }
  return null;
};
var renderIconOnlyButtons = (nodes) => {
  const fallbackLabels = {
    EditButton: _6("Edit"),
    DeleteButton: _6("Delete"),
    ListButton: _6("List"),
    CreateButton: _6("Create"),
    ShowButton: _6("Show"),
    SaveButton: _6("Save")
  };
  const enhanceNode = (node, index) => {
    if (node === null || node === void 0 || typeof node === "boolean") return node;
    if (Array.isArray(node)) return node.map((child, childIndex) => enhanceNode(child, childIndex));
    if (!React6.isValidElement(node)) return node;
    const componentName = node.type?.displayName || node.type?.name;
    if (componentName === "RefreshButton") return null;
    const fallbackLabel = componentName ? fallbackLabels[componentName] : null;
    const nodeProps = node.props;
    if (fallbackLabel) {
      const label = extractButtonLabel(nodeProps?.children) || fallbackLabel;
      const element = React6.cloneElement(node, {
        ...nodeProps,
        hideText: true,
        children: null
      });
      if (!label) return element;
      return /* @__PURE__ */ jsx(Tooltip, { title: label, children: /* @__PURE__ */ jsx("span", { children: element }) }, node.key ?? index);
    }
    if (nodeProps?.icon) {
      const label = extractButtonLabel(nodeProps?.children);
      if (label) {
        const element = React6.cloneElement(node, {
          ...nodeProps,
          children: null
        });
        return /* @__PURE__ */ jsx(Tooltip, { title: label, children: /* @__PURE__ */ jsx("span", { children: element }) }, node.key ?? index);
      }
    }
    if (nodeProps?.children) {
      const mappedChildren = React6.Children.map(nodeProps.children, (child, childIndex) => enhanceNode(child, childIndex));
      return React6.cloneElement(node, {
        ...nodeProps,
        children: mappedChildren
      });
    }
    return node;
  };
  return React6.Children.map(nodes, (child, index) => enhanceNode(child, index));
};
var ResponsiveHeaderButtons = ({ children }) => {
  const screens = Grid.useBreakpoint();
  const { token } = theme.useToken();
  if (screens.md !== false) {
    return /* @__PURE__ */ jsx(Fragment, { children });
  }
  return /* @__PURE__ */ jsx(
    Dropdown,
    {
      trigger: ["click"],
      dropdownRender: () => /* @__PURE__ */ jsx("div", { style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 4,
        padding: 8,
        background: token.colorBgElevated,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary
      }, children }),
      children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(MenuOutlined, {}) })
    }
  );
};
var wrappedPageTitleStyle = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  margin: 0,
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  lineHeight: 1.2
};
var wrapPageTitle = (title) => {
  if (title === null || title === void 0 || title === false) return title;
  return /* @__PURE__ */ jsx("div", { style: wrappedPageTitleStyle, children: title });
};
var wrapTooltipButton = (label, node) => /* @__PURE__ */ jsx(Tooltip, { title: label, children: /* @__PURE__ */ jsx("span", { children: node }) });
var extractButtonLabel2 = (node) => {
  if (node === null || node === void 0 || typeof node === "boolean") return null;
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    for (const child of node) {
      const label = extractButtonLabel2(child);
      if (label) return label;
    }
    return null;
  }
  if (React6.isValidElement(node)) {
    return extractButtonLabel2(node.props?.children);
  }
  return null;
};
var renderIconOnlyButtons2 = (nodes) => {
  const fallbackLabels = {
    EditButton: "Edit",
    DeleteButton: "Delete",
    RefreshButton: "Refresh",
    ListButton: "List",
    CreateButton: "Create",
    ShowButton: "Show",
    SaveButton: "Save"
  };
  const enhanceNode = (node, index) => {
    if (node === null || node === void 0 || typeof node === "boolean") return node;
    if (Array.isArray(node)) return node.map((child, childIndex) => enhanceNode(child, childIndex));
    if (!React6.isValidElement(node)) return node;
    const componentName = node.type?.displayName || node.type?.name;
    const fallbackLabel = componentName ? fallbackLabels[componentName] : null;
    if (fallbackLabel) {
      const label = extractButtonLabel2(node.props?.children) || fallbackLabel;
      const element = React6.cloneElement(node, {
        ...node.props,
        hideText: true,
        children: null
      });
      if (!label) return element;
      return /* @__PURE__ */ jsx(Tooltip, { title: label, children: /* @__PURE__ */ jsx("span", { children: element }) }, node.key ?? index);
    }
    if (node.props?.icon) {
      const label = extractButtonLabel2(node.props?.children);
      if (label) {
        const element = React6.cloneElement(node, {
          ...node.props,
          children: null
        });
        return /* @__PURE__ */ jsx(Tooltip, { title: label, children: /* @__PURE__ */ jsx("span", { children: element }) }, node.key ?? index);
      }
    }
    if (node.props?.children) {
      const mappedChildren = React6.Children.map(node.props.children, (child, childIndex) => enhanceNode(child, childIndex));
      return React6.cloneElement(node, {
        ...node.props,
        children: mappedChildren
      });
    }
    return node;
  };
  return React6.Children.map(nodes, (child, index) => enhanceNode(child, index));
};
var renderStandardShowHeaderButtons = ({
  listButtonProps,
  editButtonProps,
  deleteButtonProps,
  refreshButtonProps
}) => /* @__PURE__ */ jsxs(Fragment, { children: [
  listButtonProps && wrapTooltipButton("List", /* @__PURE__ */ jsx(ListButton, { ...listButtonProps, hideText: true })),
  editButtonProps && wrapTooltipButton("Edit", /* @__PURE__ */ jsx(EditButton, { ...editButtonProps, hideText: true })),
  deleteButtonProps && wrapTooltipButton("Delete", /* @__PURE__ */ jsx(DeleteButton, { ...deleteButtonProps, hideText: true })),
  refreshButtonProps && wrapTooltipButton("Refresh", /* @__PURE__ */ jsx(RefreshButton, { ...refreshButtonProps, hideText: true }))
] });
var STICKY_APP_HEADER_HEIGHT = 36;
var useActionsWrapping = (headerButtons) => {
  const { settings: viewSettings } = useViewSettings();
  const { token } = theme.useToken();
  const paneNav = usePaneNavigation();
  const isInMultiPane = Boolean(paneNav);
  const isDetailPane = Boolean(paneNav && paneNav.paneIndex > 0);
  const actionsPosition = viewSettings?.generalActionsButtonPosition || "top-right";
  const [verticalBarEl, setVerticalBarEl] = useState(null);
  const [topRightEl, setTopRightEl] = useState(null);
  const wrappedHeaderButtons = (ctx) => {
    const raw = typeof headerButtons === "function" ? headerButtons(ctx) : headerButtons;
    if (actionsPosition === "top-right") {
      const content2 = /* @__PURE__ */ jsx(ActionsButtonStack, { direction: "row", children: /* @__PURE__ */ jsx(ResponsiveHeaderButtons, { children: raw }) });
      return topRightEl ? createPortal(content2, topRightEl) : null;
    }
    const content = /* @__PURE__ */ jsx(ActionsButtonStack, { direction: "column", children: raw });
    return verticalBarEl ? createPortal(content, verticalBarEl) : null;
  };
  const stickyTop = isDetailPane ? PANE_TOOLBAR_HEIGHT : isInMultiPane ? 0 : STICKY_APP_HEADER_HEIGHT;
  const stickyBarNode = actionsPosition === "top-right" ? /* @__PURE__ */ jsxs(
    "div",
    {
      style: {
        position: "sticky",
        top: stickyTop,
        zIndex: 10,
        background: token.colorBgContainer,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        width: "100%",
        paddingTop: 2,
        paddingBottom: 2,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        marginBottom: 2
      },
      children: [
        /* @__PURE__ */ jsx("div", { style: { minWidth: 0, flex: "1 1 auto" }, children: /* @__PURE__ */ jsx(Breadcrumb$1, {}) }),
        /* @__PURE__ */ jsx(
          "div",
          {
            ref: setTopRightEl,
            style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }
          }
        )
      ]
    }
  ) : null;
  const suppressDefaultBreadcrumb = actionsPosition === "top-right";
  return { actionsPosition, setVerticalBarEl, wrappedHeaderButtons, stickyBarNode, suppressDefaultBreadcrumb };
};
var StandardShow = ({ headerButtons, ...props }) => {
  const effectiveHeaderButtons = headerButtons ?? renderStandardShowHeaderButtons;
  const { actionsPosition, setVerticalBarEl, wrappedHeaderButtons, stickyBarNode, suppressDefaultBreadcrumb } = useActionsWrapping(effectiveHeaderButtons);
  return /* @__PURE__ */ jsxs(VerticalActionsLayout, { position: actionsPosition, onBarMount: setVerticalBarEl, children: [
    stickyBarNode,
    /* @__PURE__ */ jsx(
      Show,
      {
        ...props,
        title: wrapPageTitle(props.title),
        breadcrumb: suppressDefaultBreadcrumb ? false : props.breadcrumb,
        headerButtons: wrappedHeaderButtons
      }
    )
  ] });
};
var StandardEdit = ({ headerButtons, ...props }) => {
  const effectiveHeaderButtons = headerButtons ?? (({ defaultButtons }) => renderIconOnlyButtons2(defaultButtons));
  const { actionsPosition, setVerticalBarEl, wrappedHeaderButtons, stickyBarNode, suppressDefaultBreadcrumb } = useActionsWrapping(effectiveHeaderButtons);
  return /* @__PURE__ */ jsxs(VerticalActionsLayout, { position: actionsPosition, onBarMount: setVerticalBarEl, children: [
    stickyBarNode,
    /* @__PURE__ */ jsx(
      Edit,
      {
        ...props,
        breadcrumb: suppressDefaultBreadcrumb ? false : props.breadcrumb,
        headerButtons: wrappedHeaderButtons
      }
    )
  ] });
};
var StandardList = ({ headerButtons, ...props }) => {
  const effectiveHeaderButtons = headerButtons;
  const { actionsPosition, setVerticalBarEl, wrappedHeaderButtons, stickyBarNode, suppressDefaultBreadcrumb } = useActionsWrapping(effectiveHeaderButtons);
  return /* @__PURE__ */ jsxs(VerticalActionsLayout, { position: actionsPosition, onBarMount: setVerticalBarEl, children: [
    stickyBarNode,
    /* @__PURE__ */ jsx(
      List,
      {
        ...props,
        breadcrumb: suppressDefaultBreadcrumb ? false : props.breadcrumb,
        headerButtons: effectiveHeaderButtons ? wrappedHeaderButtons : void 0
      }
    )
  ] });
};
var StandardCreate = ({ headerButtons, ...props }) => {
  const effectiveHeaderButtons = headerButtons ?? (({ defaultButtons }) => renderIconOnlyButtons2(defaultButtons));
  const { actionsPosition, setVerticalBarEl, wrappedHeaderButtons, stickyBarNode, suppressDefaultBreadcrumb } = useActionsWrapping(effectiveHeaderButtons);
  return /* @__PURE__ */ jsxs(VerticalActionsLayout, { position: actionsPosition, onBarMount: setVerticalBarEl, children: [
    stickyBarNode,
    /* @__PURE__ */ jsx(
      Create,
      {
        ...props,
        breadcrumb: suppressDefaultBreadcrumb ? false : props.breadcrumb,
        headerButtons: wrappedHeaderButtons
      }
    )
  ] });
};
function useKeyboardShortcuts(shortcuts) {
  useEffect(() => {
    const handler = (e) => {
      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        if (!keyMatch) continue;
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        if (!ctrlMatch) continue;
        const shiftMatch = shortcut.shift ? e.shiftKey : true;
        if (!shiftMatch) continue;
        const skipModal = shortcut.skipWhenModalOpen ?? shortcut.key === "Escape";
        if (skipModal && document.querySelector(".ant-modal-wrap, .ant-popover, .ant-select-dropdown")) {
          continue;
        }
        if (shortcut.preventDefault !== false) {
          e.preventDefault();
        }
        shortcut.handler();
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
var wrappedPageTitleStyle2 = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  margin: 0,
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  lineHeight: 1.2
};
var renderWrappedPageTitle = (title) => {
  if (title === null || title === void 0 || title === false) return title;
  return React6.createElement("div", { style: wrappedPageTitleStyle2 }, title);
};
var numberFormatter = new Intl.NumberFormat(void 0, { maximumFractionDigits: 0 });
var decimalFormatter = new Intl.NumberFormat(void 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
var formatNumberValue = (value) => {
  if (value === null || value === void 0) return value;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return value;
  if (Number.isInteger(parsed)) return numberFormatter.format(parsed);
  return decimalFormatter.format(parsed);
};
var dateFormatter = new Intl.DateTimeFormat(void 0, {
  year: "numeric",
  month: "short",
  day: "2-digit"
});
var dateTimeFormatter = new Intl.DateTimeFormat(void 0, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});
var timeFormatter = new Intl.DateTimeFormat(void 0, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});
var formatDateValue = (value) => {
  if (!value) return value;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateFormatter.format(parsed);
};
var formatDateTimeValue = (value) => {
  if (!value) return value;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateTimeFormatter.format(parsed);
};
var formatTimeValue = (value) => {
  if (!value) return String(value ?? "-");
  if (typeof value === "string" && /^\d{2}:\d{2}/.test(value)) {
    const parsed2 = /* @__PURE__ */ new Date(`1970-01-01T${value}`);
    if (!Number.isNaN(parsed2.getTime())) return timeFormatter.format(parsed2);
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return timeFormatter.format(parsed);
};
var escapeHtml = (value) => {
  if (value === null || value === void 0) return "";
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
};
var parseInlineStyle = (styleText) => {
  if (!styleText) return {};
  return styleText.split(";").map((chunk) => chunk.trim()).filter(Boolean).reduce((acc, rule) => {
    const [rawKey, rawValue] = rule.split(":").map((part) => part.trim());
    if (!rawKey || !rawValue) return acc;
    const camelKey = rawKey.replace(/-([a-z])/g, (_39, char) => char.toUpperCase());
    acc[camelKey] = rawValue;
    return acc;
  }, {});
};

// src/components/DynamicResource/utils/sorting.ts
var normalizeFilterRules = (rules) => {
  if (!Array.isArray(rules)) return [];
  return rules.filter((rule) => rule && typeof rule === "object").map((rule, index) => ({
    id: rule.id ?? `${Date.now()}-${index}-${Math.random()}`,
    fieldKey: rule.fieldKey ?? rule.field ?? void 0,
    operator: rule.operator,
    value: rule.value,
    value2: rule.value2
  }));
};
var normalizeColumnSortPreference = (value) => {
  const toSortState = (item) => {
    if (!item || typeof item !== "object") return null;
    const rawField = item.fieldKey ?? item.field ?? item.columnKey ?? item.dataIndex;
    const order = item.order;
    if (order !== "ascend" && order !== "descend" || rawField === void 0 || rawField === null) return null;
    const fieldKey = Array.isArray(rawField) ? rawField.join(".") : String(rawField);
    if (!fieldKey) return null;
    return { fieldKey, order };
  };
  const items = Array.isArray(value) ? value : [value];
  const deduped = /* @__PURE__ */ new Map();
  items.forEach((item) => {
    const next = toSortState(item);
    if (!next) return;
    deduped.set(next.fieldKey, next);
  });
  return Array.from(deduped.values());
};
var normalizeSorterPayload = (sorter) => {
  const items = Array.isArray(sorter) ? sorter : [sorter];
  return normalizeColumnSortPreference(items);
};
var resolveNextColumnSort = (current, sorterPayload, sortIntent) => {
  const nextFromTable = normalizeSorterPayload(sorterPayload);
  if (!sortIntent) {
    return nextFromTable.length > 0 ? nextFromTable : current;
  }
  const { fieldKey, additive } = sortIntent;
  const clickedSort = nextFromTable.find((item) => item.fieldKey === fieldKey);
  if (!additive) {
    return clickedSort ? [clickedSort] : [];
  }
  const withoutClicked = current.filter((item) => item.fieldKey !== fieldKey);
  return clickedSort ? [...withoutClicked, clickedSort] : withoutClicked;
};
var getSortPriority = (columnSort, fieldKey) => {
  const index = columnSort.findIndex((item) => item.fieldKey === fieldKey);
  return index === -1 ? 1 : columnSort.length - index + 1;
};
var IMAGE_EXTENSIONS = /* @__PURE__ */ new Set(["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "tif", "tiff"]);
var isImageRecord = (record) => {
  if (record?.avatar_url || record?.image_url || record?.photo_url) return true;
  const format = String(record?.data_format || "").toLowerCase();
  if (format.startsWith("image/")) return true;
  const name = String(record?.data_name || "");
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext && IMAGE_EXTENSIONS.has(ext)) return true;
  return false;
};
var recordHasData = (record) => {
  if (record?.data_present === false) return false;
  if (record?.data_size !== void 0 && record?.data_size !== null) {
    const size = Number(record.data_size);
    return Number.isFinite(size) ? size > 0 : true;
  }
  return true;
};
var getGalleryItemId = (record, fallbackId) => record?.eid ?? record?.id ?? fallbackId;
var getGalleryItemLabel = (record, fallbackId) => {
  const fileId = fallbackId ?? "";
  return record?.title || record?.name || record?.data_name || record?._label || `File ${fileId}`;
};
var getGalleryItemContentUrl = (apiUrl, record, id) => {
  const directUrl = record?.avatar_url || record?.image_url || record?.photo_url;
  if (directUrl && typeof directUrl === "string") return directUrl;
  const hasData = recordHasData(record);
  const isImage = isImageRecord(record) && hasData;
  if (!isImage || !id) return "";
  return `${apiUrl}/file/${id}/content`;
};
var renderSharedGalleryCard = ({
  item,
  itemId,
  label,
  apiUrl,
  imageWidth,
  imageHeight,
  borderColor,
  textColor,
  onClick
}) => {
  const contentUrl = getGalleryItemContentUrl(apiUrl, item, itemId);
  const imageStyle = {
    width: imageWidth,
    height: imageHeight,
    objectFit: "cover",
    borderRadius: 8,
    border: `1px solid ${borderColor}`,
    background: "#f5f5f5"
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      style: { width: imageWidth, display: "grid", gap: 6, cursor: onClick ? "pointer" : "default" },
      onClick,
      children: [
        contentUrl ? /* @__PURE__ */ jsx("img", { src: contentUrl, alt: label, style: imageStyle }) : /* @__PURE__ */ jsx("div", { style: { ...imageStyle, display: "flex", alignItems: "center", justifyContent: "center", color: "#8c8c8c" }, children: /* @__PURE__ */ jsx(FileTextOutlined, { style: { fontSize: 24 } }) }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: textColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: label })
      ]
    },
    itemId ?? label
  );
};
var _7 = window._ || ((text) => text);
var openPdfWindow = (title, bodyHtml) => {
  const pdfWindow = window.open("", "_blank", "width=960,height=720");
  if (!pdfWindow) return;
  pdfWindow.document.write(`<!doctype html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
    h2 { margin: 0 0 16px; }
    h3 { margin: 18px 0 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #e0e0e0; padding: 6px 8px; font-size: 12px; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`);
  pdfWindow.document.close();
  const triggerPrint = () => {
    pdfWindow.focus();
    pdfWindow.print();
  };
  if (pdfWindow.document.readyState === "complete") {
    setTimeout(triggerPrint, 250);
  } else {
    pdfWindow.onload = () => setTimeout(triggerPrint, 250);
  }
};
var buildStatsHtml = (statsSummary) => {
  const formatStatValue = (value) => {
    if (value === null || value === void 0) return "-";
    return escapeHtml(formatNumberValue(value));
  };
  const numericRows = statsSummary.numericStats.map((row) => `
            <tr>
              <td>${escapeHtml(row.label)}</td>
              <td>${formatStatValue(row.sum)}</td>
              <td>${formatStatValue(row.avg)}</td>
              <td>${formatStatValue(row.min)}</td>
              <td>${formatStatValue(row.max)}</td>
              <td>${formatStatValue(row.stddev)}</td>
            </tr>
        `).join("");
  const numericSection = statsSummary.numericStats.length > 0 ? `
            <h3>${_7("Numeric columns")}</h3>
            <table>
              <thead>
                <tr>
                  <th>${_7("Field")}</th>
                  <th>${_7("Sum")}</th>
                  <th>${_7("Average")}</th>
                  <th>${_7("Min")}</th>
                  <th>${_7("Max")}</th>
                  <th>${_7("Std Dev")}</th>
                </tr>
              </thead>
              <tbody>${numericRows}</tbody>
            </table>
        ` : "";
  const categoricalSection = statsSummary.categoricalStats.length > 0 ? statsSummary.categoricalStats.map((field) => {
    const countRows = field.counts.map((entry) => `
                        <tr>
                          <td>${escapeHtml(entry.value)}</td>
                          <td>${formatStatValue(entry.count)}</td>
                        </tr>
                    `).join("");
    return `
                    <h3>${escapeHtml(field.label)}</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>${_7("Value")}</th>
                          <th>${_7("Count")}</th>
                        </tr>
                      </thead>
                      <tbody>${countRows}</tbody>
                    </table>
                `;
  }).join("") : "";
  return `
        <h2>${_7("Stats")}</h2>
        ${numericSection}
        ${categoricalSection}
    `;
};
var buildStatsSummary = (rows, fields, labelCache) => {
  const numericStats = [];
  const categoricalStats = [];
  const formatCategoricalValue = (field, raw) => {
    if (raw === void 0 || raw === null) return "-";
    if (field.reference) {
      const cacheKey = `${field.reference}:${raw}`;
      return labelCache[cacheKey] || String(raw);
    }
    if (field.options) {
      return field.options.find((option) => option.value === raw)?.label || String(raw);
    }
    if (field.type === "boolean") return raw ? _7("Yes") : _7("No");
    if (field.type === "date") return formatDateValue(raw);
    return String(raw);
  };
  fields.forEach((field) => {
    if (field.type === "number" && !field.reference) {
      const values = rows.map((row) => Number(row?.[field.key])).filter((value) => !Number.isNaN(value));
      if (values.length === 0) {
        numericStats.push({
          key: field.key,
          label: field.label,
          sum: null,
          avg: null,
          min: null,
          max: null,
          stddev: null
        });
        return;
      }
      const count = values.length;
      const sum = values.reduce((acc, val) => acc + val, 0);
      const avg = sum / count;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const variance = values.reduce((acc, val) => acc + (val - avg) ** 2, 0) / count;
      const stddev = Math.sqrt(variance);
      numericStats.push({
        key: field.key,
        label: field.label,
        sum,
        avg,
        min,
        max,
        stddev
      });
      return;
    }
    const counts = /* @__PURE__ */ new Map();
    rows.forEach((row) => {
      const raw = row?.[field.key];
      const value = formatCategoricalValue(field, raw);
      counts.set(value, (counts.get(value) || 0) + 1);
    });
    if (counts.size === 0 || counts.size >= 20) return;
    categoricalStats.push({
      key: field.key,
      label: field.label,
      counts: Array.from(counts.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count)
    });
  });
  return { numericStats, categoricalStats };
};
var renderStatBar = (value, maxValue, formatter) => {
  if (value === null || maxValue <= 0) return /* @__PURE__ */ jsx("span", { children: "-" });
  const ratio = Math.min(1, Math.abs(value) / maxValue);
  return /* @__PURE__ */ jsxs("div", { style: { position: "relative", height: 20 }, children: [
    /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          inset: 0,
          background: "rgba(22, 119, 255, 0.12)",
          transform: `scaleX(${ratio})`,
          transformOrigin: "left",
          borderRadius: 4
        }
      }
    ),
    /* @__PURE__ */ jsx("span", { style: { position: "relative", paddingLeft: 6 }, children: formatter(value) })
  ] });
};
var renderNumericValueBar = (value, maxValue, formattedValue, barColor) => {
  if (value === null || value === void 0 || maxValue <= 0) return /* @__PURE__ */ jsx("span", { children: formattedValue });
  const parsed = Number(value);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return /* @__PURE__ */ jsx("span", { children: formattedValue });
  const ratio = Math.min(1, Math.abs(parsed) / maxValue);
  return /* @__PURE__ */ jsxs("div", { style: { position: "relative", minHeight: 24 }, children: [
    /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          inset: "3px 0",
          width: `${ratio * 100}%`,
          background: barColor,
          borderRadius: 6
        }
      }
    ),
    /* @__PURE__ */ jsx("span", { style: { position: "relative", display: "inline-block", paddingLeft: 6, width: "100%", textAlign: "right" }, children: formattedValue })
  ] });
};
var _8 = window._ || ((text) => text);
var AnalysisChart = ({
  data,
  seriesKeys,
  seriesLabels,
  chartType,
  svgRef,
  animationKey,
  animationStage,
  rawRows,
  numericFields,
  allFields,
  categoryField1,
  categoryField2,
  formatCategoryValue,
  summaryFn,
  title,
  numericBarColor
}) => {
  const { token } = theme.useToken();
  const width = 1e3;
  const isHorizontal = chartType === "bar-horizontal" || chartType === "stacked-horizontal" || chartType === "area-horizontal";
  const hasXAxisLabels = !isHorizontal && (chartType === "bar" || chartType === "line" || chartType === "area" || chartType === "stacked" || chartType === "combo" || chartType === "histogram" || chartType === "box" || chartType === "waterfall" || chartType === "heatmap");
  const usesLegend = chartType === "pie" || chartType === "donut" || chartType === "scatter" || chartType === "bubble" || chartType === "bar" || chartType === "line" || chartType === "area" || chartType === "stacked" || chartType === "bar-horizontal" || chartType === "stacked-horizontal" || chartType === "area-horizontal" || chartType === "combo";
  const basePaddingLeft = 60;
  const maxHorizontalLabelLength = isHorizontal || chartType === "histogram" || chartType === "heatmap" ? Math.max(0, ...data.map((group) => group.label.length)) : 0;
  const paddingLeft = isHorizontal || chartType === "histogram" || chartType === "heatmap" ? Math.min(330, Math.max(basePaddingLeft, Math.round((28 + maxHorizontalLabelLength * 7) * 1.1))) : basePaddingLeft;
  const legendWidth = usesLegend ? isHorizontal ? 220 : 290 : 0;
  const paddingRight = 20 + legendWidth;
  const paddingTop = 44;
  const maxXLabelLen = hasXAxisLabels ? Math.max(0, ...data.map((g) => g.label.length)) : 0;
  const xLabelVerticalExtent = Math.ceil(maxXLabelLen * 7 * Math.sin(35 * Math.PI / 180));
  const basePaddingBottom = hasXAxisLabels ? 144 : 120;
  const paddingBottom = hasXAxisLabels ? Math.max(basePaddingBottom, 20 + xLabelVerticalExtent + 16) : basePaddingBottom;
  const height = 420 + (paddingBottom - basePaddingBottom);
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const colors = ["#1677ff", "#52c41a", "#faad14", "#eb2f96", "#722ed1", "#13c2c2", "#f5222d"];
  const modelField = (key) => {
    if (!key) return void 0;
    return allFields.find((field) => field.key === key);
  };
  const primarySeriesKey = seriesKeys[0] || "__count__";
  const secondarySeriesKey = seriesKeys[1];
  const getNumericValue = (record, key) => {
    if (key === "__count__") return 1;
    const value = Number(record?.[key]);
    return Number.isNaN(value) ? null : value;
  };
  const summarizeValues = (values2) => {
    if (values2.length === 0) return 0;
    switch (summaryFn) {
      case "count":
        return values2.length;
      case "avg":
        return values2.reduce((acc, val) => acc + val, 0) / values2.length;
      case "max":
        return Math.max(...values2);
      case "min":
        return Math.min(...values2);
      case "stddev": {
        const mean = values2.reduce((acc, val) => acc + val, 0) / values2.length;
        const variance = values2.reduce((acc, val) => acc + (val - mean) ** 2, 0) / values2.length;
        return Math.sqrt(variance);
      }
      case "sum":
      default:
        return values2.reduce((acc, val) => acc + val, 0);
    }
  };
  const legendX = paddingLeft + chartWidth + 12;
  const renderLegendItems = (items, startY) => {
    const rowHeight = 16;
    return /* @__PURE__ */ jsx("g", { children: items.map((item, index) => {
      const y = startY + index * rowHeight;
      return /* @__PURE__ */ jsxs("g", { transform: `translate(${legendX}, ${y})`, children: [
        /* @__PURE__ */ jsx("rect", { width: 10, height: 10, rx: 2, fill: item.color }),
        /* @__PURE__ */ jsx("text", { x: 16, y: 9, fontSize: "11", fill: token.colorTextSecondary, children: item.label })
      ] }, `legend-${item.label}-${index}`);
    }) });
  };
  const renderCaption = (text) => {
    return /* @__PURE__ */ jsx("text", { x: paddingLeft, y: 16, fontSize: "12", fill: token.colorTextSecondary, children: text });
  };
  const renderTitle = () => {
    if (!title) return null;
    return /* @__PURE__ */ jsx("text", { x: paddingLeft, y: 24, fontSize: "14", fill: token.colorText, fontWeight: 600, children: title });
  };
  const renderNoChartDataMessage = () => /* @__PURE__ */ jsx("div", { style: { padding: 24, color: token.colorTextTertiary, textAlign: "center" }, children: _8("No data available for this chart.") });
  if (!data.length && chartType !== "scatter" && chartType !== "bubble" && chartType !== "histogram" && chartType !== "box" && chartType !== "heatmap" && chartType !== "crosstab") {
    return renderNoChartDataMessage();
  }
  if (chartType === "pie" || chartType === "donut") {
    const sliceMap = /* @__PURE__ */ new Map();
    data.forEach((group) => {
      const baseLabel = group.label.split(" \u2022 ")[0];
      const value = seriesKeys.reduce((acc, key) => acc + (group.values[key] || 0), 0);
      const existing = sliceMap.get(baseLabel);
      if (existing) {
        existing.value += value;
      } else {
        sliceMap.set(baseLabel, { key: baseLabel, label: baseLabel, value });
      }
    });
    const sliceValues = Array.from(sliceMap.values());
    const total = sliceValues.reduce((acc, slice) => acc + slice.value, 0);
    if (total <= 0) {
      return renderNoChartDataMessage();
    }
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(chartWidth, chartHeight) / 2;
    const innerRadius = chartType === "donut" ? radius * 0.55 : 0;
    let currentAngle = -Math.PI / 2;
    const slices = sliceValues.map((slice, index) => {
      const angle = slice.value / total * Math.PI * 2;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;
      const x1 = centerX + radius * Math.cos(startAngle);
      const y1 = centerY + radius * Math.sin(startAngle);
      const x2 = centerX + radius * Math.cos(endAngle);
      const y2 = centerY + radius * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;
      const path = [
        `M ${centerX} ${centerY}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
        "Z"
      ].join(" ");
      const donutPath = [
        `M ${centerX + innerRadius * Math.cos(startAngle)} ${centerY + innerRadius * Math.sin(startAngle)}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${centerX + innerRadius * Math.cos(endAngle)} ${centerY + innerRadius * Math.sin(endAngle)}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${centerX + innerRadius * Math.cos(startAngle)} ${centerY + innerRadius * Math.sin(startAngle)}`,
        "Z"
      ].join(" ");
      return /* @__PURE__ */ jsx(
        "path",
        {
          className: "chart-item chart-slice",
          style: { "--delay": `${index * 60}ms` },
          d: innerRadius > 0 ? donutPath : path,
          fill: colors[index % colors.length],
          children: /* @__PURE__ */ jsx("title", { children: `${slice.label}: ${slice.value}` })
        },
        slice.key
      );
    });
    const legendItems = sliceValues.map((slice, index) => ({
      label: slice.label,
      color: colors[index % colors.length]
    }));
    return /* @__PURE__ */ jsx("div", { className: `chart-motion chart-effect--sweep chart-stage--${animationStage}`, children: /* @__PURE__ */ jsxs("svg", { ref: svgRef, className: "chart-plot", viewBox: `0 0 ${width} ${height}`, width: "100%", height, role: "img", children: [
      renderTitle(),
      renderLegendItems(legendItems, 8),
      slices
    ] }) }, animationKey);
  }
  const values = data.flatMap((group) => seriesKeys.map((key) => group.values[key] || 0));
  const maxValue = Math.max(0, ...values);
  const minValue = Math.min(0, ...values);
  const valueRange = Math.max(1, maxValue - minValue);
  const scaleY = (value) => (value - minValue) / valueRange * chartHeight;
  const scaleX = (value) => (value - minValue) / valueRange * chartWidth;
  const zeroY = paddingTop + (chartHeight - scaleY(0));
  const zeroX = paddingLeft + scaleX(0);
  const groupWidth = chartWidth / data.length;
  const seriesCount = Math.max(seriesKeys.length, 1);
  const barWidth = chartType === "bar" ? groupWidth * 0.7 / seriesCount : 0;
  const renderBars = () => {
    return data.flatMap((group, groupIndex) => {
      const xBase = paddingLeft + groupIndex * groupWidth;
      return seriesKeys.map((seriesKey, seriesIndex) => {
        const value = group.values[seriesKey] || 0;
        const barHeight = Math.abs(scaleY(value) - scaleY(0));
        const x = xBase + (groupWidth - barWidth * seriesCount) / 2 + seriesIndex * barWidth;
        const y = value >= 0 ? zeroY - barHeight : zeroY;
        return /* @__PURE__ */ jsx(
          "rect",
          {
            className: "chart-item chart-bar",
            style: { "--delay": `${(groupIndex * seriesCount + seriesIndex) * 40}ms` },
            x,
            y,
            width: barWidth,
            height: barHeight,
            fill: colors[seriesIndex % colors.length],
            rx: 2
          },
          `${group.key}-${seriesKey}`
        );
      });
    });
  };
  const renderLines = () => {
    return seriesKeys.map((seriesKey, seriesIndex) => {
      const points = data.map((group, groupIndex) => {
        const value = group.values[seriesKey] || 0;
        const x = paddingLeft + groupIndex * groupWidth + groupWidth / 2;
        const y = paddingTop + (chartHeight - scaleY(value));
        return `${x},${y}`;
      }).join(" ");
      return /* @__PURE__ */ jsxs("g", { children: [
        chartType === "area" && /* @__PURE__ */ jsx(
          "polygon",
          {
            className: "chart-item chart-area",
            style: { "--delay": `${seriesIndex * 80}ms` },
            points: `${points} ${paddingLeft + (data.length - 1) * groupWidth + groupWidth / 2},${zeroY} ${paddingLeft},${zeroY}`,
            fill: colors[seriesIndex % colors.length],
            opacity: 0.2
          }
        ),
        /* @__PURE__ */ jsx(
          "polyline",
          {
            className: "chart-item chart-line",
            style: { "--delay": `${seriesIndex * 80}ms` },
            points,
            fill: "none",
            stroke: colors[seriesIndex % colors.length],
            strokeWidth: 2
          }
        ),
        data.map((group, groupIndex) => {
          const value = group.values[seriesKey] || 0;
          const x = paddingLeft + groupIndex * groupWidth + groupWidth / 2;
          const y = paddingTop + (chartHeight - scaleY(value));
          return /* @__PURE__ */ jsx(
            "circle",
            {
              className: "chart-item chart-point",
              style: { "--delay": `${(seriesIndex * data.length + groupIndex) * 30}ms` },
              cx: x,
              cy: y,
              r: 3,
              fill: colors[seriesIndex % colors.length]
            },
            `${group.key}-${seriesKey}-point`
          );
        })
      ] }, seriesKey);
    });
  };
  const renderStackedBars = () => {
    return data.map((group, groupIndex) => {
      const xBase = paddingLeft + groupIndex * groupWidth;
      let yOffsetPositive = 0;
      let yOffsetNegative = 0;
      return seriesKeys.map((seriesKey, seriesIndex) => {
        const value = group.values[seriesKey] || 0;
        const barHeight = Math.abs(scaleY(value) - scaleY(0));
        const x = xBase + groupWidth * 0.15;
        const y = value >= 0 ? zeroY - barHeight - yOffsetPositive : zeroY + yOffsetNegative;
        if (value >= 0) {
          yOffsetPositive += barHeight;
        } else {
          yOffsetNegative += barHeight;
        }
        return /* @__PURE__ */ jsx(
          "rect",
          {
            className: "chart-item chart-bar",
            style: { "--delay": `${(groupIndex * seriesCount + seriesIndex) * 40}ms` },
            x,
            y,
            width: groupWidth * 0.7,
            height: barHeight,
            fill: colors[seriesIndex % colors.length],
            rx: 2
          },
          `${group.key}-${seriesKey}`
        );
      });
    });
  };
  const renderHorizontalBars = () => {
    const groupHeight = chartHeight / data.length;
    const barHeight = groupHeight * 0.7 / seriesCount;
    return data.flatMap((group, groupIndex) => {
      const yBase = paddingTop + groupIndex * groupHeight;
      return seriesKeys.map((seriesKey, seriesIndex) => {
        const value = group.values[seriesKey] || 0;
        const barLength = Math.abs(scaleX(value) - scaleX(0));
        const x = value >= 0 ? zeroX : zeroX - barLength;
        const y = yBase + (groupHeight - barHeight * seriesCount) / 2 + seriesIndex * barHeight;
        return /* @__PURE__ */ jsx(
          "rect",
          {
            className: "chart-item chart-bar",
            style: { "--delay": `${(groupIndex * seriesCount + seriesIndex) * 40}ms` },
            x,
            y,
            width: barLength,
            height: barHeight,
            fill: colors[seriesIndex % colors.length],
            rx: 2
          },
          `${group.key}-${seriesKey}`
        );
      });
    });
  };
  const renderHorizontalStackedBars = () => {
    const groupHeight = chartHeight / data.length;
    return data.map((group, groupIndex) => {
      const yBase = paddingTop + groupIndex * groupHeight;
      let xOffsetPositive = 0;
      let xOffsetNegative = 0;
      return seriesKeys.map((seriesKey, seriesIndex) => {
        const value = group.values[seriesKey] || 0;
        const barLength = Math.abs(scaleX(value) - scaleX(0));
        const x = value >= 0 ? zeroX + xOffsetPositive : zeroX - xOffsetNegative - barLength;
        const y = yBase + groupHeight * 0.15;
        if (value >= 0) {
          xOffsetPositive += barLength;
        } else {
          xOffsetNegative += barLength;
        }
        return /* @__PURE__ */ jsx(
          "rect",
          {
            className: "chart-item chart-bar",
            style: { "--delay": `${(groupIndex * seriesCount + seriesIndex) * 40}ms` },
            x,
            y,
            width: barLength,
            height: groupHeight * 0.7,
            fill: colors[seriesIndex % colors.length],
            rx: 2
          },
          `${group.key}-${seriesKey}`
        );
      });
    });
  };
  const renderHorizontalLines = (isArea) => {
    const groupHeight = chartHeight / data.length;
    return seriesKeys.map((seriesKey, seriesIndex) => {
      const points = data.map((group, groupIndex) => {
        const value = group.values[seriesKey] || 0;
        const x = paddingLeft + scaleX(value);
        const y = paddingTop + groupIndex * groupHeight + groupHeight / 2;
        return `${x},${y}`;
      }).join(" ");
      const startY = paddingTop + groupHeight / 2;
      const endY = paddingTop + (data.length - 1) * groupHeight + groupHeight / 2;
      return /* @__PURE__ */ jsxs("g", { children: [
        /* @__PURE__ */ jsx(
          "polygon",
          {
            className: "chart-item chart-area",
            style: { "--delay": `${seriesIndex * 80}ms` },
            points: `${points} ${zeroX},${endY} ${zeroX},${startY}`,
            fill: colors[seriesIndex % colors.length],
            opacity: 0.2
          }
        ),
        /* @__PURE__ */ jsx(
          "polyline",
          {
            className: "chart-item chart-line",
            style: { "--delay": `${seriesIndex * 80}ms` },
            points,
            fill: "none",
            stroke: colors[seriesIndex % colors.length],
            strokeWidth: 2
          }
        ),
        data.map((group, groupIndex) => {
          const value = group.values[seriesKey] || 0;
          const x = paddingLeft + scaleX(value);
          const y = paddingTop + groupIndex * groupHeight + groupHeight / 2;
          return /* @__PURE__ */ jsx(
            "circle",
            {
              className: "chart-item chart-point",
              style: { "--delay": `${(seriesIndex * data.length + groupIndex) * 30}ms` },
              cx: x,
              cy: y,
              r: 3,
              fill: colors[seriesIndex % colors.length]
            },
            `${group.key}-${seriesKey}-point`
          );
        })
      ] }, seriesKey);
    });
  };
  const renderHistogram = () => {
    const field = numericFields[0];
    if (!field) return /* @__PURE__ */ jsx(Empty, { description: "Histogram needs a numeric field." });
    const valuesRaw = rawRows.map((row) => getNumericValue(row, field.key)).filter((value) => value !== null);
    if (valuesRaw.length === 0) return /* @__PURE__ */ jsx(Empty, { description: "No numeric data for histogram." });
    const min = Math.min(...valuesRaw);
    const max = Math.max(...valuesRaw);
    const bins = 8;
    const binSize = (max - min) / bins || 1;
    const binCounts = Array.from({ length: bins }, () => 0);
    valuesRaw.forEach((value) => {
      const index = Math.min(bins - 1, Math.floor((value - min) / binSize));
      binCounts[index] += 1;
    });
    const maxCount = Math.max(...binCounts, 1);
    const binWidth = chartWidth / bins;
    return /* @__PURE__ */ jsxs("svg", { ref: svgRef, className: "chart-plot", viewBox: `0 0 ${width} ${height}`, width: "100%", height, role: "img", children: [
      renderTitle(),
      renderCaption(`Histogram: ${field.label}`),
      /* @__PURE__ */ jsx("line", { x1: paddingLeft, y1: paddingTop + chartHeight, x2: paddingLeft + chartWidth, y2: paddingTop + chartHeight, stroke: token.colorBorderSecondary }),
      /* @__PURE__ */ jsx("line", { x1: paddingLeft, y1: paddingTop, x2: paddingLeft, y2: paddingTop + chartHeight, stroke: token.colorBorderSecondary }),
      [0, 0.5, 1].map((ratio) => {
        const value = Math.round(maxCount * ratio);
        const y = paddingTop + chartHeight - chartHeight * ratio;
        return /* @__PURE__ */ jsxs("g", { children: [
          /* @__PURE__ */ jsx("line", { x1: paddingLeft, y1: y, x2: paddingLeft + chartWidth, y2: y, stroke: token.colorBorder }),
          /* @__PURE__ */ jsx("text", { x: paddingLeft - 8, y: y + 4, fontSize: "11", textAnchor: "end", fill: token.colorTextTertiary, children: value })
        ] }, `hist-grid-${ratio}`);
      }),
      binCounts.map((count, index) => {
        const barHeight = count / maxCount * chartHeight;
        const x = paddingLeft + index * binWidth + binWidth * 0.1;
        const y = paddingTop + chartHeight - barHeight;
        return /* @__PURE__ */ jsx(
          "rect",
          {
            className: "chart-item chart-bar",
            style: { "--delay": `${index * 40}ms` },
            x,
            y,
            width: binWidth * 0.8,
            height: barHeight,
            fill: colors[index % colors.length],
            rx: 2
          },
          `hist-${index}`
        );
      }),
      [0, 0.5, 1].map((ratio) => {
        const value = Math.round(min + (max - min) * ratio);
        const x = paddingLeft + chartWidth * ratio;
        return /* @__PURE__ */ jsx(
          "text",
          {
            x,
            y: paddingTop + chartHeight + 10,
            fontSize: "11",
            textAnchor: "start",
            dominantBaseline: "hanging",
            fill: token.colorTextTertiary,
            transform: `rotate(35 ${x} ${paddingTop + chartHeight + 10})`,
            children: value
          },
          `hist-label-${ratio}`
        );
      })
    ] });
  };
  const renderScatter = (isBubble) => {
    if (numericFields.length < 2) {
      return /* @__PURE__ */ jsx(Empty, { description: "Scatter needs at least two numeric fields." });
    }
    const xField = numericFields[0];
    const yField = numericFields[1];
    const sizeField = numericFields[2];
    const points = rawRows.map((row) => {
      const x = getNumericValue(row, xField.key);
      const y = getNumericValue(row, yField.key);
      if (x === null || y === null) return null;
      const size = sizeField ? getNumericValue(row, sizeField.key) : 1;
      return { x, y, size: size ?? 1, row };
    }).filter((point) => !!point);
    if (points.length === 0) return /* @__PURE__ */ jsx(Empty, { description: "No numeric data for scatter." });
    const xMin = Math.min(...points.map((p) => p.x));
    const xMax = Math.max(...points.map((p) => p.x));
    const yMin = Math.min(...points.map((p) => p.y));
    const yMax = Math.max(...points.map((p) => p.y));
    const scaleXPoint = (value) => paddingLeft + (value - xMin) / Math.max(1, xMax - xMin) * chartWidth;
    const scaleYPoint = (value) => paddingTop + chartHeight - (value - yMin) / Math.max(1, yMax - yMin) * chartHeight;
    const sizeValues = points.map((p) => Math.abs(p.size));
    const sizeMin = Math.min(...sizeValues);
    const sizeMax = Math.max(...sizeValues);
    const scaleR = (value) => {
      if (!isBubble) return 4;
      const normalized = (Math.abs(value) - sizeMin) / Math.max(1, sizeMax - sizeMin);
      return 6 + normalized * 10;
    };
    const categoryField = modelField(categoryField1);
    const categoryLabels = categoryField1 ? Array.from(new Set(points.map((point) => formatCategoryValue(categoryField, point.row)))) : [];
    const colorMap = new Map(
      categoryLabels.map((label, index) => [label, colors[index % colors.length]])
    );
    return /* @__PURE__ */ jsxs("svg", { ref: svgRef, className: "chart-plot", viewBox: `0 0 ${width} ${height}`, width: "100%", height, role: "img", children: [
      renderTitle(),
      renderCaption(`${xField.label} vs ${yField.label}`),
      categoryLabels.length > 0 && renderLegendItems(
        categoryLabels.map((label, index) => ({
          label,
          color: colors[index % colors.length]
        })),
        32
      ),
      /* @__PURE__ */ jsx("line", { x1: paddingLeft, y1: paddingTop + chartHeight, x2: paddingLeft + chartWidth, y2: paddingTop + chartHeight, stroke: token.colorBorderSecondary }),
      /* @__PURE__ */ jsx("line", { x1: paddingLeft, y1: paddingTop, x2: paddingLeft, y2: paddingTop + chartHeight, stroke: token.colorBorderSecondary }),
      [0, 0.5, 1].map((ratio) => {
        const value = Math.round(yMin + (yMax - yMin) * ratio);
        const y = paddingTop + chartHeight - chartHeight * ratio;
        return /* @__PURE__ */ jsxs("g", { children: [
          /* @__PURE__ */ jsx("line", { x1: paddingLeft, y1: y, x2: paddingLeft + chartWidth, y2: y, stroke: token.colorBorder }),
          /* @__PURE__ */ jsx("text", { x: paddingLeft - 8, y: y + 4, fontSize: "11", textAnchor: "end", fill: token.colorTextTertiary, children: value })
        ] }, `scatter-grid-y-${ratio}`);
      }),
      points.map((point, index) => {
        const x = scaleXPoint(point.x);
        const y = scaleYPoint(point.y);
        let color = colors[0];
        if (categoryField1) {
          const label = formatCategoryValue(categoryField, point.row);
          color = colorMap.get(label) || colors[0];
        }
        return /* @__PURE__ */ jsx(
          "circle",
          {
            className: "chart-item chart-point",
            style: { "--delay": `${index * 10}ms` },
            cx: x,
            cy: y,
            r: scaleR(point.size),
            fill: color,
            opacity: isBubble ? 0.65 : 0.9
          },
          `scatter-${index}`
        );
      })
    ] });
  };
  const renderBoxPlot = () => {
    const field = numericFields[0];
    if (!field) return /* @__PURE__ */ jsx(Empty, { description: "Box plot needs a numeric field." });
    const groupMap = /* @__PURE__ */ new Map();
    rawRows.forEach((row) => {
      const value = getNumericValue(row, field.key);
      if (value === null) return;
      const label = categoryField1 ? formatCategoryValue(modelField(categoryField1), row) : "All";
      if (!groupMap.has(label)) groupMap.set(label, []);
      groupMap.get(label).push(value);
    });
    if (groupMap.size === 0) return /* @__PURE__ */ jsx(Empty, { description: "No numeric data for box plot." });
    const groups = Array.from(groupMap.entries()).map(([label, values2]) => {
      const sorted = values2.slice().sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const median = sorted[Math.floor(sorted.length * 0.5)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const min2 = sorted[0];
      const max2 = sorted[sorted.length - 1];
      return { label, q1, median, q3, min: min2, max: max2 };
    });
    const allValues = groups.flatMap((g) => [g.min, g.max]);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const scaleYBox = (value) => paddingTop + chartHeight - (value - min) / Math.max(1, max - min) * chartHeight;
    const groupWidth2 = chartWidth / groups.length;
    return /* @__PURE__ */ jsxs("svg", { ref: svgRef, className: "chart-plot", viewBox: `0 0 ${width} ${height}`, width: "100%", height, role: "img", children: [
      renderTitle(),
      renderCaption(`Box plot: ${field.label}`),
      /* @__PURE__ */ jsx("line", { x1: paddingLeft, y1: paddingTop + chartHeight, x2: paddingLeft + chartWidth, y2: paddingTop + chartHeight, stroke: token.colorBorderSecondary }),
      /* @__PURE__ */ jsx("line", { x1: paddingLeft, y1: paddingTop, x2: paddingLeft, y2: paddingTop + chartHeight, stroke: token.colorBorderSecondary }),
      [0, 0.5, 1].map((ratio) => {
        const value = Math.round(min + (max - min) * ratio);
        const y = paddingTop + chartHeight - chartHeight * ratio;
        return /* @__PURE__ */ jsxs("g", { children: [
          /* @__PURE__ */ jsx("line", { x1: paddingLeft, y1: y, x2: paddingLeft + chartWidth, y2: y, stroke: token.colorBorder }),
          /* @__PURE__ */ jsx("text", { x: paddingLeft - 8, y: y + 4, fontSize: "11", textAnchor: "end", fill: token.colorTextTertiary, children: value })
        ] }, `box-grid-${ratio}`);
      }),
      groups.map((group, index) => {
        const x = paddingLeft + index * groupWidth2 + groupWidth2 / 2;
        const boxWidth = groupWidth2 * 0.4;
        const yQ1 = scaleYBox(group.q1);
        const yQ3 = scaleYBox(group.q3);
        const yMedian = scaleYBox(group.median);
        const yMin = scaleYBox(group.min);
        const yMax = scaleYBox(group.max);
        const color = colors[index % colors.length];
        return /* @__PURE__ */ jsxs("g", { children: [
          /* @__PURE__ */ jsx("line", { x1: x, y1: yMin, x2: x, y2: yMax, stroke: color }),
          /* @__PURE__ */ jsx(
            "rect",
            {
              className: "chart-item chart-bar",
              style: { "--delay": `${index * 60}ms` },
              x: x - boxWidth / 2,
              y: yQ3,
              width: boxWidth,
              height: Math.max(2, yQ1 - yQ3),
              fill: color,
              opacity: 0.3,
              stroke: color
            }
          ),
          /* @__PURE__ */ jsx("line", { x1: x - boxWidth / 2, y1: yMedian, x2: x + boxWidth / 2, y2: yMedian, stroke: color }),
          /* @__PURE__ */ jsx(
            "text",
            {
              x,
              y: paddingTop + chartHeight + 10,
              fontSize: "11",
              textAnchor: "start",
              dominantBaseline: "hanging",
              transform: `rotate(35 ${x} ${paddingTop + chartHeight + 10})`,
              fill: token.colorTextTertiary,
              children: group.label
            }
          )
        ] }, `box-${group.label}`);
      })
    ] });
  };
  const renderWaterfall = () => {
    if (!data.length) return renderNoChartDataMessage();
    const steps = data.map((group) => ({
      label: group.label,
      value: group.values[primarySeriesKey] || 0
    }));
    let cumulative = 0;
    const ranges = steps.map((step) => {
      const start = cumulative;
      cumulative += step.value;
      return { ...step, start, end: cumulative };
    });
    const allValues = ranges.flatMap((range) => [range.start, range.end, 0]);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const scaleYWaterfall = (value) => paddingTop + chartHeight - (value - min) / Math.max(1, max - min) * chartHeight;
    const groupWidth2 = chartWidth / ranges.length;
    return /* @__PURE__ */ jsxs("svg", { ref: svgRef, className: "chart-plot", viewBox: `0 0 ${width} ${height}`, width: "100%", height, role: "img", children: [
      renderTitle(),
      renderLegendItems(
        [
          { label: _8("Increase"), color: "#52c41a" },
          { label: _8("Decrease"), color: "#f5222d" }
        ],
        8
      ),
      /* @__PURE__ */ jsx("line", { x1: paddingLeft, y1: scaleYWaterfall(0), x2: paddingLeft + chartWidth, y2: scaleYWaterfall(0), stroke: token.colorBorderSecondary }),
      /* @__PURE__ */ jsx("line", { x1: paddingLeft, y1: paddingTop, x2: paddingLeft, y2: paddingTop + chartHeight, stroke: token.colorBorderSecondary }),
      [0, 0.5, 1].map((ratio) => {
        const value = Math.round(min + (max - min) * ratio);
        const y = paddingTop + chartHeight - chartHeight * ratio;
        return /* @__PURE__ */ jsxs("g", { children: [
          /* @__PURE__ */ jsx("line", { x1: paddingLeft, y1: y, x2: paddingLeft + chartWidth, y2: y, stroke: token.colorBorder }),
          /* @__PURE__ */ jsx("text", { x: paddingLeft - 8, y: y + 4, fontSize: "11", textAnchor: "end", fill: token.colorTextTertiary, children: value })
        ] }, `waterfall-grid-${ratio}`);
      }),
      ranges.map((range, index) => {
        const x = paddingLeft + index * groupWidth2 + groupWidth2 * 0.2;
        const barWidth2 = groupWidth2 * 0.6;
        const yStart = scaleYWaterfall(range.start);
        const yEnd = scaleYWaterfall(range.end);
        const y = Math.min(yStart, yEnd);
        const heightValue = Math.max(2, Math.abs(yEnd - yStart));
        const color = range.value >= 0 ? "#52c41a" : "#f5222d";
        return /* @__PURE__ */ jsxs("g", { children: [
          /* @__PURE__ */ jsx(
            "rect",
            {
              className: "chart-item chart-bar",
              style: { "--delay": `${index * 50}ms` },
              x,
              y,
              width: barWidth2,
              height: heightValue,
              fill: color,
              rx: 2
            }
          ),
          /* @__PURE__ */ jsx(
            "text",
            {
              x: x + barWidth2 / 2,
              y: paddingTop + chartHeight + 10,
              fontSize: "11",
              textAnchor: "start",
              dominantBaseline: "hanging",
              transform: `rotate(35 ${x + barWidth2 / 2} ${paddingTop + chartHeight + 10})`,
              fill: token.colorTextTertiary,
              children: range.label
            }
          )
        ] }, `waterfall-${range.label}`);
      })
    ] });
  };
  const renderHeatmap = () => {
    if (!categoryField1 || !categoryField2) {
      return /* @__PURE__ */ jsx(Empty, { description: "Heatmap needs two category fields." });
    }
    const cat1Field = modelField(categoryField1);
    const cat2Field = modelField(categoryField2);
    const rowLabels = [];
    const colLabels = [];
    const grid = /* @__PURE__ */ new Map();
    rawRows.forEach((row) => {
      const rowLabel = formatCategoryValue(cat1Field, row);
      const colLabel = formatCategoryValue(cat2Field, row);
      if (!rowLabels.includes(rowLabel)) rowLabels.push(rowLabel);
      if (!colLabels.includes(colLabel)) colLabels.push(colLabel);
      const key = `${rowLabel}::${colLabel}`;
      if (!grid.has(key)) grid.set(key, []);
      const value = getNumericValue(row, primarySeriesKey);
      if (value !== null) {
        grid.get(key).push(value);
      } else {
        grid.get(key).push(1);
      }
    });
    if (rowLabels.length === 0 || colLabels.length === 0) {
      return renderNoChartDataMessage();
    }
    const cellValues = rowLabels.flatMap(
      (rowLabel) => colLabels.map((colLabel) => summarizeValues(grid.get(`${rowLabel}::${colLabel}`) || []))
    );
    const min = Math.min(...cellValues);
    const max = Math.max(...cellValues);
    const cellWidth = chartWidth / colLabels.length;
    const cellHeight = chartHeight / rowLabels.length;
    const colorForValue = (value) => {
      const t = (value - min) / Math.max(1, max - min);
      const shade = 230 - Math.round(130 * t);
      return `rgb(${shade}, ${shade}, 255)`;
    };
    return /* @__PURE__ */ jsxs("svg", { ref: svgRef, className: "chart-plot", viewBox: `0 0 ${width} ${height}`, width: "100%", height, role: "img", children: [
      renderTitle(),
      renderCaption(`Heatmap: ${seriesLabels[primarySeriesKey] || primarySeriesKey} (${summaryFn})`),
      rowLabels.map(
        (rowLabel, rowIndex) => colLabels.map((colLabel, colIndex) => {
          const value = summarizeValues(grid.get(`${rowLabel}::${colLabel}`) || []);
          const x = paddingLeft + colIndex * cellWidth;
          const y = paddingTop + rowIndex * cellHeight;
          return /* @__PURE__ */ jsx(
            "rect",
            {
              className: "chart-item chart-bar",
              style: { "--delay": `${(rowIndex * colLabels.length + colIndex) * 20}ms` },
              x,
              y,
              width: cellWidth,
              height: cellHeight,
              fill: colorForValue(value)
            },
            `heat-${rowLabel}-${colLabel}`
          );
        })
      ),
      rowLabels.map((label, index) => /* @__PURE__ */ jsx("text", { x: paddingLeft - 8, y: paddingTop + index * cellHeight + cellHeight / 2 + 4, fontSize: "11", textAnchor: "end", fill: token.colorTextTertiary, children: label }, `heat-row-${label}`)),
      colLabels.map((label, index) => {
        const x = paddingLeft + index * cellWidth + cellWidth / 2;
        const y = paddingTop + chartHeight + 10;
        return /* @__PURE__ */ jsx(
          "text",
          {
            x,
            y,
            fontSize: "11",
            textAnchor: "start",
            dominantBaseline: "hanging",
            fill: token.colorTextTertiary,
            transform: `rotate(35 ${x} ${y})`,
            children: label
          },
          `heat-col-${label}`
        );
      })
    ] });
  };
  const renderCrosstab = () => {
    if (!categoryField1 || !categoryField2) {
      return /* @__PURE__ */ jsx(Empty, { description: "Crosstab needs two category fields." });
    }
    const cat1Field = modelField(categoryField1);
    const cat2Field = modelField(categoryField2);
    const rowLabels = [];
    const colLabels = [];
    const cellSeriesValues = /* @__PURE__ */ new Map();
    const activeSeriesKeys = seriesKeys.length > 0 ? seriesKeys : ["__count__"];
    rawRows.forEach((row) => {
      const rowLabel = formatCategoryValue(cat1Field, row);
      const colLabel = formatCategoryValue(cat2Field, row);
      if (!rowLabels.includes(rowLabel)) rowLabels.push(rowLabel);
      if (!colLabels.includes(colLabel)) colLabels.push(colLabel);
      const cellKey = `${rowLabel}::${colLabel}`;
      if (!cellSeriesValues.has(cellKey)) {
        cellSeriesValues.set(cellKey, /* @__PURE__ */ new Map());
      }
      const seriesMap = cellSeriesValues.get(cellKey);
      activeSeriesKeys.forEach((seriesKey) => {
        if (!seriesMap.has(seriesKey)) {
          seriesMap.set(seriesKey, []);
        }
        const value = getNumericValue(row, seriesKey);
        if (value !== null) {
          seriesMap.get(seriesKey).push(value);
        }
      });
    });
    if (rowLabels.length === 0 || colLabels.length === 0) {
      return renderNoChartDataMessage();
    }
    const crosstabSeriesMaxes = activeSeriesKeys.reduce((acc, seriesKey) => {
      let maxForSeries = 0;
      rowLabels.forEach((rowLabel) => {
        colLabels.forEach((colLabel) => {
          const cellKey = `${rowLabel}::${colLabel}`;
          const values2 = cellSeriesValues.get(cellKey)?.get(seriesKey) || [];
          if (values2.length === 0) return;
          const summarized = summarizeValues(values2);
          maxForSeries = Math.max(maxForSeries, Math.abs(summarized));
        });
      });
      acc[seriesKey] = maxForSeries;
      return acc;
    }, {});
    return /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 8 }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary }, children: `${_8("Crosstab")}: ${cat1Field?.label || categoryField1} \xD7 ${cat2Field?.label || categoryField2} (${summaryFn})` }),
      /* @__PURE__ */ jsx("div", { style: { overflow: "auto", border: `1px solid ${token.colorBorder}`, borderRadius: 8 }, children: /* @__PURE__ */ jsxs("table", { style: { borderCollapse: "collapse", width: "100%", minWidth: "max-content", fontSize: 12 }, children: [
        /* @__PURE__ */ jsxs("thead", { children: [
          /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("th", { style: { position: "sticky", left: 0, zIndex: 1, background: token.colorBgLayout, color: token.colorText, borderBottom: `1px solid ${token.colorBorderSecondary}`, borderRight: `2px solid ${token.colorBorderSecondary}`, padding: "8px 10px", textAlign: "left", wordBreak: "break-word", maxWidth: 180, fontWeight: "normal" }, children: cat2Field?.label || categoryField2 }),
            colLabels.map((colLabel, colIndex) => /* @__PURE__ */ jsx(
              "th",
              {
                colSpan: activeSeriesKeys.length,
                style: {
                  background: token.colorBgLayout,
                  color: token.colorText,
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                  borderLeft: colIndex === 0 ? `4px solid ${token.colorTextQuaternary}` : `1px solid ${token.colorBorderSecondary}`,
                  borderRight: `4px solid ${token.colorTextQuaternary}`,
                  padding: "8px 6px 4px",
                  textAlign: "center",
                  verticalAlign: "bottom",
                  fontWeight: "normal"
                },
                children: /* @__PURE__ */ jsx("div", { style: {
                  writingMode: "vertical-rl",
                  transform: "rotate(210deg)",
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  display: "inline-block",
                  lineHeight: 1.2,
                  maxHeight: 200
                }, children: colLabel })
              },
              `crosstab-col-${colLabel}`
            ))
          ] }),
          /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("th", { style: { position: "sticky", left: 0, zIndex: 1, background: token.colorBgLayout, color: token.colorText, borderBottom: `2px solid ${token.colorBorderSecondary}`, borderRight: `2px solid ${token.colorBorderSecondary}`, padding: "8px 10px", textAlign: "left", wordBreak: "break-word", maxWidth: 180, fontWeight: "normal" }, children: cat1Field?.label || categoryField1 }),
            colLabels.flatMap(
              (colLabel) => activeSeriesKeys.map((seriesKey, seriesIndex) => /* @__PURE__ */ jsx(
                "th",
                {
                  style: {
                    background: token.colorBgLayout,
                    color: token.colorText,
                    borderBottom: `2px solid ${token.colorBorderSecondary}`,
                    borderLeft: seriesIndex === 0 ? `4px solid ${token.colorTextQuaternary}` : void 0,
                    borderRight: seriesIndex === activeSeriesKeys.length - 1 ? `4px solid ${token.colorTextQuaternary}` : `1px solid ${token.colorBorder}`,
                    padding: "6px 4px 4px",
                    textAlign: "center",
                    verticalAlign: "bottom",
                    fontWeight: "normal",
                    maxWidth: 48,
                    minWidth: 36
                  },
                  children: /* @__PURE__ */ jsx("div", { style: {
                    writingMode: "vertical-rl",
                    transform: "rotate(210deg)",
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                    display: "inline-block",
                    lineHeight: 1.2,
                    maxHeight: 200
                  }, children: seriesLabels[seriesKey] || seriesKey })
                },
                `crosstab-head-${colLabel}-${seriesKey}`
              ))
            )
          ] })
        ] }),
        /* @__PURE__ */ jsx("tbody", { children: rowLabels.map((rowLabel) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { style: { position: "sticky", left: 0, zIndex: 1, background: token.colorBgContainer, color: token.colorText, borderBottom: `1px solid ${token.colorBorder}`, borderRight: `2px solid ${token.colorBorderSecondary}`, padding: "8px 10px", textAlign: "left", fontWeight: "normal" }, children: rowLabel }),
          colLabels.flatMap((colLabel) => {
            const cellKey = `${rowLabel}::${colLabel}`;
            const seriesMap = cellSeriesValues.get(cellKey);
            return activeSeriesKeys.map((seriesKey, seriesIndex) => {
              const values2 = seriesMap?.get(seriesKey) || [];
              const summarized = values2.length > 0 ? summarizeValues(values2) : null;
              const display = summarized !== null ? renderNumericValueBar(
                summarized,
                crosstabSeriesMaxes[seriesKey] || 0,
                formatNumberValue(summarized),
                numericBarColor
              ) : "\u2013";
              return /* @__PURE__ */ jsx(
                "td",
                {
                  style: {
                    borderBottom: `1px solid ${token.colorBorder}`,
                    borderLeft: seriesIndex === 0 ? `4px solid ${token.colorTextQuaternary}` : void 0,
                    borderRight: seriesIndex === activeSeriesKeys.length - 1 ? `4px solid ${token.colorTextQuaternary}` : `1px solid ${token.colorBorder}`,
                    padding: "8px 10px",
                    textAlign: "right",
                    whiteSpace: "nowrap"
                  },
                  children: display
                },
                `crosstab-cell-${rowLabel}-${colLabel}-${seriesKey}`
              );
            });
          })
        ] }, `crosstab-row-${rowLabel}`)) })
      ] }) })
    ] });
  };
  const renderRadar = () => {
    if (seriesKeys.length < 3) {
      return /* @__PURE__ */ jsx(Empty, { description: "Radar needs at least three series." });
    }
    const centerX = paddingLeft + chartWidth / 2;
    const centerY = paddingTop + chartHeight / 2;
    const radius = Math.min(chartWidth, chartHeight) * 0.35;
    const maxBySeries = seriesKeys.reduce((acc, key) => {
      acc[key] = Math.max(...data.map((group) => group.values[key] || 0), 1);
      return acc;
    }, {});
    const angleStep = Math.PI * 2 / seriesKeys.length;
    return /* @__PURE__ */ jsxs("svg", { ref: svgRef, className: "chart-plot", viewBox: `0 0 ${width} ${height}`, width: "100%", height, role: "img", children: [
      renderTitle(),
      renderCaption("Radar chart"),
      seriesKeys.map((seriesKey, index) => {
        const angle = -Math.PI / 2 + index * angleStep;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        return /* @__PURE__ */ jsxs("g", { children: [
          /* @__PURE__ */ jsx("line", { x1: centerX, y1: centerY, x2: x, y2: y, stroke: token.colorBorder }),
          /* @__PURE__ */ jsx("text", { x, y, fontSize: "11", textAnchor: "middle", fill: token.colorTextTertiary, children: seriesLabels[seriesKey] || seriesKey })
        ] }, `radar-axis-${seriesKey}`);
      }),
      data.map((group, groupIndex) => {
        const points = seriesKeys.map((seriesKey, index) => {
          const value = group.values[seriesKey] || 0;
          const ratio = value / Math.max(1, maxBySeries[seriesKey]);
          const angle = -Math.PI / 2 + index * angleStep;
          const x = centerX + radius * ratio * Math.cos(angle);
          const y = centerY + radius * ratio * Math.sin(angle);
          return `${x},${y}`;
        }).join(" ");
        const color = colors[groupIndex % colors.length];
        return /* @__PURE__ */ jsx(
          "polygon",
          {
            className: "chart-item chart-area",
            style: { "--delay": `${groupIndex * 80}ms` },
            points,
            fill: color,
            opacity: 0.2,
            stroke: color,
            strokeWidth: 2
          },
          `radar-${group.key}`
        );
      })
    ] });
  };
  const renderCombo = () => {
    if (!secondarySeriesKey) {
      return /* @__PURE__ */ jsx(Empty, { description: "Combo needs at least two series selected." });
    }
    const valuesCombo = data.flatMap((group) => [
      group.values[primarySeriesKey] || 0,
      group.values[secondarySeriesKey] || 0
    ]);
    const maxCombo = Math.max(...valuesCombo, 1);
    const minCombo = Math.min(...valuesCombo, 0);
    const scaleYCombo = (value) => paddingTop + chartHeight - (value - minCombo) / Math.max(1, maxCombo - minCombo) * chartHeight;
    const groupWidth2 = chartWidth / data.length;
    const barWidth2 = groupWidth2 * 0.6;
    const points = data.map((group, index) => {
      const x = paddingLeft + index * groupWidth2 + groupWidth2 / 2;
      const y = scaleYCombo(group.values[secondarySeriesKey] || 0);
      return `${x},${y}`;
    }).join(" ");
    return /* @__PURE__ */ jsxs("svg", { ref: svgRef, className: "chart-plot", viewBox: `0 0 ${width} ${height}`, width: "100%", height, role: "img", children: [
      renderTitle(),
      renderLegendItems(
        [
          { label: seriesLabels[primarySeriesKey] || primarySeriesKey, color: colors[0] },
          { label: seriesLabels[secondarySeriesKey] || secondarySeriesKey, color: colors[2] }
        ],
        8
      ),
      /* @__PURE__ */ jsx("line", { x1: paddingLeft, y1: scaleYCombo(0), x2: paddingLeft + chartWidth, y2: scaleYCombo(0), stroke: token.colorBorderSecondary }),
      /* @__PURE__ */ jsx("line", { x1: paddingLeft, y1: paddingTop, x2: paddingLeft, y2: paddingTop + chartHeight, stroke: token.colorBorderSecondary }),
      [0, 0.5, 1].map((ratio) => {
        const value = Math.round(minCombo + (maxCombo - minCombo) * ratio);
        const y = paddingTop + chartHeight - chartHeight * ratio;
        return /* @__PURE__ */ jsxs("g", { children: [
          /* @__PURE__ */ jsx("line", { x1: paddingLeft, y1: y, x2: paddingLeft + chartWidth, y2: y, stroke: token.colorBorder }),
          /* @__PURE__ */ jsx("text", { x: paddingLeft - 8, y: y + 4, fontSize: "11", textAnchor: "end", fill: token.colorTextTertiary, children: value })
        ] }, `combo-grid-${ratio}`);
      }),
      data.map((group, index) => {
        const value = group.values[primarySeriesKey] || 0;
        const barHeight = Math.abs(scaleYCombo(value) - scaleYCombo(0));
        const x = paddingLeft + index * groupWidth2 + (groupWidth2 - barWidth2) / 2;
        const y = value >= 0 ? scaleYCombo(value) : scaleYCombo(0);
        return /* @__PURE__ */ jsx(
          "rect",
          {
            className: "chart-item chart-bar",
            style: { "--delay": `${index * 40}ms` },
            x,
            y,
            width: barWidth2,
            height: barHeight,
            fill: colors[0],
            rx: 2
          },
          `combo-bar-${group.key}`
        );
      }),
      /* @__PURE__ */ jsx(
        "polyline",
        {
          className: "chart-item chart-line",
          style: { "--delay": "120ms" },
          points,
          fill: "none",
          stroke: colors[2],
          strokeWidth: 2
        }
      )
    ] });
  };
  return /* @__PURE__ */ jsxs("div", { className: `chart-motion chart-effect--sweep chart-stage--${animationStage}`, children: [
    chartType === "histogram" && renderHistogram(),
    chartType === "scatter" && renderScatter(false),
    chartType === "bubble" && renderScatter(true),
    chartType === "box" && renderBoxPlot(),
    chartType === "waterfall" && renderWaterfall(),
    chartType === "heatmap" && renderHeatmap(),
    chartType === "crosstab" && renderCrosstab(),
    chartType === "radar" && renderRadar(),
    chartType === "combo" && renderCombo(),
    chartType !== "histogram" && chartType !== "scatter" && chartType !== "bubble" && chartType !== "box" && chartType !== "waterfall" && chartType !== "heatmap" && chartType !== "crosstab" && chartType !== "radar" && chartType !== "combo" && /* @__PURE__ */ jsxs("svg", { ref: svgRef, className: "chart-plot", viewBox: `0 0 ${width} ${height}`, width: "100%", height, role: "img", children: [
      renderTitle(),
      renderLegendItems(
        seriesKeys.map((seriesKey, index) => ({
          label: seriesLabels[seriesKey] || seriesKey,
          color: colors[index % colors.length]
        })),
        8
      ),
      isHorizontal ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(
          "line",
          {
            x1: zeroX,
            y1: paddingTop,
            x2: zeroX,
            y2: paddingTop + chartHeight,
            stroke: token.colorBorderSecondary
          }
        ),
        /* @__PURE__ */ jsx(
          "line",
          {
            x1: paddingLeft,
            y1: paddingTop + chartHeight,
            x2: paddingLeft + chartWidth,
            y2: paddingTop + chartHeight,
            stroke: token.colorBorderSecondary
          }
        ),
        chartType === "bar-horizontal" && renderHorizontalBars(),
        chartType === "stacked-horizontal" && renderHorizontalStackedBars(),
        chartType === "area-horizontal" && renderHorizontalLines(),
        data.map((group, index) => {
          const groupHeight = chartHeight / data.length;
          const y = paddingTop + index * groupHeight + groupHeight / 2;
          const label = group.label;
          return /* @__PURE__ */ jsxs(
            "text",
            {
              x: paddingLeft - 8,
              y: y + 4,
              fontSize: "11",
              textAnchor: "end",
              fill: token.colorTextSecondary,
              children: [
                /* @__PURE__ */ jsx("title", { children: group.label }),
                label
              ]
            },
            group.key
          );
        }),
        [0, 0.5, 1].map((ratio) => {
          const value = Math.round(minValue + (maxValue - minValue) * ratio);
          const x = paddingLeft + chartWidth * ratio;
          return /* @__PURE__ */ jsxs("g", { children: [
            /* @__PURE__ */ jsx("line", { x1: x, y1: paddingTop, x2: x, y2: paddingTop + chartHeight, stroke: token.colorBorder }),
            /* @__PURE__ */ jsx("text", { x, y: paddingTop + chartHeight + 20, fontSize: "11", textAnchor: "middle", fill: token.colorTextTertiary, children: value })
          ] }, `grid-x-${ratio}`);
        })
      ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(
          "line",
          {
            x1: paddingLeft,
            y1: zeroY,
            x2: paddingLeft + chartWidth,
            y2: zeroY,
            stroke: token.colorBorderSecondary
          }
        ),
        /* @__PURE__ */ jsx(
          "line",
          {
            x1: paddingLeft,
            y1: paddingTop,
            x2: paddingLeft,
            y2: paddingTop + chartHeight,
            stroke: token.colorBorderSecondary
          }
        ),
        chartType === "bar" && renderBars(),
        chartType === "stacked" && renderStackedBars(),
        (chartType === "line" || chartType === "area") && renderLines(),
        data.map((group, index) => {
          const x = paddingLeft + index * groupWidth + groupWidth / 2;
          const y = paddingTop + chartHeight + 10;
          const label = group.label;
          return /* @__PURE__ */ jsxs(
            "text",
            {
              x,
              y,
              fontSize: "11",
              textAnchor: "start",
              dominantBaseline: "hanging",
              fill: token.colorTextSecondary,
              transform: `rotate(35 ${x} ${y})`,
              children: [
                /* @__PURE__ */ jsx("title", { children: group.label }),
                label
              ]
            },
            group.key
          );
        }),
        [0, 0.5, 1].map((ratio) => {
          const value = Math.round(minValue + (maxValue - minValue) * ratio);
          const y = paddingTop + chartHeight - chartHeight * ratio;
          return /* @__PURE__ */ jsxs("g", { children: [
            /* @__PURE__ */ jsx("line", { x1: paddingLeft, y1: y, x2: paddingLeft + chartWidth, y2: y, stroke: token.colorBorder }),
            /* @__PURE__ */ jsx("text", { x: paddingLeft - 8, y: y + 4, fontSize: "11", textAnchor: "end", fill: token.colorTextTertiary, children: value })
          ] }, `grid-${ratio}`);
        })
      ] })
    ] })
  ] }, animationKey);
};
var JM_CSS_VARS_LIGHT = `
  --jm-bg: #ffffff;
  --jm-bg-secondary: #f5fbff;
  --jm-bg-tertiary: #f3f6f9;
  --jm-bg-elevated: #ffffff;
  --jm-text-primary: #0f172a;
  --jm-text-secondary: #475569;
  --jm-text-tertiary: #6b7280;
  --jm-text-link: #1677FF;
  --jm-border: #dbe3ef;
  --jm-border-secondary: #d1d5db;
  --jm-border-cell: #eef2f7;
  --jm-separator: #e0e0e0;
  --jm-card-bg: #ffffff;
  --jm-card-border: #cfe0eb;
  --jm-card-header-from: #f5fbff;
  --jm-card-header-to: #eff8ff;
  --jm-card-shadow: rgba(18, 47, 64, 0.10);
  --jm-card-back-bg: #f8fcff;
  --jm-card-back-border: #e2eef6;
  --jm-btn-bg: #fff;
  --jm-btn-border: #d9d9d9;
  --jm-btn-text: rgba(0,0,0,0.88);
  --jm-btn-hover-bg: #ffffff;
  --jm-input-bg: #ffffff;
  --jm-input-text: #111111;
  --jm-input-placeholder: #9aa7b5;
  --jm-input-editable-bg: #f3f6f9;
  --jm-kpi-banner-bg: #F2FFFF;
  --jm-kpi-user-bg: #d6f0ff;
  --jm-kpi-ask-bg: #edf7ff;
  --jm-kpi-label: #3f5565;
  --jm-kpi-value: #1677FF;
  --jm-kpi-paragraph: #333;
  --jm-tone-soft: #dbeafe;
  --jm-tone-softer: #eff6ff;
  --jm-carousel-btn-bg: #ffffff;
  --jm-carousel-btn-text: #456277;
  --jm-carousel-btn-border: #b8d0e0;
  --jm-carousel-active-bg: #eaf5ff;
  --jm-carousel-active-border: #8eb3ca;
  --jm-carousel-active-text: #194f6f;
  --jm-carousel-header-from: #f6fafc;
  --jm-carousel-header-to: #eef5f8;
  --jm-filter-popover-bg: #fff;
  --jm-filter-popover-shadow: rgba(17,24,39,.16);
  --jm-sort-arrow: #9ca3af;
  --jm-filter-icon: #6b7280;
  --jm-numeric-bar: rgba(37,99,235,.16);
  --jm-no-results: #6b7280;
`;
var JM_CSS_VARS_DARK = `
  --jm-bg: #141414;
  --jm-bg-secondary: #1a1a2e;
  --jm-bg-tertiary: #1f1f33;
  --jm-bg-elevated: #1c1c1c;
  --jm-text-primary: #e4e4e7;
  --jm-text-secondary: #a1a1aa;
  --jm-text-tertiary: #71717a;
  --jm-text-link: #4ea4f6;
  --jm-border: #2e2e3a;
  --jm-border-secondary: #3f3f50;
  --jm-border-cell: #232336;
  --jm-separator: #2e2e3a;
  --jm-card-bg: #1c1c2e;
  --jm-card-border: #2e3d4f;
  --jm-card-header-from: #1a1a2e;
  --jm-card-header-to: #1e2230;
  --jm-card-shadow: rgba(0, 0, 0, 0.30);
  --jm-card-back-bg: #181828;
  --jm-card-back-border: #2a2a40;
  --jm-btn-bg: #23233a;
  --jm-btn-border: #3f3f50;
  --jm-btn-text: rgba(228,228,231,0.88);
  --jm-btn-hover-bg: #2a2a44;
  --jm-input-bg: #1a1a2e;
  --jm-input-text: #e4e4e7;
  --jm-input-placeholder: #6b6b80;
  --jm-input-editable-bg: #1f1f33;
  --jm-kpi-banner-bg: #141828;
  --jm-kpi-user-bg: #162030;
  --jm-kpi-ask-bg: #161e30;
  --jm-kpi-label: #8fa4b5;
  --jm-kpi-value: #4ea4f6;
  --jm-kpi-paragraph: #b0b0c0;
  --jm-tone-soft: #1e2a40;
  --jm-tone-softer: #181e30;
  --jm-carousel-btn-bg: #23233a;
  --jm-carousel-btn-text: #8fa4b5;
  --jm-carousel-btn-border: #2e3d4f;
  --jm-carousel-active-bg: #1a2840;
  --jm-carousel-active-border: #3a5570;
  --jm-carousel-active-text: #a0c8e8;
  --jm-carousel-header-from: #1a1a2e;
  --jm-carousel-header-to: #1e2230;
  --jm-filter-popover-bg: #1c1c2e;
  --jm-filter-popover-shadow: rgba(0,0,0,.40);
  --jm-sort-arrow: #6b6b80;
  --jm-filter-icon: #71717a;
  --jm-numeric-bar: rgba(78,164,246,.20);
  --jm-no-results: #71717a;
`;
var traceLog = (label, detail) => {
  if (typeof window === "undefined" || sessionStorage.getItem("jm_trace") !== "1") return;
  const now = performance.now();
  console.log(`[JM_TRACE ${now.toFixed(1)}ms] ${label}${detail ? " | " + detail : ""}`);
};
var ExecutableHtml = ({
  html,
  htmlChunks,
  resetToken = "",
  style,
  mode = "inline",
  minHeight = 600,
  title = "legacy-rendered-view",
  inheritTypography = false,
  inheritTabRowBackground = false,
  fontSizeOverride
}) => {
  const htmlRef = useRef(null);
  const iframeRef = useRef(null);
  const observerRef = useRef(null);
  const appendedChunksRef = useRef(0);
  const scriptIdRef = useRef(0);
  const syncHeightTimerRef = useRef(null);
  const lastSetHeightRef = useRef(0);
  const [fontFamily, setFontFamily] = useState("Arial, sans-serif");
  const [fontSize, setFontSize] = useState("14px");
  const [lineHeight, setLineHeight] = useState("1.5715");
  const [tabRowBackground, setTabRowBackground] = useState("#fafafa");
  const { mode: colorMode } = useContext(ColorModeContext);
  const isDark = colorMode === "dark";
  useRef(performance.now());
  const instanceId = useRef(Math.random().toString(36).slice(2, 6));
  const htmlRefForEffect = useRef(html);
  htmlRefForEffect.current = html;
  traceLog("ExecutableHtml", `[${instanceId.current}] mount mode=${mode} title=${title} htmlLen=${(html || "").length}`);
  const executeScriptNodesSequentially = useCallback(async (doc, scriptNodes, isCancelled) => {
    for (const oldScript of scriptNodes) {
      if (isCancelled?.()) return;
      const newScript = doc.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) => {
        if (attr.name === "data-jm-script-id") return;
        newScript.setAttribute(attr.name, attr.value);
      });
      if (!oldScript.src) {
        newScript.text = oldScript.text || "";
        newScript.async = false;
        oldScript.parentNode?.replaceChild(newScript, oldScript);
        continue;
      }
      await new Promise((resolve) => {
        newScript.onload = () => resolve();
        newScript.onerror = () => resolve();
        newScript.async = false;
        oldScript.parentNode?.replaceChild(newScript, oldScript);
      });
    }
  }, []);
  useEffect(() => {
    if (mode !== "inline") return;
    const container = htmlRef.current;
    if (!container || !html) return;
    const scripts = Array.from(container.querySelectorAll("script"));
    let cancelled = false;
    void executeScriptNodesSequentially(document, scripts, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [html, mode, executeScriptNodesSequentially]);
  useEffect(() => {
    if (mode !== "iframe") return;
    if (!inheritTypography && !inheritTabRowBackground) return;
    if (typeof window === "undefined") return;
    const bodyStyle = window.getComputedStyle(document.body);
    if (inheritTypography) {
      const nextFontFamily = String(bodyStyle?.fontFamily || "").trim();
      const nextFontSize = fontSizeOverride || String(bodyStyle?.fontSize || "").trim();
      const nextLineHeight = String(bodyStyle?.lineHeight || "").trim();
      if (nextFontFamily) setFontFamily(nextFontFamily);
      if (nextFontSize) setFontSize(nextFontSize);
      if (nextLineHeight && nextLineHeight !== "normal") setLineHeight(nextLineHeight);
    }
    if (inheritTabRowBackground) {
      const isTransparent = (value) => {
        const normalized = String(value || "").replace(/\s+/g, "").toLowerCase();
        return !normalized || normalized === "transparent" || normalized === "rgba(0,0,0,0)";
      };
      const tabEl = document.querySelector(".ant-tabs-tab");
      const navEl = document.querySelector(".ant-tabs-nav");
      const tabBg = tabEl ? window.getComputedStyle(tabEl).backgroundColor : "";
      const navBg = navEl ? window.getComputedStyle(navEl).backgroundColor : "";
      const resolvedBg = !isTransparent(tabBg) ? tabBg : !isTransparent(navBg) ? navBg : "";
      if (resolvedBg) setTabRowBackground(resolvedBg);
    }
  }, [inheritTabRowBackground, inheritTypography, mode]);
  const htmlShell = useMemo(() => `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
:root {
${isDark ? JM_CSS_VARS_DARK : JM_CSS_VARS_LIGHT}
}
html, body {
  margin: 0;
  padding: 0;
  background: var(--jm-bg, #ffffff);
  color: var(--jm-text-primary, #0f172a);
  font-size: ${fontSize};
  line-height: ${lineHeight};
}
body, table, th, td, input, button, select, textarea, div, span, p, li, ul, ol {
  font-family: ${fontFamily} !important;
}
.jm-fileview-name-row {
  background-color: ${tabRowBackground} !important;
  color: ${isDark ? "#e4e4e7" : "#0f172a"} !important;
}
.jm-fileview-description {
  font-size: 12px !important;
  line-height: 1.45 !important;
}
</style>
</head>
<body></body>
</html>`, [fontFamily, fontSize, lineHeight, tabRowBackground, isDark]);
  const syncHeight = useCallback(() => {
    if (syncHeightTimerRef.current) clearTimeout(syncHeightTimerRef.current);
    syncHeightTimerRef.current = setTimeout(() => {
      syncHeightTimerRef.current = null;
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      if (!iframe || !doc) return;
      const rawHeight = Math.max(
        doc.body?.scrollHeight || 0,
        doc.documentElement?.scrollHeight || 0,
        minHeight
      );
      const nextHeight = rawHeight + 8;
      if (Math.abs(nextHeight - lastSetHeightRef.current) <= 8) return;
      lastSetHeightRef.current = nextHeight;
      iframe.style.height = `${nextHeight}px`;
    }, 100);
  }, [minHeight]);
  const appendHtmlChunk = useCallback(async (chunk) => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc || !doc.body || !chunk) return false;
    const host = doc.createElement("div");
    host.innerHTML = chunk;
    const scriptIds = [];
    Array.from(host.querySelectorAll("script")).forEach((scriptNode) => {
      const nextId = String(++scriptIdRef.current);
      scriptNode.setAttribute("data-jm-script-id", nextId);
      scriptIds.push(nextId);
    });
    while (host.firstChild) {
      doc.body.appendChild(host.firstChild);
    }
    if (scriptIds.length) {
      const pendingScripts = scriptIds.map((id) => doc.querySelector(`script[data-jm-script-id="${id}"]`)).filter(Boolean);
      await executeScriptNodesSequentially(doc, pendingScripts);
    }
    syncHeight();
    return true;
  }, [syncHeight, executeScriptNodesSequentially]);
  useEffect(() => {
    if (mode !== "iframe") return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    appendedChunksRef.current = 0;
    lastSetHeightRef.current = 0;
    const loadStartTime = performance.now();
    iframe.srcdoc = htmlShell;
    traceLog("ExecutableHtml", `[${instanceId.current}] iframe srcdoc set, waiting for load event`);
    const onLoad = () => {
      const loadElapsed = performance.now() - loadStartTime;
      traceLog("ExecutableHtml", `[${instanceId.current}] iframe load event fired after ${loadElapsed.toFixed(0)}ms`);
      const doc = iframe.contentDocument;
      if (!doc) return;
      if (observerRef.current) observerRef.current.disconnect();
      const observer = new MutationObserver(syncHeight);
      observer.observe(doc.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true
      });
      observerRef.current = observer;
      void (async () => {
        const currentHtml = htmlRefForEffect.current;
        if (htmlChunks && htmlChunks.length > 0) {
          let appendedCount = 0;
          for (const chunk of htmlChunks) {
            if (await appendHtmlChunk(chunk)) appendedCount += 1;
          }
          appendedChunksRef.current = appendedCount;
        } else if (currentHtml) {
          await appendHtmlChunk(currentHtml);
        } else {
          syncHeight();
        }
      })();
    };
    iframe.addEventListener("load", onLoad);
    return () => {
      iframe.removeEventListener("load", onLoad);
    };
  }, [htmlShell, resetToken, appendHtmlChunk, syncHeight, mode]);
  useEffect(() => {
    if (mode !== "iframe") return;
    if (!htmlChunks || htmlChunks.length <= appendedChunksRef.current) return;
    const nextChunks = htmlChunks.slice(appendedChunksRef.current);
    void (async () => {
      let appendedCount = 0;
      for (const chunk of nextChunks) {
        if (await appendHtmlChunk(chunk)) appendedCount += 1;
      }
      appendedChunksRef.current += appendedCount;
    })();
  }, [htmlChunks, appendHtmlChunk, mode]);
  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = null;
      if (syncHeightTimerRef.current) clearTimeout(syncHeightTimerRef.current);
    };
  }, []);
  if (mode === "iframe") {
    return /* @__PURE__ */ jsx(
      "iframe",
      {
        ref: iframeRef,
        title,
        style: { width: "100%", minHeight, border: 0, ...style }
      }
    );
  }
  return /* @__PURE__ */ jsx("div", { ref: htmlRef, dangerouslySetInnerHTML: { __html: html || "" }, style });
};

// src/components/DynamicResource/relations/helpers.ts
var _9 = window._ || ((text) => text);
var INLINE_RELATION_VIEW_TYPES = /* @__PURE__ */ new Set(["list", "csv"]);
var TABLE_RELATION_VIEW_TYPES = /* @__PURE__ */ new Set(["table", "totals-details"]);
var isInlineRelationViewType = (viewType) => INLINE_RELATION_VIEW_TYPES.has(viewType);
var usesTableRelationBehavior = (viewType) => TABLE_RELATION_VIEW_TYPES.has(viewType);
var DEFAULT_SHOW_RELATION_ROW_ACTIONS = false;
var DEFAULT_EDIT_RELATION_ROW_ACTIONS = true;
var DEFAULT_RELATION_CREATE_ACTIONS = true;
var isReverseRelation = (rel) => {
  if (rel.relationName && rel.relationName.endsWith("_reverse")) return true;
  return !rel.otherResource;
};
var getRelationViewType = (rel, mode, defaults) => {
  const showFallback = defaults?.show || "totals-details";
  const editFallback = defaults?.edit || "editable-table";
  if (mode === "show") {
    if (rel.showViewTypeFromCsv && rel.showViewType) return rel.showViewType;
    return showFallback;
  }
  if (rel.editViewTypeFromCsv && rel.editViewType) return rel.editViewType;
  return editFallback;
};
var getRelationTabName = (rel, mode, fallback) => {
  const explicit = mode === "show" ? rel.showTab : rel.editTab;
  if (!explicit) return fallback;
  if (isReverseRelation(rel)) {
    const relationKey2 = String(rel.relationName || rel.resource || "").trim().toLowerCase();
    const explicitKey = String(explicit).trim().toLowerCase();
    const labelKey = String(getRelationLabel(rel) || rel.label || "").trim().toLowerCase();
    const baseKey = relationKey2.replace(/_reverse$/, "").replace(/_object$/, "").replace(/_relation$/, "");
    const humanize = (value) => value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    const humanRelationKey = humanize(relationKey2);
    const humanBaseKey = humanize(baseKey);
    if (explicitKey === labelKey || explicitKey === relationKey2 || explicitKey === baseKey || explicitKey === humanRelationKey || explicitKey === humanBaseKey) {
      return fallback;
    }
  }
  const translatedExplicit = _9(explicit);
  if (translatedExplicit !== explicit) return explicit;
  const relationKey = rel.relationName || rel.resource || "";
  if (relationKey) {
    const translatedRelationKey = translateRelationKey(relationKey);
    const likelyHumanizedLabel = explicit.includes(" ") || /[A-Z]/.test(explicit);
    if (likelyHumanizedLabel && translatedRelationKey !== relationKey) {
      return relationKey;
    }
  }
  return explicit;
};
var getTabDisplayLabel = (tabName) => {
  const direct = _9(tabName);
  if (direct !== tabName) return direct;
  return translateRelationKey(tabName);
};
var _10 = window._ || ((text) => text);
var DARK_GRAY = "#444";
var { Title } = Typography;
var MetadataModal = ({ model, allModels, open, onClose }) => {
  const apiUrl = useApiUrl();
  const tone = useModelTone(model);
  const modelLabel = getModelLabel(model);
  const [nestedModel, setNestedModel] = useState(null);
  const [activeTab, setActiveTab] = useState("fields");
  const [graphHtml, setGraphHtml] = useState(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState(null);
  useEffect(() => {
    setGraphHtml(null);
    setGraphError(null);
  }, [model.name]);
  const findRelatedModel = useCallback((name) => {
    if (!name || !allModels) return void 0;
    const lower = name.toLowerCase();
    return allModels.find(
      (m) => (m.name || "").toLowerCase() === lower || (m.resource || "").toLowerCase() === lower
    );
  }, [allModels]);
  const loadGraph = useCallback(async () => {
    if (graphHtml !== null || graphLoading) return;
    setGraphLoading(true);
    setGraphError(null);
    try {
      const relations = (model.relations || []).map((r) => {
        const targetName = r.otherResource || r.resource;
        const relModel = findRelatedModel(targetName);
        const other_label = relModel ? _10(getModelLabel(relModel)) : _10(targetName || "");
        return {
          relation_name: r.relationName || r.resource,
          relation_label: getRelationLabel(r),
          other_resource: targetName,
          other_label,
          is_reverse: isReverseRelation(r),
          nav_url: `/${targetName}`
        };
      });
      const res = await authenticatedFetch(`${apiUrl}/views/model_graph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_name: model.name,
          model_label: modelLabel,
          relations
        })
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setGraphHtml(data.html || "");
    } catch (e) {
      setGraphError(e instanceof Error ? e.message : String(e));
    } finally {
      setGraphLoading(false);
    }
  }, [apiUrl, model, modelLabel, graphHtml, graphLoading, findRelatedModel]);
  useEffect(() => {
    if (activeTab === "knowledge_graph") {
      loadGraph();
    }
  }, [activeTab, loadGraph]);
  const navigate = useNavigate();
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.action === "metadata_graph_navigate" && e.data?.url) {
        onClose();
        navigate(e.data.url);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [navigate, onClose]);
  const fieldColumns = [
    {
      title: _10("Field"),
      dataIndex: "label",
      key: "label",
      width: 160,
      render: (_val, row) => /* @__PURE__ */ jsx("span", { style: { color: tone.solid }, children: getFieldLabel(row) })
    },
    {
      title: _10("Type"),
      dataIndex: "type",
      key: "type",
      width: 90,
      render: (v) => /* @__PURE__ */ jsx(Tag, { style: { color: DARK_GRAY }, children: _10(v) })
    },
    {
      title: _10("Required"),
      dataIndex: "required",
      key: "required",
      width: 80,
      render: (v) => v ? /* @__PURE__ */ jsx(CheckCircleOutlined, { style: { color: "#52c41a" } }) : null
    },
    {
      title: _10("Description"),
      dataIndex: "description",
      key: "description",
      render: (v) => v ? /* @__PURE__ */ jsx("span", { style: { color: DARK_GRAY }, children: _10(v) }) : /* @__PURE__ */ jsx("span", { style: { color: "#bbb" }, children: "\u2014" })
    },
    {
      title: _10("Constraints"),
      dataIndex: "constraints",
      key: "constraints",
      width: 180,
      render: (v) => v?.length ? v.map((c, i) => /* @__PURE__ */ jsx(Tag, { style: { fontSize: 11, color: DARK_GRAY }, children: c }, i)) : /* @__PURE__ */ jsx("span", { style: { color: "#bbb" }, children: "\u2014" })
    },
    {
      title: _10("Valid Values"),
      dataIndex: "options",
      key: "options",
      width: 200,
      render: (_v, row) => {
        const opts = row.options;
        if (!opts?.length) return /* @__PURE__ */ jsx("span", { style: { color: "#bbb" }, children: "\u2014" });
        return /* @__PURE__ */ jsx("span", { style: { display: "flex", flexWrap: "wrap", gap: 2 }, children: opts.map((o, i) => {
          const color = row.valueColors?.[String(o.value)];
          return /* @__PURE__ */ jsx(Tag, { color, style: { fontSize: 11, color: color ? void 0 : DARK_GRAY, margin: 0 }, children: String(o.label) }, i);
        }) });
      }
    },
    {
      title: _10("Default"),
      key: "default",
      width: 120,
      render: (_v, row) => {
        const val = row.default ?? row.defaultValue ?? row.default_value;
        if (val === void 0 || val === null) return /* @__PURE__ */ jsx("span", { style: { color: "#bbb" }, children: "\u2014" });
        return /* @__PURE__ */ jsx("code", { style: { fontSize: 12, color: DARK_GRAY }, children: String(val) });
      }
    },
    {
      title: _10("Formula"),
      dataIndex: "formula",
      key: "formula",
      render: (v) => v ? /* @__PURE__ */ jsx("code", { style: { fontSize: 12, color: DARK_GRAY }, children: v }) : /* @__PURE__ */ jsx("span", { style: { color: "#bbb" }, children: "\u2014" })
    }
  ];
  const relationColumns = [
    {
      title: _10("Relation"),
      dataIndex: "label",
      key: "label",
      width: 200,
      render: (_val, row) => /* @__PURE__ */ jsx("span", { style: { color: DARK_GRAY }, children: getRelationLabel(row) })
    },
    {
      title: _10("Related Model"),
      dataIndex: "otherResource",
      key: "otherResource",
      width: 160,
      render: (v) => {
        if (!v) return /* @__PURE__ */ jsx("span", { style: { color: "#bbb" }, children: "\u2014" });
        const related = findRelatedModel(v);
        if (related) {
          const relTone = getModelTone(related);
          return /* @__PURE__ */ jsx(
            Button,
            {
              type: "link",
              size: "small",
              style: { padding: 0, color: relTone.solid, fontWeight: 500 },
              onClick: () => setNestedModel(related),
              children: _10(v)
            }
          );
        }
        return /* @__PURE__ */ jsx("span", { style: { color: DARK_GRAY }, children: _10(v) });
      }
    },
    {
      title: _10("Keys"),
      key: "keys",
      width: 170,
      render: (_val, row) => /* @__PURE__ */ jsxs("span", { style: { fontSize: 12, fontFamily: "monospace", color: DARK_GRAY }, children: [
        row.targetKey,
        row.otherKey ? /* @__PURE__ */ jsxs("span", { style: { color: "#888" }, children: [
          " \u2192 ",
          row.otherKey
        ] }) : null,
        row.isRecursive ? /* @__PURE__ */ jsx(Tag, { style: { marginLeft: 4, fontSize: 10 }, children: _10("recursive") }) : null
      ] })
    },
    {
      title: _10("Description"),
      dataIndex: "description",
      key: "description",
      render: (v) => v ? /* @__PURE__ */ jsx("span", { style: { color: DARK_GRAY }, children: _10(v) }) : /* @__PURE__ */ jsx("span", { style: { color: "#bbb" }, children: "\u2014" })
    }
  ];
  const knowledgeGraphChildren = /* @__PURE__ */ jsxs(Fragment, { children: [
    graphLoading && /* @__PURE__ */ jsx(Skeleton, { active: true, paragraph: { rows: 6 } }),
    graphError && /* @__PURE__ */ jsx(Alert, { type: "error", message: _10("Error loading knowledge graph"), description: graphError }),
    graphHtml && !graphLoading && /* @__PURE__ */ jsx(ExecutableHtml, { html: graphHtml, style: { minHeight: 400 } })
  ] });
  const tabItems = [
    {
      key: "fields",
      label: _10("Fields"),
      children: /* @__PURE__ */ jsx(
        Table,
        {
          columns: fieldColumns,
          dataSource: (model.fields || []).filter((f) => f.key !== "cwuri"),
          rowKey: "key",
          size: "small",
          pagination: false,
          scroll: { x: true }
        }
      )
    },
    ...model.relations?.length ? [{
      key: "relations",
      label: _10("Relations"),
      children: (() => {
        const sortByName = (a, b) => getRelationLabel(a).localeCompare(getRelationLabel(b));
        const reverseRels = (model.relations || []).filter((r) => isReverseRelation(r)).sort(sortByName);
        const forwardRels = (model.relations || []).filter((r) => !isReverseRelation(r)).sort(sortByName);
        return /* @__PURE__ */ jsxs(Fragment, { children: [
          reverseRels.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(Title, { level: 5, style: { marginTop: 0, marginBottom: 8, fontWeight: 500 }, children: _10("Reverse Relations") }),
            /* @__PURE__ */ jsx(
              Table,
              {
                columns: relationColumns,
                dataSource: reverseRels,
                rowKey: (r) => r.resource + r.targetKey,
                size: "small",
                pagination: false,
                scroll: { x: true },
                style: { marginBottom: 20 }
              }
            )
          ] }),
          forwardRels.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(Title, { level: 5, style: { marginTop: 0, marginBottom: 8, fontWeight: 500 }, children: _10("Forward Relations") }),
            /* @__PURE__ */ jsx(
              Table,
              {
                columns: relationColumns,
                dataSource: forwardRels,
                rowKey: (r) => r.resource + r.targetKey,
                size: "small",
                pagination: false,
                scroll: { x: true }
              }
            )
          ] })
        ] });
      })()
    }] : [],
    {
      key: "knowledge_graph",
      label: _10("Knowledge Graph"),
      children: knowledgeGraphChildren
    }
  ];
  const moduleLabel = model.module ? getModuleLabel(model.module) : void 0;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(
      Modal,
      {
        title: /* @__PURE__ */ jsxs("span", { style: { color: tone.solid }, children: [
          /* @__PURE__ */ jsx(InfoCircleOutlined, { style: { marginRight: 8 } }),
          _10("Metadata"),
          " \u2014 ",
          moduleLabel ? `${moduleLabel} \u203A ` : "",
          modelLabel
        ] }),
        open,
        onCancel: onClose,
        footer: null,
        width: 1290,
        styles: { body: { minHeight: 520, maxHeight: "75vh", overflowY: "auto" } },
        destroyOnHidden: true,
        children: [
          model.description && /* @__PURE__ */ jsx("div", { style: {
            background: tone.soft,
            color: tone.text,
            padding: "10px 14px",
            borderRadius: 6,
            marginBottom: 16,
            fontStyle: "italic",
            border: "none"
          }, children: _10(model.description) }),
          /* @__PURE__ */ jsx(Tabs, { items: tabItems, size: "small", activeKey: activeTab, onChange: setActiveTab })
        ]
      }
    ),
    nestedModel && /* @__PURE__ */ jsx(
      MetadataModal,
      {
        model: nestedModel,
        allModels,
        open: true,
        onClose: () => setNestedModel(null)
      }
    )
  ] });
};
var _11 = window._ || ((text) => text);
var useMetadataModal = (model, allModels) => {
  const [metadataOpen, setMetadataOpen] = useState(false);
  const metadataButton = /* @__PURE__ */ jsx(Tooltip, { title: _11("Metadata"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(InfoCircleOutlined, {}), onClick: () => setMetadataOpen(true) }) });
  const metadataModal = /* @__PURE__ */ jsx(MetadataModal, { model, allModels, open: metadataOpen, onClose: () => setMetadataOpen(false) });
  return { metadataButton, metadataModal };
};
var _12 = window._ || ((text) => text);
var useShowEditableForm = (resource, id) => {
  const navigate = useNavigate();
  const { formProps, saveButtonProps, queryResult } = useForm({
    resource,
    action: "edit",
    id,
    redirect: false,
    successNotification: () => ({
      message: _12("Changes saved."),
      type: "success"
    })
  });
  const record = queryResult?.data?.data;
  const recordId = record?.eid ?? record?.id ?? id;
  useKeyboardShortcuts(useMemo(() => [
    { key: "s", ctrl: true, handler: () => formProps?.form?.submit() },
    { key: "Escape", handler: () => navigate(-1) }
  ], [formProps?.form, navigate]));
  return {
    formProps,
    saveButtonProps,
    queryResult,
    record,
    recordId
  };
};

// src/components/DynamicResource/hooks/buildShowTabFormOptions.ts
var buildShowTabFormOptions = (formProps, model, allModels) => {
  const allModelsList = allModels || [];
  const effectiveFields = model ? applyRelationFieldOverrides(model, allModelsList) : [];
  if (!model || !isFileModel(model)) return { formProps, effectiveFields };
  const originalOnFinish = formProps?.onFinish;
  return {
    formProps: {
      ...formProps,
      onFinish: (values) => {
        const { data: _binaryData, ...rest } = values || {};
        return originalOnFinish?.(rest);
      }
    },
    effectiveFields
  };
};
var _13 = window._ || ((text) => text);
var ShowFooterButtons = ({ model, allModels, recordId, saveButtonProps }) => {
  const navigate = useNavigate();
  const allModelsList = allModels || [];
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }, children: [
    recordId != null && /* @__PURE__ */ jsx(Tooltip, { title: _13("Delete"), children: /* @__PURE__ */ jsx("span", { children: /* @__PURE__ */ jsx(
      DeleteButton,
      {
        resource: model.name,
        recordItemId: recordId,
        hideText: true,
        onSuccess: () => navigate(`/${resolveResourcePath(model.resource || model.name, allModelsList)}`)
      }
    ) }) }),
    /* @__PURE__ */ jsx(Tooltip, { title: _13("Save"), children: /* @__PURE__ */ jsx(Button, { ...saveButtonProps, type: "primary", icon: /* @__PURE__ */ jsx(SaveOutlined, {}) }) })
  ] });
};
var renderModelHeading = ({
  model,
  title,
  actionLabel,
  moduleLabel
}) => {
  const tone = getModelTone(model);
  return /* @__PURE__ */ jsx(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 4,
        background: "transparent",
        borderRadius: 6,
        paddingTop: 8,
        paddingBottom: 2,
        paddingLeft: 10,
        paddingRight: 10
      },
      children: /* @__PURE__ */ jsx("div", { style: { minWidth: 0, fontSize: 16, fontWeight: 700, color: tone.solid, padding: "2px 8px" }, children: title })
    }
  );
};
var ModelHeading = ({ model, title, actionLabel }) => {
  const moduleLabel = model.module ? getModuleLabel(model.module) : void 0;
  return /* @__PURE__ */ jsx("div", { style: wrappedPageTitleStyle2, children: renderModelHeading({ model, title, actionLabel, moduleLabel }) });
};

// src/components/DynamicResource/utils/polymorphic.ts
var GALLERY_RELATION_MAX_ITEMS = 120;
var POLYMORPHIC_RELATION_MAX_ROWS = 120;
var filterIdsByPolymorphicType = async (apiUrl, ids, polymorphicType, signal) => {
  if (ids.length === 0) return /* @__PURE__ */ new Set();
  try {
    const resp = await authenticatedFetch(`${apiUrl}/_meta/entity-types`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
      signal
    });
    if (resp.ok) {
      const data = await resp.json();
      const types = data?.types || {};
      const target = polymorphicType.toLowerCase();
      const matching = /* @__PURE__ */ new Set();
      ids.forEach((id) => {
        const entityType = types[String(id)];
        if (entityType && entityType.toLowerCase() === target) {
          matching.add(id);
        }
      });
      return matching;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
  }
  return new Set(ids);
};
var fetchPolymorphicGroups = async ({
  apiUrl,
  rel,
  recordId,
  referenceResource,
  allModels
}) => {
  const pageSize = 500;
  let start = 0;
  let relationRows = [];
  while (true) {
    const params = new URLSearchParams();
    params.set("_start", String(start));
    params.set("_end", String(start + pageSize));
    params.append(rel.targetKey, String(recordId));
    const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
    const relationResponse = await authenticatedFetch(`${apiUrl}/${relationResource}?${params.toString()}`);
    if (!relationResponse.ok) {
      throw new Error(`Failed to load ${rel.label} relations`);
    }
    const pageRows = await relationResponse.json();
    if (!Array.isArray(pageRows)) break;
    relationRows = relationRows.concat(pageRows);
    if (relationRows.length >= POLYMORPHIC_RELATION_MAX_ROWS) {
      relationRows = relationRows.slice(0, POLYMORPHIC_RELATION_MAX_ROWS);
      break;
    }
    if (pageRows.length < pageSize) break;
    start += pageSize;
  }
  const relatedIds = relationRows.map((row) => row?.[rel.otherKey]).filter((value) => value !== void 0 && value !== null);
  if (relatedIds.length === 0) {
    return { groups: /* @__PURE__ */ new Map(), unresolved: [] };
  }
  const uniqueIds = Array.from(new Set(relatedIds));
  const referenceRecords = [];
  const batchSize = 20;
  for (let index = 0; index < uniqueIds.length; index += batchSize) {
    const batch = uniqueIds.slice(index, index + batchSize);
    const batchResults = await Promise.all(batch.map(async (id) => {
      try {
        const response = await authenticatedFetch(`${apiUrl}/${referenceResource}/${id}`);
        if (!response.ok) return null;
        return response.json();
      } catch {
        return null;
      }
    }));
    referenceRecords.push(...batchResults.filter(Boolean));
  }
  const typeById = new Map(
    referenceRecords.filter((item) => item?.type).map((item) => [item?.eid ?? item?.id, String(item.type)])
  );
  const groups = /* @__PURE__ */ new Map();
  const unresolved = [];
  const labelsById = /* @__PURE__ */ new Map();
  referenceRecords.forEach((item) => {
    const id = item?.eid ?? item?.id;
    if (id === void 0 || id === null) return;
    const label = item?._label || item?.name || item?.description;
    if (label) labelsById.set(id, String(label));
  });
  uniqueIds.forEach((id) => {
    const typeName = typeById.get(id);
    const targetModel = resolveModelByEntityType(allModels, typeName);
    if (!targetModel) {
      unresolved.push(id);
      return;
    }
    if (!matchesPolymorphicType(rel, typeName)) return;
    const existing = groups.get(targetModel.name) || /* @__PURE__ */ new Set();
    existing.add(id);
    groups.set(targetModel.name, existing);
  });
  return { groups, unresolved, labelsById };
};
var ReferenceField = ({ id, resource, onLabel }) => {
  const { data, isLoading } = useOne({ resource, id, queryOptions: { enabled: !!id } });
  const record = data?.data;
  const label = record?._label || record?.name || record?.description || id;
  useEffect(() => {
    if (onLabel && !isLoading && label !== void 0 && label !== null) {
      onLabel(String(label));
    }
  }, [label, onLabel, isLoading]);
  if (isLoading) return /* @__PURE__ */ jsx(Skeleton.Input, { active: true, size: "small", style: { width: 100 } });
  return /* @__PURE__ */ jsx("span", { children: label });
};
var RelatedObjectPreview = ({ resource, id, model, allModels, fallbackLabel }) => {
  const { data, isLoading } = useOne({ resource, id, queryOptions: { enabled: !!id } });
  const record = data?.data;
  const label = record?._label || record?.name || record?.description || id;
  const previewFields = model ? getListViewFields(model) : [];
  if (isLoading) return /* @__PURE__ */ jsx(Spin, { size: "small" });
  if (!record || previewFields.length === 0) return /* @__PURE__ */ jsx("span", { children: fallbackLabel ?? label });
  return /* @__PURE__ */ jsx(
    Tooltip,
    {
      placement: "right",
      overlayStyle: { maxWidth: 720 },
      overlayInnerStyle: { width: 720 },
      title: /* @__PURE__ */ jsx("div", { style: { width: "100%" }, children: previewFields.map((field) => /* @__PURE__ */ jsxs("div", { style: { display: "grid", gridTemplateColumns: "180px 1fr", columnGap: 8 }, children: [
        /* @__PURE__ */ jsx("span", { style: { fontWeight: 500 }, children: field.label }),
        /* @__PURE__ */ jsx("span", { style: { whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word" }, children: field.reference && record?.[field.key] && hasReferenceModel(field.reference, allModels) ? /* @__PURE__ */ jsx(ReferenceField, { id: record[field.key], resource: resolveResourcePath(field.referencePath || field.reference, allModels) }) : field.options && record?.[field.key] ? field.options.find((option) => option.value === record[field.key])?.label || record[field.key] : record?.[field.key] ?? "-" })
      ] }, field.key)) }),
      children: /* @__PURE__ */ jsx("span", { children: label })
    }
  );
};
var _14 = window._ || ((text) => text);
var RelationsExplorer = ({ model, record, allModels, isActive = true }) => {
  const apiUrl = useApiUrl();
  const go = useGo();
  const paneNav = usePaneNavigation();
  const [reverseTreeData, setReverseTreeData] = useState([]);
  const [forwardTreeData, setForwardTreeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const isReverse = (rel) => {
    if (rel.relationName && rel.relationName.endsWith("_reverse")) return true;
    return !rel.otherResource;
  };
  useEffect(() => {
    if (!isActive) {
      setLoading(false);
      return;
    }
    const fetchRelations = async () => {
      if (!model.relations || !record) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const recordPkField = model.pkField || "eid";
      const currentRecordId = record[recordPkField] ?? record.eid ?? record.id;
      const promises = model.relations.map(async (rel) => {
        const relationModel = findModelByName(allModels, rel.resource);
        if (!relationModel) return null;
        const relatedModel = rel.otherResource ? findModelByName(allModels, rel.otherResource) : void 0;
        const relationTone = getModelTone(relatedModel || relationModel || rel.resource);
        const relationLabelNode = /* @__PURE__ */ jsx(
          "span",
          {
            style: {
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 8px",
              borderRadius: 6,
              background: "transparent",
              color: relationTone.text,
              fontWeight: 600,
              lineHeight: 1.2
            },
            children: rel.label
          }
        );
        const polyInfo = getPolymorphicReferenceInfo(rel, relationModel, allModels);
        const filter = { field: rel.targetKey, value: currentRecordId };
        const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
        const query = `${relationResource}?${filter.field}=${filter.value}`;
        try {
          let children = [];
          if (polyInfo && rel.otherKey) {
            const { groups, labelsById } = await fetchPolymorphicGroups({
              apiUrl,
              rel,
              recordId: currentRecordId,
              referenceResource: polyInfo.referenceResource,
              allModels
            });
            children = Array.from(groups.entries()).map(([resourceName, idSet]) => {
              const targetModel = findModelByName(allModels, resourceName);
              const groupChildren = Array.from(idSet).map((id) => {
                const fallbackLabel = labelsById?.get(id) ?? id;
                const title = /* @__PURE__ */ jsx(RelatedObjectPreview, { resource: resourceName, id, model: targetModel, allModels, fallbackLabel });
                return { title, key: `${resourceName}-${id}`, resource: resourceName, id, isLeaf: true };
              });
              return {
                title: /* @__PURE__ */ jsxs(
                  "span",
                  {
                    style: {
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6
                    },
                    children: [
                      relationLabelNode,
                      /* @__PURE__ */ jsx("span", { style: { fontSize: 12, color: "#64748b" }, children: targetModel?.label || resourceName })
                    ]
                  }
                ),
                key: `${rel.relationName || rel.resource}-${resourceName}`,
                selectable: false,
                children: groupChildren
              };
            });
          } else {
            const response = await authenticatedFetch(`${apiUrl}/${query}`);
            let data = await response.json();
            if (!Array.isArray(data)) {
              return {
                rel,
                node: {
                  title: /* @__PURE__ */ jsxs("span", { style: { display: "inline-flex", alignItems: "center", gap: 8 }, children: [
                    relationLabelNode,
                    /* @__PURE__ */ jsx("span", { style: { color: "#b91c1c", fontSize: 12 }, children: _14("Error") })
                  ] }),
                  key: rel.relationName || rel.resource,
                  selectable: false,
                  children: []
                }
              };
            }
            if (rel.polymorphicType && rel.otherKey && data.length > 0) {
              const otherIds = data.map((item) => item[rel.otherKey]).filter((v) => v !== void 0 && v !== null);
              if (otherIds.length > 0) {
                const polyMatchingIds = await filterIdsByPolymorphicType(
                  apiUrl,
                  Array.from(new Set(otherIds)),
                  rel.polymorphicType
                );
                data = data.filter((item) => polyMatchingIds.has(item[rel.otherKey]));
              }
            }
            const relPkField = relationModel?.pkField || "eid";
            children = data.map((item) => {
              let targetId = item[relPkField] ?? item.eid ?? item.id;
              let targetResource = resolveResourcePath(rel.resource, allModels);
              let title = item._label || item.name || targetId;
              if (rel.otherResource && rel.otherKey && item[rel.otherKey]) {
                targetResource = resolveResourcePath(rel.otherResource, allModels);
                targetId = item[rel.otherKey];
              }
              const targetModel = findModelByName(allModels, targetResource);
              title = /* @__PURE__ */ jsx(RelatedObjectPreview, { resource: targetResource, id: targetId, model: targetModel, allModels, fallbackLabel: title });
              return { title, key: `${targetResource}-${targetId}`, resource: targetResource, id: targetId, isLeaf: true };
            });
          }
          return { rel, node: { title: relationLabelNode, key: rel.relationName || rel.resource, selectable: false, children } };
        } catch (error) {
          console.error(`Failed to fetch relation: ${rel.label}`, error);
          return {
            rel,
            node: {
              title: /* @__PURE__ */ jsxs("span", { style: { display: "inline-flex", alignItems: "center", gap: 8 }, children: [
                relationLabelNode,
                /* @__PURE__ */ jsx("span", { style: { color: "#b91c1c", fontSize: 12 }, children: _14("Error") })
              ] }),
              key: rel.relationName || rel.resource,
              selectable: false,
              children: []
            }
          };
        }
      });
      const results = await Promise.all(promises);
      const reverseNodes = [];
      const forwardNodes = [];
      results.filter(Boolean).forEach((entry) => {
        if (isReverse(entry.rel)) reverseNodes.push(entry.node);
        else forwardNodes.push(entry.node);
      });
      setReverseTreeData(reverseNodes);
      setForwardTreeData(forwardNodes);
      setLoading(false);
    };
    fetchRelations();
  }, [model, record, allModels, apiUrl, isActive]);
  const onSelect = (_selectedKeys, info) => {
    const { resource, id } = info.node;
    if (resource && id) {
      if (paneNav?.isInMultiPane) {
        paneNav.openDetail(resource, id);
      } else {
        go({ to: { resource, action: "show", id } });
      }
    }
  };
  if (loading) return /* @__PURE__ */ jsx(Spin, {});
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 16, alignItems: "flex-start" }, children: [
    /* @__PURE__ */ jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontWeight: 600, marginBottom: 8, color: "#1677ff" }, children: _14("Forward Relations") }),
      forwardTreeData.length > 0 ? /* @__PURE__ */ jsx(Card, { size: "small", variant: "outlined", style: { border: "1px solid #1677ff" }, children: /* @__PURE__ */ jsx(Tree, { showLine: true, switcherIcon: /* @__PURE__ */ jsx(DownOutlined, {}), defaultExpandAll: true, onSelect, treeData: forwardTreeData }) }) : /* @__PURE__ */ jsx("div", { style: { color: "#888", fontSize: 13, padding: "8px 0" }, children: _14("None") })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontWeight: 600, marginBottom: 8, color: "#1677ff" }, children: _14("Reverse Relations") }),
      reverseTreeData.length > 0 ? /* @__PURE__ */ jsx(Card, { size: "small", variant: "outlined", style: { border: "1px solid #1677ff" }, children: /* @__PURE__ */ jsx(Tree, { showLine: true, switcherIcon: /* @__PURE__ */ jsx(DownOutlined, {}), defaultExpandAll: true, onSelect, treeData: reverseTreeData }) }) : /* @__PURE__ */ jsx("div", { style: { color: "#888", fontSize: 13, padding: "8px 0" }, children: _14("None") })
    ] })
  ] });
};

// src/providers/constants.ts
var API_URL3 = "/api";

// src/pages/dashboard/hooks/usePinRecord.ts
function usePinRecord(resource, recordId) {
  const [pinned, setPinned] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!resource || recordId === void 0 || recordId === null || recordId === "") return;
    let cancelled = false;
    authenticatedFetch(
      `${API_URL3}/dashboard/pinned-records/check?resource=${encodeURIComponent(resource)}&record_id=${encodeURIComponent(String(recordId))}`
    ).then((r) => r.json()).then((d) => {
      if (!cancelled) setPinned(Boolean(d.pinned));
    }).catch(() => {
      if (!cancelled) setPinned(false);
    });
    return () => {
      cancelled = true;
    };
  }, [resource, recordId]);
  const pin = useCallback(async () => {
    if (!resource || recordId === void 0) return;
    setLoading(true);
    try {
      await authenticatedFetch(`${API_URL3}/dashboard/pinned-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource, record_id: String(recordId) })
      });
      setPinned(true);
    } finally {
      setLoading(false);
    }
  }, [resource, recordId]);
  const unpin = useCallback(async () => {
    if (!resource || recordId === void 0) return;
    setLoading(true);
    try {
      await authenticatedFetch(
        `${API_URL3}/dashboard/pinned-records/${encodeURIComponent(resource)}/${encodeURIComponent(String(recordId))}`,
        { method: "DELETE" }
      );
      setPinned(false);
    } finally {
      setLoading(false);
    }
  }, [resource, recordId]);
  const toggle = useCallback(() => pinned ? unpin() : pin(), [pinned, pin, unpin]);
  return { pinned, loading, pin, unpin, toggle };
}
async function unpinRecords(resource, recordIds) {
  await Promise.all(
    recordIds.map(
      (id) => authenticatedFetch(
        `${API_URL3}/dashboard/pinned-records/${encodeURIComponent(resource)}/${encodeURIComponent(String(id))}`,
        { method: "DELETE" }
      )
    )
  );
}
var _15 = window._ || ((text) => text);
var useShowActionsPreferences = (model, allModels, record, saveButtonProps) => {
  const apiUrl = useApiUrl();
  const allModelsList = useMemo(() => allModels || [], [allModels]);
  const [showRelationActions, setShowRelationActions] = useState(DEFAULT_SHOW_RELATION_ROW_ACTIONS);
  const [showRelationCreate, setShowRelationCreate] = useState(DEFAULT_RELATION_CREATE_ACTIONS);
  const [isSavingActionsPrefs, setIsSavingActionsPrefs] = useState(false);
  const actionsPrefsTouchedRef = useRef(false);
  const actionsPrefsLoadedRef = useRef(false);
  const actionsPrefsResourceRef = useRef(null);
  const markActionsPrefsTouched = useCallback(() => {
    actionsPrefsTouchedRef.current = true;
  }, []);
  const saveActionsPreferences = useCallback(async () => {
    const resourceKey = resolveResourcePath(model.resource || model.name, allModelsList);
    const preferences = {
      showActions: showRelationActions,
      showCreate: showRelationCreate
    };
    setIsSavingActionsPrefs(true);
    try {
      const response = await authenticatedFetch(`${apiUrl}/views/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: resourceKey, preferenceType: "ShowActions", preferences })
      });
      if (!response.ok) {
        throw new Error(`Save failed (${response.status})`);
      }
      message.success("Show actions preferences saved.");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to save show actions preferences.");
    } finally {
      setIsSavingActionsPrefs(false);
    }
  }, [apiUrl, allModelsList, model.name, model.resource, showRelationActions, showRelationCreate]);
  useEffect(() => {
    const resourceKey = resolveResourcePath(model.resource || model.name, allModelsList);
    if (actionsPrefsResourceRef.current !== resourceKey) {
      actionsPrefsLoadedRef.current = false;
      actionsPrefsResourceRef.current = resourceKey;
    }
    if (actionsPrefsLoadedRef.current) return;
    let cancelled = false;
    const loadPreferences = async () => {
      try {
        const response = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=ShowActions`);
        if (!response.ok) {
          throw new Error(`Load failed (${response.status})`);
        }
        const data = await response.json();
        if (cancelled || actionsPrefsTouchedRef.current) return;
        const prefs = data?.preferences;
        if (!prefs || typeof prefs !== "object") return;
        if ("showActions" in prefs) setShowRelationActions(Boolean(prefs.showActions));
        if ("showCreate" in prefs) setShowRelationCreate(Boolean(prefs.showCreate));
        actionsPrefsLoadedRef.current = true;
      } catch {
      }
    };
    loadPreferences();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, allModelsList, model.name, model.resource]);
  const actionsSettingsContent = /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 8, minWidth: 200 }, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }, children: [
      /* @__PURE__ */ jsx("span", { children: _15("Relation's row actions buttons") }),
      /* @__PURE__ */ jsx(
        Switch,
        {
          checked: showRelationActions,
          onChange: (checked) => {
            markActionsPrefsTouched();
            setShowRelationActions(checked);
          },
          size: "small"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }, children: [
      /* @__PURE__ */ jsx("span", { children: _15("Relation's create action button") }),
      /* @__PURE__ */ jsx(
        Switch,
        {
          checked: showRelationCreate,
          onChange: (checked) => {
            markActionsPrefsTouched();
            setShowRelationCreate(checked);
          },
          size: "small"
        }
      )
    ] }),
    /* @__PURE__ */ jsx(Divider, { style: { margin: "4px 0" } }),
    /* @__PURE__ */ jsx(
      Button,
      {
        size: "small",
        icon: /* @__PURE__ */ jsx(SaveOutlined, {}),
        onClick: saveActionsPreferences,
        loading: isSavingActionsPrefs,
        block: true,
        children: _15("Save")
      }
    )
  ] });
  const { id: urlId } = useParams();
  const effectiveRecord = record ?? (urlId ? { eid: Number(urlId) } : void 0);
  const recordId = effectiveRecord?.eid ?? effectiveRecord?.id ?? urlId;
  const resource = model.resource || model.name;
  const { pinned, loading: pinLoading, toggle: togglePin } = usePinRecord(resource, recordId);
  const { metadataButton, metadataModal } = useMetadataModal(model, allModels);
  const [exploreOpen, setExploreOpen] = useState(false);
  const headerButtons = ({ defaultButtons }) => /* @__PURE__ */ jsxs(Fragment, { children: [
    metadataButton,
    metadataModal,
    /* @__PURE__ */ jsx(Popover, { content: actionsSettingsContent, title: _15("Actions"), trigger: "hover", children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(SettingOutlined, {}) }) }),
    /* @__PURE__ */ jsx("span", { style: { marginInlineStart: 10 } }),
    pinned !== null && /* @__PURE__ */ jsx(Tooltip, { title: pinned ? _15("Unpin") : _15("Pin to dashboard"), children: /* @__PURE__ */ jsx(
      Button,
      {
        size: "small",
        icon: pinned ? /* @__PURE__ */ jsx(PushpinFilled, { style: { color: "#faad14" } }) : /* @__PURE__ */ jsx(PushpinOutlined, {}),
        onClick: togglePin,
        loading: pinLoading
      }
    ) }),
    /* @__PURE__ */ jsx(Tooltip, { title: _15("Explore"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(ApartmentOutlined, {}), onClick: () => setExploreOpen(true) }) }),
    /* @__PURE__ */ jsx(
      Modal,
      {
        open: exploreOpen,
        onCancel: () => setExploreOpen(false),
        footer: null,
        title: _15("Explore"),
        width: "90vw",
        styles: { body: { height: "80vh", overflowY: "auto" } },
        destroyOnClose: true,
        children: exploreOpen && effectiveRecord && /* @__PURE__ */ jsx(RelationsExplorer, { model, record: effectiveRecord, allModels: allModels || [], isActive: true })
      }
    ),
    renderIconOnlyButtons(defaultButtons),
    saveButtonProps && /* @__PURE__ */ jsx(Tooltip, { title: _15("Save"), children: /* @__PURE__ */ jsx(Button, { ...saveButtonProps, type: "primary", icon: /* @__PURE__ */ jsx(SaveFilled, {}), hideText: true }) })
  ] });
  return {
    actionsState: { showActions: showRelationActions, showCreate: showRelationCreate },
    headerButtons
  };
};
var PrimaryShowContext = React6.createContext(null);
var ToneSharedStyles = () => /* @__PURE__ */ jsx("style", { children: `
            .jm-tone-scope .ant-form-item .ant-form-item-label > label {
                color: #475569 !important;
                font-weight: 400;
            }
            .jm-tone-scope .ant-table-thead > tr > th {
                color: var(--jm-table-header-text, #475569) !important;
            }
            .jm-tone-scope .ant-table-column-title {
                color: var(--jm-table-header-text, #475569) !important;
                font-weight: 400;
            }
            .jm-tone-scope .ant-table-thead > tr > th .ant-table-filter-column,
            .jm-tone-scope .ant-table-thead > tr > th .ant-table-column-sorters {
                color: var(--jm-table-header-text, #475569) !important;
            }
            .jm-tone-scope .ant-table-thead > tr > th .ant-table-filter-trigger,
            .jm-tone-scope .ant-table-thead > tr > th .ant-table-column-sorter,
            .jm-tone-scope .ant-table-thead > tr > th .ant-dropdown-trigger {
                color: var(--jm-table-header-accent, #64748b) !important;
            }
            .jm-tone-scope .ant-table-thead > tr > th.ant-table-column-sort,
            .jm-tone-scope .ant-table-thead > tr > th.ant-table-cell-fix-left,
            .jm-tone-scope .ant-table-thead > tr > th.ant-table-cell-fix-right {
                background: inherit !important;
            }
            .jm-tone-scope .ant-table-filter-dropdown {
                min-width: 420px !important;
                padding: 8px !important;
            }
            .jm-tone-scope .ant-table-filter-dropdown .ant-dropdown-menu-item,
            .jm-tone-scope .ant-table-filter-dropdown .ant-dropdown-menu-submenu-title,
            .jm-tone-scope .ant-table-filter-dropdown .ant-checkbox-wrapper,
            .jm-tone-scope .ant-table-filter-dropdown .ant-tree-title {
                font-size: 24px !important;
                line-height: 1.2 !important;
                font-weight: 400 !important;
                padding-top: 8px !important;
                padding-bottom: 8px !important;
            }
            .jm-tone-scope .ant-table-filter-dropdown .ant-checkbox {
                transform: none;
                margin-inline-end: 12px !important;
            }
            .jm-tone-scope .ant-table-filter-dropdown .ant-input {
                height: 44px !important;
                font-size: 18px !important;
            }
            .jm-tone-tab-label {
                position: relative;
                transition: transform 0.18s ease, background-color 0.18s ease;
            }
            .jm-tone-tab-label::after {
                content: "";
                position: absolute;
                left: 8px;
                right: 8px;
                bottom: -3px;
                height: 3px;
                border-radius: 2px;
                background: var(--tone-tab-underline, #94a3b8);
                transform: scaleX(0.15);
                opacity: 0;
                transition: transform 0.2s ease, opacity 0.2s ease;
            }
            .jm-tone-tab-label:hover::after {
                transform: scaleX(1);
                opacity: 1;
            }
        ` });
var toneScopeStyle = (tone) => ({
  ["--jm-table-header-text"]: tone.text,
  ["--jm-table-header-accent"]: tone.solid
});
var renderToneTabLabel = (label, tone) => /* @__PURE__ */ jsx(
  "span",
  {
    className: "jm-tone-tab-label",
    style: {
      ["--tone-tab-underline"]: tone.solid,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "2px 8px",
      borderRadius: 6,
      background: "transparent",
      color: tone.text,
      fontWeight: 600
    },
    children: label
  }
);
var isDarkColor2 = (color) => {
  if (!color) return false;
  const value = color.trim();
  if (value.startsWith("#")) {
    let hex = value.slice(1);
    if (hex.length === 3) {
      hex = hex.split("").map((c) => c + c).join("");
    }
    if (hex.length !== 6) return false;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance < 0.5;
  }
  if (value.startsWith("rgb")) {
    const parts = value.replace(/rgba?\(|\)/g, "").split(",").map((v) => Number(v.trim()));
    if (parts.length < 3 || parts.some((v) => Number.isNaN(v))) return false;
    const [r, g, b] = parts;
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance < 0.5;
  }
  return false;
};
var VALUE_TAG_COLORS = [
  "blue",
  "geekblue",
  "cyan",
  "green",
  "gold",
  "orange",
  "volcano",
  "magenta",
  "purple",
  "lime"
];
var fieldValueColorCache = /* @__PURE__ */ new WeakMap();
var getFieldValueColors = (field) => {
  if (field.valueColors && Object.keys(field.valueColors).length > 0) return field.valueColors;
  if (!field.options || field.options.length === 0) return {};
  const cached = fieldValueColorCache.get(field);
  if (cached) return cached;
  const map = {};
  field.options.forEach((option, index) => {
    map[String(option.value)] = VALUE_TAG_COLORS[index % VALUE_TAG_COLORS.length];
  });
  fieldValueColorCache.set(field, map);
  return map;
};
var getFallbackColor = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = hash * 31 + value.charCodeAt(i) | 0;
  }
  return VALUE_TAG_COLORS[Math.abs(hash) % VALUE_TAG_COLORS.length];
};
var renderOptionTag = (field, rawValue) => {
  if (rawValue === null || rawValue === void 0) return "-";
  const option = field.options?.find((entry) => entry.value === rawValue);
  const label = option?.label ?? String(rawValue);
  const colorMap = getFieldValueColors(field);
  const color = colorMap[String(rawValue)] || getFallbackColor(label);
  return /* @__PURE__ */ jsx(Tag, { color, style: { marginInlineEnd: 0, borderRadius: 8, fontWeight: 500 }, children: label });
};
var _16 = window._ || ((text) => text);
var CALENDAR_WEEKDAYS = [_16("Sun"), _16("Mon"), _16("Tue"), _16("Wed"), _16("Thu"), _16("Fri"), _16("Sat")];
var CALENDAR_DATE_FOOTER_FIELDS = /* @__PURE__ */ new Set(["creation_date", "modification_date"]);
var isCalendarDateField = (field) => {
  const rawType = String(field?.type || "").trim().toLowerCase();
  return rawType === "date" || rawType === "datetime";
};
var getCalendarDateFieldOptions = (fields) => {
  const dateFields = fields.filter(isCalendarDateField);
  if (dateFields.length === 0) return [];
  const regularFields = [];
  const footerFields = [];
  dateFields.forEach((field) => {
    const key = String(field.key || "").trim().toLowerCase();
    if (CALENDAR_DATE_FOOTER_FIELDS.has(key)) {
      footerFields.push(field);
      return;
    }
    regularFields.push(field);
  });
  footerFields.sort((a, b) => {
    const order = (key) => key === "creation_date" ? 1 : key === "modification_date" ? 2 : 3;
    return order(String(a.key || "").trim().toLowerCase()) - order(String(b.key || "").trim().toLowerCase());
  });
  return [...regularFields, ...footerFields];
};
var getCalendarRecordDate = (record, fieldKey) => {
  const rawValue = record?.[fieldKey];
  if (rawValue === void 0 || rawValue === null || rawValue === "") return null;
  const parsed = dayjs7(rawValue);
  if (!parsed.isValid()) return null;
  return parsed.startOf("day");
};

// src/components/DynamicResource/utils/navigation.ts
var getShowHref = (resource, id, allModels) => {
  const resourcePath = resolveResourcePath(resource, allModels);
  return `/${resourcePath}/show/${id}`;
};
var shouldHandleLinkClick = (event) => {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  return true;
};
var USER_KEY = "jm_user";
function getCurrentUserRoles() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return [];
    return JSON.parse(raw)?.roles ?? [];
  } catch {
    return [];
  }
}
function filterFieldsByRole(fields, userRoles) {
  return fields.filter((f) => {
    if (!f.readRoles || f.readRoles.length === 0) return true;
    return f.readRoles.some((r) => userRoles.includes(r));
  });
}
function useRoleFilteredModel(model) {
  const userRoles = useMemo(() => getCurrentUserRoles(), []);
  return useMemo(() => {
    const filtered = filterFieldsByRole(model.fields, userRoles);
    if (filtered.length === model.fields.length) return model;
    return { ...model, fields: filtered };
  }, [model, userRoles]);
}
var _17 = window._ || ((text) => text);
var DynamicShow = ({ model: modelProp, allModels, idOverride, embedded }) => {
  const model = useRoleFilteredModel(modelProp);
  applyI18nLabelsToModel(model);
  applyI18nLabelsToModels(allModels);
  const allModelsList = useMemo(() => allModels || [], [allModels]);
  const modelTone = useModelTone(model);
  const modelDisplayLabel = asDisplayText(model.label, asDisplayText(model.name, "Record"));
  const { id: routeId } = useParams();
  const id = idOverride ?? routeId;
  const { formProps, saveButtonProps, record, recordId } = useShowEditableForm(model.resource || model.name, id);
  const { formProps: showFormProps, effectiveFields } = buildShowTabFormOptions(formProps, model, allModels);
  const pageTitle = record?._label ? asDisplayText(record._label, `${_17("Show")} ${modelDisplayLabel}`) : `${_17("Show")} ${modelDisplayLabel}`;
  const { actionsState, headerButtons } = useShowActionsPreferences(model, allModels, record, saveButtonProps);
  const [activeTabKey, setActiveTabKey] = useState("details");
  const items = useStandardShowTabs(
    model,
    record,
    allModelsList,
    actionsState,
    { formProps: showFormProps, effectiveFields }
  );
  useEffect(() => {
    if (!items.find((item) => item.key === activeTabKey)) {
      setActiveTabKey(items[0]?.key || "details");
    }
  }, [activeTabKey, items]);
  const lazyItems = useMemo(
    () => items.map((item) => ({
      ...item,
      children: item.key === activeTabKey ? item.children : null
    })),
    [activeTabKey, items]
  );
  if (embedded) {
    return /* @__PURE__ */ jsxs("div", { className: "jm-tone-scope", style: toneScopeStyle(modelTone), children: [
      /* @__PURE__ */ jsx(ToneSharedStyles, {}),
      !record ? /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "center", padding: 32 }, children: /* @__PURE__ */ jsx(Spin, {}) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(Tabs, { activeKey: activeTabKey, onChange: setActiveTabKey, items: lazyItems, destroyInactiveTabPane: true }),
        /* @__PURE__ */ jsx(
          ShowFooterButtons,
          {
            model,
            allModels,
            recordId,
            saveButtonProps
          }
        )
      ] })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "jm-tone-scope", style: toneScopeStyle(modelTone), children: [
    /* @__PURE__ */ jsx(ToneSharedStyles, {}),
    /* @__PURE__ */ jsxs(
      StandardShow,
      {
        isLoading: !record,
        title: renderWrappedPageTitle(renderModelHeading({
          model,
          title: pageTitle,
          actionLabel: _17("Show"),
          moduleLabel: model.module ? getModuleLabel(model.module) : void 0
        })),
        headerButtons,
        children: [
          /* @__PURE__ */ jsx(Tabs, { activeKey: activeTabKey, onChange: setActiveTabKey, items: lazyItems, destroyInactiveTabPane: true }),
          /* @__PURE__ */ jsx(
            ShowFooterButtons,
            {
              model,
              allModels,
              recordId,
              saveButtonProps
            }
          )
        ]
      }
    )
  ] });
};
var _18 = window._ || ((text) => text);
var RELATION_SELECT_DEFAULT_PAGE_SIZE = 2e3;
var RelationSelect = ({ field, value, onChange, allModels, multiple, serverSearch, excludeId }) => {
  const optionLabel = "_label";
  const resourceName = field.referencePath || field.reference;
  const resolvedResource = resourceName && allModels ? resolveResourcePath(resourceName, allModels) : resourceName;
  const referencedModel = resourceName ? findModelByName(allModels, resourceName) : void 0;
  const resolvedOptionValue = field.optionValue || referencedModel?.pkField || "eid";
  const [loadAll, setLoadAll] = React6.useState(false);
  const pageSize = loadAll ? 999999 : RELATION_SELECT_DEFAULT_PAGE_SIZE;
  const { selectProps, queryResult } = useSelect({
    resource: resolvedResource,
    optionLabel,
    optionValue: resolvedOptionValue,
    defaultValue: value,
    filters: [],
    queryOptions: { enabled: true },
    debounce: 500,
    pagination: { current: 1, pageSize, mode: "server" }
  });
  const filteredOptions = excludeId !== void 0 && excludeId !== null ? (selectProps.options ?? []).filter((opt) => String(opt.value) !== String(excludeId)) : selectProps.options;
  const serverTotal = queryResult?.data?.total ?? 0;
  const loadedCount = filteredOptions?.length ?? 0;
  const isCapped = !loadAll && serverTotal > loadedCount && loadedCount > 0;
  const normalizeSearch = (val) => String(val ?? "").toLowerCase();
  const selectedSet = React6.useMemo(() => new Set(Array.isArray(value) ? value : value !== void 0 && value !== null ? [value] : []), [value]);
  const [searchValue, setSearchValue] = React6.useState("");
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx(
      Select,
      {
        ...selectProps,
        options: filteredOptions,
        value,
        onChange,
        mode: multiple ? "multiple" : void 0,
        onSearch: multiple ? (val) => setSearchValue(val) : serverSearch ? selectProps.onSearch : () => {
        },
        searchValue: multiple ? searchValue : void 0,
        style: { width: "100%" },
        placeholder: `Select ${field.label}...`,
        allowClear: true,
        showSearch: true,
        optionFilterProp: "label",
        filterOption: serverSearch ? false : (input, option) => normalizeSearch(option?.label).includes(normalizeSearch(input)),
        ...multiple ? {
          menuItemSelectedIcon: null,
          optionRender: (option) => /* @__PURE__ */ jsxs("span", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
            /* @__PURE__ */ jsx(Checkbox, { checked: selectedSet.has(option.value), style: { pointerEvents: "none" } }),
            /* @__PURE__ */ jsx("span", { children: option.label })
          ] })
        } : {}
      }
    ),
    isCapped && /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 }, children: [
      /* @__PURE__ */ jsx(Typography.Text, { type: "secondary", style: { fontSize: 11 }, children: _18("Showing N of T \u2014 type to search").replace("N", formatNumberValue(loadedCount)).replace("T", formatNumberValue(serverTotal)) }),
      /* @__PURE__ */ jsx(
        Button,
        {
          size: "small",
          type: "link",
          style: { fontSize: 11, padding: 0 },
          loading: queryResult?.isLoading || queryResult?.isFetching,
          onClick: () => setLoadAll(true),
          children: _18("Load all")
        }
      )
    ] })
  ] });
};
var _19 = window._ || ((text) => text);
var FileUploadInput = ({ value: _value, onChange: _onChange }) => {
  const form = Form.useFormInstance();
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState(null);
  const currentDataName = Form.useWatch("data_name", form);
  const handleUpload = async (file) => {
    const recordId = form.getFieldValue("eid") ?? form.getFieldValue("id");
    if (!recordId) {
      message.error(_19("Save the record first before uploading a file."));
      return false;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await authenticatedFetch(`/api/file/${recordId}/upload`, {
        method: "POST",
        body: formData
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Upload failed (${response.status})`);
      }
      const result = await response.json();
      form.setFieldsValue({
        data: void 0,
        data_format: result.data_format,
        data_encoding: result.data_encoding,
        data_name: result.data_name,
        data_hash: result.data_hash
      });
      setFileName(result.data_name || file.name);
      message.success(_19("File uploaded successfully."));
    } catch (err) {
      message.error(err?.message || _19("File upload failed."));
    } finally {
      setUploading(false);
    }
    return false;
  };
  const displayName = fileName || currentDataName;
  return /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsxs(
    Upload.Dragger,
    {
      beforeUpload: handleUpload,
      showUploadList: false,
      multiple: false,
      disabled: uploading,
      style: { padding: "8px 16px" },
      children: [
        /* @__PURE__ */ jsx("p", { style: { marginBottom: 4 }, children: uploading ? /* @__PURE__ */ jsx(Spin, { size: "small" }) : /* @__PURE__ */ jsx(UploadOutlined, { style: { fontSize: 24, color: "#1677ff" } }) }),
        /* @__PURE__ */ jsx("p", { style: { fontSize: 13, margin: 0 }, children: uploading ? _19("Uploading...") : _19("Click or drag a file here to upload") }),
        displayName && !uploading && /* @__PURE__ */ jsxs("p", { style: { fontSize: 11, color: "#888", margin: "4px 0 0" }, children: [
          _19("Current"),
          ": ",
          displayName
        ] })
      ]
    }
  ) });
};
var _20 = window._ || ((text) => text);
var AsyncSelectInput = ({
  optionsUrl,
  placeholder,
  value,
  onChange
}) => {
  const apiUrl = useApiUrl();
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const fetchOptions = async () => {
      try {
        const url = optionsUrl.startsWith("http") ? optionsUrl : `${apiUrl}${optionsUrl}`;
        const response = await authenticatedFetch(url);
        if (!response.ok || cancelled) {
          if (!cancelled) setLoading(false);
          return;
        }
        const data = await response.json();
        if (cancelled) return;
        let rawChoices = [];
        if (Array.isArray(data)) {
          rawChoices = data;
        } else if (Array.isArray(data?.choices)) {
          rawChoices = data.choices;
        } else if (Array.isArray(data?.options)) {
          rawChoices = data.options;
        }
        const mapped = rawChoices.map((item) => {
          if (typeof item === "string") {
            return { label: item, value: item };
          }
          if (item && typeof item === "object" && "label" in item && "value" in item) {
            return { label: String(item.label), value: item.value };
          }
          return { label: String(item), value: item };
        });
        setOptions(mapped);
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchOptions();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, optionsUrl]);
  return /* @__PURE__ */ jsx(
    Select,
    {
      showSearch: true,
      allowClear: true,
      loading,
      options,
      value,
      onChange,
      placeholder: placeholder || _20("Select..."),
      style: { width: "100%" },
      filterOption: (input, option) => String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
    }
  );
};
var _21 = window._ || ((text) => text);
var renderInput = (field, allModels, model, currentId) => {
  const resolvedField = model && allModels ? applyRelationFieldOverrides(model, allModels).find((item) => item.key === field.key) || field : field;
  if (resolvedField.key === "data" && isFileModel(model)) {
    return /* @__PURE__ */ jsx(FileUploadInput, {});
  }
  const isNlSentenceField = resolvedField.key === "nl_sentence" || resolvedField.key === "nl_asks_sentence";
  const sentenceFieldHelper = _21(resolvedField.key);
  if (isNlSentenceField) {
    return /* @__PURE__ */ jsx(
      Input.TextArea,
      {
        autoSize: { minRows: 3, maxRows: 18 },
        style: { resize: "vertical", background: "#f3f6f9" },
        placeholder: sentenceFieldHelper
      }
    );
  }
  if (resolvedField.readOnly) {
    return /* @__PURE__ */ jsx(Input, { disabled: true });
  }
  if (resolvedField.reference && hasReferenceModel(resolvedField.reference, allModels)) {
    const refResource = resolveResourcePath(resolvedField.reference, allModels);
    const modelResource = model ? resolveResourcePath(model.resource || model.name, allModels) : void 0;
    const isSelfRef = refResource && modelResource && refResource === modelResource;
    return /* @__PURE__ */ jsx(RelationSelect, { field: resolvedField, allModels, excludeId: isSelfRef ? currentId : void 0 });
  }
  if (resolvedField.optionsUrl) return /* @__PURE__ */ jsx(AsyncSelectInput, { optionsUrl: resolvedField.optionsUrl, placeholder: `${_21("Select")} ${_21(resolvedField.label)}...` });
  if (resolvedField.options) return /* @__PURE__ */ jsx(Select, { options: resolvedField.options, style: { width: "100%" }, placeholder: `Select ${resolvedField.label}...`, allowClear: true });
  switch (resolvedField.type) {
    case "boolean":
      return /* @__PURE__ */ jsx(Checkbox, {});
    case "date":
      return /* @__PURE__ */ jsx(DatePicker, { style: { width: "100%" }, placeholder: _21("Select date") });
    case "datetime":
      return /* @__PURE__ */ jsx(DatePicker, { showTime: true, style: { width: "100%" }, placeholder: _21("Select date and time") });
    case "time":
      return /* @__PURE__ */ jsx(TimePicker, { style: { width: "100%" } });
    case "number":
      return /* @__PURE__ */ jsx(InputNumber, { style: { width: "100%" } });
    default:
      return /* @__PURE__ */ jsx(Input, {});
  }
};
var _22 = window._ || ((text) => text);
var renderFieldValue = (field, record, allModels) => {
  const isNlSentenceField = field.key === "nl_sentence" || field.key === "nl_asks_sentence";
  if (isNlSentenceField) {
    const value = record?.[field.key];
    return /* @__PURE__ */ jsx(
      Input.TextArea,
      {
        value: value === null || value === void 0 ? "" : String(value),
        autoSize: { minRows: 3, maxRows: 18 },
        style: { resize: "vertical", background: "#f3f6f9" },
        placeholder: _22(field.key),
        readOnly: true
      }
    );
  }
  if (field.type === "boolean") {
    return record?.[field.key] ? /* @__PURE__ */ jsx(CheckCircleOutlined, { style: { color: "green", fontSize: "1.2em" } }) : /* @__PURE__ */ jsx(CloseCircleOutlined, { style: { color: "red", fontSize: "1.2em" } });
  }
  if (field.reference && record?.[field.key] && hasReferenceModel(field.reference, allModels)) {
    return /* @__PURE__ */ jsx(ReferenceField, { id: record[field.key], resource: resolveResourcePath(field.referencePath || field.reference, allModels) });
  }
  if (field.type === "number") {
    return formatNumberValue(record?.[field.key]) ?? "-";
  }
  if (field.type === "date") {
    return formatDateValue(record?.[field.key]) ?? "-";
  }
  if (field.type === "datetime") {
    return formatDateTimeValue(record?.[field.key]) ?? "-";
  }
  if (field.type === "time") {
    return formatTimeValue(record?.[field.key]);
  }
  if (field.options && record?.[field.key] !== void 0 && record?.[field.key] !== null) {
    return renderOptionTag(field, record[field.key]);
  }
  return record?.[field.key] ?? "-";
};
var _23 = window._ || ((text) => text);
var { Title: Title2 } = Typography;
var DynamicCreate = ({ model: modelProp, allModels, journeyCallbacks, injectedValues }) => {
  const model = useRoleFilteredModel(modelProp);
  applyI18nLabelsToModel(model);
  applyI18nLabelsToModels(allModels);
  const navigate = useNavigate();
  const go = useGo();
  const [searchParams] = useSearchParams();
  const apiUrl = useApiUrl();
  const { token } = theme.useToken();
  const modelTone = useModelTone(model);
  const { settings: viewSettings, loading: viewSettingsLoading } = useViewSettings();
  const allModelsList = useMemo(() => allModels || [], [allModels]);
  const { rows: editConfigRows, loading: editConfigLoading } = useViewConfigurations(model.name, "AutomaticEntityForm");
  const { rows: fallbackConfigRows, loading: fallbackConfigLoading } = useViewConfigurations(model.name, "PrimaryView");
  const valueBackground = isDarkColor2(token.colorBgBase || token.colorBgContainer) ? token.colorFillQuaternary : "#F9FFFF";
  const labelBackground = isDarkColor2(token.colorBgBase || token.colorBgContainer) ? "transparent" : "#ffffff";
  const formResource = resolveResourcePath(model.resource || model.name, allModelsList);
  const disableRedirect = searchParams.get("inline") === "1" || searchParams.get("redirect") === "false" || searchParams.get("redirect") === "0";
  const requestedReturnTo = searchParams.get("returnTo");
  const returnTo = requestedReturnTo && requestedReturnTo.startsWith("/") ? requestedReturnTo : null;
  const relateResource = searchParams.get("relate_resource");
  const relateTargetKey = searchParams.get("relate_target_key");
  const relateOtherKey = searchParams.get("relate_other_key");
  const relateTargetId = searchParams.get("relate_target_id");
  const canAutoRelate = Boolean(relateResource && relateTargetKey && relateOtherKey && relateTargetId);
  const [createdRecord, setCreatedRecord] = useState(null);
  const [showRelationActions, setShowRelationActions] = useState(DEFAULT_EDIT_RELATION_ROW_ACTIONS);
  const [showRelationCreate, setShowRelationCreate] = useState(DEFAULT_RELATION_CREATE_ACTIONS);
  const [activeTabKey, setActiveTabKey] = useState("main_data");
  const isPostCreate = createdRecord !== null;
  const relationViewTypeDefaults = useMemo(
    () => ({
      show: normalizeRelationViewType(viewSettings?.showViewType || "") || "totals-details",
      edit: normalizeRelationViewType(viewSettings?.editViewType || "") || "editable-table"
    }),
    [viewSettings?.showViewType, viewSettings?.editViewType]
  );
  const modelDisplayLabel = asDisplayText(model.label, asDisplayText(model.name, "Record"));
  const isLinkModel = useMemo(() => {
    const fieldKeys = model.fields.map((f) => f.key);
    return fieldKeys.includes("eid_from") && fieldKeys.includes("eid_to") && searchParams.has("eid_from");
  }, [model.fields, searchParams]);
  const [serverDefaults, setServerDefaults] = useState({});
  const { formProps, saveButtonProps } = useForm({
    resource: formResource,
    redirect: false,
    onMutationSuccess: async (response) => {
      const freshRecord = response?.data?.data || response?.data || response;
      const createdId = getRecordId(freshRecord, model.fields);
      if (journeyCallbacks?.onSave) {
        journeyCallbacks.onSave(freshRecord);
        return;
      }
      if (canAutoRelate && relateResource && relateTargetKey && relateOtherKey && relateTargetId) {
        try {
          if (createdId === void 0 || createdId === null) {
            throw new Error(_23("Could not resolve the new record id to create the relation."));
          }
          const relationPayload = {
            [relateTargetKey]: relateTargetId,
            [relateOtherKey]: createdId
          };
          const relationResponse = await authenticatedFetch(`${apiUrl}/${relateResource}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(relationPayload)
          });
          if (!relationResponse.ok) {
            throw new Error(`Failed to create relation (${relationResponse.status})`);
          }
        } catch (error) {
          message.error(error instanceof Error ? error.message : _23("Failed to create relation."));
        }
      }
      const hasModelRelations = (model.relations || []).length > 0;
      if (hasModelRelations && allModels) {
        setCreatedRecord(freshRecord);
      } else {
        if (returnTo) {
          navigate(returnTo);
        } else if (!disableRedirect && createdId != null) {
          navigate(`/${formResource}/show/${createdId}`);
        }
      }
    },
    successNotification: () => ({
      message: _23("Changes saved."),
      description: modelDisplayLabel,
      type: "success"
    })
  });
  useKeyboardShortcuts(useMemo(() => [
    { key: "s", ctrl: true, handler: () => {
      if (!isPostCreate) formProps?.form?.submit();
    } },
    { key: "Escape", handler: () => journeyCallbacks?.onCancel ? journeyCallbacks.onCancel() : navigate(-1) }
  ], [formProps?.form, navigate, isPostCreate, journeyCallbacks]));
  const effectiveFields = useMemo(() => applyRelationFieldOverrides(model, allModelsList), [model, allModelsList]);
  const fieldByKey = useMemo(
    () => new Map(effectiveFields.map((field) => [field.key, field])),
    [effectiveFields]
  );
  const parseBooleanValue = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const normalized = String(value ?? "").trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
    return value;
  };
  const normalizeFieldValue = useCallback((field, rawValue) => {
    if (rawValue === void 0 || rawValue === null || rawValue === "") return rawValue;
    if (field.type === "number") {
      const parsed = Number(rawValue);
      return Number.isNaN(parsed) ? rawValue : parsed;
    }
    if (field.type === "boolean") return parseBooleanValue(rawValue);
    return rawValue;
  }, []);
  useEffect(() => {
    let cancelled = false;
    const loadDefaults = async () => {
      try {
        const response = await authenticatedFetch(`${apiUrl}/_meta/defaults/${encodeURIComponent(formResource)}`);
        if (!response.ok) return;
        const payload = await response.json();
        if (cancelled) return;
        const rawDefaults = payload?.defaults && typeof payload.defaults === "object" ? payload.defaults : {};
        const normalizedDefaults = {};
        effectiveFields.forEach((field) => {
          if (!Object.prototype.hasOwnProperty.call(rawDefaults, field.key)) return;
          normalizedDefaults[field.key] = normalizeFieldValue(field, rawDefaults[field.key]);
        });
        setServerDefaults(normalizedDefaults);
      } catch {
      }
    };
    loadDefaults();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, effectiveFields, formResource, normalizeFieldValue]);
  const { initialValues, hiddenFields } = useMemo(() => {
    const defaults = {};
    const fromQuery = {};
    const hidden = [];
    effectiveFields.forEach((field) => {
      if (field.isPk) return;
      const defaultValue = field.defaultValue ?? field.default_value ?? field.default;
      if (defaultValue !== void 0) {
        defaults[field.key] = normalizeFieldValue(field, defaultValue);
      }
      const paramValue = searchParams.get(field.key);
      if (paramValue !== null) {
        fromQuery[field.key] = normalizeFieldValue(field, paramValue);
        hidden.push(field.key);
      }
    });
    return {
      hiddenFields: hidden,
      initialValues: {
        ...formProps?.initialValues || {},
        ...defaults,
        ...serverDefaults,
        ...injectedValues || {},
        ...fromQuery
      }
    };
  }, [effectiveFields, formProps, normalizeFieldValue, searchParams, serverDefaults, injectedValues]);
  const labelStyle = {
    fontSize: token.fontSize,
    fontWeight: 400,
    color: token.colorTextSecondary,
    margin: 0,
    lineHeight: 1
  };
  const configRows = filterConfigRowsForMode(
    editConfigRows.length > 0 ? editConfigRows : fallbackConfigRows,
    "edit"
  );
  const configLoading = editConfigLoading || fallbackConfigLoading || viewSettingsLoading;
  const hasConfig = configRows.length > 0;
  const configSections = groupConfigRowsBySection(configRows);
  const { embedded, tabbed } = useMemo(() => splitRelations(model.relations), [model.relations]);
  const allRelations = useMemo(() => [...embedded, ...tabbed], [embedded, tabbed]);
  const configuredRelationKeys = useMemo(() => buildConfiguredRelationKeys(configRows), [configRows]);
  const configuredResolvedRelationKeys = useMemo(() => buildConfiguredResolvedRelationKeys(model.relations, configRows), [model.relations, configRows]);
  const configuredRelationDisplayKeys = useMemo(() => buildConfiguredRelationDisplayKeys(model.relations, configRows), [model.relations, configRows]);
  const hasConfiguredDetailRelations = configuredResolvedRelationKeys.size > 0 || configuredRelationKeys.size > 0;
  useEffect(() => {
    const formInstance = formProps?.form;
    if (!formInstance) return;
    const untouchedDefaults = Object.fromEntries(
      Object.entries(initialValues).filter(([name]) => !formInstance.isFieldTouched(name))
    );
    if (Object.keys(untouchedDefaults).length === 0) return;
    formInstance.setFieldsValue(untouchedDefaults);
  }, [formProps, initialValues]);
  const handleDone = useCallback(() => {
    const createdId = getRecordId(createdRecord, model.fields);
    if (returnTo) {
      navigate(returnTo);
    } else if (createdId != null) {
      navigate(`/${formResource}/show/${createdId}`);
    } else {
      navigate(-1);
    }
  }, [createdRecord, returnTo, navigate, formResource]);
  const handleGoToEdit = useCallback(() => {
    const createdId = getRecordId(createdRecord, model.fields);
    if (createdId != null) {
      go({ to: { resource: model.resource || model.name, action: "edit", id: createdId } });
    }
  }, [createdRecord, model.name, model.resource, go]);
  const renderHeaderButtons = ({ defaultButtons }) => renderIconOnlyButtons(defaultButtons);
  const renderPostCreateHeaderButtons = (_unused) => /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(Tooltip, { title: _23("Edit record"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(EditOutlined, {}), onClick: handleGoToEdit }) }),
    /* @__PURE__ */ jsx(Button, { size: "small", type: "primary", icon: /* @__PURE__ */ jsx(CheckCircleOutlined, {}), onClick: handleDone, children: _23("Done") })
  ] });
  const addTabsForNonConfiguredRelations = viewSettings?.addTabsForNonConfiguredRelations !== false;
  const relationTabEntries = useMemo(() => {
    if (!allModels) return [];
    const groups = /* @__PURE__ */ new Map();
    allRelations.forEach((rel) => {
      if (!addTabsForNonConfiguredRelations && !isReverseRelation(rel)) return;
      const relationModel = findModelByName(allModels, rel.resource);
      if (!relationModel) return;
      const relatedModel = rel.otherResource ? findModelByName(allModels, rel.otherResource) : void 0;
      const fallbackTab = isReverseRelation(rel) ? DETAILS_TAB_NAME : rel.relationName || rel.label;
      const tabName = getRelationTabName(rel, "edit", fallbackTab ?? "");
      const resolvedTabName = tabName === DETAILS_TAB_NAME && !isReverseRelation(rel) ? rel.relationName || rel.label || rel.resource || DETAILS_TAB_NAME : tabName;
      if (hasConfiguredDetailRelations && isRelationConfiguredForDetails(rel, configuredResolvedRelationKeys, configuredRelationKeys, configuredRelationDisplayKeys)) return;
      if (resolvedTabName === DETAILS_TAB_NAME) return;
      if (!groups.has(resolvedTabName)) {
        const tone = getModelTone(relatedModel || relationModel || rel.resource);
        groups.set(resolvedTabName, { tone });
      }
    });
    return Array.from(groups.entries()).map(([tabName, { tone }]) => ({ tabName, tone }));
  }, [allModels, allRelations, addTabsForNonConfiguredRelations, hasConfiguredDetailRelations, configuredResolvedRelationKeys, configuredRelationKeys, configuredRelationDisplayKeys]);
  const hasRelationTabs = relationTabEntries.length > 0;
  const renderFormCell = (item, index) => {
    if (item.attribute_or_relation_type === "relation") {
      return /* @__PURE__ */ jsx("div", { style: { marginBottom: 4, padding: "4px 8px", color: token.colorTextTertiary, fontStyle: "italic", fontSize: token.fontSizeSM }, children: _23("Available after saving") }, `${item.name}-rel-ph-${index}`);
    }
    const key = item.object_name || item.name;
    const field = fieldByKey.get(key) || resolveFieldFromConfig(model, item);
    if (field.isPk) return null;
    if (field.formula) return null;
    const isHidden = hiddenFields.includes(field.key);
    const showLabel = item.show_label !== false;
    if (isHidden) {
      return /* @__PURE__ */ jsx(Form.Item, { name: field.key, hidden: true, rules: field.required ? [{ required: true }] : [], children: renderInput(field, allModels, model) }, `${field.key}-${index}`);
    }
    return /* @__PURE__ */ jsx("div", { style: { marginBottom: 4 }, children: /* @__PURE__ */ jsxs("div", { style: { display: "grid", gridTemplateColumns: showLabel ? "200px 1fr" : "1fr", alignItems: "start", columnGap: 6 }, children: [
      showLabel && /* @__PURE__ */ jsx("div", { style: { ...labelStyle, backgroundColor: labelBackground, padding: "2px 4px", borderRadius: 4 }, children: field.label }),
      /* @__PURE__ */ jsx("div", { style: { padding: "2px 4px", lineHeight: 1.15, background: valueBackground, borderRadius: 6, border: `1px solid ${token.colorBorder}`, maxWidth: "100%", overflowWrap: "anywhere", ...parseInlineStyle(item.html_format) }, children: /* @__PURE__ */ jsx(
        Form.Item,
        {
          name: field.key,
          rules: field.required ? [{ required: true }] : [],
          valuePropName: field.type === "boolean" ? "checked" : void 0,
          getValueProps: (val) => (field.type === "date" || field.type === "datetime") && val ? { value: dayjs7(val) } : field.type === "time" && val ? { value: dayjs7("1970-01-01T" + val) } : { value: val },
          style: { margin: 0 },
          children: renderInput(field, allModels, model)
        }
      ) })
    ] }) }, `${field.key}-${index}`);
  };
  const renderReadonlyCell = (item, index) => {
    if (item.attribute_or_relation_type === "relation") {
      if (!allModels) return null;
      const relation = resolveRelationFromConfig(model.relations, item);
      if (!relation) return null;
      const relationModel = findModelByName(allModels, relation.resource);
      if (!relationModel) return null;
      const relatedModel = relation.otherResource ? findModelByName(allModels, relation.otherResource) : void 0;
      const relationTone = getModelTone(relatedModel || relationModel || relation.resource);
      const relWithOverride = applyRelationViewOverride(relation, item, "edit");
      const showLabel2 = item.show_label !== false;
      const resolvedRelViewType = getRelationViewType(relWithOverride, "edit", relationViewTypeDefaults);
      const isListView = resolvedRelViewType === "list";
      const relationValueStyle = {
        padding: "2px 4px",
        lineHeight: 1.15,
        background: valueBackground,
        borderRadius: 6,
        overflowWrap: "anywhere",
        ...isListView ? { width: "100%" } : { maxWidth: "100%" },
        ...parseInlineStyle(item.html_format)
      };
      const relationLabelStyle = { ...labelStyle, background: "transparent", color: relationTone.text, padding: "2px 8px", borderRadius: 6 };
      const relationLayoutStyle = { display: "grid", gridTemplateColumns: showLabel2 ? "200px 1fr" : "1fr", alignItems: "start", columnGap: 6 };
      return /* @__PURE__ */ jsx("div", { style: { marginBottom: 4 }, children: renderRelationBlock({
        rel: relWithOverride,
        relationModel,
        relatedModel,
        record: createdRecord,
        mode: "edit",
        parentResource: model.name,
        allModels,
        showActions: showRelationActions,
        showCreate: showRelationCreate,
        relationViewTypeDefaults,
        showLabel: showLabel2,
        labelStyle: relationLabelStyle,
        valueStyle: { ...relationValueStyle, border: `1px solid ${token.colorBorder}` },
        fieldLayoutStyle: relationLayoutStyle
      }) }, `${item.name}-${item.row}-${item.column}`);
    }
    const field = resolveFieldFromConfig(model, item);
    if (field.isPk) return null;
    const showLabel = item.show_label !== false;
    const readonlyValueStyle = {
      padding: "2px 4px",
      lineHeight: 1.15,
      background: valueBackground,
      borderRadius: 6,
      border: `1px solid ${token.colorBorder}`,
      maxWidth: "100%",
      overflowWrap: "anywhere",
      ...parseInlineStyle(item.html_format)
    };
    return /* @__PURE__ */ jsx("div", { style: { marginBottom: 4 }, children: /* @__PURE__ */ jsxs("div", { style: { display: "grid", gridTemplateColumns: showLabel ? "200px 1fr" : "1fr", alignItems: "start", columnGap: 6 }, children: [
      showLabel && /* @__PURE__ */ jsx("div", { style: { ...labelStyle, backgroundColor: labelBackground, padding: "2px 4px", borderRadius: 4 }, children: field.label }),
      /* @__PURE__ */ jsx("div", { style: readonlyValueStyle, children: renderFieldValue(field, createdRecord, allModels) })
    ] }) }, `${field.key}-${index}`);
  };
  const renderSectionGrid = (section, rows, useReadonly) => {
    const normalized = normalizeSectionRows(rows);
    const maxRow = Math.max(1, ...normalized.map((r) => r.row));
    const maxCol = Math.max(1, ...normalized.map((r) => r.column));
    const prefix = useReadonly ? "pc" : "cr";
    return /* @__PURE__ */ jsxs("div", { style: { border: `1px solid ${token.colorBorder}`, borderRadius: 8, padding: "6px 6px", marginBottom: 6 }, children: [
      /* @__PURE__ */ jsx(Title2, { level: 5, style: { margin: 0, marginBottom: 6, color: "#1677ff" }, children: _23(section) }),
      /* @__PURE__ */ jsx("table", { style: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }, children: /* @__PURE__ */ jsx("tbody", { children: Array.from({ length: maxRow }).map((_39, rowIdx) => /* @__PURE__ */ jsx("tr", { children: Array.from({ length: maxCol }).map((_40, colIdx) => {
        const cellItems = normalized.filter((r) => r.row === rowIdx + 1 && r.column === colIdx + 1);
        return /* @__PURE__ */ jsx("td", { style: { padding: "0 4px", verticalAlign: "top", width: `${100 / maxCol}%` }, children: cellItems.map(
          (item, idx) => useReadonly ? renderReadonlyCell(item, idx) : renderFormCell(item, idx)
        ) }, `${prefix}-cell-${section}-${rowIdx}-${colIdx}`);
      }) }, `${prefix}-row-${section}-${rowIdx}`)) }) })
    ] }, section);
  };
  const detailsContent = /* @__PURE__ */ jsxs("div", { style: { paddingBottom: 24 }, children: [
    configLoading && /* @__PURE__ */ jsx(Skeleton, { active: true, paragraph: { rows: 6 } }),
    !configLoading && !hasConfig && !isPostCreate && /* @__PURE__ */ jsxs("div", { style: { position: "relative", marginTop: 0 }, children: [
      /* @__PURE__ */ jsx("div", { style: { position: "absolute", left: "212px", right: 0, top: 0, bottom: 0, background: valueBackground, borderRadius: 6 } }),
      /* @__PURE__ */ jsx(Form, { ...formProps, size: "small", initialValues, style: { position: "relative" }, children: /* @__PURE__ */ jsx("div", { style: { position: "relative", display: "flex", flexDirection: "column", gap: 4, padding: 0 }, children: effectiveFields.filter((f) => !f.isPk && !f.formula).map((field) => {
        const isHidden = hiddenFields.includes(field.key);
        if (isHidden) {
          return /* @__PURE__ */ jsx(Form.Item, { name: field.key, hidden: true, rules: field.required ? [{ required: true }] : [], children: renderInput(field, allModels, model) }, field.key);
        }
        return /* @__PURE__ */ jsxs("div", { style: { display: "grid", gridTemplateColumns: "200px 1fr", justifyContent: "start", alignItems: "start", columnGap: 6 }, children: [
          /* @__PURE__ */ jsx("span", { style: labelStyle, children: field.label }),
          /* @__PURE__ */ jsx("div", { style: { padding: "2px 4px", lineHeight: 1.15, maxWidth: "100%", overflowWrap: "anywhere" }, children: /* @__PURE__ */ jsx(Form.Item, { name: field.key, rules: field.required ? [{ required: true }] : [], valuePropName: field.type === "boolean" ? "checked" : void 0, getValueProps: (val) => (field.type === "date" || field.type === "datetime") && val ? { value: dayjs7(val) } : field.type === "time" && val ? { value: dayjs7("1970-01-01T" + val) } : { value: val }, style: { margin: 0 }, children: renderInput(field, allModels, model) }) })
        ] }, field.key);
      }) }) })
    ] }),
    !configLoading && !hasConfig && isPostCreate && /* @__PURE__ */ jsxs("div", { style: { position: "relative", marginTop: 0 }, children: [
      /* @__PURE__ */ jsx("div", { style: { position: "absolute", left: "212px", right: 0, top: 0, bottom: 0, background: valueBackground, borderRadius: 6 } }),
      /* @__PURE__ */ jsx("div", { style: { position: "relative", display: "flex", flexDirection: "column", gap: 4, padding: 0 }, children: effectiveFields.filter((f) => !f.isPk).map((field) => /* @__PURE__ */ jsxs("div", { style: { display: "grid", gridTemplateColumns: "200px 1fr", justifyContent: "start", alignItems: "start", columnGap: 6 }, children: [
        /* @__PURE__ */ jsx("span", { style: labelStyle, children: field.label }),
        /* @__PURE__ */ jsx("div", { style: { padding: "2px 4px", lineHeight: 1.15, maxWidth: "100%", overflowWrap: "anywhere" }, children: renderFieldValue(field, createdRecord, allModels) })
      ] }, field.key)) })
    ] }),
    !configLoading && hasConfig && !isPostCreate && /* @__PURE__ */ jsx("div", { style: { marginTop: 0 }, children: /* @__PURE__ */ jsx(Form, { ...formProps, size: "small", style: { position: "relative" }, initialValues, children: Array.from(configSections.entries()).map(
      ([section, rows]) => renderSectionGrid(section, rows, false)
    ) }) }),
    !configLoading && hasConfig && isPostCreate && /* @__PURE__ */ jsx("div", { style: { marginTop: 0 }, children: Array.from(configSections.entries()).map(
      ([section, rows]) => renderSectionGrid(section, rows, true)
    ) }),
    !configLoading && isPostCreate && !hasConfiguredDetailRelations && allModels && /* @__PURE__ */ jsx("div", { style: { marginTop: 8 }, children: allRelations.filter((rel) => {
      const fallbackTab = isReverseRelation(rel) ? DETAILS_TAB_NAME : rel.relationName || rel.label;
      return getRelationTabName(rel, "edit", fallbackTab ?? "") === DETAILS_TAB_NAME;
    }).map((rel) => {
      const relationModel = findModelByName(allModels, rel.resource);
      if (!relationModel) return null;
      const relatedModel = rel.otherResource ? findModelByName(allModels, rel.otherResource) : void 0;
      return renderRelationBlock({
        rel,
        relationModel,
        relatedModel,
        record: createdRecord,
        mode: "edit",
        parentResource: model.name,
        allModels,
        showActions: showRelationActions,
        showCreate: showRelationCreate,
        relationViewTypeDefaults
      });
    }) })
  ] });
  const buildRelationTabContent = (tabName) => {
    if (!isPostCreate || !allModels) {
      return /* @__PURE__ */ jsx(
        Alert,
        {
          type: "info",
          showIcon: true,
          message: _23("Save the record first to add relations."),
          style: { marginTop: 8 }
        }
      );
    }
    const nodes = [];
    allRelations.forEach((rel) => {
      if (!allModels) return;
      const relationModel = findModelByName(allModels, rel.resource);
      if (!relationModel) return;
      const relatedModel = rel.otherResource ? findModelByName(allModels, rel.otherResource) : void 0;
      const fallbackTab = isReverseRelation(rel) ? DETAILS_TAB_NAME : rel.relationName || rel.label;
      const rt2 = getRelationTabName(rel, "edit", fallbackTab ?? "");
      const resolvedTab = rt2 === DETAILS_TAB_NAME && !isReverseRelation(rel) ? rel.relationName || rel.label || rel.resource || DETAILS_TAB_NAME : rt2;
      if (hasConfiguredDetailRelations && isRelationConfiguredForDetails(rel, configuredResolvedRelationKeys, configuredRelationKeys, configuredRelationDisplayKeys)) return;
      if (resolvedTab !== tabName) return;
      nodes.push(renderRelationBlock({
        rel,
        relationModel,
        relatedModel,
        record: createdRecord,
        mode: "edit",
        parentResource: model.name,
        allModels,
        showActions: showRelationActions,
        showCreate: showRelationCreate,
        relationViewTypeDefaults
      }));
    });
    return /* @__PURE__ */ jsx("div", { children: nodes });
  };
  const tabItems = [
    {
      key: "main_data",
      label: renderToneTabLabel(_23("Details"), modelTone),
      children: detailsContent
    },
    ...relationTabEntries.map(({ tabName, tone }) => ({
      key: tabName,
      label: renderToneTabLabel(getTabDisplayLabel(tabName), tone),
      children: buildRelationTabContent(tabName)
    }))
  ];
  const lazyTabItems = tabItems.map((item) => ({
    ...item,
    children: item.key === activeTabKey ? item.children : null
  }));
  if (isLinkModel && !hasConfig) {
    return /* @__PURE__ */ jsxs("div", { className: "jm-tone-scope", style: toneScopeStyle(modelTone), children: [
      /* @__PURE__ */ jsx(ToneSharedStyles, {}),
      /* @__PURE__ */ jsx(
        StandardCreate,
        {
          saveButtonProps: { ...saveButtonProps, hideText: true, htmlType: "submit", form: "link-model-create-form" },
          headerButtons: renderHeaderButtons,
          title: renderWrappedPageTitle(`${_23("Create")} ${modelDisplayLabel}`),
          children: /* @__PURE__ */ jsx(
            Form,
            {
              id: "link-model-create-form",
              size: "small",
              initialValues,
              onFinish: async (values) => {
                const eidFrom = values.eid_from ?? initialValues.eid_from;
                const selectedIds = Array.isArray(values.eid_to) ? values.eid_to : [values.eid_to];
                let successCount = 0;
                for (const eidTo of selectedIds) {
                  try {
                    const res = await authenticatedFetch(`${apiUrl}/${formResource}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ eid_from: eidFrom, eid_to: eidTo })
                    });
                    if (res.ok) successCount++;
                    else message.error(`${_23("Failed to create relation for")} eid_to=${eidTo} (${res.status})`);
                  } catch {
                    message.error(`${_23("Failed to create relation for")} eid_to=${eidTo}`);
                  }
                }
                if (successCount > 0) message.success(`${successCount} ${_23("relation(s) created.")}`);
                if (returnTo) navigate(returnTo);
              },
              children: /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: effectiveFields.filter((f) => !f.isPk && !f.formula).map((field) => {
                const isHidden = hiddenFields.includes(field.key);
                const isOtherKey = field.key === "eid_to";
                if (isHidden) {
                  return /* @__PURE__ */ jsx(Form.Item, { name: field.key, hidden: true, rules: field.required ? [{ required: true }] : [], children: isOtherKey && field.reference && hasReferenceModel(field.reference, allModels) ? /* @__PURE__ */ jsx(RelationSelect, { field, allModels, multiple: true }) : renderInput(field, allModels, model) }, field.key);
                }
                return /* @__PURE__ */ jsxs("div", { style: { display: "grid", gridTemplateColumns: "200px 1fr", justifyContent: "start", alignItems: "start", columnGap: 6 }, children: [
                  /* @__PURE__ */ jsx("span", { style: labelStyle, children: field.label }),
                  /* @__PURE__ */ jsx("div", { style: { padding: "2px 4px", lineHeight: 1.15, maxWidth: "100%", overflowWrap: "anywhere" }, children: /* @__PURE__ */ jsx(Form.Item, { name: field.key, rules: field.required ? [{ required: true }] : [], style: { margin: 0 }, children: isOtherKey && field.reference && hasReferenceModel(field.reference, allModels) ? /* @__PURE__ */ jsx(RelationSelect, { field, allModels, multiple: true }) : renderInput(field, allModels, model) }) })
                ] }, field.key);
              }) })
            }
          )
        }
      )
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "jm-tone-scope", style: toneScopeStyle(modelTone), children: [
    /* @__PURE__ */ jsx(ToneSharedStyles, {}),
    /* @__PURE__ */ jsxs(
      StandardCreate,
      {
        saveButtonProps: isPostCreate ? { ...saveButtonProps, style: { display: "none" }, hideText: true } : { ...saveButtonProps, hideText: true },
        headerButtons: isPostCreate ? renderPostCreateHeaderButtons : renderHeaderButtons,
        title: renderWrappedPageTitle(
          isPostCreate ? createdRecord?._label || modelDisplayLabel : `${_23("Create")} ${modelDisplayLabel}`
        ),
        children: [
          isPostCreate && /* @__PURE__ */ jsx(
            Alert,
            {
              type: "success",
              message: _23("Record created. You can now manage relations below."),
              showIcon: true,
              style: { marginBottom: 12 }
            }
          ),
          hasRelationTabs ? /* @__PURE__ */ jsx(
            Tabs,
            {
              activeKey: activeTabKey,
              onChange: setActiveTabKey,
              items: lazyTabItems,
              destroyInactiveTabPane: true
            }
          ) : detailsContent
        ]
      }
    )
  ] });
};
var NLSentenceBlock = ({ eid, title: titleProp, showLabel }) => {
  const { token } = theme.useToken();
  const apiUrl = useApiUrl();
  const [html, setHtml] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fetchedTitle, setFetchedTitle] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setHtml(null);
    setError(null);
    authenticatedFetch(`${apiUrl}/nlsentence/${eid}/custom_content?results_only=1`).then((r) => r.json()).then((data) => {
      if (!cancelled) {
        setHtml(data?.html ?? "");
        setFetchedTitle(data?.title ?? null);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setError("Failed to load NLSentence result");
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [apiUrl, eid]);
  const displayTitle = titleProp || fetchedTitle || null;
  return /* @__PURE__ */ jsxs("div", { style: { marginBottom: 8 }, children: [
    showLabel !== false && displayTitle && /* @__PURE__ */ jsxs("div", { style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 6,
      marginBottom: 4,
      padding: "4px 6px",
      background: token.colorFillAlter,
      borderRadius: 6,
      borderLeft: `3px solid ${token.colorPrimary}`
    }, children: [
      /* @__PURE__ */ jsx(CommentOutlined, { style: { color: token.colorPrimary, marginTop: 2, flexShrink: 0 } }),
      /* @__PURE__ */ jsx(Typography.Text, { style: { flex: 1, whiteSpace: "pre-wrap", fontSize: token.fontSize, lineHeight: 1.4 }, children: displayTitle }),
      /* @__PURE__ */ jsx(Tooltip, { title: "View NLSentence", children: /* @__PURE__ */ jsx(Link, { to: `/nlsentence/show/${eid}`, onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsx(EyeOutlined, { style: { color: token.colorPrimary, fontSize: 12 } }) }) })
    ] }),
    showLabel !== false && !displayTitle && !loading && /* @__PURE__ */ jsx("div", { style: { marginBottom: 4, display: "flex", justifyContent: "flex-end" }, children: /* @__PURE__ */ jsx(Tooltip, { title: "View NLSentence", children: /* @__PURE__ */ jsx(Link, { to: `/nlsentence/show/${eid}`, onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsx(EyeOutlined, { style: { color: token.colorTextTertiary, fontSize: 12 } }) }) }) }),
    loading && /* @__PURE__ */ jsx(Skeleton, { active: true, paragraph: { rows: 3 } }),
    !loading && error && /* @__PURE__ */ jsx("div", { style: { color: token.colorError, fontSize: 12, padding: "4px 6px" }, children: error }),
    !loading && html !== null && /* @__PURE__ */ jsx(ExecutableHtml, { html })
  ] });
};
var _24 = window._ || ((text) => text);
var { Title: Title3 } = Typography;
var DynamicEdit = ({ model: modelProp, allModels, topContent, extraHeaderButtons, journeyCallbacks, idOverride }) => {
  const model = useRoleFilteredModel(modelProp);
  applyI18nLabelsToModel(model);
  applyI18nLabelsToModels(allModels);
  const go = useGo();
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const effectiveId = idOverride ?? routeId;
  const [searchParams] = useSearchParams();
  const { token } = theme.useToken();
  const modelTone = useModelTone(model);
  const { settings: viewSettings, loading: viewSettingsLoading } = useViewSettings();
  const relationViewTypeDefaults = useMemo(
    () => ({
      show: normalizeRelationViewType(viewSettings?.showViewType || "") || "totals-details",
      edit: normalizeRelationViewType(viewSettings?.editViewType || "") || "editable-table"
    }),
    [viewSettings?.showViewType, viewSettings?.editViewType]
  );
  const apiUrl = useApiUrl();
  const allModelsList = useMemo(() => allModels || [], [allModels]);
  const { rows: editConfigRows, loading: editConfigLoading } = useViewConfigurations(model.name, "AutomaticEntityForm");
  const { rows: fallbackConfigRows, loading: fallbackConfigLoading } = useViewConfigurations(model.name, "PrimaryView");
  const valueBackground = isDarkColor2(token.colorBgBase || token.colorBgContainer) ? token.colorFillQuaternary : "#F9FFFF";
  const labelBackground = isDarkColor2(token.colorBgBase || token.colorBgContainer) ? "transparent" : "#ffffff";
  const disableRedirect = searchParams.get("inline") === "1" || searchParams.get("redirect") === "false" || searchParams.get("redirect") === "0";
  const requestedReturnTo = searchParams.get("returnTo");
  const returnTo = requestedReturnTo && requestedReturnTo.startsWith("/") ? requestedReturnTo : null;
  const redirectTarget = disableRedirect ? false : "show";
  const modelDisplayLabel = asDisplayText(model.label, asDisplayText(model.name, "Record"));
  const { formProps, saveButtonProps, queryResult } = useForm({
    resource: model.resource || model.name,
    id: effectiveId,
    redirect: returnTo || journeyCallbacks ? false : redirectTarget,
    ...returnTo || journeyCallbacks ? {
      onMutationSuccess: (response) => {
        if (journeyCallbacks?.onSave) {
          const record2 = response?.data?.data || response?.data || response;
          journeyCallbacks.onSave(record2);
        } else if (returnTo) {
          navigate(returnTo);
        }
      }
    } : {},
    successNotification: () => ({
      message: _24("Changes saved."),
      description: modelDisplayLabel,
      type: "success"
    })
  });
  const record = queryResult?.data?.data;
  const editFormProps = useMemo(() => {
    if (!isFileModel(model)) return formProps;
    const originalOnFinish = formProps.onFinish;
    return {
      ...formProps,
      onFinish: (values) => {
        const { data: _binaryData, ...rest } = values || {};
        return originalOnFinish?.(rest);
      }
    };
  }, [formProps, model]);
  useKeyboardShortcuts(useMemo(() => [
    { key: "s", ctrl: true, handler: () => formProps?.form?.submit() },
    { key: "Escape", handler: () => journeyCallbacks?.onCancel ? journeyCallbacks.onCancel() : navigate(-1) }
  ], [formProps?.form, navigate, journeyCallbacks]));
  const pageTitle = record?._label ? asDisplayText(record._label, `${_24("Edit")} ${modelDisplayLabel}`) : `${_24("Edit")} ${modelDisplayLabel}`;
  const recordId = getRecordId(record, model.fields);
  const effectiveFields = useMemo(() => applyRelationFieldOverrides(model, allModelsList), [model, allModelsList]);
  const { metadataButton: editMetadataButton, metadataModal: editMetadataModal } = useMetadataModal(model, allModels);
  const [showRelationActions, setShowRelationActions] = useState(DEFAULT_EDIT_RELATION_ROW_ACTIONS);
  const [showRelationCreate, setShowRelationCreate] = useState(DEFAULT_RELATION_CREATE_ACTIONS);
  const [isSavingActionsPrefs, setIsSavingActionsPrefs] = useState(false);
  const actionsPrefsTouchedRef = useRef(false);
  const actionsPrefsLoadedRef = useRef(false);
  const actionsPrefsResourceRef = useRef(null);
  const markActionsPrefsTouched = useCallback(() => {
    actionsPrefsTouchedRef.current = true;
  }, []);
  const saveActionsPreferences = useCallback(async () => {
    const resourceKey = resolveResourcePath(model.resource || model.name, allModelsList);
    const preferences = {
      showActions: showRelationActions,
      showActionsConfigured: true,
      showCreate: showRelationCreate
    };
    setIsSavingActionsPrefs(true);
    try {
      const response = await authenticatedFetch(`${apiUrl}/views/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: resourceKey, preferenceType: "EditActions", preferences })
      });
      if (!response.ok) {
        throw new Error(`Save failed (${response.status})`);
      }
      message.success("Edit actions preferences saved.");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to save edit actions preferences.");
    } finally {
      setIsSavingActionsPrefs(false);
    }
  }, [apiUrl, allModelsList, model.name, model.resource, showRelationActions, showRelationCreate]);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const duplicateRecord = useCallback(async (withRelations) => {
    if (!record) return;
    setIsDuplicating(true);
    try {
      const pkField = model.fields.find((f) => f.isPk);
      const excludeKeys = new Set([pkField?.key, "eid", "id", "creation_date", "modification_date", "_label"].filter(Boolean));
      const payload = {};
      for (const [key, value] of Object.entries(record)) {
        if (!excludeKeys.has(key) && value !== void 0) {
          payload[key] = value;
        }
      }
      const resourcePath = resolveResourcePath(model.resource || model.name, allModelsList);
      const createResponse = await authenticatedFetch(`${apiUrl}/${resourcePath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!createResponse.ok) {
        const detail = await createResponse.text();
        throw new Error(detail || `Failed to duplicate (${createResponse.status})`);
      }
      const newRecord = await createResponse.json();
      const newId = getRecordId(newRecord, model.fields);
      if (withRelations && model.relations && newId) {
        const sourceId = getRecordId(record, model.fields);
        for (const rel of model.relations) {
          if (!rel.resource || !rel.targetKey) continue;
          const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModelsList);
          try {
            const params = new URLSearchParams();
            params.set("_start", "0");
            params.set("_end", "10000");
            params.set(rel.targetKey, String(sourceId));
            const relResponse = await authenticatedFetch(`${apiUrl}/${relationResource}?${params.toString()}`);
            if (!relResponse.ok) continue;
            const relRows = await relResponse.json();
            if (!Array.isArray(relRows)) continue;
            for (const row of relRows) {
              const relPayload = {};
              for (const [key, value] of Object.entries(row)) {
                if (!excludeKeys.has(key) && value !== void 0) {
                  relPayload[key] = value;
                }
              }
              relPayload[rel.targetKey] = newId;
              await authenticatedFetch(`${apiUrl}/${relationResource}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(relPayload)
              });
            }
          } catch {
          }
        }
      }
      message.success(
        withRelations ? _24("Object duplicated with relations.") : _24("Object duplicated.")
      );
      if (newId) {
        go({ to: { resource: model.resource || model.name, action: "edit", id: newId } });
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : _24("Failed to duplicate object."));
    } finally {
      setIsDuplicating(false);
    }
  }, [record, model, allModelsList, apiUrl, go]);
  useEffect(() => {
    const resourceKey = resolveResourcePath(model.resource || model.name, allModelsList);
    if (actionsPrefsResourceRef.current !== resourceKey) {
      actionsPrefsLoadedRef.current = false;
      actionsPrefsResourceRef.current = resourceKey;
    }
    if (actionsPrefsLoadedRef.current) return;
    let cancelled = false;
    const loadPreferences = async () => {
      try {
        const response = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=EditActions`);
        if (!response.ok) {
          throw new Error(`Load failed (${response.status})`);
        }
        const data = await response.json();
        if (cancelled || actionsPrefsTouchedRef.current) return;
        const prefs = data?.preferences;
        if (!prefs || typeof prefs !== "object") return;
        const hasExplicitEditShowActions = Object.prototype.hasOwnProperty.call(prefs, "showActionsConfigured");
        if (hasExplicitEditShowActions && "showActions" in prefs) {
          setShowRelationActions(Boolean(prefs.showActions));
        }
        if ("showCreate" in prefs) setShowRelationCreate(Boolean(prefs.showCreate));
        actionsPrefsLoadedRef.current = true;
      } catch {
      }
    };
    loadPreferences();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, allModelsList, model.name, model.resource]);
  const { embedded, tabbed } = splitRelations(model.relations);
  const labelStyle = {
    fontSize: token.fontSize,
    fontWeight: 400,
    color: token.colorTextSecondary,
    margin: 0,
    lineHeight: 1
  };
  const configRows = filterConfigRowsForMode(
    editConfigRows.length > 0 ? editConfigRows : fallbackConfigRows,
    "edit"
  );
  const hasConfig = configRows.length > 0;
  const configuredRelationKeys = buildConfiguredRelationKeys(configRows);
  const configuredResolvedRelationKeys = buildConfiguredResolvedRelationKeys(model.relations, configRows);
  const configuredRelationDisplayKeys = buildConfiguredRelationDisplayKeys(model.relations, configRows);
  const hasConfiguredDetailRelations = configuredResolvedRelationKeys.size > 0 || configuredRelationKeys.size > 0;
  const configLoading = editConfigLoading || fallbackConfigLoading || viewSettingsLoading;
  const detailsConfigRows = configRows.filter((r) => !r.tab_name);
  const customTabNames = Array.from(new Set(
    configRows.filter((r) => !!r.tab_name).map((r) => r.tab_name)
  ));
  const configSections = groupConfigRowsBySectionId(detailsConfigRows);
  const actionsSettingsContent = /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 8, minWidth: 200 }, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }, children: [
      /* @__PURE__ */ jsx("span", { children: _24("Relation's row actions buttons") }),
      /* @__PURE__ */ jsx(
        Switch,
        {
          checked: showRelationActions,
          onChange: (checked) => {
            markActionsPrefsTouched();
            setShowRelationActions(checked);
          },
          size: "small"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }, children: [
      /* @__PURE__ */ jsx("span", { children: _24("Relation's create action button") }),
      /* @__PURE__ */ jsx(
        Switch,
        {
          checked: showRelationCreate,
          onChange: (checked) => {
            markActionsPrefsTouched();
            setShowRelationCreate(checked);
          },
          size: "small"
        }
      )
    ] }),
    /* @__PURE__ */ jsx(Divider, { style: { margin: "4px 0" } }),
    /* @__PURE__ */ jsx(
      Button,
      {
        size: "small",
        icon: /* @__PURE__ */ jsx(SaveOutlined, {}),
        onClick: saveActionsPreferences,
        loading: isSavingActionsPrefs,
        block: true,
        children: _24("Save")
      }
    )
  ] });
  const addTabsForNonConfiguredRelations = viewSettings?.addTabsForNonConfiguredRelations !== false;
  const relationTabGroups = /* @__PURE__ */ new Map();
  const allRelations = [...embedded, ...tabbed];
  if (record && allModels) {
    allRelations.forEach((rel) => {
      if (!addTabsForNonConfiguredRelations && !isReverseRelation(rel)) return;
      const relationModel = findModelByName(allModels, rel.resource);
      if (!relationModel) return;
      const relatedModel = rel.otherResource ? findModelByName(allModels, rel.otherResource) : void 0;
      const fallbackTab = isReverseRelation(rel) ? DETAILS_TAB_NAME : rel.relationName || rel.label;
      const tabName = getRelationTabName(rel, "edit", fallbackTab);
      const resolvedTabName = tabName === DETAILS_TAB_NAME && !isReverseRelation(rel) ? rel.relationName || rel.label || rel.resource || DETAILS_TAB_NAME : tabName;
      if (hasConfiguredDetailRelations && isRelationConfiguredForDetails(rel, configuredResolvedRelationKeys, configuredRelationKeys, configuredRelationDisplayKeys)) return;
      if (resolvedTabName === DETAILS_TAB_NAME) return;
      const tone = getModelTone(relatedModel || relationModel || rel.resource);
      const existing = relationTabGroups.get(resolvedTabName);
      const nodes = existing?.nodes || [];
      nodes.push(renderRelationBlock({
        rel,
        relationModel,
        relatedModel,
        record,
        mode: "edit",
        parentResource: model.name,
        allModels,
        showActions: showRelationActions,
        showCreate: showRelationCreate,
        relationViewTypeDefaults
      }));
      relationTabGroups.set(resolvedTabName, { nodes, tone: existing?.tone || tone });
    });
  }
  const relationTabs = Array.from(relationTabGroups.entries()).map(([tabName, group]) => ({
    key: tabName,
    label: renderToneTabLabel(getTabDisplayLabel(tabName), group.tone),
    children: /* @__PURE__ */ jsx("div", { children: group.nodes })
  }));
  const items = [
    {
      key: "main_data",
      label: renderToneTabLabel(_24("Details"), modelTone),
      children: /* @__PURE__ */ jsxs("div", { style: { paddingBottom: 2 }, children: [
        configLoading && /* @__PURE__ */ jsx(Skeleton, { active: true, paragraph: { rows: 6 } }),
        !configLoading && !hasConfig && /* @__PURE__ */ jsx(Form, { ...editFormProps, size: "small", children: /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 4, marginTop: 0 }, children: effectiveFields.filter((f) => !f.isPk).map((field) => /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-start",
              gap: "4px 6px"
            },
            children: [
              /* @__PURE__ */ jsx("span", { style: { ...labelStyle, flex: "0 0 200px" }, children: field.label }),
              /* @__PURE__ */ jsx("div", { style: { flex: "1 0 200px", padding: "2px 4px", lineHeight: 1.15, overflowWrap: "anywhere", background: valueBackground, borderRadius: 6 }, children: /* @__PURE__ */ jsx(
                Form.Item,
                {
                  name: field.key,
                  rules: field.required && !field.formula ? [{ required: true }] : [],
                  valuePropName: field.type === "boolean" ? "checked" : void 0,
                  getValueProps: (val) => (field.type === "date" || field.type === "datetime") && val ? { value: dayjs7(val) } : field.type === "time" && val ? { value: dayjs7("1970-01-01T" + val) } : { value: val },
                  style: { margin: 0 },
                  children: field.formula ? /* @__PURE__ */ jsx(Input, { disabled: true }) : renderInput(field, allModels, model, recordId)
                }
              ) })
            ]
          },
          field.key
        )) }) }),
        !configLoading && hasConfig && /* @__PURE__ */ jsx("div", { style: { marginTop: 0 }, children: /* @__PURE__ */ jsx(
          Form,
          {
            ...editFormProps,
            size: "small",
            style: { position: "relative" },
            children: (() => {
              const gridRowMap = /* @__PURE__ */ new Map();
              for (const [, { name: sectionName, rows }] of configSections.entries()) {
                const gridRow = rows[0]?.section_grid_row ?? 1;
                const gridCol = rows[0]?.section_grid_col ?? 1;
                const arr = gridRowMap.get(gridRow) || [];
                arr.push({ name: sectionName, rows, gridCol });
                gridRowMap.set(gridRow, arr);
              }
              return Array.from(gridRowMap.keys()).sort((a, b) => a - b).map((gridRow) => {
                const rowSections = (gridRowMap.get(gridRow) || []).sort((a, b) => a.gridCol - b.gridCol);
                return /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 6 }, children: rowSections.map(({ name: section, rows }) => {
                  const normalized = normalizeSectionRows(rows);
                  const maxRow = Math.max(1, ...normalized.map((row) => row.row));
                  const maxCol = Math.max(1, ...normalized.map((row) => row.column));
                  return /* @__PURE__ */ jsxs(
                    "div",
                    {
                      style: {
                        flex: 1,
                        minWidth: 0,
                        border: `1px solid ${token.colorBorder}`,
                        borderRadius: 8,
                        padding: "2px 6px"
                      },
                      children: [
                        /* @__PURE__ */ jsx(Title3, { level: 5, style: { margin: 0, color: "#1677ff" }, children: _24(section) }),
                        /* @__PURE__ */ jsx("table", { style: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }, children: /* @__PURE__ */ jsx("tbody", { children: Array.from({ length: maxRow }).map((_39, rowIndex) => /* @__PURE__ */ jsx("tr", { children: Array.from({ length: maxCol }).map((_40, colIndex) => {
                          const cellItems = normalized.filter(
                            (item) => item.row === rowIndex + 1 && item.column === colIndex + 1
                          );
                          return /* @__PURE__ */ jsx(
                            "td",
                            {
                              style: { padding: "0 4px", verticalAlign: "top", width: `${100 / maxCol}%` },
                              children: cellItems.map((item, index) => {
                                if (item.attribute_or_relation_type === "nlsentence") {
                                  if (!item.nl_sentence_eid) return null;
                                  return /* @__PURE__ */ jsx(
                                    NLSentenceBlock,
                                    {
                                      eid: item.nl_sentence_eid,
                                      title: item.nl_sentence_title ?? void 0,
                                      showLabel: item.show_label !== false
                                    },
                                    `nls-${item.nl_sentence_eid}`
                                  );
                                }
                                if (item.attribute_or_relation_type === "relation") {
                                  if (!record || !allModels) return null;
                                  const relation = resolveRelationFromConfig(model.relations, item);
                                  if (!relation) return null;
                                  const relationModel = findModelByName(allModels, relation.resource);
                                  if (!relationModel) return null;
                                  const relatedModel = relation.otherResource ? findModelByName(allModels, relation.otherResource) : void 0;
                                  const relationTone = getModelTone(relatedModel || relationModel || relation.resource);
                                  const relWithOverride = applyRelationViewOverride(relation, item, "edit");
                                  const showLabel2 = item.show_label !== false;
                                  getRelationViewType(relWithOverride, "edit", relationViewTypeDefaults);
                                  const relationValueStyle = {
                                    padding: "2px 4px",
                                    lineHeight: 1.15,
                                    background: valueBackground,
                                    borderRadius: 6,
                                    overflowWrap: "anywhere",
                                    maxWidth: "100%",
                                    ...parseInlineStyle(item.html_format)
                                  };
                                  const relationLabelStyle = {
                                    ...labelStyle,
                                    background: "transparent",
                                    color: relationTone.text,
                                    padding: "2px 8px",
                                    borderRadius: 6
                                  };
                                  const relationLayoutStyle = {
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 2
                                  };
                                  return /* @__PURE__ */ jsx("div", { style: { marginBottom: 4 }, children: renderRelationBlock({
                                    rel: relWithOverride,
                                    relationModel,
                                    relatedModel,
                                    record,
                                    mode: "edit",
                                    parentResource: model.name,
                                    allModels,
                                    showActions: showRelationActions,
                                    showCreate: showRelationCreate,
                                    relationViewTypeDefaults,
                                    showLabel: showLabel2,
                                    labelStyle: relationLabelStyle,
                                    valueStyle: { ...relationValueStyle, border: `1px solid ${token.colorBorder}` },
                                    fieldLayoutStyle: relationLayoutStyle
                                  }) }, `${item.name}-${item.row}-${item.column}`);
                                }
                                const field = resolveFieldFromConfig(model, item);
                                if (field.isPk) return null;
                                const showLabel = item.show_label !== false;
                                const editable = isAttributeValueEditable(item, "edit");
                                if (!editable) {
                                  const readonlyValueStyle = {
                                    padding: "2px 4px",
                                    lineHeight: 1.15,
                                    background: valueBackground,
                                    borderRadius: 6,
                                    border: `1px solid ${token.colorBorder}`,
                                    maxWidth: "100%",
                                    overflowWrap: "anywhere",
                                    textAlign: field.type === "number" ? "right" : "left",
                                    fontVariantNumeric: field.type === "number" ? "tabular-nums" : void 0,
                                    ...parseInlineStyle(item.html_format)
                                  };
                                  return /* @__PURE__ */ jsx("div", { style: { marginBottom: 4 }, children: /* @__PURE__ */ jsxs(
                                    "div",
                                    {
                                      style: {
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 2
                                      },
                                      children: [
                                        showLabel && /* @__PURE__ */ jsx(
                                          "div",
                                          {
                                            style: {
                                              ...labelStyle,
                                              backgroundColor: labelBackground,
                                              padding: "2px 4px",
                                              borderRadius: 4
                                            },
                                            children: field.label
                                          }
                                        ),
                                        /* @__PURE__ */ jsx("div", { style: readonlyValueStyle, children: renderFieldValue(field, record, allModels) })
                                      ]
                                    }
                                  ) }, `${field.key}-${index}`);
                                }
                                return /* @__PURE__ */ jsx("div", { style: { marginBottom: 4 }, children: /* @__PURE__ */ jsxs(
                                  "div",
                                  {
                                    style: {
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 2
                                    },
                                    children: [
                                      showLabel && /* @__PURE__ */ jsx(
                                        "div",
                                        {
                                          style: {
                                            ...labelStyle,
                                            backgroundColor: labelBackground,
                                            padding: "2px 4px",
                                            borderRadius: 4
                                          },
                                          children: field.label
                                        }
                                      ),
                                      /* @__PURE__ */ jsx("div", { style: {
                                        padding: "2px 4px",
                                        lineHeight: 1.15,
                                        background: valueBackground,
                                        borderRadius: 6,
                                        border: `1px solid ${token.colorBorder}`,
                                        maxWidth: "100%",
                                        overflowWrap: "anywhere",
                                        ...parseInlineStyle(item.html_format)
                                      }, children: /* @__PURE__ */ jsx(
                                        Form.Item,
                                        {
                                          name: field.key,
                                          rules: field.required && !field.formula ? [{ required: true }] : [],
                                          valuePropName: field.type === "boolean" ? "checked" : void 0,
                                          getValueProps: (val) => (field.type === "date" || field.type === "datetime") && val ? { value: dayjs7(val) } : field.type === "time" && val ? { value: dayjs7("1970-01-01T" + val) } : { value: val },
                                          style: { margin: 0 },
                                          children: field.formula ? /* @__PURE__ */ jsx(Input, { disabled: true }) : renderInput(field, allModels, model, recordId)
                                        }
                                      ) })
                                    ]
                                  }
                                ) }, `${field.key}-${index}`);
                              })
                            },
                            `edit-cell-${section}-${rowIndex}-${colIndex}`
                          );
                        }) }, `edit-row-${section}-${rowIndex}`)) }) })
                      ]
                    },
                    section
                  );
                }) }, `gr-${gridRow}`);
              });
            })()
          }
        ) }),
        !configLoading && record && allModels && !hasConfiguredDetailRelations && /* @__PURE__ */ jsx("div", { style: { marginTop: 8 }, children: [...embedded, ...tabbed].filter((rel) => {
          const fallbackTab = isReverseRelation(rel) ? DETAILS_TAB_NAME : rel.relationName || rel.label;
          return getRelationTabName(rel, "edit", fallbackTab) === DETAILS_TAB_NAME;
        }).map((rel) => {
          const relationModel = findModelByName(allModels, rel.resource);
          if (!relationModel) return null;
          const relatedModel = rel.otherResource ? findModelByName(allModels, rel.otherResource) : void 0;
          return renderRelationBlock({
            rel,
            relationModel,
            relatedModel,
            record,
            mode: "edit",
            parentResource: model.name,
            allModels,
            showActions: showRelationActions,
            showCreate: showRelationCreate,
            relationViewTypeDefaults
          });
        }) })
      ] })
    }
  ];
  const customConfigTabs = customTabNames.map((tabName) => {
    const tabRows = configRows.filter((r) => r.tab_name === tabName);
    const tabSections = groupConfigRowsBySectionId(tabRows);
    const gridRowMap = /* @__PURE__ */ new Map();
    for (const [, { name: sectionName, rows }] of tabSections.entries()) {
      const gridRow = rows[0]?.section_grid_row ?? 1;
      const gridCol = rows[0]?.section_grid_col ?? 1;
      const arr = gridRowMap.get(gridRow) || [];
      arr.push({ name: sectionName, rows, gridCol });
      gridRowMap.set(gridRow, arr);
    }
    const tabChildren = /* @__PURE__ */ jsx(Form, { ...editFormProps, size: "small", style: { position: "relative" }, children: Array.from(gridRowMap.keys()).sort((a, b) => a - b).map((gridRow) => {
      const rowSections = (gridRowMap.get(gridRow) || []).sort((a, b) => a.gridCol - b.gridCol);
      return /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 6 }, children: rowSections.map(({ name: section, rows }) => {
        const normalized = normalizeSectionRows(rows);
        const maxRow = Math.max(1, ...normalized.map((r) => r.row));
        const maxCol = Math.max(1, ...normalized.map((r) => r.column));
        return /* @__PURE__ */ jsxs("div", { style: { flex: 1, minWidth: 0, border: `1px solid ${token.colorBorder}`, borderRadius: 8, padding: "2px 6px" }, children: [
          /* @__PURE__ */ jsx(Title3, { level: 5, style: { margin: 0, color: "#1677ff" }, children: _24(section) }),
          /* @__PURE__ */ jsx("table", { style: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }, children: /* @__PURE__ */ jsx("tbody", { children: Array.from({ length: maxRow }).map((_39, ri) => /* @__PURE__ */ jsx("tr", { children: Array.from({ length: maxCol }).map((_40, ci) => {
            const cellItems = normalized.filter((item) => item.row === ri + 1 && item.column === ci + 1);
            return /* @__PURE__ */ jsx("td", { style: { padding: "0 4px", verticalAlign: "top", width: `${100 / maxCol}%` }, children: cellItems.map((item, idx) => {
              if (item.attribute_or_relation_type === "nlsentence") {
                if (!item.nl_sentence_eid) return null;
                return /* @__PURE__ */ jsx(
                  NLSentenceBlock,
                  {
                    eid: item.nl_sentence_eid,
                    title: item.nl_sentence_title ?? void 0,
                    showLabel: item.show_label !== false
                  },
                  `nls-${item.nl_sentence_eid}`
                );
              }
              if (item.attribute_or_relation_type === "relation") {
                if (!record || !allModels) return null;
                const relation = resolveRelationFromConfig(model.relations, item);
                if (!relation) return null;
                const relationModel = findModelByName(allModels, relation.resource);
                if (!relationModel) return null;
                const relatedModel = relation.otherResource ? findModelByName(allModels, relation.otherResource) : void 0;
                const relWithOverride = applyRelationViewOverride(relation, item, "edit");
                const showLabel2 = item.show_label !== false;
                return /* @__PURE__ */ jsx("div", { style: { marginBottom: 4 }, children: renderRelationBlock({
                  rel: relWithOverride,
                  relationModel,
                  relatedModel,
                  record,
                  mode: "edit",
                  parentResource: model.name,
                  allModels,
                  showActions: showRelationActions,
                  showCreate: showRelationCreate,
                  relationViewTypeDefaults,
                  showLabel: showLabel2
                }) }, `${item.name}-${item.row}-${item.column}`);
              }
              const field = resolveFieldFromConfig(model, item);
              if (field.isPk) return null;
              const showLabel = item.show_label !== false;
              const editable = isAttributeValueEditable(item, "edit");
              return /* @__PURE__ */ jsx("div", { style: { marginBottom: 4 }, children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 2 }, children: [
                showLabel && /* @__PURE__ */ jsx("div", { style: { ...labelStyle, backgroundColor: labelBackground, padding: "2px 4px", borderRadius: 4 }, children: field.label }),
                /* @__PURE__ */ jsx("div", { style: { padding: "2px 4px", lineHeight: 1.15, background: valueBackground, borderRadius: 6, border: `1px solid ${token.colorBorder}`, maxWidth: "100%", overflowWrap: "anywhere", ...parseInlineStyle(item.html_format) }, children: editable ? /* @__PURE__ */ jsx(
                  Form.Item,
                  {
                    name: field.key,
                    rules: field.required && !field.formula ? [{ required: true }] : [],
                    valuePropName: field.type === "boolean" ? "checked" : void 0,
                    getValueProps: (val) => (field.type === "date" || field.type === "datetime") && val ? { value: dayjs7(val) } : field.type === "time" && val ? { value: dayjs7("1970-01-01T" + val) } : { value: val },
                    style: { margin: 0 },
                    children: field.formula ? /* @__PURE__ */ jsx(Input, { disabled: true }) : renderInput(field, allModels, model, recordId)
                  }
                ) : renderFieldValue(field, record, allModels) })
              ] }) }, `${field.key}-${idx}`);
            }) }, `ct-cell-${section}-${ri}-${ci}`);
          }) }, `ct-row-${section}-${ri}`)) }) })
        ] }, section);
      }) }, `ct-gr-${gridRow}`);
    }) });
    return {
      key: `custom-tab::${tabName}`,
      label: renderToneTabLabel(_24(tabName), modelTone),
      children: tabChildren
    };
  });
  items.push(...customConfigTabs);
  items.push(...relationTabs);
  const [activeTabKey, setActiveTabKey] = useState("main_data");
  useEffect(() => {
    if (!items.find((item) => item.key === activeTabKey)) {
      setActiveTabKey(items[0]?.key || "main_data");
    }
  }, [activeTabKey, items]);
  const lazyItems = useMemo(
    () => items.map((item) => ({
      ...item,
      children: item.key === activeTabKey ? item.children : null
    })),
    [activeTabKey, items]
  );
  const renderHeaderButtons = ({ defaultButtons }) => /* @__PURE__ */ jsxs(Fragment, { children: [
    extraHeaderButtons,
    editMetadataButton,
    editMetadataModal,
    recordId && /* @__PURE__ */ jsx(Tooltip, { title: _24("Show"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(EyeOutlined, {}), onClick: () => go({ to: { resource: model.resource || model.name, action: "show", id: recordId } }) }) }),
    record && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Tooltip, { title: _24("Duplicate"), children: /* @__PURE__ */ jsx(
        Button,
        {
          size: "small",
          icon: /* @__PURE__ */ jsx(CopyOutlined, {}),
          onClick: () => duplicateRecord(false),
          loading: isDuplicating
        }
      ) }),
      /* @__PURE__ */ jsx(Tooltip, { title: _24("Duplicate with relations"), children: /* @__PURE__ */ jsx(
        Button,
        {
          size: "small",
          icon: /* @__PURE__ */ jsx(ApartmentOutlined, {}),
          onClick: () => duplicateRecord(true),
          loading: isDuplicating
        }
      ) })
    ] }),
    /* @__PURE__ */ jsx(Popover, { content: actionsSettingsContent, title: _24("Actions"), trigger: "hover", children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(SettingOutlined, {}) }) }),
    renderIconOnlyButtons(defaultButtons),
    recordId != null && /* @__PURE__ */ jsx(Tooltip, { title: _24("Delete"), children: /* @__PURE__ */ jsx("span", { children: /* @__PURE__ */ jsx(
      DeleteButton,
      {
        resource: model.resource || model.name,
        recordItemId: recordId,
        hideText: true,
        onSuccess: () => go({ to: { resource: model.resource || model.name, action: "list" } })
      }
    ) }) }),
    /* @__PURE__ */ jsx(Tooltip, { title: _24("Save"), children: /* @__PURE__ */ jsx(Button, { ...saveButtonProps, type: "primary", icon: /* @__PURE__ */ jsx(SaveFilled, {}) }) })
  ] });
  return /* @__PURE__ */ jsxs("div", { className: "jm-tone-scope", style: toneScopeStyle(modelTone), children: [
    /* @__PURE__ */ jsx(ToneSharedStyles, {}),
    /* @__PURE__ */ jsxs(
      StandardEdit,
      {
        saveButtonProps: { ...saveButtonProps, hideText: true },
        footerButtons: ({ defaultButtons }) => renderIconOnlyButtons(defaultButtons),
        title: renderWrappedPageTitle(renderModelHeading({
          model,
          title: pageTitle,
          actionLabel: _24("Edit"),
          moduleLabel: model.module ? getModuleLabel(model.module) : void 0
        })),
        headerButtons: renderHeaderButtons,
        children: [
          topContent,
          /* @__PURE__ */ jsx(Tabs, { activeKey: activeTabKey, onChange: setActiveTabKey, items: lazyItems, destroyInactiveTabPane: true })
        ]
      }
    )
  ] });
};
var _25 = window._ || ((text) => text);
var { Title: Title4 } = Typography;
function coerce(v) {
  if (v && typeof v === "object" && typeof v.valueOf === "function") return v.valueOf();
  return v;
}
function evaluateVisibilityCondition(cond, value) {
  const lhs = coerce(value);
  const rhs = cond.value;
  switch (cond.operator) {
    // eslint-disable-next-line eqeqeq
    case "eq":
      return lhs == rhs;
    // eslint-disable-next-line eqeqeq
    case "ne":
      return lhs != rhs;
    case "in":
      return Array.isArray(rhs) && rhs.includes(lhs);
    case "not_in":
      return Array.isArray(rhs) && !rhs.includes(lhs);
    case "truthy":
      return Boolean(lhs);
    case "falsy":
      return !lhs;
    case "gt":
      return lhs > rhs;
    case "lt":
      return lhs < rhs;
    case "gte":
      return lhs >= rhs;
    case "lte":
      return lhs <= rhs;
    case "ilike":
      return String(lhs ?? "").toLowerCase().includes(String(rhs ?? "").toLowerCase());
    default:
      return true;
  }
}
var VisibilityGate = ({ condition, children }) => {
  const watched = Form.useWatch(condition?.field ?? "");
  if (!condition) return /* @__PURE__ */ jsx(Fragment, { children });
  return evaluateVisibilityCondition(condition, watched) ? /* @__PURE__ */ jsx(Fragment, { children }) : null;
};
var useStandardShowTabs = (model, record, allModels, actionsState, editForm, overrideConfigRows) => {
  if (!model) return [];
  applyI18nLabelsToModel(model);
  applyI18nLabelsToModels(allModels);
  const { token } = theme.useToken();
  const { settings: viewSettings, loading: viewSettingsLoading } = useViewSettings();
  const modelTone = useModelTone(model);
  const relationViewTypeDefaults = useMemo(
    () => ({
      show: normalizeRelationViewType(viewSettings?.showViewType || "") || "totals-details",
      edit: normalizeRelationViewType(viewSettings?.editViewType || "") || "editable-table"
    }),
    [viewSettings?.showViewType, viewSettings?.editViewType]
  );
  const { rows: fetchedConfigRows, loading: showConfigLoading } = useViewConfigurations(
    overrideConfigRows ? void 0 : model.name,
    "PrimaryView"
  );
  const showConfigRows = overrideConfigRows ?? fetchedConfigRows;
  const valueBackground = isDarkColor2(token.colorBgBase || token.colorBgContainer) ? token.colorFillQuaternary : "#F9FFFF";
  const { embedded, tabbed } = splitRelations(model.relations);
  const labelStyle = {
    fontSize: token.fontSize,
    fontWeight: 400,
    color: token.colorTextSecondary,
    margin: 0,
    lineHeight: 1
  };
  const resolvedActionsState = actionsState ?? {
    showActions: DEFAULT_SHOW_RELATION_ROW_ACTIONS,
    showCreate: DEFAULT_RELATION_CREATE_ACTIONS
  };
  const configRows = filterConfigRowsForMode(showConfigRows, "show");
  const hasConfig = configRows.length > 0;
  const configuredRelationKeys = buildConfiguredRelationKeys(configRows);
  const configuredResolvedRelationKeys = buildConfiguredResolvedRelationKeys(model.relations, configRows);
  const configuredRelationDisplayKeys = buildConfiguredRelationDisplayKeys(model.relations, configRows);
  const hasConfiguredDetailRelations = configuredResolvedRelationKeys.size > 0 || configuredRelationKeys.size > 0;
  const detailsConfigRows = configRows.filter((r) => !r.tab_name);
  const customTabNames = Array.from(new Set(
    configRows.filter((r) => !!r.tab_name).map((r) => r.tab_name)
  ));
  const configSections = groupConfigRowsBySectionId(detailsConfigRows);
  const labelBackground = isDarkColor2(token.colorBgBase || token.colorBgContainer) ? "transparent" : "#ffffff";
  const showDetailsLoading = showConfigLoading || viewSettingsLoading;
  const showFormProps = editForm?.formProps;
  const showEffectiveFields = editForm?.effectiveFields || model.fields;
  const currentId = getRecordId(record, model.fields);
  const modelResource = resolveResourcePath(model.resource || model.name, allModels);
  const renderShowEditableInput = (field, forceReadOnly) => {
    const refResource = field.reference ? resolveResourcePath(field.reference, allModels) : void 0;
    const isSelfRef = refResource && modelResource && refResource === modelResource;
    return /* @__PURE__ */ jsx(
      Form.Item,
      {
        name: field.key,
        rules: field.required && !field.formula && !forceReadOnly ? [{ required: true }] : [],
        valuePropName: field.type === "boolean" ? "checked" : void 0,
        getValueProps: (val) => (field.type === "date" || field.type === "datetime") && val ? { value: dayjs7(val) } : field.type === "time" && val ? { value: dayjs7("1970-01-01T" + val) } : { value: val },
        style: { margin: 0 },
        noStyle: false,
        children: field.formula || forceReadOnly ? /* @__PURE__ */ jsx(Input, { disabled: true }) : renderInput(field, allModels, model, isSelfRef ? currentId : void 0)
      }
    );
  };
  const detailsTab = {
    key: "details",
    label: renderToneTabLabel(_25("Details"), modelTone),
    children: /* @__PURE__ */ jsxs(
      Form,
      {
        initialValues: !showFormProps ? record : void 0,
        ...showFormProps || {},
        layout: "horizontal",
        size: "small",
        style: { paddingBottom: 24 },
        children: [
          showDetailsLoading && /* @__PURE__ */ jsx(Skeleton, { active: true, paragraph: { rows: 6 } }),
          !showDetailsLoading && !hasConfig && /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 4, marginTop: 0 }, children: showEffectiveFields.filter((f) => f.key !== "eid").map((field) => /* @__PURE__ */ jsxs(
            "div",
            {
              style: {
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-start",
                gap: "4px 6px"
              },
              children: [
                /* @__PURE__ */ jsx("span", { style: { ...labelStyle, flex: "0 0 200px" }, children: field.label }),
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    style: {
                      flex: "1 0 200px",
                      padding: "2px 4px",
                      lineHeight: 1.15,
                      textAlign: field.type === "number" ? "right" : "left",
                      fontVariantNumeric: field.type === "number" ? "tabular-nums" : void 0,
                      overflowWrap: "anywhere",
                      background: valueBackground,
                      borderRadius: 6
                    },
                    children: showFormProps ? renderShowEditableInput(field) : renderFieldValue(field, record, allModels)
                  }
                )
              ]
            },
            field.key
          )) }),
          !showDetailsLoading && hasConfig && /* @__PURE__ */ jsx("div", { style: { marginTop: 0, display: "flex", flexDirection: "column", gap: 6 }, children: (() => {
            const gridRowMap = /* @__PURE__ */ new Map();
            for (const [, { name: sectionName, rows }] of configSections.entries()) {
              const gridRow = rows[0]?.section_grid_row ?? 1;
              const gridCol = rows[0]?.section_grid_col ?? 1;
              const arr = gridRowMap.get(gridRow) || [];
              arr.push({ name: sectionName, rows, gridCol });
              gridRowMap.set(gridRow, arr);
            }
            return Array.from(gridRowMap.keys()).sort((a, b) => a - b).map((gridRow) => {
              const rowSections = (gridRowMap.get(gridRow) || []).sort((a, b) => a.gridCol - b.gridCol);
              return /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 6, alignItems: "flex-start" }, children: rowSections.map(({ name: section, rows }) => {
                const normalized = normalizeSectionRows(rows);
                const maxRow = Math.max(1, ...normalized.map((row) => row.row));
                const maxCol = Math.max(1, ...normalized.map((row) => row.column));
                return /* @__PURE__ */ jsxs(
                  "div",
                  {
                    style: {
                      flex: 1,
                      minWidth: 0,
                      border: `1px solid ${token.colorBorder}`,
                      borderRadius: 8,
                      padding: "6px 6px"
                    },
                    children: [
                      /* @__PURE__ */ jsx(Title4, { level: 5, style: { margin: 0, color: "#1677ff" }, children: _25(section) }),
                      /* @__PURE__ */ jsx("table", { style: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }, children: /* @__PURE__ */ jsx("tbody", { children: Array.from({ length: maxRow }).map((_39, rowIndex) => /* @__PURE__ */ jsx("tr", { children: Array.from({ length: maxCol }).map((_40, colIndex) => {
                        const cellItems = normalized.filter(
                          (item) => item.row === rowIndex + 1 && item.column === colIndex + 1
                        );
                        return /* @__PURE__ */ jsx("td", { style: { padding: "0 4px", verticalAlign: "top", width: `${100 / maxCol}%` }, children: cellItems.map((item) => {
                          if (item.attribute_or_relation_type === "nlsentence") {
                            if (!item.nl_sentence_eid) return null;
                            return /* @__PURE__ */ jsx(
                              NLSentenceBlock,
                              {
                                eid: item.nl_sentence_eid,
                                title: item.nl_sentence_title ?? void 0,
                                showLabel: item.show_label !== false
                              },
                              `nls-${item.nl_sentence_eid}`
                            );
                          }
                          if (item.attribute_or_relation_type === "relation") {
                            if (!record || !allModels) return null;
                            const relation = resolveRelationFromConfig(model.relations, item);
                            if (!relation) return null;
                            const relationModel = findModelByName(allModels, relation.resource);
                            if (!relationModel) return null;
                            const relatedModel = relation.otherResource ? findModelByName(allModels, relation.otherResource) : void 0;
                            const relationTone = getModelTone(relatedModel || relationModel || relation.resource);
                            const relWithOverride = applyRelationViewOverride(relation, item, "show");
                            const showLabel2 = item.show_label !== false;
                            getRelationViewType(relWithOverride, "show", relationViewTypeDefaults);
                            const relationValueStyle = {
                              padding: "2px 4px",
                              lineHeight: 1.15,
                              background: valueBackground,
                              borderRadius: 6,
                              overflowWrap: "anywhere",
                              maxWidth: "100%",
                              ...parseInlineStyle(item.html_format)
                            };
                            const relationLabelStyle = {
                              ...labelStyle,
                              background: "transparent",
                              color: relationTone.text,
                              padding: "2px 8px",
                              borderRadius: 6
                            };
                            const relationLayoutStyle = {
                              display: "flex",
                              flexDirection: "column",
                              gap: 2
                            };
                            return /* @__PURE__ */ jsx("div", { style: { marginBottom: 4 }, children: renderRelationBlock({
                              rel: relWithOverride,
                              relationModel,
                              relatedModel,
                              record,
                              mode: "show",
                              parentResource: model.name,
                              allModels,
                              showActions: resolvedActionsState.showActions,
                              showCreate: resolvedActionsState.showCreate,
                              relationViewTypeDefaults,
                              showLabel: showLabel2,
                              labelStyle: relationLabelStyle,
                              valueStyle: { ...relationValueStyle, border: `1px solid ${token.colorBorder}` },
                              fieldLayoutStyle: relationLayoutStyle
                            }) }, `${item.name}-${item.row}-${item.column}`);
                          }
                          const field = resolveFieldFromConfig(model, item);
                          const showLabel = item.show_label !== false;
                          const editable = Boolean(showFormProps) && isAttributeValueEditable(item, "show");
                          const forceReadOnly = Boolean(showFormProps) && Boolean(item.read_only_in_edit);
                          const valueStyle = {
                            padding: "2px 4px",
                            lineHeight: 1.15,
                            background: valueBackground,
                            borderRadius: 6,
                            maxWidth: "100%",
                            overflowWrap: "anywhere",
                            textAlign: field.type === "number" ? "right" : "left",
                            fontVariantNumeric: field.type === "number" ? "tabular-nums" : void 0,
                            ...parseInlineStyle(item.html_format)
                          };
                          return /* @__PURE__ */ jsx(VisibilityGate, { condition: item.visibility_condition, children: /* @__PURE__ */ jsx("div", { style: { marginBottom: 4 }, children: /* @__PURE__ */ jsxs(
                            "div",
                            {
                              style: {
                                display: "flex",
                                flexDirection: "column",
                                gap: 2
                              },
                              children: [
                                showLabel && /* @__PURE__ */ jsx(
                                  "div",
                                  {
                                    style: {
                                      ...labelStyle,
                                      backgroundColor: labelBackground,
                                      padding: "2px 4px",
                                      borderRadius: 4
                                    },
                                    children: field.label
                                  }
                                ),
                                /* @__PURE__ */ jsx("div", { style: { ...valueStyle, border: `1px solid ${token.colorBorder}` }, children: editable || forceReadOnly ? renderShowEditableInput(field, forceReadOnly) : renderFieldValue(field, record, allModels) })
                              ]
                            }
                          ) }) }, `${item.name}-${item.row}-${item.column}`);
                        }) }, `cell-${section}-${rowIndex}-${colIndex}`);
                      }) }, `row-${section}-${rowIndex}`)) }) })
                    ]
                  },
                  section
                );
              }) }, `gr-${gridRow}`);
            });
          })() }),
          !showDetailsLoading && record && allModels && !hasConfiguredDetailRelations && /* @__PURE__ */ jsx("div", { style: { marginTop: 28 }, children: [...embedded, ...tabbed].filter((rel) => {
            const fallbackTab = isReverseRelation(rel) ? DETAILS_TAB_NAME : rel.relationName || rel.label;
            return getRelationTabName(rel, "show", fallbackTab) === DETAILS_TAB_NAME;
          }).map((rel) => {
            const relationModel = findModelByName(allModels, rel.resource);
            if (!relationModel) return null;
            const relatedModel = rel.otherResource ? findModelByName(allModels, rel.otherResource) : void 0;
            return renderRelationBlock({
              rel,
              relationModel,
              relatedModel,
              record,
              mode: "show",
              parentResource: model.name,
              allModels,
              showActions: resolvedActionsState.showActions,
              showCreate: resolvedActionsState.showCreate,
              relationViewTypeDefaults
            });
          }) })
        ]
      }
    )
  };
  const addTabsForNonConfiguredRelations = viewSettings?.addTabsForNonConfiguredRelations !== false;
  const relationTabGroups = /* @__PURE__ */ new Map();
  const allRelations = [...embedded, ...tabbed];
  allRelations.forEach((rel) => {
    if (!addTabsForNonConfiguredRelations && !isReverseRelation(rel)) return;
    if (hasConfiguredDetailRelations && isRelationConfiguredForDetails(rel, configuredResolvedRelationKeys, configuredRelationKeys, configuredRelationDisplayKeys)) return;
    const relationModel = findModelByName(allModels, rel.resource);
    if (!relationModel) return;
    const relatedModel = rel.otherResource ? findModelByName(allModels, rel.otherResource) : void 0;
    const fallbackTab = isReverseRelation(rel) ? DETAILS_TAB_NAME : rel.relationName || rel.label;
    const tabName = getRelationTabName(rel, "show", fallbackTab);
    const resolvedTabName = tabName === DETAILS_TAB_NAME && !isReverseRelation(rel) ? rel.relationName || rel.label || rel.resource || DETAILS_TAB_NAME : tabName;
    if (resolvedTabName === DETAILS_TAB_NAME) return;
    const tone = getModelTone(relatedModel || relationModel || rel.resource);
    const existing = relationTabGroups.get(resolvedTabName);
    const nodes = existing?.nodes || [];
    nodes.push(renderRelationBlock({
      rel,
      relationModel,
      relatedModel,
      record,
      mode: "show",
      parentResource: model.name,
      allModels,
      showActions: resolvedActionsState.showActions,
      showCreate: resolvedActionsState.showCreate,
      relationViewTypeDefaults
    }));
    relationTabGroups.set(resolvedTabName, { nodes, tone: existing?.tone || tone });
  });
  const relationTabs = Array.from(relationTabGroups.entries()).map(([tabName, group]) => ({
    key: tabName,
    label: renderToneTabLabel(getTabDisplayLabel(tabName), group.tone),
    children: /* @__PURE__ */ jsx("div", { children: group.nodes })
  }));
  const customConfigTabs = customTabNames.map((tabName) => {
    const tabRows = configRows.filter((r) => r.tab_name === tabName);
    const tabSections = groupConfigRowsBySectionId(tabRows);
    const gridRowMap = /* @__PURE__ */ new Map();
    for (const [, { name: sectionName, rows }] of tabSections.entries()) {
      const gridRow = rows[0]?.section_grid_row ?? 1;
      const gridCol = rows[0]?.section_grid_col ?? 1;
      const arr = gridRowMap.get(gridRow) || [];
      arr.push({ name: sectionName, rows, gridCol });
      gridRowMap.set(gridRow, arr);
    }
    const tabChildren = /* @__PURE__ */ jsx(Form, { initialValues: !showFormProps ? record : void 0, ...showFormProps || {}, layout: "horizontal", size: "small", style: { paddingBottom: 8 }, children: /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: Array.from(gridRowMap.keys()).sort((a, b) => a - b).map((gridRow) => {
      const rowSections = (gridRowMap.get(gridRow) || []).sort((a, b) => a.gridCol - b.gridCol);
      return /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 6, alignItems: "flex-start" }, children: rowSections.map(({ name: section, rows }) => {
        const normalized = normalizeSectionRows(rows);
        const maxRow = Math.max(1, ...normalized.map((r) => r.row));
        const maxCol = Math.max(1, ...normalized.map((r) => r.column));
        return /* @__PURE__ */ jsxs("div", { style: { flex: 1, minWidth: 0, border: `1px solid ${token.colorBorder}`, borderRadius: 8, padding: "6px 6px" }, children: [
          /* @__PURE__ */ jsx(Title4, { level: 5, style: { margin: 0, color: "#1677ff" }, children: _25(section) }),
          /* @__PURE__ */ jsx("table", { style: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }, children: /* @__PURE__ */ jsx("tbody", { children: Array.from({ length: maxRow }).map((_39, ri) => /* @__PURE__ */ jsx("tr", { children: Array.from({ length: maxCol }).map((_40, ci) => {
            const cellItems = normalized.filter((item) => item.row === ri + 1 && item.column === ci + 1);
            return /* @__PURE__ */ jsx("td", { style: { padding: "0 4px", verticalAlign: "top", width: `${100 / maxCol}%` }, children: cellItems.map((item) => {
              if (item.attribute_or_relation_type === "nlsentence") {
                if (!item.nl_sentence_eid) return null;
                return /* @__PURE__ */ jsx(
                  NLSentenceBlock,
                  {
                    eid: item.nl_sentence_eid,
                    title: item.nl_sentence_title ?? void 0,
                    showLabel: item.show_label !== false
                  },
                  `nls-${item.nl_sentence_eid}`
                );
              }
              if (item.attribute_or_relation_type === "relation") {
                if (!record || !allModels) return null;
                const relation = resolveRelationFromConfig(model.relations, item);
                if (!relation) return null;
                const relationModel = findModelByName(allModels, relation.resource);
                if (!relationModel) return null;
                const relatedModel = relation.otherResource ? findModelByName(allModels, relation.otherResource) : void 0;
                const relWithOverride = applyRelationViewOverride(relation, item, "show");
                const showLabel2 = item.show_label !== false;
                const relationTone = getModelTone(relatedModel || relationModel || relation.resource);
                return /* @__PURE__ */ jsx("div", { style: { marginBottom: 4 }, children: renderRelationBlock({
                  rel: relWithOverride,
                  relationModel,
                  relatedModel,
                  record,
                  mode: "show",
                  parentResource: model.name,
                  allModels,
                  showActions: resolvedActionsState.showActions,
                  showCreate: resolvedActionsState.showCreate,
                  relationViewTypeDefaults,
                  showLabel: showLabel2,
                  labelStyle: { ...labelStyle, color: relationTone.text, padding: "2px 8px", borderRadius: 6 },
                  valueStyle: { padding: "2px 4px", lineHeight: 1.15, background: valueBackground, borderRadius: 6, overflowWrap: "anywhere", maxWidth: "100%", border: `1px solid ${token.colorBorder}` },
                  fieldLayoutStyle: { display: "flex", flexDirection: "column", gap: 2 }
                }) }, `${item.name}-${item.row}-${item.column}`);
              }
              const field = resolveFieldFromConfig(model, item);
              const showLabel = item.show_label !== false;
              const editable = Boolean(showFormProps) && isAttributeValueEditable(item, "show");
              const forceReadOnly = Boolean(showFormProps) && Boolean(item.read_only_in_edit);
              return /* @__PURE__ */ jsx(VisibilityGate, { condition: item.visibility_condition, children: /* @__PURE__ */ jsx("div", { style: { marginBottom: 4 }, children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 2 }, children: [
                showLabel && /* @__PURE__ */ jsx("div", { style: { ...labelStyle, backgroundColor: labelBackground, padding: "2px 4px", borderRadius: 4 }, children: field.label }),
                /* @__PURE__ */ jsx("div", { style: { padding: "2px 4px", lineHeight: 1.15, background: valueBackground, borderRadius: 6, maxWidth: "100%", overflowWrap: "anywhere", border: `1px solid ${token.colorBorder}`, ...parseInlineStyle(item.html_format) }, children: editable || forceReadOnly ? renderShowEditableInput(field, forceReadOnly) : renderFieldValue(field, record, allModels) })
              ] }) }) }, `${item.name}-${item.row}-${item.column}`);
            }) }, `ct-cell-${section}-${ri}-${ci}`);
          }) }, `ct-row-${section}-${ri}`)) }) })
        ] }, section);
      }) }, `ct-gr-${gridRow}`);
    }) }) });
    return {
      key: `custom-tab::${tabName}`,
      label: renderToneTabLabel(_25(tabName), { text: token.colorText, border: token.colorBorder }),
      children: tabChildren
    };
  });
  const items = [detailsTab];
  items.push(...customConfigTabs);
  items.push(...relationTabs);
  return items;
};
var INLINE_DEFAULT_PAGE_SIZE = 10;
var INLINE_PAGE_SIZE_OPTIONS = ["10", "20", "50", "100"];
var useRelatedInlineItems = ({
  rel,
  record,
  allowedRelatedIds,
  allModels,
  page = 1,
  pageSize = INLINE_DEFAULT_PAGE_SIZE
}) => {
  const apiUrl = useApiUrl();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    const recordId = record?.eid ?? record?.id;
    if (!recordId || !rel.resource || !rel.targetKey) {
      setItems([]);
      setTotal(0);
      return;
    }
    let isMounted = true;
    const controller = new AbortController();
    const { signal } = controller;
    const fetchItems = async () => {
      setLoading(true);
      setError(null);
      try {
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const params = new URLSearchParams();
        params.set("_start", String(start));
        params.set("_end", String(end));
        params.append(rel.targetKey, String(recordId));
        const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
        const relationResponse = await authenticatedFetch(`${apiUrl}/${relationResource}?${params.toString()}`, { signal });
        if (!relationResponse.ok) {
          throw new Error(`Failed to load ${rel.label} relations`);
        }
        const relationRows = await relationResponse.json();
        if (!Array.isArray(relationRows)) {
          if (isMounted) {
            setItems([]);
            setTotal(0);
          }
          return;
        }
        const totalCountHeader = relationResponse.headers.get("x-total-count");
        const serverTotal = totalCountHeader ? parseInt(totalCountHeader, 10) : relationRows.length;
        if (isMounted) setTotal(serverTotal);
        if (rel.otherResource && rel.otherKey) {
          let relatedIds = relationRows.map((row) => row?.[rel.otherKey]).filter((value) => value !== void 0 && value !== null);
          let effectiveRelationRows = relationRows;
          if (rel.polymorphicType && relatedIds.length > 0) {
            const polyMatchingIds = await filterIdsByPolymorphicType(
              apiUrl,
              Array.from(new Set(relatedIds)),
              rel.polymorphicType,
              signal
            );
            relatedIds = relatedIds.filter((id) => polyMatchingIds.has(id));
            effectiveRelationRows = relationRows.filter((row) => polyMatchingIds.has(row?.[rel.otherKey]));
          }
          const filteredRelationRows = allowedRelatedIds ? effectiveRelationRows.filter((row) => allowedRelatedIds.has(row?.[rel.otherKey])) : effectiveRelationRows;
          const filteredRelatedIds = allowedRelatedIds ? relatedIds.filter((value) => allowedRelatedIds.has(value)) : relatedIds;
          if (filteredRelatedIds.length === 0) {
            if (isMounted) setItems([]);
            return;
          }
          const uniqueIds = Array.from(new Set(filteredRelatedIds));
          let relatedRecords = [];
          const relatedResource = rel.otherResourcePath || resolveResourcePath(rel.otherResource, allModels);
          try {
            const bulkResponse = await authenticatedFetch(`${apiUrl}/_meta/bulk-read`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ resource: relatedResource, ids: uniqueIds }),
              signal
            });
            if (bulkResponse.ok) {
              const bulkData = await bulkResponse.json();
              if (Array.isArray(bulkData?.items)) {
                relatedRecords = bulkData.items;
              }
            }
          } catch (bulkError) {
            if (bulkError instanceof DOMException && bulkError.name === "AbortError") throw bulkError;
          }
          if (relatedRecords.length === 0 && uniqueIds.length > 0 && !rel.polymorphicType) {
            const batchSize = 20;
            for (let index = 0; index < uniqueIds.length; index += batchSize) {
              const batch = uniqueIds.slice(index, index + batchSize);
              const batchResults = await Promise.all(batch.map(async (id) => {
                try {
                  const resp = await authenticatedFetch(`${apiUrl}/${relatedResource}/${id}`, { signal });
                  if (!resp.ok) {
                    console.warn(`Failed to load ${relatedResource} ${id}`);
                    return null;
                  }
                  return resp.json();
                } catch (fetchError) {
                  if (fetchError instanceof DOMException && fetchError.name === "AbortError") throw fetchError;
                  console.warn(`Failed to load ${relatedResource} ${id}`, fetchError);
                  return null;
                }
              }));
              relatedRecords.push(...batchResults.filter(Boolean));
            }
          }
          const relatedById = new Map(
            relatedRecords.map((item) => [item?.eid ?? item?.id, item])
          );
          const orderedItems = filteredRelationRows.map((relationRow) => {
            const relatedId = relationRow?.[rel.otherKey];
            const relatedRecord = relatedById.get(relatedId);
            if (!relatedRecord) return null;
            return {
              id: relatedRecord?.eid ?? relatedRecord?.id ?? relatedId,
              label: getRecordDisplayLabel(relatedRecord),
              resource: resolveModelName(rel.otherResource, allModels)
            };
          }).filter(Boolean);
          if (isMounted) setItems(orderedItems);
          return;
        }
        const directItems = relationRows.map((row) => ({
          id: row?.eid ?? row?.id,
          label: getRecordDisplayLabel(row),
          resource: resolveModelName(rel.resource, allModels)
        }));
        if (isMounted) setItems(directItems);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load related records");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchItems();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [apiUrl, record?.eid, record?.id, rel.label, rel.otherKey, rel.otherResource, rel.resource, rel.targetKey, rel.resourcePath, rel.otherResourcePath, allowedRelatedIds, allModels, page, pageSize]);
  return { items, loading, error, total };
};
var useRelatedGalleryRecords = ({
  rel,
  record,
  allowedRelatedIds,
  allModels
}) => {
  const apiUrl = useApiUrl();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    const recordId = record?.eid ?? record?.id;
    if (!recordId || !rel.resource || !rel.targetKey) {
      setRecords([]);
      return;
    }
    let isMounted = true;
    const fetchRecords = async () => {
      setLoading(true);
      setError(null);
      try {
        const pageSize = 500;
        let start = 0;
        let relationRows = [];
        while (true) {
          const params = new URLSearchParams();
          params.set("_start", String(start));
          params.set("_end", String(start + pageSize));
          params.append(rel.targetKey, String(recordId));
          const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
          const relationResponse = await authenticatedFetch(`${apiUrl}/${relationResource}?${params.toString()}`);
          if (!relationResponse.ok) {
            throw new Error(`Failed to load ${rel.label} relations`);
          }
          const pageRows = await relationResponse.json();
          if (!Array.isArray(pageRows)) break;
          relationRows = relationRows.concat(pageRows);
          if (relationRows.length >= GALLERY_RELATION_MAX_ITEMS) {
            relationRows = relationRows.slice(0, GALLERY_RELATION_MAX_ITEMS);
            break;
          }
          if (pageRows.length < pageSize) break;
          start += pageSize;
        }
        if (rel.otherResource && rel.otherKey) {
          let relatedIds = relationRows.map((row) => row?.[rel.otherKey]).filter((value) => value !== void 0 && value !== null);
          if (rel.polymorphicType && relatedIds.length > 0) {
            const polyMatchingIds = await filterIdsByPolymorphicType(
              apiUrl,
              Array.from(new Set(relatedIds)),
              rel.polymorphicType
            );
            relatedIds = relatedIds.filter((id) => polyMatchingIds.has(id));
            relationRows = relationRows.filter((row) => polyMatchingIds.has(row?.[rel.otherKey]));
          }
          const filteredRelationRows = allowedRelatedIds ? relationRows.filter((row) => allowedRelatedIds.has(row?.[rel.otherKey])) : relationRows;
          const filteredRelatedIds = allowedRelatedIds ? relatedIds.filter((value) => allowedRelatedIds.has(value)) : relatedIds;
          if (filteredRelatedIds.length === 0) {
            if (isMounted) setRecords([]);
            return;
          }
          const uniqueIds = Array.from(new Set(filteredRelatedIds));
          const relatedRecords = [];
          const batchSize = 20;
          for (let index = 0; index < uniqueIds.length; index += batchSize) {
            const batch = uniqueIds.slice(index, index + batchSize);
            const batchResults = await Promise.all(batch.map(async (id) => {
              try {
                const relatedResource = rel.otherResourcePath || resolveResourcePath(rel.otherResource, allModels);
                const relatedResponse = await authenticatedFetch(`${apiUrl}/${relatedResource}/${id}`);
                if (!relatedResponse.ok) return null;
                return relatedResponse.json();
              } catch {
                return null;
              }
            }));
            relatedRecords.push(...batchResults.filter(Boolean));
          }
          const relatedById = new Map(
            relatedRecords.map((item) => [item?.eid ?? item?.id, item])
          );
          const ordered = filteredRelationRows.map((relationRow) => {
            const relatedId = relationRow?.[rel.otherKey];
            return relatedById.get(relatedId) || null;
          }).filter(Boolean);
          if (isMounted) setRecords(ordered);
          return;
        }
        if (isMounted) setRecords(relationRows);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load related records");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchRecords();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, record?.eid, record?.id, rel.label, rel.otherKey, rel.otherResource, rel.resource, rel.targetKey, allowedRelatedIds, allModels]);
  return { records, loading, error };
};
var RelatedObjectsInlineValues = ({ rel, record, viewType, allowedRelatedIds, allModels }) => {
  const go = useGo();
  const paneNav = usePaneNavigation();
  const { token } = theme.useToken();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(INLINE_DEFAULT_PAGE_SIZE);
  const { items, loading, error, total } = useRelatedInlineItems({ rel, record, allowedRelatedIds, allModels, page, pageSize });
  const handlePageChange = useCallback((newPage, newPageSize) => {
    if (newPageSize && newPageSize !== pageSize) {
      setPageSize(newPageSize);
      setPage(1);
    } else {
      setPage(newPage);
    }
  }, [pageSize]);
  const renderItem = (item) => /* @__PURE__ */ jsx(
    "a",
    {
      href: getShowHref(item.resource, item.id, allModels),
      onClick: (e) => {
        if (!shouldHandleLinkClick(e)) return;
        e.preventDefault();
        if (item.resource && item.id !== void 0 && item.id !== null) {
          if (paneNav?.isInMultiPane) {
            paneNav.openDetail(item.resource, item.id);
          } else {
            go({ to: { resource: item.resource, action: "show", id: item.id } });
          }
        }
      },
      style: { cursor: "pointer", color: token.colorLink, textDecoration: "none" },
      children: item.label
    }
  );
  if (loading) return /* @__PURE__ */ jsx(Spin, { size: "small" });
  if (error) return /* @__PURE__ */ jsx(Alert, { type: "error", message: error, showIcon: true });
  if (!items.length && total === 0) return /* @__PURE__ */ jsx("span", { children: "-" });
  const paginationProps = total > pageSize ? {
    size: "small",
    current: page,
    pageSize,
    total,
    hideOnSinglePage: true,
    showSizeChanger: true,
    pageSizeOptions: INLINE_PAGE_SIZE_OPTIONS,
    onChange: handlePageChange,
    onShowSizeChange: handlePageChange,
    style: { marginTop: 4 }
  } : void 0;
  if (viewType === "csv") {
    return /* @__PURE__ */ jsxs("span", { children: [
      items.map((item, index) => /* @__PURE__ */ jsxs("span", { children: [
        renderItem(item),
        index < items.length - 1 ? ", " : ""
      ] }, `${item.resource}-${item.id}-${index}`)),
      paginationProps && /* @__PURE__ */ jsx(Pagination, { ...paginationProps })
    ] });
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("ul", { style: { margin: 0, paddingLeft: 16 }, children: items.map((item, index) => /* @__PURE__ */ jsx("li", { children: renderItem(item) }, `${item.resource}-${item.id}-${index}`)) }),
    paginationProps && /* @__PURE__ */ jsx(Pagination, { ...paginationProps })
  ] });
};
var _26 = window._ || ((text) => text);
var RelatedObjectsCalendar = ({ rel, record, relatedModel, allModels }) => {
  useGo();
  const { token } = theme.useToken();
  const { records, loading, error } = useRelatedGalleryRecords({ rel, record, allModels });
  const resource = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
  const dateFieldOptions = useMemo(() => getCalendarDateFieldOptions(relatedModel.fields), [relatedModel.fields]);
  const [calendarMode, setCalendarMode] = useState("month");
  const [calendarDateField, setCalendarDateField] = useState(() => dateFieldOptions[0]?.key || "");
  const [calendarAnchorDate, setCalendarAnchorDate] = useState(() => dayjs7().startOf("month"));
  const dateFieldKeySet = useMemo(() => new Set(dateFieldOptions.map((field) => field.key)), [dateFieldOptions]);
  useEffect(() => {
    if (calendarDateField && dateFieldKeySet.has(calendarDateField)) return;
    const fallback = dateFieldOptions[0]?.key || "";
    if (fallback !== calendarDateField) setCalendarDateField(fallback);
  }, [calendarDateField, dateFieldKeySet, dateFieldOptions]);
  const calendarEntries = useMemo(() => {
    if (!calendarDateField) return [];
    const entries = [];
    records.forEach((item) => {
      const recordDate = getCalendarRecordDate(item, calendarDateField);
      if (!recordDate) return;
      const id = item?.eid ?? item?.id;
      entries.push({
        key: id ?? getRecordDisplayLabel(item),
        date: recordDate,
        id,
        label: getRecordDisplayLabel(item)
      });
    });
    return entries;
  }, [calendarDateField, records]);
  const earliestDateTs = useMemo(() => {
    if (calendarEntries.length === 0) return null;
    let earliest = calendarEntries[0].date.valueOf();
    for (let index = 1; index < calendarEntries.length; index += 1) {
      const value = calendarEntries[index].date.valueOf();
      if (value < earliest) earliest = value;
    }
    return earliest;
  }, [calendarEntries]);
  const initSignatureRef = useRef("");
  useEffect(() => {
    const signature = `${calendarDateField}|${calendarMode}|${earliestDateTs ?? "none"}`;
    if (initSignatureRef.current === signature) return;
    initSignatureRef.current = signature;
    if (earliestDateTs === null) {
      setCalendarAnchorDate(dayjs7().startOf(calendarMode));
      return;
    }
    setCalendarAnchorDate(dayjs7(earliestDateTs).startOf(calendarMode));
  }, [calendarDateField, calendarMode, earliestDateTs]);
  const entriesByDate = useMemo(() => {
    const grouped = /* @__PURE__ */ new Map();
    calendarEntries.forEach((entry) => {
      const key = entry.date.format("YYYY-MM-DD");
      const existing = grouped.get(key) || [];
      existing.push(entry);
      grouped.set(key, existing);
    });
    return grouped;
  }, [calendarEntries]);
  const rangeDays = useMemo(() => {
    const current = calendarAnchorDate.startOf(calendarMode);
    if (calendarMode === "week") {
      const start2 = current.startOf("week");
      return Array.from({ length: 7 }, (_unused, offset) => start2.add(offset, "day"));
    }
    const start = current.startOf("month").startOf("week");
    const end = current.endOf("month").endOf("week");
    const totalDays = end.diff(start, "day") + 1;
    return Array.from({ length: totalDays }, (_unused, offset) => start.add(offset, "day"));
  }, [calendarAnchorDate, calendarMode]);
  const periodLabel = useMemo(() => {
    if (calendarMode === "week") {
      const weekStart = calendarAnchorDate.startOf("week");
      const weekEnd = weekStart.endOf("week");
      return `${weekStart.format("MMM D, YYYY")} - ${weekEnd.format("MMM D, YYYY")}`;
    }
    return calendarAnchorDate.startOf("month").format("MMMM YYYY");
  }, [calendarAnchorDate, calendarMode]);
  if (loading) return /* @__PURE__ */ jsx(Spin, { size: "small" });
  if (error) return /* @__PURE__ */ jsx(Alert, { type: "error", message: error, showIcon: true });
  if (dateFieldOptions.length === 0) return /* @__PURE__ */ jsx(Empty, { description: _26("No date/datetime fields available for calendar view.") });
  if (!records.length) return /* @__PURE__ */ jsx(Empty, { description: _26("No related records available.") });
  const selectedDateField = relatedModel.fields.find((field) => field.key === calendarDateField);
  const selectedLabel = selectedDateField?.label || calendarDateField;
  return /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 12 }, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }, children: [
      /* @__PURE__ */ jsxs(Space, { wrap: true, size: 8, children: [
        /* @__PURE__ */ jsx(
          Select,
          {
            size: "small",
            value: calendarMode,
            onChange: (value) => setCalendarMode(value),
            options: [
              { label: _26("Monthly"), value: "month" },
              { label: _26("Weekly"), value: "week" }
            ],
            style: { minWidth: 120 }
          }
        ),
        /* @__PURE__ */ jsx(
          Select,
          {
            size: "small",
            value: calendarDateField,
            onChange: (value) => setCalendarDateField(value),
            options: dateFieldOptions.map((field) => ({ label: field.label, value: field.key })),
            style: { minWidth: 220 },
            placeholder: _26("Date field")
          }
        )
      ] }),
      /* @__PURE__ */ jsxs(Space, { size: 8, children: [
        /* @__PURE__ */ jsx(Tooltip, { title: _26("Previous"), children: /* @__PURE__ */ jsx(
          Button,
          {
            size: "small",
            icon: /* @__PURE__ */ jsx(ArrowLeftOutlined, {}),
            "aria-label": _26("Previous"),
            onClick: () => setCalendarAnchorDate((prev) => prev.subtract(1, calendarMode).startOf(calendarMode))
          }
        ) }),
        /* @__PURE__ */ jsx(Tooltip, { title: _26("Today"), children: /* @__PURE__ */ jsx(
          Button,
          {
            size: "small",
            icon: /* @__PURE__ */ jsx(CalendarOutlined, {}),
            "aria-label": _26("Today"),
            onClick: () => setCalendarAnchorDate(dayjs7().startOf(calendarMode))
          }
        ) }),
        /* @__PURE__ */ jsx(Tooltip, { title: _26("Next"), children: /* @__PURE__ */ jsx(
          Button,
          {
            size: "small",
            icon: /* @__PURE__ */ jsx(ArrowRightOutlined, {}),
            "aria-label": _26("Next"),
            onClick: () => setCalendarAnchorDate((prev) => prev.add(1, calendarMode).startOf(calendarMode))
          }
        ) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { fontSize: 14, fontWeight: 600, color: token.colorText }, children: [
      periodLabel,
      " ",
      selectedLabel ? `- ${selectedLabel}` : ""
    ] }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
          overflow: "hidden"
        },
        children: [
          CALENDAR_WEEKDAYS.map((label) => /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                padding: "6px 8px",
                fontSize: 12,
                fontWeight: 600,
                color: token.colorTextSecondary,
                background: token.colorFillAlter,
                borderBottom: `1px solid ${token.colorBorderSecondary}`
              },
              children: label
            },
            label
          )),
          rangeDays.map((day) => {
            const dayKey = day.format("YYYY-MM-DD");
            const entries = entriesByDate.get(dayKey) || [];
            const isOutsideCurrentMonth = calendarMode === "month" && day.month() !== calendarAnchorDate.month();
            const isToday = day.isSame(dayjs7(), "day");
            return /* @__PURE__ */ jsxs(
              "div",
              {
                style: {
                  minHeight: 120,
                  padding: 8,
                  borderTop: `1px solid ${token.colorBorderSecondary}`,
                  borderRight: day.day() === 6 ? "none" : `1px solid ${token.colorBorderSecondary}`,
                  background: isOutsideCurrentMonth ? token.colorFillAlter : token.colorBgContainer,
                  opacity: isOutsideCurrentMonth ? 0.75 : 1,
                  display: "grid",
                  alignContent: "start",
                  gap: 4
                },
                children: [
                  /* @__PURE__ */ jsx(
                    "div",
                    {
                      style: {
                        fontSize: 12,
                        fontWeight: isToday ? 700 : 600,
                        color: isToday ? token.colorPrimary : token.colorTextSecondary
                      },
                      children: day.format("D")
                    }
                  ),
                  /* @__PURE__ */ jsx("div", { style: { display: "grid", gap: 2 }, children: entries.map((entry, index) => {
                    if (entry.id === void 0 || entry.id === null) {
                      return /* @__PURE__ */ jsx("div", { style: { fontSize: 12, lineHeight: 1.3 }, children: entry.label }, `${entry.key}-${index}`);
                    }
                    return /* @__PURE__ */ jsx(
                      "a",
                      {
                        href: getShowHref(resource, entry.id, allModels),
                        style: { display: "block", fontSize: 12, lineHeight: 1.3, color: token.colorLink, textDecoration: "none", wordWrap: "break-word", overflowWrap: "break-word" },
                        title: entry.label,
                        children: entry.label
                      },
                      `${entry.key}-${index}`
                    );
                  }) })
                ]
              },
              dayKey
            );
          })
        ]
      }
    )
  ] });
};
var RelatedObjectPrimaryCard = ({ record, model, allModels, customPageName }) => {
  const allModelsList = useMemo(() => allModels || [], [allModels]);
  const tone = useModelTone(model);
  const PrimaryShowRenderer = useContext(PrimaryShowContext);
  const label = getRecordDisplayLabel(record);
  const id = record?.eid ?? record?.id;
  const resource = resolveResourcePath(model.resource || model.name, allModelsList);
  const showHref = id !== void 0 && id !== null ? getShowHref(resource, id, allModelsList) : void 0;
  const viewQuery = customPageName ? `?view=${encodeURIComponent(customPageName)}` : "";
  const embeddedSrc = id !== void 0 && id !== null ? `/embedded/${resource}/show/${id}${viewQuery}` : void 0;
  const bodyContent = PrimaryShowRenderer && id !== void 0 && id !== null ? /* @__PURE__ */ jsx(PrimaryShowRenderer, { model, id, allModels: allModelsList, viewName: customPageName }) : embeddedSrc ? /* @__PURE__ */ jsx("iframe", { title: label, src: embeddedSrc, style: { width: "100%", minHeight: 480, border: "none", display: "block" } }) : null;
  return /* @__PURE__ */ jsx(
    Card,
    {
      size: "small",
      title: /* @__PURE__ */ jsxs("span", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ jsx("span", { children: label }),
        showHref && /* @__PURE__ */ jsx("a", { href: showHref, style: { fontSize: 12, color: tone.solid }, children: /* @__PURE__ */ jsx(EyeOutlined, {}) })
      ] }),
      variant: "borderless",
      style: { marginBottom: 12, boxShadow: `0 8px 20px -16px ${tone.shadow}` },
      styles: { header: { background: "transparent", color: tone.text }, body: { padding: 0 } },
      children: bodyContent
    }
  );
};
var _27 = window._ || ((text) => text);
var RelatedObjectsPrimaryView = ({ rel, record, model, allModels, customPageName }) => {
  const { records, loading, error } = useRelatedGalleryRecords({ rel, record, allModels });
  if (loading) return /* @__PURE__ */ jsx(Spin, { size: "small" });
  if (error) return /* @__PURE__ */ jsx(Alert, { type: "error", message: error, showIcon: true });
  if (!records.length) return /* @__PURE__ */ jsx(Empty, { description: _27("No related objects.") });
  return /* @__PURE__ */ jsx("div", { style: { display: "grid", gap: 8 }, children: records.map((item) => {
    const id = item?.eid ?? item?.id;
    return /* @__PURE__ */ jsx(
      RelatedObjectPrimaryCard,
      {
        record: item,
        model,
        allModels,
        customPageName
      },
      id ?? getRecordDisplayLabel(item)
    );
  }) });
};
var _28 = window._ || ((text) => text);
var RelatedObjectsGallery = ({ rel, record, relatedModel, allModels }) => {
  const apiUrl = useApiUrl();
  const go = useGo();
  const paneNav = usePaneNavigation();
  const { token } = theme.useToken();
  const { settings: viewSettings } = useViewSettings();
  const { records, loading, error } = useRelatedGalleryRecords({ rel, record, allModels });
  const resource = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
  const imageWidth = viewSettings?.galleryImageWidth ?? 180;
  const imageHeight = viewSettings?.galleryImageHeight ?? 140;
  if (loading) return /* @__PURE__ */ jsx(Spin, { size: "small" });
  if (error) return /* @__PURE__ */ jsx(Alert, { type: "error", message: error, showIcon: true });
  if (!records.length) return /* @__PURE__ */ jsxs("div", { style: { display: "inline-flex", alignItems: "center", gap: 6, color: "#bfbfbf", fontSize: 12 }, children: [
    /* @__PURE__ */ jsx(FileTextOutlined, { style: { fontSize: 16 } }),
    _28("No images available")
  ] });
  return /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 16 }, children: records.map((item) => {
    const id = getGalleryItemId(item);
    const label = getGalleryItemLabel(item, id);
    return renderSharedGalleryCard({
      item,
      itemId: id,
      label,
      apiUrl,
      imageWidth,
      imageHeight,
      borderColor: token.colorBorder,
      textColor: token.colorText,
      onClick: id !== void 0 && id !== null ? () => {
        if (paneNav?.isInMultiPane) {
          paneNav.openDetail(resource, id);
        } else {
          go({ to: { resource, action: "show", id } });
        }
      } : void 0
    });
  }) });
};
var _29 = window._ || ((text) => text);
var RelatedObjectsEditableList = ({ rel, record, allModels }) => {
  const go = useGo();
  const paneNav = usePaneNavigation();
  const navigate = useNavigate();
  const location = useLocation();
  const apiUrl = useApiUrl();
  const { token } = theme.useToken();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(INLINE_DEFAULT_PAGE_SIZE);
  const { items: fetchedItems, loading, error, total } = useRelatedInlineItems({ rel, record, allModels, page, pageSize });
  const [localItems, setLocalItems] = useState(null);
  useEffect(() => {
    setLocalItems(null);
  }, [fetchedItems]);
  const items = localItems ?? fetchedItems;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allOptions, setAllOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(/* @__PURE__ */ new Set());
  const [baselineIds, setBaselineIds] = useState(/* @__PURE__ */ new Set());
  const [searchText, setSearchText] = useState("");
  useEffect(() => {
    if (!editing) return;
    const snapshot = new Set(items.map((item) => Number(item.id)));
    setBaselineIds(snapshot);
    setSelectedIds(new Set(snapshot));
    let cancelled = false;
    const fetchAllOptions = async () => {
      if (!rel.otherResource) return;
      setOptionsLoading(true);
      try {
        const resource = rel.otherResourcePath || resolveResourcePath(rel.otherResource, allModels);
        const params = new URLSearchParams();
        params.set("_start", "0");
        params.set("_end", "50000");
        const response = await authenticatedFetch(`${apiUrl}/${resource}?${params.toString()}`);
        if (!response.ok) throw new Error(`Failed to load options`);
        const data = await response.json();
        if (!cancelled && Array.isArray(data)) {
          setAllOptions(data.map((item) => ({
            id: item.eid ?? item.id,
            label: getRecordDisplayLabel(item)
          })));
        }
      } catch (err) {
        console.warn("Failed to load options for editable-list", err);
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    };
    fetchAllOptions();
    return () => {
      cancelled = true;
    };
  }, [editing]);
  const handleSave = useCallback(async () => {
    if (!rel.otherKey || !rel.targetKey) return;
    const recordId = record?.eid ?? record?.id;
    if (recordId === void 0 || recordId === null) return;
    setSaving(true);
    const errors = [];
    const successfulAdds = /* @__PURE__ */ new Set();
    const successfulRemoves = /* @__PURE__ */ new Set();
    try {
      const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
      const toAdd = [...selectedIds].filter((id) => !baselineIds.has(id));
      const toRemove = [...baselineIds].filter((id) => !selectedIds.has(id));
      for (const id of toRemove) {
        const deleteId = rel.targetKey === "eid_from" ? `${recordId}:${id}` : `${id}:${recordId}`;
        const resp = await authenticatedFetch(`${apiUrl}/${relationResource}/${encodeURIComponent(deleteId)}`, { method: "DELETE" });
        if (!resp.ok) {
          let detail = `Failed to remove relation (${resp.status})`;
          try {
            const body = await resp.json();
            if (body?.detail) detail = String(body.detail);
          } catch {
          }
          errors.push(detail);
        } else {
          successfulRemoves.add(id);
        }
      }
      for (const id of toAdd) {
        const payload = { [rel.targetKey]: recordId, [rel.otherKey]: id };
        const resp = await authenticatedFetch(`${apiUrl}/${relationResource}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          let detail = `Failed to add relation (${resp.status})`;
          try {
            const body = await resp.json();
            if (body?.detail) {
              const d = String(body.detail);
              if (d.toLowerCase().includes("unique") || d.toLowerCase().includes("duplicate")) {
                const optLabel = allOptions.find((o) => o.id === id)?.label ?? String(id);
                detail = `"${optLabel}" ${_29("is already linked to another record and cannot be added here.")}`;
              } else {
                detail = d;
              }
            }
          } catch {
          }
          errors.push(detail);
        } else {
          successfulAdds.add(id);
        }
      }
      const newBaseline = new Set(baselineIds);
      for (const id of successfulRemoves) newBaseline.delete(id);
      for (const id of successfulAdds) newBaseline.add(id);
      setBaselineIds(newBaseline);
      setSelectedIds(new Set(newBaseline));
      if (errors.length > 0) {
        message.error(errors[0], 6);
        if (errors.length > 1) message.warning(`${errors.length - 1} ${_29("other error(s) occurred.")}`, 4);
      } else {
        message.success(_29("Changes saved."));
        setEditing(false);
        setSearchText("");
      }
      const otherResource = resolveModelName(rel.otherResource, allModels);
      const newItems = allOptions.filter((opt) => newBaseline.has(opt.id)).map((opt) => ({ id: opt.id, label: opt.label, resource: otherResource }));
      setLocalItems(newItems);
    } catch (err) {
      message.error(err instanceof Error ? err.message : _29("Failed to save changes."));
    } finally {
      setSaving(false);
    }
  }, [apiUrl, allModels, allOptions, rel, record, selectedIds, baselineIds]);
  const handleCancel = useCallback(() => {
    setEditing(false);
    setSelectedIds(new Set(baselineIds));
    setSearchText("");
  }, [baselineIds]);
  const handleCreateNewAndRelate = useCallback(() => {
    const otherKey = rel.otherKey;
    if (!otherKey || !rel.targetKey) return;
    const recordId = record?.eid ?? record?.id;
    if (recordId === void 0 || recordId === null) return;
    const params = new URLSearchParams();
    const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
    const relatedModel = findModelByName(allModels, rel.otherResource || rel.otherResourcePath);
    const relatedResource = relatedModel ? resolveResourcePath(relatedModel.resource || relatedModel.name, allModels) : null;
    if (!relatedResource) {
      message.warning(_29("No create route for the related model. Opening relation create form."));
      params.append(rel.targetKey, String(recordId));
      const returnTo2 = `${location.pathname}${location.search}${location.hash}`;
      if (returnTo2.startsWith("/")) params.append("returnTo", returnTo2);
      navigate(`/${relationResource}/create?${params.toString()}`);
      return;
    }
    params.append("relate_resource", relationResource);
    params.append("relate_target_key", rel.targetKey);
    params.append("relate_other_key", otherKey);
    params.append("relate_target_id", String(recordId));
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    if (returnTo.startsWith("/")) params.append("returnTo", returnTo);
    navigate(`/${relatedResource}/create?${params.toString()}`);
  }, [rel, record, allModels, location, navigate]);
  if (loading) return /* @__PURE__ */ jsx(Spin, { size: "small" });
  if (error) return /* @__PURE__ */ jsx(Alert, { type: "error", message: error, showIcon: true });
  if (!editing) {
    return /* @__PURE__ */ jsxs("div", { style: { minHeight: 22 }, children: [
      /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 4 }, children: /* @__PURE__ */ jsx(Tooltip, { title: _29("Edit"), children: /* @__PURE__ */ jsx(Button, { size: "small", type: "text", icon: /* @__PURE__ */ jsx(EditOutlined, {}), onClick: () => setEditing(true) }) }) }),
      items.length === 0 && total === 0 ? /* @__PURE__ */ jsx("span", { style: { color: token.colorTextSecondary, fontStyle: "italic" }, children: "\u2014" }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("ul", { style: { margin: 0, paddingLeft: 16 }, children: items.map((item, index) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(
          "a",
          {
            href: getShowHref(item.resource, item.id, allModels),
            onClick: (e) => {
              if (!shouldHandleLinkClick(e)) return;
              e.preventDefault();
              if (item.resource && item.id !== void 0 && item.id !== null) {
                if (paneNav?.isInMultiPane) {
                  paneNav.openDetail(item.resource, item.id);
                } else {
                  go({ to: { resource: item.resource, action: "show", id: item.id } });
                }
              }
            },
            style: { cursor: "pointer", color: token.colorLink, textDecoration: "none" },
            children: item.label
          }
        ) }, `${item.resource}-${item.id}-${index}`)) }),
        total > pageSize && /* @__PURE__ */ jsx(
          Pagination,
          {
            size: "small",
            current: page,
            pageSize,
            total,
            ...{ hideOnSinglePage: true },
            showSizeChanger: true,
            pageSizeOptions: INLINE_PAGE_SIZE_OPTIONS,
            onChange: (p, newPageSize) => {
              if (newPageSize && newPageSize !== pageSize) {
                setPageSize(newPageSize);
                setPage(1);
              } else {
                setPage(p);
              }
            },
            onShowSizeChange: (_39, newPageSize) => {
              setPageSize(newPageSize);
              setPage(1);
            },
            style: { marginTop: 4 }
          }
        )
      ] })
    ] });
  }
  const hasChanges = (() => {
    if (selectedIds.size !== baselineIds.size) return true;
    for (const id of selectedIds) {
      if (!baselineIds.has(id)) return true;
    }
    return false;
  })();
  const filteredOptions = allOptions.filter(
    (opt) => !searchText || opt.label.toLowerCase().includes(searchText.toLowerCase())
  );
  const sortedOptions = [...filteredOptions].sort((a, b) => {
    const aSelected = selectedIds.has(a.id) ? 0 : 1;
    const bSelected = selectedIds.has(b.id) ? 0 : 1;
    if (aSelected !== bSelected) return aSelected - bSelected;
    return a.label.localeCompare(b.label);
  });
  return /* @__PURE__ */ jsxs("div", { style: { border: `1px solid ${token.colorBorder}`, borderRadius: 6, padding: 8, background: token.colorBgContainer }, children: [
    /* @__PURE__ */ jsxs("div", { style: { marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }, children: [
      /* @__PURE__ */ jsx(
        Input,
        {
          prefix: /* @__PURE__ */ jsx(SearchOutlined, { style: { color: token.colorTextSecondary } }),
          placeholder: _29("Search..."),
          value: searchText,
          onChange: (e) => setSearchText(e.target.value),
          allowClear: true,
          size: "small",
          style: { flex: 1 }
        }
      ),
      rel.otherResource && rel.otherKey && rel.targetKey && /* @__PURE__ */ jsx(Tooltip, { title: _29("Create new and relate"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(ShareAltOutlined, {}), onClick: handleCreateNewAndRelate }) })
    ] }),
    /* @__PURE__ */ jsx("div", { style: { maxHeight: 280, overflowY: "auto", marginBottom: 8 }, children: optionsLoading ? /* @__PURE__ */ jsx("div", { style: { textAlign: "center", padding: 16 }, children: /* @__PURE__ */ jsx(Spin, { size: "small" }) }) : sortedOptions.length === 0 ? /* @__PURE__ */ jsx(Empty, { image: Empty.PRESENTED_IMAGE_SIMPLE, description: _29("No options") }) : sortedOptions.map((opt) => {
      const checked = selectedIds.has(opt.id);
      return /* @__PURE__ */ jsxs(
        "div",
        {
          onClick: () => {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (next.has(opt.id)) next.delete(opt.id);
              else next.add(opt.id);
              return next;
            });
          },
          style: {
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 8px",
            cursor: "pointer",
            borderRadius: 4,
            background: checked ? token.colorPrimaryBg : "transparent"
          },
          onMouseEnter: (e) => {
            e.currentTarget.style.background = checked ? token.colorPrimaryBgHover : token.colorFillSecondary;
          },
          onMouseLeave: (e) => {
            e.currentTarget.style.background = checked ? token.colorPrimaryBg : "transparent";
          },
          children: [
            /* @__PURE__ */ jsx(Checkbox, { checked }),
            /* @__PURE__ */ jsx("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: opt.label })
          ]
        },
        opt.id
      );
    }) }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8, borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 8 }, children: [
      /* @__PURE__ */ jsx(Button, { size: "small", onClick: handleCancel, children: _29("Cancel") }),
      /* @__PURE__ */ jsx(Button, { size: "small", type: "primary", icon: /* @__PURE__ */ jsx(SaveOutlined, {}), onClick: handleSave, loading: saving, disabled: !hasChanges, children: _29("Save") })
    ] })
  ] });
};
var _30 = window._ || ((text) => text);
var { Title: Title5 } = Typography;
var PolymorphicRelatedObjectsTable = ({ rel, record, relationModel, parentModel, allModels, showActions = false, showCreate = false, allowInlineEdit = false, layoutPreferenceType, viewVariant = "default" }) => {
  const recordId = record?.[parentModel?.pkField ?? "eid"] ?? record?.eid ?? record?.id;
  const apiUrl = useApiUrl();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [groupedIds, setGroupedIds] = useState(/* @__PURE__ */ new Map());
  const [unresolvedIds, setUnresolvedIds] = useState([]);
  const polyInfo = useMemo(
    () => getPolymorphicReferenceInfo(rel, relationModel, allModels),
    [rel.otherKey, rel.otherResource, relationModel, allModels]
  );
  useEffect(() => {
    if (!recordId || !rel.otherKey || !polyInfo) {
      setGroupedIds(/* @__PURE__ */ new Map());
      setUnresolvedIds([]);
      return;
    }
    let isMounted = true;
    const fetchGroups = async () => {
      setLoading(true);
      setError(null);
      try {
        const { groups, unresolved } = await fetchPolymorphicGroups({
          apiUrl,
          rel,
          recordId,
          referenceResource: polyInfo.referenceResource,
          allModels
        });
        if (isMounted) {
          setGroupedIds(groups);
          setUnresolvedIds(unresolved);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load related records");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchGroups();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, recordId, rel.label, rel.otherKey, rel.resource, rel.targetKey, allModels, polyInfo?.referenceResource]);
  if (!polyInfo) return null;
  const fallbackModel = rel.polymorphicType ? resolveModelByEntityType(allModels, rel.polymorphicType) : void 0;
  const hasGroups = groupedIds.size > 0;
  return /* @__PURE__ */ jsxs("div", { children: [
    loading && /* @__PURE__ */ jsx(Spin, { size: "small" }),
    error && /* @__PURE__ */ jsx(Alert, { type: "error", message: error, showIcon: true, style: { marginBottom: 12 } }),
    !loading && !error && !hasGroups && fallbackModel && /* @__PURE__ */ jsx(
      RelatedObjectsTable,
      {
        rel: { ...rel, otherResource: fallbackModel.name, label: `${rel.label} (${fallbackModel.label})` },
        record,
        relatedModel: fallbackModel,
        showActions,
        showCreate,
        allowInlineEdit,
        layoutPreferenceType,
        viewVariant,
        allowedRelatedIds: /* @__PURE__ */ new Set(),
        allModels
      }
    ),
    Array.from(groupedIds.entries()).map(([resourceName, idSet]) => {
      const targetModel = findModelByName(allModels, resourceName);
      if (!targetModel) return null;
      const relForType = {
        ...rel,
        otherResource: resourceName,
        label: `${rel.label} (${targetModel.label})`
      };
      return /* @__PURE__ */ jsx(
        RelatedObjectsTable,
        {
          rel: relForType,
          record,
          relatedModel: targetModel,
          showActions,
          showCreate,
          allowInlineEdit,
          layoutPreferenceType,
          viewVariant,
          allowedRelatedIds: idSet,
          allModels
        },
        `${rel.relationName || rel.resource}-${resourceName}`
      );
    }),
    unresolvedIds.length > 0 && /* @__PURE__ */ jsx(
      Alert,
      {
        type: "warning",
        message: `${unresolvedIds.length} related records could not be resolved to a model type.`,
        showIcon: true,
        style: { marginTop: 12 }
      }
    )
  ] });
};
var RelatedObjectsTable = ({ rel, record, relatedModel, parentModel, showActions = false, showCreate = false, title, allowInlineEdit = false, allowedRelatedIds, allModels, layoutPreferenceType, viewVariant = "default" }) => {
  const recordId = record?.[parentModel?.pkField ?? "eid"] ?? record?.eid ?? record?.id;
  const apiUrl = useApiUrl();
  const go = useGo();
  const paneNav = usePaneNavigation();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();
  const relatedModelTone = useModelTone(relatedModel);
  const relatedResourcePath = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
  const valueBackground = isDarkColor2(token.colorBgBase || token.colorBgContainer) ? token.colorFillQuaternary : "#F9FFFF";
  const statsLabelStyle = {
    background: valueBackground,
    borderRadius: 4,
    padding: "2px 6px",
    display: "inline-block"
  };
  const statsHeaderStyle = {
    background: valueBackground
  };
  const statsTitleStyle = {
    color: relatedModelTone.solid,
    margin: 0
  };
  const chartSvgRef = useRef(null);
  const skipNextAnimationRef = useRef(false);
  const [rows, setRows] = useState([]);
  const [localSearch, setLocalSearch] = useState("");
  const [filterRules, setFilterRules] = useState([]);
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);
  const [columnsSelectorOpen, setColumnsSelectorOpen] = useState(false);
  const [selectedColumnKeys, setSelectedColumnKeys] = useState(null);
  const [columnOrder, setColumnOrder] = useState(null);
  const [totalsSummaryFunctions, setTotalsSummaryFunctions] = useState({});
  const [columnFiltersSelected, setColumnFiltersSelected] = useState({});
  const [columnSort, setColumnSort] = useState([]);
  const [currentViewName, setCurrentViewName] = useState(getDefaultViewName());
  const [selectedViewNames, setSelectedViewNames] = useState([]);
  const [availableViewNames, setAvailableViewNames] = useState([]);
  const [viewNamesLoaded, setViewNamesLoaded] = useState(false);
  const [isLoadingViewNames, setIsLoadingViewNames] = useState(false);
  const [saveViewModalOpen, setSaveViewModalOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState(getDefaultViewName());
  const [saveViewAsNew, setSaveViewAsNew] = useState(false);
  const [pendingSaveTarget, setPendingSaveTarget] = useState(null);
  const [renameViewModalOpen, setRenameViewModalOpen] = useState(false);
  const [renameViewName, setRenameViewName] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [serverTotalRows, setServerTotalRows] = useState(0);
  const [fullDataLoaded, setFullDataLoaded] = useState(false);
  const [relationRowsCapped, setRelationRowsCapped] = useState(false);
  const [loadedRowsCount, setLoadedRowsCount] = useState(0);
  const [loadAllRelatedRequested, setLoadAllRelatedRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [listVisible, setListVisible] = useState(true);
  const [isAnalyzeVertical, setIsAnalyzeVertical] = useState(false);
  const [isAnalyzeFirst, setIsAnalyzeFirst] = useState(false);
  const [labelCache, setLabelCache] = useState({});
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const analyzeTouchedRef = useRef(false);
  const analyzePrefsTouchedRef = useRef(false);
  const analyzePrefsLoadedRef = useRef(false);
  const [analyzePrefsReady, setAnalyzePrefsReady] = useState(false);
  const analyzePrefsResourceRef = useRef(null);
  const [categoryField1, setCategoryField1] = useState(null);
  const [categoryField2, setCategoryField2] = useState(void 0);
  const [chartType, setChartType] = useState("area");
  const [summaryFn, setSummaryFn] = useState("sum");
  const [selectedSeriesKeys, setSelectedSeriesKeys] = useState(null);
  const [rankingMode, setRankingMode] = useState("none");
  const [rankingFieldKey, setRankingFieldKey] = useState(null);
  const [rankingN, setRankingN] = useState(10);
  const [exportRequested, setExportRequested] = useState(false);
  const [isStatsFlipped, setIsStatsFlipped] = useState(false);
  const [isSavingAnalyzePrefs, setIsSavingAnalyzePrefs] = useState(false);
  const [chartAnimationKey, setChartAnimationKey] = useState(0);
  const [chartAnimationStage, setChartAnimationStage] = useState("enter");
  const [isTotalsDetailsFlipped, setIsTotalsDetailsFlipped] = useState(false);
  const defaultDisplayFields = useMemo(() => getListViewFields(relatedModel), [relatedModel]);
  const orderedColumnKeys = useMemo(() => {
    if (!selectedColumnKeys || selectedColumnKeys.length === 0) return null;
    const order = columnOrder && columnOrder.length > 0 ? columnOrder : selectedColumnKeys;
    const selectedSet = new Set(selectedColumnKeys);
    const availableKeys = new Set(relatedModel.fields.map((field) => field.key));
    return order.filter((key) => selectedSet.has(key) && availableKeys.has(key));
  }, [columnOrder, relatedModel.fields, selectedColumnKeys]);
  const displayFields = useMemo(() => {
    if (!orderedColumnKeys) return defaultDisplayFields;
    const fieldMap = new Map(relatedModel.fields.map((field) => [field.key, field]));
    return orderedColumnKeys.map((key) => fieldMap.get(key)).filter((field) => Boolean(field));
  }, [defaultDisplayFields, orderedColumnKeys, relatedModel.fields]);
  const numericBarColor = relatedModelTone.soft || token.colorPrimaryBg || "rgba(22, 119, 255, 0.16)";
  const [form] = Form.useForm();
  const [savingAll, setSavingAll] = useState(false);
  const [hasPendingEdits, setHasPendingEdits] = useState(false);
  const { setWarnWhen } = useWarnAboutChange();
  const [isSavingLayoutPrefs, setIsSavingLayoutPrefs] = useState(false);
  const layoutPrefsTouchedRef = useRef(false);
  const layoutPrefsLoadedRef = useRef(false);
  const layoutPrefsResourceRef = useRef(null);
  const sortIntentRef = useRef(null);
  const { settings: viewSettings } = useViewSettings();
  const relationsMaxRowsToLoad = Math.max(0, Number(viewSettings?.relationsMaxRowsToLoad ?? 1e3));
  const markAnalyzePrefsTouched = useCallback(() => {
    analyzePrefsTouchedRef.current = true;
  }, []);
  const markLayoutPrefsTouched = useCallback(() => {
    layoutPrefsTouchedRef.current = true;
  }, []);
  const persistLayoutPreferences = useCallback(async (viewName) => {
    if (!layoutPreferenceType) return;
    const resourceKey = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
    const resolvedViewName = normalizeViewName(viewName);
    const preferences = {
      listVisible,
      analyzeOpen,
      isAnalyzeVertical,
      isAnalyzeFirst,
      filtersCollapsed,
      filters: filterRules,
      rowsPerPage: pageSize,
      tableColumns: selectedColumnKeys && selectedColumnKeys.length > 0 ? {
        selectedKeys: selectedColumnKeys,
        order: columnOrder && columnOrder.length > 0 ? columnOrder : selectedColumnKeys
      } : null,
      totalsSummaryFunctions,
      columnFilters: columnFiltersSelected,
      columnSort: columnSort.length > 0 ? columnSort : null,
      custom_view_name: resolvedViewName
    };
    setIsSavingLayoutPrefs(true);
    try {
      const targetTypes = layoutPreferenceType === "ShowLayout" ? ["ShowLayout", "EditLayout"] : layoutPreferenceType === "EditLayout" ? ["EditLayout", "ShowLayout"] : [layoutPreferenceType];
      const responses = await Promise.all(
        targetTypes.map(
          (type) => authenticatedFetch(`${apiUrl}/views/preferences`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resource: resourceKey, preferenceType: type, preferences })
          })
        )
      );
      const failed = responses.find((response) => !response.ok);
      if (failed) {
        throw new Error(`Save failed (${failed.status})`);
      }
      message.success(_30("Layout preferences saved."));
    } catch (error2) {
      message.error(error2 instanceof Error ? error2.message : _30("Failed to save layout preferences."));
    } finally {
      setIsSavingLayoutPrefs(false);
    }
  }, [apiUrl, analyzeOpen, columnFiltersSelected, columnOrder, columnSort, filtersCollapsed, filterRules, isAnalyzeFirst, isAnalyzeVertical, layoutPreferenceType, listVisible, pageSize, selectedColumnKeys, relatedModel.name, relatedModel.resource, totalsSummaryFunctions, allModels]);
  const persistAnalyzePreferences = useCallback(async (viewName) => {
    const resourceKey = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
    const resolvedViewName = normalizeViewName(viewName);
    const preferences = {
      categoryField1,
      categoryField2: categoryField2 ?? null,
      chartType,
      summaryFn,
      selectedSeriesKeys: selectedSeriesKeys ?? [],
      rankingMode,
      rankingFieldKey,
      rankingN,
      custom_view_name: resolvedViewName
    };
    setIsSavingAnalyzePrefs(true);
    try {
      const response = await authenticatedFetch(`${apiUrl}/views/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: resourceKey, preferenceType: "Analyze", preferences })
      });
      if (!response.ok) {
        throw new Error(`Save failed (${response.status})`);
      }
      message.success(_30("Analyze preferences saved."));
    } catch (error2) {
      message.error(error2 instanceof Error ? error2.message : _30("Failed to save analyze preferences."));
    } finally {
      setIsSavingAnalyzePrefs(false);
    }
  }, [apiUrl, categoryField1, categoryField2, chartType, selectedSeriesKeys, summaryFn, rankingMode, rankingFieldKey, rankingN, relatedModel.name, relatedModel.resource, allModels]);
  const categoricalFields = useMemo(() => {
    return relatedModel.fields.filter((field) => field.key === "eid" || (field.type !== "number" || field.reference));
  }, [relatedModel.fields]);
  const numericFields = useMemo(() => {
    return relatedModel.fields.filter((field) => field.key !== "eid" && field.type === "number" && !field.reference);
  }, [relatedModel.fields]);
  const resetLayoutDefaults = useCallback(() => {
    setListVisible(true);
    setAnalyzeOpen(false);
    setIsAnalyzeVertical(false);
    setIsAnalyzeFirst(false);
    setFiltersCollapsed(true);
    setPageSize(10);
    setSelectedColumnKeys(null);
    setColumnOrder(null);
  }, []);
  const resetAnalyzeDefaults = useCallback(() => {
    setCategoryField1(categoricalFields[0]?.key ?? null);
    setCategoryField2(categoricalFields.length > 1 ? categoricalFields[1].key : null);
    setChartType("area");
    setSummaryFn("sum");
    setSelectedSeriesKeys(null);
    setRankingMode("none");
    setRankingFieldKey(numericFields[0]?.key ?? null);
    setRankingN(10);
  }, [categoricalFields, numericFields]);
  const persistCurrentViewNames = useCallback(async (nextSelected, nextCurrent) => {
    try {
      const resourceKey = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
      await authenticatedFetch(`${apiUrl}/views/preferences/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: resourceKey,
          action: "set_current",
          view_name: nextCurrent,
          view_names: nextSelected
        })
      });
    } catch {
    }
  }, [apiUrl, relatedModel.name, relatedModel.resource, allModels]);
  const loadViewNames = useCallback(async () => {
    const resourceKey = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
    setIsLoadingViewNames(true);
    try {
      const response = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=__all__`);
      if (!response.ok) {
        throw new Error(`Load failed (${response.status})`);
      }
      const data = await response.json();
      const prefs = data?.preferences;
      let viewNames = [];
      let nextCurrent = getDefaultViewName();
      let nextSelected = [];
      if (prefs && typeof prefs === "object") {
        if (prefs.views && typeof prefs.views === "object") {
          viewNames = Object.keys(prefs.views || {});
          const rawSelected = Array.isArray(prefs.current_view_names) ? prefs.current_view_names : [];
          const normalizedSelected = rawSelected.map((name) => normalizeViewName(name)).filter((name) => viewNames.includes(name));
          nextCurrent = normalizeViewName(prefs.current_view_name || normalizedSelected[0]);
          nextSelected = normalizedSelected;
        }
      }
      if (viewNames.length === 0) {
        viewNames = [getDefaultViewName()];
      }
      if (!viewNames.includes(nextCurrent)) {
        nextCurrent = viewNames[0];
      }
      if (nextSelected.length === 0) {
        nextSelected = [nextCurrent];
      }
      setAvailableViewNames(viewNames);
      setCurrentViewName(nextCurrent);
      setSaveViewName(nextCurrent);
      setSelectedViewNames(nextSelected);
      setViewNamesLoaded(true);
    } catch {
      setAvailableViewNames([getDefaultViewName()]);
      setCurrentViewName(getDefaultViewName());
      setSelectedViewNames([getDefaultViewName()]);
    } finally {
      setViewNamesLoaded(true);
      setIsLoadingViewNames(false);
    }
  }, [apiUrl, relatedModel.name, relatedModel.resource, allModels]);
  const openSaveViewModalFor = useCallback((target) => {
    setSaveViewName(currentViewName || getDefaultViewName());
    setSaveViewAsNew(false);
    setPendingSaveTarget(target);
    setSaveViewModalOpen(true);
  }, [currentViewName]);
  const handleConfirmSaveView = useCallback(async () => {
    if (!pendingSaveTarget) return;
    const viewName = normalizeViewName(saveViewName || currentViewName);
    const viewExists = availableViewNames.includes(viewName);
    if (saveViewAsNew && viewExists) {
      message.error(_30("View name already exists. Choose a new name."));
      return;
    }
    if (!saveViewAsNew && viewName !== currentViewName && viewExists) {
      message.error(_30('Choose a new name or enable "Save as new view".'));
      return;
    }
    setSaveViewModalOpen(false);
    setPendingSaveTarget(null);
    setSaveViewAsNew(false);
    if (pendingSaveTarget === "layout") {
      await persistLayoutPreferences(viewName);
    } else {
      await persistAnalyzePreferences(viewName);
    }
    setCurrentViewName(viewName);
    setSaveViewName(viewName);
    const nextSelected = selectedViewNames.includes(viewName) ? selectedViewNames : [...selectedViewNames, viewName];
    setSelectedViewNames(nextSelected);
    await persistCurrentViewNames(nextSelected, viewName);
    await loadViewNames();
  }, [availableViewNames, currentViewName, loadViewNames, pendingSaveTarget, persistAnalyzePreferences, persistCurrentViewNames, persistLayoutPreferences, saveViewAsNew, saveViewName, selectedViewNames]);
  const handleChangeViewName = useCallback(async (nextView) => {
    const resolvedName = normalizeViewName(nextView);
    setCurrentViewName(resolvedName);
    setSaveViewName(resolvedName);
    const nextSelected = selectedViewNames.length > 0 ? selectedViewNames : [resolvedName];
    await persistCurrentViewNames(nextSelected, resolvedName);
  }, [persistCurrentViewNames, selectedViewNames]);
  const updateSelectedViewNames = useCallback(async (nextSelected) => {
    if (nextSelected.length === 0) {
      nextSelected = [getDefaultViewName()];
    }
    setSelectedViewNames(nextSelected);
    const nextCurrent = nextSelected.includes(currentViewName) ? currentViewName : nextSelected[0];
    if (nextCurrent !== currentViewName) {
      setCurrentViewName(nextCurrent);
      setSaveViewName(nextCurrent);
    }
    await persistCurrentViewNames(nextSelected, nextCurrent);
  }, [currentViewName, persistCurrentViewNames]);
  const moveSelectedView = useCallback((name, direction) => {
    setSelectedViewNames((prev) => {
      const idx = prev.indexOf(name);
      if (idx < 0) return prev;
      const next = [...prev];
      const targetIndex = direction === "up" ? idx - 1 : idx + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[idx], next[targetIndex]] = [next[targetIndex], next[idx]];
      persistCurrentViewNames(next, currentViewName);
      return next;
    });
  }, [currentViewName, persistCurrentViewNames]);
  const handleRenameView = useCallback(async () => {
    const newName = normalizeViewName(renameViewName);
    if (!newName || newName === currentViewName) {
      setRenameViewModalOpen(false);
      return;
    }
    if (availableViewNames.includes(newName)) {
      message.error(_30("View name already exists."));
      return;
    }
    try {
      const resourceKey = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
      const response = await authenticatedFetch(`${apiUrl}/views/preferences/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: resourceKey, action: "rename", view_name: currentViewName, new_name: newName })
      });
      if (!response.ok) {
        throw new Error(`Rename failed (${response.status})`);
      }
      message.success(_30("View renamed."));
      setRenameViewModalOpen(false);
      await loadViewNames();
    } catch (error2) {
      message.error(error2 instanceof Error ? error2.message : _30("Failed to rename view."));
    }
  }, [apiUrl, availableViewNames, currentViewName, relatedModel.name, relatedModel.resource, renameViewName, allModels, loadViewNames]);
  const confirmDeleteView = useCallback(() => {
    Modal.confirm({
      title: _30(_30("Delete view")),
      content: `Delete "${currentViewName}" and all its saved preferences?`,
      okText: _30("Delete"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const resourceKey = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
          const response = await authenticatedFetch(`${apiUrl}/views/preferences/view`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resource: resourceKey, action: "delete", view_name: currentViewName })
          });
          if (!response.ok) {
            throw new Error(`Delete failed (${response.status})`);
          }
          message.success(_30("View deleted."));
          await loadViewNames();
        } catch (error2) {
          message.error(error2 instanceof Error ? error2.message : _30("Failed to delete view."));
        }
      }
    });
  }, [apiUrl, currentViewName, relatedModel.name, relatedModel.resource, allModels, loadViewNames]);
  const viewSelector = /* @__PURE__ */ jsx(
    Select,
    {
      size: "small",
      value: currentViewName,
      onChange: handleChangeViewName,
      loading: isLoadingViewNames,
      options: availableViewNames.map((name) => ({ label: name, value: name })),
      style: { minWidth: 180 }
    }
  );
  const relatedViewTabsNode = selectedViewNames.length > 1 && viewVariant !== "totals-details" ? /* @__PURE__ */ jsx(
    Tabs,
    {
      size: "small",
      activeKey: currentViewName,
      onChange: handleChangeViewName,
      items: selectedViewNames.map((name) => ({ key: name, label: renderToneTabLabel(name, relatedModelTone) }))
    }
  ) : null;
  useEffect(() => {
    loadViewNames();
  }, [loadViewNames]);
  useEffect(() => {
    if (!viewNamesLoaded) return;
    analyzePrefsTouchedRef.current = false;
    layoutPrefsTouchedRef.current = false;
    analyzePrefsLoadedRef.current = false;
    layoutPrefsLoadedRef.current = false;
    setColumnsSelectorOpen(false);
    setSaveViewName(currentViewName);
    setSaveViewAsNew(false);
    resetLayoutDefaults();
    resetAnalyzeDefaults();
  }, [currentViewName, resetAnalyzeDefaults, resetLayoutDefaults, viewNamesLoaded]);
  useEffect(() => {
    const resourceKey = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
    const viewKey = `${resourceKey}::${currentViewName}`;
    if (analyzePrefsResourceRef.current !== viewKey) {
      analyzePrefsLoadedRef.current = false;
      setAnalyzePrefsReady(false);
      analyzePrefsResourceRef.current = viewKey;
    }
    if (analyzePrefsLoadedRef.current) return;
    let cancelled = false;
    const loadPreferences = async () => {
      try {
        const response = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=Analyze&custom_view_name=${encodeURIComponent(currentViewName)}`);
        if (!response.ok) {
          throw new Error(`Load failed (${response.status})`);
        }
        const data = await response.json();
        if (cancelled || analyzePrefsTouchedRef.current) return;
        const prefs = data?.preferences;
        if (!prefs || typeof prefs !== "object") {
          analyzePrefsLoadedRef.current = true;
          if (!cancelled) setAnalyzePrefsReady(true);
          return;
        }
        if ("categoryField1" in prefs) setCategoryField1(prefs.categoryField1 ?? null);
        if ("categoryField2" in prefs) setCategoryField2(prefs.categoryField2 ?? null);
        if ("chartType" in prefs) setChartType(prefs.chartType);
        if ("summaryFn" in prefs) setSummaryFn(prefs.summaryFn);
        if ("selectedSeriesKeys" in prefs) {
          setSelectedSeriesKeys(Array.isArray(prefs.selectedSeriesKeys) ? prefs.selectedSeriesKeys : []);
        }
        if ("rankingMode" in prefs && (prefs.rankingMode === "none" || prefs.rankingMode === "top" || prefs.rankingMode === "bottom")) {
          setRankingMode(prefs.rankingMode);
        }
        if ("rankingFieldKey" in prefs) setRankingFieldKey(prefs.rankingFieldKey ?? null);
        if ("rankingN" in prefs) {
          const nextRankingN = Number(prefs.rankingN);
          setRankingN(Number.isFinite(nextRankingN) && nextRankingN > 0 ? Math.floor(nextRankingN) : 10);
        }
        analyzePrefsLoadedRef.current = true;
        if (!cancelled) setAnalyzePrefsReady(true);
      } catch {
        if (!cancelled) setAnalyzePrefsReady(true);
      }
    };
    loadPreferences();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, currentViewName, relatedModel.name, relatedModel.resource, allModels]);
  useEffect(() => {
    if (!layoutPreferenceType) return;
    const resourceKey = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
    const viewKey = `${resourceKey}::${layoutPreferenceType}::${currentViewName}`;
    if (layoutPrefsResourceRef.current !== viewKey) {
      layoutPrefsLoadedRef.current = false;
      layoutPrefsResourceRef.current = viewKey;
    }
    if (layoutPrefsLoadedRef.current) return;
    let cancelled = false;
    const applyPrefs = (prefs) => {
      if (!prefs || typeof prefs !== "object") return false;
      if ("analyzeOpen" in prefs) setAnalyzeOpen(Boolean(prefs.analyzeOpen));
      if ("isAnalyzeVertical" in prefs) setIsAnalyzeVertical(Boolean(prefs.isAnalyzeVertical));
      if ("isAnalyzeFirst" in prefs) setIsAnalyzeFirst(Boolean(prefs.isAnalyzeFirst));
      if ("filtersCollapsed" in prefs) setFiltersCollapsed(Boolean(prefs.filtersCollapsed));
      if ("filters" in prefs && Array.isArray(prefs.filters)) {
        setFilterRules(normalizeFilterRules(prefs.filters));
      }
      if ("rowsPerPage" in prefs) {
        const nextPageSize = Number(prefs.rowsPerPage);
        if (Number.isFinite(nextPageSize) && nextPageSize > 0) {
          setPageSize(nextPageSize);
          setCurrentPage(1);
        }
      }
      if ("tableColumns" in prefs && prefs.tableColumns) {
        const selectedKeys = Array.isArray(prefs.tableColumns.selectedKeys) ? prefs.tableColumns.selectedKeys : Array.isArray(prefs.tableColumns) ? prefs.tableColumns : null;
        const order = Array.isArray(prefs.tableColumns.order) ? prefs.tableColumns.order : Array.isArray(prefs.tableColumns) ? prefs.tableColumns : null;
        if (selectedKeys && selectedKeys.length > 0) {
          setSelectedColumnKeys(selectedKeys);
          setColumnOrder(order && order.length > 0 ? order : selectedKeys);
        }
      }
      if ("columnFilters" in prefs && prefs.columnFilters && typeof prefs.columnFilters === "object") {
        setColumnFiltersSelected(prefs.columnFilters);
      }
      if ("columnSort" in prefs && prefs.columnSort) {
        setColumnSort(normalizeColumnSortPreference(prefs.columnSort));
      }
      if ("totalsSummaryFunctions" in prefs && prefs.totalsSummaryFunctions && typeof prefs.totalsSummaryFunctions === "object") {
        setTotalsSummaryFunctions(prefs.totalsSummaryFunctions);
      }
      return Object.keys(prefs).length > 0;
    };
    const loadPreferences = async () => {
      try {
        const response = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=${layoutPreferenceType}&custom_view_name=${encodeURIComponent(currentViewName)}`);
        if (!response.ok) {
          throw new Error(`Load failed (${response.status})`);
        }
        const data = await response.json();
        if (cancelled || layoutPrefsTouchedRef.current) return;
        const prefs = data?.preferences;
        const applied = applyPrefs(prefs);
        if (!applied && layoutPreferenceType === "EditLayout") {
          const fallbackResponse = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=ShowLayout&custom_view_name=${encodeURIComponent(currentViewName)}`);
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            if (cancelled || layoutPrefsTouchedRef.current) return;
            applyPrefs(fallbackData?.preferences);
          }
        } else if (!applied && layoutPreferenceType === "ShowLayout") {
          const fallbackResponse = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=EditLayout&custom_view_name=${encodeURIComponent(currentViewName)}`);
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            if (cancelled || layoutPrefsTouchedRef.current) return;
            applyPrefs(fallbackData?.preferences);
          }
        }
        layoutPrefsLoadedRef.current = true;
      } catch {
      }
    };
    loadPreferences();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, currentViewName, layoutPreferenceType, relatedModel.name, relatedModel.resource, allModels, viewNamesLoaded]);
  const normalizeFieldValue = useCallback((field, value) => {
    if (field.type === "date" && value) {
      if (typeof value?.toISOString === "function") return value.toISOString();
      if (typeof value?.format === "function") return value.format("YYYY-MM-DD");
    }
    return value;
  }, []);
  const hasActiveFilterRules = useMemo(() => {
    return filterRules.some((rule) => rule.fieldKey && rule.operator && (rule.value !== void 0 && rule.value !== null && rule.value !== ""));
  }, [filterRules]);
  const resolveRelativeDate = useCallback((value, asRange) => {
    const count = Number(value?.count ?? 1);
    const direction = value?.direction || "next";
    const unit = value?.unit || "weeks";
    const isQuarter = unit === "quarters";
    const base = dayjs7();
    if (asRange || direction === "current") {
      const anchor = direction === "current" ? base : direction === "previous" ? isQuarter ? base.subtract(count * 3, "month") : base.subtract(count, unit) : isQuarter ? base.add(count * 3, "month") : base.add(count, unit);
      if (isQuarter) {
        const quarterStartMonth = Math.floor(anchor.month() / 3) * 3;
        const start = anchor.month(quarterStartMonth).startOf("month");
        const end = start.add(2, "month").endOf("month");
        return { start, end };
      }
      return {
        start: anchor.startOf(unit),
        end: anchor.endOf(unit)
      };
    }
    const target = direction === "previous" ? isQuarter ? base.subtract(count * 3, "month") : base.subtract(count, unit) : isQuarter ? base.add(count * 3, "month") : base.add(count, unit);
    if (isQuarter) {
      const quarterStartMonth = Math.floor(target.month() / 3) * 3;
      return { date: target.month(quarterStartMonth).startOf("month") };
    }
    return { date: target.startOf(unit) };
  }, []);
  const getFieldValueForFilter = useCallback((field, recordRow) => {
    const raw = recordRow?.[field.key];
    if (raw === void 0 || raw === null) return raw;
    if (field.reference) {
      const cacheKey = `${field.reference}:${raw}`;
      return labelCache[cacheKey] || raw;
    }
    if (field.options) {
      return field.options.find((option) => option.value === raw)?.label || raw;
    }
    return raw;
  }, [labelCache]);
  const matchesRule = useCallback((recordRow, rule) => {
    const field = relatedModel.fields.find((f) => f.key === rule.fieldKey);
    if (!field || !rule.operator) return true;
    const rawValue = getFieldValueForFilter(field, recordRow);
    if (rawValue === void 0 || rawValue === null) return false;
    if (field.type === "string") {
      const value = String(rawValue).toLowerCase();
      const target = String(rule.value ?? "").toLowerCase();
      if (!target) return true;
      if (rule.operator === "contains") return value.includes(target);
      if (rule.operator === "equals") return value === target;
      return true;
    }
    if (field.type === "number") {
      const num = Number(rawValue);
      const target = Number(rule.value);
      const target2 = Number(rule.value2);
      if (Number.isNaN(num)) return false;
      switch (rule.operator) {
        case "eq":
          return !Number.isNaN(target) && num === target;
        case "gt":
          return !Number.isNaN(target) && num > target;
        case "gte":
          return !Number.isNaN(target) && num >= target;
        case "lt":
          return !Number.isNaN(target) && num < target;
        case "lte":
          return !Number.isNaN(target) && num <= target;
        case "between":
          return !Number.isNaN(target) && !Number.isNaN(target2) && num >= target && num <= target2;
        default:
          return true;
      }
    }
    if (field.type === "boolean") {
      if (rule.operator === "is") return Boolean(rawValue) === Boolean(rule.value);
      return true;
    }
    if (field.type === "date") {
      const recordDate = dayjs7(rawValue);
      if (!recordDate.isValid()) return false;
      const mode = rule.value?.mode || "absolute";
      const mode2 = rule.value2?.mode || "absolute";
      const getDateValue = (val, asRange) => {
        if (val?.mode === "relative") {
          return resolveRelativeDate(val, asRange);
        }
        const date = dayjs7(val?.date || val);
        return asRange ? { start: date.startOf("day"), end: date.endOf("day") } : { date: date.startOf("day") };
      };
      switch (rule.operator) {
        case "on": {
          const range = mode === "relative" ? resolveRelativeDate(rule.value, true) : getDateValue(rule.value, true);
          const time = recordDate.valueOf();
          return time >= range.start.valueOf() && time <= range.end.valueOf();
        }
        case "after": {
          const dateVal = mode === "relative" ? resolveRelativeDate(rule.value, false).date : getDateValue(rule.value, false).date;
          if (!dateVal || !dayjs7(dateVal).isValid()) return false;
          return recordDate.valueOf() > dayjs7(dateVal).endOf("day").valueOf();
        }
        case "before": {
          const dateVal = mode === "relative" ? resolveRelativeDate(rule.value, false).date : getDateValue(rule.value, false).date;
          if (!dateVal || !dayjs7(dateVal).isValid()) return false;
          return recordDate.valueOf() < dayjs7(dateVal).startOf("day").valueOf();
        }
        case "between": {
          const startRange = mode === "relative" ? resolveRelativeDate(rule.value, true) : getDateValue(rule.value, true);
          const endRange = mode2 === "relative" ? resolveRelativeDate(rule.value2, true) : getDateValue(rule.value2, true);
          if (!startRange.start || !endRange.end) return false;
          const time = recordDate.valueOf();
          return time >= startRange.start.valueOf() && time <= endRange.end.valueOf();
        }
        default:
          return true;
      }
    }
    return true;
  }, [getFieldValueForFilter, relatedModel.fields, resolveRelativeDate]);
  const applyGlobalSearch = useCallback((data) => {
    const query = localSearch.trim().toLowerCase();
    if (!query) return data;
    return data.filter((recordRow) => {
      const candidates = [
        recordRow?._label,
        ...relatedModel.fields.flatMap((field) => {
          const value = recordRow?.[field.key];
          if (field.reference && value !== void 0 && value !== null) {
            const key = `${field.reference}:${value}`;
            const cachedLabel = labelCache[key];
            return cachedLabel ? [cachedLabel, value] : [value];
          }
          return [value];
        })
      ];
      return candidates.some((value) => value !== void 0 && value !== null && String(value).toLowerCase().includes(query));
    });
  }, [labelCache, localSearch, relatedModel.fields]);
  const applyFilterRules = useCallback((data) => {
    if (!hasActiveFilterRules) return data;
    return data.filter((recordRow) => filterRules.every((rule) => matchesRule(recordRow, rule)));
  }, [filterRules, hasActiveFilterRules, matchesRule]);
  const filteredRows = useMemo(() => {
    return applyFilterRules(applyGlobalSearch(rows || []));
  }, [applyFilterRules, applyGlobalSearch, rows]);
  useEffect(() => {
    setCurrentPage(1);
  }, [localSearch, filterRules]);
  useEffect(() => {
    if (!allowInlineEdit) return;
    if (form.isFieldsTouched()) return;
    const initialValues = {};
    rows.forEach((row) => {
      const rowId = row?.eid ?? row?.id ?? row?.__relationKey;
      if (rowId === void 0 || rowId === null) return;
      initialValues[rowId] = {};
      relatedModel.fields.forEach((field) => {
        initialValues[rowId][field.key] = row?.[field.key];
      });
    });
    form.setFieldsValue(initialValues);
  }, [allowInlineEdit, form, relatedModel.fields, filteredRows]);
  useEffect(() => {
    if (!allowInlineEdit) {
      setWarnWhen(false);
      return;
    }
    setWarnWhen(hasPendingEdits);
    return () => setWarnWhen(false);
  }, [allowInlineEdit, hasPendingEdits, setWarnWhen]);
  const saveAllEdits = useCallback(async () => {
    if (!allowInlineEdit) return;
    setSavingAll(true);
    try {
      const values = form.getFieldsValue(true);
      const updates = [];
      rows.forEach((row) => {
        const rowId = row?.eid ?? row?.id ?? row?.__relationKey;
        if (rowId === void 0 || rowId === null) return;
        const rowValues = values?.[rowId];
        if (!rowValues) return;
        const payload = {};
        relatedModel.fields.forEach((field) => {
          if (field.key === "eid") return;
          if (!Object.prototype.hasOwnProperty.call(rowValues, field.key)) return;
          const newVal = normalizeFieldValue(field, rowValues[field.key]);
          const oldVal = normalizeFieldValue(field, row?.[field.key]);
          const unchanged = newVal === oldVal || newVal === null && oldVal === null || newVal === void 0 && oldVal === void 0;
          if (!unchanged) {
            payload[field.key] = newVal;
          }
        });
        if (Object.keys(payload).length > 0) {
          updates.push({ rowId, payload });
        }
      });
      const resource = resolveResourcePath(relatedModel.resource || relatedModel.name, allModels);
      for (const update of updates) {
        const response = await authenticatedFetch(`${apiUrl}/${resource}/${update.rowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(update.payload)
        });
        if (!response.ok) {
          throw new Error(`Failed to update ${relatedModel.name}`);
        }
        const updated = await response.json();
        setRows(
          (prev) => prev.map((item) => {
            const itemId = item?.eid ?? item?.id ?? item?.__relationKey;
            if (itemId !== update.rowId) return item;
            return { ...item, ...updated };
          })
        );
      }
      setHasPendingEdits(false);
      message.success("Changes saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSavingAll(false);
    }
  }, [allowInlineEdit, apiUrl, form, normalizeFieldValue, relatedModel.fields, relatedModel.name, relatedModel.resource, allModels, rows]);
  const handleDeleteRelationRow = useCallback((row) => {
    const relationRow = row?.__relationRow;
    const deleteId = relationRow && rel.targetKey && rel.otherKey ? `${relationRow["eid_from"]}:${relationRow["eid_to"]}` : relationRow?.id ?? relationRow?.eid;
    if (deleteId === void 0 || deleteId === null) return;
    Modal.confirm({
      title: _30("Delete"),
      content: _30("Are you sure you want to delete this relation?"),
      okText: _30("Delete"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
          const response = await authenticatedFetch(`${apiUrl}/${relationResource}/${encodeURIComponent(String(deleteId))}`, {
            method: "DELETE"
          });
          if (!response.ok) {
            throw new Error(`Delete failed (${response.status})`);
          }
          const deletedRelationKey = row?.__relationKey;
          setRows((prev) => prev.filter((item) => {
            if (deletedRelationKey && item?.__relationKey === deletedRelationKey) {
              return false;
            }
            const itemRelationRow = item?.__relationRow;
            if (!itemRelationRow) return true;
            const itemDeleteId = rel.targetKey && rel.otherKey ? `${itemRelationRow[rel.targetKey]}:${itemRelationRow[rel.otherKey]}` : itemRelationRow?.id ?? itemRelationRow?.eid;
            return String(itemDeleteId) !== String(deleteId);
          }));
          message.success(_30("Relation deleted."));
        } catch (err) {
          message.error(err instanceof Error ? err.message : _30("Failed to delete relation."));
        }
      }
    });
  }, [apiUrl, allModels, rel.otherKey, rel.resource, rel.resourcePath, rel.targetKey]);
  const renderEditableInput = (field, rowId) => renderInput(field, allModels, relatedModel, rowId);
  const listAnalyzeLayoutStyle = {
    display: "flex",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "nowrap",
    flexDirection: isAnalyzeVertical ? "column" : "row"
  };
  const listContainerStyle = {
    flex: isAnalyzeVertical ? "1 1 auto" : "2 1 520px",
    minWidth: isAnalyzeVertical ? 0 : 360,
    width: isAnalyzeVertical ? "100%" : void 0,
    overflow: "auto",
    order: isAnalyzeFirst ? 2 : 1
  };
  const analyzeContainerStyle = {
    flex: isAnalyzeVertical ? "1 1 auto" : listVisible ? "1 1 420px" : "1 1 520px",
    minWidth: isAnalyzeVertical ? 0 : 360,
    width: isAnalyzeVertical ? "100%" : void 0,
    overflow: "visible",
    order: isAnalyzeFirst ? 1 : 2
  };
  const getSortValue = useCallback((field, recordRow) => {
    const raw = recordRow?.[field.key];
    if (raw === void 0 || raw === null) return null;
    if (field.key === "eid" && recordRow?._label) return recordRow._label;
    if (field.reference) {
      const cacheKey = `${field.reference}:${raw}`;
      return labelCache[cacheKey] ?? raw;
    }
    if (field.options) {
      return field.options.find((option) => option.value === raw)?.label ?? raw;
    }
    if (field.type === "date") {
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? raw : parsed.getTime();
    }
    if (field.type === "number") return Number(raw);
    if (field.type === "boolean") return raw ? 1 : 0;
    return raw;
  }, [labelCache]);
  const compareSortValues = useCallback((field, a, b) => {
    const aVal = getSortValue(field, a);
    const bVal = getSortValue(field, b);
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;
    if (typeof aVal === "number" && typeof bVal === "number") return aVal - bVal;
    return String(aVal).localeCompare(String(bVal));
  }, [getSortValue]);
  const shouldUseFullDataMode = useMemo(() => {
    if (loadAllRelatedRequested) return true;
    return false;
  }, [loadAllRelatedRequested]);
  const fetchRelatedDetailsByIds = useCallback(async (ids, signal) => {
    const uniqueIds = Array.from(new Set(ids.filter((value) => value !== void 0 && value !== null)));
    if (!rel.otherResource || uniqueIds.length === 0) return [];
    const relatedResource = rel.otherResourcePath || resolveResourcePath(rel.otherResource, allModels);
    try {
      const bulkResponse = await authenticatedFetch(`${apiUrl}/_meta/bulk-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: relatedResource, ids: uniqueIds }),
        signal
      });
      if (bulkResponse.ok) {
        const bulkData = await bulkResponse.json();
        if (Array.isArray(bulkData?.items)) {
          return bulkData.items;
        }
      }
    } catch (bulkError) {
      if (bulkError instanceof DOMException && bulkError.name === "AbortError") {
        throw bulkError;
      }
    }
    const relatedRecords = [];
    const batchSize = 20;
    for (let index = 0; index < uniqueIds.length; index += batchSize) {
      const batch = uniqueIds.slice(index, index + batchSize);
      const batchResults = await Promise.all(batch.map(async (id) => {
        try {
          const relatedResponse = await authenticatedFetch(`${apiUrl}/${relatedResource}/${id}`, { signal });
          if (!relatedResponse.ok) {
            console.warn(`Failed to load ${relatedResource} ${id}`);
            return null;
          }
          return relatedResponse.json();
        } catch (fetchError) {
          if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
            throw fetchError;
          }
          console.warn(`Failed to load ${rel.otherResourcePath || rel.otherResource} ${id}`, fetchError);
          return null;
        }
      }));
      relatedRecords.push(...batchResults.filter(Boolean));
    }
    return relatedRecords;
  }, [apiUrl, allModels, rel.otherResource, rel.otherResourcePath]);
  const traceLog2 = (label, detail) => {
    if (typeof window === "undefined" || sessionStorage.getItem("jm_trace") !== "1") return;
    const now = performance.now();
    console.log(`[JM_TRACE ${now.toFixed(1)}ms] ${label}${detail ? " | " + detail : ""}`);
  };
  useEffect(() => {
    if (!recordId || !rel.otherResource || !rel.otherKey) {
      setRows([]);
      setServerTotalRows(0);
      setFullDataLoaded(false);
      setRelationRowsCapped(false);
      setLoadedRowsCount(0);
      setLoadAllRelatedRequested(false);
      return;
    }
    if (!shouldUseFullDataMode && rows.length > 0) {
      return;
    }
    if (shouldUseFullDataMode && fullDataLoaded) {
      return;
    }
    let isMounted = true;
    const controller = new AbortController();
    const { signal } = controller;
    const fetchRows = async () => {
      const fetchStart = performance.now();
      traceLog2("RelatedObjectsTable", `fetchRows start rel=${rel.resource} targetKey=${rel.targetKey} eid=${recordId}`);
      setLoading(true);
      setError(null);
      try {
        const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
        const relationFetchPageSize = 500;
        let relationRows = [];
        let relationTotal = 0;
        if (shouldUseFullDataMode) {
          let start = 0;
          while (true) {
            const params = new URLSearchParams();
            params.set("_start", String(start));
            params.set("_end", String(start + relationFetchPageSize));
            params.append(rel.targetKey, String(recordId));
            const relationResponse = await authenticatedFetch(`${apiUrl}/${relationResource}?${params.toString()}`, { signal });
            if (!relationResponse.ok) {
              throw new Error(`Failed to load ${rel.label} relations`);
            }
            const pageRows = await relationResponse.json();
            if (!Array.isArray(pageRows)) break;
            relationRows = relationRows.concat(pageRows);
            if (pageRows.length < relationFetchPageSize) break;
            start += relationFetchPageSize;
          }
          relationTotal = relationRows.length;
          if (isMounted) {
            setRelationRowsCapped(false);
          }
        } else {
          const cap = Math.max(0, relationsMaxRowsToLoad);
          let start = 0;
          let totalFromHeader = 0;
          while (cap === 0 || relationRows.length < cap) {
            const remaining = cap > 0 ? cap - relationRows.length : relationFetchPageSize;
            const fetchSize = Math.min(relationFetchPageSize, Math.max(remaining, 1));
            const params = new URLSearchParams();
            params.set("_start", String(start));
            params.set("_end", String(start + fetchSize));
            params.append(rel.targetKey, String(recordId));
            const relationResponse = await authenticatedFetch(`${apiUrl}/${relationResource}?${params.toString()}`, { signal });
            if (!relationResponse.ok) {
              throw new Error(`Failed to load ${rel.label} relations`);
            }
            const totalHeader = Number(relationResponse.headers.get("x-total-count") || 0);
            if (Number.isFinite(totalHeader) && totalHeader > 0) {
              totalFromHeader = totalHeader;
            }
            const pageRows = await relationResponse.json();
            if (!Array.isArray(pageRows) || pageRows.length === 0) break;
            relationRows = relationRows.concat(pageRows);
            if (pageRows.length < fetchSize) break;
            start += fetchSize;
          }
          relationTotal = relationRows.length;
          if (isMounted) {
            const capped = totalFromHeader > 0 && totalFromHeader > relationRows.length || cap > 0 && relationRows.length >= cap;
            setRelationRowsCapped(capped);
            setLoadedRowsCount(relationRows.length);
          }
        }
        const relatedIds = relationRows.map((row) => row?.[rel.otherKey]).filter((value) => value !== void 0 && value !== null);
        if (relatedIds.length === 0) {
          if (isMounted) {
            setRows([]);
            setServerTotalRows(relationTotal);
            if (shouldUseFullDataMode) {
              setLoadedRowsCount(0);
              setRelationRowsCapped(false);
            }
          }
          return;
        }
        const filteredRelationRows = allowedRelatedIds ? relationRows.filter((row) => allowedRelatedIds.has(row?.[rel.otherKey])) : relationRows;
        const filteredRelatedIds = allowedRelatedIds ? relatedIds.filter((value) => allowedRelatedIds.has(value)) : relatedIds;
        if (filteredRelatedIds.length === 0) {
          if (isMounted) {
            setRows([]);
            setServerTotalRows(relationTotal);
            if (shouldUseFullDataMode) {
              setLoadedRowsCount(0);
              setRelationRowsCapped(false);
            }
          }
          return;
        }
        const relatedRecords = await fetchRelatedDetailsByIds(filteredRelatedIds, signal);
        const relatedById = new Map(
          relatedRecords.map((item) => [item?.eid ?? item?.id, item])
        );
        const mergedRows = filteredRelationRows.map((relationRow, index) => {
          const relatedId = relationRow?.[rel.otherKey];
          const relatedRecord = relatedById.get(relatedId);
          if (!relatedRecord) return null;
          return {
            ...relatedRecord,
            __relationRow: relationRow,
            __relationKey: `${relatedId ?? "unknown"}-${index}`
          };
        }).filter(Boolean);
        if (isMounted) {
          setRows(mergedRows);
          setServerTotalRows(shouldUseFullDataMode ? mergedRows.length : relationTotal);
          setFullDataLoaded(shouldUseFullDataMode);
          if (shouldUseFullDataMode) {
            setLoadedRowsCount(mergedRows.length);
            setRelationRowsCapped(false);
          }
        }
        const fetchElapsed = performance.now() - fetchStart;
        traceLog2("RelatedObjectsTable", `fetchRows done rel=${rel.resource} rows=${mergedRows.length} elapsed=${fetchElapsed.toFixed(0)}ms`);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load related records");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchRows();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [apiUrl, currentPage, pageSize, recordId, rel.label, rel.otherKey, rel.otherResource, rel.resource, rel.targetKey, allowedRelatedIds, allModels, rel.resourcePath, rel.otherResourcePath, shouldUseFullDataMode, fetchRelatedDetailsByIds, fullDataLoaded, relationsMaxRowsToLoad, rows.length]);
  useEffect(() => {
    if (!shouldUseFullDataMode && fullDataLoaded) {
      setFullDataLoaded(false);
    }
  }, [fullDataLoaded, shouldUseFullDataMode]);
  useEffect(() => {
    if (loading) return;
    if (analyzeTouchedRef.current) return;
    if (filteredRows.length <= 1 && analyzeOpen) {
      setAnalyzeOpen(false);
    }
  }, [analyzeOpen, filteredRows.length, loading]);
  useEffect(() => {
    if (loading) return;
    if (analyzeTouchedRef.current) return;
    if (filteredRows.length > 1 && !analyzeOpen) {
      setAnalyzeOpen(true);
    }
  }, [analyzeOpen, filteredRows.length, loading]);
  useEffect(() => {
    if (!categoryField1 && categoricalFields.length > 0) {
      setCategoryField1(categoricalFields[0].key);
    }
    if (categoryField2 === void 0 && categoricalFields.length > 1) {
      setCategoryField2(categoricalFields[1].key);
    }
  }, [categoricalFields, categoryField1, categoryField2]);
  useEffect(() => {
    if (selectedSeriesKeys !== null) return;
    if (numericFields.length > 0) {
      setSelectedSeriesKeys(numericFields.map((field) => field.key));
    } else {
      setSelectedSeriesKeys(["__count__"]);
    }
  }, [numericFields, selectedSeriesKeys]);
  useEffect(() => {
    if (numericFields.length === 0) {
      if (rankingFieldKey !== null) setRankingFieldKey(null);
      if (rankingMode !== "none") setRankingMode("none");
      return;
    }
    if (!rankingFieldKey || !numericFields.some((field) => field.key === rankingFieldKey)) {
      setRankingFieldKey(numericFields[0].key);
    }
  }, [numericFields, rankingFieldKey, rankingMode]);
  const formatCategoryValue = useCallback((field, recordRow) => {
    if (!field) return _30("All");
    const raw = recordRow?.[field.key];
    if (raw === void 0 || raw === null) return "-";
    if (field.key === "eid" && recordRow?._label) return recordRow._label;
    if (field.reference) {
      const cacheKey = `${field.reference}:${raw}`;
      return labelCache[cacheKey] || String(raw);
    }
    if (field.options) {
      return field.options.find((option) => option.value === raw)?.label || String(raw);
    }
    if (field.type === "boolean") return raw ? _30("Yes") : _30("No");
    if (field.type === "date") return formatDateValue(raw);
    return String(raw);
  }, [labelCache]);
  const chartTitle = useMemo(() => {
    const cat1Label = categoryField1 ? relatedModel.fields.find((field) => field.key === categoryField1)?.label : "All";
    const cat2Label = categoryField2 ? relatedModel.fields.find((field) => field.key === categoryField2)?.label : null;
    const parts = [relatedModel.label || relatedModel.name, cat1Label];
    if (cat2Label) parts.push(cat2Label);
    return parts.filter(Boolean).join(" \u2022 ");
  }, [categoryField1, categoryField2, relatedModel.fields, relatedModel.label, relatedModel.name]);
  const chartData = useMemo(() => {
    const data = filteredRows || [];
    const cat1Field = categoryField1 ? relatedModel.fields.find((field) => field.key === categoryField1) : void 0;
    const cat2Field = categoryField2 ? relatedModel.fields.find((field) => field.key === categoryField2) : void 0;
    const groupMap = /* @__PURE__ */ new Map();
    const rawSeriesKeys = numericFields.length > 0 ? numericFields.map((field) => field.key) : ["__count__"];
    const numericFieldMap = new Map(
      numericFields.map((field) => [field.key, field])
    );
    const selectedSeriesKeysValid = (selectedSeriesKeys || []).filter((key) => {
      if (key === "__count__" && numericFields.length === 0) return true;
      return numericFieldMap.has(key);
    });
    const candidateSeriesKeys = selectedSeriesKeysValid.length > 0 ? selectedSeriesKeysValid : rawSeriesKeys;
    const rankingSeriesKey = rankingFieldKey && numericFieldMap.has(rankingFieldKey) ? rankingFieldKey : null;
    const aggregationKeys = Array.from(/* @__PURE__ */ new Set([...candidateSeriesKeys || [], ...rankingSeriesKey ? [rankingSeriesKey] : []]));
    const statsMap = /* @__PURE__ */ new Map();
    data.forEach((recordRow) => {
      const cat1Value = formatCategoryValue(cat1Field, recordRow);
      const cat2Value = cat2Field ? formatCategoryValue(cat2Field, recordRow) : null;
      const label = cat2Field ? `${cat1Value} \u2022 ${cat2Value}` : `${cat1Value}`;
      const groupKey = label;
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, { key: groupKey, label, values: Object.fromEntries(aggregationKeys.map((key) => [key, 0])) });
        statsMap.set(groupKey, Object.fromEntries(aggregationKeys.map((key) => [key, []])));
      }
      const stats = statsMap.get(groupKey);
      if (numericFields.length === 0) {
        if (stats["__count__"]) {
          stats["__count__"].push(1);
        }
      } else {
        aggregationKeys.forEach((key) => {
          const field = numericFieldMap.get(key);
          if (!field) return;
          const value = Number(recordRow?.[field.key]);
          if (!Number.isNaN(value) && stats[key]) {
            stats[key].push(value);
          }
        });
      }
    });
    groupMap.forEach((group, groupKey) => {
      const stats = statsMap.get(groupKey);
      if (!stats) return;
      aggregationKeys.forEach((key) => {
        const values = stats[key] || [];
        if (values.length === 0) {
          group.values[key] = 0;
          return;
        }
        switch (summaryFn) {
          case "count":
            group.values[key] = values.length;
            return;
          case "avg":
            group.values[key] = values.reduce((acc, val) => acc + val, 0) / values.length;
            return;
          case "max":
            group.values[key] = Math.max(...values);
            return;
          case "min":
            group.values[key] = Math.min(...values);
            return;
          case "stddev": {
            const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
            const variance = values.reduce((acc, val) => acc + (val - mean) ** 2, 0) / values.length;
            group.values[key] = Math.sqrt(variance);
            return;
          }
          case "sum":
          default:
            group.values[key] = values.reduce((acc, val) => acc + val, 0);
        }
      });
    });
    const baseGroups = Array.from(groupMap.values());
    const seriesKeys = candidateSeriesKeys;
    const seriesLabels = numericFields.length > 0 ? numericFields.reduce((acc, field) => {
      acc[field.key] = field.label;
      return acc;
    }, { "__count__": _30("Count") }) : { "__count__": _30("Count") };
    let groups = baseGroups;
    if (rankingMode !== "none" && rankingFieldKey) {
      const limit = Math.max(1, Math.floor(rankingN || 10));
      const ranked = [...baseGroups].sort((a, b) => {
        const aVal = Number(a.values[rankingFieldKey] ?? 0);
        const bVal = Number(b.values[rankingFieldKey] ?? 0);
        if (aVal === bVal) return a.label.localeCompare(b.label);
        return rankingMode === "top" ? bVal - aVal : aVal - bVal;
      });
      groups = ranked.slice(0, limit);
    }
    const allowedGroupKeys = new Set(groups.map((group) => group.key));
    const filteredRawRows = data.filter((recordRow) => {
      const cat1Value = formatCategoryValue(cat1Field, recordRow);
      const cat2Value = cat2Field ? formatCategoryValue(cat2Field, recordRow) : null;
      const label = cat2Field ? `${cat1Value} \u2022 ${cat2Value}` : `${cat1Value}`;
      return allowedGroupKeys.has(label);
    });
    return {
      groups,
      seriesKeys,
      seriesLabels,
      filteredRawRows
    };
  }, [filteredRows, categoryField1, categoryField2, relatedModel.fields, numericFields, formatCategoryValue, summaryFn, selectedSeriesKeys, rankingMode, rankingFieldKey, rankingN]);
  const numericColumnMaxes = useMemo(() => {
    const maxes = {};
    const data = filteredRows || [];
    displayFields.forEach((field) => {
      if (field.type !== "number" || field.reference) return;
      const values = data.map((row) => Number(row?.[field.key])).filter((value) => !Number.isNaN(value) && Number.isFinite(value));
      if (values.length === 0) {
        maxes[field.key] = 0;
        return;
      }
      maxes[field.key] = Math.max(...values.map((val) => Math.abs(val)));
    });
    return maxes;
  }, [filteredRows, displayFields]);
  const chartSignature = useMemo(() => {
    return JSON.stringify({
      chartType,
      summaryFn,
      categoryField1,
      categoryField2,
      rankingMode,
      rankingFieldKey,
      rankingN,
      seriesKeys: chartData.seriesKeys,
      groups: chartData.groups
    });
  }, [chartType, summaryFn, categoryField1, categoryField2, rankingMode, rankingFieldKey, rankingN, chartData]);
  useEffect(() => {
    if (!analyzeOpen) return;
    skipNextAnimationRef.current = true;
    setChartAnimationStage("enter");
    setChartAnimationKey((key) => key + 1);
  }, [analyzeOpen]);
  useEffect(() => {
    if (!analyzeOpen) return;
    if (skipNextAnimationRef.current) {
      skipNextAnimationRef.current = false;
      return;
    }
    setChartAnimationStage("update");
    setChartAnimationKey((key) => key + 1);
  }, [analyzeOpen, chartSignature]);
  const formatValueForExport = useCallback((field, recordRow) => {
    const raw = recordRow?.[field.key];
    if (raw === void 0 || raw === null) return "";
    if (field.reference) {
      const cacheKey = `${field.reference}:${raw}`;
      return labelCache[cacheKey] || String(raw);
    }
    if (field.options) {
      return field.options.find((option) => option.value === raw)?.label || String(raw);
    }
    if (field.type === "boolean") return raw ? _30("Yes") : _30("No");
    if (field.type === "date") return formatDateValue(raw);
    return String(raw);
  }, [labelCache]);
  useEffect(() => {
    if (!exportRequested) return;
    const escapeCsv = (value) => {
      if (value.includes('"') || value.includes(",") || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };
    const headers = relatedModel.fields.map((field) => field.label);
    const csvRows = filteredRows.map((recordRow) => {
      return relatedModel.fields.map((field) => escapeCsv(formatValueForExport(field, recordRow)));
    });
    const csv = [headers.map(escapeCsv).join(","), ...csvRows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${relatedModel.name}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExportRequested(false);
  }, [exportRequested, filteredRows, relatedModel.fields, relatedModel.name, formatValueForExport]);
  const exportChartImage = () => {
    const svg = chartSvgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const width = svg.viewBox.baseVal.width || svg.clientWidth || 1e3;
      const height = svg.viewBox.baseVal.height || svg.clientHeight || 420;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = pngUrl;
        link.download = `${relatedModel.name}-chart.png`;
        link.click();
        URL.revokeObjectURL(pngUrl);
      }, "image/png");
    };
    img.src = url;
  };
  const exportChartPdf = () => {
    const svg = chartSvgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const width = svg.viewBox.baseVal.width || svg.clientWidth || 1e3;
      const height = svg.viewBox.baseVal.height || svg.clientHeight || 420;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL("image/png");
      const chartHeading = chartTitle || `${relatedModel.label} Chart`;
      openPdfWindow(
        `${relatedModel.name}-chart`,
        `<h2>${escapeHtml(chartHeading)}</h2><img src="${dataUrl}" style="width: 100%; height: auto;" />`
      );
    };
    img.src = url;
  };
  const exportStatsPdf = () => {
    openPdfWindow(`${relatedModel.name}-stats`, buildStatsHtml(statsSummary));
  };
  const columnFilters = useMemo(() => {
    const data = filteredRows || [];
    const limit = 50;
    const filtersMap = /* @__PURE__ */ new Map();
    for (const field of displayFields) {
      const seen = /* @__PURE__ */ new Set();
      const options = [];
      for (const recordRow of data) {
        let value = recordRow?.[field.key];
        let label = value;
        if (field.key === "eid" && recordRow?._label) {
          value = recordRow.eid;
          label = recordRow._label;
        }
        if (value === void 0 || value === null) continue;
        const key = String(value);
        if (seen.has(key)) continue;
        seen.add(key);
        options.push({ text: String(label), value: key });
        if (options.length >= limit) break;
      }
      filtersMap.set(field.key, options);
    }
    return filtersMap;
  }, [displayFields, filteredRows]);
  const allFieldOptions = useMemo(() => {
    return relatedModel.fields.map((field) => ({ label: field.label, value: field.key }));
  }, [relatedModel.fields]);
  const orderedSelectedColumns = useMemo(() => {
    if (!selectedColumnKeys || selectedColumnKeys.length === 0) return [];
    return orderedColumnKeys && orderedColumnKeys.length > 0 ? orderedColumnKeys : selectedColumnKeys;
  }, [orderedColumnKeys, selectedColumnKeys]);
  const syncColumnsSelectionToDisplay = useCallback(() => {
    const keys = displayFields.map((field) => field.key);
    if (keys.length === 0) return;
    setSelectedColumnKeys(keys);
    setColumnOrder(columnOrder && columnOrder.length > 0 ? columnOrder : keys);
  }, [columnOrder, displayFields]);
  useEffect(() => {
    if (selectedColumnKeys !== null) return;
    const defaults = defaultDisplayFields.map((field) => field.key);
    if (defaults.length === 0) return;
    setSelectedColumnKeys(defaults);
    setColumnOrder(defaults);
  }, [defaultDisplayFields, selectedColumnKeys]);
  const handleColumnSelectionChange = useCallback((values) => {
    markLayoutPrefsTouched();
    if (!values || values.length === 0) {
      setSelectedColumnKeys(null);
      setColumnOrder(null);
      return;
    }
    setSelectedColumnKeys(values);
    setColumnOrder((prev) => {
      const baseOrder = prev && prev.length > 0 ? prev.filter((key) => values.includes(key)) : [];
      const missing = values.filter((key) => !baseOrder.includes(key));
      return [...baseOrder, ...missing];
    });
  }, [markLayoutPrefsTouched]);
  const moveColumnOrder = useCallback((key, direction) => {
    setColumnOrder((prev) => {
      const base = prev && prev.length > 0 ? [...prev] : selectedColumnKeys ? [...selectedColumnKeys] : [];
      const index = base.indexOf(key);
      if (index === -1) return base;
      const swapIndex = direction === "left" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= base.length) return base;
      [base[index], base[swapIndex]] = [base[swapIndex], base[index]];
      return base;
    });
  }, [selectedColumnKeys]);
  const statsSummary = useMemo(() => {
    return buildStatsSummary(filteredRows, displayFields, labelCache);
  }, [filteredRows, displayFields, labelCache]);
  const isTotalsDetailsVariant = viewVariant === "totals-details";
  const getDefaultTotalsSummaryFn = useCallback((field) => {
    if (field.key === "eid") return "count";
    return "sum";
  }, []);
  const resolveTotalsSummaryFn = useCallback((field) => {
    return totalsSummaryFunctions[field.key] || getDefaultTotalsSummaryFn(field);
  }, [getDefaultTotalsSummaryFn, totalsSummaryFunctions]);
  const computeTotalsSummaryValue = useCallback((field) => {
    const fn = resolveTotalsSummaryFn(field);
    const rawValues = filteredRows.map((row) => row?.[field.key]);
    if (field.type === "number" && !field.reference) {
      const numericValues = rawValues.map((value) => Number(value)).filter((value) => !Number.isNaN(value) && Number.isFinite(value));
      if (fn === "count") return numericValues.length;
      if (numericValues.length === 0) return 0;
      if (fn === "avg") return numericValues.reduce((acc, val) => acc + val, 0) / numericValues.length;
      if (fn === "max") return Math.max(...numericValues);
      if (fn === "min") return Math.min(...numericValues);
      if (fn === "stddev") {
        const mean = numericValues.reduce((acc, val) => acc + val, 0) / numericValues.length;
        const variance = numericValues.reduce((acc, val) => acc + (val - mean) ** 2, 0) / numericValues.length;
        return Math.sqrt(variance);
      }
      return numericValues.reduce((acc, val) => acc + val, 0);
    }
    if (fn === "distinct") {
      const distinct = new Set(rawValues.map((value) => String(value ?? "-")));
      return distinct.size;
    }
    return rawValues.length;
  }, [filteredRows, resolveTotalsSummaryFn]);
  const formatCategoricalBoxValue = useCallback((field, raw) => {
    if (raw === void 0 || raw === null) return "-";
    if (field.reference) {
      const cacheKey = `${field.reference}:${raw}`;
      return labelCache[cacheKey] || String(raw);
    }
    if (field.options) {
      return field.options.find((option) => option.value === raw)?.label || String(raw);
    }
    if (field.type === "boolean") return raw ? _30("Yes") : _30("No");
    if (field.type === "date") return formatDateValue(raw);
    return String(raw);
  }, [labelCache]);
  const totalsDetailsCategoricalBoxes = useMemo(() => {
    return displayFields.filter((field) => field.type !== "number" || Boolean(field.reference)).map((field) => {
      const counts = /* @__PURE__ */ new Map();
      filteredRows.forEach((row) => {
        const label = formatCategoricalBoxValue(field, row?.[field.key]);
        counts.set(label, (counts.get(label) || 0) + 1);
      });
      const breakdown = Array.from(counts.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
      const showBreakdown = breakdown.length > 0 && breakdown.length < 5;
      return {
        key: field.key,
        label: field.label,
        value: breakdown.length,
        breakdown,
        showBreakdown
      };
    });
  }, [displayFields, filteredRows, formatCategoricalBoxValue]);
  const totalsDetailsNumericBoxes = useMemo(() => {
    return displayFields.filter((field) => field.type === "number" && !field.reference).map((field) => {
      return {
        key: field.key,
        label: field.label,
        value: computeTotalsSummaryValue(field),
        summaryFn: resolveTotalsSummaryFn(field)
      };
    });
  }, [computeTotalsSummaryValue, displayFields, resolveTotalsSummaryFn]);
  const totalsSummaryConfigFields = useMemo(() => {
    return displayFields.filter((field) => field.type === "number" && !field.reference);
  }, [displayFields]);
  useEffect(() => {
    setTotalsSummaryFunctions((prev) => {
      const next = { ...prev };
      let changed = false;
      totalsSummaryConfigFields.forEach((field) => {
        if (!next[field.key]) {
          next[field.key] = getDefaultTotalsSummaryFn(field);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [getDefaultTotalsSummaryFn, totalsSummaryConfigFields]);
  const statsNumericMaxes = useMemo(() => {
    const stats = statsSummary.numericStats;
    const maxAbs = (values) => {
      const absValues = values.filter((val) => typeof val === "number").map((val) => Math.abs(val));
      return absValues.length > 0 ? Math.max(...absValues) : 0;
    };
    return {
      sum: maxAbs(stats.map((row) => row.sum)),
      avg: maxAbs(stats.map((row) => row.avg)),
      min: maxAbs(stats.map((row) => row.min)),
      max: maxAbs(stats.map((row) => row.max)),
      stddev: maxAbs(stats.map((row) => row.stddev))
    };
  }, [statsSummary.numericStats]);
  useEffect(() => {
    if (isTotalsDetailsVariant) {
      setIsTotalsDetailsFlipped(false);
    }
  }, [currentViewName, isTotalsDetailsVariant]);
  if (loading) return /* @__PURE__ */ jsx(Spin, { size: "small" });
  if (error) return /* @__PURE__ */ jsx(Alert, { type: "error", message: error, showIcon: true });
  const getSummaryFunctionDisplayText = (fn) => {
    if (!fn) return "";
    const labels = {
      sum: _30("Sum"),
      avg: _30("Average"),
      count: _30("Count"),
      max: _30("Max"),
      min: _30("Min"),
      stddev: _30("Std Dev"),
      distinct: _30("Distinct")
    };
    return labels[fn] || fn;
  };
  const renderTotalsBoxes = (keyPrefix = "") => {
    const hasCategoricalBoxes = totalsDetailsCategoricalBoxes.length > 0;
    const hasNumericBoxes = totalsDetailsNumericBoxes.length > 0;
    if (!hasCategoricalBoxes && !hasNumericBoxes) return null;
    const categoricalTone = {
      soft: "#fde68a",
      softer: "#fffbeb",
      text: "#92400e",
      chipBg: "#ffffff"
    };
    const numericTone = relatedModelTone;
    return /* @__PURE__ */ jsxs("div", { style: { marginBottom: 12, borderRadius: 8, padding: 10, background: token.colorBgContainer }, children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
        /* @__PURE__ */ jsx("div", { style: { overflowX: "auto", paddingBottom: 2, flex: 1, minWidth: 0 }, children: /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              width: "max-content",
              minWidth: "100%",
              display: "flex",
              justifyContent: "center",
              gap: 12,
              alignItems: "stretch"
            },
            children: [
              hasCategoricalBoxes && /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 8, flexWrap: "nowrap", alignItems: "stretch" }, children: totalsDetailsCategoricalBoxes.map((item) => /* @__PURE__ */ jsxs(
                Card,
                {
                  size: "small",
                  variant: "borderless",
                  style: { minWidth: 170, borderRadius: 8, background: `linear-gradient(165deg, ${categoricalTone.softer} 0%, ${categoricalTone.soft} 100%)` },
                  styles: { body: { padding: 10 } },
                  children: [
                    /* @__PURE__ */ jsx("div", { style: { fontSize: 12, fontWeight: 400, color: categoricalTone.text, textAlign: "center", marginTop: 2 }, children: item.label }),
                    item.showBreakdown ? /* @__PURE__ */ jsx("div", { style: { display: "grid", gap: 4, marginTop: 8 }, children: item.breakdown.map((entry) => /* @__PURE__ */ jsx(
                      "div",
                      {
                        style: {
                          fontSize: 12,
                          color: categoricalTone.text,
                          fontWeight: 400,
                          textAlign: "center",
                          borderRadius: 8,
                          background: categoricalTone.chipBg,
                          padding: "2px 8px"
                        },
                        children: `${entry.value}: ${formatNumberValue(entry.count)}`
                      },
                      `${keyPrefix}${item.key}-${entry.value}`
                    )) }) : /* @__PURE__ */ jsx("div", { style: { fontSize: 24, fontWeight: 400, color: categoricalTone.text, textAlign: "center", marginTop: 4 }, children: formatNumberValue(item.value) })
                  ]
                },
                `${keyPrefix}${item.key}`
              )) }),
              hasCategoricalBoxes && hasNumericBoxes && /* @__PURE__ */ jsx("div", { style: { borderLeft: `1px solid ${token.colorBorderSecondary}`, margin: "0 2px" } }),
              hasNumericBoxes && /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 8, flexWrap: "nowrap", alignItems: "stretch" }, children: totalsDetailsNumericBoxes.map((item) => /* @__PURE__ */ jsxs(
                Card,
                {
                  size: "small",
                  variant: "borderless",
                  style: { minWidth: 170, borderRadius: 8, background: `linear-gradient(165deg, ${numericTone.softer} 0%, ${numericTone.soft} 100%)` },
                  styles: { body: { padding: 10 } },
                  children: [
                    /* @__PURE__ */ jsx("div", { style: { fontSize: 12, fontWeight: 400, color: numericTone.text, textAlign: "center", marginTop: 2 }, children: item.summaryFn && item.summaryFn !== "sum" ? `${item.label} (${getSummaryFunctionDisplayText(item.summaryFn)})` : item.label }),
                    /* @__PURE__ */ jsx("div", { style: { fontSize: 24, fontWeight: 400, color: numericTone.solid, textAlign: "center", marginTop: 4, fontVariantNumeric: "tabular-nums" }, children: formatNumberValue(item.value) })
                  ]
                },
                `${keyPrefix}${item.key}`
              )) })
            ]
          }
        ) }),
        /* @__PURE__ */ jsx(Tooltip, { title: isTotalsDetailsFlipped ? _30("Show totals") : _30("Show details"), children: /* @__PURE__ */ jsx(
          Button,
          {
            size: "small",
            icon: /* @__PURE__ */ jsx(SwapOutlined, { style: { transform: "rotate(90deg)" } }),
            "aria-label": isTotalsDetailsFlipped ? _30("Show totals") : _30("Show details"),
            onClick: () => setIsTotalsDetailsFlipped((prev) => !prev),
            style: {
              flexShrink: 0,
              background: relatedModelTone.soft,
              borderColor: relatedModelTone.border,
              color: relatedModelTone.text
            }
          }
        ) })
      ] }),
      relationRowsCapped && /* @__PURE__ */ jsxs("div", { style: { marginTop: 8, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ jsx(Typography.Text, { type: "secondary", style: { fontSize: 12 }, children: _30("Only the first N rows are loaded").replace("N", formatNumberValue(loadedRowsCount || relationsMaxRowsToLoad)) }),
        /* @__PURE__ */ jsx(
          Button,
          {
            size: "small",
            style: { color: relatedModelTone.text, background: relatedModelTone.soft, border: "none", borderRadius: 8 },
            onClick: () => {
              setCurrentPage(1);
              setFullDataLoaded(false);
              setLoadAllRelatedRequested(true);
            },
            children: _30("Load all related")
          }
        )
      ] })
    ] });
  };
  return /* @__PURE__ */ jsxs("div", { className: "jm-tone-scope", style: toneScopeStyle(relatedModelTone), children: [
    /* @__PURE__ */ jsx(ToneSharedStyles, {}),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }, children: [
      /* @__PURE__ */ jsx("div", { style: { minHeight: 22, display: "flex", alignItems: "center" }, children: title && /* @__PURE__ */ jsx(Title5, { level: 5, style: { color: relatedModelTone.text, margin: 0 }, children: title }) }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8 }, children: [
        /* @__PURE__ */ jsx(Tooltip, { title: columnsSelectorOpen ? _30("Hide view configuration") : _30("Show view configuration"), children: /* @__PURE__ */ jsx(
          Button,
          {
            size: "small",
            icon: /* @__PURE__ */ jsx(SettingOutlined, {}),
            onClick: () => {
              setColumnsSelectorOpen((prev) => {
                const next = !prev;
                if (next) syncColumnsSelectionToDisplay();
                return next;
              });
            },
            "aria-label": columnsSelectorOpen ? _30("Hide view configuration") : _30("Show view configuration")
          }
        ) }),
        showCreate && recordId !== void 0 && recordId !== null && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Tooltip, { title: rel.otherResource && rel.otherKey ? _30("Associate existing") : _30("Add relation"), children: /* @__PURE__ */ jsx(
            Button,
            {
              size: "small",
              icon: /* @__PURE__ */ jsx(PlusOutlined, {}),
              onClick: (e) => {
                e.preventDefault();
                if (rel.otherResource && rel.otherKey && rel.targetKey) {
                  const params = new URLSearchParams();
                  const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
                  const relatedModel2 = findModelByName(allModels, rel.otherResource || rel.otherResourcePath);
                  const relatedResource = relatedModel2 ? resolveResourcePath(relatedModel2.resource || relatedModel2.name, allModels) : null;
                  if (!relatedResource) return;
                  params.append("select_mode", "1");
                  params.append("relate_resource", relationResource);
                  params.append("relate_target_key", rel.targetKey);
                  params.append("relate_other_key", rel.otherKey);
                  params.append("relate_target_id", String(recordId));
                  const returnTo = `${location.pathname}${location.search}${location.hash}`;
                  if (returnTo.startsWith("/")) params.append("returnTo", returnTo);
                  navigate(`/${relatedResource}?${params.toString()}`);
                } else {
                  const params = new URLSearchParams();
                  if (rel.targetKey) params.append(rel.targetKey, String(recordId));
                  const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
                  if (allowInlineEdit) params.append("inline", "1");
                  const returnTo = `${location.pathname}${location.search}${location.hash}`;
                  if (returnTo.startsWith("/")) params.append("returnTo", returnTo);
                  navigate(`/${relationResource}/create?${params.toString()}`);
                }
              }
            }
          ) }),
          rel.otherResource && rel.otherKey && rel.targetKey && /* @__PURE__ */ jsx(Tooltip, { title: _30("Create new and relate"), children: /* @__PURE__ */ jsx(
            Button,
            {
              size: "small",
              icon: /* @__PURE__ */ jsx(ShareAltOutlined, {}),
              onClick: (e) => {
                e.preventDefault();
                const otherKey = rel.otherKey;
                if (!otherKey) return;
                const params = new URLSearchParams();
                const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
                const relatedModel2 = findModelByName(allModels, rel.otherResource || rel.otherResourcePath);
                const relatedResource = relatedModel2 ? resolveResourcePath(relatedModel2.resource || relatedModel2.name, allModels) : null;
                if (!relatedResource) {
                  message.warning(_30("No create route for the related model. Opening relation create form."));
                  params.append(rel.targetKey, String(recordId));
                  if (allowInlineEdit) params.append("inline", "1");
                  const returnTo2 = `${location.pathname}${location.search}${location.hash}`;
                  if (returnTo2.startsWith("/")) params.append("returnTo", returnTo2);
                  navigate(`/${relationResource}/create?${params.toString()}`);
                  return;
                }
                params.append("relate_resource", relationResource);
                params.append("relate_target_key", rel.targetKey);
                params.append("relate_other_key", otherKey);
                params.append("relate_target_id", String(recordId));
                const returnTo = `${location.pathname}${location.search}${location.hash}`;
                if (returnTo.startsWith("/")) params.append("returnTo", returnTo);
                navigate(`/${relatedResource}/create?${params.toString()}`);
              }
            }
          ) })
        ] }),
        allowInlineEdit && /* @__PURE__ */ jsx(Tooltip, { title: _30("Save"), children: /* @__PURE__ */ jsx(
          Button,
          {
            size: "small",
            type: "primary",
            icon: /* @__PURE__ */ jsx(SaveOutlined, {}),
            onClick: saveAllEdits,
            loading: savingAll,
            "aria-label": _30("Save")
          }
        ) }),
        /* @__PURE__ */ jsx(Tooltip, { title: _30("Export CSV"), children: /* @__PURE__ */ jsx(
          Button,
          {
            size: "small",
            icon: /* @__PURE__ */ jsx(DownloadOutlined, {}),
            onClick: () => setExportRequested(true),
            loading: exportRequested
          }
        ) })
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      Modal,
      {
        open: saveViewModalOpen,
        title: _30("Save view"),
        onCancel: () => {
          setSaveViewModalOpen(false);
          setPendingSaveTarget(null);
        },
        onOk: handleConfirmSaveView,
        okText: pendingSaveTarget === "layout" ? _30("Save layout") : _30("Save analyze"),
        okButtonProps: { disabled: !pendingSaveTarget },
        children: /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 12 }, children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }, children: _30("View name") }),
            /* @__PURE__ */ jsx(Input, { value: saveViewName, onChange: (event) => setSaveViewName(event.target.value) })
          ] }),
          /* @__PURE__ */ jsx(Checkbox, { checked: saveViewAsNew, onChange: (event) => setSaveViewAsNew(event.target.checked), children: _30("Save as new view") })
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      Modal,
      {
        open: renameViewModalOpen,
        title: _30("Rename view"),
        onCancel: () => setRenameViewModalOpen(false),
        onOk: handleRenameView,
        okText: _30("Rename"),
        children: /* @__PURE__ */ jsx(Input, { value: renameViewName, onChange: (event) => setRenameViewName(event.target.value) })
      }
    ),
    relatedViewTabsNode,
    !filtersCollapsed && /* @__PURE__ */ jsx(
      Card,
      {
        size: "small",
        title: /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }, children: [
          /* @__PURE__ */ jsx("span", { style: { color: token.colorTextSecondary, fontSize: 12, fontWeight: 600 }, children: _30("Filters") }),
          /* @__PURE__ */ jsx("div", { style: { display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end" }, children: /* @__PURE__ */ jsx(
            Input,
            {
              placeholder: _30("Search all fields..."),
              prefix: /* @__PURE__ */ jsx(SearchOutlined, {}),
              allowClear: true,
              value: localSearch,
              onChange: (event) => setLocalSearch(event.target.value),
              style: { minWidth: 240, maxWidth: 420 }
            }
          ) })
        ] }),
        style: { marginBottom: 16 },
        styles: { body: { display: "grid", gap: 12 } },
        children: /* @__PURE__ */ jsx(Fragment, {})
      }
    ),
    columnsSelectorOpen && /* @__PURE__ */ jsxs(
      Card,
      {
        size: "small",
        title: /* @__PURE__ */ jsx("span", { style: { color: token.colorTextSecondary, fontSize: 12, fontWeight: 600 }, children: _30("View configuration") }),
        style: { marginBottom: 16 },
        styles: { body: { display: "grid", gap: 12 } },
        children: [
          /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 12 }, children: [
            /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 8 }, children: [
              /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, fontWeight: 600 }, children: _30("Advanced filters") }),
              filterRules.length === 0 ? /* @__PURE__ */ jsx("div", { style: { color: token.colorTextSecondary, fontSize: 12 }, children: _30("No filters yet.") }) : filterRules.map((rule) => {
                const field = relatedModel.fields.find((f) => f.key === rule.fieldKey);
                const type = field?.type || "string";
                const operatorOptions = type === "number" ? [
                  { label: _30("="), value: "eq" },
                  { label: _30(">"), value: "gt" },
                  { label: _30(">="), value: "gte" },
                  { label: _30("<"), value: "lt" },
                  { label: _30("<="), value: "lte" },
                  { label: _30("Between"), value: "between" }
                ] : type === "date" ? [
                  { label: _30("On"), value: "on" },
                  { label: _30("After"), value: "after" },
                  { label: _30("Before"), value: "before" },
                  { label: _30("Between"), value: "between" }
                ] : type === "boolean" ? [{ label: _30("Is"), value: "is" }] : [
                  { label: _30("Contains"), value: "contains" },
                  { label: _30("Equals"), value: "equals" }
                ];
                const renderDateInput = (value, onChange) => {
                  const mode = value?.mode || "absolute";
                  if (mode === "relative") {
                    return /* @__PURE__ */ jsxs(Space, { wrap: true, children: [
                      /* @__PURE__ */ jsx(InputNumber, { min: 1, value: value?.count ?? 1, onChange: (val) => onChange({ ...value, mode: "relative", count: val ?? 1 }) }),
                      /* @__PURE__ */ jsx(
                        Select,
                        {
                          value: value?.direction || "next",
                          onChange: (val) => onChange({ ...value, mode: "relative", direction: val }),
                          options: [
                            { label: _30("Previous"), value: "previous" },
                            { label: _30("Current"), value: "current" },
                            { label: _30("Next"), value: "next" }
                          ]
                        }
                      ),
                      /* @__PURE__ */ jsx(
                        Select,
                        {
                          value: value?.unit || "weeks",
                          onChange: (val) => onChange({ ...value, mode: "relative", unit: val }),
                          options: [
                            { label: _30("Days"), value: "days" },
                            { label: _30("Weeks"), value: "weeks" },
                            { label: _30("Months"), value: "months" },
                            { label: _30("Quarters"), value: "quarters" },
                            { label: _30("Years"), value: "years" }
                          ]
                        }
                      )
                    ] });
                  }
                  return /* @__PURE__ */ jsx(
                    DatePicker,
                    {
                      value: value?.date ? dayjs7(value.date) : void 0,
                      onChange: (val) => onChange({ mode: "absolute", date: val ? val.toISOString() : null })
                    }
                  );
                };
                return /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }, children: [
                  /* @__PURE__ */ jsx(
                    Select,
                    {
                      style: { minWidth: 180 },
                      value: rule.fieldKey,
                      onChange: (value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, fieldKey: value, operator: void 0, value: void 0, value2: void 0 } : item)),
                      options: relatedModel.fields.map((f) => ({ label: f.label, value: f.key })),
                      placeholder: _30("Field")
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    Select,
                    {
                      style: { minWidth: 140 },
                      value: rule.operator,
                      onChange: (value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, operator: value } : item)),
                      options: operatorOptions,
                      placeholder: _30("Operator")
                    }
                  ),
                  type === "number" && rule.operator === "between" && /* @__PURE__ */ jsxs(Fragment, { children: [
                    /* @__PURE__ */ jsx(
                      InputNumber,
                      {
                        value: rule.value,
                        onChange: (value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value } : item))
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      InputNumber,
                      {
                        value: rule.value2,
                        onChange: (value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value2: value } : item))
                      }
                    )
                  ] }),
                  type === "number" && rule.operator !== "between" && /* @__PURE__ */ jsx(
                    InputNumber,
                    {
                      value: rule.value,
                      onChange: (value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value } : item))
                    }
                  ),
                  type === "boolean" && /* @__PURE__ */ jsx(
                    Select,
                    {
                      style: { minWidth: 120 },
                      value: rule.value,
                      onChange: (value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value } : item)),
                      options: [
                        { label: _30("True"), value: true },
                        { label: _30("False"), value: false }
                      ],
                      placeholder: _30("Value")
                    }
                  ),
                  type === "date" && rule.operator === "between" && /* @__PURE__ */ jsxs(Fragment, { children: [
                    renderDateInput(rule.value, (val) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value: val } : item))),
                    renderDateInput(rule.value2, (val) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value2: val } : item)))
                  ] }),
                  type === "date" && rule.operator !== "between" && renderDateInput(rule.value, (val) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value: val } : item))),
                  type === "string" && /* @__PURE__ */ jsx(
                    Input,
                    {
                      value: rule.value,
                      onChange: (event) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value: event.target.value } : item)),
                      placeholder: _30("Value"),
                      style: { minWidth: 200 }
                    }
                  ),
                  type === "date" && /* @__PURE__ */ jsx(
                    Select,
                    {
                      size: "small",
                      value: rule.value?.mode || "absolute",
                      onChange: (val) => {
                        setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value: { ...item.value || {}, mode: val } } : item));
                      },
                      options: [
                        { label: _30("Date"), value: "absolute" },
                        { label: _30("Relative"), value: "relative" }
                      ]
                    }
                  ),
                  type === "date" && rule.operator === "between" && /* @__PURE__ */ jsx(
                    Select,
                    {
                      size: "small",
                      value: rule.value2?.mode || "absolute",
                      onChange: (val) => {
                        setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value2: { ...item.value2 || {}, mode: val } } : item));
                      },
                      options: [
                        { label: _30("Date"), value: "absolute" },
                        { label: _30("Relative"), value: "relative" }
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    Button,
                    {
                      size: "small",
                      danger: true,
                      onClick: () => setFilterRules((prev) => prev.filter((item) => item.id !== rule.id)),
                      children: _30("Remove")
                    }
                  )
                ] }, rule.id);
              }),
              /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8 }, children: [
                /* @__PURE__ */ jsx(
                  Button,
                  {
                    size: "small",
                    icon: /* @__PURE__ */ jsx(FilterOutlined, {}),
                    onClick: () => setFilterRules((prev) => [...prev, { id: `${Date.now()}-${Math.random()}` }]),
                    children: _30("Add Filter")
                  }
                ),
                filterRules.length > 0 && /* @__PURE__ */ jsx(Button, { size: "small", onClick: () => setFilterRules([]), children: _30("Clear filters") })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 6 }, children: [
              /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, fontWeight: 600 }, children: _30("Views shown") }),
              /* @__PURE__ */ jsx(
                Select,
                {
                  mode: "multiple",
                  size: "small",
                  value: selectedViewNames,
                  onChange: (values) => {
                    const next = [
                      ...selectedViewNames.filter((name) => values.includes(name)),
                      ...values.filter((name) => !selectedViewNames.includes(name))
                    ];
                    updateSelectedViewNames(next);
                  },
                  loading: isLoadingViewNames,
                  options: availableViewNames.map((name) => ({ label: name, value: name })),
                  style: { minWidth: 240 }
                }
              ),
              selectedViewNames.length > 1 && /* @__PURE__ */ jsx("div", { style: { display: "grid", gap: 6 }, children: selectedViewNames.map((name, index) => /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                /* @__PURE__ */ jsx("div", { style: { flex: 1 }, children: name }),
                /* @__PURE__ */ jsx(Tooltip, { title: _30("Move up"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(ArrowUpOutlined, {}), disabled: index === 0, onClick: () => moveSelectedView(name, "up") }) }),
                /* @__PURE__ */ jsx(Tooltip, { title: _30("Move down"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(ArrowDownOutlined, {}), disabled: index === selectedViewNames.length - 1, onClick: () => moveSelectedView(name, "down") }) })
              ] }, name)) })
            ] }),
            /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 6 }, children: [
              /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, fontWeight: 600 }, children: _30("Active view") }),
              viewSelector
            ] }),
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }, children: [
              /* @__PURE__ */ jsx(
                Button,
                {
                  size: "small",
                  onClick: () => {
                    setRenameViewName(currentViewName);
                    setRenameViewModalOpen(true);
                  },
                  children: _30("Rename view")
                }
              ),
              /* @__PURE__ */ jsx(
                Button,
                {
                  size: "small",
                  danger: true,
                  icon: /* @__PURE__ */ jsx(DeleteOutlined, {}),
                  disabled: availableViewNames.length <= 1,
                  onClick: confirmDeleteView,
                  children: _30("Delete view")
                }
              ),
              layoutPreferenceType && /* @__PURE__ */ jsx(
                Button,
                {
                  size: "small",
                  icon: /* @__PURE__ */ jsx(SaveOutlined, {}),
                  onClick: () => openSaveViewModalFor("layout"),
                  loading: isSavingLayoutPrefs,
                  children: _30("Save layout")
                }
              ),
              /* @__PURE__ */ jsx(
                Button,
                {
                  size: "small",
                  icon: /* @__PURE__ */ jsx(FilterOutlined, {}),
                  onClick: () => {
                    markLayoutPrefsTouched();
                    setFiltersCollapsed((prev) => !prev);
                  },
                  children: filtersCollapsed ? _30("Show Filters") : _30("Hide Filters")
                }
              ),
              /* @__PURE__ */ jsx(
                Button,
                {
                  size: "small",
                  icon: /* @__PURE__ */ jsx(UnorderedListOutlined, {}),
                  onClick: () => {
                    markLayoutPrefsTouched();
                    setListVisible((prev) => !prev);
                  },
                  children: _30("View list")
                }
              ),
              /* @__PURE__ */ jsx(
                Button,
                {
                  size: "small",
                  icon: /* @__PURE__ */ jsx(BarChartOutlined, {}),
                  onClick: () => {
                    markLayoutPrefsTouched();
                    analyzeTouchedRef.current = true;
                    setIsStatsFlipped(false);
                    setAnalyzeOpen((prev) => !prev);
                  },
                  children: _30("Analyze")
                }
              ),
              /* @__PURE__ */ jsx(
                Button,
                {
                  size: "small",
                  icon: /* @__PURE__ */ jsx(ColumnHeightOutlined, {}),
                  onClick: () => {
                    markLayoutPrefsTouched();
                    setIsAnalyzeVertical((prev) => !prev);
                  },
                  children: _30("Switch orientation")
                }
              ),
              /* @__PURE__ */ jsx(
                Button,
                {
                  size: "small",
                  icon: /* @__PURE__ */ jsx(SwapOutlined, {}),
                  onClick: () => {
                    markLayoutPrefsTouched();
                    setIsAnalyzeFirst((prev) => !prev);
                  },
                  children: _30("Switch positions")
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 12 }, children: [
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }, children: [
              /* @__PURE__ */ jsx("span", { style: { color: token.colorTextSecondary, fontSize: 12, fontWeight: 600 }, children: _30("Columns") }),
              selectedColumnKeys && selectedColumnKeys.length > 0 && /* @__PURE__ */ jsx(Button, { size: "small", onClick: () => {
                setSelectedColumnKeys(null);
                setColumnOrder(null);
              }, children: _30("Reset to default") })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 6 }, children: _30("Select columns") }),
              /* @__PURE__ */ jsx(
                Checkbox.Group,
                {
                  value: selectedColumnKeys || [],
                  onChange: (values) => handleColumnSelectionChange(values),
                  options: allFieldOptions
                }
              ),
              (!selectedColumnKeys || selectedColumnKeys.length === 0) && /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginTop: 6 }, children: "Using default columns. Select fields to customize." })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 6 }, children: _30("Column order") }),
              orderedSelectedColumns.length === 0 ? /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary }, children: _30("No custom order yet.") }) : orderedSelectedColumns.map((key, index) => {
                const field = relatedModel.fields.find((item) => item.key === key);
                if (!field) return null;
                return /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }, children: [
                  /* @__PURE__ */ jsx("div", { style: { flex: 1 }, children: field.label }),
                  /* @__PURE__ */ jsx(Tooltip, { title: _30("Move left"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(ArrowLeftOutlined, {}), disabled: index === 0, onClick: () => moveColumnOrder(key, "left") }) }),
                  /* @__PURE__ */ jsx(Tooltip, { title: _30("Move right"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(ArrowRightOutlined, {}), disabled: index === orderedSelectedColumns.length - 1, onClick: () => moveColumnOrder(key, "right") }) })
                ] }, key);
              })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 6 }, children: _30("Totals summary function") }),
              /* @__PURE__ */ jsx("div", { style: { display: "grid", gap: 6 }, children: totalsSummaryConfigFields.length === 0 ? /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary }, children: _30("No numeric fields available.") }) : totalsSummaryConfigFields.map((field) => {
                const options = [
                  { label: _30("Sum"), value: "sum" },
                  { label: _30("Average"), value: "avg" },
                  { label: _30("Count"), value: "count" },
                  { label: _30("Max"), value: "max" },
                  { label: _30("Min"), value: "min" },
                  { label: _30("Std Dev"), value: "stddev" }
                ];
                return /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                  /* @__PURE__ */ jsx("div", { style: { flex: 1 }, children: field.label }),
                  /* @__PURE__ */ jsx(
                    Select,
                    {
                      size: "small",
                      style: { minWidth: 150 },
                      value: resolveTotalsSummaryFn(field),
                      options,
                      onChange: (value) => {
                        markLayoutPrefsTouched();
                        setTotalsSummaryFunctions((prev) => ({ ...prev, [field.key]: value }));
                      }
                    }
                  )
                ] }, `summary-${field.key}`);
              }) })
            ] })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsxs("div", { style: listAnalyzeLayoutStyle, children: [
      listVisible && /* @__PURE__ */ jsxs("div", { style: listContainerStyle, children: [
        isTotalsDetailsVariant && renderTotalsBoxes(isTotalsDetailsFlipped ? "back-" : "front-"),
        (!isTotalsDetailsVariant || isTotalsDetailsFlipped) && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(
            Form,
            {
              form,
              component: false,
              onValuesChange: () => {
                if (allowInlineEdit) setHasPendingEdits(true);
              },
              children: /* @__PURE__ */ jsxs(
                Table,
                {
                  dataSource: filteredRows,
                  pagination: {
                    current: currentPage,
                    pageSize,
                    total: shouldUseFullDataMode ? filteredRows.length : serverTotalRows,
                    hideOnSinglePage: true,
                    showSizeChanger: true,
                    pageSizeOptions: ["10", "20", "50", "100"],
                    onChange: (page, newPageSize) => {
                      setCurrentPage(page);
                      if (newPageSize && newPageSize !== pageSize) {
                        setPageSize(newPageSize);
                        setCurrentPage(1);
                      }
                    },
                    onShowSizeChange: (_39, newPageSize) => {
                      if (newPageSize && newPageSize !== pageSize) {
                        setPageSize(newPageSize);
                        setCurrentPage(1);
                      }
                    }
                  },
                  size: "small",
                  rowKey: (row) => row?.__relationKey || row?.eid || row?.id || JSON.stringify(row),
                  locale: filteredRows.length === 0 ? { emptyText: /* @__PURE__ */ jsx("span", { style: { display: "inline-block", fontSize: 12, color: "#8c8c8c" }, children: _30("No related records") }) } : void 0,
                  onChange: (_39, filters, sorter, extra) => {
                    const nextFilters = {};
                    Object.entries(filters || {}).forEach(([key, values]) => {
                      if (!values) return;
                      nextFilters[key] = values.map((val) => String(val));
                    });
                    setColumnFiltersSelected(nextFilters);
                    if (extra?.action === "sort") {
                      const sortIntent = sortIntentRef.current;
                      sortIntentRef.current = null;
                      setColumnSort((prev) => resolveNextColumnSort(prev, sorter, sortIntent));
                    } else {
                      sortIntentRef.current = null;
                    }
                  },
                  children: [
                    allowInlineEdit && /* @__PURE__ */ jsx(
                      Table.Column,
                      {
                        title: rel.otherKey || "Related",
                        render: (_unused, row) => {
                          const id = row?.eid ?? row?.id;
                          if (!id) return "-";
                          return /* @__PURE__ */ jsx(
                            "a",
                            {
                              href: getShowHref(relatedModel.name, id, allModels),
                              onClick: (e) => {
                                if (!shouldHandleLinkClick(e)) return;
                                e.preventDefault();
                                if (paneNav?.isInMultiPane) {
                                  paneNav.openDetail(relatedModel.name, id);
                                } else {
                                  go({ to: { resource: relatedModel.name, action: "show", id } });
                                }
                              },
                              style: { cursor: "pointer", color: "inherit", textDecoration: "none" },
                              children: String(id)
                            }
                          );
                        }
                      },
                      "relation-link"
                    ),
                    displayFields.map((field) => /* @__PURE__ */ jsx(
                      Table.Column,
                      {
                        dataIndex: field.key,
                        title: field.label,
                        sorter: { compare: (a, b) => compareSortValues(field, a, b), multiple: getSortPriority(columnSort, field.key) },
                        filters: columnFilters.get(field.key),
                        filteredValue: columnFiltersSelected[field.key] || null,
                        sortOrder: columnSort.find((item) => item.fieldKey === field.key)?.order ?? null,
                        onHeaderCell: () => ({
                          onClick: (event) => {
                            sortIntentRef.current = {
                              fieldKey: field.key,
                              additive: event.ctrlKey || event.metaKey
                            };
                          }
                        }),
                        onFilter: (value, recordRow) => {
                          if (field.key === "eid" && recordRow?._label) {
                            return String(recordRow._label) === String(value) || String(recordRow.eid) === String(value);
                          }
                          const recordValue = recordRow?.[field.key];
                          return String(recordValue) === String(value);
                        },
                        align: field.type === "number" && !["eid", "eid_from", "eid_to"].includes(field.key) ? "right" : void 0,
                        render: (value, row) => {
                          if (allowInlineEdit && field.key !== "eid") {
                            const rowId = row?.eid ?? row?.id ?? row?.__relationKey;
                            return /* @__PURE__ */ jsx(
                              Form.Item,
                              {
                                name: [rowId, field.key],
                                style: { margin: 0 },
                                valuePropName: field.type === "boolean" ? "checked" : "value",
                                getValueProps: (val) => (field.type === "date" || field.type === "datetime") && val ? { value: dayjs7(val) } : field.type === "time" && val ? { value: dayjs7("1970-01-01T" + val) } : { value: val },
                                children: renderEditableInput(field, rowId)
                              }
                            );
                          }
                          const renderValue = () => {
                            if (field.reference && value) {
                              const cacheKey = `${field.reference}:${value}`;
                              return labelCache[cacheKey] || value;
                            }
                            if (field.key === "eid" && row._label) return row._label;
                            if (field.type === "boolean") return /* @__PURE__ */ jsx(Checkbox, { checked: value, disabled: true });
                            if (field.type === "number" && !field.reference) {
                              const formatted = formatNumberValue(value);
                              const maxValue = numericColumnMaxes[field.key] ?? 0;
                              return renderNumericValueBar(value, maxValue, formatted, numericBarColor);
                            }
                            if (field.type === "date") return formatDateValue(value);
                            if (field.options) return renderOptionTag(field, value);
                            return value ?? "-";
                          };
                          const id = row?.eid ?? row?.id;
                          if (!id) return renderValue();
                          return /* @__PURE__ */ jsx(
                            "a",
                            {
                              href: getShowHref(relatedModel.name, id, allModels),
                              onClick: (e) => {
                                if (!shouldHandleLinkClick(e)) return;
                                e.preventDefault();
                                if (paneNav?.isInMultiPane) {
                                  paneNav.openDetail(relatedModel.name, id);
                                } else {
                                  go({ to: { resource: relatedModel.name, action: "show", id } });
                                }
                              },
                              style: { cursor: "pointer", color: "inherit", textDecoration: "none" },
                              children: renderValue()
                            }
                          );
                        }
                      },
                      field.key
                    )),
                    showActions && /* @__PURE__ */ jsx(
                      Table.Column,
                      {
                        title: _30("Actions"),
                        width: 140,
                        render: (_unused, row) => {
                          const id = row?.eid ?? row?.id;
                          const relationRow = row?.__relationRow;
                          const deleteId = relationRow && rel.targetKey && rel.otherKey ? `${relationRow["eid_from"]}:${relationRow["eid_to"]}` : relationRow?.id ?? relationRow?.eid;
                          return /* @__PURE__ */ jsxs(Space, { children: [
                            id && /* @__PURE__ */ jsxs(Fragment, { children: [
                              /* @__PURE__ */ jsx(Tooltip, { title: _30("View"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(EyeOutlined, {}), onClick: () => {
                                if (paneNav?.isInMultiPane) {
                                  paneNav.openDetail(relatedModel.name, id);
                                } else {
                                  go({ to: { resource: relatedModel.name, action: "show", id } });
                                }
                              } }) }),
                              /* @__PURE__ */ jsx(Tooltip, { title: _30("Edit"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(EditOutlined, {}), onClick: () => {
                                if (allowInlineEdit) {
                                  const params = new URLSearchParams();
                                  params.append("inline", "1");
                                  const returnTo = `${location.pathname}${location.search}${location.hash}`;
                                  if (returnTo.startsWith("/")) params.append("returnTo", returnTo);
                                  navigate(`/${relatedResourcePath}/edit/${id}?${params.toString()}`);
                                } else {
                                  go({ to: { resource: relatedModel.name, action: "edit", id } });
                                }
                              } }) })
                            ] }),
                            deleteId && /* @__PURE__ */ jsx(Tooltip, { title: _30("Delete"), children: /* @__PURE__ */ jsx(
                              Button,
                              {
                                size: "small",
                                danger: true,
                                icon: /* @__PURE__ */ jsx(DeleteOutlined, {}),
                                onClick: () => handleDeleteRelationRow(row)
                              }
                            ) })
                          ] });
                        }
                      },
                      "actions"
                    )
                  ]
                }
              )
            }
          ),
          relationRowsCapped && /* @__PURE__ */ jsxs("div", { style: { marginTop: 8, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx(Typography.Text, { type: "secondary", style: { fontSize: 12 }, children: _30("Only the first N rows are loaded").replace("N", formatNumberValue(loadedRowsCount || relationsMaxRowsToLoad)) }),
            /* @__PURE__ */ jsx(
              Button,
              {
                size: "small",
                onClick: () => {
                  setCurrentPage(1);
                  setFullDataLoaded(false);
                  setLoadAllRelatedRequested(true);
                },
                children: _30("Load all related")
              }
            )
          ] })
        ] })
      ] }),
      analyzeOpen && filteredRows.length > 0 && analyzePrefsReady && /* @__PURE__ */ jsx("div", { style: analyzeContainerStyle, children: /* @__PURE__ */ jsx(
        Card,
        {
          size: "small",
          title: /* @__PURE__ */ jsx("span", { style: { color: relatedModelTone.text, fontWeight: 600 }, children: _30("Analyze") }),
          styles: {
            header: {
              background: `linear-gradient(135deg, ${relatedModelTone.solid}18 0%, ${relatedModelTone.solid}0a 100%)`
            },
            body: { padding: 0 }
          },
          children: /* @__PURE__ */ jsx("div", { style: { perspective: 1600, padding: 12 }, children: /* @__PURE__ */ jsxs(
            "div",
            {
              style: {
                display: "grid",
                transformStyle: "preserve-3d",
                transition: "transform 0.6s",
                transform: isStatsFlipped ? "rotateY(180deg)" : "rotateY(0deg)"
              },
              children: [
                /* @__PURE__ */ jsxs(
                  Card,
                  {
                    size: "small",
                    style: {
                      gridArea: "1 / 1",
                      backfaceVisibility: "hidden",
                      pointerEvents: isStatsFlipped ? "none" : "auto"
                    },
                    styles: { body: { display: "grid", gap: 16, position: "relative", paddingTop: 48 } },
                    children: [
                      /* @__PURE__ */ jsxs("div", { style: { position: "absolute", top: 0, right: 0, display: "flex", gap: 8 }, children: [
                        /* @__PURE__ */ jsx(Tooltip, { title: _30("Save preferences"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(SaveOutlined, {}), onClick: () => openSaveViewModalFor("analyze"), loading: isSavingAnalyzePrefs }) }),
                        /* @__PURE__ */ jsx(Tooltip, { title: _30("Stats"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(FileTextOutlined, {}), onClick: () => setIsStatsFlipped(true) }) }),
                        /* @__PURE__ */ jsx(Tooltip, { title: _30("Export chart PDF"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(FilePdfOutlined, {}), onClick: exportChartPdf }) }),
                        /* @__PURE__ */ jsx(Tooltip, { title: _30("Export chart PNG"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(DownloadOutlined, {}), onClick: exportChartImage, "aria-label": _30("Export chart") }) })
                      ] }),
                      /* @__PURE__ */ jsx(
                        AnalysisChart,
                        {
                          data: chartData.groups,
                          seriesKeys: chartData.seriesKeys,
                          seriesLabels: chartData.seriesLabels,
                          chartType,
                          svgRef: chartSvgRef,
                          animationKey: chartAnimationKey,
                          animationStage: chartAnimationStage,
                          rawRows: chartData.filteredRawRows,
                          numericFields,
                          categoryField1,
                          categoryField2,
                          formatCategoryValue,
                          summaryFn,
                          allFields: relatedModel.fields,
                          title: chartTitle,
                          numericBarColor
                        }
                      ),
                      /* @__PURE__ */ jsx(
                        Collapse,
                        {
                          size: "small",
                          defaultActiveKey: [],
                          items: [
                            {
                              key: "configure-chart",
                              label: _30("Customize chart"),
                              children: /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 16 }, children: [
                                /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 16, flexWrap: "wrap" }, children: [
                                  /* @__PURE__ */ jsxs("div", { style: { minWidth: 220, flex: 1 }, children: [
                                    /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }, children: _30("Category 1") }),
                                    /* @__PURE__ */ jsx(
                                      Select,
                                      {
                                        value: categoryField1 || void 0,
                                        onChange: (value) => {
                                          markAnalyzePrefsTouched();
                                          setCategoryField1(value);
                                        },
                                        style: { width: "100%" },
                                        options: categoricalFields.map((field) => ({ label: field.label, value: field.key })),
                                        placeholder: _30("Select category")
                                      }
                                    )
                                  ] }),
                                  /* @__PURE__ */ jsxs("div", { style: { minWidth: 220, flex: 1 }, children: [
                                    /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }, children: _30("Category 2") }),
                                    /* @__PURE__ */ jsx(
                                      Select,
                                      {
                                        value: categoryField2 || "__none__",
                                        onChange: (value) => {
                                          markAnalyzePrefsTouched();
                                          setCategoryField2(value === "__none__" ? null : value);
                                        },
                                        style: { width: "100%" },
                                        options: [
                                          { label: _30("None"), value: "__none__" },
                                          ...categoricalFields.filter((field) => field.key !== categoryField1).map((field) => ({ label: field.label, value: field.key }))
                                        ]
                                      }
                                    )
                                  ] }),
                                  /* @__PURE__ */ jsxs("div", { style: { minWidth: 160 }, children: [
                                    /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }, children: _30("Chart Type") }),
                                    /* @__PURE__ */ jsx(
                                      Select,
                                      {
                                        value: chartType,
                                        onChange: (value) => {
                                          markAnalyzePrefsTouched();
                                          setChartType(value);
                                        },
                                        style: { width: "100%" },
                                        options: [
                                          { label: _30("Area"), value: "area" },
                                          { label: _30("Horizontal Area"), value: "area-horizontal" },
                                          { label: _30("Bars"), value: "bar" },
                                          { label: _30("Stacked Bars"), value: "stacked" },
                                          { label: _30("Horizontal Bars"), value: "bar-horizontal" },
                                          { label: _30("Horizontal Stacked"), value: "stacked-horizontal" },
                                          { label: _30("Lines"), value: "line" },
                                          { label: _30("Pie"), value: "pie" },
                                          { label: _30("Donut"), value: "donut" },
                                          { label: _30("Scatter"), value: "scatter" },
                                          { label: _30("Bubble"), value: "bubble" },
                                          { label: _30("Histogram"), value: "histogram" },
                                          { label: _30("Box Plot"), value: "box" },
                                          { label: _30("Waterfall"), value: "waterfall" },
                                          { label: _30("Heatmap"), value: "heatmap" },
                                          { label: _30("Crosstab"), value: "crosstab" },
                                          { label: _30("Radar"), value: "radar" },
                                          { label: _30("Combo (Bar + Line)"), value: "combo" }
                                        ]
                                      }
                                    )
                                  ] }),
                                  /* @__PURE__ */ jsxs("div", { style: { minWidth: 200 }, children: [
                                    /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }, children: _30("Summary") }),
                                    /* @__PURE__ */ jsx(
                                      Select,
                                      {
                                        value: summaryFn,
                                        onChange: (value) => {
                                          markAnalyzePrefsTouched();
                                          setSummaryFn(value);
                                        },
                                        style: { width: "100%" },
                                        options: [
                                          { label: _30("Sum"), value: "sum" },
                                          { label: _30("Average"), value: "avg" },
                                          { label: _30("Count"), value: "count" },
                                          { label: _30("Max"), value: "max" },
                                          { label: _30("Min"), value: "min" },
                                          { label: _30("Std Dev"), value: "stddev" }
                                        ]
                                      }
                                    )
                                  ] }),
                                  /* @__PURE__ */ jsxs("div", { style: { minWidth: 180 }, children: [
                                    /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }, children: _30("Ranking Filter") }),
                                    /* @__PURE__ */ jsx(
                                      Select,
                                      {
                                        value: rankingMode,
                                        onChange: (value) => {
                                          markAnalyzePrefsTouched();
                                          setRankingMode(value);
                                        },
                                        style: { width: "100%" },
                                        options: [
                                          { label: _30("None"), value: "none" },
                                          { label: _30("Top N"), value: "top" },
                                          { label: _30("Bottom N"), value: "bottom" }
                                        ]
                                      }
                                    )
                                  ] }),
                                  /* @__PURE__ */ jsxs("div", { style: { minWidth: 220 }, children: [
                                    /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }, children: _30("Ranking Column") }),
                                    /* @__PURE__ */ jsx(
                                      Select,
                                      {
                                        value: rankingFieldKey || void 0,
                                        onChange: (value) => {
                                          markAnalyzePrefsTouched();
                                          setRankingFieldKey(value);
                                        },
                                        style: { width: "100%" },
                                        options: numericFields.map((field) => ({ label: field.label, value: field.key })),
                                        placeholder: _30("Select numeric column"),
                                        disabled: rankingMode === "none" || numericFields.length === 0
                                      }
                                    )
                                  ] }),
                                  /* @__PURE__ */ jsxs("div", { style: { minWidth: 120 }, children: [
                                    /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }, children: _30("N") }),
                                    /* @__PURE__ */ jsx(
                                      InputNumber,
                                      {
                                        min: 1,
                                        value: rankingN,
                                        onChange: (value) => {
                                          markAnalyzePrefsTouched();
                                          const nextN = Number(value);
                                          setRankingN(Number.isFinite(nextN) && nextN > 0 ? Math.floor(nextN) : 10);
                                        },
                                        style: { width: "100%" },
                                        disabled: rankingMode === "none"
                                      }
                                    )
                                  ] })
                                ] }),
                                /* @__PURE__ */ jsxs("div", { children: [
                                  /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6 }, children: [
                                    /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary }, children: _30("Series") }),
                                    /* @__PURE__ */ jsx(Tooltip, { title: _30("Unselect All"), children: /* @__PURE__ */ jsx(
                                      Button,
                                      {
                                        size: "small",
                                        icon: /* @__PURE__ */ jsx(CloseCircleOutlined, {}),
                                        onClick: () => {
                                          markAnalyzePrefsTouched();
                                          setSelectedSeriesKeys([]);
                                        }
                                      }
                                    ) })
                                  ] }),
                                  /* @__PURE__ */ jsx(
                                    Checkbox.Group,
                                    {
                                      value: selectedSeriesKeys || [],
                                      onChange: (values) => {
                                        markAnalyzePrefsTouched();
                                        setSelectedSeriesKeys(values);
                                      },
                                      options: numericFields.length > 0 ? numericFields.map((field) => ({ label: field.label, value: field.key })) : [{ label: _30("Count"), value: "__count__" }]
                                    }
                                  )
                                ] })
                              ] })
                            }
                          ]
                        }
                      )
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs(
                  Card,
                  {
                    size: "small",
                    style: {
                      gridArea: "1 / 1",
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                      pointerEvents: isStatsFlipped ? "auto" : "none"
                    },
                    styles: { body: { display: "grid", gap: 16, position: "relative", paddingTop: 48 } },
                    children: [
                      /* @__PURE__ */ jsxs("div", { style: { position: "absolute", top: 0, right: 0, display: "flex", gap: 8 }, children: [
                        /* @__PURE__ */ jsx(Tooltip, { title: _30("Analysis"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(BarChartOutlined, {}), onClick: () => setIsStatsFlipped(false) }) }),
                        /* @__PURE__ */ jsx(Tooltip, { title: _30("Export stats PDF"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(FilePdfOutlined, {}), onClick: exportStatsPdf }) })
                      ] }),
                      /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 16 }, children: [
                        statsSummary.numericStats.length > 0 && /* @__PURE__ */ jsx(Card, { size: "small", title: /* @__PURE__ */ jsx("span", { style: statsTitleStyle, children: _30("Numeric columns") }), children: /* @__PURE__ */ jsxs(
                          Table,
                          {
                            dataSource: statsSummary.numericStats,
                            size: "small",
                            pagination: false,
                            rowKey: (row) => row.key,
                            children: [
                              /* @__PURE__ */ jsx(
                                Table.Column,
                                {
                                  title: _30("Field"),
                                  dataIndex: "label",
                                  render: (label) => /* @__PURE__ */ jsx("span", { style: statsLabelStyle, children: label }),
                                  onHeaderCell: () => ({ style: statsHeaderStyle })
                                },
                                "label"
                              ),
                              /* @__PURE__ */ jsx(Table.Column, { title: _30("Sum"), align: "right", render: (_unused, row) => renderStatBar(row.sum, statsNumericMaxes.sum, formatNumberValue), onHeaderCell: () => ({ style: statsHeaderStyle }) }, "sum"),
                              /* @__PURE__ */ jsx(Table.Column, { title: _30("Average"), align: "right", render: (_unused, row) => renderStatBar(row.avg, statsNumericMaxes.avg, formatNumberValue), onHeaderCell: () => ({ style: statsHeaderStyle }) }, "avg"),
                              /* @__PURE__ */ jsx(Table.Column, { title: _30("Min"), align: "right", render: (_unused, row) => renderStatBar(row.min, statsNumericMaxes.min, formatNumberValue), onHeaderCell: () => ({ style: statsHeaderStyle }) }, "min"),
                              /* @__PURE__ */ jsx(Table.Column, { title: _30("Max"), align: "right", render: (_unused, row) => renderStatBar(row.max, statsNumericMaxes.max, formatNumberValue), onHeaderCell: () => ({ style: statsHeaderStyle }) }, "max"),
                              /* @__PURE__ */ jsx(Table.Column, { title: _30("Std Dev"), align: "right", render: (_unused, row) => renderStatBar(row.stddev, statsNumericMaxes.stddev, formatNumberValue), onHeaderCell: () => ({ style: statsHeaderStyle }) }, "stddev")
                            ]
                          }
                        ) }),
                        statsSummary.categoricalStats.length > 0 && /* @__PURE__ */ jsx(
                          Collapse,
                          {
                            size: "small",
                            defaultActiveKey: [],
                            items: [
                              {
                                key: "categorical-columns",
                                label: /* @__PURE__ */ jsx("span", { style: statsTitleStyle, children: _30("Categorical columns (distinct < 20)") }),
                                children: statsSummary.categoricalStats.map((field) => /* @__PURE__ */ jsxs("div", { style: { marginBottom: 12 }, children: [
                                  /* @__PURE__ */ jsx("div", { style: { fontWeight: 600, marginBottom: 4 }, children: /* @__PURE__ */ jsx("span", { style: statsLabelStyle, children: field.label }) }),
                                  /* @__PURE__ */ jsxs(
                                    Table,
                                    {
                                      dataSource: field.counts,
                                      size: "small",
                                      pagination: false,
                                      rowKey: (row) => row.value,
                                      children: [
                                        /* @__PURE__ */ jsx(Table.Column, { title: _30("Value"), dataIndex: "value", onHeaderCell: () => ({ style: statsHeaderStyle }) }, "value"),
                                        /* @__PURE__ */ jsx(
                                          Table.Column,
                                          {
                                            title: _30("Count"),
                                            dataIndex: "count",
                                            align: "right",
                                            onHeaderCell: () => ({ style: statsHeaderStyle }),
                                            render: (value) => {
                                              const maxCount = Math.max(1, ...field.counts.map((entry) => entry.count));
                                              return renderStatBar(value, maxCount, (val) => formatNumberValue(val));
                                            }
                                          },
                                          "count"
                                        )
                                      ]
                                    }
                                  )
                                ] }, field.key))
                              }
                            ]
                          }
                        )
                      ] })
                    ]
                  }
                )
              ]
            }
          ) })
        }
      ) })
    ] })
  ] });
};
var RelatedObjectSingleSelect = ({ rel, record, allModels, required }) => {
  const apiUrl = useApiUrl();
  const [currentLinkRow, setCurrentLinkRow] = useState(null);
  const [currentValue, setCurrentValue] = useState(null);
  const [loadingCurrent, setLoadingCurrent] = useState(true);
  const [saving, setSaving] = useState(false);
  const relatedResource = rel.otherResourcePath || resolveResourcePath(rel.otherResource || "", allModels);
  const linkResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
  const relatedModel = allModels?.find((m) => m.name === rel.otherResource);
  const relatedPkField = relatedModel?.fields.find((f) => f.isPk)?.key ?? "id";
  useEffect(() => {
    const recordId = getRecordId(record);
    if (!recordId || !rel.targetKey || !rel.otherKey) {
      setLoadingCurrent(false);
      return;
    }
    let isMounted = true;
    const load = async () => {
      setLoadingCurrent(true);
      try {
        const params = new URLSearchParams();
        params.set("_start", "0");
        params.set("_end", "2");
        params.set(rel.targetKey, String(recordId));
        const resp = await authenticatedFetch(`${apiUrl}/${linkResource}?${params.toString()}`);
        if (!resp.ok) return;
        const rows = await resp.json();
        if (!isMounted) return;
        if (Array.isArray(rows) && rows.length > 0) {
          const row = rows[0];
          setCurrentLinkRow(row);
          setCurrentValue(row[rel.otherKey] ?? null);
        } else {
          setCurrentLinkRow(null);
          setCurrentValue(null);
        }
      } finally {
        if (isMounted) setLoadingCurrent(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, getRecordId(record), rel.targetKey, rel.otherKey, linkResource]);
  const { selectProps } = useSelect({
    resource: relatedResource,
    optionLabel: "_label",
    optionValue: relatedPkField,
    filters: [],
    pagination: { current: 1, pageSize: 2e3, mode: "server" }
  });
  const handleChange = useCallback(async (newValue) => {
    const recordId = getRecordId(record);
    if (!recordId || !rel.otherKey) return;
    setSaving(true);
    try {
      if (currentLinkRow) {
        const linkId = getRecordId(currentLinkRow);
        const del = await authenticatedFetch(`${apiUrl}/${linkResource}/${linkId}`, { method: "DELETE" });
        if (!del.ok) throw new Error("Failed to remove existing relation");
      }
      if (newValue !== null && newValue !== void 0) {
        const payload = {};
        payload[rel.targetKey] = recordId;
        payload[rel.otherKey] = newValue;
        const create = await authenticatedFetch(`${apiUrl}/${linkResource}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!create.ok) throw new Error("Failed to create relation");
        const newRow = await create.json();
        setCurrentLinkRow(newRow);
      } else {
        setCurrentLinkRow(null);
      }
      setCurrentValue(newValue ?? null);
      message.success("Saved.");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to update relation");
    } finally {
      setSaving(false);
    }
  }, [apiUrl, currentLinkRow, linkResource, getRecordId(record), rel.otherKey, rel.targetKey]);
  if (loadingCurrent) return /* @__PURE__ */ jsx(Spin, { size: "small" });
  return /* @__PURE__ */ jsx(
    Select,
    {
      ...selectProps,
      value: currentValue ?? void 0,
      onChange: handleChange,
      loading: saving,
      allowClear: !required,
      showSearch: true,
      optionFilterProp: "label",
      style: { width: "100%" },
      placeholder: `Select ${rel.label}...`
    }
  );
};
var _31 = window._ || ((text) => text);
function useMillerColumnItems({
  parentId,
  rel,
  allModels,
  apiUrl
}) {
  const [branches, setBranches] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!parentId || !rel.resourcePath || !rel.targetKey || !rel.otherKey || !rel.otherResource) {
      setBranches([]);
      setLeaves([]);
      return;
    }
    let isMounted = true;
    const controller = new AbortController();
    const { signal } = controller;
    const bulkRead = async (resourcePath, ids) => {
      if (ids.length === 0) return [];
      try {
        const res = await authenticatedFetch(`${apiUrl}/_meta/bulk-read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resource: resourcePath, ids }),
          signal
        });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data?.items) ? data.items : [];
      } catch {
        return [];
      }
    };
    const fetchPage = async (path, filterKey) => {
      const params = new URLSearchParams();
      params.set("_start", "0");
      params.set("_end", "500");
      params.append(filterKey, String(parentId));
      const res = await authenticatedFetch(`${apiUrl}/${path}?${params}`, { signal });
      if (!res.ok) return [];
      const rows = await res.json();
      return Array.isArray(rows) ? rows : [];
    };
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const branchLinkRows = await fetchPage(rel.resourcePath, rel.targetKey);
        let branchItems = [];
        if (branchLinkRows.length > 0) {
          const branchIds = Array.from(new Set(
            branchLinkRows.map((r) => r[rel.otherKey]).filter(Boolean)
          ));
          const branchResourcePath = rel.otherResourcePath || resolveResourcePath(rel.otherResource, allModels);
          const isSelfReferential = rel.resourcePath === branchResourcePath;
          const branchRecords = isSelfReferential ? branchLinkRows : await bulkRead(branchResourcePath, branchIds);
          const branchById = new Map(branchRecords.map((r) => [r.eid ?? r.id, r]));
          branchItems = branchLinkRows.map((linkRow) => {
            const childId = linkRow[rel.otherKey];
            const rec = branchById.get(childId);
            if (!rec) return null;
            return {
              id: rec.eid ?? rec.id ?? childId,
              label: getRecordDisplayLabel(rec),
              isBranch: true,
              resource: resolveModelName(rel.otherResource, allModels),
              resourcePath: branchResourcePath
            };
          }).filter(Boolean);
        }
        const leafConfigs = rel.millerLeafConfigs && rel.millerLeafConfigs.length > 0 ? rel.millerLeafConfigs : rel.millerLeafRelationPath && rel.millerLeafTargetKey && rel.millerLeafOtherKey && rel.millerLeafResource ? [{
          relationPath: rel.millerLeafRelationPath,
          targetKey: rel.millerLeafTargetKey,
          otherKey: rel.millerLeafOtherKey,
          resource: rel.millerLeafResource,
          resourcePath: rel.millerLeafResourcePath
        }] : [];
        let leafItems = [];
        if (leafConfigs.length > 0) {
          const leafResults = await Promise.all(leafConfigs.map(async (cfg) => {
            const leafLinkRows = await fetchPage(cfg.relationPath, cfg.targetKey);
            if (leafLinkRows.length === 0) return [];
            const leafIds = Array.from(new Set(
              leafLinkRows.map((r) => r[cfg.otherKey]).filter(Boolean)
            ));
            const leafResourcePath = cfg.resourcePath || resolveResourcePath(cfg.resource, allModels);
            const leafRecords = await bulkRead(leafResourcePath, leafIds);
            const leafById = new Map(leafRecords.map((r) => [r.eid ?? r.id, r]));
            return leafLinkRows.map((linkRow) => {
              const leafId = linkRow[cfg.otherKey];
              const rec = leafById.get(leafId);
              if (!rec) return null;
              return {
                id: rec.eid ?? rec.id ?? leafId,
                label: getRecordDisplayLabel(rec),
                isBranch: false,
                resource: resolveModelName(cfg.resource, allModels),
                resourcePath: leafResourcePath
              };
            }).filter(Boolean);
          }));
          const seenIds = /* @__PURE__ */ new Set();
          leafItems = leafResults.flat().filter((item) => {
            if (seenIds.has(item.id)) return false;
            seenIds.add(item.id);
            return true;
          });
        }
        if (isMounted) {
          setBranches(branchItems);
          setLeaves(leafItems);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (isMounted) {
          setError(err instanceof Error ? err.message : _31("Failed to load items"));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchAll();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [
    apiUrl,
    parentId,
    rel.resourcePath,
    rel.targetKey,
    rel.otherKey,
    rel.otherResource,
    rel.otherResourcePath,
    rel.millerLeafRelationPath,
    rel.millerLeafTargetKey,
    rel.millerLeafOtherKey,
    rel.millerLeafResource,
    rel.millerLeafResourcePath,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(rel.millerLeafConfigs)
  ]);
  return { branches, leaves, loading, error };
}
var MillerColumn = ({
  parentId,
  rel,
  selectedId,
  allModels,
  onBranchClick,
  onLeafClick,
  height,
  width,
  onResizeStart
}) => {
  const apiUrl = useApiUrl();
  const { token } = theme.useToken();
  const { branches, leaves, loading, error } = useMillerColumnItems({ parentId, rel, allModels, apiUrl });
  const items = [...branches, ...leaves];
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexShrink: 0, height, width }, children: [
    /* @__PURE__ */ jsxs("div", { style: { flex: 1, minWidth: 0, overflowY: "auto", backgroundColor: token.colorBgContainer }, children: [
      loading && /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "center", paddingTop: 32 }, children: /* @__PURE__ */ jsx(Spin, { size: "small" }) }),
      !loading && error && /* @__PURE__ */ jsx("div", { style: { padding: "12px 16px", color: token.colorError, fontSize: 12 }, children: error }),
      !loading && !error && items.length === 0 && /* @__PURE__ */ jsx(
        Empty,
        {
          image: Empty.PRESENTED_IMAGE_SIMPLE,
          description: _31("No items"),
          style: { margin: "32px 0" }
        }
      ),
      items.map((item) => {
        const href = getShowHref(item.resource, item.id, allModels);
        const isSelected = selectedId === item.id;
        return /* @__PURE__ */ jsxs(
          "a",
          {
            href,
            title: item.label,
            onClick: (e) => {
              if (!shouldHandleLinkClick(e)) return;
              e.preventDefault();
              if (item.isBranch) onBranchClick(item);
              else onLeafClick(item);
            },
            style: {
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 12px",
              textDecoration: "none",
              color: isSelected ? token.colorPrimary : token.colorText,
              backgroundColor: isSelected ? token.colorPrimaryBg : "transparent",
              borderLeft: isSelected ? `3px solid ${token.colorPrimary}` : "3px solid transparent",
              cursor: "pointer",
              fontSize: 13,
              lineHeight: "20px",
              userSelect: "none"
            },
            onMouseEnter: (e) => {
              if (!isSelected) e.currentTarget.style.backgroundColor = token.colorFillAlter;
            },
            onMouseLeave: (e) => {
              if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
            },
            children: [
              item.isBranch ? /* @__PURE__ */ jsx(FolderOutlined, { style: { color: token.colorWarning, flexShrink: 0, fontSize: 13 } }) : /* @__PURE__ */ jsx(FileOutlined, { style: { color: token.colorTextTertiary, flexShrink: 0, fontSize: 13 } }),
              /* @__PURE__ */ jsx("span", { style: {
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }, children: item.label }),
              item.isBranch && /* @__PURE__ */ jsx(RightOutlined, { style: { fontSize: 10, color: token.colorTextQuaternary, flexShrink: 0 } })
            ]
          },
          `${item.isBranch ? "b" : "l"}-${item.id}`
        );
      })
    ] }),
    /* @__PURE__ */ jsx(
      "div",
      {
        onMouseDown: onResizeStart,
        style: {
          width: 5,
          flexShrink: 0,
          cursor: "col-resize",
          backgroundColor: token.colorFillAlter,
          borderLeft: `1px solid ${token.colorBorderSecondary}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        },
        children: /* @__PURE__ */ jsx("div", { style: { width: 2, height: 20, backgroundColor: token.colorBorder, borderRadius: 1 } })
      }
    )
  ] });
};
var DetailPaneContent = ({ node, allModels }) => {
  const { token } = theme.useToken();
  const model = allModels?.find((m) => m.name === node.resource);
  const showHref = getShowHref(node.resource, node.id, allModels);
  if (!model) {
    return /* @__PURE__ */ jsx(Empty, { description: `${_31("No schema for")} ${node.resource}`, style: { marginTop: 32 } });
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }, children: [
      /* @__PURE__ */ jsx(Typography.Title, { level: 5, style: { margin: 0, color: token.colorTextSecondary, fontWeight: 500, flex: 1, minWidth: 0 }, children: node.label }),
      showHref && /* @__PURE__ */ jsx(Tooltip, { title: _31("Open in new tab"), children: /* @__PURE__ */ jsx(
        Button,
        {
          size: "small",
          icon: /* @__PURE__ */ jsx(LinkOutlined, {}),
          href: showHref,
          target: "_blank",
          rel: "noopener noreferrer"
        }
      ) })
    ] }),
    /* @__PURE__ */ jsx(DynamicShow, { model, allModels, idOverride: String(node.id), embedded: true })
  ] });
};
var INITIAL_HEIGHT = 560;
var MillerBrowserLayout = ({
  rel,
  record,
  allModels,
  showDetails
}) => {
  const screens = Grid.useBreakpoint();
  const { token } = theme.useToken();
  const isDesktop = !!screens.md;
  const columnsRef = useRef(null);
  const rootId = record?.eid ?? record?.id;
  const [columns, setColumns] = useState([{ parentId: rootId }]);
  const [selectedIds, setSelectedIds] = useState([null]);
  const [detailNode, setDetailNode] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [containerHeight, setContainerHeight] = useState(INITIAL_HEIGHT);
  const [columnsWidth, setColumnsWidth] = useState(null);
  const [columnWidths, setColumnWidths] = useState([]);
  const [draggingDir, setDraggingDir] = useState(null);
  const DEFAULT_COL_WIDTH = 240;
  const getColWidth = (i) => columnWidths[i] ?? DEFAULT_COL_WIDTH;
  const handleResizeV = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = containerHeight;
    setDraggingDir("v");
    const onMove = (mv) => setContainerHeight(Math.max(150, startH + mv.clientY - startY));
    const onUp = () => {
      setDraggingDir(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const handleResizeH = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = columnsRef.current?.getBoundingClientRect().width ?? columnsWidth ?? 400;
    setDraggingDir("h");
    const onMove = (mv) => setColumnsWidth(Math.max(200, startW + mv.clientX - startX));
    const onUp = () => {
      setDraggingDir(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const handleColumnResizeStart = (colIndex, e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = getColWidth(colIndex);
    setDraggingDir("h");
    const onMove = (mv) => {
      const next = Math.max(120, startW + mv.clientX - startX);
      setColumnWidths((prev) => {
        const arr = [...prev];
        while (arr.length <= colIndex) arr.push(DEFAULT_COL_WIDTH);
        arr[colIndex] = next;
        return arr;
      });
    };
    const onUp = () => {
      setDraggingDir(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const handleBranchClick = (colIndex, item) => {
    setColumns([...columns.slice(0, colIndex + 1), { parentId: item.id }]);
    setSelectedIds([...selectedIds.slice(0, colIndex), item.id, null]);
    setDetailNode(null);
    setTimeout(() => {
      if (columnsRef.current) {
        columnsRef.current.scrollLeft = columnsRef.current.scrollWidth;
      }
    }, 60);
  };
  const handleLeafClick = (colIndex, item) => {
    setSelectedIds([...selectedIds.slice(0, colIndex), item.id]);
    const isSameModelAsBranch = item.resource === rel.otherResource;
    if (showDetails && !isSameModelAsBranch) {
      setDetailNode({ id: item.id, label: item.label, resource: item.resource, resourcePath: item.resourcePath });
      if (!isDesktop) setDrawerOpen(true);
    }
  };
  if (!rootId) {
    return /* @__PURE__ */ jsx(Empty, { description: _31("No record selected") });
  }
  const columnsAreaStyle = columnsWidth !== null ? { width: columnsWidth, flexShrink: 0, flexGrow: 0, minWidth: 200, overflowX: "auto", display: "flex", height: "100%" } : { width: showDetails ? "fit-content" : "100%", maxWidth: showDetails ? "50%" : "100%", flexShrink: 0, minWidth: 240, overflowX: "auto", display: "flex", height: "100%" };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    draggingDir && /* @__PURE__ */ jsx("div", { style: {
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      cursor: draggingDir === "v" ? "ns-resize" : "col-resize",
      userSelect: "none"
    } }),
    /* @__PURE__ */ jsxs("div", { style: {
      display: "flex",
      overflow: "hidden",
      height: containerHeight,
      border: `1px solid ${token.colorBorderSecondary}`,
      borderRadius: "8px 8px 0 0",
      backgroundColor: token.colorBgContainer
    }, children: [
      /* @__PURE__ */ jsx("div", { ref: columnsRef, style: columnsAreaStyle, children: columns.map((col, colIndex) => /* @__PURE__ */ jsx(
        MillerColumn,
        {
          parentId: col.parentId,
          rel,
          selectedId: selectedIds[colIndex] ?? null,
          allModels,
          onBranchClick: (item) => handleBranchClick(colIndex, item),
          onLeafClick: (item) => handleLeafClick(colIndex, item),
          height: containerHeight,
          width: getColWidth(colIndex),
          onResizeStart: (e) => handleColumnResizeStart(colIndex, e)
        },
        `col-${colIndex}-${col.parentId}`
      )) }),
      showDetails && isDesktop && /* @__PURE__ */ jsx(
        "div",
        {
          onMouseDown: handleResizeH,
          style: {
            width: 6,
            flexShrink: 0,
            cursor: "col-resize",
            backgroundColor: token.colorFillAlter,
            borderLeft: `1px solid ${token.colorBorderSecondary}`,
            borderRight: `1px solid ${token.colorBorderSecondary}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          },
          children: /* @__PURE__ */ jsx("div", { style: { width: 2, height: 28, backgroundColor: token.colorTextQuaternary, borderRadius: 1 } })
        }
      ),
      showDetails && detailNode && isDesktop && detailNode.resource !== rel.otherResource && /* @__PURE__ */ jsx("div", { style: {
        flex: 1,
        minWidth: 0,
        height: "100%",
        overflowY: "auto",
        padding: "16px",
        backgroundColor: token.colorBgLayout
      }, children: /* @__PURE__ */ jsx(DetailPaneContent, { node: detailNode, allModels }) }),
      showDetails && /* @__PURE__ */ jsx(
        Drawer,
        {
          title: detailNode?.label ?? _31("Details"),
          placement: "right",
          open: drawerOpen && !isDesktop,
          onClose: () => setDrawerOpen(false),
          width: Math.min(typeof window !== "undefined" ? window.innerWidth - 32 : 360, 420),
          styles: { body: { padding: 16 } },
          children: detailNode && detailNode.resource !== rel.otherResource && /* @__PURE__ */ jsx(DetailPaneContent, { node: detailNode, allModels })
        }
      )
    ] }),
    /* @__PURE__ */ jsx(
      "div",
      {
        onMouseDown: handleResizeV,
        style: {
          height: 8,
          cursor: "ns-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: token.colorFillAlter,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderTop: "none",
          borderRadius: "0 0 8px 8px"
        },
        children: /* @__PURE__ */ jsx("div", { style: { width: 40, height: 3, backgroundColor: token.colorBorder, borderRadius: 2 } })
      }
    )
  ] });
};
var { Title: Title6 } = Typography;
var renderRelationBlock = ({
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
  fieldLayoutStyle
}) => {
  const viewType = getRelationViewType(rel, mode, relationViewTypeDefaults);
  const parentModel = findModelByName(allModels, parentResource);
  const relationTone = getModelTone(relatedModel || relationModel || rel.resource);
  const usesTableBehavior = usesTableRelationBehavior(viewType);
  const allowInlineEdit = viewType === "editable-table";
  const tableViewVariant = viewType === "totals-details" ? "totals-details" : "default";
  const showRelationActions = showActions;
  const showCreateButton = showCreate;
  const layoutPreferenceType = mode === "show" ? "ShowLayout" : "EditLayout";
  const relationLabel = getRelationLabel(rel) || rel.label || rel.relationName || rel.resource || "";
  const title = renderToneTabLabel(relationLabel, relationTone);
  const shouldShowRelatedObjects = relatedModel && rel.otherResource && rel.otherKey;
  const polymorphicInfo = getPolymorphicReferenceInfo(rel, relationModel, allModels);
  const isInlineListView = isInlineRelationViewType(viewType);
  const resolvedLabelStyle = labelStyle ?? {
    flex: "0 0 200px",
    fontSize: 12,
    fontWeight: 600,
    color: relationTone.text,
    background: "transparent",
    borderRadius: 6,
    padding: "2px 8px",
    display: "inline-flex",
    alignItems: "center",
    margin: 0
  };
  const resolvedValueStyle = valueStyle ?? {
    flex: "1 0 200px",
    padding: "2px 4px",
    overflowWrap: "anywhere",
    lineHeight: 1.15
  };
  const resolvedLayoutStyle = fieldLayoutStyle ?? {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: "4px 8px"
  };
  if (rel.maxItems === 1 && rel.otherResource && rel.otherKey) {
    const isRequired = (rel.minItems ?? 0) >= 1;
    const singleLabel = showLabel ? /* @__PURE__ */ jsxs("div", { style: resolvedLabelStyle, children: [
      isRequired && /* @__PURE__ */ jsx("span", { style: { color: "#ff4d4f", marginRight: 4 }, children: "*" }),
      relationLabel
    ] }) : null;
    if (mode === "edit") {
      return /* @__PURE__ */ jsx("div", { style: { marginBottom: 0 }, children: /* @__PURE__ */ jsxs("div", { style: resolvedLayoutStyle, children: [
        singleLabel,
        /* @__PURE__ */ jsx("div", { style: resolvedValueStyle, children: /* @__PURE__ */ jsx(
          RelatedObjectSingleSelect,
          {
            rel,
            record,
            allModels,
            required: isRequired
          }
        ) })
      ] }) });
    }
    return /* @__PURE__ */ jsx("div", { style: { marginBottom: 0 }, children: /* @__PURE__ */ jsxs("div", { style: resolvedLayoutStyle, children: [
      singleLabel,
      /* @__PURE__ */ jsx("div", { style: resolvedValueStyle, children: /* @__PURE__ */ jsx(RelatedObjectsInlineValues, { rel, record, viewType: "csv", allModels }) })
    ] }) });
  }
  if (isInlineListView && !polymorphicInfo) {
    return /* @__PURE__ */ jsx("div", { style: { marginBottom: 0 }, children: /* @__PURE__ */ jsxs("div", { style: resolvedLayoutStyle, children: [
      showLabel && /* @__PURE__ */ jsx("div", { style: resolvedLabelStyle, children: relationLabel }),
      /* @__PURE__ */ jsx("div", { style: resolvedValueStyle, children: /* @__PURE__ */ jsx(RelatedObjectsInlineValues, { rel, record, viewType, allModels }) })
    ] }) });
  }
  if (viewType === "tree" || viewType === "tree-details") {
    return /* @__PURE__ */ jsxs("div", { style: { marginTop: 12 }, children: [
      showLabel && /* @__PURE__ */ jsx("div", { style: { ...resolvedLabelStyle, marginBottom: 6 }, children: relationLabel }),
      /* @__PURE__ */ jsx(
        MillerBrowserLayout,
        {
          rel,
          record,
          allModels,
          showDetails: viewType === "tree-details"
        }
      )
    ] }, rel.resource);
  }
  if (viewType === "calendar") {
    if (shouldShowRelatedObjects) {
      return /* @__PURE__ */ jsxs("div", { style: { marginTop: 12 }, children: [
        showLabel && /* @__PURE__ */ jsx("div", { style: { ...resolvedLabelStyle, marginBottom: 6 }, children: relationLabel }),
        /* @__PURE__ */ jsx(RelatedObjectsCalendar, { rel, record, relatedModel, allModels })
      ] }, rel.resource);
    }
    return /* @__PURE__ */ jsxs("div", { style: { marginTop: 12 }, children: [
      showLabel && /* @__PURE__ */ jsx("div", { style: { ...resolvedLabelStyle, marginBottom: 6 }, children: relationLabel }),
      /* @__PURE__ */ jsx(
        DynamicList,
        {
          model: relationModel,
          allModels,
          filter: { field: rel.targetKey, operator: "eq", value: getRecordId(record) },
          relationConfig: rel,
          isEmbedded: true,
          showActions: showRelationActions,
          showCreate: showCreateButton,
          layoutPreferenceType,
          listViewType: "calendar"
        }
      )
    ] }, rel.resource);
  }
  if (viewType === "primary") {
    const primaryModel = relatedModel || relationModel;
    const customPageName = mode === "show" ? rel.showCustomPageName : rel.editCustomPageName;
    return /* @__PURE__ */ jsxs("div", { style: { marginTop: 12 }, children: [
      showLabel && /* @__PURE__ */ jsx("div", { style: { ...resolvedLabelStyle, marginBottom: 6 }, children: relationLabel }),
      /* @__PURE__ */ jsx(RelatedObjectsPrimaryView, { rel, record, model: primaryModel, allModels, customPageName })
    ] }, rel.resource);
  }
  if (viewType === "gallery") {
    const galleryModel = relatedModel || relationModel;
    return /* @__PURE__ */ jsxs("div", { style: { marginTop: 12 }, children: [
      showLabel && /* @__PURE__ */ jsx("div", { style: { ...resolvedLabelStyle, marginBottom: 6 }, children: relationLabel }),
      /* @__PURE__ */ jsx(RelatedObjectsGallery, { rel, record, relatedModel: galleryModel, allModels })
    ] }, rel.resource);
  }
  const recursiveFallback = relatedModel && rel.otherResource && rel.otherKey ? /* @__PURE__ */ jsx(
    RelatedObjectsTable,
    {
      rel,
      record,
      relatedModel,
      parentModel,
      showActions: showRelationActions,
      showCreate: showCreateButton,
      title: allowInlineEdit ? void 0 : title,
      allowInlineEdit,
      layoutPreferenceType,
      viewVariant: tableViewVariant,
      allModels
    }
  ) : /* @__PURE__ */ jsx(
    DynamicList,
    {
      model: relationModel,
      allModels,
      filter: { field: rel.targetKey, operator: "eq", value: getRecordId(record) },
      relationConfig: rel,
      isEmbedded: true,
      showActions: showRelationActions,
      showCreate: showCreateButton,
      layoutPreferenceType,
      listViewType: usesTableBehavior ? "table" : void 0
    }
  );
  const content = rel.isRecursive && relatedModel && rel.otherResource && rel.otherKey ? recursiveFallback : rel.isRecursive ? /* @__PURE__ */ jsx(
    DynamicList,
    {
      model: relationModel,
      allModels,
      filter: { field: rel.targetKey, operator: "eq", value: getRecordId(record) },
      relationConfig: rel,
      isEmbedded: true,
      showActions: showRelationActions,
      showCreate: showCreateButton,
      layoutPreferenceType,
      listViewType: usesTableBehavior ? "table" : void 0
    }
  ) : polymorphicInfo ? /* @__PURE__ */ jsx(
    PolymorphicRelatedObjectsTable,
    {
      rel,
      record,
      relationModel,
      parentModel,
      allModels: allModels || [],
      showActions: showRelationActions,
      showCreate: showCreateButton,
      allowInlineEdit,
      layoutPreferenceType,
      viewVariant: tableViewVariant
    }
  ) : shouldShowRelatedObjects ? /* @__PURE__ */ jsx(
    RelatedObjectsTable,
    {
      rel,
      record,
      relatedModel,
      parentModel,
      showActions: showRelationActions,
      showCreate: showCreateButton,
      title: allowInlineEdit ? void 0 : title,
      allowInlineEdit,
      layoutPreferenceType,
      viewVariant: tableViewVariant,
      allModels
    }
  ) : /* @__PURE__ */ jsx(
    DynamicList,
    {
      model: relationModel,
      allModels,
      filter: { field: rel.targetKey, operator: "eq", value: getRecordId(record) },
      relationConfig: rel,
      isEmbedded: true,
      showActions: showRelationActions,
      showCreate: showCreateButton,
      layoutPreferenceType,
      listViewType: usesTableBehavior ? "table" : void 0
    }
  );
  if (viewType === "editable-table") {
    return /* @__PURE__ */ jsx(
      Card,
      {
        size: "small",
        title,
        variant: "borderless",
        style: { marginBottom: 16, boxShadow: `0 8px 20px -16px ${relationTone.shadow}` },
        styles: {
          header: {
            background: "transparent",
            color: relationTone.text
          },
          body: { paddingTop: 8 }
        },
        children: content
      },
      rel.resource
    );
  }
  if (viewType === "editable-list" && rel.otherResource && rel.otherKey) {
    return /* @__PURE__ */ jsx(
      Card,
      {
        size: "small",
        title,
        variant: "borderless",
        style: { marginBottom: 16, boxShadow: `0 8px 20px -16px ${relationTone.shadow}` },
        styles: {
          header: {
            background: "transparent",
            color: relationTone.text
          },
          body: { paddingTop: 8 }
        },
        children: /* @__PURE__ */ jsx(RelatedObjectsEditableList, { rel, record, allModels })
      },
      rel.resource
    );
  }
  if (shouldShowRelatedObjects) {
    return /* @__PURE__ */ jsx("div", { style: { marginTop: 12 }, children: content }, rel.resource);
  }
  return /* @__PURE__ */ jsxs("div", { style: { marginTop: 12 }, children: [
    /* @__PURE__ */ jsx(Title6, { level: 5, style: { color: relationTone.text, margin: 0 }, children: title }),
    content
  ] }, rel.resource);
};
var _32 = window._ || ((text) => text);
var { Title: Title7 } = Typography;
var DynamicList = ({ model: modelProp, allModels, filter, relationConfig, isEmbedded = false, showActions = true, showCreate = true, layoutPreferenceType, listViewType, rowSelection, extraHeaderButtons, bulkActions, preferencesResourceOverride, defaultListVisible }) => {
  const model = useRoleFilteredModel(modelProp);
  applyI18nLabelsToModel(model);
  applyI18nLabelsToModels(allModels);
  const navigate = useNavigate();
  const location = useLocation();
  const go = useGo();
  const paneNav = usePaneNavigation();
  const invalidate = useInvalidate();
  const apiUrl = useApiUrl();
  const resourceIdentifier = resolveResourcePath(model.resource || model.name, allModels);
  const prefsKey = preferencesResourceOverride ?? resourceIdentifier;
  const { data: canDeleteData } = useCan({ resource: resourceIdentifier, action: "delete" });
  const { data: canEditData } = useCan({ resource: resourceIdentifier, action: "edit" });
  const canBulkDelete = canDeleteData?.can !== false;
  const canBulkEdit = canEditData?.can !== false;
  const { settings: viewSettings } = useViewSettings();
  viewSettings?.generalActionsButtonPosition || "top-right";
  const [actionsBarEl, setActionsBarEl] = useState(null);
  const resolvedLayoutPreferenceType = layoutPreferenceType ?? "ShowLayout";
  const [searchParams] = useSearchParams();
  const selectMode = searchParams.get("select_mode") === "1";
  const selectModeFk = searchParams.get("select_mode_fk") === "1";
  const selectModeRelateResource = searchParams.get("relate_resource");
  const selectModeRelateTargetKey = searchParams.get("relate_target_key");
  const selectModeRelateOtherKey = searchParams.get("relate_other_key");
  const selectModeRelateTargetId = searchParams.get("relate_target_id");
  const selectModeReturnTo = searchParams.get("returnTo");
  useKeyboardShortcuts(useMemo(() => isEmbedded ? [] : [
    { key: "n", ctrl: true, handler: () => go({ to: { resource: model.resource || model.name, action: "create" } }) }
  ], [model.name, model.resource, go, isEmbedded]));
  const { token } = theme.useToken();
  const modelTone = useModelTone(model);
  const valueBackground = isDarkColor2(token.colorBgBase || token.colorBgContainer) ? token.colorFillQuaternary : "#F9FFFF";
  const statsLabelStyle = {
    background: valueBackground,
    borderRadius: 4,
    padding: "2px 6px",
    display: "inline-block"
  };
  const statsHeaderStyle = {
    background: valueBackground
  };
  const statsTitleStyle = {
    color: modelTone.solid,
    margin: 0
  };
  const searchField = model.fields.find((f) => f.type === "string" && !f.key.includes("_id") && !f.key.includes("eid")) || model.fields.find((f) => f.type === "string") || model.fields[0];
  const isFileModel3 = (model.resource || model.name).toLowerCase() === "file";
  const modelDefaultListViewType = String(model.listViewType || "").toLowerCase();
  const defaultListViewType = String(modelDefaultListViewType || viewSettings?.listViewType || "table").toLowerCase();
  const fileListViewType = String(viewSettings?.fileListViewType || "").toLowerCase();
  const resolvedListViewType = String(
    listViewType || (isFileModel3 && fileListViewType ? fileListViewType : defaultListViewType) || "table"
  ).toLowerCase();
  const isGalleryView = resolvedListViewType === "gallery";
  const isCalendarView = resolvedListViewType === "calendar";
  const isTotalsDetailsView = resolvedListViewType === "totals-details" || resolvedListViewType === "totalsdetails";
  const galleryImageWidth = viewSettings?.galleryImageWidth ?? 180;
  const galleryImageHeight = viewSettings?.galleryImageHeight ?? 140;
  const calendarDateFieldOptions = useMemo(() => getCalendarDateFieldOptions(model.fields), [model.fields]);
  const [localSearch, setLocalSearch] = useState("");
  const [listVisible, setListVisible] = useState(defaultListVisible ?? true);
  const [isTdFlipped, setIsTdFlipped] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [galleryPage, setGalleryPage] = useState(1);
  const [calendarMode, setCalendarMode] = useState("month");
  const [calendarDateField, setCalendarDateField] = useState(() => calendarDateFieldOptions[0]?.key || "");
  const [calendarAnchorDate, setCalendarAnchorDate] = useState(() => dayjs7().startOf("month"));
  const [isAnalyzeVertical, setIsAnalyzeVertical] = useState(false);
  const [isAnalyzeFirst, setIsAnalyzeFirst] = useState(false);
  const [filterRules, setFilterRules] = useState([]);
  const [filtersCollapsed, setFiltersCollapsed] = useState(isEmbedded);
  const [layoutPrefsReady, setLayoutPrefsReady] = useState(false);
  const [columnsSelectorOpen, setColumnsSelectorOpen] = useState(false);
  const [selectedColumnKeys, setSelectedColumnKeys] = useState(null);
  const [columnOrder, setColumnOrder] = useState(null);
  const [columnFiltersSelected, setColumnFiltersSelected] = useState({});
  const [columnSort, setColumnSort] = useState([]);
  const [totalsSummaryFunctions, setTotalsSummaryFunctions] = useState({});
  const [currentViewName, setCurrentViewName] = useState(getDefaultViewName());
  const [selectedViewNames, setSelectedViewNames] = useState([]);
  const [availableViewNames, setAvailableViewNames] = useState([]);
  const [viewNamesLoaded, setViewNamesLoaded] = useState(false);
  const [isLoadingViewNames, setIsLoadingViewNames] = useState(false);
  const [saveViewModalOpen, setSaveViewModalOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState(getDefaultViewName());
  const [saveViewAsNew, setSaveViewAsNew] = useState(false);
  const [pendingSaveTarget, setPendingSaveTarget] = useState(null);
  const [renameViewModalOpen, setRenameViewModalOpen] = useState(false);
  const [renameViewName, setRenameViewName] = useState("");
  const [labelCache, setLabelCache] = useState({});
  const [analyzeOpen, setAnalyzeOpen] = useState(isEmbedded);
  const analyzeTouchedRef = useRef(false);
  const analyzePrefsTouchedRef = useRef(false);
  const analyzePrefsLoadedRef = useRef(false);
  const [analyzePrefsReady, setAnalyzePrefsReady] = useState(false);
  const analyzePrefsResourceRef = useRef(null);
  const { metadataButton, metadataModal } = useMetadataModal(model, allModels);
  const defaultDisplayFields = useMemo(() => getListViewFields(model, filter?.field), [model, filter?.field]);
  const orderedColumnKeys = useMemo(() => {
    if (!selectedColumnKeys || selectedColumnKeys.length === 0) return null;
    const order = columnOrder && columnOrder.length > 0 ? columnOrder : selectedColumnKeys;
    const selectedSet = new Set(selectedColumnKeys);
    const availableKeys = new Set(model.fields.map((field) => field.key));
    return order.filter((key) => selectedSet.has(key) && availableKeys.has(key));
  }, [columnOrder, model.fields, selectedColumnKeys]);
  const displayFields = useMemo(() => {
    if (!orderedColumnKeys) return defaultDisplayFields;
    const fieldMap = new Map(model.fields.map((field) => [field.key, field]));
    return orderedColumnKeys.map((key) => fieldMap.get(key)).filter((field) => Boolean(field));
  }, [defaultDisplayFields, model.fields, orderedColumnKeys]);
  const useLocalSearch = true;
  const [categoryField1, setCategoryField1] = useState(null);
  const [categoryField2, setCategoryField2] = useState(void 0);
  const [chartType, setChartType] = useState("area");
  const [summaryFn, setSummaryFn] = useState("sum");
  const [selectedSeriesKeys, setSelectedSeriesKeys] = useState(null);
  const [rankingMode, setRankingMode] = useState("none");
  const [rankingFieldKey, setRankingFieldKey] = useState(null);
  const [rankingN, setRankingN] = useState(10);
  const [exportRequested, setExportRequested] = useState(false);
  const [isStatsFlipped, setIsStatsFlipped] = useState(false);
  const [isSavingAnalyzePrefs, setIsSavingAnalyzePrefs] = useState(false);
  const chartSvgRef = useRef(null);
  const [chartAnimationKey, setChartAnimationKey] = useState(0);
  const [chartAnimationStage, setChartAnimationStage] = useState("enter");
  const skipNextAnimationRef = useRef(false);
  const [isSavingLayoutPrefs, setIsSavingLayoutPrefs] = useState(false);
  const layoutPrefsTouchedRef = useRef(false);
  const layoutPrefsLoadedRef = useRef(false);
  const layoutPrefsResourceRef = useRef(null);
  const sortIntentRef = useRef(null);
  const [bulkSelectedRowKeys, setBulkSelectedRowKeys] = useState([]);
  const bulkSelectedRowsMapRef = useRef(/* @__PURE__ */ new Map());
  const [selectModeAssociating, setSelectModeAssociating] = useState(false);
  const handleAssociateSelected = useCallback(async () => {
    if (!selectModeRelateResource || !selectModeRelateTargetKey || !selectModeRelateTargetId) return;
    if (!selectModeFk && !selectModeRelateOtherKey) return;
    setSelectModeAssociating(true);
    try {
      for (const rowKey of bulkSelectedRowKeys) {
        if (selectModeFk) {
          await authenticatedFetch(`${apiUrl}/${selectModeRelateResource}/${rowKey}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              [selectModeRelateTargetKey]: selectModeRelateTargetId
            })
          });
        } else {
          await authenticatedFetch(`${apiUrl}/${selectModeRelateResource}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              [selectModeRelateTargetKey]: selectModeRelateTargetId,
              [selectModeRelateOtherKey]: rowKey
            })
          });
        }
      }
      message.success(_32("Relations added."));
      if (selectModeReturnTo && selectModeReturnTo.startsWith("/")) {
        navigate(selectModeReturnTo);
      }
    } catch {
      message.error(_32("Failed to add relations."));
    } finally {
      setSelectModeAssociating(false);
    }
  }, [apiUrl, bulkSelectedRowKeys, selectModeFk, selectModeRelateResource, selectModeRelateTargetKey, selectModeRelateOtherKey, selectModeRelateTargetId, selectModeReturnTo, navigate]);
  const [bulkActionModalOpen, setBulkActionModalOpen] = useState(false);
  const [bulkActionsToApply, setBulkActionsToApply] = useState([]);
  const [bulkChangeFieldKey, setBulkChangeFieldKey] = useState(null);
  const [bulkChangeFieldValue, setBulkChangeFieldValue] = useState(null);
  const [isBulkExecuting, setIsBulkExecuting] = useState(false);
  const [selectAllFilteredPending, setSelectAllFilteredPending] = useState(false);
  const [columnFilterDropdownEverOpened, setColumnFilterDropdownEverOpened] = useState(false);
  const handleReferenceLabel = useCallback((resource, id, label) => {
    const key = `${resource}:${id}`;
    setLabelCache((prev) => prev[key] === label ? prev : { ...prev, [key]: label });
  }, []);
  const tableFilters = useMemo(() => {
    if (!filter) return [];
    if (filter.value === void 0 || filter.value === null) return [];
    return [filter];
  }, [filter?.field, filter?.operator, filter?.value]);
  const { tableProps, searchFormProps, filters: activeFilters, setFilters } = useTable({
    resource: resourceIdentifier,
    syncWithLocation: !isEmbedded,
    pagination: { pageSize, hideOnSinglePage: true, showSizeChanger: true, pageSizeOptions: ["10", "20", "50", "100"] },
    filters: { initial: tableFilters, permanent: tableFilters },
    onSearch: (values) => {
      if (!searchField) return [];
      if (!values?.q) return [];
      let value = values.q;
      if (searchField.type === "number") {
        const parsed = Number(values.q);
        if (!Number.isNaN(parsed)) value = parsed;
      } else if (searchField.type === "boolean") {
        const normalized = String(values.q).toLowerCase();
        if (["true", "1", "t", "yes", "y"].includes(normalized)) value = true;
        if (["false", "0", "f", "no", "n"].includes(normalized)) value = false;
      }
      return [{ field: searchField.key, operator: "eq", value }];
    }
  });
  const [allRowsData, setAllRowsData] = useState([]);
  const [isAllRowsLoading, setIsAllRowsLoading] = useState(false);
  const [allRowsError, setAllRowsError] = useState(null);
  const lastAllRowsSignature = useRef("");
  const [allRowsLoaded, setAllRowsLoaded] = useState(false);
  const isRelationView = !!filter;
  const hasActiveFilterRules = useMemo(() => {
    return filterRules.some((rule) => rule.fieldKey && rule.operator && (rule.value !== void 0 && rule.value !== null && rule.value !== ""));
  }, [filterRules]);
  const getFieldValueForFilter = useCallback((field, record) => {
    const raw = record?.[field.key];
    if (raw === void 0 || raw === null) return raw;
    if (field.reference) {
      const cacheKey = `${field.reference}:${raw}`;
      return labelCache[cacheKey] || raw;
    }
    if (field.options) {
      return field.options.find((option) => option.value === raw)?.label || raw;
    }
    return raw;
  }, [labelCache]);
  const getSortValue = useCallback((field, record) => {
    const raw = record?.[field.key];
    if (raw === void 0 || raw === null) return null;
    if (field.key === "eid" && record?._label) return record._label;
    if (field.reference) {
      const cacheKey = `${field.reference}:${raw}`;
      return labelCache[cacheKey] ?? raw;
    }
    if (field.options) {
      return field.options.find((option) => option.value === raw)?.label ?? raw;
    }
    if (field.type === "date" || field.type === "datetime") {
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? raw : parsed.getTime();
    }
    if (field.type === "time") {
      return String(raw);
    }
    if (field.type === "number") return Number(raw);
    if (field.type === "boolean") return raw ? 1 : 0;
    return raw;
  }, [labelCache]);
  const compareSortValues = useCallback((field, a, b) => {
    const aVal = getSortValue(field, a);
    const bVal = getSortValue(field, b);
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;
    if (typeof aVal === "number" && typeof bVal === "number") return aVal - bVal;
    return String(aVal).localeCompare(String(bVal));
  }, [getSortValue]);
  const resolveRelativeDate = useCallback((value, asRange) => {
    const count = Number(value?.count ?? 1);
    const direction = value?.direction || "next";
    const unit = value?.unit || "weeks";
    const isQuarter = unit === "quarters";
    const base = dayjs7();
    if (asRange || direction === "current") {
      const anchor = direction === "current" ? base : direction === "previous" ? isQuarter ? base.subtract(count * 3, "month") : base.subtract(count, unit) : isQuarter ? base.add(count * 3, "month") : base.add(count, unit);
      if (isQuarter) {
        const quarterStartMonth = Math.floor(anchor.month() / 3) * 3;
        const start = anchor.month(quarterStartMonth).startOf("month");
        const end = start.add(2, "month").endOf("month");
        return { start, end };
      }
      return {
        start: anchor.startOf(unit),
        end: anchor.endOf(unit)
      };
    }
    const target = direction === "previous" ? isQuarter ? base.subtract(count * 3, "month") : base.subtract(count, unit) : isQuarter ? base.add(count * 3, "month") : base.add(count, unit);
    if (isQuarter) {
      const quarterStartMonth = Math.floor(target.month() / 3) * 3;
      return { date: target.month(quarterStartMonth).startOf("month") };
    }
    return { date: target.startOf(unit) };
  }, []);
  const matchesRule = useCallback((record, rule) => {
    const field = model.fields.find((f) => f.key === rule.fieldKey);
    if (!field || !rule.operator) return true;
    const rawValue = getFieldValueForFilter(field, record);
    if (rawValue === void 0 || rawValue === null) return false;
    if (field.type === "string") {
      const value = String(rawValue).toLowerCase();
      const target = String(rule.value ?? "").toLowerCase();
      if (!target) return true;
      if (rule.operator === "contains") return value.includes(target);
      if (rule.operator === "equals") return value === target;
      return true;
    }
    if (field.type === "number") {
      const num = Number(rawValue);
      const target = Number(rule.value);
      const target2 = Number(rule.value2);
      if (Number.isNaN(num)) return false;
      switch (rule.operator) {
        case "eq":
          return !Number.isNaN(target) && num === target;
        case "gt":
          return !Number.isNaN(target) && num > target;
        case "gte":
          return !Number.isNaN(target) && num >= target;
        case "lt":
          return !Number.isNaN(target) && num < target;
        case "lte":
          return !Number.isNaN(target) && num <= target;
        case "between":
          return !Number.isNaN(target) && !Number.isNaN(target2) && num >= target && num <= target2;
        default:
          return true;
      }
    }
    if (field.type === "boolean") {
      if (rule.operator === "is") return Boolean(rawValue) === Boolean(rule.value);
      return true;
    }
    if (field.type === "date" || field.type === "datetime") {
      const recordDate = dayjs7(rawValue);
      if (!recordDate.isValid()) return false;
      const mode = rule.value?.mode || "absolute";
      const mode2 = rule.value2?.mode || "absolute";
      const getDateValue = (val, asRange) => {
        if (val?.mode === "relative") {
          return resolveRelativeDate(val, asRange);
        }
        const date = dayjs7(val?.date || val);
        return asRange ? { start: date.startOf("day"), end: date.endOf("day") } : { date: date.startOf("day") };
      };
      switch (rule.operator) {
        case "on": {
          const range = mode === "relative" ? resolveRelativeDate(rule.value, true) : getDateValue(rule.value, true);
          const time = recordDate.valueOf();
          return time >= range.start.valueOf() && time <= range.end.valueOf();
        }
        case "after": {
          const dateVal = mode === "relative" ? resolveRelativeDate(rule.value, false).date : getDateValue(rule.value, false).date;
          if (!dateVal || !dayjs7(dateVal).isValid()) return false;
          return recordDate.valueOf() > dayjs7(dateVal).endOf("day").valueOf();
        }
        case "before": {
          const dateVal = mode === "relative" ? resolveRelativeDate(rule.value, false).date : getDateValue(rule.value, false).date;
          if (!dateVal || !dayjs7(dateVal).isValid()) return false;
          return recordDate.valueOf() < dayjs7(dateVal).startOf("day").valueOf();
        }
        case "between": {
          const startRange = mode === "relative" ? resolveRelativeDate(rule.value, true) : getDateValue(rule.value, true);
          const endRange = mode2 === "relative" ? resolveRelativeDate(rule.value2, true) : getDateValue(rule.value2, true);
          if (!startRange.start || !endRange.end) return false;
          const time = recordDate.valueOf();
          return time >= startRange.start.valueOf() && time <= endRange.end.valueOf();
        }
        default:
          return true;
      }
    }
    return true;
  }, [getFieldValueForFilter, model.fields, resolveRelativeDate]);
  const applyGlobalSearch = useCallback((rows) => {
    const query = localSearch.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((record) => {
      const candidates = [
        record?._label,
        ...model.fields.flatMap((field) => {
          const value = record?.[field.key];
          if (field.reference && value !== void 0 && value !== null) {
            const key = `${field.reference}:${value}`;
            const cachedLabel = labelCache[key];
            return cachedLabel ? [cachedLabel, value] : [value];
          }
          return [value];
        })
      ];
      return candidates.some((value) => value !== void 0 && value !== null && String(value).toLowerCase().includes(query));
    });
  }, [labelCache, localSearch, model.fields, useLocalSearch]);
  const applyFilterRules = useCallback((rows) => {
    if (!hasActiveFilterRules) return rows;
    return rows.filter((record) => filterRules.every((rule) => matchesRule(record, rule)));
  }, [filterRules, hasActiveFilterRules, matchesRule]);
  const allRows = useMemo(() => {
    const data = allRowsData || [];
    const query = localSearch.trim().toLowerCase();
    if (!query) return data;
    return data.filter((record) => {
      const candidates = [
        record?._label,
        ...model.fields.flatMap((field) => {
          const value = record?.[field.key];
          if (field.reference && value !== void 0 && value !== null) {
            const key = `${field.reference}:${value}`;
            const cachedLabel = labelCache[key];
            return cachedLabel ? [cachedLabel, value] : [value];
          }
          return [value];
        })
      ];
      return candidates.some((value) => value !== void 0 && value !== null && String(value).toLowerCase().includes(query));
    });
  }, [allRowsData, useLocalSearch, localSearch, model.fields, labelCache]);
  const isClientFiltering = allRowsLoaded && !allRowsError;
  const filteredDataSource = useMemo(() => {
    if (!isClientFiltering) return tableProps.dataSource || [];
    const baseRows = allRows || [];
    return applyFilterRules(applyGlobalSearch(baseRows));
  }, [allRows, applyFilterRules, applyGlobalSearch, isClientFiltering, tableProps.dataSource]);
  useEffect(() => {
    setGalleryPage(1);
  }, [localSearch, filterRules, resolvedListViewType]);
  const columnFilters = useMemo(() => {
    const data = allRowsData.length > 0 ? allRowsData : tableProps.dataSource || [];
    const distinctLimit = 50;
    const rangeCount = viewSettings?.maxDistinctColumnFilterValuesToRanges ?? 20;
    const filtersMap = /* @__PURE__ */ new Map();
    const truncateLabel = (s) => s.length > 15 ? s.substring(0, 15) + "\u2026" : s;
    for (const field of displayFields) {
      if (field.key === "eid") {
        const labelValues = [];
        for (const record of data) {
          const lbl = record?._label;
          if (lbl === void 0 || lbl === null || lbl === "") continue;
          labelValues.push(String(lbl));
        }
        const distinctLabelSet = new Set(labelValues);
        if (distinctLabelSet.size > rangeCount) {
          const sorted = Array.from(distinctLabelSet).sort((a, b) => a.localeCompare(b));
          const step = Math.ceil(sorted.length / rangeCount);
          const options2 = [];
          for (let i = 0; i < sorted.length; i += step) {
            const lo = sorted[i];
            const hi = sorted[Math.min(i + step - 1, sorted.length - 1)];
            options2.push({
              text: `${truncateLabel(lo)} \u2013 ${truncateLabel(hi)}`,
              value: `__catrange__:${encodeURIComponent(lo)}:${encodeURIComponent(hi)}`
            });
          }
          filtersMap.set(field.key, options2);
          continue;
        }
      }
      if (field.type === "number" && !field.reference) {
        const numericValues = [];
        for (const record of data) {
          const v = record?.[field.key];
          if (v === void 0 || v === null) continue;
          const n = Number(v);
          if (!isNaN(n)) numericValues.push(n);
        }
        const distinctSet = new Set(numericValues);
        if (distinctSet.size > rangeCount) {
          let min = Infinity, max = -Infinity;
          for (const n of numericValues) {
            if (n < min) min = n;
            if (n > max) max = n;
          }
          const step = (max - min) / rangeCount;
          const fmt = (n) => Number.isInteger(n) ? String(n) : n.toFixed(2);
          const options2 = [];
          for (let i = 0; i < rangeCount; i++) {
            const lo = min + i * step;
            const hi = i === rangeCount - 1 ? max : min + (i + 1) * step;
            if (numericValues.some((n) => n >= lo && n <= hi)) {
              options2.push({ text: `${fmt(lo)} \u2013 ${fmt(hi)}`, value: `__range__:${lo}:${hi}` });
            }
          }
          filtersMap.set(field.key, options2);
          continue;
        }
      }
      if (field.type === "date" || field.type === "datetime") {
        const dateValues = [];
        for (const record of data) {
          const v = record?.[field.key];
          if (v === void 0 || v === null || v === "") continue;
          const d = String(v).substring(0, 10);
          if (d) dateValues.push(d);
        }
        const distinctDateSet = new Set(dateValues);
        if (distinctDateSet.size > rangeCount) {
          const sorted = Array.from(distinctDateSet).sort();
          const step = Math.ceil(sorted.length / rangeCount);
          const options2 = [];
          for (let i = 0; i < sorted.length; i += step) {
            const lo = sorted[i];
            const hi = sorted[Math.min(i + step - 1, sorted.length - 1)];
            options2.push({
              text: `${lo} \u2013 ${hi}`,
              value: `__daterange__:${encodeURIComponent(lo)}:${encodeURIComponent(hi)}`
            });
          }
          filtersMap.set(field.key, options2);
          continue;
        }
      }
      if (field.type === "string" && !field.reference) {
        const strValues = [];
        for (const record of data) {
          const v = record?.[field.key];
          if (v === void 0 || v === null || v === "") continue;
          strValues.push(String(v));
        }
        const distinctStrSet = new Set(strValues);
        if (distinctStrSet.size > rangeCount) {
          const sorted = Array.from(distinctStrSet).sort((a, b) => a.localeCompare(b));
          const step = Math.ceil(sorted.length / rangeCount);
          const options2 = [];
          for (let i = 0; i < sorted.length; i += step) {
            const lo = sorted[i];
            const hi = sorted[Math.min(i + step - 1, sorted.length - 1)];
            options2.push({
              text: `${truncateLabel(lo)} \u2013 ${truncateLabel(hi)}`,
              value: `__catrange__:${encodeURIComponent(lo)}:${encodeURIComponent(hi)}`
            });
          }
          filtersMap.set(field.key, options2);
          continue;
        }
      }
      const seen = /* @__PURE__ */ new Set();
      const options = [];
      for (const record of data) {
        let value = record?.[field.key];
        let label = value;
        if (field.key === "eid" && record?._label) {
          value = record.eid;
          label = record._label;
        }
        if (value === void 0 || value === null) continue;
        const key = String(value);
        if (seen.has(key)) continue;
        seen.add(key);
        options.push({ text: String(label), value: key });
        if (options.length >= distinctLimit) break;
      }
      filtersMap.set(field.key, options);
    }
    return filtersMap;
  }, [allRowsData, displayFields, tableProps.dataSource, viewSettings]);
  const allFieldOptions = useMemo(() => {
    return model.fields.map((field) => ({ label: field.label, value: field.key }));
  }, [model.fields]);
  const orderedSelectedColumns = useMemo(() => {
    if (!selectedColumnKeys || selectedColumnKeys.length === 0) return [];
    return orderedColumnKeys && orderedColumnKeys.length > 0 ? orderedColumnKeys : selectedColumnKeys;
  }, [orderedColumnKeys, selectedColumnKeys]);
  const syncColumnsSelectionToDisplay = useCallback(() => {
    const keys = displayFields.map((field) => field.key);
    if (keys.length === 0) return;
    setSelectedColumnKeys(keys);
    setColumnOrder(orderedColumnKeys && orderedColumnKeys.length > 0 ? orderedColumnKeys : keys);
  }, [displayFields, orderedColumnKeys]);
  useEffect(() => {
    if (selectedColumnKeys !== null) return;
    const defaults = defaultDisplayFields.map((field) => field.key);
    if (defaults.length === 0) return;
    setSelectedColumnKeys(defaults);
    setColumnOrder(defaults);
  }, [defaultDisplayFields, selectedColumnKeys]);
  const markAnalyzePrefsTouched = useCallback(() => {
    analyzePrefsTouchedRef.current = true;
  }, []);
  const markLayoutPrefsTouched = useCallback(() => {
    layoutPrefsTouchedRef.current = true;
  }, []);
  const handleColumnSelectionChange = useCallback((values) => {
    markLayoutPrefsTouched();
    if (!values || values.length === 0) {
      setSelectedColumnKeys(null);
      setColumnOrder(null);
      return;
    }
    setSelectedColumnKeys(values);
    setColumnOrder((prev) => {
      const baseOrder = prev && prev.length > 0 ? prev.filter((key) => values.includes(key)) : [];
      const missing = values.filter((key) => !baseOrder.includes(key));
      return [...baseOrder, ...missing];
    });
  }, [markLayoutPrefsTouched]);
  const moveColumnOrder = useCallback((key, direction) => {
    setColumnOrder((prev) => {
      const base = prev && prev.length > 0 ? [...prev] : selectedColumnKeys ? [...selectedColumnKeys] : [];
      const index = base.indexOf(key);
      if (index === -1) return base;
      const swapIndex = direction === "left" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= base.length) return base;
      [base[index], base[swapIndex]] = [base[swapIndex], base[index]];
      return base;
    });
  }, [selectedColumnKeys]);
  const handleTablePageChange = useCallback((page, newPageSize) => {
    if (newPageSize && newPageSize !== pageSize) {
      setPageSize(newPageSize);
      setGalleryPage(1);
    }
    const pagination = tableProps.pagination;
    if (typeof pagination === "object" && typeof pagination.onChange === "function") {
      pagination.onChange(page, newPageSize ?? pageSize);
    }
  }, [pageSize, tableProps.pagination]);
  const tablePagination = useMemo(() => {
    if (!isClientFiltering) {
      if (!tableProps.pagination || typeof tableProps.pagination !== "object") return tableProps.pagination;
      return {
        ...tableProps.pagination,
        pageSize,
        showSizeChanger: true,
        pageSizeOptions: ["10", "20", "50", "100"],
        onChange: handleTablePageChange,
        onShowSizeChange: handleTablePageChange
      };
    }
    return {
      pageSize,
      hideOnSinglePage: true,
      showSizeChanger: true,
      pageSizeOptions: ["10", "20", "50", "100"],
      onChange: handleTablePageChange,
      onShowSizeChange: handleTablePageChange
    };
  }, [handleTablePageChange, isClientFiltering, pageSize, tableProps.pagination]);
  const categoricalFields = useMemo(() => {
    return model.fields.filter((field) => field.key === "eid" || (field.type !== "number" || field.reference));
  }, [model.fields]);
  const numericFields = useMemo(() => {
    return model.fields.filter((field) => field.key !== "eid" && field.type === "number" && !field.reference);
  }, [model.fields]);
  const hasActiveRangeColumnFilter = useMemo(() => {
    return Object.values(columnFiltersSelected).some(
      (vals) => vals.some((v) => v.startsWith("__range__:"))
    );
  }, [columnFiltersSelected]);
  const shouldLoadAllRows = useMemo(() => {
    return Boolean(
      localSearch.trim().length > 0 || hasActiveFilterRules || analyzeOpen || exportRequested || isTotalsDetailsView || columnFilterDropdownEverOpened || hasActiveRangeColumnFilter
    );
  }, [analyzeOpen, columnFilterDropdownEverOpened, exportRequested, hasActiveFilterRules, hasActiveRangeColumnFilter, isTotalsDetailsView, localSearch]);
  useEffect(() => {
    if (!categoryField1 && categoricalFields.length > 0) {
      setCategoryField1(categoricalFields[0].key);
    }
    if (categoryField2 === void 0 && categoricalFields.length > 1) {
      setCategoryField2(categoricalFields[1].key);
    }
  }, [categoricalFields, categoryField1, categoryField2]);
  useEffect(() => {
    if (selectedSeriesKeys !== null) return;
    if (numericFields.length > 0) {
      setSelectedSeriesKeys(numericFields.map((field) => field.key));
    } else {
      setSelectedSeriesKeys(["__count__"]);
    }
  }, [numericFields, selectedSeriesKeys]);
  useEffect(() => {
    if (numericFields.length === 0) {
      if (rankingFieldKey !== null) setRankingFieldKey(null);
      if (rankingMode !== "none") setRankingMode("none");
      return;
    }
    if (!rankingFieldKey || !numericFields.some((field) => field.key === rankingFieldKey)) {
      setRankingFieldKey(numericFields[0].key);
    }
  }, [numericFields, rankingFieldKey, rankingMode]);
  const resetLayoutDefaults = useCallback(() => {
    setListVisible(defaultListVisible ?? true);
    setAnalyzeOpen(false);
    setIsAnalyzeVertical(false);
    setIsAnalyzeFirst(false);
    setFiltersCollapsed(isEmbedded);
    setPageSize(10);
    setSelectedColumnKeys(null);
    setColumnOrder(null);
    setTotalsSummaryFunctions({});
  }, [isEmbedded, defaultListVisible]);
  const resetAnalyzeDefaults = useCallback(() => {
    setCategoryField1(categoricalFields[0]?.key ?? null);
    setCategoryField2(categoricalFields.length > 1 ? categoricalFields[1].key : null);
    setChartType("area");
    setSummaryFn("sum");
    setSelectedSeriesKeys(null);
    setRankingMode("none");
    setRankingFieldKey(numericFields[0]?.key ?? null);
    setRankingN(10);
  }, [categoricalFields, numericFields]);
  const persistCurrentViewNames = useCallback(async (nextSelected, nextCurrent) => {
    try {
      const resourceKey = prefsKey;
      await authenticatedFetch(`${apiUrl}/views/preferences/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: resourceKey,
          action: "set_current",
          view_name: nextCurrent,
          view_names: nextSelected
        })
      });
    } catch {
    }
  }, [apiUrl, model.name, model.resource, allModels, preferencesResourceOverride]);
  const loadViewNames = useCallback(async () => {
    const resourceKey = prefsKey;
    setIsLoadingViewNames(true);
    try {
      const response = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=__all__`);
      if (!response.ok) {
        throw new Error(`Load failed (${response.status})`);
      }
      const data = await response.json();
      const prefs = data?.preferences;
      let viewNames = [];
      let nextCurrent = getDefaultViewName();
      let nextSelected = [];
      if (prefs && typeof prefs === "object") {
        if (prefs.views && typeof prefs.views === "object") {
          viewNames = Object.keys(prefs.views || {});
          const rawSelected = Array.isArray(prefs.current_view_names) ? prefs.current_view_names : [];
          const normalizedSelected = rawSelected.map((name) => normalizeViewName(name)).filter((name) => viewNames.includes(name));
          nextCurrent = normalizeViewName(prefs.current_view_name || normalizedSelected[0]);
          nextSelected = normalizedSelected;
        }
      }
      if (viewNames.length === 0) {
        viewNames = [getDefaultViewName()];
      }
      if (!viewNames.includes(nextCurrent)) {
        nextCurrent = viewNames[0];
      }
      if (nextSelected.length === 0) {
        nextSelected = [nextCurrent];
      }
      setAvailableViewNames(viewNames);
      setCurrentViewName(nextCurrent);
      setSaveViewName(nextCurrent);
      setSelectedViewNames(nextSelected);
      setViewNamesLoaded(true);
    } catch {
      setAvailableViewNames([getDefaultViewName()]);
      setCurrentViewName(getDefaultViewName());
      setSelectedViewNames([getDefaultViewName()]);
    } finally {
      setViewNamesLoaded(true);
      setIsLoadingViewNames(false);
    }
  }, [apiUrl, model.name, model.resource, allModels, preferencesResourceOverride]);
  const openSaveViewModalFor = useCallback((target) => {
    setSaveViewName(currentViewName || getDefaultViewName());
    setSaveViewAsNew(false);
    setPendingSaveTarget(target);
    setSaveViewModalOpen(true);
  }, [currentViewName]);
  const handleChangeViewName = useCallback(async (nextView) => {
    const resolvedName = normalizeViewName(nextView);
    setCurrentViewName(resolvedName);
    setSaveViewName(resolvedName);
    const nextSelected = selectedViewNames.length > 0 ? selectedViewNames : [resolvedName];
    await persistCurrentViewNames(nextSelected, resolvedName);
  }, [persistCurrentViewNames, selectedViewNames]);
  const updateSelectedViewNames = useCallback(async (nextSelected) => {
    if (nextSelected.length === 0) {
      nextSelected = [getDefaultViewName()];
    }
    setSelectedViewNames(nextSelected);
    const nextCurrent = nextSelected.includes(currentViewName) ? currentViewName : nextSelected[0];
    if (nextCurrent !== currentViewName) {
      setCurrentViewName(nextCurrent);
      setSaveViewName(nextCurrent);
    }
    await persistCurrentViewNames(nextSelected, nextCurrent);
  }, [currentViewName, persistCurrentViewNames]);
  const moveSelectedView = useCallback((name, direction) => {
    setSelectedViewNames((prev) => {
      const idx = prev.indexOf(name);
      if (idx < 0) return prev;
      const next = [...prev];
      const targetIndex = direction === "up" ? idx - 1 : idx + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[idx], next[targetIndex]] = [next[targetIndex], next[idx]];
      persistCurrentViewNames(next, currentViewName);
      return next;
    });
  }, [currentViewName, persistCurrentViewNames]);
  const handleRenameView = useCallback(async () => {
    const newName = normalizeViewName(renameViewName);
    if (!newName || newName === currentViewName) {
      setRenameViewModalOpen(false);
      return;
    }
    if (availableViewNames.includes(newName)) {
      message.error(_32("View name already exists."));
      return;
    }
    try {
      const resourceKey = prefsKey;
      const response = await authenticatedFetch(`${apiUrl}/views/preferences/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: resourceKey, action: "rename", view_name: currentViewName, new_name: newName })
      });
      if (!response.ok) {
        throw new Error(`Rename failed (${response.status})`);
      }
      message.success(_32("View renamed."));
      setRenameViewModalOpen(false);
      await loadViewNames();
    } catch (error) {
      message.error(error instanceof Error ? error.message : _32("Failed to rename view."));
    }
  }, [apiUrl, availableViewNames, currentViewName, model.name, model.resource, renameViewName, allModels, loadViewNames]);
  const confirmDeleteView = useCallback(() => {
    Modal.confirm({
      title: _32(_32("Delete view")),
      content: `Delete "${currentViewName}" and all its saved preferences?`,
      okText: _32("Delete"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const resourceKey = prefsKey;
          const response = await authenticatedFetch(`${apiUrl}/views/preferences/view`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resource: resourceKey, action: "delete", view_name: currentViewName })
          });
          if (!response.ok) {
            throw new Error(`Delete failed (${response.status})`);
          }
          message.success(_32("View deleted."));
          await loadViewNames();
        } catch (error) {
          message.error(error instanceof Error ? error.message : _32("Failed to delete view."));
        }
      }
    });
  }, [apiUrl, currentViewName, model.name, model.resource, allModels, loadViewNames]);
  const persistLayoutPreferences = useCallback(async (viewName) => {
    if (!resolvedLayoutPreferenceType) return;
    const resourceKey = prefsKey;
    const resolvedViewName = normalizeViewName(viewName);
    const preferences = {
      listVisible,
      analyzeOpen,
      isAnalyzeVertical,
      isAnalyzeFirst,
      filtersCollapsed,
      filters: filterRules,
      rowsPerPage: pageSize,
      tableColumns: selectedColumnKeys && selectedColumnKeys.length > 0 ? {
        selectedKeys: selectedColumnKeys,
        order: columnOrder && columnOrder.length > 0 ? columnOrder : selectedColumnKeys
      } : null,
      columnFilters: columnFiltersSelected,
      columnSort: columnSort.length > 0 ? columnSort : null,
      totalsSummaryFunctions,
      custom_view_name: resolvedViewName
    };
    setIsSavingLayoutPrefs(true);
    try {
      const targetTypes = resolvedLayoutPreferenceType === "ShowLayout" ? ["ShowLayout", "EditLayout"] : resolvedLayoutPreferenceType === "EditLayout" ? ["EditLayout", "ShowLayout"] : [resolvedLayoutPreferenceType];
      const responses = await Promise.all(
        targetTypes.map(
          (type) => authenticatedFetch(`${apiUrl}/views/preferences`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resource: resourceKey, preferenceType: type, preferences })
          })
        )
      );
      const failed = responses.find((response) => !response.ok);
      if (failed) {
        throw new Error(`Save failed (${failed.status})`);
      }
      message.success(_32("Layout preferences saved."));
    } catch (error) {
      message.error(error instanceof Error ? error.message : _32("Failed to save layout preferences."));
    } finally {
      setIsSavingLayoutPrefs(false);
    }
  }, [apiUrl, analyzeOpen, columnFiltersSelected, columnOrder, columnSort, filtersCollapsed, filterRules, isAnalyzeFirst, isAnalyzeVertical, resolvedLayoutPreferenceType, listVisible, pageSize, selectedColumnKeys, totalsSummaryFunctions, model.name, model.resource, allModels, preferencesResourceOverride]);
  const persistAnalyzePreferences = useCallback(async (viewName) => {
    const resourceKey = prefsKey;
    const resolvedViewName = normalizeViewName(viewName);
    const preferences = {
      categoryField1,
      categoryField2: categoryField2 ?? null,
      chartType,
      summaryFn,
      selectedSeriesKeys: selectedSeriesKeys ?? [],
      rankingMode,
      rankingFieldKey,
      rankingN,
      custom_view_name: resolvedViewName
    };
    setIsSavingAnalyzePrefs(true);
    try {
      const response = await authenticatedFetch(`${apiUrl}/views/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: resourceKey, preferenceType: "Analyze", preferences })
      });
      if (!response.ok) {
        throw new Error(`Save failed (${response.status})`);
      }
      message.success(_32("Analyze preferences saved."));
    } catch (error) {
      message.error(error instanceof Error ? error.message : _32("Failed to save analyze preferences."));
    } finally {
      setIsSavingAnalyzePrefs(false);
    }
  }, [apiUrl, categoryField1, categoryField2, chartType, selectedSeriesKeys, summaryFn, rankingMode, rankingFieldKey, rankingN, model.name, model.resource, allModels, preferencesResourceOverride]);
  const handleConfirmSaveView = useCallback(async () => {
    if (!pendingSaveTarget) return;
    const viewName = normalizeViewName(saveViewName || currentViewName);
    const viewExists = availableViewNames.includes(viewName);
    if (saveViewAsNew && viewExists) {
      message.error(_32("View name already exists. Choose a new name."));
      return;
    }
    if (!saveViewAsNew && viewName !== currentViewName && viewExists) {
      message.error(_32('Choose a new name or enable "Save as new view".'));
      return;
    }
    setSaveViewModalOpen(false);
    setPendingSaveTarget(null);
    setSaveViewAsNew(false);
    if (pendingSaveTarget === "layout") {
      await persistLayoutPreferences(viewName);
    } else {
      await persistAnalyzePreferences(viewName);
    }
    setCurrentViewName(viewName);
    setSaveViewName(viewName);
    const nextSelected = selectedViewNames.includes(viewName) ? selectedViewNames : [...selectedViewNames, viewName];
    setSelectedViewNames(nextSelected);
    await persistCurrentViewNames(nextSelected, viewName);
    await loadViewNames();
  }, [availableViewNames, currentViewName, loadViewNames, pendingSaveTarget, persistAnalyzePreferences, persistCurrentViewNames, persistLayoutPreferences, saveViewAsNew, saveViewName, selectedViewNames]);
  useEffect(() => {
    loadViewNames();
  }, [loadViewNames]);
  useEffect(() => {
    if (!viewNamesLoaded) return;
    analyzePrefsTouchedRef.current = false;
    layoutPrefsTouchedRef.current = false;
    analyzePrefsLoadedRef.current = false;
    layoutPrefsLoadedRef.current = false;
    setColumnsSelectorOpen(false);
    setSaveViewName(currentViewName);
    setSaveViewAsNew(false);
    resetLayoutDefaults();
    resetAnalyzeDefaults();
  }, [currentViewName, resetAnalyzeDefaults, resetLayoutDefaults, viewNamesLoaded]);
  useEffect(() => {
    const resourceKey = prefsKey;
    const viewKey = `${resourceKey}::${currentViewName}`;
    if (analyzePrefsResourceRef.current !== viewKey) {
      analyzePrefsLoadedRef.current = false;
      setAnalyzePrefsReady(false);
      analyzePrefsResourceRef.current = viewKey;
    }
    if (analyzePrefsLoadedRef.current) return;
    let cancelled = false;
    const loadPreferences = async () => {
      try {
        const response = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=Analyze&custom_view_name=${encodeURIComponent(currentViewName)}`);
        if (!response.ok) {
          throw new Error(`Load failed (${response.status})`);
        }
        const data = await response.json();
        if (cancelled || analyzePrefsTouchedRef.current) return;
        const prefs = data?.preferences;
        if (!prefs || typeof prefs !== "object") {
          analyzePrefsLoadedRef.current = true;
          if (!cancelled) setAnalyzePrefsReady(true);
          return;
        }
        if ("categoryField1" in prefs) setCategoryField1(prefs.categoryField1 ?? null);
        if ("categoryField2" in prefs) setCategoryField2(prefs.categoryField2 ?? null);
        if ("chartType" in prefs) setChartType(prefs.chartType);
        if ("summaryFn" in prefs) setSummaryFn(prefs.summaryFn);
        if ("selectedSeriesKeys" in prefs) {
          setSelectedSeriesKeys(Array.isArray(prefs.selectedSeriesKeys) ? prefs.selectedSeriesKeys : []);
        }
        if ("rankingMode" in prefs && (prefs.rankingMode === "none" || prefs.rankingMode === "top" || prefs.rankingMode === "bottom")) {
          setRankingMode(prefs.rankingMode);
        }
        if ("rankingFieldKey" in prefs) setRankingFieldKey(prefs.rankingFieldKey ?? null);
        if ("rankingN" in prefs) {
          const nextRankingN = Number(prefs.rankingN);
          setRankingN(Number.isFinite(nextRankingN) && nextRankingN > 0 ? Math.floor(nextRankingN) : 10);
        }
        analyzePrefsLoadedRef.current = true;
        if (!cancelled) setAnalyzePrefsReady(true);
      } catch {
        if (!cancelled) setAnalyzePrefsReady(true);
      }
    };
    loadPreferences();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, currentViewName, model.name, model.resource, allModels, preferencesResourceOverride]);
  useEffect(() => {
    if (!resolvedLayoutPreferenceType) return;
    const resourceKey = prefsKey;
    const viewKey = `${resourceKey}::${resolvedLayoutPreferenceType}::${currentViewName}`;
    if (layoutPrefsResourceRef.current !== viewKey) {
      layoutPrefsLoadedRef.current = false;
      setLayoutPrefsReady(false);
      layoutPrefsResourceRef.current = viewKey;
    }
    if (layoutPrefsLoadedRef.current) {
      setLayoutPrefsReady(true);
      return;
    }
    let cancelled = false;
    const applyPrefs = (prefs) => {
      if (!prefs || typeof prefs !== "object") return false;
      if ("listVisible" in prefs && defaultListVisible !== false) setListVisible(Boolean(prefs.listVisible));
      if ("analyzeOpen" in prefs) setAnalyzeOpen(Boolean(prefs.analyzeOpen));
      if ("isAnalyzeVertical" in prefs) setIsAnalyzeVertical(Boolean(prefs.isAnalyzeVertical));
      if ("isAnalyzeFirst" in prefs) setIsAnalyzeFirst(Boolean(prefs.isAnalyzeFirst));
      if ("filtersCollapsed" in prefs) setFiltersCollapsed(Boolean(prefs.filtersCollapsed));
      if ("filters" in prefs && Array.isArray(prefs.filters)) {
        setFilterRules(normalizeFilterRules(prefs.filters));
      }
      if ("rowsPerPage" in prefs) {
        const nextPageSize = Number(prefs.rowsPerPage);
        if (Number.isFinite(nextPageSize) && nextPageSize > 0) {
          setPageSize(nextPageSize);
        }
      }
      if ("tableColumns" in prefs && prefs.tableColumns) {
        const selectedKeys = Array.isArray(prefs.tableColumns.selectedKeys) ? prefs.tableColumns.selectedKeys : Array.isArray(prefs.tableColumns) ? prefs.tableColumns : null;
        const order = Array.isArray(prefs.tableColumns.order) ? prefs.tableColumns.order : Array.isArray(prefs.tableColumns) ? prefs.tableColumns : null;
        if (selectedKeys && selectedKeys.length > 0) {
          setSelectedColumnKeys(selectedKeys);
          setColumnOrder(order && order.length > 0 ? order : selectedKeys);
        }
      }
      if ("columnFilters" in prefs && prefs.columnFilters && typeof prefs.columnFilters === "object") {
        setColumnFiltersSelected(prefs.columnFilters);
      }
      if ("columnSort" in prefs && prefs.columnSort) {
        setColumnSort(normalizeColumnSortPreference(prefs.columnSort));
      }
      if ("totalsSummaryFunctions" in prefs && prefs.totalsSummaryFunctions && typeof prefs.totalsSummaryFunctions === "object") {
        setTotalsSummaryFunctions(prefs.totalsSummaryFunctions);
      }
      return Object.keys(prefs).length > 0;
    };
    const loadPreferences = async () => {
      try {
        const response = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=${resolvedLayoutPreferenceType}&custom_view_name=${encodeURIComponent(currentViewName)}`);
        if (!response.ok) {
          throw new Error(`Load failed (${response.status})`);
        }
        const data = await response.json();
        if (cancelled || layoutPrefsTouchedRef.current) return;
        const prefs = data?.preferences;
        const applied = applyPrefs(prefs);
        if (!applied && resolvedLayoutPreferenceType === "EditLayout") {
          const fallbackResponse = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=ShowLayout&custom_view_name=${encodeURIComponent(currentViewName)}`);
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            if (cancelled || layoutPrefsTouchedRef.current) return;
            applyPrefs(fallbackData?.preferences);
          }
        } else if (!applied && resolvedLayoutPreferenceType === "ShowLayout") {
          const fallbackResponse = await authenticatedFetch(`${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=EditLayout&custom_view_name=${encodeURIComponent(currentViewName)}`);
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            if (cancelled || layoutPrefsTouchedRef.current) return;
            applyPrefs(fallbackData?.preferences);
          }
        }
        layoutPrefsLoadedRef.current = true;
        setLayoutPrefsReady(true);
      } catch {
        setLayoutPrefsReady(true);
      }
    };
    loadPreferences();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, currentViewName, resolvedLayoutPreferenceType, model.name, model.resource, allModels, preferencesResourceOverride]);
  const fetchAllRows = useCallback(async () => {
    setIsAllRowsLoading(true);
    setAllRowsError(null);
    const filtersToApply = activeFilters && activeFilters.length > 0 ? activeFilters : tableFilters;
    const pageSize2 = 500;
    let start = 0;
    let allRows2 = [];
    try {
      while (true) {
        const params = new URLSearchParams();
        params.set("_start", String(start));
        params.set("_end", String(start + pageSize2));
        filtersToApply.forEach((filterItem) => {
          if (!filterItem?.field || filterItem?.value === void 0 || filterItem?.value === null) return;
          const vals = Array.isArray(filterItem.value) ? filterItem.value : [filterItem.value];
          if (vals.some((v) => String(v).startsWith("__range__:"))) return;
          const op = filterItem.operator;
          const suffix = op && op !== "eq" ? `_${op}` : "";
          params.append(`${filterItem.field}${suffix}`, String(filterItem.value));
        });
        const resourcePath = resolveResourcePath(model.resource || model.name, allModels);
        const response = await authenticatedFetch(`${apiUrl}/${resourcePath}?${params.toString()}`);
        const data = await response.json();
        if (!Array.isArray(data)) break;
        allRows2 = allRows2.concat(data);
        if (data.length < pageSize2) break;
        start += pageSize2;
      }
      setAllRowsData(allRows2);
    } catch (error) {
      setAllRowsError(error instanceof Error ? error.message : _32("Failed to fetch all rows"));
    } finally {
      setIsAllRowsLoading(false);
      setAllRowsLoaded(true);
    }
  }, [activeFilters, apiUrl, model.name, model.resource, tableFilters, allModels]);
  useEffect(() => {
    if (!shouldLoadAllRows) return;
    const filtersToApply = activeFilters && activeFilters.length > 0 ? activeFilters : tableFilters;
    const signature = JSON.stringify({
      resource: resolveResourcePath(model.resource || model.name, allModels),
      filters: (filtersToApply || []).map((filterItem) => ({
        field: filterItem?.field,
        operator: filterItem?.operator,
        value: filterItem?.value
      }))
    });
    if (lastAllRowsSignature.current === signature && !exportRequested && !analyzeOpen && !shouldLoadAllRows) return;
    lastAllRowsSignature.current = signature;
    fetchAllRows();
  }, [activeFilters, analyzeOpen, exportRequested, fetchAllRows, model.name, shouldLoadAllRows, tableFilters]);
  useEffect(() => {
    if (!allRowsLoaded) return;
    if (analyzeTouchedRef.current) return;
    if (isTotalsDetailsView) return;
    if ((allRows?.length ?? 0) <= 1) {
      setAnalyzeOpen(false);
    } else {
      setAnalyzeOpen(true);
    }
  }, [allRows?.length, allRowsLoaded, isTotalsDetailsView]);
  useEffect(() => {
    if (!hasActiveFilterRules || isClientFiltering) return;
    const resolveServerDate = (val, forRange) => {
      if (val?.mode === "relative") {
        const resolved = resolveRelativeDate(val, forRange);
        if (forRange) return { start: resolved.start?.toISOString(), end: resolved.end?.toISOString() };
        return { date: resolved.date?.toISOString() };
      }
      const date = dayjs7(val?.date || val);
      if (!date.isValid()) return {};
      if (forRange) return { start: date.startOf("day").toISOString(), end: date.endOf("day").toISOString() };
      return { date: date.startOf("day").toISOString() };
    };
    const serverFilters = filterRules.filter((rule) => rule.fieldKey && rule.operator && rule.value !== void 0 && rule.value !== null && rule.value !== "").flatMap((rule) => {
      const field = model.fields.find((f) => f.key === rule.fieldKey);
      if (!field) return [];
      const fieldKey = field.key;
      const op = rule.operator;
      if (field.type === "string") {
        return [{
          field: fieldKey,
          operator: op === "contains" ? "contains" : "eq",
          value: rule.value
        }];
      }
      if (field.type === "number") {
        if (op === "between") {
          return [
            { field: fieldKey, operator: "gte", value: rule.value },
            { field: fieldKey, operator: "lte", value: rule.value2 }
          ];
        }
        return [{
          field: fieldKey,
          operator: op,
          value: rule.value
        }];
      }
      if (field.type === "boolean") {
        return [{ field: fieldKey, operator: "eq", value: Boolean(rule.value) }];
      }
      if (field.type === "date" || field.type === "datetime") {
        if (op === "between") {
          const start = resolveServerDate(rule.value, true).start;
          const end = resolveServerDate(rule.value2, true).end;
          return [
            { field: fieldKey, operator: "gte", value: start },
            { field: fieldKey, operator: "lte", value: end }
          ];
        }
        const operatorMap = { before: "lt", after: "gt", on: "eq" };
        const dateVal = resolveServerDate(rule.value, false).date;
        return [{
          field: fieldKey,
          operator: op && operatorMap[op] || "eq",
          value: dateVal
        }];
      }
      return [];
    });
    const combined = [...tableFilters, ...serverFilters];
    setFilters(combined, "replace");
  }, [filterRules, hasActiveFilterRules, isClientFiltering, model.fields, setFilters, tableFilters]);
  const formatCategoryValue = useCallback((field, record) => {
    if (!field) return _32("All");
    const raw = record?.[field.key];
    if (raw === void 0 || raw === null) return "-";
    if (field.key === "eid" && record?._label) return record._label;
    if (field.reference) {
      const cacheKey = `${field.reference}:${raw}`;
      return labelCache[cacheKey] || String(raw);
    }
    if (field.options) {
      return field.options.find((option) => option.value === raw)?.label || String(raw);
    }
    if (field.type === "boolean") return raw ? _32("Yes") : _32("No");
    if (field.type === "date") return formatDateValue(raw);
    if (field.type === "datetime") return formatDateTimeValue(raw) ?? String(raw);
    if (field.type === "time") return formatTimeValue(raw);
    return String(raw);
  }, [labelCache]);
  const chartData = useMemo(() => {
    const data = allRows || [];
    const cat1Field = categoryField1 ? model.fields.find((field) => field.key === categoryField1) : void 0;
    const cat2Field = categoryField2 ? model.fields.find((field) => field.key === categoryField2) : void 0;
    const groupMap = /* @__PURE__ */ new Map();
    const numericFieldMap = new Map(
      numericFields.map((field) => [field.key, field])
    );
    const rawSeriesKeys = numericFields.length > 0 ? numericFields.map((field) => field.key) : ["__count__"];
    const selectedSeriesKeysValid = (selectedSeriesKeys || []).filter((key) => {
      if (key === "__count__" && numericFields.length === 0) return true;
      return numericFieldMap.has(key);
    });
    const seriesKeys = selectedSeriesKeysValid.length > 0 ? selectedSeriesKeysValid : rawSeriesKeys;
    const rankingSeriesKey = rankingFieldKey && numericFieldMap.has(rankingFieldKey) ? rankingFieldKey : null;
    const aggregationKeys = Array.from(/* @__PURE__ */ new Set([...seriesKeys || [], ...rankingSeriesKey ? [rankingSeriesKey] : []]));
    const statsMap = /* @__PURE__ */ new Map();
    data.forEach((record) => {
      const cat1Value = formatCategoryValue(cat1Field, record);
      const cat2Value = cat2Field ? formatCategoryValue(cat2Field, record) : null;
      const label = cat2Field ? `${cat1Value} \u2022 ${cat2Value}` : `${cat1Value}`;
      const groupKey = label;
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, { key: groupKey, label, values: Object.fromEntries(aggregationKeys.map((key) => [key, 0])) });
        statsMap.set(groupKey, Object.fromEntries(aggregationKeys.map((key) => [key, []])));
      }
      const stats = statsMap.get(groupKey);
      if (numericFields.length === 0) {
        if (stats["__count__"]) {
          stats["__count__"].push(1);
        }
      } else {
        aggregationKeys.forEach((key) => {
          const field = numericFieldMap.get(key);
          if (!field) return;
          const value = Number(record?.[field.key]);
          if (!Number.isNaN(value) && stats[key]) {
            stats[key].push(value);
          }
        });
      }
    });
    groupMap.forEach((group, groupKey) => {
      const stats = statsMap.get(groupKey);
      if (!stats) return;
      aggregationKeys.forEach((key) => {
        const values = stats[key] || [];
        if (values.length === 0) {
          group.values[key] = 0;
          return;
        }
        switch (summaryFn) {
          case "count":
            group.values[key] = values.length;
            return;
          case "avg":
            group.values[key] = values.reduce((acc, val) => acc + val, 0) / values.length;
            return;
          case "max":
            group.values[key] = Math.max(...values);
            return;
          case "min":
            group.values[key] = Math.min(...values);
            return;
          case "stddev": {
            const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
            const variance = values.reduce((acc, val) => acc + (val - mean) ** 2, 0) / values.length;
            group.values[key] = Math.sqrt(variance);
            return;
          }
          case "sum":
          default:
            group.values[key] = values.reduce((acc, val) => acc + val, 0);
        }
      });
    });
    const seriesLabels = numericFields.length > 0 ? numericFields.reduce((acc, field) => {
      acc[field.key] = field.label;
      return acc;
    }, { "__count__": _32("Count") }) : { "__count__": _32("Count") };
    const baseGroups = Array.from(groupMap.values());
    let groups = baseGroups;
    if (rankingMode !== "none" && rankingFieldKey) {
      const limit = Math.max(1, Math.floor(rankingN || 10));
      const ranked = [...baseGroups].sort((a, b) => {
        const aVal = Number(a.values[rankingFieldKey] ?? 0);
        const bVal = Number(b.values[rankingFieldKey] ?? 0);
        if (aVal === bVal) return a.label.localeCompare(b.label);
        return rankingMode === "top" ? bVal - aVal : aVal - bVal;
      });
      groups = ranked.slice(0, limit);
    }
    const allowedGroupKeys = new Set(groups.map((group) => group.key));
    const filteredRawRows = data.filter((record) => {
      const cat1Value = formatCategoryValue(cat1Field, record);
      const cat2Value = cat2Field ? formatCategoryValue(cat2Field, record) : null;
      const label = cat2Field ? `${cat1Value} \u2022 ${cat2Value}` : `${cat1Value}`;
      return allowedGroupKeys.has(label);
    });
    return {
      groups,
      seriesKeys,
      seriesLabels,
      filteredRawRows
    };
  }, [allRows, categoryField1, categoryField2, model.fields, numericFields, formatCategoryValue, summaryFn, selectedSeriesKeys, rankingMode, rankingFieldKey, rankingN]);
  const chartSignature = useMemo(() => {
    return JSON.stringify({
      chartType,
      summaryFn,
      categoryField1,
      categoryField2,
      rankingMode,
      rankingFieldKey,
      rankingN,
      seriesKeys: chartData.seriesKeys,
      groups: chartData.groups
    });
  }, [chartType, summaryFn, categoryField1, categoryField2, rankingMode, rankingFieldKey, rankingN, chartData]);
  const statsSummary = useMemo(() => {
    return buildStatsSummary(allRows, displayFields, labelCache);
  }, [allRows, displayFields, labelCache]);
  const tdCategoricalBoxes = useMemo(() => {
    if (!isTotalsDetailsView) return [];
    return displayFields.filter((field) => field.type !== "number" || Boolean(field.reference)).map((field) => {
      const counts = /* @__PURE__ */ new Map();
      (allRows || []).forEach((row) => {
        const raw = row?.[field.key];
        let label = "-";
        if (raw !== void 0 && raw !== null) {
          if (field.reference) {
            const cacheKey = `${field.reference}:${raw}`;
            label = labelCache[cacheKey] || String(raw);
          } else if (field.options) {
            label = field.options.find((o) => o.value === raw)?.label || String(raw);
          } else if (field.type === "boolean") {
            label = raw ? _32("Yes") : _32("No");
          } else if (field.type === "date") {
            label = formatDateValue(raw);
          } else if (field.type === "datetime") {
            label = formatDateTimeValue(raw) ?? String(raw);
          } else if (field.type === "time") {
            label = formatTimeValue(raw);
          } else {
            label = String(raw);
          }
        }
        counts.set(label, (counts.get(label) || 0) + 1);
      });
      const breakdown = Array.from(counts.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
      return {
        key: field.key,
        label: field.label,
        value: breakdown.length,
        breakdown,
        showBreakdown: breakdown.length > 0 && breakdown.length < 5
      };
    });
  }, [isTotalsDetailsView, allRows, displayFields, labelCache]);
  const getDefaultTotalsSummaryFn = useCallback((field) => {
    if (["eid", "eid_from", "eid_to"].includes(field.key)) return "count";
    return "sum";
  }, []);
  const resolveTotalsSummaryFn = useCallback((field) => {
    return totalsSummaryFunctions[field.key] || getDefaultTotalsSummaryFn(field);
  }, [getDefaultTotalsSummaryFn, totalsSummaryFunctions]);
  const computeTotalsSummaryValue = useCallback((field) => {
    const fn = resolveTotalsSummaryFn(field);
    if (field.type === "number" && !field.reference) {
      const values = (allRows || []).map((row) => Number(row?.[field.key])).filter((v) => !Number.isNaN(v) && Number.isFinite(v));
      if (values.length === 0) return 0;
      switch (fn) {
        case "count":
          return values.length;
        case "avg":
          return values.reduce((a, b) => a + b, 0) / values.length;
        case "max":
          return Math.max(...values);
        case "min":
          return Math.min(...values);
        case "stddev": {
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          return Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
        }
        case "distinct":
          return new Set(values).size;
        default:
          return values.reduce((a, b) => a + b, 0);
      }
    }
    const rawValues = (allRows || []).map((row) => row?.[field.key]);
    if (fn === "count") return rawValues.length;
    if (fn === "distinct") return new Set(rawValues.map((v) => String(v ?? "-"))).size;
    return rawValues.length;
  }, [allRows, resolveTotalsSummaryFn]);
  const getSummaryFunctionDisplayText = useCallback((fn) => {
    if (!fn) return "";
    const labels = {
      sum: _32("Sum"),
      avg: _32("Average"),
      count: _32("Count"),
      max: _32("Max"),
      min: _32("Min"),
      stddev: _32("Std Dev"),
      distinct: _32("Distinct")
    };
    return labels[fn] || fn;
  }, []);
  const tdNumericBoxes = useMemo(() => {
    if (!isTotalsDetailsView) return [];
    return displayFields.filter((field) => field.type === "number" && !field.reference).map((field) => {
      const summaryFnVal = resolveTotalsSummaryFn(field);
      const value = computeTotalsSummaryValue(field);
      const label = field.label;
      return { key: field.key, label, value, summaryFn: summaryFnVal };
    });
  }, [isTotalsDetailsView, displayFields, resolveTotalsSummaryFn, computeTotalsSummaryValue]);
  const totalsSummaryConfigFields = useMemo(() => {
    return displayFields.filter((field) => field.type === "number" && !field.reference);
  }, [displayFields]);
  const renderDynamicListTotalsBoxes = () => {
    if (!isTotalsDetailsView) return null;
    const hasCat = tdCategoricalBoxes.length > 0;
    const hasNum = tdNumericBoxes.length > 0;
    if (!hasCat && !hasNum) return null;
    const catTone = { soft: "#fde68a", softer: "#fffbeb", text: "#92400e", chipBg: "#ffffff" };
    return /* @__PURE__ */ jsx("div", { style: { marginBottom: 12, borderRadius: 8, padding: 10, background: token.colorBgContainer }, children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
      /* @__PURE__ */ jsx("div", { style: { flex: 1, overflowX: "auto", paddingBottom: 2 }, children: /* @__PURE__ */ jsxs("div", { style: { width: "max-content", minWidth: "100%", display: "flex", justifyContent: "center", gap: 12, alignItems: "stretch" }, children: [
        hasCat && /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 8, flexWrap: "nowrap", alignItems: "stretch" }, children: tdCategoricalBoxes.map((item) => /* @__PURE__ */ jsxs(
          Card,
          {
            size: "small",
            variant: "borderless",
            style: { minWidth: 170, borderRadius: 8, background: `linear-gradient(165deg, ${catTone.softer} 0%, ${catTone.soft} 100%)` },
            styles: { body: { padding: 10 } },
            children: [
              /* @__PURE__ */ jsx("div", { style: { fontSize: 12, fontWeight: 400, color: catTone.text, textAlign: "center", marginTop: 2 }, children: item.label }),
              item.showBreakdown ? /* @__PURE__ */ jsx("div", { style: { display: "grid", gap: 4, marginTop: 8 }, children: item.breakdown.map((entry) => /* @__PURE__ */ jsx(
                "div",
                {
                  style: { fontSize: 12, color: catTone.text, fontWeight: 400, textAlign: "center", borderRadius: 8, background: catTone.chipBg, padding: "2px 8px" },
                  children: `${entry.value}: ${formatNumberValue(entry.count)}`
                },
                `td-cat-${item.key}-${entry.value}`
              )) }) : /* @__PURE__ */ jsx("div", { style: { fontSize: 24, fontWeight: 400, color: catTone.text, textAlign: "center", marginTop: 4 }, children: formatNumberValue(item.value) })
            ]
          },
          `td-cat-${item.key}`
        )) }),
        hasCat && hasNum && /* @__PURE__ */ jsx("div", { style: { borderLeft: `1px solid ${token.colorBorderSecondary}`, margin: "0 2px" } }),
        hasNum && /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 8, flexWrap: "nowrap", alignItems: "stretch" }, children: tdNumericBoxes.map((item) => /* @__PURE__ */ jsxs(
          Card,
          {
            size: "small",
            variant: "borderless",
            style: { minWidth: 170, borderRadius: 8, background: `linear-gradient(165deg, ${modelTone.softer} 0%, ${modelTone.soft} 100%)` },
            styles: { body: { padding: 10 } },
            children: [
              /* @__PURE__ */ jsx("div", { style: { fontSize: 12, fontWeight: 400, color: modelTone.text, textAlign: "center", marginTop: 2 }, children: item.summaryFn && item.summaryFn !== "sum" ? `${item.label} (${getSummaryFunctionDisplayText(item.summaryFn)})` : item.label }),
              /* @__PURE__ */ jsx("div", { style: { fontSize: 24, fontWeight: 400, color: modelTone.solid, textAlign: "center", marginTop: 4, fontVariantNumeric: "tabular-nums" }, children: formatNumberValue(item.value) })
            ]
          },
          `td-num-${item.key}`
        )) })
      ] }) }),
      /* @__PURE__ */ jsx(Tooltip, { title: isTdFlipped ? _32("Show totals") : _32("Show details"), children: /* @__PURE__ */ jsx(
        Button,
        {
          size: "small",
          icon: /* @__PURE__ */ jsx(SwapOutlined, { style: { transform: "rotate(90deg)" } }),
          "aria-label": isTdFlipped ? _32("Show totals") : _32("Show details"),
          onClick: () => setIsTdFlipped((prev) => !prev),
          style: {
            flexShrink: 0,
            background: modelTone.soft,
            borderColor: modelTone.border,
            color: modelTone.text
          }
        }
      ) })
    ] }) });
  };
  const numericColumnMaxes = useMemo(() => {
    const maxes = {};
    const rows = allRows || [];
    displayFields.forEach((field) => {
      if (field.type !== "number" || field.reference) return;
      const values = rows.map((row) => Number(row?.[field.key])).filter((value) => !Number.isNaN(value) && Number.isFinite(value));
      if (values.length === 0) {
        maxes[field.key] = 0;
        return;
      }
      maxes[field.key] = Math.max(...values.map((val) => Math.abs(val)));
    });
    return maxes;
  }, [allRows, displayFields]);
  const statsNumericMaxes = useMemo(() => {
    const stats = statsSummary.numericStats;
    const maxAbs = (values) => {
      const absValues = values.filter((val) => typeof val === "number").map((val) => Math.abs(val));
      return absValues.length > 0 ? Math.max(...absValues) : 0;
    };
    return {
      sum: maxAbs(stats.map((row) => row.sum)),
      avg: maxAbs(stats.map((row) => row.avg)),
      min: maxAbs(stats.map((row) => row.min)),
      max: maxAbs(stats.map((row) => row.max)),
      stddev: maxAbs(stats.map((row) => row.stddev))
    };
  }, [statsSummary.numericStats]);
  useEffect(() => {
    if (!analyzeOpen) return;
    skipNextAnimationRef.current = true;
    setChartAnimationStage("enter");
    setChartAnimationKey((key) => key + 1);
  }, [analyzeOpen]);
  useEffect(() => {
    if (!analyzeOpen) return;
    if (skipNextAnimationRef.current) {
      skipNextAnimationRef.current = false;
      return;
    }
    setChartAnimationStage("update");
    setChartAnimationKey((key) => key + 1);
  }, [analyzeOpen, chartSignature]);
  const fieldByKey = useMemo(() => {
    return new Map(model.fields.map((field) => [field.key, field]));
  }, [model.fields]);
  const chartTitle = useMemo(() => {
    const cat1Label = categoryField1 ? fieldByKey.get(categoryField1)?.label : "All";
    const cat2Label = categoryField2 ? fieldByKey.get(categoryField2)?.label : null;
    const parts = [model.label || model.name, cat1Label];
    if (cat2Label) parts.push(cat2Label);
    return parts.filter(Boolean).join(" \u2022 ");
  }, [categoryField1, categoryField2, fieldByKey, model.label, model.name]);
  const formatValueForExport = useCallback((field, record) => {
    const raw = record?.[field.key];
    if (raw === void 0 || raw === null) return "";
    if (field.reference) {
      const cacheKey = `${field.reference}:${raw}`;
      return labelCache[cacheKey] || String(raw);
    }
    if (field.options) {
      return field.options.find((option) => option.value === raw)?.label || String(raw);
    }
    if (field.type === "boolean") return raw ? _32("Yes") : _32("No");
    if (field.type === "date") return formatDateValue(raw);
    if (field.type === "datetime") return formatDateTimeValue(raw) ?? String(raw);
    if (field.type === "time") return formatTimeValue(raw);
    return String(raw);
  }, [labelCache]);
  useEffect(() => {
    if (!exportRequested || isAllRowsLoading) return;
    const escapeCsv = (value) => {
      if (value.includes('"') || value.includes(",") || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };
    const headers = model.fields.map((field) => field.label);
    const rows = allRows.map((record) => {
      return model.fields.map((field) => escapeCsv(formatValueForExport(field, record)));
    });
    const csv = [headers.map(escapeCsv).join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${model.name}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExportRequested(false);
  }, [exportRequested, isAllRowsLoading, allRows, model.fields, model.name, formatValueForExport]);
  const exportChartImage = () => {
    const svg = chartSvgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const width = svg.viewBox.baseVal.width || svg.clientWidth || 1e3;
      const height = svg.viewBox.baseVal.height || svg.clientHeight || 420;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = pngUrl;
        link.download = `${model.name}-chart.png`;
        link.click();
        URL.revokeObjectURL(pngUrl);
      }, "image/png");
    };
    img.src = url;
  };
  const exportChartPdf = () => {
    const svg = chartSvgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const width = svg.viewBox.baseVal.width || svg.clientWidth || 1e3;
      const height = svg.viewBox.baseVal.height || svg.clientHeight || 420;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL("image/png");
      const chartHeading = chartTitle || `${model.label} Chart`;
      openPdfWindow(
        `${model.name}-chart`,
        `<h2>${escapeHtml(chartHeading)}</h2><img src="${dataUrl}" style="width: 100%; height: auto;" />`
      );
    };
    img.src = url;
  };
  const exportStatsPdf = () => {
    openPdfWindow(`${model.name}-stats`, buildStatsHtml(statsSummary));
  };
  const getRowKey = (record) => {
    if (record?.eid !== void 0 && record?.eid !== null) return record.eid;
    if (record?.id !== void 0 && record?.id !== null) return record.id;
    if (relationConfig?.targetKey || relationConfig?.otherKey) {
      const targetValue = relationConfig?.targetKey ? record?.[relationConfig.targetKey] : void 0;
      const otherValue = relationConfig?.otherKey ? record?.[relationConfig.otherKey] : void 0;
      if (targetValue !== void 0 || otherValue !== void 0) {
        return `${targetValue ?? "null"}_${otherValue ?? "null"}`;
      }
    }
    const compositeKey = model.fields.map((field) => record?.[field.key]).filter((value) => value !== void 0 && value !== null).join("_");
    return compositeKey || JSON.stringify(record);
  };
  const getTargetInfo = (record) => {
    if (relationConfig?.otherResource && relationConfig?.otherKey && record[relationConfig.otherKey]) {
      return { resource: relationConfig.otherResource, id: record[relationConfig.otherKey], isLinkRow: true };
    }
    const resourceName = model.resource || model.name;
    const explicitPk = model.pkField ? record[model.pkField] : void 0;
    const isPkField = model.fields?.find((f) => f.isPk)?.key;
    const pkValue = explicitPk ?? (isPkField ? record[isPkField] : void 0) ?? record.eid ?? record.id ?? null;
    if (pkValue != null) {
      return { resource: resourceName, id: pkValue, isLinkRow: false };
    }
    return { resource: null, id: null, isLinkRow: false };
  };
  const clearBulkSelection = useCallback(() => {
    setBulkSelectedRowKeys([]);
    bulkSelectedRowsMapRef.current.clear();
  }, []);
  useEffect(() => {
    if (!selectAllFilteredPending || !allRowsLoaded) return;
    setSelectAllFilteredPending(false);
    const keys = filteredDataSource.map((r) => getRowKey(r));
    bulkSelectedRowsMapRef.current.clear();
    filteredDataSource.forEach((r) => bulkSelectedRowsMapRef.current.set(getRowKey(r), r));
    setBulkSelectedRowKeys(keys);
  }, [selectAllFilteredPending, allRowsLoaded, filteredDataSource]);
  const handleSelectAllFiltered = useCallback(() => {
    if (!allRowsLoaded) {
      setSelectAllFilteredPending(true);
      fetchAllRows();
    } else {
      const keys = filteredDataSource.map((r) => getRowKey(r));
      bulkSelectedRowsMapRef.current.clear();
      filteredDataSource.forEach((r) => bulkSelectedRowsMapRef.current.set(getRowKey(r), r));
      setBulkSelectedRowKeys(keys);
    }
  }, [allRowsLoaded, fetchAllRows, filteredDataSource]);
  const executeBulkActions = useCallback(async () => {
    const records = bulkSelectedRowKeys.map((k) => bulkSelectedRowsMapRef.current.get(k)).filter(Boolean);
    if (records.length === 0) return;
    const resource = resolveResourcePath(model.resource || model.name, allModels);
    if (bulkActionsToApply.includes("__export_csv__")) {
      const escapeCsv = (val) => val.includes('"') || val.includes(",") || val.includes("\n") ? `"${val.replace(/"/g, '""')}"` : val;
      const headers = displayFields.map((f) => f.label);
      const rows = records.map(
        (record) => displayFields.map((field) => escapeCsv(formatValueForExport(field, record)))
      );
      const csv = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${model.name}_selected.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
    const apiActionKeys = bulkActionsToApply.filter((k) => k !== "__export_csv__");
    if (apiActionKeys.length === 0) {
      setBulkActionModalOpen(false);
      clearBulkSelection();
      setBulkActionsToApply([]);
      return;
    }
    setIsBulkExecuting(true);
    let errorOccurred = false;
    try {
      for (const record of records) {
        const id = record.eid ?? record.id;
        for (const actionKey of apiActionKeys) {
          if (actionKey === "__delete__") {
            const resp = await authenticatedFetch(`${apiUrl}/${resource}/${id}`, { method: "DELETE" });
            if (!resp.ok) throw new Error(`${_32("Delete failed for record")} ${id}`);
          } else if (actionKey === "__change_field__") {
            if (!bulkChangeFieldKey) continue;
            const payload = { ...record, [bulkChangeFieldKey]: bulkChangeFieldValue };
            delete payload._label;
            const resp = await authenticatedFetch(`${apiUrl}/${resource}/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            if (!resp.ok) throw new Error(`${_32("Update failed for record")} ${id}`);
          } else if (actionKey === "__clone__") {
            const clonePayload = { ...record };
            delete clonePayload.eid;
            delete clonePayload.creation_date;
            delete clonePayload.modification_date;
            delete clonePayload._label;
            const resp = await authenticatedFetch(`${apiUrl}/${resource}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(clonePayload)
            });
            if (!resp.ok) throw new Error(`${_32("Clone failed for record")} ${id}`);
          } else if (actionKey === "__pin__") {
            await authenticatedFetch(`${apiUrl}/dashboard/pinned-records`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ resource, record_id: String(id) })
            });
          } else if (actionKey === "__unpin__") {
            await authenticatedFetch(
              `${apiUrl}/dashboard/pinned-records/${encodeURIComponent(resource)}/${encodeURIComponent(String(id))}`,
              { method: "DELETE" }
            );
          } else {
            const customAction = bulkActions?.find((a) => a.key === actionKey);
            if (customAction) await customAction.onExecuteOne(record);
          }
        }
      }
      message.success(
        _32("Actions applied successfully to {count} rows").replace("{count}", String(records.length))
      );
    } catch (e) {
      errorOccurred = true;
      message.error(e?.message || _32("Bulk action failed"));
    } finally {
      setIsBulkExecuting(false);
      setBulkActionModalOpen(false);
      if (!errorOccurred) {
        clearBulkSelection();
        setBulkActionsToApply([]);
        setBulkChangeFieldKey(null);
        setBulkChangeFieldValue(null);
      }
      invalidate({ resource: model.resource || model.name, invalidates: ["list"] });
    }
  }, [bulkSelectedRowKeys, bulkActionsToApply, bulkChangeFieldKey, bulkChangeFieldValue, bulkActions, apiUrl, model.name, model.resource, allModels, displayFields, formatValueForExport, clearBulkSelection, invalidate]);
  const shouldIgnoreRowClick = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest(
        "a,button,input,select,textarea,[role='button'],.ant-checkbox,.ant-switch,.ant-select,.ant-picker,.ant-pagination"
      )
    );
  };
  const handleRowClick = (record, event) => {
    if (event.defaultPrevented || shouldIgnoreRowClick(event.target)) return;
    const { resource, id } = getTargetInfo(record);
    if (resource && id !== void 0 && id !== null) {
      if (paneNav?.isInMultiPane) {
        paneNav.openDetail(resource, id);
      } else {
        go({ to: { resource, action: "show", id } });
      }
    }
  };
  const isEmptyTable = (filteredDataSource?.length ?? 0) === 0;
  const getRowKeyRef = useRef(getRowKey);
  getRowKeyRef.current = getRowKey;
  const handleBulkRowSelectionChange = useCallback(
    (newKeys, newRowsOnPage) => {
      const currentPageData = isClientFiltering ? filteredDataSource : tableProps.dataSource || [];
      const currentPageKeys = new Set(currentPageData.map((r) => String(getRowKeyRef.current(r))));
      const newKeySet = new Set(newKeys.map((k) => String(k)));
      newRowsOnPage.forEach((row) => {
        bulkSelectedRowsMapRef.current.set(getRowKeyRef.current(row), row);
      });
      currentPageKeys.forEach((k) => {
        if (!newKeySet.has(k)) bulkSelectedRowsMapRef.current.delete(k);
      });
      setBulkSelectedRowKeys([...bulkSelectedRowsMapRef.current.keys()]);
    },
    [isClientFiltering, filteredDataSource, tableProps.dataSource]
  );
  const internalRowSelection = rowSelection ?? {
    selectedRowKeys: bulkSelectedRowKeys,
    onChange: handleBulkRowSelectionChange,
    selections: [
      Table.SELECTION_ALL,
      Table.SELECTION_NONE,
      {
        key: "select-all-filtered",
        text: _32("Select all filtered rows"),
        onSelect: handleSelectAllFiltered
      }
    ]
  };
  const filteredTotalCount = isClientFiltering ? filteredDataSource.length : typeof tableProps.pagination === "object" ? tableProps.pagination?.total ?? filteredDataSource.length : filteredDataSource.length;
  const bulkActionsAvailable = useMemo(() => {
    const opts = [];
    if (canBulkEdit) {
      opts.push({ label: _32("Change field value"), value: "__change_field__" });
    }
    opts.push({ label: _32("Export selected (CSV)"), value: "__export_csv__" });
    if (canBulkEdit) {
      opts.push({ label: _32("Clone / Duplicate selected"), value: "__clone__" });
    }
    if (bulkActions && bulkActions.length > 0) {
      bulkActions.forEach((a) => opts.push({ label: _32(a.label), value: a.key }));
    }
    opts.push({ label: _32("Pin selected"), value: "__pin__" });
    opts.push({ label: _32("Unpin selected"), value: "__unpin__" });
    if (canBulkDelete) {
      opts.push({ label: _32("Delete selected"), value: "__delete__" });
    }
    return opts;
  }, [bulkActions, canBulkDelete, canBulkEdit]);
  const bulkChangeField = bulkChangeFieldKey ? model.fields.find((f) => f.key === bulkChangeFieldKey) ?? null : null;
  const selectModeBanner = selectMode ? /* @__PURE__ */ jsxs("div", { style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    padding: "8px 12px",
    marginBottom: 8,
    borderRadius: 6,
    background: token.colorWarningBg,
    border: `1px solid ${token.colorWarningBorder}`
  }, children: [
    /* @__PURE__ */ jsx("span", { style: { fontWeight: 500, color: token.colorWarningText }, children: bulkSelectedRowKeys.length > 0 ? _32("{count} rows selected").replace("{count}", String(bulkSelectedRowKeys.length)) : _32("Select rows to associate") }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8 }, children: [
      selectModeReturnTo && /* @__PURE__ */ jsx(Button, { size: "small", onClick: () => navigate(selectModeReturnTo), children: _32("Cancel") }),
      /* @__PURE__ */ jsx(
        Button,
        {
          size: "small",
          type: "primary",
          disabled: bulkSelectedRowKeys.length === 0,
          loading: selectModeAssociating,
          onClick: handleAssociateSelected,
          children: _32("Associate selected")
        }
      )
    ] })
  ] }) : null;
  const bulkActionsToolbar = !isGalleryView && !isCalendarView && bulkSelectedRowKeys.length > 0 ? /* @__PURE__ */ jsxs("div", { style: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    marginBottom: 8,
    borderRadius: 6,
    background: token.colorInfoBg,
    border: `1px solid ${token.colorInfoBorder}`
  }, children: [
    /* @__PURE__ */ jsx("span", { style: { fontWeight: 500 }, children: _32("{count} rows selected").replace("{count}", String(bulkSelectedRowKeys.length)) }),
    bulkSelectedRowKeys.length < filteredTotalCount && /* @__PURE__ */ jsx(
      Button,
      {
        type: "link",
        size: "small",
        loading: selectAllFilteredPending && isAllRowsLoading,
        onClick: handleSelectAllFiltered,
        style: { padding: 0 },
        children: _32("Select all {count} filtered rows").replace("{count}", String(filteredTotalCount))
      }
    ),
    /* @__PURE__ */ jsx(Button, { type: "link", size: "small", onClick: clearBulkSelection, style: { padding: 0 }, children: _32("Clear selection") }),
    /* @__PURE__ */ jsx("div", { style: { flex: 1, minWidth: 180 }, children: /* @__PURE__ */ jsx(
      Select,
      {
        mode: "multiple",
        size: "small",
        placeholder: _32("Actions"),
        style: { width: "100%" },
        value: bulkActionsToApply,
        onChange: (values) => {
          setBulkActionsToApply(values);
          if (!values.includes("__change_field__")) {
            setBulkChangeFieldKey(null);
            setBulkChangeFieldValue(null);
          }
        },
        options: bulkActionsAvailable
      }
    ) }),
    bulkActionsToApply.includes("__change_field__") && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        Select,
        {
          size: "small",
          placeholder: _32("Select field"),
          style: { minWidth: 160 },
          value: bulkChangeFieldKey ?? void 0,
          onChange: (v) => {
            setBulkChangeFieldKey(v);
            setBulkChangeFieldValue(null);
          },
          options: model.fields.filter((f) => !["eid", "creation_date", "modification_date"].includes(f.key)).map((f) => ({ label: f.label, value: f.key })),
          allowClear: true
        }
      ),
      bulkChangeField && (bulkChangeField.options ? /* @__PURE__ */ jsx(
        Select,
        {
          size: "small",
          placeholder: _32("Select value"),
          style: { minWidth: 180 },
          value: bulkChangeFieldValue ?? void 0,
          onChange: (v) => setBulkChangeFieldValue(v),
          options: bulkChangeField.options,
          allowClear: true
        }
      ) : bulkChangeField.type === "boolean" ? /* @__PURE__ */ jsx(
        Select,
        {
          size: "small",
          placeholder: _32("Select value"),
          style: { minWidth: 120 },
          value: bulkChangeFieldValue ?? void 0,
          onChange: (v) => setBulkChangeFieldValue(v),
          options: [{ label: _32("True"), value: true }, { label: _32("False"), value: false }],
          allowClear: true
        }
      ) : bulkChangeField.type === "date" ? /* @__PURE__ */ jsx(
        DatePicker,
        {
          size: "small",
          value: bulkChangeFieldValue ? dayjs7(bulkChangeFieldValue) : null,
          onChange: (v) => setBulkChangeFieldValue(v ? v.toISOString() : null)
        }
      ) : bulkChangeField.type === "number" ? /* @__PURE__ */ jsx(
        InputNumber,
        {
          size: "small",
          placeholder: _32("Value"),
          value: bulkChangeFieldValue,
          onChange: (v) => setBulkChangeFieldValue(v),
          style: { minWidth: 120 }
        }
      ) : /* @__PURE__ */ jsx(
        Input,
        {
          size: "small",
          placeholder: _32("Value"),
          value: bulkChangeFieldValue ?? "",
          onChange: (e) => setBulkChangeFieldValue(e.target.value),
          style: { minWidth: 160 }
        }
      ))
    ] }),
    /* @__PURE__ */ jsx(
      Button,
      {
        type: "primary",
        size: "small",
        disabled: bulkActionsToApply.length === 0,
        onClick: () => setBulkActionModalOpen(true),
        children: _32("Apply")
      }
    )
  ] }) : null;
  const bulkConfirmationModal = /* @__PURE__ */ jsxs(
    Modal,
    {
      open: bulkActionModalOpen,
      title: _32("Confirm bulk action"),
      onCancel: () => {
        if (!isBulkExecuting) setBulkActionModalOpen(false);
      },
      footer: [
        /* @__PURE__ */ jsx(Button, { onClick: () => setBulkActionModalOpen(false), disabled: isBulkExecuting, children: _32("Cancel") }, "cancel"),
        /* @__PURE__ */ jsx(Button, { type: "primary", loading: isBulkExecuting, onClick: executeBulkActions, children: _32("Confirm") }, "ok")
      ],
      children: [
        /* @__PURE__ */ jsx("p", { children: _32("You are about to apply the following actions to {count} rows:").replace("{count}", String(bulkSelectedRowKeys.length)) }),
        /* @__PURE__ */ jsx("ul", { style: { paddingLeft: 20, marginBottom: 8 }, children: bulkActionsToApply.map((actionKey) => {
          const label = bulkActionsAvailable.find((a) => a.value === actionKey)?.label ?? actionKey;
          const extra = actionKey === "__change_field__" && bulkChangeField ? ` \u2192 ${bulkChangeField.label}: ${String(bulkChangeFieldValue ?? "")}` : "";
          return /* @__PURE__ */ jsxs("li", { children: [
            label,
            extra
          ] }, actionKey);
        }) })
      ]
    }
  );
  const modelDisplayLabel = asDisplayText(model.label, asDisplayText(model.name, "Record"));
  const listTitle = !isEmbedded ? renderModelHeading({
    model,
    title: modelDisplayLabel,
    actionLabel: _32("List"),
    moduleLabel: model.module ? getModuleLabel(model.module) : void 0
  }) : void 0;
  const numericBarColor = modelTone.soft || token.colorPrimaryBg || "rgba(22, 119, 255, 0.16)";
  const viewSelector = /* @__PURE__ */ jsx(
    Select,
    {
      size: "small",
      value: currentViewName,
      onChange: handleChangeViewName,
      loading: isLoadingViewNames,
      options: availableViewNames.map((name) => ({ label: name, value: name })),
      style: { minWidth: 180 }
    }
  );
  const viewTabsNode = selectedViewNames.length > 1 && !isTotalsDetailsView ? /* @__PURE__ */ jsx(
    Tabs,
    {
      size: "small",
      activeKey: currentViewName,
      onChange: handleChangeViewName,
      items: selectedViewNames.map((name) => ({ key: name, label: renderToneTabLabel(name, modelTone) }))
    }
  ) : null;
  const listToggleButton = /* @__PURE__ */ jsx(Tooltip, { title: _32("View list"), children: /* @__PURE__ */ jsx(
    Button,
    {
      size: "small",
      icon: /* @__PURE__ */ jsx(UnorderedListOutlined, {}),
      onClick: () => {
        markLayoutPrefsTouched();
        setListVisible((prev) => !prev);
      }
    }
  ) });
  const exportButton = !isEmbedded ? /* @__PURE__ */ jsx(Tooltip, { title: _32("Export CSV"), children: /* @__PURE__ */ jsx(
    Button,
    {
      size: "small",
      icon: /* @__PURE__ */ jsx(DownloadOutlined, {}),
      onClick: () => setExportRequested(true),
      loading: exportRequested && isAllRowsLoading
    }
  ) }) : null;
  const columnsToggleButton = /* @__PURE__ */ jsx(Tooltip, { title: columnsSelectorOpen ? _32("Hide view configuration") : _32("Show view configuration"), children: /* @__PURE__ */ jsx(
    Button,
    {
      size: "small",
      icon: /* @__PURE__ */ jsx(SettingOutlined, {}),
      onClick: () => {
        setColumnsSelectorOpen((prev) => {
          const next = !prev;
          if (next) syncColumnsSelectionToDisplay();
          return next;
        });
      },
      "aria-label": columnsSelectorOpen ? _32("Hide view configuration") : _32("Show view configuration")
    }
  ) });
  const createRelationButton = isRelationView && showCreate ? /* @__PURE__ */ jsx(Tooltip, { title: _32("Add relation"), children: /* @__PURE__ */ jsx(
    Button,
    {
      size: "small",
      icon: /* @__PURE__ */ jsx(PlusOutlined, {}),
      onClick: (e) => {
        e.preventDefault();
        const params = new URLSearchParams();
        if (filter) params.append(filter.field, String(filter.value));
        const returnTo = `${location.pathname}${location.search}${location.hash}`;
        if (returnTo.startsWith("/")) params.append("returnTo", returnTo);
        const resourcePath = resolveResourcePath(model.resource || model.name, allModels);
        navigate(`/${resourcePath}/create?${params.toString()}`);
      }
    }
  ) }) : null;
  const associateExistingFkButton = isRelationView && showCreate && filter?.field && filter?.value !== void 0 && filter?.value !== null && !relationConfig?.otherKey ? /* @__PURE__ */ jsx(Tooltip, { title: _32("Associate existing"), children: /* @__PURE__ */ jsx(
    Button,
    {
      size: "small",
      icon: /* @__PURE__ */ jsx(LinkOutlined, {}),
      onClick: (e) => {
        e.preventDefault();
        const resourcePath = resolveResourcePath(model.resource || model.name, allModels);
        const params = new URLSearchParams();
        params.append("select_mode", "1");
        params.append("select_mode_fk", "1");
        params.append("relate_resource", resourcePath);
        params.append("relate_target_key", String(filter.field));
        params.append("relate_target_id", String(filter.value));
        const returnTo = `${location.pathname}${location.search}${location.hash}`;
        if (returnTo.startsWith("/")) params.append("returnTo", returnTo);
        navigate(`/${resourcePath}?${params.toString()}`);
      }
    }
  ) }) : null;
  const createNewAndRelateButton = isRelationView && showCreate && relationConfig?.otherResource && relationConfig?.otherKey && (relationConfig?.targetKey || filter?.field) && filter?.value !== void 0 && filter?.value !== null ? /* @__PURE__ */ jsx(Tooltip, { title: _32("Create new and relate"), children: /* @__PURE__ */ jsx(
    Button,
    {
      size: "small",
      icon: /* @__PURE__ */ jsx(ShareAltOutlined, {}),
      onClick: (e) => {
        e.preventDefault();
        const otherKey = relationConfig?.otherKey;
        const targetKey = relationConfig?.targetKey || filter?.field;
        const targetId = filter?.value;
        if (!otherKey || !targetKey || targetId === void 0 || targetId === null) return;
        const params = new URLSearchParams();
        const relationResource = relationConfig?.resourcePath || resolveResourcePath(relationConfig?.resource || model.name, allModels);
        const relatedModel = findModelByName(allModels, relationConfig?.otherResource || relationConfig?.otherResourcePath);
        const relatedResource = relatedModel ? resolveResourcePath(relatedModel.resource || relatedModel.name, allModels) : null;
        if (!relatedResource) {
          message.warning(_32("No create route for the related model. Opening relation create form."));
          params.append(targetKey, String(targetId));
          const returnTo2 = `${location.pathname}${location.search}${location.hash}`;
          if (returnTo2.startsWith("/")) params.append("returnTo", returnTo2);
          navigate(`/${relationResource}/create?${params.toString()}`);
          return;
        }
        params.append("relate_resource", relationResource);
        params.append("relate_target_key", targetKey);
        params.append("relate_other_key", otherKey);
        params.append("relate_target_id", String(targetId));
        const returnTo = `${location.pathname}${location.search}${location.hash}`;
        if (returnTo.startsWith("/")) params.append("returnTo", returnTo);
        navigate(`/${relatedResource}/create?${params.toString()}`);
      }
    }
  ) }) : null;
  const embeddedActionBar = isEmbedded ? /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginBottom: 8 }, children: [
    columnsToggleButton,
    listToggleButton,
    /* @__PURE__ */ jsx(Tooltip, { title: _32("Analyze"), children: /* @__PURE__ */ jsx(
      Button,
      {
        size: "small",
        icon: /* @__PURE__ */ jsx(BarChartOutlined, {}),
        onClick: () => {
          markLayoutPrefsTouched();
          analyzeTouchedRef.current = true;
          setIsStatsFlipped(false);
          setAnalyzeOpen((prev) => !prev);
        }
      }
    ) }),
    /* @__PURE__ */ jsx(Tooltip, { title: _32("Switch orientation"), children: /* @__PURE__ */ jsx(
      Button,
      {
        size: "small",
        icon: /* @__PURE__ */ jsx(ColumnHeightOutlined, {}),
        onClick: () => {
          markLayoutPrefsTouched();
          setIsAnalyzeVertical((prev) => !prev);
        }
      }
    ) }),
    /* @__PURE__ */ jsx(Tooltip, { title: _32("Switch positions"), children: /* @__PURE__ */ jsx(
      Button,
      {
        size: "small",
        icon: /* @__PURE__ */ jsx(SwapOutlined, {}),
        onClick: () => {
          markLayoutPrefsTouched();
          setIsAnalyzeFirst((prev) => !prev);
        }
      }
    ) }),
    resolvedLayoutPreferenceType && /* @__PURE__ */ jsx(Tooltip, { title: _32("Save layout"), children: /* @__PURE__ */ jsx(
      Button,
      {
        size: "small",
        icon: /* @__PURE__ */ jsx(SaveOutlined, {}),
        onClick: () => openSaveViewModalFor("layout"),
        loading: isSavingLayoutPrefs
      }
    ) }),
    associateExistingFkButton,
    createRelationButton,
    createNewAndRelateButton,
    /* @__PURE__ */ jsx(Tooltip, { title: _32("Export CSV"), children: /* @__PURE__ */ jsx(
      Button,
      {
        size: "small",
        icon: /* @__PURE__ */ jsx(DownloadOutlined, {}),
        onClick: () => setExportRequested(true),
        loading: exportRequested && isAllRowsLoading
      }
    ) })
  ] }) : null;
  const listAnalyzeLayoutStyle = {
    display: "flex",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "nowrap",
    flexDirection: isAnalyzeVertical ? "column" : "row"
  };
  const listContainerStyle = {
    flex: isAnalyzeVertical ? "1 1 auto" : "2 1 520px",
    minWidth: isAnalyzeVertical ? 0 : 360,
    width: isAnalyzeVertical ? "100%" : void 0,
    overflow: "auto",
    order: isAnalyzeFirst ? 2 : 1
  };
  const analyzeContainerStyle = {
    flex: isAnalyzeVertical ? "1 1 auto" : listVisible ? "1 1 420px" : "1 1 520px",
    minWidth: isAnalyzeVertical ? 0 : 360,
    width: isAnalyzeVertical ? "100%" : void 0,
    overflow: "visible",
    order: isAnalyzeFirst ? 1 : 2
  };
  const renderGalleryItem = (record) => {
    const { resource, id } = getTargetInfo(record);
    const fileId = getGalleryItemId(record, id);
    const label = getGalleryItemLabel(record, fileId);
    const handleClick = () => {
      if (resource && id !== void 0 && id !== null) {
        if (paneNav?.isInMultiPane) {
          paneNav.openDetail(resource, id);
        } else {
          go({ to: { resource, action: "show", id } });
        }
      }
    };
    return renderSharedGalleryCard({
      item: record,
      itemId: fileId,
      label,
      apiUrl,
      imageWidth: galleryImageWidth,
      imageHeight: galleryImageHeight,
      borderColor: token.colorBorder,
      textColor: token.colorText,
      onClick: resource && id !== void 0 && id !== null ? handleClick : void 0
    });
  };
  const galleryPageSize = typeof tablePagination === "object" && tablePagination?.pageSize ? tablePagination.pageSize : 10;
  const handleGalleryPageChange = useCallback((page, nextPageSize) => {
    setGalleryPage(page);
    if (nextPageSize && nextPageSize !== pageSize) {
      setPageSize(nextPageSize);
    }
    if (!isClientFiltering) {
      if (typeof tableProps.onChange === "function") {
        tableProps.onChange({ current: page, pageSize: nextPageSize ?? pageSize }, {}, {}, {});
        return;
      }
      const pagination = tableProps.pagination;
      if (typeof pagination === "object" && typeof pagination.onChange === "function") {
        pagination.onChange(page, nextPageSize ?? pageSize);
      }
    }
  }, [isClientFiltering, pageSize, tableProps]);
  const serverCurrentPage = !isClientFiltering && typeof tableProps.pagination === "object" ? Number(tableProps.pagination.current || 1) : 1;
  const serverTotal = !isClientFiltering && typeof tableProps.pagination === "object" ? Number(tableProps.pagination.total || 0) : 0;
  useEffect(() => {
    if (isClientFiltering) return;
    if (Number.isFinite(serverCurrentPage) && serverCurrentPage > 0 && serverCurrentPage !== galleryPage) {
      setGalleryPage(serverCurrentPage);
    }
  }, [galleryPage, isClientFiltering, serverCurrentPage]);
  const galleryRows = useMemo(() => {
    if (!isGalleryView) return [];
    if (!isClientFiltering) return filteredDataSource;
    const start = (galleryPage - 1) * galleryPageSize;
    return filteredDataSource.slice(start, start + galleryPageSize);
  }, [filteredDataSource, galleryPage, galleryPageSize, isClientFiltering, isGalleryView]);
  const galleryPaginationProps = useMemo(() => {
    if (!isGalleryView) return void 0;
    if (!isClientFiltering) {
      return {
        current: galleryPage,
        pageSize: galleryPageSize,
        total: Number.isFinite(serverTotal) ? serverTotal : void 0,
        hideOnSinglePage: typeof tablePagination === "object" ? tablePagination.hideOnSinglePage : true,
        showSizeChanger: true,
        pageSizeOptions: ["10", "20", "50", "100"],
        onChange: handleGalleryPageChange,
        onShowSizeChange: handleGalleryPageChange
      };
    }
    return {
      current: galleryPage,
      pageSize: galleryPageSize,
      total: filteredDataSource.length,
      hideOnSinglePage: true,
      showSizeChanger: true,
      pageSizeOptions: ["10", "20", "50", "100"],
      onChange: handleGalleryPageChange,
      onShowSizeChange: handleGalleryPageChange
    };
  }, [filteredDataSource.length, galleryPage, galleryPageSize, handleGalleryPageChange, isClientFiltering, isGalleryView, serverTotal, tablePagination]);
  const calendarDateFieldKeySet = useMemo(
    () => new Set(calendarDateFieldOptions.map((field) => field.key)),
    [calendarDateFieldOptions]
  );
  useEffect(() => {
    if (!isCalendarView) return;
    if (calendarDateField && calendarDateFieldKeySet.has(calendarDateField)) return;
    const fallback = calendarDateFieldOptions[0]?.key || "";
    if (fallback !== calendarDateField) setCalendarDateField(fallback);
  }, [calendarDateField, calendarDateFieldKeySet, calendarDateFieldOptions, isCalendarView]);
  const calendarEntries = useMemo(() => {
    if (!isCalendarView || !calendarDateField) return [];
    const entries = [];
    filteredDataSource.forEach((record) => {
      const recordDate = getCalendarRecordDate(record, calendarDateField);
      if (!recordDate) return;
      const { resource, id } = getTargetInfo(record);
      entries.push({
        key: getRowKey(record),
        record,
        date: recordDate,
        resource,
        id,
        label: getRecordDisplayLabel(record)
      });
    });
    return entries;
  }, [calendarDateField, filteredDataSource, isCalendarView]);
  const calendarEarliestDateTs = useMemo(() => {
    if (calendarEntries.length === 0) return null;
    let earliest = calendarEntries[0].date.valueOf();
    for (let index = 1; index < calendarEntries.length; index += 1) {
      const value = calendarEntries[index].date.valueOf();
      if (value < earliest) earliest = value;
    }
    return earliest;
  }, [calendarEntries]);
  const calendarInitSignatureRef = useRef("");
  useEffect(() => {
    if (!isCalendarView) return;
    const signature = `${calendarDateField}|${calendarMode}|${calendarEarliestDateTs ?? "none"}`;
    if (calendarInitSignatureRef.current === signature) return;
    calendarInitSignatureRef.current = signature;
    if (calendarEarliestDateTs === null) {
      setCalendarAnchorDate(dayjs7().startOf(calendarMode));
      return;
    }
    setCalendarAnchorDate(dayjs7(calendarEarliestDateTs).startOf(calendarMode));
  }, [calendarDateField, calendarEarliestDateTs, calendarMode, isCalendarView]);
  const calendarEntriesByDate = useMemo(() => {
    const grouped = /* @__PURE__ */ new Map();
    calendarEntries.forEach((entry) => {
      const key = entry.date.format("YYYY-MM-DD");
      const existing = grouped.get(key) || [];
      existing.push(entry);
      grouped.set(key, existing);
    });
    return grouped;
  }, [calendarEntries]);
  const calendarRangeDays = useMemo(() => {
    const current = calendarAnchorDate.startOf(calendarMode);
    if (calendarMode === "week") {
      const start2 = current.startOf("week");
      return Array.from({ length: 7 }, (_unused, offset) => start2.add(offset, "day"));
    }
    const start = current.startOf("month").startOf("week");
    const end = current.endOf("month").endOf("week");
    const totalDays = end.diff(start, "day") + 1;
    return Array.from({ length: totalDays }, (_unused, offset) => start.add(offset, "day"));
  }, [calendarAnchorDate, calendarMode]);
  const calendarPeriodLabel = useMemo(() => {
    if (calendarMode === "week") {
      const weekStart = calendarAnchorDate.startOf("week");
      const weekEnd = weekStart.endOf("week");
      return `${weekStart.format("MMM D, YYYY")} - ${weekEnd.format("MMM D, YYYY")}`;
    }
    return calendarAnchorDate.startOf("month").format("MMMM YYYY");
  }, [calendarAnchorDate, calendarMode]);
  const renderCalendarItem = (entry, index) => {
    if (!entry.resource || entry.id === void 0 || entry.id === null) {
      return /* @__PURE__ */ jsx("div", { style: { fontSize: 12, lineHeight: 1.3 }, children: entry.label }, `${entry.key}-${index}`);
    }
    return /* @__PURE__ */ jsx(
      "a",
      {
        href: getShowHref(entry.resource, entry.id, allModels),
        style: { display: "block", fontSize: 12, lineHeight: 1.3, color: token.colorLink, textDecoration: "none", wordWrap: "break-word", overflowWrap: "break-word" },
        title: entry.label,
        children: entry.label
      },
      `${entry.key}-${index}`
    );
  };
  const renderCalendarView = () => {
    if (calendarDateFieldOptions.length === 0) {
      return /* @__PURE__ */ jsx(Empty, { description: _32("No date/datetime fields available for calendar view.") });
    }
    const selectedDateField = model.fields.find((field) => field.key === calendarDateField);
    const selectedLabel = selectedDateField?.label || calendarDateField;
    return /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 12 }, children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }, children: [
        /* @__PURE__ */ jsxs(Space, { wrap: true, size: 8, children: [
          /* @__PURE__ */ jsx(
            Select,
            {
              size: "small",
              value: calendarMode,
              onChange: (value) => setCalendarMode(value),
              options: [
                { label: _32("Monthly"), value: "month" },
                { label: _32("Weekly"), value: "week" }
              ],
              style: { minWidth: 120 }
            }
          ),
          /* @__PURE__ */ jsx(
            Select,
            {
              size: "small",
              value: calendarDateField,
              onChange: (value) => setCalendarDateField(value),
              options: calendarDateFieldOptions.map((field) => ({ label: field.label, value: field.key })),
              style: { minWidth: 220 },
              placeholder: _32("Date field")
            }
          )
        ] }),
        /* @__PURE__ */ jsxs(Space, { size: 8, children: [
          /* @__PURE__ */ jsx(Tooltip, { title: _32("Previous"), children: /* @__PURE__ */ jsx(
            Button,
            {
              size: "small",
              icon: /* @__PURE__ */ jsx(ArrowLeftOutlined, {}),
              "aria-label": _32("Previous"),
              onClick: () => setCalendarAnchorDate((prev) => prev.subtract(1, calendarMode).startOf(calendarMode))
            }
          ) }),
          /* @__PURE__ */ jsx(Tooltip, { title: _32("Today"), children: /* @__PURE__ */ jsx(
            Button,
            {
              size: "small",
              icon: /* @__PURE__ */ jsx(CalendarOutlined, {}),
              "aria-label": _32("Today"),
              onClick: () => setCalendarAnchorDate(dayjs7().startOf(calendarMode))
            }
          ) }),
          /* @__PURE__ */ jsx(Tooltip, { title: _32("Next"), children: /* @__PURE__ */ jsx(
            Button,
            {
              size: "small",
              icon: /* @__PURE__ */ jsx(ArrowRightOutlined, {}),
              "aria-label": _32("Next"),
              onClick: () => setCalendarAnchorDate((prev) => prev.add(1, calendarMode).startOf(calendarMode))
            }
          ) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { fontSize: 14, fontWeight: 600, color: token.colorText }, children: [
        calendarPeriodLabel,
        " ",
        selectedLabel ? `- ${selectedLabel}` : ""
      ] }),
      /* @__PURE__ */ jsxs(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 8,
            overflow: "hidden"
          },
          children: [
            CALENDAR_WEEKDAYS.map((label) => /* @__PURE__ */ jsx(
              "div",
              {
                style: {
                  padding: "6px 8px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: token.colorTextSecondary,
                  background: token.colorFillAlter,
                  borderBottom: `1px solid ${token.colorBorderSecondary}`
                },
                children: label
              },
              label
            )),
            calendarRangeDays.map((day) => {
              const dayKey = day.format("YYYY-MM-DD");
              const entries = calendarEntriesByDate.get(dayKey) || [];
              const isOutsideCurrentMonth = calendarMode === "month" && day.month() !== calendarAnchorDate.month();
              const isToday = day.isSame(dayjs7(), "day");
              return /* @__PURE__ */ jsxs(
                "div",
                {
                  style: {
                    minHeight: 120,
                    padding: 8,
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                    borderRight: day.day() === 6 ? "none" : `1px solid ${token.colorBorderSecondary}`,
                    background: isOutsideCurrentMonth ? token.colorFillAlter : token.colorBgContainer,
                    opacity: isOutsideCurrentMonth ? 0.75 : 1,
                    display: "grid",
                    alignContent: "start",
                    gap: 4
                  },
                  children: [
                    /* @__PURE__ */ jsx(
                      "div",
                      {
                        style: {
                          fontSize: 12,
                          fontWeight: isToday ? 700 : 600,
                          color: isToday ? token.colorPrimary : token.colorTextSecondary
                        },
                        children: day.format("D")
                      }
                    ),
                    /* @__PURE__ */ jsx("div", { style: { display: "grid", gap: 2 }, children: entries.map((entry, index) => renderCalendarItem(entry, index)) })
                  ]
                },
                dayKey
              );
            })
          ]
        }
      )
    ] });
  };
  const listContent = /* @__PURE__ */ jsxs(Fragment, { children: [
    embeddedActionBar,
    /* @__PURE__ */ jsx(
      Modal,
      {
        open: saveViewModalOpen,
        title: _32("Save view"),
        onCancel: () => {
          setSaveViewModalOpen(false);
          setPendingSaveTarget(null);
        },
        onOk: handleConfirmSaveView,
        okText: pendingSaveTarget === "layout" ? _32("Save layout") : _32("Save analyze"),
        okButtonProps: { disabled: !pendingSaveTarget },
        children: /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 12 }, children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }, children: _32("View name") }),
            /* @__PURE__ */ jsx(Input, { value: saveViewName, onChange: (event) => setSaveViewName(event.target.value) })
          ] }),
          /* @__PURE__ */ jsx(Checkbox, { checked: saveViewAsNew, onChange: (event) => setSaveViewAsNew(event.target.checked), children: _32("Save as new view") })
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      Modal,
      {
        open: renameViewModalOpen,
        title: _32("Rename view"),
        onCancel: () => setRenameViewModalOpen(false),
        onOk: handleRenameView,
        okText: _32("Rename"),
        children: /* @__PURE__ */ jsx(Input, { value: renameViewName, onChange: (event) => setRenameViewName(event.target.value) })
      }
    ),
    viewTabsNode,
    layoutPrefsReady && !filtersCollapsed && /* @__PURE__ */ jsx(
      Card,
      {
        size: "small",
        title: /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }, children: [
          /* @__PURE__ */ jsx("span", { style: { color: token.colorTextSecondary, fontSize: 12, fontWeight: 600 }, children: _32("Filters") }),
          /* @__PURE__ */ jsx("div", { style: { display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end" }, children: !filtersCollapsed && searchField && /* @__PURE__ */ jsx(
            Form,
            {
              ...searchFormProps,
              layout: "inline",
              style: { flex: 1, minWidth: 240 },
              onFinish: (values) => {
                if (isClientFiltering) {
                  setLocalSearch(values?.q ?? "");
                  return;
                }
                searchFormProps.onFinish?.(values);
              },
              children: /* @__PURE__ */ jsx(Form.Item, { name: "q", style: { marginBottom: 0, width: "100%" }, children: /* @__PURE__ */ jsx(Input, { placeholder: _32("Search all fields..."), prefix: /* @__PURE__ */ jsx(SearchOutlined, {}), allowClear: true, style: { width: "100%" } }) })
            }
          ) })
        ] }),
        style: { marginBottom: 16 },
        styles: { body: { display: "grid", gap: 12 } },
        children: /* @__PURE__ */ jsx(Fragment, {})
      }
    ),
    columnsSelectorOpen && /* @__PURE__ */ jsxs(
      Card,
      {
        size: "small",
        title: /* @__PURE__ */ jsx("span", { style: { color: token.colorTextSecondary, fontSize: 12, fontWeight: 600 }, children: _32("View configuration") }),
        style: { marginBottom: 16 },
        styles: { body: { display: "grid", gap: 12 } },
        children: [
          /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 12 }, children: [
            /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 8 }, children: [
              /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, fontWeight: 600 }, children: _32("Advanced filters") }),
              filterRules.length === 0 ? /* @__PURE__ */ jsx("div", { style: { color: token.colorTextSecondary, fontSize: 12 }, children: _32("No filters yet.") }) : filterRules.map((rule) => {
                const field = model.fields.find((f) => f.key === rule.fieldKey);
                const type = field?.type || "string";
                const operatorOptions = type === "number" ? [
                  { label: _32("="), value: "eq" },
                  { label: _32(">"), value: "gt" },
                  { label: _32(">="), value: "gte" },
                  { label: _32("<"), value: "lt" },
                  { label: _32("<="), value: "lte" },
                  { label: _32("Between"), value: "between" }
                ] : type === "date" ? [
                  { label: _32("On"), value: "on" },
                  { label: _32("After"), value: "after" },
                  { label: _32("Before"), value: "before" },
                  { label: _32("Between"), value: "between" }
                ] : type === "boolean" ? [{ label: _32("Is"), value: "is" }] : [
                  { label: _32("Contains"), value: "contains" },
                  { label: _32("Equals"), value: "equals" }
                ];
                const renderDateInput = (value, onChange) => {
                  const mode = value?.mode || "absolute";
                  if (mode === "relative") {
                    return /* @__PURE__ */ jsxs(Space, { wrap: true, children: [
                      /* @__PURE__ */ jsx(InputNumber, { min: 1, value: value?.count ?? 1, onChange: (val) => onChange({ ...value, mode: "relative", count: val ?? 1 }) }),
                      /* @__PURE__ */ jsx(
                        Select,
                        {
                          value: value?.direction || "next",
                          onChange: (val) => onChange({ ...value, mode: "relative", direction: val }),
                          options: [
                            { label: _32("Previous"), value: "previous" },
                            { label: _32("Current"), value: "current" },
                            { label: _32("Next"), value: "next" }
                          ]
                        }
                      ),
                      /* @__PURE__ */ jsx(
                        Select,
                        {
                          value: value?.unit || "weeks",
                          onChange: (val) => onChange({ ...value, mode: "relative", unit: val }),
                          options: [
                            { label: _32("Days"), value: "days" },
                            { label: _32("Weeks"), value: "weeks" },
                            { label: _32("Months"), value: "months" },
                            { label: _32("Quarters"), value: "quarters" },
                            { label: _32("Years"), value: "years" }
                          ]
                        }
                      )
                    ] });
                  }
                  return /* @__PURE__ */ jsx(
                    DatePicker,
                    {
                      value: value?.date ? dayjs7(value.date) : void 0,
                      onChange: (val) => onChange({ mode: "absolute", date: val ? val.toISOString() : null })
                    }
                  );
                };
                return /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }, children: [
                  /* @__PURE__ */ jsx(
                    Select,
                    {
                      style: { minWidth: 180 },
                      value: rule.fieldKey,
                      onChange: (value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, fieldKey: value, operator: void 0, value: void 0, value2: void 0 } : item)),
                      options: model.fields.map((f) => ({ label: f.label, value: f.key })),
                      placeholder: _32("Field")
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    Select,
                    {
                      style: { minWidth: 140 },
                      value: rule.operator,
                      onChange: (value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, operator: value } : item)),
                      options: operatorOptions,
                      placeholder: _32("Operator")
                    }
                  ),
                  type === "number" && rule.operator === "between" && /* @__PURE__ */ jsxs(Fragment, { children: [
                    /* @__PURE__ */ jsx(
                      InputNumber,
                      {
                        value: rule.value,
                        onChange: (value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value } : item))
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      InputNumber,
                      {
                        value: rule.value2,
                        onChange: (value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value2: value } : item))
                      }
                    )
                  ] }),
                  type === "number" && rule.operator !== "between" && /* @__PURE__ */ jsx(
                    InputNumber,
                    {
                      value: rule.value,
                      onChange: (value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value } : item))
                    }
                  ),
                  type === "boolean" && /* @__PURE__ */ jsx(
                    Select,
                    {
                      style: { minWidth: 120 },
                      value: rule.value,
                      onChange: (value) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value } : item)),
                      options: [
                        { label: _32("True"), value: true },
                        { label: _32("False"), value: false }
                      ],
                      placeholder: _32("Value")
                    }
                  ),
                  type === "date" && rule.operator === "between" && /* @__PURE__ */ jsxs(Fragment, { children: [
                    renderDateInput(rule.value, (val) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value: val } : item))),
                    renderDateInput(rule.value2, (val) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value2: val } : item)))
                  ] }),
                  type === "date" && rule.operator !== "between" && renderDateInput(rule.value, (val) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value: val } : item))),
                  type === "string" && /* @__PURE__ */ jsx(
                    Input,
                    {
                      value: rule.value,
                      onChange: (event) => setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value: event.target.value } : item)),
                      placeholder: _32("Value"),
                      style: { minWidth: 200 }
                    }
                  ),
                  type === "date" && /* @__PURE__ */ jsx(
                    Select,
                    {
                      size: "small",
                      value: rule.value?.mode || "absolute",
                      onChange: (val) => {
                        setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value: { ...item.value || {}, mode: val } } : item));
                      },
                      options: [
                        { label: _32("Date"), value: "absolute" },
                        { label: _32("Relative"), value: "relative" }
                      ]
                    }
                  ),
                  type === "date" && rule.operator === "between" && /* @__PURE__ */ jsx(
                    Select,
                    {
                      size: "small",
                      value: rule.value2?.mode || "absolute",
                      onChange: (val) => {
                        setFilterRules((prev) => prev.map((item) => item.id === rule.id ? { ...item, value2: { ...item.value2 || {}, mode: val } } : item));
                      },
                      options: [
                        { label: _32("Date"), value: "absolute" },
                        { label: _32("Relative"), value: "relative" }
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    Button,
                    {
                      size: "small",
                      danger: true,
                      onClick: () => setFilterRules((prev) => prev.filter((item) => item.id !== rule.id)),
                      children: _32("Remove")
                    }
                  )
                ] }, rule.id);
              }),
              /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8 }, children: [
                /* @__PURE__ */ jsx(
                  Button,
                  {
                    size: "small",
                    icon: /* @__PURE__ */ jsx(FilterOutlined, {}),
                    onClick: () => setFilterRules((prev) => [...prev, { id: `${Date.now()}-${Math.random()}` }]),
                    children: _32("Add Filter")
                  }
                ),
                filterRules.length > 0 && /* @__PURE__ */ jsx(Button, { size: "small", onClick: () => setFilterRules([]), children: _32("Clear filters") })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 6 }, children: [
              /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, fontWeight: 600 }, children: _32("Views shown") }),
              /* @__PURE__ */ jsx(
                Select,
                {
                  mode: "multiple",
                  size: "small",
                  value: selectedViewNames,
                  onChange: (values) => {
                    const next = [
                      ...selectedViewNames.filter((name) => values.includes(name)),
                      ...values.filter((name) => !selectedViewNames.includes(name))
                    ];
                    updateSelectedViewNames(next);
                  },
                  loading: isLoadingViewNames,
                  options: availableViewNames.map((name) => ({ label: name, value: name })),
                  style: { minWidth: 240 }
                }
              ),
              selectedViewNames.length > 1 && /* @__PURE__ */ jsx("div", { style: { display: "grid", gap: 6 }, children: selectedViewNames.map((name, index) => /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                /* @__PURE__ */ jsx("div", { style: { flex: 1 }, children: name }),
                /* @__PURE__ */ jsx(Tooltip, { title: _32("Move up"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(ArrowUpOutlined, {}), disabled: index === 0, onClick: () => moveSelectedView(name, "up") }) }),
                /* @__PURE__ */ jsx(Tooltip, { title: _32("Move down"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(ArrowDownOutlined, {}), disabled: index === selectedViewNames.length - 1, onClick: () => moveSelectedView(name, "down") }) })
              ] }, name)) })
            ] }),
            /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 6 }, children: [
              /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, fontWeight: 600 }, children: _32("Active view") }),
              viewSelector
            ] }),
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }, children: [
              /* @__PURE__ */ jsx(
                Button,
                {
                  size: "small",
                  onClick: () => {
                    setRenameViewName(currentViewName);
                    setRenameViewModalOpen(true);
                  },
                  children: _32("Rename view")
                }
              ),
              /* @__PURE__ */ jsx(
                Button,
                {
                  size: "small",
                  danger: true,
                  icon: /* @__PURE__ */ jsx(DeleteOutlined, {}),
                  disabled: availableViewNames.length <= 1,
                  onClick: confirmDeleteView,
                  children: _32("Delete view")
                }
              ),
              resolvedLayoutPreferenceType && /* @__PURE__ */ jsx(
                Button,
                {
                  size: "small",
                  icon: /* @__PURE__ */ jsx(SaveOutlined, {}),
                  onClick: () => openSaveViewModalFor("layout"),
                  loading: isSavingLayoutPrefs,
                  children: _32("Save layout")
                }
              ),
              /* @__PURE__ */ jsx(
                Button,
                {
                  size: "small",
                  icon: /* @__PURE__ */ jsx(FilterOutlined, {}),
                  onClick: () => {
                    markLayoutPrefsTouched();
                    setFiltersCollapsed((prev) => !prev);
                  },
                  children: filtersCollapsed ? _32("Show Filters") : _32("Hide Filters")
                }
              ),
              /* @__PURE__ */ jsx(
                Button,
                {
                  size: "small",
                  icon: /* @__PURE__ */ jsx(BarChartOutlined, {}),
                  onClick: () => {
                    markLayoutPrefsTouched();
                    analyzeTouchedRef.current = true;
                    setIsStatsFlipped(false);
                    setAnalyzeOpen((prev) => !prev);
                  },
                  children: _32("Analyze")
                }
              ),
              /* @__PURE__ */ jsx(
                Button,
                {
                  size: "small",
                  icon: /* @__PURE__ */ jsx(ColumnHeightOutlined, {}),
                  onClick: () => {
                    markLayoutPrefsTouched();
                    setIsAnalyzeVertical((prev) => !prev);
                  },
                  children: _32("Switch orientation")
                }
              ),
              /* @__PURE__ */ jsx(
                Button,
                {
                  size: "small",
                  icon: /* @__PURE__ */ jsx(SwapOutlined, {}),
                  onClick: () => {
                    markLayoutPrefsTouched();
                    setIsAnalyzeFirst((prev) => !prev);
                  },
                  children: _32("Switch positions")
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 12 }, children: [
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }, children: [
              /* @__PURE__ */ jsx("span", { style: { color: token.colorTextSecondary, fontSize: 12, fontWeight: 600 }, children: _32("Columns") }),
              selectedColumnKeys && selectedColumnKeys.length > 0 && /* @__PURE__ */ jsx(Button, { size: "small", onClick: () => {
                setSelectedColumnKeys(null);
                setColumnOrder(null);
              }, children: _32("Reset to default") })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 6 }, children: _32("Select columns") }),
              /* @__PURE__ */ jsx(
                Checkbox.Group,
                {
                  value: selectedColumnKeys || [],
                  onChange: (values) => handleColumnSelectionChange(values),
                  options: allFieldOptions
                }
              ),
              (!selectedColumnKeys || selectedColumnKeys.length === 0) && /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginTop: 6 }, children: "Using default columns. Select fields to customize." })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 6 }, children: _32("Column order") }),
              orderedSelectedColumns.length === 0 ? /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary }, children: _32("No custom order yet.") }) : orderedSelectedColumns.map((key, index) => {
                const field = model.fields.find((item) => item.key === key);
                if (!field) return null;
                return /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }, children: [
                  /* @__PURE__ */ jsx("div", { style: { flex: 1 }, children: field.label }),
                  /* @__PURE__ */ jsx(Tooltip, { title: _32("Move left"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(ArrowLeftOutlined, {}), disabled: index === 0, onClick: () => moveColumnOrder(key, "left") }) }),
                  /* @__PURE__ */ jsx(Tooltip, { title: _32("Move right"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(ArrowRightOutlined, {}), disabled: index === orderedSelectedColumns.length - 1, onClick: () => moveColumnOrder(key, "right") }) })
                ] }, key);
              })
            ] }),
            isTotalsDetailsView && /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 6 }, children: _32("Totals summary function") }),
              /* @__PURE__ */ jsx("div", { style: { display: "grid", gap: 6 }, children: totalsSummaryConfigFields.length === 0 ? /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary }, children: _32("No numeric fields available.") }) : totalsSummaryConfigFields.map((field) => {
                const options = [
                  { label: _32("Sum"), value: "sum" },
                  { label: _32("Average"), value: "avg" },
                  { label: _32("Count"), value: "count" },
                  { label: _32("Max"), value: "max" },
                  { label: _32("Min"), value: "min" },
                  { label: _32("Std Dev"), value: "stddev" }
                ];
                return /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                  /* @__PURE__ */ jsx("div", { style: { flex: 1 }, children: field.label }),
                  /* @__PURE__ */ jsx(
                    Select,
                    {
                      size: "small",
                      style: { minWidth: 150 },
                      value: resolveTotalsSummaryFn(field),
                      options,
                      onChange: (value) => {
                        markLayoutPrefsTouched();
                        setTotalsSummaryFunctions((prev) => ({ ...prev, [field.key]: value }));
                      }
                    }
                  )
                ] }, `summary-${field.key}`);
              }) })
            ] })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsxs("div", { style: listAnalyzeLayoutStyle, children: [
      listVisible && /* @__PURE__ */ jsx("div", { style: listContainerStyle, children: isCalendarView ? renderCalendarView() : isGalleryView ? /* @__PURE__ */ jsxs(Fragment, { children: [
        galleryRows.length === 0 ? /* @__PURE__ */ jsxs("div", { style: { display: "inline-flex", alignItems: "center", gap: 6, color: "#bfbfbf", fontSize: 12 }, children: [
          /* @__PURE__ */ jsx(FileTextOutlined, { style: { fontSize: 16 } }),
          _32("No images available")
        ] }) : /* @__PURE__ */ jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 16 }, children: galleryRows.map((record) => renderGalleryItem(record)) }),
        galleryPaginationProps && /* @__PURE__ */ jsx("div", { style: { marginTop: 12, display: "flex", justifyContent: "flex-end" }, children: /* @__PURE__ */ jsx(Pagination, { ...galleryPaginationProps }) })
      ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        selectModeBanner,
        !selectMode && bulkActionsToolbar,
        renderDynamicListTotalsBoxes(),
        (!isTotalsDetailsView || isTdFlipped) && /* @__PURE__ */ jsxs(
          Table,
          {
            ...tableProps,
            className: isEmptyTable ? "compact-empty-table" : void 0,
            dataSource: filteredDataSource,
            pagination: tablePagination,
            size: "small",
            scroll: { x: true },
            locale: isEmptyTable ? { emptyText: null } : void 0,
            rowKey: getRowKey,
            rowSelection: internalRowSelection,
            onRow: (record) => {
              const { resource, id } = getTargetInfo(record);
              return {
                onClick: (event) => handleRowClick(record, event),
                style: { cursor: resource && id !== void 0 && id !== null ? "pointer" : "default" }
              };
            },
            onChange: (pagination, filters, sorter, extra) => {
              const nextFilters = {};
              Object.entries(filters || {}).forEach(([key, values]) => {
                if (!values) return;
                nextFilters[key] = values.map((val) => String(val));
              });
              setColumnFiltersSelected(nextFilters);
              if (extra?.action === "sort") {
                const sortIntent = sortIntentRef.current;
                sortIntentRef.current = null;
                setColumnSort((prev) => resolveNextColumnSort(prev, sorter, sortIntent));
              } else {
                sortIntentRef.current = null;
              }
              const isRangeEncoded = (v) => {
                const s = String(v ?? "");
                return s.startsWith("__range__:") || s.startsWith("__catrange__:") || s.startsWith("__daterange__:");
              };
              const serverFilters = Object.fromEntries(
                Object.entries(filters || {}).map(([k, vals]) => [
                  k,
                  vals?.some(isRangeEncoded) ? null : vals
                ])
              );
              const cleanActiveFilters = (activeFilters || []).filter((f) => {
                const v = f.value;
                const vals = Array.isArray(v) ? v : [v];
                return !vals.some(isRangeEncoded);
              });
              if (cleanActiveFilters.length !== (activeFilters || []).length) {
                setFilters(cleanActiveFilters, "replace");
              }
              const isEidSort = (s) => s?.field === "eid" || s?.columnKey === "eid";
              const serverSorter = Array.isArray(sorter) ? sorter.filter((s) => !isEidSort(s)) : isEidSort(sorter) ? [] : sorter;
              tableProps.onChange?.(pagination, serverFilters, serverSorter, extra);
            },
            children: [
              displayFields.map((field) => /* @__PURE__ */ jsx(
                Table.Column,
                {
                  dataIndex: field.key,
                  title: field.label,
                  sorter: { compare: (a, b) => compareSortValues(field, a, b), multiple: getSortPriority(columnSort, field.key) },
                  align: field.type === "number" && !["eid", "eid_from", "eid_to"].includes(field.key) ? "right" : void 0,
                  filters: columnFilters.get(field.key),
                  filteredValue: columnFiltersSelected[field.key] || null,
                  sortOrder: columnSort.find((item) => item.fieldKey === field.key)?.order ?? null,
                  onFilterDropdownOpenChange: (visible) => {
                    if (visible && !columnFilterDropdownEverOpened) {
                      setColumnFilterDropdownEverOpened(true);
                    }
                  },
                  onHeaderCell: () => ({
                    onClick: (event) => {
                      sortIntentRef.current = {
                        fieldKey: field.key,
                        additive: event.ctrlKey || event.metaKey
                      };
                    }
                  }),
                  onFilter: (value, record) => {
                    const strValue = String(value);
                    if (field.type === "number" && !field.reference && strValue.startsWith("__range__:")) {
                      const parts = strValue.split(":");
                      const lo = Number(parts[1]);
                      const hi = Number(parts[2]);
                      const recordVal = Number(record?.[field.key]);
                      if (isNaN(recordVal)) return false;
                      return recordVal >= lo && recordVal <= hi;
                    }
                    if ((field.type === "date" || field.type === "datetime") && strValue.startsWith("__daterange__:")) {
                      const sub = strValue.substring("__daterange__:".length);
                      const sepIdx = sub.indexOf(":");
                      const lo = decodeURIComponent(sub.substring(0, sepIdx));
                      const hi = decodeURIComponent(sub.substring(sepIdx + 1));
                      const recordVal = String(record?.[field.key] ?? "").substring(0, 10);
                      return recordVal >= lo && recordVal <= hi;
                    }
                    if (field.type === "string" && !field.reference && strValue.startsWith("__catrange__:")) {
                      const sub = strValue.substring("__catrange__:".length);
                      const sepIdx = sub.indexOf(":");
                      const lo = decodeURIComponent(sub.substring(0, sepIdx));
                      const hi = decodeURIComponent(sub.substring(sepIdx + 1));
                      const recordVal = String(record?.[field.key] ?? "");
                      return recordVal.localeCompare(lo) >= 0 && recordVal.localeCompare(hi) <= 0;
                    }
                    if (field.key === "eid" && strValue.startsWith("__catrange__:")) {
                      const sub = strValue.substring("__catrange__:".length);
                      const sepIdx = sub.indexOf(":");
                      const lo = decodeURIComponent(sub.substring(0, sepIdx));
                      const hi = decodeURIComponent(sub.substring(sepIdx + 1));
                      const recordLabel = String(record?._label ?? "");
                      return recordLabel.localeCompare(lo) >= 0 && recordLabel.localeCompare(hi) <= 0;
                    }
                    if (field.key === "eid" && record?._label) {
                      return String(record._label) === strValue || String(record.eid) === strValue;
                    }
                    const recordValue = record?.[field.key];
                    return String(recordValue) === strValue;
                  },
                  render: (value, record) => {
                    const { resource, id } = getTargetInfo(record);
                    const renderValue = () => {
                      if (field.reference && value && hasReferenceModel(field.reference, allModels)) {
                        return /* @__PURE__ */ jsx(
                          ReferenceField,
                          {
                            id: value,
                            resource: field.reference,
                            onLabel: (label) => handleReferenceLabel(field.reference, value, label)
                          }
                        );
                      }
                      if (field.key === "eid" && record._label) return record._label;
                      if (field.type === "boolean") return /* @__PURE__ */ jsx(Checkbox, { checked: value, disabled: true });
                      if (field.type === "number" && !field.reference) {
                        const formatted = formatNumberValue(value);
                        const maxValue = numericColumnMaxes[field.key] ?? 0;
                        return renderNumericValueBar(value, maxValue, formatted, numericBarColor);
                      }
                      if (field.type === "date") return formatDateValue(value);
                      if (field.type === "datetime") return formatDateTimeValue(value) ?? value;
                      if (field.type === "time") return formatTimeValue(value);
                      if (field.options) return renderOptionTag(field, value);
                      return value;
                    };
                    if (!id || !resource) return renderValue();
                    return /* @__PURE__ */ jsx(
                      "a",
                      {
                        href: getShowHref(resource, id, allModels),
                        onClick: (e) => {
                          if (!shouldHandleLinkClick(e)) return;
                          e.preventDefault();
                          if (paneNav?.isInMultiPane) {
                            paneNav.openDetail(resource, id);
                          } else {
                            go({ to: { resource, action: "show", id } });
                          }
                        },
                        style: { cursor: "pointer", color: "inherit", textDecoration: "none" },
                        children: renderValue()
                      }
                    );
                  }
                },
                field.key
              )),
              showActions && /* @__PURE__ */ jsx(
                Table.Column,
                {
                  title: _32("Actions"),
                  width: 140,
                  render: (_unused, record) => {
                    const { resource, id, isLinkRow } = getTargetInfo(record);
                    if (!id || !resource) return /* @__PURE__ */ jsx(Tooltip, { title: `${_32("Debug: Cannot find target")}. ID: ${id}, Resource: ${resource}. Keys: ${Object.keys(record).join(",")}`, children: /* @__PURE__ */ jsx(Button, { size: "small", danger: true, icon: /* @__PURE__ */ jsx(BugOutlined, {}) }) });
                    const deleteResource = isLinkRow ? model.name : resource;
                    const deleteId = isLinkRow && relationConfig?.targetKey && relationConfig?.otherKey ? `${record[relationConfig.targetKey]}:${record[relationConfig.otherKey]}` : id;
                    return /* @__PURE__ */ jsxs(Space, { children: [
                      /* @__PURE__ */ jsx(Tooltip, { title: _32("View"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(EyeOutlined, {}), onClick: () => go({ to: { resource, action: "show", id } }) }) }),
                      /* @__PURE__ */ jsx(Tooltip, { title: _32("Edit"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(EditOutlined, {}), onClick: () => go({ to: { resource, action: "edit", id } }) }) }),
                      /* @__PURE__ */ jsx(Tooltip, { title: _32("Delete"), children: /* @__PURE__ */ jsx(DeleteButton, { hideText: true, size: "small", recordItemId: deleteId, resource: deleteResource }) })
                    ] });
                  }
                },
                "actions"
              )
            ]
          }
        )
      ] }) }),
      analyzeOpen && !isEmptyTable && analyzePrefsReady && /* @__PURE__ */ jsx("div", { style: analyzeContainerStyle, children: /* @__PURE__ */ jsx(
        Card,
        {
          size: "small",
          title: /* @__PURE__ */ jsx("span", { style: { color: modelTone.text, fontWeight: 600 }, children: _32("Analyze") }),
          styles: {
            header: {
              background: `linear-gradient(135deg, ${modelTone.solid}18 0%, ${modelTone.solid}0a 100%)`
            },
            body: { padding: 0 }
          },
          children: /* @__PURE__ */ jsx("div", { style: { perspective: 1600, padding: 12 }, children: /* @__PURE__ */ jsxs(
            "div",
            {
              style: {
                display: "grid",
                transformStyle: "preserve-3d",
                transition: "transform 0.6s",
                transform: isStatsFlipped ? "rotateY(180deg)" : "rotateY(0deg)"
              },
              children: [
                /* @__PURE__ */ jsxs(
                  Card,
                  {
                    size: "small",
                    style: {
                      gridArea: "1 / 1",
                      backfaceVisibility: "hidden",
                      pointerEvents: isStatsFlipped ? "none" : "auto"
                    },
                    styles: { body: { display: "grid", gap: 16, position: "relative", paddingTop: 48 } },
                    children: [
                      /* @__PURE__ */ jsxs("div", { style: { position: "absolute", top: 0, right: 0, display: "flex", gap: 8 }, children: [
                        /* @__PURE__ */ jsx(Tooltip, { title: _32("Save preferences"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(SaveOutlined, {}), onClick: () => openSaveViewModalFor("analyze"), loading: isSavingAnalyzePrefs }) }),
                        /* @__PURE__ */ jsx(Tooltip, { title: _32("Stats"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(FileTextOutlined, {}), onClick: () => setIsStatsFlipped(true) }) }),
                        /* @__PURE__ */ jsx(Tooltip, { title: _32("Export chart PDF"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(FilePdfOutlined, {}), onClick: exportChartPdf }) }),
                        /* @__PURE__ */ jsx(Tooltip, { title: _32("Export chart PNG"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(DownloadOutlined, {}), onClick: exportChartImage, "aria-label": _32("Export chart") }) })
                      ] }),
                      /* @__PURE__ */ jsx(
                        AnalysisChart,
                        {
                          data: chartData.groups,
                          seriesKeys: chartData.seriesKeys,
                          seriesLabels: chartData.seriesLabels,
                          chartType,
                          svgRef: chartSvgRef,
                          animationKey: chartAnimationKey,
                          animationStage: chartAnimationStage,
                          rawRows: chartData.filteredRawRows,
                          numericFields,
                          categoryField1,
                          categoryField2,
                          formatCategoryValue,
                          summaryFn,
                          allFields: model.fields,
                          title: chartTitle,
                          numericBarColor
                        }
                      ),
                      /* @__PURE__ */ jsx(
                        Collapse,
                        {
                          size: "small",
                          defaultActiveKey: [],
                          items: [
                            {
                              key: "configure-chart",
                              label: _32("Customize chart"),
                              children: /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 16 }, children: [
                                /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 16, flexWrap: "wrap" }, children: [
                                  /* @__PURE__ */ jsxs("div", { style: { minWidth: 220, flex: 1 }, children: [
                                    /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }, children: _32("Category 1") }),
                                    /* @__PURE__ */ jsx(
                                      Select,
                                      {
                                        value: categoryField1 || void 0,
                                        onChange: (value) => {
                                          markAnalyzePrefsTouched();
                                          setCategoryField1(value);
                                        },
                                        style: { width: "100%" },
                                        options: categoricalFields.map((field) => ({ label: field.label, value: field.key })),
                                        placeholder: _32("Select category")
                                      }
                                    )
                                  ] }),
                                  /* @__PURE__ */ jsxs("div", { style: { minWidth: 220, flex: 1 }, children: [
                                    /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }, children: _32("Category 2") }),
                                    /* @__PURE__ */ jsx(
                                      Select,
                                      {
                                        value: categoryField2 || "__none__",
                                        onChange: (value) => {
                                          markAnalyzePrefsTouched();
                                          setCategoryField2(value === "__none__" ? null : value);
                                        },
                                        style: { width: "100%" },
                                        options: [
                                          { label: _32("None"), value: "__none__" },
                                          ...categoricalFields.filter((field) => field.key !== categoryField1).map((field) => ({ label: field.label, value: field.key }))
                                        ]
                                      }
                                    )
                                  ] }),
                                  /* @__PURE__ */ jsxs("div", { style: { minWidth: 160 }, children: [
                                    /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }, children: _32("Chart Type") }),
                                    /* @__PURE__ */ jsx(
                                      Select,
                                      {
                                        value: chartType,
                                        onChange: (value) => {
                                          markAnalyzePrefsTouched();
                                          setChartType(value);
                                        },
                                        style: { width: "100%" },
                                        options: [
                                          { label: _32("Area"), value: "area" },
                                          { label: _32("Horizontal Area"), value: "area-horizontal" },
                                          { label: _32("Bars"), value: "bar" },
                                          { label: _32("Stacked Bars"), value: "stacked" },
                                          { label: _32("Horizontal Bars"), value: "bar-horizontal" },
                                          { label: _32("Horizontal Stacked"), value: "stacked-horizontal" },
                                          { label: _32("Lines"), value: "line" },
                                          { label: _32("Pie"), value: "pie" },
                                          { label: _32("Donut"), value: "donut" },
                                          { label: _32("Scatter"), value: "scatter" },
                                          { label: _32("Bubble"), value: "bubble" },
                                          { label: _32("Histogram"), value: "histogram" },
                                          { label: _32("Box Plot"), value: "box" },
                                          { label: _32("Waterfall"), value: "waterfall" },
                                          { label: _32("Heatmap"), value: "heatmap" },
                                          { label: _32("Crosstab"), value: "crosstab" },
                                          { label: _32("Radar"), value: "radar" },
                                          { label: _32("Combo (Bar + Line)"), value: "combo" }
                                        ]
                                      }
                                    )
                                  ] }),
                                  /* @__PURE__ */ jsxs("div", { style: { minWidth: 200 }, children: [
                                    /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }, children: _32("Summary") }),
                                    /* @__PURE__ */ jsx(
                                      Select,
                                      {
                                        value: summaryFn,
                                        onChange: (value) => {
                                          markAnalyzePrefsTouched();
                                          setSummaryFn(value);
                                        },
                                        style: { width: "100%" },
                                        options: [
                                          { label: _32("Sum"), value: "sum" },
                                          { label: _32("Average"), value: "avg" },
                                          { label: _32("Count"), value: "count" },
                                          { label: _32("Max"), value: "max" },
                                          { label: _32("Min"), value: "min" },
                                          { label: _32("Std Dev"), value: "stddev" }
                                        ]
                                      }
                                    )
                                  ] }),
                                  /* @__PURE__ */ jsxs("div", { style: { minWidth: 180 }, children: [
                                    /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }, children: _32("Ranking Filter") }),
                                    /* @__PURE__ */ jsx(
                                      Select,
                                      {
                                        value: rankingMode,
                                        onChange: (value) => {
                                          markAnalyzePrefsTouched();
                                          setRankingMode(value);
                                        },
                                        style: { width: "100%" },
                                        options: [
                                          { label: _32("None"), value: "none" },
                                          { label: _32("Top N"), value: "top" },
                                          { label: _32("Bottom N"), value: "bottom" }
                                        ]
                                      }
                                    )
                                  ] }),
                                  /* @__PURE__ */ jsxs("div", { style: { minWidth: 220 }, children: [
                                    /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }, children: _32("Ranking Column") }),
                                    /* @__PURE__ */ jsx(
                                      Select,
                                      {
                                        value: rankingFieldKey || void 0,
                                        onChange: (value) => {
                                          markAnalyzePrefsTouched();
                                          setRankingFieldKey(value);
                                        },
                                        style: { width: "100%" },
                                        options: numericFields.map((field) => ({ label: field.label, value: field.key })),
                                        placeholder: _32("Select numeric column"),
                                        disabled: rankingMode === "none" || numericFields.length === 0
                                      }
                                    )
                                  ] }),
                                  /* @__PURE__ */ jsxs("div", { style: { minWidth: 120 }, children: [
                                    /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary, marginBottom: 4 }, children: _32("N") }),
                                    /* @__PURE__ */ jsx(
                                      InputNumber,
                                      {
                                        min: 1,
                                        value: rankingN,
                                        onChange: (value) => {
                                          markAnalyzePrefsTouched();
                                          const nextN = Number(value);
                                          setRankingN(Number.isFinite(nextN) && nextN > 0 ? Math.floor(nextN) : 10);
                                        },
                                        style: { width: "100%" },
                                        disabled: rankingMode === "none"
                                      }
                                    )
                                  ] })
                                ] }),
                                /* @__PURE__ */ jsxs("div", { children: [
                                  /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6 }, children: [
                                    /* @__PURE__ */ jsx("div", { style: { fontSize: 12, color: token.colorTextSecondary }, children: _32("Series") }),
                                    /* @__PURE__ */ jsx(Tooltip, { title: _32("Unselect All"), children: /* @__PURE__ */ jsx(
                                      Button,
                                      {
                                        size: "small",
                                        icon: /* @__PURE__ */ jsx(CloseCircleOutlined, {}),
                                        onClick: () => {
                                          markAnalyzePrefsTouched();
                                          setSelectedSeriesKeys([]);
                                        }
                                      }
                                    ) })
                                  ] }),
                                  /* @__PURE__ */ jsx(
                                    Checkbox.Group,
                                    {
                                      value: selectedSeriesKeys || [],
                                      onChange: (values) => {
                                        markAnalyzePrefsTouched();
                                        setSelectedSeriesKeys(values);
                                      },
                                      options: numericFields.length > 0 ? numericFields.map((field) => ({ label: field.label, value: field.key })) : [{ label: _32("Count"), value: "__count__" }]
                                    }
                                  )
                                ] }),
                                isAllRowsLoading && /* @__PURE__ */ jsx("div", { style: { color: token.colorTextSecondary, fontSize: 12 }, children: _32("Loading all rows for analysis...") }),
                                allRowsError && /* @__PURE__ */ jsx("div", { style: { color: token.colorError, fontSize: 12 }, children: allRowsError })
                              ] })
                            }
                          ]
                        }
                      )
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs(
                  Card,
                  {
                    size: "small",
                    style: {
                      gridArea: "1 / 1",
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                      pointerEvents: isStatsFlipped ? "auto" : "none"
                    },
                    styles: { body: { display: "grid", gap: 16, position: "relative", paddingTop: 48 } },
                    children: [
                      /* @__PURE__ */ jsxs("div", { style: { position: "absolute", top: 0, right: 0, display: "flex", gap: 8 }, children: [
                        /* @__PURE__ */ jsx(Tooltip, { title: _32("Analysis"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(BarChartOutlined, {}), onClick: () => setIsStatsFlipped(false) }) }),
                        /* @__PURE__ */ jsx(Tooltip, { title: _32("Export stats PDF"), children: /* @__PURE__ */ jsx(Button, { size: "small", icon: /* @__PURE__ */ jsx(FilePdfOutlined, {}), onClick: exportStatsPdf }) })
                      ] }),
                      /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 16 }, children: [
                        statsSummary.numericStats.length > 0 && /* @__PURE__ */ jsx(Card, { size: "small", title: /* @__PURE__ */ jsx("span", { style: statsTitleStyle, children: _32("Numeric columns") }), children: /* @__PURE__ */ jsxs(
                          Table,
                          {
                            dataSource: statsSummary.numericStats,
                            size: "small",
                            pagination: false,
                            rowKey: (row) => row.key,
                            children: [
                              /* @__PURE__ */ jsx(
                                Table.Column,
                                {
                                  title: _32("Field"),
                                  dataIndex: "label",
                                  render: (label) => /* @__PURE__ */ jsx("span", { style: statsLabelStyle, children: label }),
                                  onHeaderCell: () => ({ style: statsHeaderStyle })
                                },
                                "label"
                              ),
                              /* @__PURE__ */ jsx(Table.Column, { title: _32("Sum"), align: "right", render: (_unused, row) => renderStatBar(row.sum, statsNumericMaxes.sum, formatNumberValue), onHeaderCell: () => ({ style: statsHeaderStyle }) }, "sum"),
                              /* @__PURE__ */ jsx(Table.Column, { title: _32("Average"), align: "right", render: (_unused, row) => renderStatBar(row.avg, statsNumericMaxes.avg, formatNumberValue), onHeaderCell: () => ({ style: statsHeaderStyle }) }, "avg"),
                              /* @__PURE__ */ jsx(Table.Column, { title: _32("Min"), align: "right", render: (_unused, row) => renderStatBar(row.min, statsNumericMaxes.min, formatNumberValue), onHeaderCell: () => ({ style: statsHeaderStyle }) }, "min"),
                              /* @__PURE__ */ jsx(Table.Column, { title: _32("Max"), align: "right", render: (_unused, row) => renderStatBar(row.max, statsNumericMaxes.max, formatNumberValue), onHeaderCell: () => ({ style: statsHeaderStyle }) }, "max"),
                              /* @__PURE__ */ jsx(Table.Column, { title: _32("Std Dev"), align: "right", render: (_unused, row) => renderStatBar(row.stddev, statsNumericMaxes.stddev, formatNumberValue), onHeaderCell: () => ({ style: statsHeaderStyle }) }, "stddev")
                            ]
                          }
                        ) }),
                        statsSummary.categoricalStats.length > 0 && /* @__PURE__ */ jsx(
                          Collapse,
                          {
                            size: "small",
                            defaultActiveKey: [],
                            items: [
                              {
                                key: "categorical-columns",
                                label: /* @__PURE__ */ jsx("span", { style: statsTitleStyle, children: _32("Categorical columns (distinct < 20)") }),
                                children: statsSummary.categoricalStats.map((field) => /* @__PURE__ */ jsxs("div", { style: { marginBottom: 12 }, children: [
                                  /* @__PURE__ */ jsx("div", { style: { fontWeight: 600, marginBottom: 4 }, children: /* @__PURE__ */ jsx("span", { style: statsLabelStyle, children: field.label }) }),
                                  /* @__PURE__ */ jsxs(
                                    Table,
                                    {
                                      dataSource: field.counts,
                                      size: "small",
                                      pagination: false,
                                      rowKey: (row) => row.value,
                                      children: [
                                        /* @__PURE__ */ jsx(Table.Column, { title: _32("Value"), dataIndex: "value", onHeaderCell: () => ({ style: statsHeaderStyle }) }, "value"),
                                        /* @__PURE__ */ jsx(
                                          Table.Column,
                                          {
                                            title: _32("Count"),
                                            dataIndex: "count",
                                            align: "right",
                                            onHeaderCell: () => ({ style: statsHeaderStyle }),
                                            render: (value) => {
                                              const maxCount = Math.max(1, ...field.counts.map((entry) => entry.count));
                                              return renderStatBar(value, maxCount, (val) => formatNumberValue(val));
                                            }
                                          },
                                          "count"
                                        )
                                      ]
                                    }
                                  )
                                ] }, field.key))
                              }
                            ]
                          }
                        )
                      ] })
                    ]
                  }
                )
              ]
            }
          ) })
        }
      ) })
    ] })
  ] });
  if (isEmbedded) return /* @__PURE__ */ jsxs(Fragment, { children: [
    listContent,
    bulkConfirmationModal
  ] });
  const renderListHeaderButtons = ({ defaultButtons }) => /* @__PURE__ */ jsxs(Fragment, { children: [
    extraHeaderButtons,
    metadataButton,
    metadataModal,
    columnsToggleButton,
    listToggleButton,
    exportButton,
    renderIconOnlyButtons(defaultButtons)
  ] });
  return /* @__PURE__ */ jsxs("div", { className: "jm-tone-scope", style: toneScopeStyle(modelTone), children: [
    /* @__PURE__ */ jsx(ToneSharedStyles, {}),
    bulkConfirmationModal,
    isRelationView ? /* @__PURE__ */ jsx(VerticalActionsLayout, { position: "top-right", onBarMount: setActionsBarEl, children: /* @__PURE__ */ jsx(
      List,
      {
        title: renderWrappedPageTitle(listTitle),
        resource: model.resource || model.name,
        headerButtons: () => null,
        children: listContent
      }
    ) }) : /* @__PURE__ */ jsx(
      StandardList,
      {
        title: renderWrappedPageTitle(listTitle),
        resource: model.resource || model.name,
        headerButtons: renderListHeaderButtons,
        children: listContent
      }
    )
  ] });
};

// src/components/MultiPane/paneUtils.ts
function parsePanes(searchParams) {
  return searchParams.getAll("pane").map((param) => {
    const colonIdx = param.indexOf(":");
    if (colonIdx < 1) return null;
    const resource = param.slice(0, colonIdx);
    const id = param.slice(colonIdx + 1);
    if (!resource || !id) return null;
    return { resource, id };
  }).filter((p) => p !== null);
}
function applyPanesToSearchParams(existing, panes) {
  const next = new URLSearchParams(existing);
  next.delete("pane");
  panes.forEach((p) => next.append("pane", `${p.resource}:${p.id}`));
  return next;
}
var _33 = window._ || ((text) => text);
var LIST_PANEL_ID = "list-panel";
var detailPanelId = (idx) => `detail-panel-${idx}`;
var COLLAPSED_SIZE = 10;
var FakeRouteProvider = ({ model, id, children }) => {
  const existingRouteContext = useContext(UNSAFE_RouteContext);
  const fakeRouteContext = useMemo(() => ({
    ...existingRouteContext,
    matches: [
      ...existingRouteContext.matches,
      {
        params: { id: String(id) },
        pathname: `/${model.resource || model.name.toLowerCase()}/show/${id}`,
        pathnameBase: `/${model.resource || model.name.toLowerCase()}/show/${id}`,
        route: {}
      }
    ]
  }), [existingRouteContext, id, model]);
  return /* @__PURE__ */ jsx(UNSAFE_RouteContext.Provider, { value: fakeRouteContext, children });
};
var PaneToolbar = ({ model, pane, allModels, onClose, onMinimize, onMaximize }) => {
  const { token } = theme.useToken();
  const resourcePath = resolveResourcePath(model.resource || model.name, allModels);
  const href = `/${resourcePath}/show/${pane.id}`;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      style: {
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        padding: "2px 6px",
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        flexShrink: 0,
        gap: 2,
        minHeight: PANE_TOOLBAR_HEIGHT
      },
      children: [
        /* @__PURE__ */ jsx(Tooltip, { title: _33("Open in full page"), children: /* @__PURE__ */ jsx(
          "a",
          {
            href,
            target: "_blank",
            rel: "noopener noreferrer",
            style: { color: token.colorTextTertiary, display: "flex", alignItems: "center", padding: "0 4px" },
            children: /* @__PURE__ */ jsx(LinkOutlined, { style: { fontSize: 11 } })
          }
        ) }),
        /* @__PURE__ */ jsx(Tooltip, { title: _33("Minimize pane"), children: /* @__PURE__ */ jsx(
          Button,
          {
            type: "text",
            size: "small",
            icon: /* @__PURE__ */ jsx(MinusSquareOutlined, { style: { fontSize: 11 } }),
            onClick: onMinimize,
            style: { color: token.colorTextTertiary, padding: "0 4px", height: 22, minWidth: 22 }
          }
        ) }),
        /* @__PURE__ */ jsx(Tooltip, { title: _33("Maximize pane"), children: /* @__PURE__ */ jsx(
          Button,
          {
            type: "text",
            size: "small",
            icon: /* @__PURE__ */ jsx(FullscreenOutlined, { style: { fontSize: 11 } }),
            onClick: onMaximize,
            style: { color: token.colorTextTertiary, padding: "0 4px", height: 22, minWidth: 22 }
          }
        ) }),
        /* @__PURE__ */ jsx(Tooltip, { title: _33("Close pane"), children: /* @__PURE__ */ jsx(
          Button,
          {
            type: "text",
            size: "small",
            icon: /* @__PURE__ */ jsx(CloseOutlined, { style: { fontSize: 11 } }),
            onClick: onClose,
            style: { color: token.colorTextTertiary, padding: "0 4px", height: 22, minWidth: 22 }
          }
        ) })
      ]
    }
  );
};
var ResizeHandle = () => {
  const { token } = theme.useToken();
  return /* @__PURE__ */ jsxs(
    Qt,
    {
      style: {
        width: 6,
        background: "transparent",
        cursor: "col-resize",
        flexShrink: 0,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      },
      children: [
        /* @__PURE__ */ jsx(
          "div",
          {
            style: {
              width: 2,
              height: "100%",
              background: token.colorBorder,
              transition: "background 0.15s, width 0.15s"
            },
            className: "jm-resize-handle-bar"
          }
        ),
        /* @__PURE__ */ jsx("style", { children: `
                [data-separator][data-active] .jm-resize-handle-bar,
                [data-separator]:hover .jm-resize-handle-bar {
                    background: ${token.colorPrimary} !important;
                    width: 3px !important;
                }
            ` })
      ]
    }
  );
};
var MultiPaneLayout = ({ children }) => {
  const containerRef = useRef(null);
  const [panelHeight, setPanelHeight] = useState("100vh");
  useLayoutEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const top = containerRef.current.getBoundingClientRect().top;
      setPanelHeight(`${window.innerHeight - top}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const [searchParams, setSearchParams] = useSearchParams();
  const allModels = useAllModels();
  const PrimaryShowRenderer = useContext(PrimaryShowContext);
  const { token } = theme.useToken();
  const panes = useMemo(() => parsePanes(searchParams), [searchParams]);
  const groupRef = useRef(null);
  const pendingLayoutRef = useRef(null);
  const prevPaneCountRef = useRef(0);
  useEffect(() => {
    const newCount = panes.length;
    const prevCount = prevPaneCountRef.current;
    prevPaneCountRef.current = newCount;
    if (newCount <= prevCount || !pendingLayoutRef.current || !groupRef.current) {
      pendingLayoutRef.current = null;
      return;
    }
    const prevLayout = pendingLayoutRef.current;
    pendingLayoutRef.current = null;
    const donorId = prevCount === 0 ? LIST_PANEL_ID : detailPanelId(prevCount - 1);
    const donorSize = prevLayout[donorId] ?? 100;
    const newId = detailPanelId(newCount - 1);
    const newLayout = {
      ...prevLayout,
      [donorId]: donorSize * 0.2,
      [newId]: donorSize * 0.8
    };
    const frameId = requestAnimationFrame(() => {
      groupRef.current?.setLayout(newLayout);
    });
    return () => cancelAnimationFrame(frameId);
  }, [panes.length]);
  const openDetail = useCallback(
    (fromPaneIndex, resource, id) => {
      if (groupRef.current) {
        pendingLayoutRef.current = { ...groupRef.current.getLayout() };
      }
      setSearchParams(
        (prev) => {
          const current = parsePanes(prev);
          const resolved = resolveResourcePath(resource, allModels);
          const next = [
            ...current.slice(0, fromPaneIndex),
            { resource: resolved || resource.toLowerCase(), id: String(id) }
          ];
          return applyPanesToSearchParams(prev, next);
        },
        { replace: false }
      );
    },
    [allModels, setSearchParams]
  );
  const closePane = useCallback(
    (fromArrayIndex) => {
      setSearchParams(
        (prev) => {
          const current = parsePanes(prev);
          return applyPanesToSearchParams(prev, current.slice(0, fromArrayIndex));
        },
        { replace: false }
      );
    },
    [setSearchParams]
  );
  const minimizePane = useCallback((panelId) => {
    if (!groupRef.current) return;
    const layout = groupRef.current.getLayout();
    const currentSize = layout[panelId] ?? COLLAPSED_SIZE;
    if (currentSize <= COLLAPSED_SIZE + 1) return;
    const freed = currentSize - COLLAPSED_SIZE;
    const otherIds = Object.keys(layout).filter((id) => id !== panelId);
    const otherTotal = otherIds.reduce((sum, id) => sum + (layout[id] ?? 0), 0);
    const newLayout = { ...layout, [panelId]: COLLAPSED_SIZE };
    otherIds.forEach((id) => {
      const frac = otherTotal > 0 ? (layout[id] ?? 0) / otherTotal : 1 / otherIds.length;
      newLayout[id] = (layout[id] ?? 0) + freed * frac;
    });
    groupRef.current.setLayout(newLayout);
  }, []);
  const maximizePane = useCallback((panelId) => {
    if (!groupRef.current) return;
    const layout = groupRef.current.getLayout();
    const panelIds = Object.keys(layout);
    const n = panelIds.length;
    const maxSize = 100 - COLLAPSED_SIZE * (n - 1);
    const newLayout = {};
    panelIds.forEach((id) => {
      newLayout[id] = id === panelId ? maxSize : COLLAPSED_SIZE;
    });
    groupRef.current.setLayout(newLayout);
  }, []);
  const listPaneContext = useMemo(
    () => ({
      isInMultiPane: true,
      paneIndex: 0,
      openDetail: (resource, id) => openDetail(0, resource, id)
    }),
    [openDetail]
  );
  const detailPaneContexts = useMemo(
    () => panes.map((_39, idx) => ({
      isInMultiPane: true,
      paneIndex: idx + 1,
      openDetail: (resource, id) => openDetail(idx + 1, resource, id)
    })),
    [panes, openDetail]
  );
  const panelChildren = useMemo(() => {
    const result = [
      /* @__PURE__ */ jsx(Yt, { id: LIST_PANEL_ID, minSize: 10, style: { overflow: "auto" }, children: /* @__PURE__ */ jsx(PaneNavigationContext.Provider, { value: listPaneContext, children }) }, "master-list")
    ];
    panes.forEach((pane, idx) => {
      const paneModel = findModelByName(allModels, pane.resource);
      if (!paneModel) return;
      result.push(/* @__PURE__ */ jsx(ResizeHandle, {}, `handle-${idx}`));
      result.push(
        /* @__PURE__ */ jsx(
          Yt,
          {
            id: detailPanelId(idx),
            minSize: 10,
            style: { overflow: "auto", borderLeft: `2px solid ${token.colorBorder}` },
            children: /* @__PURE__ */ jsxs(PaneNavigationContext.Provider, { value: detailPaneContexts[idx], children: [
              /* @__PURE__ */ jsx(
                PaneToolbar,
                {
                  model: paneModel,
                  pane,
                  allModels,
                  onClose: () => closePane(idx),
                  onMinimize: () => minimizePane(detailPanelId(idx)),
                  onMaximize: () => maximizePane(detailPanelId(idx))
                }
              ),
              PrimaryShowRenderer && /* @__PURE__ */ jsx(FakeRouteProvider, { model: paneModel, id: pane.id, children: /* @__PURE__ */ jsx(
                PrimaryShowRenderer,
                {
                  model: paneModel,
                  id: pane.id,
                  allModels
                }
              ) })
            ] })
          },
          `panel-${pane.resource}:${pane.id}`
        )
      );
    });
    return result;
  }, [panes, allModels, listPaneContext, detailPaneContexts, children, closePane, minimizePane, maximizePane, PrimaryShowRenderer, token.colorBorder]);
  return /* @__PURE__ */ jsx("div", { ref: containerRef, className: "jm-full-width-page", style: { overflow: "hidden", height: panelHeight }, children: /* @__PURE__ */ jsx(
    Ut,
    {
      orientation: "horizontal",
      groupRef,
      style: { flex: 1, height: "100%" },
      children: panelChildren
    }
  ) });
};
var { Title: Title8 } = Typography;
var _34 = window._ || ((text) => text);
var HierarchyView = ({ resource, recordId, fallback }) => {
  const go = useGo();
  const { data: ancestorsData, isLoading: ancestorsLoading, error: ancestorsError } = useCustom({
    url: `/${resource}/${recordId}/ancestors`,
    method: "get",
    queryOptions: { enabled: !!recordId }
  });
  const { data: descendantsData, isLoading: descendantsLoading, error: descendantsError } = useCustom({
    url: `/${resource}/${recordId}/descendants`,
    method: "get",
    queryOptions: { enabled: !!recordId }
  });
  const buildTree = (nodes) => {
    const nodeMap = /* @__PURE__ */ new Map();
    const roots = [];
    nodes.forEach((node) => {
      const treeNode = {
        ...node,
        key: node.cw_eid,
        title: node._label,
        children: []
      };
      nodeMap.set(node.cw_eid, treeNode);
    });
    nodes.forEach((node) => {
      if (node.parent_eid && nodeMap.has(node.parent_eid)) {
        const parent = nodeMap.get(node.parent_eid);
        parent?.children?.push(nodeMap.get(node.cw_eid));
      } else {
        if (node.level === 0) {
          roots.push(nodeMap.get(node.cw_eid));
        }
      }
    });
    return roots;
  };
  const rawDescendants = descendantsData?.data;
  const descendantsList = Array.isArray(rawDescendants) ? rawDescendants : [];
  const treeData = descendantsList.length > 0 ? buildTree(descendantsList) : [];
  const rawAncestors = ancestorsData?.data;
  const ancestorsList = Array.isArray(rawAncestors) ? rawAncestors : [];
  const handleSelect = (selectedKeys) => {
    if (selectedKeys.length > 0) {
      const id = selectedKeys[0];
      go({ to: { resource, action: "show", id } });
    }
  };
  if (ancestorsLoading || descendantsLoading) {
    return /* @__PURE__ */ jsx(Spin, {});
  }
  if (ancestorsError || descendantsError) {
    if (fallback) return /* @__PURE__ */ jsx(Fragment, { children: fallback });
    return /* @__PURE__ */ jsx(Alert, { message: _34("Error loading hierarchy data"), type: "error" });
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    ancestorsList.length > 0 && /* @__PURE__ */ jsxs("div", { style: { marginBottom: 24 }, children: [
      /* @__PURE__ */ jsx(Title8, { level: 5, children: _34("Parent Hierarchy") }),
      /* @__PURE__ */ jsx(Breadcrumb, { children: ancestorsList.slice().reverse().map((node) => /* @__PURE__ */ jsx(Breadcrumb.Item, { children: /* @__PURE__ */ jsx("a", { onClick: () => go({ to: { resource, action: "show", id: node.cw_eid } }), children: node._label }) }, node.cw_eid)) })
    ] }),
    treeData.length > 0 && /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx(Title8, { level: 5, children: _34("Sub-hierarchy") }),
      /* @__PURE__ */ jsx(
        Tree,
        {
          showLine: true,
          switcherIcon: /* @__PURE__ */ jsx(DownOutlined, {}),
          defaultExpandAll: true,
          onSelect: handleSelect,
          treeData
        }
      )
    ] })
  ] });
};
var instanceCounter = 0;
var InlinePlotlyHtml = ({ html, style }) => {
  const containerRef = useRef(null);
  const instanceIdRef = useRef("");
  if (!instanceIdRef.current) {
    instanceCounter += 1;
    instanceIdRef.current = `iph-${instanceCounter}-${Date.now()}`;
  }
  const instanceId = instanceIdRef.current;
  let cleanedHtml = html.replace(
    /<script[^>]*src=["'][^"']*cdn\.plot\.ly[^"']*["'][^>]*><\/script>/gi,
    ""
  );
  cleanedHtml = cleanedHtml.replace(
    /\b(id=["'](?:cardContainer|myCard))(\d+)(["'])/g,
    (match, prefix, suffix, quote) => `${prefix}${suffix}-${instanceId}${quote}`
  );
  cleanedHtml = cleanedHtml.replace(
    /\b(onclick=["'][^"']*(?:reduceCardWidth|increaseCardWidth|optimizeCardSizeInViewPort|maximizeCardSize|minimizeCardSize|flipCard)\()(\d+)\)(["'])/g,
    (match, before, suffix, quote) => `${before}'${suffix}-${instanceId}')${quote}`
  );
  cleanedHtml = cleanedHtml.replace(
    /(getElementById\(['"])(cardContainer|myCard)(['"]\s*\+\s*)(\d+)\)/g,
    (match, open, prefix, plus, suffix) => `${open}${prefix}${plus}'${suffix}-${instanceId}')`
  );
  cleanedHtml = cleanedHtml.replace(
    /((?:reduceCardWidth|increaseCardWidth|optimizeCardSizeInViewPort|maximizeCardSize|minimizeCardSize|flipCard)\()(\d+)\)/g,
    (match, func, suffix) => `${func}'${suffix}-${instanceId}')`
  );
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const scripts = Array.from(container.querySelectorAll("script"));
    for (const oldScript of scripts) {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.text = oldScript.text || "";
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    }
  }, [html, instanceId]);
  return /* @__PURE__ */ jsx(
    "div",
    {
      ref: containerRef,
      dangerouslySetInnerHTML: { __html: cleanedHtml },
      style
    }
  );
};

// src/providers/authProvider.ts
var AUTH_BASE = "/auth";
var TOKEN_KEY2 = "jm_access_token";
var USER_KEY2 = "jm_user";
var ROLE_PERMISSIONS_KEY = "jm_role_permissions";
var RESOURCE_PERMISSIONS_KEY = "jm_resource_permissions";
var _35 = window._ || ((text) => text);
var authProvider = {
  /**
   * Authenticate by username + password.
   * Stores the JWT and user profile in localStorage on success.
   */
  login: async ({ username, password }) => {
    try {
      const response = await fetch(`${AUTH_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        return {
          success: false,
          error: {
            name: _35("Login failed"),
            message: body?.detail || _35("Invalid credentials")
          }
        };
      }
      const data = await response.json();
      localStorage.setItem(TOKEN_KEY2, data.access_token);
      localStorage.setItem(USER_KEY2, JSON.stringify(data.user));
      const token = data.access_token;
      try {
        const [rolesRes, resourceRes] = await Promise.all([
          fetch(`${AUTH_BASE}/roles`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${AUTH_BASE}/resource-permissions`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        if (rolesRes.ok) {
          const roles = await rolesRes.json();
          const permsMap = {};
          for (const role of roles) {
            permsMap[role.name] = role.allowed_actions;
          }
          localStorage.setItem(ROLE_PERMISSIONS_KEY, JSON.stringify(permsMap));
        }
        if (resourceRes.ok) {
          const resourcePerms = await resourceRes.json();
          localStorage.setItem(RESOURCE_PERMISSIONS_KEY, JSON.stringify(resourcePerms));
        }
      } catch {
      }
      return { success: true, redirectTo: "/" };
    } catch (err) {
      return {
        success: false,
        error: {
          name: _35("Login failed"),
          message: err?.message || _35("Network error")
        }
      };
    }
  },
  /**
   * Clear stored credentials and redirect to the login page.
   */
  logout: async () => {
    localStorage.removeItem(TOKEN_KEY2);
    localStorage.removeItem(USER_KEY2);
    localStorage.removeItem(ROLE_PERMISSIONS_KEY);
    localStorage.removeItem(RESOURCE_PERMISSIONS_KEY);
    return { success: true, redirectTo: "/login" };
  },
  /**
   * Check whether the user is currently authenticated.
   * Returns ``authenticated`` when a token is present.
   */
  check: async () => {
    const token = localStorage.getItem(TOKEN_KEY2);
    if (token) {
      return { authenticated: true };
    }
    return { authenticated: false, redirectTo: "/login" };
  },
  /**
   * Return the cached user identity (from localStorage) or fetch it
   * from the backend ``/auth/me`` endpoint.
   */
  getIdentity: async () => {
    const cached = localStorage.getItem(USER_KEY2);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
      }
    }
    const token = localStorage.getItem(TOKEN_KEY2);
    if (!token) return null;
    try {
      const response = await fetch(`${AUTH_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) return null;
      const user = await response.json();
      localStorage.setItem(USER_KEY2, JSON.stringify(user));
      return user;
    } catch {
      return null;
    }
  },
  /**
   * Return the user's roles for role-based UI rendering.
   */
  getPermissions: async () => {
    const cached = localStorage.getItem(USER_KEY2);
    if (cached) {
      try {
        return JSON.parse(cached)?.roles ?? [];
      } catch {
      }
    }
    return [];
  },
  /**
   * Handle API errors — trigger logout on 401.
   */
  onError: async (error) => {
    const status = error?.statusCode || error?.response?.status;
    if (status === 401) {
      return { logout: true, redirectTo: "/login" };
    }
    return { error };
  }
};

// src/providers/accessControlProvider.ts
var USER_KEY3 = "jm_user";
var ROLE_PERMISSIONS_KEY2 = "jm_role_permissions";
var RESOURCE_PERMISSIONS_KEY2 = "jm_resource_permissions";
var _36 = window._ || ((text) => text);
var FALLBACK_ROLE_ACTIONS = {
  Admin: ["list", "show", "create", "edit", "delete", "clone", "field"],
  Manager: ["list", "show", "create", "edit", "clone", "field"],
  Viewer: ["list", "show", "field"]
};
function getRoleActions() {
  const cached = localStorage.getItem(ROLE_PERMISSIONS_KEY2);
  const source = cached ? (() => {
    try {
      return JSON.parse(cached);
    } catch {
      return FALLBACK_ROLE_ACTIONS;
    }
  })() : FALLBACK_ROLE_ACTIONS;
  return Object.fromEntries(
    Object.entries(source).map(([k, v]) => [k, new Set(v)])
  );
}
function getResourcePermissions() {
  const cached = localStorage.getItem(RESOURCE_PERMISSIONS_KEY2);
  if (!cached) return {};
  try {
    return JSON.parse(cached);
  } catch {
    return {};
  }
}
var accessControlProvider = {
  can: async ({ action, resource }) => {
    const cached = localStorage.getItem(USER_KEY3);
    if (!cached) {
      return { can: false, reason: _36("Not authenticated") };
    }
    let user;
    try {
      user = JSON.parse(cached);
    } catch {
      return { can: false, reason: _36("Not authenticated") };
    }
    const roles = user?.roles ?? [];
    if (roles.some((r) => r.toLowerCase() === "admin")) {
      return { can: true };
    }
    const roleActions = getRoleActions();
    const resourcePerms = getResourcePermissions();
    for (const role of roles) {
      const roleKey = Object.keys(roleActions).find(
        (k) => k.toLowerCase() === role.toLowerCase()
      ) ?? role;
      if (resource && resourcePerms[resource]?.[roleKey] !== void 0) {
        const allowedByException = resourcePerms[resource][roleKey];
        if (allowedByException.includes(action)) {
          return { can: true };
        }
        continue;
      }
      const globalActions = roleActions[roleKey];
      if (globalActions?.has(action)) {
        return { can: true };
      }
    }
    return {
      can: false,
      reason: _36("Access denied \u2014 insufficient role for this action")
    };
  },
  options: {
    buttons: {
      enableAccessControl: true,
      hideIfUnauthorized: true
    }
  }
};
var TOKEN_KEY3 = "jm_access_token";
var httpClient = axios.create();
httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY3);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
var API_BASE_URL = "/api";
var ColorModeContextProvider = ({
  children
}) => {
  const colorModeFromLocalStorage = localStorage.getItem("colorMode");
  const isSystemPreferenceDark = window?.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;
  const systemPreference = isSystemPreferenceDark ? "dark" : "light";
  const [mode, setMode] = useState(
    colorModeFromLocalStorage === "dark" || colorModeFromLocalStorage === "light" ? colorModeFromLocalStorage : systemPreference
  );
  const initializedFromServer = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await authenticatedFetch(`${API_BASE_URL}/views/preferences/color-mode`);
        if (!resp.ok) return;
        const data = await resp.json();
        const serverMode = data?.colorMode;
        if (!cancelled && (serverMode === "light" || serverMode === "dark")) {
          setMode(serverMode);
          localStorage.setItem("colorMode", serverMode);
        }
      } catch (_e3) {
      }
      initializedFromServer.current = true;
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    window.localStorage.setItem("colorMode", mode);
    document.body.classList.toggle("jm-dark", mode === "dark");
    document.body.classList.toggle("jm-light", mode === "light");
  }, [mode]);
  const saveToServer = useCallback(async (newMode) => {
    try {
      await authenticatedFetch(`${API_BASE_URL}/views/preferences/color-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colorMode: newMode })
      });
    } catch (_e3) {
    }
  }, []);
  const setColorMode = useCallback((newMode) => {
    setMode(newMode);
    void saveToServer(newMode);
  }, [saveToServer]);
  const { darkAlgorithm, defaultAlgorithm } = theme;
  return /* @__PURE__ */ jsx(ColorModeContext.Provider, { value: { mode, setMode: setColorMode }, children: /* @__PURE__ */ jsx(
    ConfigProvider,
    {
      theme: {
        ...RefineThemes.Blue,
        algorithm: mode === "light" ? defaultAlgorithm : darkAlgorithm
      },
      children
    }
  ) });
};
var ResourceContext = createContext({
  allResources: [],
  allSystemModels: []
});
var _37 = window._ || ((text) => text);
var LoginPage = ({ appTitle = "VeloIQ", logo }) => {
  const { mutate: login, isLoading, error } = useLogin();
  const [form] = Form.useForm();
  const onFinish = (values) => {
    login(values);
  };
  return /* @__PURE__ */ jsx(
    "div",
    {
      style: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
      },
      children: /* @__PURE__ */ jsx(
        Card,
        {
          style: {
            width: 400,
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)"
          },
          children: /* @__PURE__ */ jsxs(Space, { direction: "vertical", size: "large", style: { width: "100%" }, children: [
            /* @__PURE__ */ jsxs("div", { style: { textAlign: "center" }, children: [
              logo && /* @__PURE__ */ jsx("div", { style: { marginBottom: 8 }, children: typeof logo === "string" ? /* @__PURE__ */ jsx("img", { src: logo, alt: appTitle, style: { height: 48, width: "auto" } }) : logo }),
              /* @__PURE__ */ jsx(Typography.Title, { level: 3, style: { marginBottom: 4 }, children: appTitle }),
              /* @__PURE__ */ jsx(Typography.Text, { type: "secondary", children: _37("Sign in to your account") })
            ] }),
            error && /* @__PURE__ */ jsx(
              Alert,
              {
                type: "error",
                message: error?.name || _37("Login failed"),
                description: error?.message || _37("Invalid credentials"),
                showIcon: true
              }
            ),
            /* @__PURE__ */ jsxs(
              Form,
              {
                form,
                layout: "vertical",
                onFinish,
                autoComplete: "off",
                children: [
                  /* @__PURE__ */ jsx(
                    Form.Item,
                    {
                      name: "username",
                      label: _37("Username"),
                      rules: [{ required: true, message: _37("Please enter your username") }],
                      children: /* @__PURE__ */ jsx(
                        Input,
                        {
                          prefix: /* @__PURE__ */ jsx(UserOutlined, {}),
                          placeholder: _37("Username"),
                          size: "large"
                        }
                      )
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    Form.Item,
                    {
                      name: "password",
                      label: _37("Password"),
                      rules: [{ required: true, message: _37("Please enter your password") }],
                      children: /* @__PURE__ */ jsx(
                        Input.Password,
                        {
                          prefix: /* @__PURE__ */ jsx(LockOutlined, {}),
                          placeholder: _37("Password"),
                          size: "large"
                        }
                      )
                    }
                  ),
                  /* @__PURE__ */ jsx(Form.Item, { style: { marginBottom: 0 }, children: /* @__PURE__ */ jsx(
                    Button,
                    {
                      type: "primary",
                      htmlType: "submit",
                      loading: isLoading,
                      block: true,
                      size: "large",
                      children: _37("Login")
                    }
                  ) })
                ]
              }
            )
          ] })
        }
      )
    }
  );
};
function useDashboardConfig() {
  const apiUrl = useApiUrl();
  const [config, setConfig] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`${apiUrl}/dashboard/config`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setEnabled(Boolean(data.enabled));
      if (data.enabled && data.dashboard) {
        setConfig(data.dashboard);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);
  useEffect(() => {
    load();
  }, [load]);
  const save = useCallback(async (next) => {
    setConfig(next);
    try {
      await authenticatedFetch(`${apiUrl}/dashboard/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboard: next })
      });
    } catch {
    }
  }, [apiUrl]);
  return { config, enabled, loading, save, reload: load };
}
var { Text } = Typography;
var VIEW_TYPE_OPTIONS = [
  { label: "Default (from model schema)", value: "" },
  { label: "Table", value: "table" },
  { label: "Gallery", value: "gallery" },
  { label: "Calendar", value: "calendar" },
  { label: "Totals / Details", value: "totals-details" }
];
var nextGridPosition = (cells) => {
  if (!cells.length) return { row: 0, col: 0 };
  const maxRow = Math.max(...cells.map((c) => c.row));
  const lastRowCells = cells.filter((c) => c.row === maxRow);
  if (lastRowCells.length < 2) return { row: maxRow, col: lastRowCells.length };
  return { row: maxRow + 1, col: 0 };
};
var CellConfigDrawer = ({ open, cell, tabId, config, onClose, onSave }) => {
  const [form] = Form.useForm();
  useEffect(() => {
    if (!cell || !tabId) return;
    const tab = config.tabs.find((t) => t.id === tabId);
    form.setFieldsValue({
      tabName: tab?.name ?? "",
      row: cell.row + 1,
      col: cell.col + 1,
      view_type: cell.view_type ?? "",
      html_style: cell.html_style ?? "",
      min_width: cell.min_width ?? "",
      max_width: cell.max_width ?? "",
      min_height: cell.min_height ?? "",
      max_height: cell.max_height ?? ""
    });
  }, [cell, tabId, config, form]);
  const handleSave = () => {
    if (!cell || !tabId) return;
    const values = form.getFieldsValue();
    const newTabName = (values.tabName || "").trim() || config.tabs.find((t) => t.id === tabId)?.name || "";
    const updatedCell = {
      ...cell,
      row: Math.max(0, (values.row ?? 1) - 1),
      col: Math.max(0, (values.col ?? 1) - 1),
      view_type: values.view_type || null,
      html_style: values.html_style ?? "",
      min_width: values.min_width || null,
      max_width: values.max_width || null,
      min_height: values.min_height || null,
      max_height: values.max_height || null
    };
    const currentTab = config.tabs.find((t) => t.id === tabId);
    const nameUnchanged = currentTab?.name.trim().toLowerCase() === newTabName.toLowerCase();
    const targetTab = !nameUnchanged ? config.tabs.find((t) => t.id !== tabId && t.name.trim().toLowerCase() === newTabName.toLowerCase()) : void 0;
    let nextTabs;
    if (nameUnchanged) {
      nextTabs = config.tabs.map((tab) => {
        if (tab.id !== tabId) return tab;
        return { ...tab, cells: tab.cells.map((c) => c.id === cell.id ? updatedCell : c) };
      });
    } else if (targetTab) {
      const { row, col } = nextGridPosition(targetTab.cells);
      const repositionedCell = { ...updatedCell, row, col };
      nextTabs = config.tabs.map((tab) => {
        if (tab.id === tabId) {
          return { ...tab, cells: tab.cells.filter((c) => c.id !== cell.id) };
        }
        if (tab.id === targetTab.id) {
          return { ...tab, cells: [...tab.cells, repositionedCell] };
        }
        return tab;
      }).filter((tab) => tab.cells.length > 0);
    } else {
      const { row, col } = nextGridPosition([]);
      const repositionedCell = { ...updatedCell, row, col };
      const newTab = {
        id: crypto.randomUUID(),
        name: newTabName,
        module: currentTab?.module ?? "dashboard",
        cells: [repositionedCell]
      };
      nextTabs = [
        ...config.tabs.map((tab) => {
          if (tab.id !== tabId) return tab;
          return { ...tab, cells: tab.cells.filter((c) => c.id !== cell.id) };
        }).filter((tab) => tab.cells.length > 0),
        newTab
      ];
    }
    onSave({ ...config, tabs: nextTabs });
    onClose();
  };
  const tabOptions = config.tabs.map((t) => ({ value: t.name, label: t.name }));
  return /* @__PURE__ */ jsx(
    Drawer,
    {
      title: `Configure cell: ${cell?.model ?? ""}`,
      placement: "right",
      width: 380,
      open,
      onClose,
      footer: /* @__PURE__ */ jsxs(Space, { style: { justifyContent: "flex-end", width: "100%", display: "flex" }, children: [
        /* @__PURE__ */ jsx(Button, { onClick: onClose, children: "Cancel" }),
        /* @__PURE__ */ jsx(Button, { type: "primary", onClick: handleSave, children: "Save" })
      ] }),
      children: /* @__PURE__ */ jsxs(Form, { form, layout: "vertical", size: "small", children: [
        /* @__PURE__ */ jsx(Divider, { orientation: "left", children: "Tab" }),
        /* @__PURE__ */ jsx(Form.Item, { name: "tabName", label: "Tab name", children: /* @__PURE__ */ jsx(
          AutoComplete,
          {
            options: tabOptions,
            filterOption: false,
            placeholder: "Select existing or type a new name"
          }
        ) }),
        /* @__PURE__ */ jsx(Divider, { orientation: "left", children: "Position" }),
        /* @__PURE__ */ jsxs(Space, { children: [
          /* @__PURE__ */ jsx(Form.Item, { name: "row", label: "Row", style: { marginBottom: 0 }, children: /* @__PURE__ */ jsx(InputNumber, { min: 1, style: { width: 80 } }) }),
          /* @__PURE__ */ jsx(Form.Item, { name: "col", label: "Column", style: { marginBottom: 0 }, children: /* @__PURE__ */ jsx(InputNumber, { min: 1, style: { width: 80 } }) })
        ] }),
        /* @__PURE__ */ jsx(Divider, { orientation: "left", children: "View" }),
        /* @__PURE__ */ jsx(Form.Item, { name: "view_type", label: "View type", children: /* @__PURE__ */ jsx(Select, { options: VIEW_TYPE_OPTIONS }) }),
        /* @__PURE__ */ jsx(Divider, { orientation: "left", children: "Size" }),
        /* @__PURE__ */ jsxs(Space, { wrap: true, children: [
          /* @__PURE__ */ jsx(Form.Item, { name: "min_width", label: "Min width", style: { marginBottom: 0 }, children: /* @__PURE__ */ jsx(Input, { placeholder: "e.g. 320px", style: { width: 130 } }) }),
          /* @__PURE__ */ jsx(Form.Item, { name: "max_width", label: "Max width", style: { marginBottom: 0 }, children: /* @__PURE__ */ jsx(Input, { placeholder: "e.g. 800px", style: { width: 130 } }) })
        ] }),
        /* @__PURE__ */ jsxs(Space, { wrap: true, style: { marginTop: 8 }, children: [
          /* @__PURE__ */ jsx(Form.Item, { name: "min_height", label: "Min height", style: { marginBottom: 0 }, children: /* @__PURE__ */ jsx(Input, { placeholder: "e.g. 300px", style: { width: 130 } }) }),
          /* @__PURE__ */ jsx(Form.Item, { name: "max_height", label: "Max height", style: { marginBottom: 0 }, children: /* @__PURE__ */ jsx(Input, { placeholder: "e.g. 600px", style: { width: 130 } }) })
        ] }),
        /* @__PURE__ */ jsx(Divider, { orientation: "left", children: "Style" }),
        /* @__PURE__ */ jsx(
          Form.Item,
          {
            name: "html_style",
            label: /* @__PURE__ */ jsxs(Text, { children: [
              "HTML style ",
              /* @__PURE__ */ jsx(Text, { type: "secondary", children: "(inline CSS)" })
            ] }),
            children: /* @__PURE__ */ jsx(
              Input.TextArea,
              {
                rows: 4,
                placeholder: "e.g. background-color: #f0f4ff; border-radius: 8px;",
                style: { fontFamily: "monospace", fontSize: 12 }
              }
            )
          }
        )
      ] })
    }
  );
};
var DashboardGridCell = ({ cell, allModels, isMaximized, isMinimized, onConfigure, onMaximize, onMinimize, onResize }) => {
  const { token } = theme.useToken();
  const model = findModelByName(allModels, cell.model);
  const cellRef = useRef(null);
  const cellStyle = {
    position: "relative",
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    background: token.colorBgContainer,
    ...cell.min_width ? { minWidth: cell.min_width } : {},
    ...cell.max_width ? { maxWidth: cell.max_width } : {},
    ...cell.min_height ? { minHeight: cell.min_height } : {},
    ...cell.max_height ? { maxHeight: cell.max_height } : {},
    ...cell.html_style ? parseInlineStyle3(cell.html_style) : {},
    ...isMaximized ? { gridColumn: "1 / -1" } : {},
    ...isMinimized ? { minHeight: 0 } : {}
  };
  const toolbarStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "2px 8px",
    gap: 2,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    background: token.colorBgContainer,
    flexShrink: 0,
    minHeight: 32,
    position: "relative"
  };
  const resource = model?.resource || cell.model;
  const cellTitle = model?.label || cell.model;
  const tone = model ? getModelTone(model) : null;
  const startResize = useCallback((e, dir) => {
    e.preventDefault();
    e.stopPropagation();
    const el = cellRef.current;
    if (!el) return;
    const { width: startW, height: startH } = el.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = dir === "s" ? "ns-resize" : dir === "e" ? "ew-resize" : "nwse-resize";
    const onMove = (ev) => {
      if (dir !== "e") el.style.minHeight = `${Math.max(200, Math.round(startH + ev.clientY - startY))}px`;
      if (dir !== "s") el.style.minWidth = `${Math.max(200, Math.round(startW + ev.clientX - startX))}px`;
    };
    const onUp = (ev) => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      document.body.style.cursor = prevCursor;
      const newH = dir !== "e" ? `${Math.max(200, Math.round(startH + ev.clientY - startY))}px` : null;
      const newW = dir !== "s" ? `${Math.max(200, Math.round(startW + ev.clientX - startX))}px` : null;
      onResize(newW, newH);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  }, [onResize]);
  const handleBase = {
    position: "absolute",
    zIndex: 10
  };
  return /* @__PURE__ */ jsxs("div", { ref: cellRef, style: cellStyle, className: "jm-dashboard-cell", children: [
    /* @__PURE__ */ jsx("style", { children: `
                .jm-dashboard-cell .jm-cell-actions  { opacity: 0; transition: opacity 0.15s; }
                .jm-dashboard-cell:hover .jm-cell-actions  { opacity: 1; }
                .jm-dashboard-cell .jm-resize-handle { opacity: 0; transition: opacity 0.15s; background: transparent; }
                .jm-dashboard-cell:hover .jm-resize-handle { opacity: 1; }
                .jm-resize-handle:hover { background: rgba(128,128,128,0.25) !important; }
                .jm-resize-handle:active { background: rgba(128,128,128,0.45) !important; }
            ` }),
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "jm-resize-handle",
        style: { ...handleBase, bottom: 0, left: 12, right: 12, height: 6, cursor: "ns-resize" },
        onPointerDown: (e) => startResize(e, "s")
      }
    ),
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "jm-resize-handle",
        style: { ...handleBase, top: 12, right: 0, bottom: 12, width: 6, cursor: "ew-resize" },
        onPointerDown: (e) => startResize(e, "e")
      }
    ),
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "jm-resize-handle",
        style: { ...handleBase, bottom: 0, right: 0, width: 12, height: 12, cursor: "nwse-resize", borderRadius: `0 0 ${token.borderRadiusLG}px 0` },
        onPointerDown: (e) => startResize(e, "se")
      }
    ),
    /* @__PURE__ */ jsxs("div", { style: toolbarStyle, children: [
      /* @__PURE__ */ jsx("span", { style: {
        fontSize: 14,
        fontWeight: 700,
        color: tone ? tone.solid : token.colorText,
        paddingLeft: 4,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        letterSpacing: "-0.01em"
      }, children: cellTitle }),
      /* @__PURE__ */ jsxs("div", { className: "jm-cell-actions", style: { display: "flex", alignItems: "center", gap: 2 }, children: [
        /* @__PURE__ */ jsx(Tooltip, { title: "Configure cell", children: /* @__PURE__ */ jsx(
          Button,
          {
            type: "text",
            size: "small",
            icon: /* @__PURE__ */ jsx(SettingOutlined, { style: { fontSize: 11 } }),
            onClick: onConfigure,
            style: { color: token.colorTextTertiary, padding: "0 4px", height: 22, minWidth: 22 }
          }
        ) }),
        /* @__PURE__ */ jsx(Tooltip, { title: "Open full page", children: /* @__PURE__ */ jsx(Link, { to: `/${resource}`, style: { color: token.colorTextTertiary, display: "flex", alignItems: "center", padding: "0 4px" }, children: /* @__PURE__ */ jsx(LinkOutlined, { style: { fontSize: 11 } }) }) }),
        /* @__PURE__ */ jsx(Tooltip, { title: isMaximized ? "Restore" : "Maximize", children: /* @__PURE__ */ jsx(
          Button,
          {
            type: "text",
            size: "small",
            icon: /* @__PURE__ */ jsx(FullscreenOutlined, { style: { fontSize: 11 } }),
            onClick: onMaximize,
            style: { color: token.colorTextTertiary, padding: "0 4px", height: 22, minWidth: 22 }
          }
        ) }),
        /* @__PURE__ */ jsx(Tooltip, { title: isMinimized ? "Restore" : "Minimize", children: /* @__PURE__ */ jsx(
          Button,
          {
            type: "text",
            size: "small",
            icon: /* @__PURE__ */ jsx(MinusSquareOutlined, { style: { fontSize: 11 } }),
            onClick: onMinimize,
            style: { color: token.colorTextTertiary, padding: "0 4px", height: 22, minWidth: 22 }
          }
        ) })
      ] })
    ] }),
    !isMinimized && /* @__PURE__ */ jsx("div", { style: { flex: 1, overflow: "auto", minHeight: 0 }, children: model ? /* @__PURE__ */ jsx(
      DynamicList,
      {
        model,
        allModels,
        isEmbedded: true,
        preferencesResourceOverride: `dashboard:${resource}`,
        defaultListVisible: Boolean(cell.view_type),
        listViewType: cell.view_type ? cell.view_type : model.listViewType
      },
      `${resource}-${cell.view_type ?? ""}`
    ) : /* @__PURE__ */ jsx(
      Empty,
      {
        description: `Model "${cell.model}" not found`,
        style: { padding: 24 },
        image: Empty.PRESENTED_IMAGE_SIMPLE
      }
    ) })
  ] });
};
var DashboardTabContent = ({ tab, allModels, maximizedCellId, minimizedCellIds, onMaximize, onMinimize, onConfigure, onResize }) => {
  const cells = tab.cells;
  const numCols = useMemo(() => {
    if (!cells.length) return 2;
    return Math.max(...cells.map((c) => c.col)) + 1;
  }, [cells]);
  const numRows = useMemo(() => {
    if (!cells.length) return 1;
    return Math.max(...cells.map((c) => c.row)) + 1;
  }, [cells]);
  const visibleCells = maximizedCellId ? cells.filter((c) => c.id === maximizedCellId) : cells;
  const gridStyle = {
    display: "grid",
    gridTemplateColumns: maximizedCellId ? "1fr" : `repeat(${numCols}, 1fr)`,
    gridTemplateRows: maximizedCellId ? "1fr" : `repeat(${numRows}, minmax(320px, auto))`,
    gap: 12,
    padding: 12,
    height: "100%",
    boxSizing: "border-box"
  };
  if (!cells.length) {
    return /* @__PURE__ */ jsx(Empty, { description: "No models in this tab", style: { padding: 48 } });
  }
  return /* @__PURE__ */ jsx("div", { style: gridStyle, children: visibleCells.map((cell) => /* @__PURE__ */ jsx(
    "div",
    {
      style: {
        gridColumn: maximizedCellId ? "1 / -1" : `${cell.col + 1}`,
        gridRow: maximizedCellId ? "1 / -1" : `${cell.row + 1}`
      },
      children: /* @__PURE__ */ jsx(
        DashboardGridCell,
        {
          cell,
          allModels,
          isMaximized: maximizedCellId === cell.id,
          isMinimized: minimizedCellIds.has(cell.id),
          onConfigure: () => onConfigure(cell),
          onMaximize: () => onMaximize(cell.id),
          onMinimize: () => onMinimize(cell.id),
          onResize: (w, h) => onResize(cell.id, w, h)
        }
      )
    },
    cell.id
  )) });
};
var ViewsGrid = ({ config, allModels, onConfigChange }) => {
  const [maximizedCellId, setMaximizedCellId] = useState(null);
  const [minimizedCellIds, setMinimizedCellIds] = useState(/* @__PURE__ */ new Set());
  const [drawerSelection, setDrawerSelection] = useState(null);
  const handleMaximize = useCallback((cellId) => {
    setMaximizedCellId((prev) => prev === cellId ? null : cellId);
  }, []);
  const handleMinimize = useCallback((cellId) => {
    setMinimizedCellIds((prev) => {
      const next = new Set(prev);
      if (next.has(cellId)) {
        next.delete(cellId);
      } else {
        next.add(cellId);
      }
      return next;
    });
  }, []);
  const handleOpenDrawer = useCallback((tabId, cell) => {
    setDrawerSelection({ tabId, cell });
  }, []);
  const handleSaveConfig = useCallback((nextConfig) => {
    onConfigChange(nextConfig);
    setDrawerSelection(null);
  }, [onConfigChange]);
  const handleResizeCell = useCallback((tabId, cellId, minWidth, minHeight) => {
    const nextTabs = config.tabs.map((tab) => {
      if (tab.id !== tabId) return tab;
      return {
        ...tab,
        cells: tab.cells.map((c) => {
          if (c.id !== cellId) return c;
          return {
            ...c,
            ...minWidth !== null ? { min_width: minWidth } : {},
            ...minHeight !== null ? { min_height: minHeight } : {}
          };
        })
      };
    });
    onConfigChange({ ...config, tabs: nextTabs });
  }, [config, onConfigChange]);
  const tabItems = useMemo(
    () => config.tabs.map((tab) => ({
      key: tab.id,
      label: tab.name,
      children: /* @__PURE__ */ jsx(
        DashboardTabContent,
        {
          tab,
          allModels,
          maximizedCellId,
          minimizedCellIds,
          onMaximize: handleMaximize,
          onMinimize: handleMinimize,
          onConfigure: (cell) => handleOpenDrawer(tab.id, cell),
          onResize: (cellId, w, h) => handleResizeCell(tab.id, cellId, w, h)
        }
      )
    })),
    [config.tabs, allModels, maximizedCellId, minimizedCellIds, handleMaximize, handleMinimize, handleOpenDrawer, handleResizeCell]
  );
  if (!config.tabs.length) {
    return /* @__PURE__ */ jsx(Empty, { description: "No tabs configured. Run veloiq add-dashboard to add models.", style: { padding: 48 } });
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      Tabs,
      {
        items: tabItems,
        onChange: () => {
          setMaximizedCellId(null);
          setMinimizedCellIds(/* @__PURE__ */ new Set());
        },
        style: { height: "100%" },
        tabBarStyle: { paddingLeft: 12, marginBottom: 0 }
      }
    ),
    /* @__PURE__ */ jsx(
      CellConfigDrawer,
      {
        open: Boolean(drawerSelection),
        cell: drawerSelection?.cell ?? null,
        tabId: drawerSelection?.tabId ?? null,
        config,
        onClose: () => setDrawerSelection(null),
        onSave: handleSaveConfig
      }
    )
  ] });
};
function parseInlineStyle3(cssText) {
  const result = {};
  cssText.split(";").forEach((declaration) => {
    const idx = declaration.indexOf(":");
    if (idx < 0) return;
    const prop = declaration.slice(0, idx).trim();
    const value = declaration.slice(idx + 1).trim();
    if (!prop || !value) return;
    const camel = prop.replace(/-([a-z])/g, (_39, c) => c.toUpperCase());
    result[camel] = value;
  });
  return result;
}
function useRecentActivity(days) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = days !== void 0 ? `?days=${days}` : "";
      const res = await authenticatedFetch(`${API_URL3}/dashboard/recent-activity${params}`);
      if (res.ok) setData(await res.json());
    } catch {
    } finally {
      setLoading(false);
    }
  }, [days]);
  useEffect(() => {
    load();
  }, [load]);
  return { data, loading, reload: load };
}
var { Text: Text2, Title: Title9 } = Typography;
function relativeTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 6e4);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
var RecentActivityPanel = () => {
  const { token } = theme.useToken();
  const allModels = useAllModels();
  const [days, setDays] = useState(30);
  const { data, loading, reload } = useRecentActivity(days);
  const groups = data?.groups ?? [];
  return /* @__PURE__ */ jsxs("div", { style: { padding: "16px 0" }, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20, paddingLeft: 4 }, children: [
      /* @__PURE__ */ jsx(Text2, { type: "secondary", children: "Show activity from the last" }),
      /* @__PURE__ */ jsx(
        InputNumber,
        {
          min: 1,
          max: 365,
          value: days,
          onChange: (v) => v && setDays(v),
          style: { width: 72 },
          size: "small"
        }
      ),
      /* @__PURE__ */ jsx(Text2, { type: "secondary", children: "days" }),
      /* @__PURE__ */ jsx(Tooltip, { title: "Refresh", children: /* @__PURE__ */ jsx(
        ReloadOutlined,
        {
          style: { color: token.colorTextTertiary, cursor: "pointer", fontSize: 13 },
          onClick: reload
        }
      ) }),
      data && /* @__PURE__ */ jsxs(Text2, { type: "secondary", style: { fontSize: 12 }, children: [
        groups.reduce((n, g) => n + g.records.length, 0),
        " records across ",
        groups.length,
        " models"
      ] })
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "center", padding: 48 }, children: /* @__PURE__ */ jsx(Spin, {}) }) : groups.length === 0 ? /* @__PURE__ */ jsx(
      Empty,
      {
        description: `No activity in the last ${days} days`,
        image: Empty.PRESENTED_IMAGE_SIMPLE,
        style: { padding: 48 }
      }
    ) : /* @__PURE__ */ jsx(Space, { direction: "vertical", size: 24, style: { width: "100%" }, children: groups.map((group) => {
      const model = findModelByName(allModels, group.resource);
      const tone = getModelTone(model?.name ?? group.resource);
      const label = model?.label ?? group.model_name;
      return /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("div", { style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
          paddingBottom: 6,
          borderBottom: `2px solid ${tone.solid}40`
        }, children: [
          /* @__PURE__ */ jsx("div", { style: {
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: tone.solid,
            flexShrink: 0
          } }),
          /* @__PURE__ */ jsx(Title9, { level: 5, style: { margin: 0, color: tone.text }, children: label }),
          /* @__PURE__ */ jsx(Tag, { color: tone.solid, style: { marginLeft: "auto", fontSize: 11 }, children: group.records.length })
        ] }),
        /* @__PURE__ */ jsx(
          List$1,
          {
            size: "small",
            dataSource: group.records,
            renderItem: (rec) => {
              const timestamp = rec.updated_at || rec.created_at;
              const isNew = rec.created_at === rec.updated_at;
              return /* @__PURE__ */ jsxs(
                List$1.Item,
                {
                  style: {
                    padding: "4px 8px",
                    borderRadius: token.borderRadius,
                    transition: "background 0.15s"
                  },
                  className: "jm-activity-row",
                  children: [
                    /* @__PURE__ */ jsx("style", { children: `
                                                    .jm-activity-row:hover { background: ${token.colorFillAlter}; }
                                                ` }),
                    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, width: "100%" }, children: [
                      /* @__PURE__ */ jsx(ClockCircleOutlined, { style: { color: token.colorTextTertiary, fontSize: 11, flexShrink: 0 } }),
                      /* @__PURE__ */ jsx(
                        Link,
                        {
                          to: `/${group.resource}/show/${rec.id}`,
                          style: { flex: 1, color: token.colorText, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                          children: rec._label || `#${rec.id}`
                        }
                      ),
                      isNew && /* @__PURE__ */ jsx(Tag, { color: "green", style: { fontSize: 10, padding: "0 4px", lineHeight: "16px" }, children: "new" }),
                      /* @__PURE__ */ jsx(Text2, { type: "secondary", style: { fontSize: 11, flexShrink: 0 }, children: relativeTime(timestamp) })
                    ] })
                  ]
                }
              );
            }
          }
        )
      ] }, group.resource);
    }) })
  ] });
};
var { Text: AntText, Title: AntTitle } = Typography;
function usePinnedRecords() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`${API_URL3}/dashboard/pinned-records`);
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups ?? []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);
  React6.useEffect(() => {
    load();
  }, [load]);
  return { groups, loading, reload: load };
}
var PinnedRecordsPanel = () => {
  const { token } = theme.useToken();
  const allModels = useAllModels();
  const { groups, loading, reload } = usePinnedRecords();
  const [unpinning, setUnpinning] = useState(/* @__PURE__ */ new Set());
  const visibleGroups = groups.filter((g) => findModelByName(allModels, g.resource));
  const handleUnpin = useCallback(async (resource, recordId) => {
    const key = `${resource}:${recordId}`;
    setUnpinning((prev) => new Set(prev).add(key));
    try {
      await unpinRecords(resource, [recordId]);
      await reload();
    } finally {
      setUnpinning((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [reload]);
  return /* @__PURE__ */ jsxs("div", { style: { padding: "16px 0" }, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20, paddingLeft: 4 }, children: [
      /* @__PURE__ */ jsx(PushpinFilled, { style: { color: "#faad14", fontSize: 14 } }),
      /* @__PURE__ */ jsx(AntText, { type: "secondary", children: "Records you've pinned across the app" }),
      /* @__PURE__ */ jsx(Tooltip, { title: "Refresh", children: /* @__PURE__ */ jsx(
        ReloadOutlined,
        {
          style: { color: token.colorTextTertiary, cursor: "pointer", fontSize: 13 },
          onClick: reload
        }
      ) }),
      !loading && /* @__PURE__ */ jsxs(AntText, { type: "secondary", style: { fontSize: 12 }, children: [
        visibleGroups.reduce((n, g) => n + g.records.length, 0),
        " pins across ",
        visibleGroups.length,
        " models"
      ] })
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "center", padding: 48 }, children: /* @__PURE__ */ jsx(Spin, {}) }) : visibleGroups.length === 0 ? /* @__PURE__ */ jsx(
      Empty,
      {
        description: /* @__PURE__ */ jsxs("span", { children: [
          "No pinned records yet.",
          /* @__PURE__ */ jsx("br", {}),
          /* @__PURE__ */ jsxs(AntText, { type: "secondary", style: { fontSize: 12 }, children: [
            "Open any record and click the ",
            /* @__PURE__ */ jsx(PushpinOutlined, {}),
            " pin button to pin it here."
          ] })
        ] }),
        image: Empty.PRESENTED_IMAGE_SIMPLE,
        style: { padding: 48 }
      }
    ) : /* @__PURE__ */ jsx(Space, { direction: "vertical", size: 24, style: { width: "100%" }, children: visibleGroups.map((group) => {
      const model = findModelByName(allModels, group.resource);
      const tone = getModelTone(model?.name ?? group.resource);
      const label = model?.label ?? group.model_name;
      return /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("div", { style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
          paddingBottom: 6,
          borderBottom: `2px solid ${tone.solid}40`
        }, children: [
          /* @__PURE__ */ jsx("div", { style: {
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: tone.solid,
            flexShrink: 0
          } }),
          /* @__PURE__ */ jsx(AntTitle, { level: 5, style: { margin: 0, color: tone.text }, children: label }),
          /* @__PURE__ */ jsx(Tag, { color: tone.solid, style: { marginLeft: "auto", fontSize: 11 }, children: group.records.length })
        ] }),
        /* @__PURE__ */ jsx(
          List$1,
          {
            size: "small",
            dataSource: group.records,
            renderItem: (rec) => {
              const key = `${group.resource}:${rec.id}`;
              return /* @__PURE__ */ jsxs(
                List$1.Item,
                {
                  style: {
                    padding: "4px 8px",
                    borderRadius: token.borderRadius,
                    transition: "background 0.15s"
                  },
                  className: "jm-pin-row",
                  children: [
                    /* @__PURE__ */ jsx("style", { children: `
                                                    .jm-pin-row:hover { background: ${token.colorFillAlter}; }
                                                    .jm-pin-row .jm-unpin-btn { opacity: 0; transition: opacity 0.15s; }
                                                    .jm-pin-row:hover .jm-unpin-btn { opacity: 1; }
                                                ` }),
                    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, width: "100%" }, children: [
                      /* @__PURE__ */ jsx(PushpinFilled, { style: { color: "#faad14", fontSize: 11, flexShrink: 0 } }),
                      /* @__PURE__ */ jsx(
                        Link,
                        {
                          to: `/${group.resource}/show/${rec.id}`,
                          style: { flex: 1, color: token.colorText, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                          children: rec._label || `#${rec.id}`
                        }
                      ),
                      /* @__PURE__ */ jsx(Tooltip, { title: "Unpin", children: /* @__PURE__ */ jsx(
                        Button,
                        {
                          className: "jm-unpin-btn",
                          type: "text",
                          size: "small",
                          icon: /* @__PURE__ */ jsx(PushpinFilled, { style: { color: "#faad14" } }),
                          loading: unpinning.has(key),
                          onClick: () => handleUnpin(group.resource, rec.id),
                          style: { color: token.colorTextTertiary, height: 20, minWidth: 20, padding: "0 4px" }
                        }
                      ) })
                    ] })
                  ]
                }
              );
            }
          }
        )
      ] }, group.resource);
    }) })
  ] });
};
var { Text: Text3 } = Typography;
var _38 = window._ || ((text) => text);
var DashboardPage = () => {
  const { token } = theme.useToken();
  const allModels = useAllModels();
  const { config, enabled, loading, save } = useDashboardConfig();
  if (loading) {
    return /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "center", padding: 64 }, children: /* @__PURE__ */ jsx(Spin, {}) });
  }
  if (!enabled || !config) {
    return /* @__PURE__ */ jsx("div", { style: { padding: 48 }, children: /* @__PURE__ */ jsx(
      Empty,
      {
        image: /* @__PURE__ */ jsx(DashboardOutlined, { style: { fontSize: 48, color: token.colorTextTertiary } }),
        imageStyle: { height: 60 },
        description: /* @__PURE__ */ jsxs("span", { children: [
          "No dashboard configured.",
          /* @__PURE__ */ jsx("br", {}),
          /* @__PURE__ */ jsxs(Text3, { type: "secondary", children: [
            "Run ",
            /* @__PURE__ */ jsx("code", { children: "veloiq add-dashboard <model> \u2026" }),
            " to get started."
          ] })
        ] })
      }
    ) });
  }
  const tabs = [
    {
      key: "models_grid",
      label: _38("Models Grid"),
      children: /* @__PURE__ */ jsx("div", { style: { height: "calc(100vh - 140px)", overflow: "auto" }, children: /* @__PURE__ */ jsx(
        ViewsGrid,
        {
          config,
          allModels,
          onConfigChange: save
        }
      ) })
    },
    {
      key: "recent_activity",
      label: _38("Recent Activity"),
      children: /* @__PURE__ */ jsx("div", { style: { height: "calc(100vh - 140px)", overflow: "auto", padding: "0 12px" }, children: /* @__PURE__ */ jsx(RecentActivityPanel, {}) })
    },
    {
      key: "pinned_records",
      label: _38("Pinned Records"),
      children: /* @__PURE__ */ jsx("div", { style: { height: "calc(100vh - 140px)", overflow: "auto", padding: "0 12px" }, children: /* @__PURE__ */ jsx(PinnedRecordsPanel, {}) })
    }
  ];
  return /* @__PURE__ */ jsx("div", { style: { padding: "0 16px", height: "100%" }, children: /* @__PURE__ */ jsx(
    Tabs,
    {
      items: tabs,
      tabBarStyle: { marginBottom: 0 }
    }
  ) });
};

// src/utils/generateResources.ts
function generateResources(models, moduleName, options = {}) {
  const { icon, hideRelations = true, moduleLabel } = options;
  const parentKey = `module:${moduleName}`;
  const parentLabel = moduleLabel || moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  const parentEntry = {
    name: parentKey,
    list: "",
    create: "",
    edit: "",
    show: "",
    meta: {
      canDelete: false,
      label: parentLabel,
      hide: false,
      icon
    }
  };
  const children = (models || []).map((model) => {
    const resource = model.resource || model.name;
    const isRelation = hideRelations && (resource.toLowerCase().endsWith("_relation") || resource.toLowerCase().endsWith("_rela") || Array.isArray(model.fields) && model.fields.some((f) => f?.key === "eid_from") && model.fields.some((f) => f?.key === "eid_to"));
    return {
      name: resource,
      list: `/${resource}`,
      create: `/${resource}/create`,
      edit: `/${resource}/edit/:id`,
      show: `/${resource}/show/:id`,
      meta: {
        canDelete: true,
        label: model.label || model.name,
        hide: Boolean(model.hideInMenu) || isRelation,
        parent: parentKey,
        icon
      }
    };
  });
  return [parentEntry, ...children];
}

// src/models/authModels.ts
var authSystemModels = [
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
          { label: "Suspended", value: "Suspended" }
        ],
        valueColors: { Active: "#52c41a", Inactive: "#d9d9d9", Suspended: "#ff4d4f" }
      }
    ],
    relations: [
      {
        resource: "role",
        resourcePath: "user_role",
        targetKey: "user_id",
        otherKey: "role_id",
        otherResource: "role",
        label: "Roles"
      },
      {
        resource: "tenant",
        resourcePath: "user_tenant",
        targetKey: "user_id",
        otherKey: "tenant_id",
        otherResource: "tenant",
        label: "Tenants"
      }
    ]
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
      { key: "allowed_methods", label: "Allowed Methods", type: "string", readRoles: ["Admin"], writeRoles: ["Admin"], description: 'JSON array of permitted HTTP methods, e.g. ["GET","POST","PUT","PATCH","DELETE"]' },
      { key: "is_preset", label: "Is Preset", type: "boolean", readRoles: ["Admin"], writeRoles: ["Admin"], description: "Preset roles are seeded from code on startup and appear in the Roles UI as built-in." }
    ],
    relations: [
      {
        resource: "user",
        resourcePath: "user_role",
        targetKey: "role_id",
        otherKey: "user_id",
        otherResource: "user",
        label: "Users"
      }
    ]
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
          { label: "Suspended", value: "Suspended" }
        ],
        valueColors: { Active: "#52c41a", Suspended: "#ff4d4f" }
      }
    ],
    relations: [
      {
        resource: "user",
        resourcePath: "user_tenant",
        targetKey: "tenant_id",
        otherKey: "user_id",
        otherResource: "user",
        label: "Users"
      }
    ]
  }
];

export { API_URL3 as API_URL, AllModelsProvider, ColorModeContext, ColorModeContextProvider, CustomSider, DashboardPage, DynamicCreate, DynamicEdit, DynamicList, DynamicShow, ExecutableHtml, GlobalSearch, HierarchyView, HorizontalMenu, InlinePlotlyHtml, LayoutWrapper, LoginPage, ModelHeading, MultiPaneLayout, PaneNavigationContext, PinnedRecordsPanel, PrimaryShowContext, RecentActivityPanel, ReferenceField, ResourceContext, ShowFooterButtons, StandardList, StandardShow, ViewsGrid, accessControlProvider, authProvider, authSystemModels, authenticatedFetch, buildShowTabFormOptions, generateResources, getModelTone, httpClient, normalizeToneKey, renderRelationBlock, setColorSchemas, useAllModels, useKeyboardShortcuts, useMetadataModal, usePaneNavigation, useShowActionsPreferences, useShowEditableForm, useStandardShowTabs };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map