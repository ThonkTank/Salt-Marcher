package src.domain.dungeon.model.worldspace.usecase;

import src.domain.dungeon.model.worldspace.helper.DungeonEditorBoundaryStretchHelper;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryStretchSession;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorMainViewInteractionValues.DragSession;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorMainViewInteractionValues.PaintSession;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorMainViewInterpretation;
import src.domain.dungeon.model.worldspace.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues;

final class InterpretDungeonEditorMainViewPressUseCase {
    private final DungeonEditorBoundaryDraftUseCase boundaryDraft = new DungeonEditorBoundaryDraftUseCase();
    private final DungeonEditorCorridorInteractionUseCase corridor = new DungeonEditorCorridorInteractionUseCase();
    private final DungeonEditorBoundaryStretchHelper boundaryStretch = new DungeonEditorBoundaryStretchHelper();

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
            return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.select(nextStretchSession.selection()));
        }
        if (input.hitTarget().selectable()) {
            DungeonEditorSessionValues.Selection nextSelection = input.hitTarget().toSelection();
            DragSession nextDrag = input.hitTarget().draggable()
                    ? DragSession.start(nextSelection, input.q(), input.r(), input.level())
                    : DragSession.none();
            InteractionState nextState = state
                    .withDragSession(nextDrag)
                    .withBoundaryStretchSession(BoundaryStretchSession.none());
            return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.select(nextSelection));
        }
        return new DungeonEditorMainViewInterpretation(state.clear(), DungeonEditorMainViewEffect.clearedSelection());
    }

    DungeonEditorMainViewInterpretation interpretBoundary(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection currentSelection,
            DungeonEditorSessionValues.Tool boundaryTool,
            InteractionState state
    ) {
        DungeonEditorMainViewInterpretation boundaryInterpretation =
                boundaryDraft.press(input, snapshot, currentSelection, boundaryTool, state);
        if (boundaryInterpretation.effect().isNoop()) {
            return boundaryInterpretation;
        }
        InteractionState nextState = boundaryInterpretation.nextState()
                .withDragSession(DragSession.none())
                .withPaintSession(PaintSession.none());
        return new DungeonEditorMainViewInterpretation(nextState, boundaryInterpretation.effect());
    }

    DungeonEditorMainViewInterpretation interpretCorridor(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool corridorTool,
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
            DungeonEditorSessionValues.Tool roomTool,
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
        return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.preview(paintSession.preview()));
    }
}
