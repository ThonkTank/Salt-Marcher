package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.structure.transition.TransitionAnchor;
import src.domain.dungeon.model.core.structure.transition.TransitionDestinationType;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorAuthoredTransitionUseCase;
import src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorAuthoredTransitionUseCase;
import src.domain.dungeon.published.DungeonEditorTool;

final class DungeonEditorTransitionRuntimeOperation {
    private static final String INVALID_TRANSITION_DESTINATION_STATUS = "Uebergangsziel ungueltig.";
    private static final long NO_TRANSITION_ID = 0L;

    private final DungeonEditorSessionWorkflow workflow;
    private final CreateDungeonEditorAuthoredTransitionUseCase createTransitionUseCase;
    private final DeleteDungeonEditorAuthoredTransitionUseCase deleteTransitionUseCase;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    DungeonEditorTransitionRuntimeOperation(DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime) {
        DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases safeRuntime =
                Objects.requireNonNull(runtime, "runtime");
        workflow = Objects.requireNonNull(safeRuntime.workflow(), "workflow");
        createTransitionUseCase = Objects.requireNonNull(
                safeRuntime.authored().createTransitionUseCase(),
                "createTransitionUseCase");
        deleteTransitionUseCase = Objects.requireNonNull(
                safeRuntime.authored().deleteTransitionUseCase(),
                "deleteTransitionUseCase");
        effectUseCase = Objects.requireNonNull(safeRuntime.effectUseCase(), "effectUseCase");
    }

    static boolean handles(DungeonEditorTool tool) {
        return tool == DungeonEditorTool.TRANSITION_CREATE || tool == DungeonEditorTool.TRANSITION_DELETE;
    }

    DungeonEditorRuntimeOperationResult apply(
            PointerAction action,
            DungeonEditorTool tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (!PointerAction.isPressed(action)) {
            return DungeonEditorRuntimeOperationResult.none();
        }
        if (tool == DungeonEditorTool.TRANSITION_CREATE) {
            return createTransition(sample, wallSingleClickMode, transitionDestination);
        }
        if (tool == DungeonEditorTool.TRANSITION_DELETE) {
            return deleteTransition(sample, wallSingleClickMode, transitionDestination);
        }
        return DungeonEditorRuntimeOperationResult.none();
    }

    private DungeonEditorRuntimeOperationResult deleteTransition(
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (!workflow.session().hasSelectedMap()) {
            return DungeonEditorRuntimeResultTranslator.fromSnapshot(effectUseCase.publishCurrent());
        }
        long transitionId = DungeonEditorPointRuntimeTarget.targetId(
                sample,
                wallSingleClickMode,
                transitionDestination,
                DungeonTopologyElementKind.TRANSITION);
        if (transitionId <= NO_TRANSITION_ID) {
            return DungeonEditorRuntimeResultTranslator.fromSnapshot(effectUseCase.publishCurrent());
        }
        boolean deleted = deleteTransitionUseCase.execute(workflow.session().selectedMapId(), transitionId);
        if (deleted) {
            workflow.applyEffect(DungeonEditorSessionEffect.clearedSelection());
            workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        }
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(effectUseCase.publishCurrent());
    }

    private DungeonEditorRuntimeOperationResult createTransition(
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        TransitionAnchor anchor = transitionAnchor(
                sample,
                wallSingleClickMode,
                transitionDestination,
                workflow.session().projectionLevel());
        src.domain.dungeon.model.core.structure.transition.TransitionDestination destination =
                destination(transitionDestination);
        if (!workflow.session().hasSelectedMap()) {
            return DungeonEditorRuntimeResultTranslator.fromSnapshot(effectUseCase.publishCurrent());
        }
        if (!createTransitionUseCase.canExecute(workflow.session().selectedMapId(), anchor, destination)) {
            workflow.clearPreviewWithStatus(INVALID_TRANSITION_DESTINATION_STATUS);
            return DungeonEditorRuntimeResultTranslator.fromSnapshot(effectUseCase.publishCurrent());
        }
        createTransitionUseCase.execute(workflow.session().selectedMapId(), anchor, destination);
        workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(effectUseCase.publishCurrent());
    }

