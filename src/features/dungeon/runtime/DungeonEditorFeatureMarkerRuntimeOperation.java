package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.feature.FeatureMarkerKind;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorAuthoredFeatureMarkerUseCase;
import src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorAuthoredFeatureMarkerUseCase;
import src.domain.dungeon.published.DungeonEditorTool;

final class DungeonEditorFeatureMarkerRuntimeOperation {
    private static final String INVALID_FEATURE_MARKER_STATUS = "Feature-Markierung ungueltig.";
    private static final long NO_MARKER_ID = 0L;
    private static final DungeonEditorToolRegistry TOOL_REGISTRY = DungeonEditorToolRegistry.current();

    private final DungeonEditorSessionWorkflow workflow;
    private final CreateDungeonEditorAuthoredFeatureMarkerUseCase createFeatureMarkerUseCase;
    private final DeleteDungeonEditorAuthoredFeatureMarkerUseCase deleteFeatureMarkerUseCase;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    DungeonEditorFeatureMarkerRuntimeOperation(DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime) {
        DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases safeRuntime =
                Objects.requireNonNull(runtime, "runtime");
        workflow = Objects.requireNonNull(safeRuntime.workflow(), "workflow");
        createFeatureMarkerUseCase = Objects.requireNonNull(
                safeRuntime.authored().createFeatureMarkerUseCase(),
                "createFeatureMarkerUseCase");
        deleteFeatureMarkerUseCase = Objects.requireNonNull(
                safeRuntime.authored().deleteFeatureMarkerUseCase(),
                "deleteFeatureMarkerUseCase");
        effectUseCase = Objects.requireNonNull(safeRuntime.effectUseCase(), "effectUseCase");
    }

    static boolean handles(DungeonEditorTool tool) {
        return TOOL_REGISTRY.featureMarkerKind(tool) != null
                || tool == DungeonEditorTool.FEATURE_DELETE;
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
        FeatureMarkerKind markerKind = TOOL_REGISTRY.featureMarkerKind(tool);
        if (markerKind != null) {
            return createMarker(DungeonEditorPointRuntimeTarget.anchor(
                    sample,
                    wallSingleClickMode,
                    transitionDestination,
                    workflow.session().projectionLevel()), markerKind);
        }
        if (tool == DungeonEditorTool.FEATURE_DELETE) {
            return deleteMarker(sample, wallSingleClickMode, transitionDestination);
        }
        return DungeonEditorRuntimeOperationResult.none();
    }

    private DungeonEditorRuntimeOperationResult createMarker(Cell anchor, FeatureMarkerKind kind) {
        if (!workflow.session().hasSelectedMap() || anchor == null) {
            return DungeonEditorRuntimeResultTranslator.fromSnapshot(effectUseCase.publishCurrent());
        }
        if (!createFeatureMarkerUseCase.canExecute(workflow.session().selectedMapId(), kind, anchor)) {
            workflow.clearPreviewWithStatus(INVALID_FEATURE_MARKER_STATUS);
            return DungeonEditorRuntimeResultTranslator.fromSnapshot(effectUseCase.publishCurrent());
        }
        long markerId = createFeatureMarkerUseCase.execute(workflow.session().selectedMapId(), kind, anchor);
        if (markerId <= NO_MARKER_ID) {
            workflow.clearPreviewWithStatus(INVALID_FEATURE_MARKER_STATUS);
            return DungeonEditorRuntimeResultTranslator.fromSnapshot(effectUseCase.publishCurrent());
        }
        workflow.applyEffect(DungeonEditorSessionEffect.select(
                markerSelection(markerId),
                effectUseCase.currentFacts().mutationStatusText()));
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(effectUseCase.publishCurrent());
    }

    private DungeonEditorRuntimeOperationResult deleteMarker(
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (!workflow.session().hasSelectedMap()) {
            return DungeonEditorRuntimeResultTranslator.fromSnapshot(effectUseCase.publishCurrent());
        }
        long markerId = DungeonEditorPointRuntimeTarget.targetId(
                sample,
                wallSingleClickMode,
                transitionDestination,
                DungeonTopologyElementKind.FEATURE_MARKER);
        if (markerId <= NO_MARKER_ID) {
            return DungeonEditorRuntimeResultTranslator.fromSnapshot(effectUseCase.publishCurrent());
        }
        boolean deleted = deleteFeatureMarkerUseCase.execute(workflow.session().selectedMapId(), markerId);
        if (deleted) {
            workflow.applyEffect(DungeonEditorSessionEffect.clearedSelection());
            workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        }
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(effectUseCase.publishCurrent());
    }

    private static DungeonEditorSessionValues.Selection markerSelection(long markerId) {
        return new DungeonEditorSessionValues.Selection(
                new DungeonTopologyRef(DungeonTopologyElementKind.FEATURE_MARKER, markerId),
                0L,
                false,
                DungeonEditorSessionValues.emptyHandleRef());
    }
}
