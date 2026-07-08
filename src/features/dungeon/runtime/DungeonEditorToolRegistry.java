package src.features.dungeon.runtime;

import java.util.Locale;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.structure.feature.FeatureMarkerKind;
import src.domain.dungeon.model.core.structure.stair.StairShape;
import src.domain.dungeon.published.DungeonEditorTool;

@SuppressWarnings("PMD.TooManyMethods")
final class DungeonEditorToolRegistry {
    private static final DungeonEditorToolRegistry INSTANCE = new DungeonEditorToolRegistry();

    private final Map<DungeonEditorTool, DungeonEditorToolDefinition> definitions;
    private final Map<String, DungeonEditorTool> toolsByKey;

    private DungeonEditorToolRegistry() {
        definitions = DungeonEditorToolDefinition.definitions();
        toolsByKey = DungeonEditorToolDefinition.keyLookup(definitions);
    }

    static DungeonEditorToolRegistry current() {
        return INSTANCE;
    }

    static String normalizedToolKey(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT).replace('-', '_');
    }

    @Nullable DungeonEditorTool toolFromKey(String value) {
        return toolsByKey.get(normalizedToolKey(value));
    }

    @Nullable DungeonEditorTool effectivePointerTool(
            String selectedTool,
            PointerWorkflowGesture gesture
    ) {
        PointerWorkflowGesture safeGesture = gesture == null ? PointerWorkflowGesture.empty() : gesture;
        DungeonEditorTool tool = toolFromKey(selectedTool);
        if (tool == null) {
            return null;
        }
        return switch (gestureMode(safeGesture)) {
            case NORMAL -> tool;
            case SHIFT_SECONDARY -> wallCreateOrIgnored(tool);
            case DELETE -> wallCreateOrDeleteTool(tool);
        };
    }

    @Nullable DungeonEditorToolDefinition definitionFor(@Nullable DungeonEditorTool tool) {
        return tool == null ? null : definitions.get(tool);
    }

    boolean prefersBoundaryTargets(DungeonEditorTool tool) {
        DungeonEditorToolDefinition definition = definitionFor(tool);
        return definition != null && definition.prefersBoundaryTargets();
    }

    boolean wallSingleClickMode(
            DungeonEditorTool tool,
            PointerWorkflowGesture gesture
    ) {
        DungeonEditorToolDefinition definition = definitionFor(tool);
        PointerWorkflowGesture safeGesture = gesture == null ? PointerWorkflowGesture.empty() : gesture;
        return definition != null
                && definition.wallSingleClickMode()
                && (safeGesture.controlDown() || safeGesture.wallSingleClickModeSelected());
    }

    boolean isStairCreateTool(DungeonEditorTool tool) {
        DungeonEditorToolDefinition definition = definitionFor(tool);
        return definition != null && definition.stairShape() != null;
    }

    StairShape stairShape(DungeonEditorTool tool) {
        DungeonEditorToolDefinition definition = definitionFor(tool);
        return definition == null || definition.stairShape() == null
                ? StairShape.STRAIGHT
                : definition.stairShape();
    }

    @Nullable FeatureMarkerKind featureMarkerKind(DungeonEditorTool tool) {
        DungeonEditorToolDefinition definition = definitionFor(tool);
        return definition == null ? null : definition.featureMarkerKind();
    }

    private static PointerGestureMode gestureMode(PointerWorkflowGesture gesture) {
        if (gesture.secondaryButtonDown() && gesture.shiftDown()) {
            return PointerGestureMode.SHIFT_SECONDARY;
        }
        if (gesture.secondaryButtonDown() && !gesture.primaryButtonDown() && !gesture.middleButtonDown()) {
            return PointerGestureMode.DELETE;
        }
        return PointerGestureMode.NORMAL;
    }

    private static @Nullable DungeonEditorTool wallCreateOrIgnored(DungeonEditorTool tool) {
        return tool == DungeonEditorTool.WALL_CREATE ? tool : null;
    }

    private @Nullable DungeonEditorTool wallCreateOrDeleteTool(DungeonEditorTool tool) {
        if (tool == DungeonEditorTool.WALL_CREATE) {
            return DungeonEditorTool.WALL_CREATE;
        }
        DungeonEditorToolDefinition definition = definitionFor(tool);
        return definition == null ? null : definition.deleteTool();
    }

    private enum PointerGestureMode {
        NORMAL,
        SHIFT_SECONDARY,
        DELETE
    }
}
