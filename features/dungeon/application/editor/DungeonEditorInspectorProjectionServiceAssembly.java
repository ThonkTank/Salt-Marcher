package features.dungeon.application.editor;

import java.util.ArrayList;
import java.util.List;

final class DungeonEditorInspectorProjectionServiceAssembly {

    private DungeonEditorInspectorProjectionServiceAssembly() {
    }

    static features.dungeon.api.DungeonInspectorSnapshot inspector(
            features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Inspector inspector
    ) {
        if (inspector == null) {
            return null;
        }
        return new features.dungeon.api.DungeonInspectorSnapshot(
                inspector.title(),
                inspector.summary(),
                statePanelFacts(inspector.statePanelFacts()),
                cards(inspector.roomNarrations()));
    }

    private static features.dungeon.api.DungeonInspectorSnapshot.StatePanelFacts statePanelFacts(
            features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.InspectorStatePanelState facts
    ) {
        features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.InspectorStatePanelState safeFacts =
                facts == null
                        ? features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.InspectorStatePanelState.empty()
                        : facts;
        return new features.dungeon.api.DungeonInspectorSnapshot.StatePanelFacts(
                stairGeometryFacts(safeFacts.stairGeometryState()),
                transitionDestinationFacts(safeFacts.transitionDestinationState()));
    }

    private static features.dungeon.api.DungeonInspectorSnapshot.StairGeometryFacts stairGeometryFacts(
            features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.InspectorStairGeometryState facts
    ) {
        features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.InspectorStairGeometryState safeFacts =
                facts == null
                        ? features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.InspectorStairGeometryState.empty()
                        : facts;
        return new features.dungeon.api.DungeonInspectorSnapshot.StairGeometryFacts(
                safeFacts.selected(),
                safeFacts.selectedStairId(),
                safeFacts.authoredShapeName(),
                safeFacts.authoredDirectionName(),
                safeFacts.firstDimension(),
                safeFacts.secondDimension());
    }

    private static features.dungeon.api.DungeonInspectorSnapshot.TransitionDestinationFacts
            transitionDestinationFacts(
                    features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.InspectorTransitionDestinationState facts
            ) {
        features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.InspectorTransitionDestinationState
                safeFacts = facts == null
                        ? features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.InspectorTransitionDestinationState.empty()
                        : facts;
        return new features.dungeon.api.DungeonInspectorSnapshot.TransitionDestinationFacts(
                safeFacts.linked(),
                safeFacts.targetKindKey(),
                safeFacts.targetMapId(),
                safeFacts.targetTileId(),
                safeFacts.targetTransitionId());
    }

    private static List<features.dungeon.api.DungeonInspectorSnapshot.RoomNarrationCard> cards(
            List<features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.RoomNarrationCard> cards
    ) {
        List<features.dungeon.api.DungeonInspectorSnapshot.RoomNarrationCard> result = new ArrayList<>();
        for (features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.RoomNarrationCard card
                : cards == null ? List.<features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.RoomNarrationCard>of() : cards) {
            result.add(card(card));
        }
        return List.copyOf(result);
    }

    private static features.dungeon.api.DungeonInspectorSnapshot.RoomNarrationCard card(
            features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.RoomNarrationCard card
    ) {
        features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.RoomNarrationCard safeCard = card == null
                ? new features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.RoomNarrationCard(0L, "Raum", "", List.of())
                : card;
        return new features.dungeon.api.DungeonInspectorSnapshot.RoomNarrationCard(
                safeCard.roomId(),
                safeCard.roomName(),
                safeCard.visualDescription(),
                exits(safeCard.exits()));
    }

    private static List<features.dungeon.api.DungeonInspectorSnapshot.RoomExitNarration> exits(
            List<features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.RoomExitNarration> exits
    ) {
        List<features.dungeon.api.DungeonInspectorSnapshot.RoomExitNarration> result = new ArrayList<>();
        for (features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.RoomExitNarration exit
                : exits == null ? List.<features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.RoomExitNarration>of() : exits) {
            result.add(exit(exit));
        }
        return List.copyOf(result);
    }

    private static features.dungeon.api.DungeonInspectorSnapshot.RoomExitNarration exit(
            features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.RoomExitNarration exit
    ) {
        features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.RoomExitNarration safeExit = exit == null
                ? new features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.RoomExitNarration(
                        "",
                        features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Cell.empty(),
                        "",
                        "")
                : exit;
        return new features.dungeon.api.DungeonInspectorSnapshot.RoomExitNarration(
                safeExit.label(),
                DungeonEditorValueProjectionServiceAssembly.cell(safeExit.cell()),
                safeExit.direction(),
                safeExit.description());
    }
}
