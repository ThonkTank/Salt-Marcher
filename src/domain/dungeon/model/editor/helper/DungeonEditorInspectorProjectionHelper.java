package src.domain.dungeon.model.editor.helper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorInspectorProjectionHelper {

    private DungeonEditorInspectorProjectionHelper() {
    }

    public static @Nullable DungeonInspectorSnapshot toPublishedInspector(
            DungeonEditorWorkspaceValues.@Nullable Inspector inspector
    ) {
        if (inspector == null) {
            return null;
        }
        return new DungeonInspectorSnapshot(
                inspector.title(),
                inspector.summary(),
                inspector.facts(),
                inspector.roomNarrations().stream().map(DungeonEditorInspectorProjectionHelper::toPublishedRoomNarrationCard).toList());
    }

    private static DungeonInspectorSnapshot.RoomNarrationCard toPublishedRoomNarrationCard(
            DungeonEditorWorkspaceValues.@Nullable RoomNarrationCard card
    ) {
        DungeonEditorWorkspaceValues.RoomNarrationCard safeCard = card == null
                ? new DungeonEditorWorkspaceValues.RoomNarrationCard(0L, "Raum", "", List.of())
                : card;
        return new DungeonInspectorSnapshot.RoomNarrationCard(
                safeCard.roomId(),
                safeCard.roomName(),
                safeCard.visualDescription(),
                safeCard.exits().stream().map(DungeonEditorInspectorProjectionHelper::toPublishedRoomExit).toList());
    }

    private static DungeonInspectorSnapshot.RoomExitNarration toPublishedRoomExit(
            DungeonEditorWorkspaceValues.@Nullable RoomExitNarration exit
    ) {
        DungeonEditorWorkspaceValues.RoomExitNarration safeExit = exit == null
                ? new DungeonEditorWorkspaceValues.RoomExitNarration(
                        "",
                        DungeonEditorWorkspaceValues.Cell.empty(),
                        "",
                        "")
                : exit;
        return new DungeonInspectorSnapshot.RoomExitNarration(
                safeExit.label(),
                toPublishedCell(safeExit.cell()),
                safeExit.direction(),
                safeExit.description());
    }

    private static DungeonCellRef toPublishedCell(DungeonEditorWorkspaceValues.Cell cell) {
        return cell == null ? new DungeonCellRef(0, 0, 0) : new DungeonCellRef(cell.q(), cell.r(), cell.level());
    }
}
