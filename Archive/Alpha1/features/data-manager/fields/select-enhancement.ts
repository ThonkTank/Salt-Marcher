// src/features/data-manager/fields/select-enhancement.ts
// Facade for select dropdown enhancement functionality
//
// This module isolates the external dependency on ui/components/search-dropdown,
// providing a single point of control for select field enhancement.
// Makes it easier to replace or mock the implementation in the future.

export { enhanceSelectToSearch } from "@ui/components/search-dropdown";
