// AUTO-GENERATED — do not edit. Run `veloiq generate` to update.
// Extension-contributed routes and user-menu items.
import { createElement } from "react";
import { BranchesOutlined, KeyOutlined, ToolOutlined } from "@ant-design/icons";
import vigilantiq_LicenseManagement from "./pages/vigilantiq/LicenseManagement";
import vigilantiq_JourneyBuilder from "./pages/vigilantiq/JourneyBuilder";
import vigilantiq_PageConfigTool from "./pages/vigilantiq/PageConfigTool";
import vigilantiq_JourneyRunner from "./pages/vigilantiq/JourneyRunner";

export interface ExtensionRoute { path: string; element: React.ReactNode; }
export const extensionRoutes: ExtensionRoute[] = [
  { path: "/vigilantiq-license", element: createElement(vigilantiq_LicenseManagement) },
  { path: "/journeys", element: createElement(vigilantiq_JourneyBuilder) },
  { path: "/pageconfig", element: createElement(vigilantiq_PageConfigTool) },
  { path: "/journey-run/:journeyId", element: createElement(vigilantiq_JourneyRunner) },
];

export interface ExtensionUserMenuItem { key: string; label: string; icon?: React.ReactNode; onClick: () => void; }
export const extensionUserMenuItems: ExtensionUserMenuItem[] = [
  { key: "vigilantiq-journeys", label: "Journey Builder", icon: createElement(BranchesOutlined), onClick: () => { window.location.assign("/journeys"); } },
  { key: "vigilantiq-pageconfig", label: "Page Configuration Tool", icon: createElement(ToolOutlined), onClick: () => { window.location.assign("/pageconfig"); } },
  { key: "vigilantiq-license", label: "VigilantIQ Licensing", icon: createElement(KeyOutlined), onClick: () => { window.location.assign("/vigilantiq-license"); } },
];
