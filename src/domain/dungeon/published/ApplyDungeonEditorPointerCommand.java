package src.domain.dungeon.published;

import java.util.Objects;

public record ApplyDungeonEditorPointerCommand(
        DungeonEditorTool tool,
        PointerAction action,
        DungeonEditorPointerSample pointer,
        boolean wallSingleClickMode,
        String transitionDestinationType,
        long transitionDestinationMapId,
        long transitionDestinationTileId,
        long transitionDestinationTransitionId
) {
    public ApplyDungeonEditorPointerCommand {
        tool = Objects.requireNonNull(tool, "tool");
        action = Objects.requireNonNull(action, "action");
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
        transitionDestinationType = transitionDestinationType == null ? "" : transitionDestinationType.trim();
        transitionDestinationMapId = Math.max(0L, transitionDestinationMapId);
        transitionDestinationTileId = Math.max(0L, transitionDestinationTileId);
        transitionDestinationTransitionId = Math.max(0L, transitionDestinationTransitionId);
    }

    public String actionName() {
        return action.name();
    }

    public String transitionDestinationTypeName() {
        return transitionDestinationType;
    }

    public long transitionDestinationMapId() {
        return transitionDestinationMapId;
    }

    public long transitionDestinationTileId() {
        return transitionDestinationTileId;
    }

    public long transitionDestinationTransitionId() {
        return transitionDestinationTransitionId;
    }

    public boolean wallSingleClickMode() {
        return wallSingleClickMode;
    }

    public static ApplyDungeonEditorPointerCommand pressed(
            DungeonEditorTool tool,
            DungeonEditorPointerSample pointer,
            boolean wallSingleClickMode
    ) {
        return new ApplyDungeonEditorPointerCommand(
                tool,
                PointerAction.PRESSED,
                pointer,
                wallSingleClickMode,
                "",
                0L,
                0L,
                0L);
    }

    public static ApplyDungeonEditorPointerCommand pressedWithTransitionDestination(
            DungeonEditorTool tool,
            DungeonEditorPointerSample pointer,
            boolean wallSingleClickMode,
            String destinationType,
            long destinationMapId,
            long destinationTileId,
            long destinationTransitionId
    ) {
        return new ApplyDungeonEditorPointerCommand(
                tool,
                PointerAction.PRESSED,
                pointer,
                wallSingleClickMode,
                destinationType,
                destinationMapId,
                destinationTileId,
                destinationTransitionId);
    }

    public static ApplyDungeonEditorPointerCommand dragged(
            DungeonEditorTool tool,
            DungeonEditorPointerSample pointer,
            boolean wallSingleClickMode
    ) {
        return new ApplyDungeonEditorPointerCommand(
                tool,
                PointerAction.DRAGGED,
                pointer,
                wallSingleClickMode,
                "",
                0L,
                0L,
                0L);
    }

    public static ApplyDungeonEditorPointerCommand released(
            DungeonEditorTool tool,
            DungeonEditorPointerSample pointer,
            boolean wallSingleClickMode
    ) {
        return new ApplyDungeonEditorPointerCommand(
                tool,
                PointerAction.RELEASED,
                pointer,
                wallSingleClickMode,
                "",
                0L,
                0L,
                0L);
    }

    public static ApplyDungeonEditorPointerCommand moved(
            DungeonEditorTool tool,
            DungeonEditorPointerSample pointer,
            boolean wallSingleClickMode
    ) {
        return new ApplyDungeonEditorPointerCommand(
                tool,
                PointerAction.MOVED,
                pointer,
                wallSingleClickMode,
                "",
                0L,
                0L,
                0L);
    }

    public enum PointerAction {
        PRESSED,
        DRAGGED,
        RELEASED,
        MOVED
    }
}
