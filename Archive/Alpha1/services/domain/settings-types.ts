// src/services/domain/settings-types.ts
// Domain types for plugin settings
// Located in services layer to avoid layer violations

/**
 * Layer configuration for cartographer
 * Simplified type to avoid importing from workmodes
 */
export interface LayerConfig {
    id: string;
    visible: boolean;
}

/**
 * Plugin settings structure
 * Located in services domain to be accessible by all layers
 */
export interface SaltMarcherSettings {
    cartographer?: {
        layerConfig?: LayerConfig[];
        layerPanelVisible?: boolean;
        layerPanelCollapsed?: boolean;
    };
    sessionRunner?: {
        leftSidebarCollapsed?: boolean;
        rightSidebarCollapsed?: boolean;
        defaultPartyLevel?: number;
        defaultPartySize?: number;
        panels?: {
            weather?: { expanded?: boolean };
            calendar?: { expanded?: boolean };
            hexInfo?: { expanded?: boolean };
            controls?: { expanded?: boolean };
            speed?: { expanded?: boolean };
            party?: { expanded?: boolean };
        };
    };
}