package src.features.dungeon.runtime;

import java.util.List;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonOverlaySettings;

final class DungeonEditorRuntimeFrameFactsAssembler {
    private DungeonEditorMapSurfaceSnapshot cachedMapSurfaceSnapshot = DungeonEditorMapSurfaceSnapshot.empty();
    private DungeonEditorPreparedFrameFacts.MapInteractionFrame cachedMapInteractionFrame =
            DungeonEditorPreparedFrameFacts.MapInteractionFrame.empty();
    private long mapInteractionFrameRecomputeCount;
    private long mapInteractionFrameRecomputeNanos;

    DungeonEditorPreparedFrameFacts preparedFacts(
            DungeonEditorControlsSnapshot controlsSnapshot,
            DungeonEditorMapSurfaceSnapshot mapSurfaceSnapshot,
            DungeonEditorStateSnapshot stateSnapshot,
            DungeonEditorRuntimeDraftFrame draftFrame
    ) {
        RuntimeFrameSelection frameSelection = currentFrameSelection(controlsSnapshot);
        long selectedMapIdValue = frameSelection.selectedMapId() == null
                ? 0L
                : frameSelection.selectedMapId().value();
        String preparedStatusText = DungeonEditorPreparedMapEntries.statusTextFor(
                frameSelection.surfaceLoaded(),
                frameSelection.mapEntries(),
                frameSelection.selectedMapId(),
                frameSelection.statusText());
        String viewModeLabel = DungeonEditorPreparedFrameFacts.labelForViewMode(frameSelection.viewModeKey());
        DungeonEditorPreparedFrameFacts.OverlayFrame overlayFrame =
                DungeonEditorPreparedFrameFacts.OverlayFrame.from(frameSelection.overlaySettings());
        DungeonEditorStateSnapshot safeState = stateSnapshot == null
                ? emptyStateSnapshot()
                : stateSnapshot;
        DungeonEditorRuntimeDraftFrame safeDraftFrame = draftFrame == null
                ? emptyDraftFrame()
                : draftFrame;
        long selectedTransitionId =
                DungeonEditorPreparedFrameFacts.StatePanelFrame.selectedTransitionId(safeState.selection());
        TransitionDestination transitionDestination =
                DungeonEditorPreparedFrameFacts.StatePanelFrame.transitionDestinationFor(
                        selectedMapIdValue,
                        frameSelection.selectedToolKey(),
                        selectedTransitionId,
                        safeDraftFrame.transitionDestinationDraft());
        return new DungeonEditorPreparedFrameFacts(
                frameSelection.mapEntries(),
                keyOf(frameSelection.selectedMapId()),
                selectedMapIdValue,
                frameSelection.reachableLevels(),
                false,
                preparedStatusText,
                frameSelection.viewModeKey(),
                viewModeLabel,
                frameSelection.overlaySettings(),
                overlayFrame,
                frameSelection.projectionLevel(),
                frameSelection.selectedToolKey(),
                frameSelection.selectedToolLabel(),
                DungeonEditorPreparedFrameFacts.MapSurfaceFrame.from(
                        mapSurfaceSnapshot,
                        frameSelection.viewModeKey(),
                        frameSelection.overlaySettings(),
                        frameSelection.projectionLevel(),
                        frameSelection.selectedToolKey()),
                mapInteractionFrameFor(mapSurfaceSnapshot),
                new DungeonEditorPreparedFrameFacts.StatePanelFrame(
                        selectedMapIdValue,
                        preparedStatusText,
                        false,
                        frameSelection.selectedToolLabel(),
                        frameSelection.selectedToolKey(),
                        viewModeLabel,
                        frameSelection.projectionLevel(),
                        overlayFrame.overlayLabel(),
                        safeState.inspector(),
                        safeState.selection().topologyRef(),
                        selectedTransitionId,
                        safeState.preview(),
                        safeDraftFrame.roomNarrationDrafts(),
                        safeDraftFrame.labelNameDraft(),
                        safeDraftFrame.corridorPointDraft(),
                        safeDraftFrame.transitionDescriptionDraft(),
                        safeDraftFrame.transitionDestinationDraft(),
                        transitionDestination,
                        safeDraftFrame.stairGeometryDraft()));
    }

    private RuntimeFrameSelection currentFrameSelection(DungeonEditorControlsSnapshot controlsSnapshot) {
        DungeonEditorControlsSnapshot safeControls = controlsSnapshot == null
                ? DungeonEditorControlsSnapshot.empty("")
                : controlsSnapshot;
        return new RuntimeFrameSelection(
                DungeonEditorPreparedMapEntries.mapEntries(safeControls.maps()),
                safeControls.selectedMapId(),
                safeControls.overlaySettings(),
                safeControls.projectionLevel(),
                safeControls.viewMode().name(),
                safeControls.selectedTool().name(),
                safeControls.selectedTool().displayLabel(),
                safeControls.statusText(),
                safeControls.surfaceLoaded(),
                safeControls.reachableLevels());
    }

    private DungeonEditorPreparedFrameFacts.MapInteractionFrame mapInteractionFrameFor(
            DungeonEditorMapSurfaceSnapshot snapshot
    ) {
        DungeonEditorMapSurfaceSnapshot safeSnapshot = snapshot == null
                ? DungeonEditorMapSurfaceSnapshot.empty()
                : snapshot;
        if (safeSnapshot == cachedMapSurfaceSnapshot) {
            return cachedMapInteractionFrame;
        }
        long startedNanos = System.nanoTime();
        cachedMapSurfaceSnapshot = safeSnapshot;
        try {
            cachedMapInteractionFrame = DungeonEditorPreparedFrameFacts.MapInteractionFrame.from(safeSnapshot);
        } finally {
            mapInteractionFrameRecomputeCount++;
            mapInteractionFrameRecomputeNanos += System.nanoTime() - startedNanos;
        }
        return cachedMapInteractionFrame;
    }

    DungeonEditorRenderFrame.MeasurementSnapshot measurementSnapshot(long runtimeFramePublicationCount) {
        return new DungeonEditorRenderFrame.MeasurementSnapshot(
                runtimeFramePublicationCount,
                mapInteractionFrameRecomputeCount,
                mapInteractionFrameRecomputeNanos);
    }

    private static String keyOf(DungeonMapId mapId) {
        return mapId == null ? "" : Long.toString(mapId.value());
    }

    private static DungeonEditorStateSnapshot emptyStateSnapshot() {
        return DungeonEditorStateSnapshot.empty("");
    }

    private static DungeonEditorRuntimeDraftFrame emptyDraftFrame() {
        return new DungeonEditorRuntimeDraftFrame(null, null, null, null, null, null, null);
    }

    private record RuntimeFrameSelection(
            List<DungeonEditorPreparedFrameFacts.MapEntry> mapEntries,
            DungeonMapId selectedMapId,
            DungeonOverlaySettings overlaySettings,
            int projectionLevel,
            String viewModeKey,
            String selectedToolKey,
            String selectedToolLabel,
            String statusText,
            boolean surfaceLoaded,
            List<Integer> reachableLevels
    ) {
    }
}
