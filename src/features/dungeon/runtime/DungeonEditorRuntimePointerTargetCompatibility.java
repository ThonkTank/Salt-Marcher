package src.features.dungeon.runtime;

import java.util.Locale;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;

final class DungeonEditorRuntimePointerTargetCompatibility {
    // LEGACY_REMOVE_ON_TOUCH: Remove after Wave 1 replaces legacy string hit-ref target facts with typed frame values.
    private DungeonEditorRuntimePointerTargetCompatibility() {
    }

    static DungeonEditorRuntimePointerTarget.ElementKind legacyElementKind(String value) {
        return DungeonEditorRuntimePointerTarget.ElementKind.fromCompatibilityName(normalized(value));
    }

    static DungeonEditorRuntimePointerTarget.TopologyKind legacyTopologyKind(String value) {
        return DungeonEditorRuntimePointerTarget.TopologyKind.fromCompatibilityName(normalized(value));
    }

    static DungeonEditorRuntimePointerTarget.BoundaryKind legacyBoundaryKind(String value) {
        return DungeonEditorRuntimePointerTarget.BoundaryKind.fromCompatibilityName(normalized(value));
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
