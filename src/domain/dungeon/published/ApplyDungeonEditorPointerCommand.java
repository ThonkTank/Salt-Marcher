package src.domain.dungeon.published;

import java.util.Objects;

public record ApplyDungeonEditorPointerCommand(
        DungeonEditorTool tool,
        PointerAction action,
        DungeonEditorPointerSample pointer
) implements DungeonEditorPointerCommand {
    public ApplyDungeonEditorPointerCommand {
        tool = Objects.requireNonNull(tool, "tool");
        action = Objects.requireNonNull(action, "action");
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
    }

    public String actionName() {
        return action.name();
    }

    public static ApplyDungeonEditorPointerCommand pressed(
            DungeonEditorTool tool,
            DungeonEditorPointerSample pointer
    ) {
        return new ApplyDungeonEditorPointerCommand(tool, PointerAction.PRESSED, pointer);
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
