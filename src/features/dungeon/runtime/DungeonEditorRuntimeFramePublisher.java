package src.features.dungeon.runtime;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorStateModel;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOverlaySettings;

final class DungeonEditorRuntimeFramePublisher {
    private final DungeonEditorControlsModel controlsModel;
    private final DungeonEditorMapSurfaceModel mapSurfaceModel;
    private final DungeonEditorStateModel stateModel;
    private final DungeonEditorRuntimeDraftSession draftSession;
    private final List<Consumer<DungeonEditorRuntimePublication>> subscribers = new ArrayList<>();

    private DungeonEditorMapSurfaceSnapshot preparedFactsMapSurfaceSnapshot = DungeonEditorMapSurfaceSnapshot.empty();
    private DungeonEditorPreparedFrameFacts.MapInteractionFrame preparedFactsMapInteractionFrame =
            DungeonEditorPreparedFrameFacts.MapInteractionFrame.empty();

    DungeonEditorRuntimeFramePublisher(
            DungeonEditorControlsModel controlsModel,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel,
            DungeonEditorRuntimeDraftSession draftSession
    ) {
        this.controlsModel = Objects.requireNonNull(controlsModel, "controlsModel");
        this.mapSurfaceModel = Objects.requireNonNull(mapSurfaceModel, "mapSurfaceModel");
        this.stateModel = Objects.requireNonNull(stateModel, "stateModel");
        this.draftSession = Objects.requireNonNull(draftSession, "draftSession");
        this.stateModel.subscribe(ignored -> publishCurrentToSubscribers());
    }

    DungeonEditorRuntimePublication currentPublication() {
        return DungeonEditorRuntimePublication.published(currentFrame());
    }

    Runnable subscribe(Consumer<DungeonEditorRuntimePublication> subscriber) {
        Consumer<DungeonEditorRuntimePublication> safeSubscriber =
                Objects.requireNonNull(subscriber, "subscriber");
        subscribers.add(safeSubscriber);
        return () -> subscribers.remove(safeSubscriber);
    }

    /*
     * This runtime channel is caller-affine: subscriber callbacks run
     * synchronously on the caller of publishCurrentToSubscribers().
     * Thread-bound consumers must route delivery at their own seam.
     */
    void publishCurrentToSubscribers() {
        DungeonEditorRuntimePublication publication = currentPublication();
        for (Consumer<DungeonEditorRuntimePublication> subscriber : List.copyOf(subscribers)) {
            subscriber.accept(publication);
        }
    }

    private DungeonEditorRenderFrame currentFrame() {
        DungeonEditorControlsSnapshot controls = controlsModel.current();
        DungeonEditorMapSurfaceSnapshot mapSurface = mapSurfaceModel.current();
        DungeonEditorStateSnapshot state = stateModel.current();
        DungeonEditorRuntimeDraftFrame drafts = draftSession.draftFrame(controls, state);
        return new DungeonEditorRenderFrame(
                controls,
                mapSurface,
                state,
                preparedFacts(controls, mapSurface),
                drafts.roomNarrationDrafts(),
                drafts.labelNameDraft(),
                drafts.corridorPointDraft(),
                drafts.transitionDescriptionDraft(),
                drafts.transitionDestinationDraft(),
                drafts.stairGeometryDraft(),
                drafts.inlineLabelEditSession());
    }

    private DungeonEditorPreparedFrameFacts preparedFacts(
            DungeonEditorControlsSnapshot controlsSnapshot,
            DungeonEditorMapSurfaceSnapshot mapSurfaceSnapshot
    ) {
        DungeonEditorControlsSnapshot safeControls = controlsSnapshot == null
                ? DungeonEditorControlsSnapshot.empty("")
                : controlsSnapshot;
        var mapEntries = safeControls.maps().stream()
                .map(DungeonEditorRuntimeFramePublisher::toMapEntry)
                .toList();
        DungeonMapId selectedMapId = safeControls.selectedMapId();
        var reachableLevels = safeControls.reachableLevels();
        int projectionLevel = safeControls.projectionLevel();
        DungeonOverlaySettings overlaySettings = safeControls.overlaySettings() == null
                ? DungeonOverlaySettings.defaults()
                : safeControls.overlaySettings();
        String viewModeKey = safeControls.viewMode() == null ? "GRID" : safeControls.viewMode().name();
        String selectedToolKey = safeControls.selectedTool() == null ? "SELECT" : safeControls.selectedTool().name();
        String selectedToolLabel = safeControls.selectedTool() == null ? "" : safeControls.selectedTool().displayLabel();
        return new DungeonEditorPreparedFrameFacts(
                mapEntries,
                keyOf(selectedMapId),
                selectedMapId == null ? 0L : selectedMapId.value(),
                reachableLevels,
                false,
                statusTextFor(safeControls, mapEntries),
                viewModeKey,
                DungeonEditorPreparedFrameFacts.labelForViewMode(viewModeKey),
                overlaySettings,
                DungeonEditorPreparedFrameFacts.OverlayFrame.from(overlaySettings),
                projectionLevel,
                selectedToolKey,
                selectedToolLabel,
                mapInteractionFrameFor(mapSurfaceSnapshot));
    }

    private DungeonEditorPreparedFrameFacts.MapInteractionFrame mapInteractionFrameFor(
            DungeonEditorMapSurfaceSnapshot mapSurfaceSnapshot
    ) {
        DungeonEditorMapSurfaceSnapshot safeSnapshot = mapSurfaceSnapshot == null
                ? DungeonEditorMapSurfaceSnapshot.empty()
                : mapSurfaceSnapshot;
        if (safeSnapshot == preparedFactsMapSurfaceSnapshot) {
            return preparedFactsMapInteractionFrame;
        }
        preparedFactsMapSurfaceSnapshot = safeSnapshot;
        preparedFactsMapInteractionFrame = DungeonEditorPreparedFrameFacts.MapInteractionFrame.from(safeSnapshot);
        return preparedFactsMapInteractionFrame;
    }

    private static DungeonEditorPreparedFrameFacts.MapEntry toMapEntry(DungeonMapSummary summary) {
        DungeonMapSummary safeSummary = summary == null
                ? new DungeonMapSummary(new DungeonMapId(1L), "Dungeon Map", 0L)
                : summary;
        return new DungeonEditorPreparedFrameFacts.MapEntry(
                keyOf(safeSummary.mapId()),
                safeSummary.mapId() == null ? 0L : safeSummary.mapId().value(),
                safeSummary.mapName(),
                safeSummary.revision());
    }

    private static String keyOf(DungeonMapId mapId) {
        return mapId == null ? "" : Long.toString(mapId.value());
    }

    private static String statusTextFor(
            DungeonEditorControlsSnapshot controls,
            List<DungeonEditorPreparedFrameFacts.MapEntry> mapEntries
    ) {
        if (controls.surfaceLoaded()) {
            return controls.statusText();
        }
        if (mapEntries.isEmpty()) {
            return "Keine Dungeon-Maps vorhanden.";
        }
        if (controls.selectedMapId() == null) {
            return "Kein Dungeon ausgewählt.";
        }
        return controls.statusText();
    }
}
