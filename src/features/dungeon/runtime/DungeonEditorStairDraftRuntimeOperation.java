package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.stair.StairGeometryDerivation;
import src.domain.dungeon.model.core.structure.stair.StairGeometrySpec;
import src.domain.dungeon.model.core.structure.stair.StairShape;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorAuthoredStairUseCase;
import src.domain.dungeon.published.DungeonEditorTool;

@SuppressWarnings("PMD.TooManyMethods")
final class DungeonEditorStairDraftRuntimeOperation {
    private static final String INVALID_PREFIX = "Treppengeometrie ungueltig: ";
    private static final String START_STATUS = "Treppenstart gesetzt. Zielpunkt auf anderer Ebene waehlen.";
    private static final String ROOM_INTERIOR_STATUS = INVALID_PREFIX + "Pfad kreuzt Rauminneres.";
    private static final DungeonEditorToolRegistry TOOL_REGISTRY = DungeonEditorToolRegistry.current();

    private final DungeonEditorSessionWorkflow workflow;
    private final CreateDungeonEditorAuthoredStairUseCase createStairUseCase;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;
    private final StairGeometryDerivation derivation = new StairGeometryDerivation();
    private Draft draft = Draft.inactive();

    DungeonEditorStairDraftRuntimeOperation(DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime) {
        DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases safeRuntime =
                Objects.requireNonNull(runtime, "runtime");
        workflow = safeRuntime.workflow();
        createStairUseCase = safeRuntime.authored().createStairUseCase();
        effectUseCase = safeRuntime.effectUseCase();
    }

    static boolean handles(DungeonEditorTool tool) {
        return TOOL_REGISTRY.isStairCreateTool(tool);
    }

    DungeonEditorRuntimeOperationResult apply(
            PointerAction action,
            DungeonEditorTool tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (!workflow.session().hasSelectedMap()) {
            return DungeonEditorAuthoredRuntimeOperations.resultFromSnapshot(effectUseCase.publishCurrent());
        }
        Cell pointerCell = pointerCell(sample, wallSingleClickMode, transitionDestination);
        return switch (action) {
            case PRESSED -> press(tool, pointerCell);
            case MOVED, DRAGGED -> preview(tool, pointerCell);
            case RELEASED -> DungeonEditorRuntimeOperationResult.none();
        };
    }

    DungeonEditorRuntimeOperationResult refreshAfterProjectionLevelChanged() {
        if (!draft.active()) {
            return DungeonEditorRuntimeOperationResult.none();
        }
        Cell end = new Cell(draft.end().q(), draft.end().r(), workflow.session().projectionLevel());
        return preview(draft.tool(), end);
    }

    void clear() {
        draft = Draft.inactive();
    }

    private DungeonEditorRuntimeOperationResult press(DungeonEditorTool tool, Cell pointerCell) {
        if (!draft.active() || draft.tool() != tool) {
            StairShape shape = shapeFor(tool);
            draft = new Draft(tool, pointerCell, pointerCell);
            return publishPreview(shape, derivation.derive(pointerCell, pointerCell, shape), START_STATUS);
        }
        StairShape shape = shapeFor(draft.tool());
        StairGeometryDerivation.Result result = derivation.derive(draft.start(), pointerCell, shape);
        if (!validForCurrentMap(result)) {
            draft = draft.withEnd(pointerCell);
            return publishPreview(shape, result, rejectionStatus(result));
        }
        StairGeometrySpec spec = result.spec();
        DungeonEditorSessionValues.StairCreatePreview preview = stairPreview(shape, result, "");
        draft = Draft.inactive();
        return DungeonEditorAuthoredRuntimeOperations.resultFromSnapshot(effectUseCase.applyEffect(
                DungeonEditorSessionEffect.apply(preview),
                mapId -> createStairUseCase.execute(mapId, spec)));
    }

    private DungeonEditorRuntimeOperationResult preview(DungeonEditorTool tool, Cell pointerCell) {
        if (!draft.active()) {
            return DungeonEditorRuntimeOperationResult.none();
        }
        if (draft.tool() != tool) {
            StairShape shape = shapeFor(tool);
            draft = new Draft(tool, pointerCell, pointerCell);
            return publishPreview(shape, derivation.derive(pointerCell, pointerCell, shape), START_STATUS);
        }
        draft = draft.withEnd(pointerCell);
        StairShape shape = shapeFor(tool);
        StairGeometryDerivation.Result result = derivation.derive(draft.start(), draft.end(), shape);
        return publishPreview(shape, result, validForCurrentMap(result) ? "" : rejectionStatus(result));
    }

    private boolean validForCurrentMap(StairGeometryDerivation.Result result) {
        return result != null
                && result.valid()
                && createStairUseCase.canExecute(workflow.session().selectedMapId(), result.spec());
    }

    private DungeonEditorRuntimeOperationResult publishPreview(
            StairShape shape,
            StairGeometryDerivation.Result result,
            String statusText
    ) {
        DungeonEditorSessionValues.StairCreatePreview preview = stairPreview(shape, result, statusText);
        return DungeonEditorAuthoredRuntimeOperations.resultFromSnapshot(
                effectUseCase.applyEffect(DungeonEditorSessionEffect.preview(preview), null));
    }

    private DungeonEditorSessionValues.StairCreatePreview stairPreview(
            StairShape shape,
            StairGeometryDerivation.Result result,
            String statusText
    ) {
        StairGeometrySpec spec = result == null ? null : result.spec();
        boolean valid = spec != null && statusText.isBlank();
        return new DungeonEditorSessionValues.StairCreatePreview(
                workspaceCell(draft.start()),
                workspaceCell(draft.end()),
                workspaceCell(spec == null ? draft.start() : spec.anchor()),
                shape.name(),
                spec == null ? "NORTH" : spec.direction().name(),
                spec == null ? 0 : spec.dimension1(),
                spec == null ? 0 : spec.dimension2(),
                valid,
                statusText);
    }

    private String rejectionStatus(StairGeometryDerivation.Result result) {
        if (result != null && result.valid()) {
            return ROOM_INTERIOR_STATUS;
        }
        return INVALID_PREFIX + StairGeometryDerivation.rejectionStatusDetail(result);
    }

    private Cell pointerCell(
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DungeonEditorMainViewInput input = DungeonEditorRuntimeInputTranslator.mainViewInput(
                sample,
                wallSingleClickMode,
                transitionDestination);
        return new Cell(
                (int) Math.floor(input.canvasX()),
                (int) Math.floor(input.canvasY()),
                workflow.session().projectionLevel());
    }

    private static StairShape shapeFor(DungeonEditorTool tool) {
        return TOOL_REGISTRY.stairShape(tool);
    }

    private static DungeonEditorWorkspaceValues.Cell workspaceCell(Cell cell) {
        Cell safeCell = cell == null ? new Cell(0, 0, 0) : cell;
        return new DungeonEditorWorkspaceValues.Cell(safeCell.q(), safeCell.r(), safeCell.level());
    }

    private record Draft(DungeonEditorTool tool, Cell start, Cell end) {
        static Draft inactive() {
            return new Draft(null, null, null);
        }

        boolean active() {
            return tool != null && start != null && end != null;
        }

        Draft withEnd(Cell nextEnd) {
            return new Draft(tool, start, nextEnd);
        }
    }
}