    private static TransitionAnchor transitionAnchor(
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination,
            int projectionLevel
    ) {
        DungeonEditorRuntimePointerTarget target = sample == null
                ? DungeonEditorRuntimePointerTarget.empty()
                : sample.target();
        if (target.isWallOrDoorBoundaryTarget()) {
            return transitionEdgeAnchor(sample, target.boundary());
        }
        if (target.isCellTarget()) {
            return TransitionAnchor.cell(DungeonEditorPointRuntimeTarget.anchor(
                    sample,
                    wallSingleClickMode,
                    transitionDestination,
                    projectionLevel));
        }
        return TransitionAnchor.none();
    }

    private static TransitionAnchor transitionEdgeAnchor(
            PointerSample sample,
            DungeonEditorRuntimePointerTarget.BoundaryTarget boundary
    ) {
        if (boundary.startLevel() != boundary.endLevel()) {
            return TransitionAnchor.none();
        }
        Cell baseCell = new Cell(
                (int) Math.floor(sample.sceneX()),
                (int) Math.floor(sample.sceneY()),
                boundary.startLevel());
        TransitionAnchor baseAnchor = matchingEdgeAnchor(baseCell, boundary);
        if (baseAnchor.isPlaced()) {
            return baseAnchor;
        }
        for (Direction direction : Direction.values()) {
            TransitionAnchor neighboringAnchor = matchingEdgeAnchor(direction.neighborOf(baseCell), boundary);
            if (neighboringAnchor.isPlaced()) {
                return neighboringAnchor;
            }
        }
        return TransitionAnchor.none();
    }

    private static TransitionAnchor matchingEdgeAnchor(
            Cell cell,
            DungeonEditorRuntimePointerTarget.BoundaryTarget boundary
    ) {
        for (Direction direction : Direction.values()) {
            Edge edge = direction.edgeOf(cell);
            if (matchesBoundary(edge, boundary)) {
                return TransitionAnchor.edge(cell, direction);
            }
        }
        return TransitionAnchor.none();
    }

    private static boolean matchesBoundary(
            Edge edge,
            DungeonEditorRuntimePointerTarget.BoundaryTarget boundary
    ) {
        return boundary.startLevel() == edge.from().level()
                && boundary.endLevel() == edge.to().level()
                && ((matchesEndpoint(edge.from(), boundary.startQ(), boundary.startR())
                                && matchesEndpoint(edge.to(), boundary.endQ(), boundary.endR()))
                        || (matchesEndpoint(edge.from(), boundary.endQ(), boundary.endR())
                                && matchesEndpoint(edge.to(), boundary.startQ(), boundary.startR())));
    }

    private static boolean matchesEndpoint(Cell cell, double q, double r) {
        return Double.compare(cell.q(), q) == 0 && Double.compare(cell.r(), r) == 0;
    }

    private static src.domain.dungeon.model.core.structure.transition.TransitionDestination destination(
            TransitionDestination runtimeDestination
    ) {
        TransitionDestination safeDestination =
                runtimeDestination == null ? TransitionDestination.empty() : runtimeDestination;
        TransitionDestinationType type = safeDestination.destinationType();
        if (type.isDungeonMap()) {
            return src.domain.dungeon.model.core.structure.transition.TransitionDestination.dungeonMap(
                    safeDestination.targetMapId(),
                    safeDestination.targetTransitionId() <= 0L ? null : safeDestination.targetTransitionId());
        }
        if (type.isOverworldTile()) {
            return src.domain.dungeon.model.core.structure.transition.TransitionDestination.overworldTile(
                    safeDestination.targetMapId(),
                    safeDestination.targetTileId());
        }
        if (type.isUnlinkedEntrance()) {
            return src.domain.dungeon.model.core.structure.transition.TransitionDestination.unlinkedEntrance();
        }
        return null;
    }
}
