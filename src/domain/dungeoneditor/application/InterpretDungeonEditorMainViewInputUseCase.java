package src.domain.dungeoneditor.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewEffect;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInterpretation;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionCommand;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.MapSnapshot;

final class InterpretDungeonEditorMainViewInputUseCase {
    private final DungeonEditorMainViewInputBoundaryTranslator inputTranslator =
            new DungeonEditorMainViewInputBoundaryTranslator();
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

    private InteractionState state = InteractionState.empty();

    DungeonEditorMainViewEffect consume(
            DungeonEditorSessionCommand.MainViewInput input,
            @Nullable MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Tool selectedTool,
            DungeonEditorSessionValues.ViewMode viewMode,
            int projectionLevel
    ) {
        DungeonEditorSessionCommand.MainViewInput safeInput = input == null
                ? DungeonEditorSessionCommand.MainViewInput.empty()
                : input;
        if (safeInput.isLevelScrolled()) {
            return apply(scrollUseCase.interpret(
                    safeInput.levelDelta(),
                    selectedTool,
                    projectionLevel,
                    snapshot,
                    state));
        }
        if (!pointerInteractionEnabled(viewMode, snapshot)) {
            return DungeonEditorMainViewEffect.none();
        }
        MapSnapshot activeSnapshot = snapshot;
        PointerState pointer = inputTranslator.resolvePointerState(
                safeInput.canvasX(),
                safeInput.canvasY(),
                projectionLevel,
                safeInput.primaryButtonDown(),
                safeInput.secondaryButtonDown(),
                safeInput.hitRef());
        return pointerEffect(safeInput, pointer, activeSnapshot, selection, selectedTool);
    }

    void clear() {
        state = state.clear();
    }

    private DungeonEditorMainViewEffect apply(DungeonEditorMainViewInterpretation interpretation) {
        state = interpretation.nextState();
        return interpretation.effect();
    }

    private DungeonEditorMainViewEffect pointerEffect(
            DungeonEditorSessionCommand.MainViewInput input,
            PointerState pointer,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Tool selectedTool
    ) {
        return switch (input.source()) {
            case POINTER_PRESSED -> apply(pressUseCase.interpret(pointer, snapshot, selection, selectedTool, state));
            case POINTER_DRAGGED -> apply(dragUseCase.interpret(pointer, snapshot, selectedTool, state));
            case POINTER_RELEASED -> apply(releaseUseCase.interpret(pointer, selectedTool, state));
            case POINTER_MOVED -> hoverUseCase.interpret(pointer, snapshot, selectedTool, state);
            case LEVEL_SCROLLED -> DungeonEditorMainViewEffect.none();
        };
    }

    private static boolean pointerInteractionEnabled(
            DungeonEditorSessionValues.ViewMode viewMode,
            @Nullable MapSnapshot snapshot
    ) {
        return viewMode != null && viewMode.isGrid() && snapshot != null;
    }
}
