package src.domain.dungeon.model.worldspace.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.helper.DungeonEditorMainViewInputBoundaryTranslationHelper;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorMainViewInteractionState;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorMainViewInterpretation;
import src.domain.dungeon.model.worldspace.model.session.model.DungeonEditorMainViewInput;
import src.domain.dungeon.model.worldspace.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.worldspace.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;

public final class InterpretDungeonEditorMainViewInputUseCase {
    public enum PointerAction {
        PRESS,
        DRAG,
        RELEASE,
        HOVER
    }

    private final DungeonEditorMainViewInputBoundaryTranslationHelper inputTranslator =
            new DungeonEditorMainViewInputBoundaryTranslationHelper();
    private final BuildDungeonEditorMainViewInputUseCase inputBuilder =
            new BuildDungeonEditorMainViewInputUseCase();
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
    private final DungeonEditorMainViewInteractionState state = new DungeonEditorMainViewInteractionState();

    public void clear() {
        state.clear();
    }

    public DungeonEditorMainViewEffect selection(
            PointerAction action,
            MainViewInput input,
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

    public DungeonEditorMainViewEffect scrollSelection(
            int levelDelta,
            int projectionLevel,
            @Nullable MapSnapshot snapshot
    ) {
        DungeonEditorMainViewInterpretation interpretation =
                scrollUseCase.interpretSelection(levelDelta, projectionLevel, snapshot, state.interactionState());
        state.replace(interpretation.nextState());
        return interpretation.effect();
    }

    public DungeonEditorMainViewEffect room(
            PointerAction action,
            MainViewInput input,
            DungeonEditorSessionValues.Tool roomTool,
            int projectionLevel
    ) {
        DungeonEditorMainViewInterpretation interpretation = switch (action) {
            case PRESS -> pressUseCase.interpretRoom(pointer(input, projectionLevel), roomTool, state.interactionState());
            case DRAG -> dragUseCase.interpretRoom(pointer(input, projectionLevel), state.interactionState());
            case RELEASE -> releaseUseCase.interpretRoom(pointer(input, projectionLevel), state.interactionState());
            case HOVER -> new DungeonEditorMainViewInterpretation(
                    state.interactionState(),
                    DungeonEditorMainViewEffect.none());
        };
        state.replace(interpretation.nextState());
        return interpretation.effect();
    }

    public DungeonEditorMainViewEffect boundary(
            PointerAction action,
            MainViewInput input,
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

    public DungeonEditorMainViewEffect corridor(
            PointerAction action,
            MainViewInput input,
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
                    DungeonEditorMainViewEffect.none());
            case HOVER -> throw new IllegalStateException("handled above");
        };
        state.replace(interpretation.nextState());
        return interpretation.effect();
    }

    private PointerState pointer(MainViewInput input, int projectionLevel) {
        DungeonEditorMainViewInput safeInput = input == null
                ? DungeonEditorMainViewInput.empty()
                : inputBuilder.execute(input);
        return inputTranslator.resolvePointerState(
                safeInput.canvasX(),
                safeInput.canvasY(),
                projectionLevel,
                safeInput.primaryButtonDown(),
                safeInput.secondaryButtonDown(),
                safeInput.target());
    }
}
