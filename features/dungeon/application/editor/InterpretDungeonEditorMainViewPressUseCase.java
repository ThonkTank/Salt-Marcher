package features.dungeon.application.editor;

import features.dungeon.domain.core.graph.DungeonTopologyElementKind;
import features.dungeon.application.editor.session.DungeonEditorSessionEffect;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.BoundaryStretchSession;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.DragSession;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.InteractionState;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.PaintSession;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.PointerState;

final class InterpretDungeonEditorMainViewPressUseCase {
    private final DungeonEditorBoundaryDraftUseCase boundaryDraft = new DungeonEditorBoundaryDraftUseCase();
    private final DungeonEditorCorridorInteractionUseCase corridor;
    private final DungeonEditorBoundaryStretchHelper boundaryStretch = new DungeonEditorBoundaryStretchHelper();

    InterpretDungeonEditorMainViewPressUseCase(
            features.dungeon.domain.core.structure.corridor.CorridorRoutingPolicy routingPolicy
    ) {
        corridor = new DungeonEditorCorridorInteractionUseCase(routingPolicy);
    }

    DungeonEditorMainViewInterpretation interpretSelection(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection currentSelection,
            InteractionState state
    ) {
        BoundaryStretchSession nextStretchSession = boundaryStretch.start(input, snapshot, currentSelection);
        if (nextStretchSession != null) {
            InteractionState nextState = state
                    .withDragSession(DragSession.none())
                    .withBoundaryStretchSession(nextStretchSession);
            return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorSessionEffect.select(nextStretchSession.selection()));
        }
        if (input.hitTarget().selectable()) {
            DungeonEditorSessionValues.Selection nextSelection =
                    selectedCorridorPoint(input, snapshot, input.hitTarget().toSelection());
            DragSession nextDrag = input.hitTarget().draggable()
                    ? DragSession.start(nextSelection, input.q(), input.r(), input.level())
                    : DragSession.none();
            InteractionState nextState = state
                    .withDragSession(nextDrag)
                    .withBoundaryStretchSession(BoundaryStretchSession.none());
            return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorSessionEffect.select(nextSelection));
        }
        return new DungeonEditorMainViewInterpretation(state.clear(), DungeonEditorSessionEffect.clearedSelection());
    }

    private static DungeonEditorSessionValues.Selection selectedCorridorPoint(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection selection
    ) {
        if (selection.topologyRef().kind() != DungeonTopologyElementKind.CORRIDOR
                || !DungeonEditorWorkspaceValues.hasId(selection.topologyRef().id())) {
            return selection;
        }
        DungeonEditorWorkspaceValues.HandleRef point =
                DungeonEditorCorridorPointLookup.authoredPointAt(input, snapshot, selection.topologyRef().id());
        if (!DungeonEditorWorkspaceValues.hasId(point.topologyRef().id())) {
            return selection;
        }
        return new DungeonEditorSessionValues.Selection(
                selection.topologyRef(),
                selection.clusterId(),
                selection.clusterSelection(),
                point);
    }

    DungeonEditorWallBoundaryDraftInterpretation interpretWallBoundaryOperation(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection currentSelection,
            DungeonEditorToolAction boundaryTool,
            InteractionState state
    ) {
        DungeonEditorWallBoundaryDraftInterpretation boundaryInterpretation =
                boundaryDraft.pressWall(input, snapshot, currentSelection, boundaryTool, state);
        if (boundaryInterpretation.effect().isNoop()) {
            return boundaryInterpretation;
        }
        InteractionState nextState = boundaryInterpretation.nextState()
                .withDragSession(DragSession.none())
                .withPaintSession(PaintSession.none());
        return boundaryInterpretation.withNextState(nextState);
    }

    DungeonEditorDoorBoundaryDraftInterpretation interpretDoorBoundaryOperation(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorToolAction boundaryTool,
            InteractionState state
    ) {
        DungeonEditorDoorBoundaryDraftInterpretation boundaryInterpretation =
                boundaryDraft.pressDoor(input, snapshot, boundaryTool, state);
        if (boundaryInterpretation.effect().isNoop()) {
            return boundaryInterpretation;
        }
        InteractionState nextState = boundaryInterpretation.nextState()
                .withDragSession(DragSession.none())
                .withPaintSession(PaintSession.none());
        return boundaryInterpretation.withNextState(nextState);
    }

    DungeonEditorMainViewInterpretation interpretCorridor(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorToolAction corridorTool,
            InteractionState state
    ) {
        InteractionState nextState = state
                .withDragSession(DragSession.none())
                .withPaintSession(PaintSession.none())
                .withBoundaryStretchSession(BoundaryStretchSession.none());
        return corridor.press(input, snapshot, corridorTool, nextState);
    }

    DungeonEditorMainViewInterpretation interpretRoom(
            PointerState input,
            DungeonEditorToolAction roomTool,
            InteractionState state
    ) {
        PaintSession paintSession = new PaintSession(
                input.q(),
                input.r(),
                input.q(),
                input.r(),
                input.level(),
                roomTool.deleteMode(),
                true);
        InteractionState nextState = state
                .withPaintSession(paintSession)
                .withDragSession(DragSession.none())
                .withBoundaryStretchSession(BoundaryStretchSession.none());
        return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorSessionEffect.preview(paintSession.preview()));
    }
}
