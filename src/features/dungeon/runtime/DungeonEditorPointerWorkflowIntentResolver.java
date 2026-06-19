package src.features.dungeon.runtime;

import java.util.EnumMap;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEditorTool;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerWorkflowGesture;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerWorkflowIntent;

final class DungeonEditorPointerWorkflowIntentResolver {
    private static final Map<DungeonEditorTool, DungeonEditorTool> DELETE_TOOLS = deleteTools();

    private DungeonEditorPointerWorkflowIntentResolver() {
    }

    static PointerWorkflowIntent resolve(
            String selectedTool,
            PointerWorkflowGesture gesture
    ) {
        PointerWorkflowGesture safeGesture = gesture == null ? PointerWorkflowGesture.empty() : gesture;
        DungeonEditorTool effectiveTool = effectiveTool(selectedTool, safeGesture);
        if (effectiveTool == null) {
            return PointerWorkflowIntent.ignored();
        }
        boolean boundaryTargetsPreferred = effectiveTool == DungeonEditorTool.WALL_CREATE
                || effectiveTool == DungeonEditorTool.WALL_DELETE
                || effectiveTool == DungeonEditorTool.DOOR_CREATE
                || effectiveTool == DungeonEditorTool.DOOR_DELETE;
        boolean wallSingleClickMode = effectiveTool == DungeonEditorTool.WALL_CREATE
                && (safeGesture.controlDown() || safeGesture.wallSingleClickModeSelected());
        return new PointerWorkflowIntent(
                true,
                effectiveTool.name(),
                boundaryTargetsPreferred,
                wallSingleClickMode);
    }

    private static @Nullable DungeonEditorTool effectiveTool(
            String selectedTool,
            PointerWorkflowGesture gesture
    ) {
        DungeonEditorTool tool = toolFrom(selectedTool);
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

    private static @Nullable DungeonEditorTool toolFrom(String selectedTool) {
        if (selectedTool == null || selectedTool.isBlank()) {
            return null;
        }
        try {
            return DungeonEditorTool.valueOf(selectedTool.trim());
        } catch (IllegalArgumentException exception) {
            return null;
        }
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
