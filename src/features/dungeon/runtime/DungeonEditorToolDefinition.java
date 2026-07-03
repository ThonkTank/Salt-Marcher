package src.features.dungeon.runtime;

import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.structure.feature.FeatureMarkerKind;
import src.domain.dungeon.model.core.structure.stair.StairShape;
import src.domain.dungeon.published.DungeonEditorTool;

record DungeonEditorToolDefinition(
        DungeonEditorTool tool,
        String toolKey,
        @Nullable DungeonEditorTool deleteTool,
        boolean prefersBoundaryTargets,
        @Nullable StairShape stairShape,
        @Nullable FeatureMarkerKind featureMarkerKind,
        boolean wallSingleClickMode
) {
    DungeonEditorToolDefinition {
        Objects.requireNonNull(tool, "tool");
        toolKey = safeToolKey(tool, toolKey);
    }

    private static String safeToolKey(DungeonEditorTool tool, String value) {
        String safeValue = value == null ? "" : value.trim();
        return safeValue.isEmpty() ? tool.name() : safeValue;
    }

    static Map<DungeonEditorTool, DungeonEditorToolDefinition> definitions() {
        Map<DungeonEditorTool, DungeonEditorToolDefinition> definitions = new EnumMap<>(DungeonEditorTool.class);
        for (DungeonEditorTool tool : DungeonEditorTool.values()) {
            register(definitions, tool, null, false, null, null, false);
        }
        register(definitions, DungeonEditorTool.ROOM_PAINT, DungeonEditorTool.ROOM_DELETE, false, null, null, false);
        register(definitions, DungeonEditorTool.ROOM_DELETE, DungeonEditorTool.ROOM_DELETE, false, null, null, false);
        register(definitions, DungeonEditorTool.WALL_CREATE, DungeonEditorTool.WALL_DELETE, true, null, null, true);
        register(definitions, DungeonEditorTool.WALL_DELETE, DungeonEditorTool.WALL_DELETE, true, null, null, false);
        register(definitions, DungeonEditorTool.DOOR_CREATE, DungeonEditorTool.DOOR_DELETE, true, null, null, false);
        register(definitions, DungeonEditorTool.DOOR_DELETE, DungeonEditorTool.DOOR_DELETE, true, null, null, false);
        register(definitions, DungeonEditorTool.CORRIDOR_CREATE, DungeonEditorTool.CORRIDOR_DELETE, true, null,
                null, false);
        register(definitions, DungeonEditorTool.CORRIDOR_DELETE, DungeonEditorTool.CORRIDOR_DELETE, true, null,
                null, false);
        register(definitions, DungeonEditorTool.STAIR_CREATE, DungeonEditorTool.STAIR_DELETE, false,
                StairShape.STRAIGHT, null, false);
        register(definitions, DungeonEditorTool.STAIR_CREATE_SQUARE, DungeonEditorTool.STAIR_DELETE, false,
                StairShape.SQUARE, null, false);
        register(definitions, DungeonEditorTool.STAIR_CREATE_CIRCULAR, DungeonEditorTool.STAIR_DELETE, false,
                StairShape.CIRCULAR, null, false);
        register(definitions, DungeonEditorTool.STAIR_DELETE, DungeonEditorTool.STAIR_DELETE, false, null, null, false);
        register(definitions, DungeonEditorTool.TRANSITION_CREATE, DungeonEditorTool.TRANSITION_DELETE, false,
                null, null, false);
        register(definitions, DungeonEditorTool.TRANSITION_DELETE, DungeonEditorTool.TRANSITION_DELETE, false,
                null, null, false);
        register(definitions, DungeonEditorTool.FEATURE_POI_CREATE, DungeonEditorTool.FEATURE_DELETE, false,
                null, FeatureMarkerKind.POI, false);
        register(definitions, DungeonEditorTool.FEATURE_OBJECT_CREATE, DungeonEditorTool.FEATURE_DELETE, false,
                null, FeatureMarkerKind.OBJECT, false);
        register(definitions, DungeonEditorTool.FEATURE_ENCOUNTER_CREATE, DungeonEditorTool.FEATURE_DELETE, false,
                null, FeatureMarkerKind.ENCOUNTER, false);
        register(definitions, DungeonEditorTool.FEATURE_DELETE, DungeonEditorTool.FEATURE_DELETE, false, null,
                null, false);
        return Map.copyOf(definitions);
    }

    static Map<String, DungeonEditorTool> keyLookup(
            Map<DungeonEditorTool, DungeonEditorToolDefinition> definitions
    ) {
        Map<String, DungeonEditorTool> keys = new HashMap<>();
        for (DungeonEditorToolDefinition definition : definitions.values()) {
            keys.put(DungeonEditorToolRegistry.normalizedToolKey(definition.toolKey()), definition.tool());
        }
        return Map.copyOf(keys);
    }

    private static void register(
            Map<DungeonEditorTool, DungeonEditorToolDefinition> definitions,
            DungeonEditorTool tool,
            @Nullable DungeonEditorTool deleteTool,
            boolean prefersBoundaryTargets,
            @Nullable StairShape stairShape,
            @Nullable FeatureMarkerKind featureMarkerKind,
            boolean wallSingleClickMode
    ) {
        definitions.put(tool, new DungeonEditorToolDefinition(
                tool,
                tool.name(),
                deleteTool,
                prefersBoundaryTargets,
                stairShape,
                featureMarkerKind,
                wallSingleClickMode));
    }
}
