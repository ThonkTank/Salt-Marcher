// src/ui/copy.ts
// Centralises authoritative UI copy for shared components.
// Keep the terms aligned with `docs/ui/terminology.md`.

export const SEARCH_DROPDOWN_COPY = {
    placeholder: "Search…",
} as const;

export const MODAL_COPY = {
    nameInput: {
        placeholder: "New hex map",
        title: "Name the new map",
        cta: "Create",
    },
    mapSelect: {
        placeholder: "Search maps…",
    },
} as const;

export const MAP_WORKFLOWS_COPY = {
    notices: {
        emptyMaps: "No maps available.",
        createSuccess: "Map created.",
        missingHexBlock: "No hex3x3 block found in this file.",
    },
} as const;

export const MAP_HEADER_COPY = {
    labels: {
        open: "Open map",
        create: "Create",
        delete: "Delete",
        save: "Save",
        saveAs: "Save as",
        trigger: "Apply",
    },
    notices: {
        missingFile: "Select a map before continuing.",
        saveSuccess: "Map saved.",
        saveError: "Saving the map failed.",
    },
    selectPlaceholder: "Choose a save action…",
} as const;

export const CONFIRM_DELETE_COPY = {
    title: "Delete map?",
    body: (name: string) =>
        `This will delete your map permanently. To continue, enter “${name}”.`,
    inputPlaceholder: (name: string) => name,
    buttons: {
        cancel: "Cancel",
        confirm: "Delete",
    },
    notices: {
        success: "Map deleted.",
        error: "Deleting map failed.",
    },
} as const;
