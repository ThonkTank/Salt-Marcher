package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;

final class DungeonEditorInspectorProjectionServiceAssembly {

    private DungeonEditorInspectorProjectionServiceAssembly() {
    }

    static src.domain.dungeon.published.DungeonInspectorSnapshot inspector(
            src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues.Inspector inspector
    ) {
        if (inspector == null) {
            return null;
        }
        return new src.domain.dungeon.published.DungeonInspectorSnapshot(
                inspector.title(),
                inspector.summary(),
                inspector.facts(),
                cards(inspector.roomNarrations()));
    }

    private static List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard> cards(
            List<src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues.RoomNarrationCard> cards
    ) {
        List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard> result = new ArrayList<>();
        for (src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues.RoomNarrationCard card
                : cards == null ? List.<src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues.RoomNarrationCard>of() : cards) {
            result.add(card(card));
        }
        return List.copyOf(result);
    }

    private static src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard card(
            src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues.RoomNarrationCard card
    ) {
        src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues.RoomNarrationCard safeCard = card == null
                ? new src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues.RoomNarrationCard(0L, "Raum", "", List.of())
                : card;
        return new src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard(
                safeCard.roomId(),
                safeCard.roomName(),
                safeCard.visualDescription(),
                exits(safeCard.exits()));
    }

    private static List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomExitNarration> exits(
            List<src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues.RoomExitNarration> exits
    ) {
        List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomExitNarration> result = new ArrayList<>();
        for (src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues.RoomExitNarration exit
                : exits == null ? List.<src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues.RoomExitNarration>of() : exits) {
            result.add(exit(exit));
        }
        return List.copyOf(result);
    }

    private static src.domain.dungeon.published.DungeonInspectorSnapshot.RoomExitNarration exit(
            src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues.RoomExitNarration exit
    ) {
        src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues.RoomExitNarration safeExit = exit == null
                ? new src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues.RoomExitNarration(
                        "",
                        src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues.Cell.empty(),
                        "",
                        "")
                : exit;
        return new src.domain.dungeon.published.DungeonInspectorSnapshot.RoomExitNarration(
                safeExit.label(),
                DungeonEditorValueProjectionServiceAssembly.cell(safeExit.cell()),
                safeExit.direction(),
                safeExit.description());
    }
}
