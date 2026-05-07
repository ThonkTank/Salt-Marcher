package src.domain.dungeoneditor;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorInspectorSnapshot;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

public final class DungeonEditorInspectorProjector {

    private DungeonEditorInspectorProjector() {
    }

    public static @Nullable DungeonEditorInspectorSnapshot toPublishedInspector(
            DungeonEditorWorkspaceValues.@Nullable Inspector inspector
    ) {
        if (inspector == null) {
            return null;
        }
        return new DungeonEditorInspectorSnapshot(
                inspector.title(),
                inspector.summary(),
                inspector.facts(),
                inspector.roomNarrations().stream().map(DungeonEditorInspectorProjector::toPublishedRoomNarrationCard).toList());
    }

    private static DungeonEditorInspectorSnapshot.RoomNarrationCard toPublishedRoomNarrationCard(
            DungeonEditorWorkspaceValues.@Nullable RoomNarrationCard card
    ) {
        DungeonEditorWorkspaceValues.RoomNarrationCard safeCard = card == null
                ? new DungeonEditorWorkspaceValues.RoomNarrationCard(0L, "Raum", "", List.of())
                : card;
        return new DungeonEditorInspectorSnapshot.RoomNarrationCard(
                safeCard.roomId(),
                safeCard.roomName(),
                safeCard.visualDescription(),
                safeCard.exits().stream().map(DungeonEditorInspectorProjector::toPublishedRoomExit).toList());
    }

    private static DungeonEditorInspectorSnapshot.RoomExitNarration toPublishedRoomExit(
            DungeonEditorWorkspaceValues.@Nullable RoomExitNarration exit
    ) {
        DungeonEditorWorkspaceValues.RoomExitNarration safeExit = exit == null
                ? new DungeonEditorWorkspaceValues.RoomExitNarration(
                        "",
                        DungeonEditorWorkspaceValues.Cell.empty(),
                        "",
                        "")
                : exit;
        return new DungeonEditorInspectorSnapshot.RoomExitNarration(
                safeExit.label(),
                DungeonEditorPublishedValueProjector.toPublishedCell(safeExit.cell()),
                safeExit.direction(),
                safeExit.description());
    }
}
