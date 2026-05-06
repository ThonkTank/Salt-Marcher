package src.domain.dungeoneditor.application;

import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeoneditor.interaction.service.DungeonEditorBoundaryStretchService;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewEffect;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.BoundaryStretchSession;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.DragSession;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.PaintSession;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInterpretation;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;

final class InterpretDungeonEditorMainViewPressUseCase {
    private final DungeonEditorBoundaryDraftUseCase boundaryDraft = new DungeonEditorBoundaryDraftUseCase();
    private final DungeonEditorCorridorInteractionUseCase corridor = new DungeonEditorCorridorInteractionUseCase();
    private final DungeonEditorBoundaryStretchService boundaryStretch = new DungeonEditorBoundaryStretchService();

    DungeonEditorMainViewInterpretation interpret(
            PointerState input,
            DungeonSnapshot snapshot,
            DungeonEditorSessionValues.Selection currentSelection,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        if (boundaryToolSelected(selectedTool)) {
            DungeonEditorMainViewInterpretation boundaryInterpretation =
                    boundaryDraft.press(input, snapshot, currentSelection, selectedTool, state);
            if (!boundaryInterpretation.effect().isNoop()) {
                InteractionState nextState = boundaryInterpretation.nextState()
                        .withDragSession(DragSession.none())
                        .withPaintSession(PaintSession.none());
                return new DungeonEditorMainViewInterpretation(nextState, boundaryInterpretation.effect());
            }
        }
        if (corridorToolSelected(selectedTool)) {
            InteractionState nextState = state
                    .withDragSession(DragSession.none())
                    .withPaintSession(PaintSession.none())
                    .withBoundaryStretchSession(BoundaryStretchSession.none());
            return corridor.press(input, snapshot, selectedTool, nextState);
        }
        if (roomPaintToolSelected(selectedTool)) {
            PaintSession paintSession = new PaintSession(
                    input.q(),
                    input.r(),
                    input.q(),
                    input.r(),
                    input.level(),
                    selectedTool.deleteMode(),
                    true);
            InteractionState nextState = state
                    .withPaintSession(paintSession)
                    .withDragSession(DragSession.none())
                    .withBoundaryStretchSession(BoundaryStretchSession.none());
            return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.preview(paintSession.preview()));
        }
        if (!selectionToolSelected(selectedTool)) {
            return new DungeonEditorMainViewInterpretation(state.clear(), DungeonEditorMainViewEffect.none());
        }
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

    private static boolean selectionToolSelected(DungeonEditorSessionValues.Tool selectedTool) {
        return selectedTool != null && selectedTool.isSelectionTool();
    }

    private static boolean boundaryToolSelected(DungeonEditorSessionValues.Tool selectedTool) {
        return selectedTool != null && selectedTool.isBoundaryTool();
    }

    private static boolean corridorToolSelected(DungeonEditorSessionValues.Tool selectedTool) {
        return selectedTool != null && selectedTool.isCorridorTool();
    }

    private static boolean roomPaintToolSelected(DungeonEditorSessionValues.Tool selectedTool) {
        return selectedTool != null && selectedTool.isRoomPaintTool();
    }
}
