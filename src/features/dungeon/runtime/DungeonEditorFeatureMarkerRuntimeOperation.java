package src.features.dungeon.runtime;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
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
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerAction;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerSample;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.TransitionDestination;

final class DungeonEditorFeatureMarkerRuntimeOperation {
    private static final String INVALID_FEATURE_MARKER_STATUS = "Feature-Markierung ungueltig.";
    private static final long NO_MARKER_ID = 0L;

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
        return kindFor(tool) != null || tool == DungeonEditorTool.FEATURE_DELETE;
    }

    void apply(
            PointerAction action,
            DungeonEditorTool tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (action != PointerAction.PRESSED) {
            return;
        }
        FeatureMarkerKind markerKind = kindFor(tool);
        if (markerKind != null) {
            createMarker(DungeonEditorPointRuntimeTarget.anchor(
                    sample,
                    wallSingleClickMode,
                    transitionDestination,
                    workflow.session().projectionLevel()), markerKind);
            return;
        }
        if (tool == DungeonEditorTool.FEATURE_DELETE) {
            deleteMarker(sample, wallSingleClickMode, transitionDestination);
        }
    }

    private void createMarker(Cell anchor, FeatureMarkerKind kind) {
        if (!workflow.session().hasSelectedMap() || anchor == null) {
            effectUseCase.publishCurrent();
            return;
        }
        if (!createFeatureMarkerUseCase.canExecute(workflow.session().selectedMapId(), kind, anchor)) {
            workflow.clearPreviewWithStatus(INVALID_FEATURE_MARKER_STATUS);
            effectUseCase.publishCurrent();
            return;
        }
        long markerId = createFeatureMarkerUseCase.execute(workflow.session().selectedMapId(), kind, anchor);
        if (markerId <= NO_MARKER_ID) {
            workflow.clearPreviewWithStatus(INVALID_FEATURE_MARKER_STATUS);
            effectUseCase.publishCurrent();
            return;
        }
        workflow.applyEffect(DungeonEditorSessionEffect.select(
                markerSelection(markerId),
                effectUseCase.currentFacts().mutationStatusText()));
        effectUseCase.publishCurrent();
    }

    private void deleteMarker(
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (!workflow.session().hasSelectedMap()) {
            effectUseCase.publishCurrent();
            return;
        }
        long markerId = DungeonEditorPointRuntimeTarget.targetId(
                sample,
                wallSingleClickMode,
                transitionDestination,
                DungeonTopologyElementKind.FEATURE_MARKER);
        if (markerId <= NO_MARKER_ID) {
            effectUseCase.publishCurrent();
            return;
        }
        boolean deleted = deleteFeatureMarkerUseCase.execute(workflow.session().selectedMapId(), markerId);
        if (deleted) {
            workflow.applyEffect(DungeonEditorSessionEffect.clearedSelection());
            workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        }
        effectUseCase.publishCurrent();
    }

    private static DungeonEditorSessionValues.Selection markerSelection(long markerId) {
        return new DungeonEditorSessionValues.Selection(
                new DungeonTopologyRef(DungeonTopologyElementKind.FEATURE_MARKER, markerId),
                0L,
                false,
                DungeonEditorSessionValues.emptyHandleRef());
    }

    private static @Nullable FeatureMarkerKind kindFor(DungeonEditorTool tool) {
        if (tool == DungeonEditorTool.FEATURE_POI_CREATE) {
            return FeatureMarkerKind.POI;
        }
        if (tool == DungeonEditorTool.FEATURE_OBJECT_CREATE) {
            return FeatureMarkerKind.OBJECT;
        }
        if (tool == DungeonEditorTool.FEATURE_ENCOUNTER_CREATE) {
            return FeatureMarkerKind.ENCOUNTER;
        }
        return null;
    }
}
