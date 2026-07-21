package features.dungeon.application.editor;

import java.util.Objects;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.stair.StairGeometryDerivation;
import features.dungeon.domain.core.structure.stair.StairGeometrySpec;
import features.dungeon.domain.core.structure.stair.StairShape;
import features.dungeon.application.editor.session.DungeonEditorSessionEffect;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.api.editor.DungeonEditorToolFamily;

final class DungeonEditorStairDraftRuntimeOperation {
    private static final String INVALID_PREFIX = "Treppengeometrie ungueltig: ";
    private static final String START_STATUS = "Treppenstart gesetzt. Zielpunkt auf anderer Ebene waehlen.";
    private static final String ROOM_INTERIOR_STATUS = INVALID_PREFIX + "Pfad kreuzt Rauminneres.";

    private final DungeonEditorRuntimeContext context;
    private final StairGeometryDerivation derivation = new StairGeometryDerivation();
    private Draft draft = Draft.inactive();

    DungeonEditorStairDraftRuntimeOperation(DungeonEditorRuntimeContext context) {
        this.context = Objects.requireNonNull(context, "context");
    }

    static boolean handles(DungeonEditorToolAction tool) {
        return tool != null && tool.family() == DungeonEditorToolFamily.STAIR && !tool.deleteMode();
    }

    DungeonEditorRuntimeContext.Result apply(
            PointerAction action,
            DungeonEditorToolAction tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (!context.hasSelectedMap()) {
            return context.publishCurrent();
        }
        Cell pointerCell = pointerCell(sample, wallSingleClickMode, transitionDestination);
        return switch (action) {
            case PRESSED -> press(tool, pointerCell);
            case MOVED, DRAGGED -> preview(tool, pointerCell);
            case RELEASED -> DungeonEditorRuntimeContext.Result.none();
        };
    }

    DungeonEditorRuntimeContext.Result refreshAfterProjectionLevelChanged() {
        if (!draft.active()) {
            return DungeonEditorRuntimeContext.Result.none();
        }
        Cell end = new Cell(draft.end().q(), draft.end().r(), context.projectionLevel());
        return preview(draft.tool(), end);
    }

    void clear() {
        draft = Draft.inactive();
    }

    private DungeonEditorRuntimeContext.Result press(DungeonEditorToolAction tool, Cell pointerCell) {
        if (!draft.active() || !draft.tool().equals(tool)) {
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
        return context.fromPublication(context.applyEffectPublication(
                DungeonEditorSessionEffect.apply(preview),
                mapId -> context.createStair(mapId, spec)));
    }

    private DungeonEditorRuntimeContext.Result preview(DungeonEditorToolAction tool, Cell pointerCell) {
        if (!draft.active()) {
            return DungeonEditorRuntimeContext.Result.none();
        }
        if (!draft.tool().equals(tool)) {
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
                && context.canCreateStair(context.selectedMapId(), result.spec());
    }

    private DungeonEditorRuntimeContext.Result publishPreview(
            StairShape shape,
            StairGeometryDerivation.Result result,
            String statusText
    ) {
        DungeonEditorSessionValues.StairCreatePreview preview = stairPreview(shape, result, statusText);
        return context.fromPublication(
                context.applyEffectPublication(DungeonEditorSessionEffect.preview(preview), null));
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
        DungeonEditorMainViewInput input = DungeonEditorMainViewInput.fromPointer(
                sample,
                wallSingleClickMode,
                transitionDestination);
        return new Cell(
                (int) Math.floor(input.canvasX()),
                (int) Math.floor(input.canvasY()),
                context.projectionLevel());
    }

    private static StairShape shapeFor(DungeonEditorToolAction tool) {
        return tool.stairShape();
    }

    private static features.dungeon.domain.core.geometry.Cell workspaceCell(Cell cell) {
        Cell safeCell = cell == null ? new Cell(0, 0, 0) : cell;
        return new features.dungeon.domain.core.geometry.Cell(safeCell.q(), safeCell.r(), safeCell.level());
    }

    private record Draft(DungeonEditorToolAction tool, Cell start, Cell end) {
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
