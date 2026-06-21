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

    DungeonEditorSessionEffect room(
            PointerAction action,
            DungeonEditorMainViewInput input,
            DungeonEditorSessionValues.Tool roomTool,
            int projectionLevel
    ) {
        DungeonEditorMainViewInterpretation interpretation = switch (action) {
            case PRESS -> pressUseCase.interpretRoom(pointer(input, projectionLevel), roomTool, state.interactionState());
            case DRAG -> dragUseCase.interpretRoom(pointer(input, projectionLevel), state.interactionState());
            case RELEASE -> releaseUseCase.interpretRoom(pointer(input, projectionLevel), state.interactionState());
            case HOVER -> new DungeonEditorMainViewInterpretation(
                    state.interactionState(),
                    DungeonEditorSessionEffect.none());
        };
        state.replace(interpretation.nextState());
        return interpretation.effect();
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
