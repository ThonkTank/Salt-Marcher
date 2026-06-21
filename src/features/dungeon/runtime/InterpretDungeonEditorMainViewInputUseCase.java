package src.features.dungeon.runtime;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PointerState;

final class InterpretDungeonEditorMainViewInputUseCase {
    enum PointerAction {
        PRESS,
        DRAG,
        RELEASE,
        HOVER
    }

    private final DungeonEditorMainViewInputBoundaryTranslationHelper inputTranslator =
            new DungeonEditorMainViewInputBoundaryTranslationHelper();
    private final InterpretDungeonEditorMainViewPressUseCase pressUseCase =
            new InterpretDungeonEditorMainViewPressUseCase();
    private final InterpretDungeonEditorMainViewDragUseCase dragUseCase =
            new InterpretDungeonEditorMainViewDragUseCase();
    private final InterpretDungeonEditorMainViewReleaseUseCase releaseUseCase =
            new InterpretDungeonEditorMainViewReleaseUseCase();
    private final InterpretDungeonEditorMainViewHoverUseCase hoverUseCase =
            new InterpretDungeonEditorMainViewHoverUseCase();
    private final InterpretDungeonEditorMainViewScrollUseCase scrollUseCase =
            new InterpretDungeonEditorMainViewScrollUseCase();
    private final DungeonEditorMainViewInteractionState state;

    InterpretDungeonEditorMainViewInputUseCase(DungeonEditorMainViewInteractionState state) {
        this.state = java.util.Objects.requireNonNull(state, "state");
    }

    DungeonEditorSessionEffect selection(
            PointerAction action,
            DungeonEditorMainViewInput input,
            @Nullable MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection selection,
            int projectionLevel
    ) {
        if (action == PointerAction.HOVER) {
            return hoverUseCase.interpretSelection(state.interactionState());
        }
        DungeonEditorMainViewInterpretation interpretation = switch (action) {
            case PRESS -> pressUseCase.interpretSelection(
                    pointer(input, projectionLevel),
                    snapshot,
                    selection,
                    state.interactionState());
            case DRAG -> dragUseCase.interpretSelection(pointer(input, projectionLevel), state.interactionState());
            case RELEASE -> releaseUseCase.interpretSelection(pointer(input, projectionLevel), state.interactionState());
            case HOVER -> throw new IllegalStateException("handled above");
        };
        state.replace(interpretation.nextState());
        return interpretation.effect();
    }

    DungeonEditorSessionEffect scrollSelection(
            int levelDelta,
            int projectionLevel,
            @Nullable MapSnapshot snapshot
    ) {
        DungeonEditorMainViewInterpretation interpretation =
                scrollUseCase.interpretSelection(levelDelta, projectionLevel, snapshot, state.interactionState());
        state.replace(interpretation.nextState());
        return interpretation.effect();
    }

    DungeonEditorRoomPaintInterpretation roomPaintOperation(
            PointerAction action,
            DungeonEditorMainViewInput input,
            DungeonEditorSessionValues.Tool roomTool,
            int projectionLevel
    ) {
        DungeonEditorRoomPaintInterpretation interpretation = switch (action) {
            case PRESS -> DungeonEditorRoomPaintInterpretation.from(
                    pressUseCase.interpretRoom(pointer(input, projectionLevel), roomTool, state.interactionState()));
            case DRAG -> DungeonEditorRoomPaintInterpretation.from(
                    dragUseCase.interpretRoom(pointer(input, projectionLevel), state.interactionState()));
            case RELEASE -> releaseUseCase.interpretRoomPaintOperation(
                    pointer(input, projectionLevel),
                    state.interactionState());
            case HOVER -> new DungeonEditorRoomPaintInterpretation(
                    state.interactionState(),
                    DungeonEditorSessionEffect.none(),
                    null);
        };
        state.replace(interpretation.nextState());
        return interpretation;
    }

