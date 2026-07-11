package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.feature.FeatureMarkerKind;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.published.DungeonEditorTool;

final class DungeonEditorFeatureMarkerRuntimeOperation {
    private static final String INVALID_FEATURE_MARKER_STATUS = "Feature-Markierung ungueltig.";
    private static final long NO_MARKER_ID = 0L;
    private static final DungeonEditorToolRegistry TOOL_REGISTRY = DungeonEditorToolRegistry.current();

    private final DungeonEditorRuntimeContext context;

    DungeonEditorFeatureMarkerRuntimeOperation(DungeonEditorRuntimeContext context) {
        this.context = Objects.requireNonNull(context, "context");
    }

    static boolean handles(DungeonEditorTool tool) {
        return TOOL_REGISTRY.featureMarkerKind(tool) != null
                || tool == DungeonEditorTool.FEATURE_DELETE;
    }

    DungeonEditorRuntimeContext.Result apply(
            PointerAction action,
            DungeonEditorTool tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (!PointerAction.isPressed(action)) {
            return DungeonEditorRuntimeContext.Result.none();
        }
        FeatureMarkerKind markerKind = TOOL_REGISTRY.featureMarkerKind(tool);
        if (markerKind != null) {
            return createMarker(DungeonEditorPointRuntimeTarget.anchor(
                    sample,
                    wallSingleClickMode,
                    transitionDestination,
                    context.projectionLevel()), markerKind);
        }
        if (tool == DungeonEditorTool.FEATURE_DELETE) {
            return deleteMarker(sample, wallSingleClickMode, transitionDestination);
        }
        return DungeonEditorRuntimeContext.Result.none();
    }

    private DungeonEditorRuntimeContext.Result createMarker(Cell anchor, FeatureMarkerKind kind) {
        if (!context.hasSelectedMap() || anchor == null) {
            return context.publishCurrent();
        }
        if (!context.canCreateFeatureMarker(
                context.selectedMapId(),
                kind,
                anchor)) {
            context.clearPreviewWithStatus(INVALID_FEATURE_MARKER_STATUS);
            return context.publishCurrent();
        }
        long markerId = context.createFeatureMarker(
                context.selectedMapId(),
                kind,
                anchor);
        if (markerId <= NO_MARKER_ID) {
            context.clearPreviewWithStatus(INVALID_FEATURE_MARKER_STATUS);
            return context.publishCurrent();
        }
        context.applySessionEffect(DungeonEditorSessionEffect.select(
                markerSelection(markerId),
                context.currentFacts().mutationStatusText()));
        return context.publishCurrent();
    }

    private DungeonEditorRuntimeContext.Result deleteMarker(
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (!context.hasSelectedMap()) {
            return context.publishCurrent();
        }
        long markerId = DungeonEditorPointRuntimeTarget.targetId(
                sample,
                wallSingleClickMode,
                transitionDestination,
                DungeonTopologyElementKind.FEATURE_MARKER);
        if (markerId <= NO_MARKER_ID) {
            return context.publishCurrent();
        }
        boolean deleted = context.deleteFeatureMarker(context.selectedMapId(), markerId);
        if (deleted) {
            context.applySessionEffect(DungeonEditorSessionEffect.clearedSelection());
            context.clearPreviewWithStatus(context.currentFacts().mutationStatusText());
        }
        return context.publishCurrent();
    }

    private static DungeonEditorSessionValues.Selection markerSelection(long markerId) {
        return new DungeonEditorSessionValues.Selection(
                new DungeonTopologyRef(DungeonTopologyElementKind.FEATURE_MARKER, markerId),
                0L,
                false,
                DungeonEditorSessionValues.emptyHandleRef());
    }
}
