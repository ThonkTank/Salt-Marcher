package src.domain.dungeoneditor.application;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

final class DungeonEditorWorkspaceInspectorBoundaryTranslator {

    private DungeonEditorWorkspaceInspectorBoundaryTranslator() {
    }

    static DungeonEditorWorkspaceValues.@Nullable Inspector toWorkspaceInspector(
            @Nullable DungeonInspectorSnapshot inspector
    ) {
        if (inspector == null) {
            return null;
        }
        return new DungeonEditorWorkspaceValues.Inspector(
                inspector.title(),
                inspector.summary(),
                inspector.facts(),
                inspector.roomNarrations().stream()
                        .map(DungeonEditorWorkspaceInspectorBoundaryTranslator::toWorkspaceRoomNarrationCard)
                        .toList());
    }

    static DungeonInspectorSnapshot.RoomExitNarration toDomainRoomExit(
            DungeonEditorWorkspaceValues.RoomExitNarration exit
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
                DungeonEditorWorkspaceCellBoundaryTranslator.toDomainCell(safeExit.cell()),
                safeExit.direction(),
                safeExit.description());
    }

    private static DungeonEditorWorkspaceValues.RoomNarrationCard toWorkspaceRoomNarrationCard(
            DungeonInspectorSnapshot.@Nullable RoomNarrationCard card
    ) {
        DungeonInspectorSnapshot.RoomNarrationCard safeCard = card == null
                ? new DungeonInspectorSnapshot.RoomNarrationCard(0L, "Raum", "", List.of())
                : card;
        return new DungeonEditorWorkspaceValues.RoomNarrationCard(
                safeCard.roomId(),
                safeCard.roomName(),
                safeCard.visualDescription(),
                safeCard.exits().stream().map(DungeonEditorWorkspaceInspectorBoundaryTranslator::toWorkspaceRoomExit).toList());
    }

    private static DungeonEditorWorkspaceValues.RoomExitNarration toWorkspaceRoomExit(
            DungeonInspectorSnapshot.@Nullable RoomExitNarration exit
    ) {
        DungeonInspectorSnapshot.RoomExitNarration safeExit = exit == null
                ? new DungeonInspectorSnapshot.RoomExitNarration("", new DungeonCellRef(0, 0, 0), "", "")
                : exit;
        return new DungeonEditorWorkspaceValues.RoomExitNarration(
                safeExit.label(),
                DungeonEditorWorkspaceCellBoundaryTranslator.toWorkspaceCell(safeExit.cell()),
                safeExit.direction(),
                safeExit.description());
    }
}
