package src.features.dungeon.runtime;

import java.util.Locale;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;

final class DungeonEditorRuntimePointerTargetCompatibility {
    // LEGACY_REMOVE_ON_TOUCH: Remove after Wave 1 replaces legacy string hit-ref target facts with typed frame values.
    private DungeonEditorRuntimePointerTargetCompatibility() {
    }

    @SuppressWarnings("PMD.CyclomaticComplexity")
    static DungeonEditorRuntimePointerTarget.ElementKind legacyElementKind(String value) {
        return switch (normalized(value)) {
            case "ROOM" -> DungeonEditorRuntimePointerTarget.ElementKind.ROOM;
            case "CORRIDOR" -> DungeonEditorRuntimePointerTarget.ElementKind.CORRIDOR;
            case "CORRIDOR_ANCHOR" -> DungeonEditorRuntimePointerTarget.ElementKind.CORRIDOR_ANCHOR;
            case "STAIR" -> DungeonEditorRuntimePointerTarget.ElementKind.STAIR;
            case "TRANSITION" -> DungeonEditorRuntimePointerTarget.ElementKind.TRANSITION;
            case "FEATURE_MARKER" -> DungeonEditorRuntimePointerTarget.ElementKind.FEATURE_MARKER;
            case "FEATURE_OBJECT" -> DungeonEditorRuntimePointerTarget.ElementKind.FEATURE_OBJECT;
            case "FEATURE_ENCOUNTER" -> DungeonEditorRuntimePointerTarget.ElementKind.FEATURE_ENCOUNTER;
            case "FEATURE_POI" -> DungeonEditorRuntimePointerTarget.ElementKind.FEATURE_POI;
            case "WALL" -> DungeonEditorRuntimePointerTarget.ElementKind.WALL;
            case "DOOR" -> DungeonEditorRuntimePointerTarget.ElementKind.DOOR;
            case "WALL_VERTEX" -> DungeonEditorRuntimePointerTarget.ElementKind.WALL_VERTEX;
            default -> DungeonEditorRuntimePointerTarget.ElementKind.EMPTY;
        };
    }

    @SuppressWarnings("PMD.CyclomaticComplexity")
    static DungeonEditorRuntimePointerTarget.TopologyKind legacyTopologyKind(String value) {
        return switch (normalized(value)) {
            case "ROOM" -> DungeonEditorRuntimePointerTarget.TopologyKind.ROOM;
            case "CORRIDOR" -> DungeonEditorRuntimePointerTarget.TopologyKind.CORRIDOR;
            case "CORRIDOR_ANCHOR" -> DungeonEditorRuntimePointerTarget.TopologyKind.CORRIDOR_ANCHOR;
            case "DOOR" -> DungeonEditorRuntimePointerTarget.TopologyKind.DOOR;
            case "WALL" -> DungeonEditorRuntimePointerTarget.TopologyKind.WALL;
            case "STAIR" -> DungeonEditorRuntimePointerTarget.TopologyKind.STAIR;
            case "TRANSITION" -> DungeonEditorRuntimePointerTarget.TopologyKind.TRANSITION;
            case "FEATURE_MARKER" -> DungeonEditorRuntimePointerTarget.TopologyKind.FEATURE_MARKER;
            default -> DungeonEditorRuntimePointerTarget.TopologyKind.EMPTY;
        };
    }

    static DungeonEditorRuntimePointerTarget.BoundaryKind legacyBoundaryKind(String value) {
        return "DOOR".equals(normalized(value))
                ? DungeonEditorRuntimePointerTarget.BoundaryKind.DOOR
                : DungeonEditorRuntimePointerTarget.BoundaryKind.WALL;
    }

    static DungeonTopologyElementKind legacyDomainTopologyKind(String value) {
        return legacyTopologyKind(value).domainKind();
    }

    static String compatibilityTopologyKindName(DungeonEditorRuntimePointerTarget.TopologyKind kind) {
        DungeonEditorRuntimePointerTarget.TopologyKind safeKind = kind == null
                ? DungeonEditorRuntimePointerTarget.TopologyKind.defaultKind()
                : kind;
        return safeKind.stableName();
    }

    static String compatibilityBoundaryKindName(DungeonEditorRuntimePointerTarget.BoundaryKind kind) {
        DungeonEditorRuntimePointerTarget.BoundaryKind safeKind = kind == null
                ? DungeonEditorRuntimePointerTarget.BoundaryKind.defaultKind()
                : kind;
        return safeKind.stableName();
    }

    private static String normalized(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT).replace('-', '_');
    }
}
