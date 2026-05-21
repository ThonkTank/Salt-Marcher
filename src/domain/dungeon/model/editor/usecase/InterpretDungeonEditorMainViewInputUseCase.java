package src.domain.dungeon.model.editor.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.helper.DungeonEditorMainViewInputBoundaryTranslationHelper;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInterpretation;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorMainViewInput;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.editor.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;

public final class InterpretDungeonEditorMainViewInputUseCase {
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

    private final InteractionStateHolder state = new InteractionStateHolder();

    public DungeonEditorMainViewEffect pressSelection(
            MainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection selection,
            int projectionLevel
    ) {
        return apply(pressUseCase.interpretSelection(pointer(input, projectionLevel), snapshot, selection, state.current()));
    }

    public DungeonEditorMainViewEffect dragSelection(
            MainViewInput input,
            int projectionLevel
    ) {
        return apply(dragUseCase.interpretSelection(pointer(input, projectionLevel), state.current()));
    }

    public DungeonEditorMainViewEffect releaseSelection(
            MainViewInput input,
            int projectionLevel
    ) {
        return apply(releaseUseCase.interpretSelection(pointer(input, projectionLevel), state.current()));
    }

    public DungeonEditorMainViewEffect hoverSelection() {
        return hoverUseCase.interpretSelection(state.current());
    }

    public DungeonEditorMainViewEffect scrollSelection(
            int levelDelta,
            int projectionLevel,
            @Nullable MapSnapshot snapshot
    ) {
        return apply(scrollUseCase.interpretSelection(levelDelta, projectionLevel, snapshot, state.current()));
    }

    public DungeonEditorMainViewEffect pressRoom(
            MainViewInput input,
            DungeonEditorSessionValues.Tool roomTool,
            int projectionLevel
    ) {
        return apply(pressUseCase.interpretRoom(pointer(input, projectionLevel), roomTool, state.current()));
    }

    public DungeonEditorMainViewEffect dragRoom(
            MainViewInput input,
            int projectionLevel
    ) {
        return apply(dragUseCase.interpretRoom(pointer(input, projectionLevel), state.current()));
    }

    public DungeonEditorMainViewEffect releaseRoom(
            MainViewInput input,
            int projectionLevel
    ) {
        return apply(releaseUseCase.interpretRoom(pointer(input, projectionLevel), state.current()));
    }

    public DungeonEditorMainViewEffect pressBoundary(
            MainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Tool boundaryTool,
            int projectionLevel
    ) {
        return apply(pressUseCase.interpretBoundary(
                pointer(input, projectionLevel),
                snapshot,
                selection,
                boundaryTool,
                state.current()));
    }

    public DungeonEditorMainViewEffect dragBoundary(
            MainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool boundaryTool,
            int projectionLevel
    ) {
        return apply(dragUseCase.interpretBoundary(pointer(input, projectionLevel), snapshot, boundaryTool, state.current()));
    }

    public DungeonEditorMainViewEffect releaseBoundary(
            MainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool boundaryTool,
            int projectionLevel
    ) {
        return apply(releaseUseCase.interpretBoundary(pointer(input, projectionLevel), snapshot, boundaryTool, state.current()));
    }

    public DungeonEditorMainViewEffect hoverBoundary(
            MainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool boundaryTool,
            int projectionLevel
    ) {
        return hoverUseCase.interpretBoundary(pointer(input, projectionLevel), snapshot, boundaryTool, state.current());
    }

    public DungeonEditorMainViewEffect pressCorridor(
            MainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool corridorTool,
            int projectionLevel
    ) {
        return apply(pressUseCase.interpretCorridor(pointer(input, projectionLevel), snapshot, corridorTool, state.current()));
    }

    public DungeonEditorMainViewEffect hoverCorridor(
            MainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool corridorTool,
            int projectionLevel
    ) {
        return hoverUseCase.interpretCorridor(pointer(input, projectionLevel), snapshot, corridorTool, state.current());
    }

    public void clear() {
        state.replace(state.current().clear());
    }

    private DungeonEditorMainViewEffect apply(DungeonEditorMainViewInterpretation interpretation) {
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

    private static final class InteractionStateHolder {
        private InteractionState current = InteractionState.empty();

        private InteractionState current() {
            return current;
        }

        private void replace(InteractionState next) {
            current = next;
        }
    }
}
