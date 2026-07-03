package src.features.dungeon.runtime;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonOverlaySettings;

final class DungeonEditorRuntimeFrameFactsAssembler {
    private static final DungeonEditorSelector<String> SELECTED_TOOL_KEY =
            DungeonEditorSelector.of(state -> state.selectedTool().name());
    private static final DungeonEditorSelector<String> SELECTED_TOOL_LABEL =
            DungeonEditorSelector.of(state -> state.selectedTool().displayLabel());
    private static final DungeonEditorSelector<String> SELECTED_VIEW_MODE_KEY =
            DungeonEditorSelector.of(state -> state.viewMode().name());
    private static final DungeonEditorSelector<Integer> PROJECTION_LEVEL =
            DungeonEditorSelector.of(DungeonEditorStoreState::projectionLevel);
    private static final DungeonEditorSelector<DungeonOverlaySettings> OVERLAY_SETTINGS =
            DungeonEditorSelector.of(DungeonEditorStoreState::overlaySettings);
    private static final DungeonEditorSelector<DungeonMapId> SELECTED_MAP =
            DungeonEditorSelector.of(DungeonEditorStoreState::selectedMapId);
    private static final DungeonEditorSelector<String> STATUS_TEXT =
            DungeonEditorSelector.of(DungeonEditorStoreState::statusText);
    private static final DungeonEditorSelector<Boolean> SURFACE_LOADED =
            DungeonEditorSelector.of(DungeonEditorStoreState::surfaceLoaded);
    private static final DungeonEditorSelector<List<Integer>> REACHABLE_LEVELS =
            DungeonEditorSelector.of(DungeonEditorStoreState::reachableLevels);

    private final DungeonEditorStore store;

    private DungeonEditorMapSurfaceSnapshot cachedMapSurfaceSnapshot = DungeonEditorMapSurfaceSnapshot.empty();
    private DungeonEditorPreparedFrameFacts.MapInteractionFrame cachedMapInteractionFrame =
            DungeonEditorPreparedFrameFacts.MapInteractionFrame.empty();
    private long mapInteractionFrameRecomputeCount;
    private long mapInteractionFrameRecomputeNanos;

    DungeonEditorRuntimeFrameFactsAssembler(DungeonEditorStore store) {
        this.store = Objects.requireNonNull(store, "store");
    }

    DungeonEditorPreparedFrameFacts preparedFacts(
            DungeonEditorMapSurfaceSnapshot mapSurfaceSnapshot,
            DungeonEditorStateSnapshot stateSnapshot,
            DungeonEditorRuntimeDraftFrame draftFrame
    ) {
        RuntimeFrameSelection frameSelection = currentFrameSelection();
        long selectedMapIdValue = frameSelection.selectedMapId() == null
                ? 0L
                : frameSelection.selectedMapId().value();
        String preparedStatusText = DungeonEditorPreparedFrameProjection.statusTextFor(
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

    private RuntimeFrameSelection currentFrameSelection() {
        return new RuntimeFrameSelection(
                freshSelectorValue(DungeonEditorPreparedFrameProjection.mapEntriesSelector()),
                freshSelectorValue(SELECTED_MAP),
                freshSelectorValue(OVERLAY_SETTINGS),
                freshSelectorValue(PROJECTION_LEVEL),
                freshSelectorValue(SELECTED_VIEW_MODE_KEY),
                freshSelectorValue(SELECTED_TOOL_KEY),
                freshSelectorValue(SELECTED_TOOL_LABEL),
                freshSelectorValue(STATUS_TEXT),
                freshSelectorValue(SURFACE_LOADED),
                freshSelectorValue(REACHABLE_LEVELS));
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

    private <T> T freshSelectorValue(DungeonEditorSelector<T> selector) {
        DungeonEditorSelectorResult<T> result = store.select(selector);
        return result.requireFreshAgainst(
                store.state(),
                "Dungeon editor store selector result is stale");
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
