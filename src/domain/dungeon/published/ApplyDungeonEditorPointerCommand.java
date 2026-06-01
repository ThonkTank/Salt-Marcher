package src.domain.dungeon.published;

import java.util.Objects;

public record ApplyDungeonEditorPointerCommand(
        DungeonEditorTool tool,
        PointerAction action,
        DungeonEditorPointerSample pointer,
        String transitionDestinationType,
        long transitionDestinationMapId,
        long transitionDestinationTileId,
        long transitionDestinationTransitionId
) implements DungeonEditorPointerCommand {
    public ApplyDungeonEditorPointerCommand {
        tool = Objects.requireNonNull(tool, "tool");
        action = Objects.requireNonNull(action, "action");
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
        transitionDestinationType = transitionDestinationType == null ? "" : transitionDestinationType.trim();
        transitionDestinationMapId = Math.max(0L, transitionDestinationMapId);
        transitionDestinationTileId = Math.max(0L, transitionDestinationTileId);
        transitionDestinationTransitionId = Math.max(0L, transitionDestinationTransitionId);
    }

    public ApplyDungeonEditorPointerCommand(
            DungeonEditorTool tool,
            PointerAction action,
            DungeonEditorPointerSample pointer
    ) {
        this(tool, action, pointer, "", 0L, 0L, 0L);
    }

    public String actionName() {
        return action.name();
    }

    @Override
    public String transitionDestinationTypeName() {
        return transitionDestinationType;
    }

    @Override
    public long transitionDestinationMapId() {
        return transitionDestinationMapId;
    }

    @Override
    public long transitionDestinationTileId() {
        return transitionDestinationTileId;
    }

    @Override
    public long transitionDestinationTransitionId() {
        return transitionDestinationTransitionId;
    }

    public static ApplyDungeonEditorPointerCommand pressed(
            DungeonEditorTool tool,
            DungeonEditorPointerSample pointer
    ) {
        return new ApplyDungeonEditorPointerCommand(tool, PointerAction.PRESSED, pointer);
    }

    public static ApplyDungeonEditorPointerCommand pressedWithTransitionDestination(
            DungeonEditorTool tool,
            DungeonEditorPointerSample pointer,
            String destinationType,
            long destinationMapId,
            long destinationTileId,
            long destinationTransitionId
    ) {
        return new ApplyDungeonEditorPointerCommand(
                tool,
                PointerAction.PRESSED,
                pointer,
                destinationType,
                destinationMapId,
                destinationTileId,
                destinationTransitionId);
    }

    public static ApplyDungeonEditorPointerCommand dragged(
            DungeonEditorTool tool,
            DungeonEditorPointerSample pointer
    ) {
        return new ApplyDungeonEditorPointerCommand(tool, PointerAction.DRAGGED, pointer);
    }

    public static ApplyDungeonEditorPointerCommand released(
            DungeonEditorTool tool,
            DungeonEditorPointerSample pointer
    ) {
        return new ApplyDungeonEditorPointerCommand(tool, PointerAction.RELEASED, pointer);
    }

    public static ApplyDungeonEditorPointerCommand moved(
            DungeonEditorTool tool,
            DungeonEditorPointerSample pointer
    ) {
        return new ApplyDungeonEditorPointerCommand(tool, PointerAction.MOVED, pointer);
    }

    public enum PointerAction {
        PRESSED,
        DRAGGED,
        RELEASED,
        MOVED
    }
}