    DungeonEditorSessionEffect boundary(
            PointerAction action,
            DungeonEditorMainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Tool boundaryTool,
            int projectionLevel
    ) {
        if (action == PointerAction.HOVER) {
            return hoverUseCase.interpretBoundary(pointer(input, projectionLevel), snapshot, boundaryTool, state.interactionState());
        }
        DungeonEditorMainViewInterpretation interpretation = switch (action) {
            case PRESS -> pressUseCase.interpretBoundary(
                    pointer(input, projectionLevel),
                    snapshot,
                    selection,
                    boundaryTool,
                    state.interactionState());
            case DRAG -> dragUseCase.interpretBoundary(
                    pointer(input, projectionLevel),
                    snapshot,
                    boundaryTool,
                    state.interactionState());
            case RELEASE -> releaseUseCase.interpretBoundary(
                    pointer(input, projectionLevel),
                    snapshot,
                    boundaryTool,
                    state.interactionState());
            case HOVER -> throw new IllegalStateException("handled above");
        };
        state.replace(interpretation.nextState());
        return interpretation.effect();
    }

    DungeonEditorWallBoundaryDraftInterpretation wallBoundaryOperation(
            PointerAction action,
            DungeonEditorMainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Tool boundaryTool,
            int projectionLevel
    ) {
        DungeonEditorWallBoundaryDraftInterpretation interpretation = switch (action) {
            case PRESS -> pressUseCase.interpretWallBoundaryOperation(
                    pointer(input, projectionLevel),
                    snapshot,
                    selection,
                    boundaryTool,
                    state.interactionState());
            case DRAG -> DungeonEditorWallBoundaryDraftInterpretation.from(dragUseCase.interpretBoundary(
                    pointer(input, projectionLevel),
                    snapshot,
                    boundaryTool,
                    state.interactionState()));
            case RELEASE -> releaseUseCase.interpretWallBoundaryOperation(
                    pointer(input, projectionLevel),
                    snapshot,
                    boundaryTool,
                    state.interactionState());
            case HOVER -> hoverWallBoundaryOperation(input, snapshot, boundaryTool, projectionLevel);
        };
        state.replace(interpretation.nextState());
        return interpretation;
    }

    private DungeonEditorWallBoundaryDraftInterpretation hoverWallBoundaryOperation(
            DungeonEditorMainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool boundaryTool,
            int projectionLevel
    ) {
        return new DungeonEditorWallBoundaryDraftInterpretation(
                state.interactionState(),
                hoverUseCase.interpretBoundary(
                        pointer(input, projectionLevel),
                        snapshot,
                        boundaryTool,
                        state.interactionState()),
                null);
    }

    DungeonEditorSessionEffect corridor(
            PointerAction action,
            DungeonEditorMainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool corridorTool,
            int projectionLevel
    ) {
        if (action == PointerAction.HOVER) {
            return hoverUseCase.interpretCorridor(pointer(input, projectionLevel), snapshot, corridorTool, state.interactionState());
        }
        DungeonEditorMainViewInterpretation interpretation = switch (action) {
            case PRESS -> pressUseCase.interpretCorridor(
                    pointer(input, projectionLevel),
                    snapshot,
                    corridorTool,
                    state.interactionState());
            case DRAG, RELEASE -> new DungeonEditorMainViewInterpretation(
                    state.interactionState(),
                    DungeonEditorSessionEffect.none());
            case HOVER -> throw new IllegalStateException("handled above");
        };
        state.replace(interpretation.nextState());
        return interpretation.effect();
    }

    private PointerState pointer(DungeonEditorMainViewInput input, int projectionLevel) {
        DungeonEditorMainViewInput safeInput = input == null
                ? DungeonEditorMainViewInput.empty()
                : input;
        return inputTranslator.resolvePointerState(
                safeInput.canvasX(),
                safeInput.canvasY(),
                projectionLevel,
                safeInput.primaryButtonDown(),
                safeInput.secondaryButtonDown(),
                safeInput.wallSingleClickMode(),
                safeInput.target());
    }
}
