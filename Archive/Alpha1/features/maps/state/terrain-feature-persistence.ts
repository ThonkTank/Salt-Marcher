// src/features/maps/state/terrain-feature-persistence.ts

import type { App} from "obsidian";
import { TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("terrain-feature-persistence");
import type {
    TerrainFeature,
    TerrainFeatureType,
} from "./terrain-feature-types";

/**
 * Terrain Feature Persistence
 *
 * Handles loading and saving terrain features from/to disk.
 * - Load features from markdown files
 * - Save features to markdown files
 * - Parse feature sections
 * - Serialize features to markdown format
 */

/**
 * Load terrain features from disk
 *
 * Features are stored in a separate file: {MapName}-features.md
 * Format: YAML frontmatter with feature definitions
 */
export async function loadFeaturesFromDisk(
    app: App,
    mapPath: string
): Promise<Map<string, TerrainFeature>> {
    const featurePath = mapPath.replace(/\.md$/i, "-features.md");
    const featureFile = app.vault.getAbstractFileByPath(featurePath);

    if (!(featureFile instanceof TFile)) {
        // No features file exists yet - that's okay
        return new Map();
    }

    const features = new Map<string, TerrainFeature>();

    try {
        const content = await app.vault.cachedRead(featureFile);
        const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);

        if (!frontmatterMatch) {
            return features;
        }

        // Parse features from markdown body
        // Extract body content (after frontmatter)
        const bodyMatch = content.match(/^---\n[\s\S]+?\n---\n\n([\s\S]+)$/);
        if (!bodyMatch) {
            return features;
        }

        const body = bodyMatch[1];

        // Parse each feature section
        // Format: ### {type}: {name}\n- Type: ...\n- Path: ...\n...
        const featureSections = body.split(/\n### /).filter(s => s.trim());

        for (const section of featureSections) {
            try {
                const feature = parseFeatureSection(section);
                if (feature) {
                    features.set(feature.id, feature);
                }
            } catch (sectionError) {
                logger.error("Failed to parse feature section:", sectionError);
            }
        }
    } catch (error) {
        // Failed to load - log but continue
        logger.error("Failed to load features:", error);
    }

    return features;
}

/**
 * Parse a single feature section from markdown
 */
function parseFeatureSection(section: string): TerrainFeature | null {
    // Parse header line: "river: River Name" or just "### river: River Name"
    const lines = section.split('\n').filter(l => l.trim());
    if (lines.length === 0) return null;

    const headerMatch = lines[0].match(/^(.+?):\s*(.+)$/);
    if (!headerMatch) return null;

    const [, typeStr, name] = headerMatch;
    const type = typeStr.trim() as TerrainFeatureType;

    // Parse properties
    let pathJson: string | undefined;  // Old format (hexes)
    let cornersJson: string | undefined;  // New format (corners)
    let color: string | undefined;
    let width: number | undefined;
    let dashArray: string | undefined;
    let description: string | undefined;

    for (const line of lines.slice(1)) {
        const propMatch = line.match(/^-\s*(\w+):\s*(.+)$/);
        if (!propMatch) continue;

        const [, key, value] = propMatch;
        switch (key) {
            case 'Path':
                pathJson = value.trim();
                break;
            case 'Corners':
                cornersJson = value.trim();
                break;
            case 'Color':
                color = value.trim();
                break;
            case 'Width':
                width = Number(value.trim());
                break;
            case 'DashArray':
                dashArray = value.trim();
                break;
            case 'Description':
                description = value.trim();
                break;
        }
    }

    // Validate required fields (need either Path or Corners)
    if ((!pathJson && !cornersJson) || !color || width === undefined) {
        logger.warn("Skipping feature with missing required fields:", section.substring(0, 100));
        return null;
    }

    // Parse path JSON (either corners or hexes)
    let hexes: Array<{ r: number; c: number }> | undefined;
    let corners: Array<{ r: number; c: number; corner: 0 | 1 | 2 | 3 | 4 | 5 }> | undefined;

    try {
        if (cornersJson) {
            // New format: corner-based
            corners = JSON.parse(cornersJson);
            if (!Array.isArray(corners) || corners.length === 0) {
                logger.warn("Invalid corners format:", cornersJson);
                return null;
            }
        } else if (pathJson) {
            // Old format: hex-based
            hexes = JSON.parse(pathJson);
            if (!Array.isArray(hexes) || hexes.length === 0) {
                logger.warn("Invalid path format:", pathJson);
                return null;
            }
        }
    } catch (parseError) {
        logger.warn("Failed to parse path/corners JSON:", pathJson || cornersJson);
        return null;
    }

    // Generate ID
    const { generateFeatureId } = require("./terrain-feature-types");
    const id = generateFeatureId(type);

    // Create feature (with either corners or hexes)
    const feature: TerrainFeature = {
        id,
        type,
        path: corners ? { corners } : { hexes },
        style: {
            color,
            width,
            dashArray: dashArray || undefined,
        },
        metadata: {
            name: name.trim(),
            description: description || undefined,
        },
    };

    return feature;
}

/**
 * Save terrain features to disk
 *
 * Creates/updates {MapName}-features.md with all feature definitions
 */
export async function saveFeaturesToDisk(
    app: App,
    mapPath: string,
    features: Map<string, TerrainFeature>
): Promise<void> {
    const featurePath = mapPath.replace(/\.md$/i, "-features.md");
    const featureFile = app.vault.getAbstractFileByPath(featurePath);

    const featureArray = Array.from(features.values());

    if (featureArray.length === 0) {
        // No features - delete file if it exists
        if (featureFile instanceof TFile) {
            await app.vault.delete(featureFile);
        }
        return;
    }

    // Build markdown content
    const frontmatter = [
        "---",
        "smType: terrain-features",
        `mapFile: ${mapPath}`,
        "---",
        "",
        "## Features",
        "",
    ];

    for (const feature of featureArray) {
        frontmatter.push(`### ${feature.type}: ${feature.metadata?.name || feature.id}`);
        frontmatter.push(`- Type: ${feature.type}`);

        // Save corners if available (new format), otherwise hexes (old format)
        if (feature.path.corners) {
            frontmatter.push(`- Corners: ${JSON.stringify(feature.path.corners)}`);
        } else if (feature.path.hexes) {
            frontmatter.push(`- Path: ${JSON.stringify(feature.path.hexes)}`);
        }

        frontmatter.push(`- Color: ${feature.style.color}`);
        frontmatter.push(`- Width: ${feature.style.width}`);
        if (feature.style.dashArray) {
            frontmatter.push(`- DashArray: ${feature.style.dashArray}`);
        }
        if (feature.metadata?.description) {
            frontmatter.push(`- Description: ${feature.metadata.description}`);
        }
        frontmatter.push("");
    }

    const content = frontmatter.join("\n");

    if (featureFile instanceof TFile) {
        await app.vault.modify(featureFile, content);
    } else {
        await app.vault.create(featurePath, content);
    }
}
