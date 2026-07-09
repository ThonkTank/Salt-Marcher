package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;

final class DungeonEditorInspectorProjectionServiceAssembly {

    private DungeonEditorInspectorProjectionServiceAssembly() {
    }

    static src.domain.dungeon.published.DungeonInspectorSnapshot inspector(
            src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Inspector inspector
    ) {
        if (inspector == null) {
            return null;
        }
        return new src.domain.dungeon.published.DungeonInspectorSnapshot(
                inspector.title(),
                inspector.summary(),
                inspector.facts(),
                statePanelFacts(inspector.statePanelFacts()),
                cards(inspector.roomNarrations()));
    }

    private static src.domain.dungeon.published.DungeonInspectorSnapshot.StatePanelFacts statePanelFacts(
            src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.InspectorStatePanelState facts
    ) {
        src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.InspectorStatePanelState safeFacts =
                facts == null
                        ? src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.InspectorStatePanelState.empty()
                        : facts;
        return new src.domain.dungeon.published.DungeonInspectorSnapshot.StatePanelFacts(
                stairGeometryFacts(safeFacts.stairGeometryState()),
                transitionDestinationFacts(safeFacts.transitionDestinationState()));
    }

    private static src.domain.dungeon.published.DungeonInspectorSnapshot.StairGeometryFacts stairGeometryFacts(
            src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.InspectorStairGeometryState facts
    ) {
        src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.InspectorStairGeometryState safeFacts =
                facts == null
                        ? src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.InspectorStairGeometryState.empty()
                        : facts;
        return new src.domain.dungeon.published.DungeonInspectorSnapshot.StairGeometryFacts(
                safeFacts.selected(),
                safeFacts.selectedStairId(),
                safeFacts.authoredShapeName(),
                safeFacts.authoredDirectionName(),
                safeFacts.firstDimension(),
                safeFacts.secondDimension());
    }

    private static src.domain.dungeon.published.DungeonInspectorSnapshot.TransitionDestinationFacts
            transitionDestinationFacts(
                    src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.InspectorTransitionDestinationState facts
            ) {
        src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.InspectorTransitionDestinationState
                safeFacts = facts == null
                        ? src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.InspectorTransitionDestinationState.empty()
                        : facts;
        return new src.domain.dungeon.published.DungeonInspectorSnapshot.TransitionDestinationFacts(
                safeFacts.linked(),
                safeFacts.targetKindKey(),
                safeFacts.targetMapId(),
                safeFacts.targetTileId(),
                safeFacts.targetTransitionId());
    }

    private static List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard> cards(
            List<src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.RoomNarrationCard> cards
    ) {
        List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard> result = new ArrayList<>();
        for (src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.RoomNarrationCard card
                : cards == null ? List.<src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.RoomNarrationCard>of() : cards) {
            result.add(card(card));
        }
        return List.copyOf(result);
    }

    private static src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard card(
            src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.RoomNarrationCard card
    ) {
        src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.RoomNarrationCard safeCard = card == null
                ? new src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.RoomNarrationCard(0L, "Raum", "", List.of())
                : card;
        return new src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard(
                safeCard.roomId(),
                safeCard.roomName(),
                safeCard.visualDescription(),
                exits(safeCard.exits()));
    }

    private static List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomExitNarration> exits(
            List<src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.RoomExitNarration> exits
    ) {
        List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomExitNarration> result = new ArrayList<>();
        for (src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.RoomExitNarration exit
                : exits == null ? List.<src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.RoomExitNarration>of() : exits) {
            result.add(exit(exit));
        }
        return List.copyOf(result);
    }

    private static src.domain.dungeon.published.DungeonInspectorSnapshot.RoomExitNarration exit(
            src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.RoomExitNarration exit
    ) {
        src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.RoomExitNarration safeExit = exit == null
                ? new src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.RoomExitNarration(
                        "",
                        src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Cell.empty(),
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
