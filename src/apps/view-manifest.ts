// src/apps/view-manifest.ts
// Centralises view metadata so plugin wiring can be generated from one source.
import type { App, ItemView, WorkspaceLeaf } from "obsidian";
import { CartographerView, VIEW_CARTOGRAPHER, openCartographer } from "./cartographer";
import { EncounterView, VIEW_ENCOUNTER, openEncounter } from "./encounter/view";
import { LibraryView, VIEW_LIBRARY, openLibrary } from "./library/view";
import { AtlasView, VIEW_ATLAS, openAtlas } from "./atlas";
import { AlmanacView, VIEW_ALMANAC, openAlmanac } from "./almanac";
import { SessionRunnerView, VIEW_SESSION_RUNNER, openSessionRunner } from "./session-runner";
import type { IntegrationId } from "../app/integration-telemetry";

export interface ViewActivationManifest {
    /**
     * Opens/activates the view in the workspace. Shared by ribbons and
     * commands so that behaviour stays aligned across entry points.
     */
    open: (app: App) => Promise<void>;
    ribbon?: {
        /** Icon shown in the ribbon. */
        icon: string;
        /** Tooltip displayed to the user. */
        title: string;
    };
    commands?: Array<{
        /** Stable command identifier. */
        id: string;
        /** User-facing command name. */
        name: string;
    }>;
}

export interface ViewManifestEntry<TView extends ItemView = ItemView> {
    /** Obsidian view type identifier. */
    viewType: string;
    /** Integration identifier used for telemetry/error reporting. */
    integrationId: IntegrationId;
    /** Human-readable display name. */
    displayName: string;
    /** Icon identifier returned by the view. */
    viewIcon: string;
    /** Factory for the view instance. */
    createView: (leaf: WorkspaceLeaf) => TView;
    /** Optional activation metadata (ribbon + commands). */
    activation?: ViewActivationManifest;
}

export const VIEW_MANIFEST: ReadonlyArray<ViewManifestEntry> = [
    {
        viewType: VIEW_CARTOGRAPHER,
        integrationId: "obsidian:cartographer-view",
        displayName: "Cartographer",
        viewIcon: "compass",
        createView: (leaf) => new CartographerView(leaf),
        activation: {
            open: (app) => openCartographer(app),
            ribbon: {
                icon: "compass",
                title: "Open Cartographer",
            },
            commands: [
                {
                    id: "open-cartographer",
                    name: "Open Cartographer",
                },
            ],
        },
    },
    {
        viewType: VIEW_SESSION_RUNNER,
        integrationId: "obsidian:session-runner-view",
        displayName: "Session Runner",
        viewIcon: "play",
        createView: (leaf) => new SessionRunnerView(leaf),
        activation: {
            open: (app) => openSessionRunner(app),
            ribbon: {
                icon: "play",
                title: "Open Session Runner",
            },
            commands: [
                {
                    id: "open-session-runner",
                    name: "Open Session Runner",
                },
            ],
        },
    },
    {
        viewType: VIEW_ENCOUNTER,
        integrationId: "obsidian:encounter-view",
        displayName: "Encounter",
        viewIcon: "swords",
        createView: (leaf) => new EncounterView(leaf),
        activation: {
            open: (app) => openEncounter(app),
            ribbon: {
                icon: "swords",
                title: "Open Encounter Calculator",
            },
            commands: [
                {
                    id: "open-encounter",
                    name: "Open Encounter Calculator",
                },
            ],
        },
    },
    {
        viewType: VIEW_LIBRARY,
        integrationId: "obsidian:library-view",
        displayName: "Library",
        viewIcon: "library",
        createView: (leaf) => new LibraryView(leaf),
        activation: {
            open: (app) => openLibrary(app),
            ribbon: {
                icon: "book",
                title: "Open Library",
            },
            commands: [
                {
                    id: "open-library",
                    name: "Open Library",
                },
            ],
        },
    },
    {
        viewType: VIEW_ATLAS,
        integrationId: "obsidian:atlas-view",
        displayName: "Atlas",
        viewIcon: "map",
        createView: (leaf) => new AtlasView(leaf),
        activation: {
            open: (app) => openAtlas(app),
            ribbon: {
                icon: "map",
                title: "Open Atlas",
            },
            commands: [
                {
                    id: "open-atlas",
                    name: "Open Atlas",
                },
            ],
        },
    },
    {
        viewType: VIEW_ALMANAC,
        integrationId: "obsidian:almanac-view",
        displayName: "Almanac",
        viewIcon: "calendar",
        createView: (leaf) => new AlmanacView(leaf),
        activation: {
            open: (app) => openAlmanac(app),
            ribbon: {
                icon: "calendar",
                title: "Open Almanac (MVP)",
            },
            commands: [
                {
                    id: "open-almanac",
                    name: "Open Almanac",
                },
            ],
        },
    },
] as const;
