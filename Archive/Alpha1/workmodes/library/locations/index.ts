// src/workmodes/library/locations/index.ts
// Aggregated exports for location entity

export { locationSpec } from "./create-spec";
export type { LocationData, LocationType, OwnerType } from "./location-types";
export { isDungeonLocation, isBuildingLocation } from "./location-types";
// Removed: export { locationToMarkdown } from "./serializer";
export { buildLocationTree, flattenTree, findNodeByName, buildBreadcrumbs } from "./tree-builder";
export type { LocationTreeNode } from "./tree-builder";
export { LocationTreeView, renderLocationTree } from "./tree-view";
export type { TreeViewOptions } from "./tree-view";
export { LocationBreadcrumb, renderLocationBreadcrumbs } from "./breadcrumb";
export type { BreadcrumbOptions } from "./breadcrumb";
