package src.features.dungeon.runtime;

import java.util.EnumMap;
import java.util.Locale;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.structure.feature.FeatureMarkerKind;
import src.domain.dungeon.model.core.structure.stair.StairShape;
import src.domain.dungeon.published.DungeonEditorTool;

@SuppressWarnings("PMD.TooManyMethods")
final class DungeonEditorRuntimeWorkflowMapping {
    private static final Map<DungeonEditorTool, DungeonEditorTool> DELETE_TOOLS = deleteTools();

    private DungeonEditorRuntimeWorkflowMapping() {
    }

    static String toolName(String value) {
        DungeonEditorTool tool = toolFromKey(value);
        return tool == null ? DungeonEditorTool.SELECT.name() : tool.name();
    }

    static @Nullable DungeonEditorTool toolFromKey(String value) {
        try {
            return DungeonEditorTool.valueOf(normalizedEnumName(value));
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    static @Nullable DungeonEditorTool effectivePointerTool(
            String selectedTool,
            PointerWorkflowGesture gesture
    ) {
        DungeonEditorTool tool = toolFromKey(selectedTool);
        if (tool == null) {
            return null;
        }
        if (gesture.secondaryButtonDown() && gesture.shiftDown()) {
            return tool == DungeonEditorTool.WALL_CREATE ? tool : null;
        }
        if (tool == DungeonEditorTool.WALL_CREATE && deleteGesture(gesture)) {
            return DungeonEditorTool.WALL_CREATE;
        }
        return deleteGesture(gesture) ? DELETE_TOOLS.get(tool) : tool;
    }

    static boolean prefersBoundaryTargets(DungeonEditorTool tool) {
        return tool == DungeonEditorTool.WALL_CREATE
                || tool == DungeonEditorTool.WALL_DELETE
                || tool == DungeonEditorTool.DOOR_CREATE
                || tool == DungeonEditorTool.DOOR_DELETE
                || tool == DungeonEditorTool.CORRIDOR_CREATE
                || tool == DungeonEditorTool.CORRIDOR_DELETE;
    }

    static boolean wallSingleClickMode(
            DungeonEditorTool tool,
            PointerWorkflowGesture gesture
    ) {
        return tool == DungeonEditorTool.WALL_CREATE
                && (gesture.controlDown() || gesture.wallSingleClickModeSelected());
    }

    static boolean isStairCreateTool(DungeonEditorTool tool) {
        return tool == DungeonEditorTool.STAIR_CREATE
                || tool == DungeonEditorTool.STAIR_CREATE_SQUARE
                || tool == DungeonEditorTool.STAIR_CREATE_CIRCULAR;
    }

    static StairShape stairShape(DungeonEditorTool tool) {
        if (tool == DungeonEditorTool.STAIR_CREATE_SQUARE) {
            return StairShape.SQUARE;
        }
        if (tool == DungeonEditorTool.STAIR_CREATE_CIRCULAR) {
            return StairShape.CIRCULAR;
        }
        return StairShape.STRAIGHT;
    }

    static @Nullable FeatureMarkerKind featureMarkerKind(DungeonEditorTool tool) {
        if (tool == DungeonEditorTool.FEATURE_POI_CREATE) {
            return FeatureMarkerKind.POI;
        }
        if (tool == DungeonEditorTool.FEATURE_OBJECT_CREATE) {
            return FeatureMarkerKind.OBJECT;
        }
        if (tool == DungeonEditorTool.FEATURE_ENCOUNTER_CREATE) {
            return FeatureMarkerKind.ENCOUNTER;
        }
        return null;
    }

    static String normalizedEnumName(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT).replace('-', '_');
    }

    private static boolean deleteGesture(PointerWorkflowGesture gesture) {
        return gesture.secondaryButtonDown()
                && !gesture.primaryButtonDown()
                && !gesture.middleButtonDown()
                && !gesture.shiftDown();
    }

    private static Map<DungeonEditorTool, DungeonEditorTool> deleteTools() {
        Map<DungeonEditorTool, DungeonEditorTool> tools = new EnumMap<>(DungeonEditorTool.class);
        registerDeleteTool(tools, DungeonEditorTool.ROOM_PAINT, DungeonEditorTool.ROOM_DELETE);
        registerDeleteTool(tools, DungeonEditorTool.WALL_CREATE, DungeonEditorTool.WALL_DELETE);
        registerDeleteTool(tools, DungeonEditorTool.DOOR_CREATE, DungeonEditorTool.DOOR_DELETE);
        registerDeleteTool(tools, DungeonEditorTool.CORRIDOR_CREATE, DungeonEditorTool.CORRIDOR_DELETE);
        registerDeleteTool(tools, DungeonEditorTool.STAIR_CREATE, DungeonEditorTool.STAIR_DELETE);
        registerDeleteTool(tools, DungeonEditorTool.STAIR_CREATE_SQUARE, DungeonEditorTool.STAIR_DELETE);
        registerDeleteTool(tools, DungeonEditorTool.STAIR_CREATE_CIRCULAR, DungeonEditorTool.STAIR_DELETE);
        registerDeleteTool(tools, DungeonEditorTool.TRANSITION_CREATE, DungeonEditorTool.TRANSITION_DELETE);
        registerDeleteTool(tools, DungeonEditorTool.FEATURE_POI_CREATE, DungeonEditorTool.FEATURE_DELETE);
        registerDeleteTool(tools, DungeonEditorTool.FEATURE_OBJECT_CREATE, DungeonEditorTool.FEATURE_DELETE);
        registerDeleteTool(tools, DungeonEditorTool.FEATURE_ENCOUNTER_CREATE, DungeonEditorTool.FEATURE_DELETE);
        return Map.copyOf(tools);
    }

    private static void registerDeleteTool(
            Map<DungeonEditorTool, DungeonEditorTool> tools,
            DungeonEditorTool primary,
            DungeonEditorTool delete
    ) {
        tools.put(primary, delete);
        tools.put(delete, delete);
    }

}
