package features.dungeon.application.editor;

import features.dungeon.api.DungeonMapId;
import features.dungeon.api.DungeonMapSummary;
import features.dungeon.api.editor.DungeonEditorApi;
import features.dungeon.api.editor.DungeonEditorDraftState;
import features.dungeon.api.editor.DungeonEditorIntent;
import features.dungeon.api.editor.DungeonEditorState;
import features.dungeon.api.editor.DungeonEditorToolFamily;
import features.dungeon.api.editor.DungeonEditorToolSelection;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import platform.ui.UiDispatcher;

/** Bridges the existing runtime into the atomic public Editor capability during M1. */
public final class DungeonEditorApiFacade implements DungeonEditorApi {
    private final DungeonEditorFeatureRuntimeRoot runtimeRoot;
    private final UiDispatcher uiDispatcher;

    public DungeonEditorApiFacade(
            DungeonEditorFeatureRuntimeRoot runtimeRoot,
            UiDispatcher uiDispatcher
    ) {
        this.runtimeRoot = Objects.requireNonNull(runtimeRoot, "runtimeRoot");
        this.uiDispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
    }

    @Override
    public DungeonEditorState current() {
        return stateFrom(runtimeRoot.currentFrame());
    }

    @Override
    public Runnable subscribe(Consumer<DungeonEditorState> subscriber) {
        StateDelivery delivery = new StateDelivery(
                Objects.requireNonNull(subscriber, "subscriber"),
                uiDispatcher);
        Runnable unsubscribeRuntime = runtimeRoot.subscribe(delivery::deliver);
        return () -> {
            delivery.close();
            unsubscribeRuntime.run();
        };
    }

    @Override
    public void dispatch(DungeonEditorIntent intent) {
        DungeonEditorIntent safeIntent = Objects.requireNonNull(intent, "intent");
        if (safeIntent instanceof DungeonEditorIntent.SelectMap selectMap) {
            runtimeRoot.selectMap(selectMap.mapId().value());
        } else if (safeIntent instanceof DungeonEditorIntent.CreateMap createMap) {
            runtimeRoot.createMap(createMap.mapName());
        } else if (safeIntent instanceof DungeonEditorIntent.RenameMap renameMap) {
            runtimeRoot.renameMap(renameMap.mapId().value(), renameMap.mapName());
        } else if (safeIntent instanceof DungeonEditorIntent.DeleteMap deleteMap) {
            runtimeRoot.deleteMap(deleteMap.mapId().value());
        } else if (safeIntent instanceof DungeonEditorIntent.SetViewMode setViewMode) {
            runtimeRoot.setViewMode(setViewMode.viewMode());
        } else if (safeIntent instanceof DungeonEditorIntent.SetTool setTool) {
            runtimeRoot.setTool(setTool.tool());
        } else if (safeIntent instanceof DungeonEditorIntent.ShiftProjectionLevel shiftLevel) {
            runtimeRoot.shiftProjectionLevel(shiftLevel.levelShift());
        } else if (safeIntent instanceof DungeonEditorIntent.SetOverlay setOverlay) {
            runtimeRoot.setOverlay(overlayFrom(setOverlay));
        } else if (safeIntent instanceof DungeonEditorIntent.ScrollSelection scrollSelection) {
            runtimeRoot.scrollSelection(scrollSelection.levelDelta());
        } else if (safeIntent == DungeonEditorIntent.CancelPreview.INSTANCE) {
            runtimeRoot.cancelActivePreviewSession();
        } else if (safeIntent == DungeonEditorIntent.Undo.INSTANCE) {
            runtimeRoot.undo();
        } else if (safeIntent == DungeonEditorIntent.Redo.INSTANCE) {
            runtimeRoot.redo();
        } else if (safeIntent instanceof DungeonEditorIntent.UpdateRoomNarration update) {
            runtimeRoot.updateStatePanelRoomNarrationDraft(roomNarrationDraftFrom(update.narration()));
        } else if (safeIntent instanceof DungeonEditorIntent.CommitRoomNarration commit) {
            runtimeRoot.saveRoomNarration(roomNarrationFrom(commit.narration()));
        } else if (safeIntent instanceof DungeonEditorIntent.UpdateLabelName update) {
            runtimeRoot.updateStatePanelLabelNameDraft(labelTargetFrom(update.target()), update.name());
        } else if (safeIntent instanceof DungeonEditorIntent.CommitLabelName commit) {
            runtimeRoot.saveLabelName(labelTargetFrom(commit.target()), commit.name());
        } else if (safeIntent instanceof DungeonEditorIntent.UpdateCorridorPoint update) {
            runtimeRoot.updateStatePanelCorridorPointDraft(update.q(), update.r());
        } else if (safeIntent instanceof DungeonEditorIntent.CommitCorridorPoint commit) {
            runtimeRoot.moveStatePanelCorridorPoint(commit.q(), commit.r());
        } else if (safeIntent instanceof DungeonEditorIntent.UpdateTransitionDescription update) {
            runtimeRoot.updateStatePanelTransitionDescriptionDraft(
                    update.transitionId(), update.description());
        } else if (safeIntent instanceof DungeonEditorIntent.CommitTransitionDescription commit) {
            runtimeRoot.saveTransitionDescription(commit.transitionId(), commit.description());
        } else if (safeIntent instanceof DungeonEditorIntent.UpdateTransitionDestination update) {
            runtimeRoot.updateStatePanelTransitionDestinationDraft(destinationFrom(update.destination()));
        } else if (safeIntent instanceof DungeonEditorIntent.CommitTransitionDestination commit) {
            runtimeRoot.saveTransitionLink(commit.sourceTransitionId(), destinationFrom(commit.destination()));
        } else if (safeIntent instanceof DungeonEditorIntent.UpdateStairGeometry update) {
            runtimeRoot.updateStatePanelStairGeometryDraft(stairFrom(update.geometry()));
        } else if (safeIntent instanceof DungeonEditorIntent.CommitStairGeometry commit) {
            runtimeRoot.saveStairGeometry(stairFrom(commit.geometry()));
        } else {
            throw new IllegalArgumentException("Unsupported Dungeon Editor intent: " + safeIntent.getClass());
        }
    }

    private static RoomNarrationDraftInput roomNarrationDraftFrom(
            DungeonEditorIntent.RoomNarrationInput input
    ) {
        return new RoomNarrationDraftInput(
                input.roomId(),
                input.visualDescription(),
                input.exits().stream()
                        .map(exit -> new ExitNarrationDraftInput(
                                exit.label(), exit.q(), exit.r(), exit.level(),
                                exit.direction(), exit.description()))
                        .toList());
    }

    private static RoomNarration roomNarrationFrom(DungeonEditorIntent.RoomNarrationInput input) {
        return new RoomNarration(
                input.roomId(),
                input.visualDescription(),
                input.exits().stream()
                        .map(exit -> new ExitNarration(
                                exit.label(), exit.q(), exit.r(), exit.level(),
                                exit.direction(), exit.description()))
                        .toList());
    }

    private static DungeonEditorRuntimeLabelTarget labelTargetFrom(DungeonEditorIntent.LabelTarget target) {
        return switch (target.kind()) {
            case ROOM -> DungeonEditorRuntimeLabelTarget.room(target.id());
            case CLUSTER -> DungeonEditorRuntimeLabelTarget.cluster(target.id());
            case EMPTY -> DungeonEditorRuntimeLabelTarget.empty();
        };
    }

    private static TransitionDestinationDraftInput destinationFrom(
            DungeonEditorIntent.TransitionDestinationInput input
    ) {
        return TransitionDestinationDraftInput.fromExternalName(
                new TransitionDestinationDraftInput.ExternalFields(
                        input.destinationTypeKey(),
                        input.mapId(),
                        input.tileId(),
                        input.transitionId(),
                        input.bidirectional()));
    }

    private static StairGeometryDraftInput stairFrom(DungeonEditorIntent.StairGeometryInput input) {
        return new StairGeometryDraftInput(
                input.stairId(),
                input.shapeName(),
                input.directionName(),
                input.dimension1(),
                input.dimension2());
    }

    private static DungeonEditorOverlaySettings overlayFrom(DungeonEditorIntent.SetOverlay intent) {
        var settings = intent.overlaySettings();
        DungeonEditorOverlaySettings.Mode mode;
        try {
            mode = DungeonEditorOverlaySettings.Mode.valueOf(settings.modeKey());
        } catch (IllegalArgumentException ignored) {
            mode = DungeonEditorOverlaySettings.Mode.OFF;
        }
        return new DungeonEditorOverlaySettings(
                mode,
                settings.levelRange(),
                settings.opacity(),
                settings.selectedLevels());
    }

    private static DungeonEditorState stateFrom(DungeonEditorRenderFrame frame) {
        DungeonEditorRenderFrame safeFrame = frame == null ? DungeonEditorRenderFrame.empty() : frame;
        DungeonEditorPreparedFrameFacts facts = safeFrame.preparedFacts();
        DungeonEditorPreparedFrameFacts.MapSurfaceFrame mapSurface = facts.mapSurfaceFrame();
        DungeonEditorPreparedFrameFacts.StatePanelFrame statePanel = facts.statePanelFrame();
        DungeonMapId selectedMapId = facts.selectedMapIdValue() > 0L
                ? new DungeonMapId(facts.selectedMapIdValue())
                : null;
        List<DungeonMapSummary> catalog = facts.mapEntries().stream()
                .filter(entry -> entry.mapIdValue() > 0L)
                .map(entry -> new DungeonMapSummary(
                        new DungeonMapId(entry.mapIdValue()),
                        entry.mapName(),
                        entry.revision()))
                .toList();
        return new DungeonEditorState(
                safeFrame.measurement().runtimeFramePublicationCount(),
                0L,
                catalog,
                selectedMapId,
                mapSurface.surface(),
                mapSurface.viewMode(),
                mapSurface.selectedTool(),
                toolSelectionFrom(mapSurface.selectedTool()),
                mapSurface.overlaySettings(),
                mapSurface.projectionLevel(),
                facts.reachableLevels(),
                mapSurface.selection(),
                draftFrom(statePanel, safeFrame.inlineLabelEditSession()),
                mapSurface.preview(),
                statePanel.inspector(),
                new DungeonEditorState.CommandStatus(facts.busy(), facts.statusText()));
    }

    private static DungeonEditorToolSelection toolSelectionFrom(features.dungeon.api.DungeonEditorTool tool) {
        features.dungeon.api.DungeonEditorTool safeTool = tool == null
                ? features.dungeon.api.DungeonEditorTool.SELECT
                : tool;
        String key = safeTool.name();
        DungeonEditorToolFamily family;
        if (key.startsWith("ROOM_")) {
            family = DungeonEditorToolFamily.ROOM;
        } else if (key.startsWith("WALL_")) {
            family = DungeonEditorToolFamily.WALL;
        } else if (key.startsWith("DOOR_")) {
            family = DungeonEditorToolFamily.DOOR;
        } else if (key.startsWith("CORRIDOR_")) {
            family = DungeonEditorToolFamily.CORRIDOR;
        } else if (key.startsWith("FEATURE_")) {
            family = DungeonEditorToolFamily.FEATURE;
        } else if (key.startsWith("STAIR_")) {
            family = DungeonEditorToolFamily.STAIR;
        } else if (key.startsWith("TRANSITION_")) {
            family = DungeonEditorToolFamily.TRANSITION;
        } else {
            family = DungeonEditorToolFamily.SELECT;
        }
        return new DungeonEditorToolSelection(family, key);
    }

    private static DungeonEditorDraftState draftFrom(
            DungeonEditorPreparedFrameFacts.StatePanelFrame statePanel,
            DungeonEditorInlineLabelEditSession inlineLabel
    ) {
        DungeonEditorPreparedFrameFacts.StatePanelFrame safeStatePanel = statePanel == null
                ? DungeonEditorPreparedFrameFacts.StatePanelFrame.empty()
                : statePanel;
        DungeonEditorInlineLabelEditSession safeInlineLabel = inlineLabel == null
                ? DungeonEditorInlineLabelEditSession.inactive()
                : inlineLabel;
        var label = safeStatePanel.labelNameDraft();
        var labelTarget = label.target();
        var corridor = safeStatePanel.corridorPointDraft();
        var transitionDescription = safeStatePanel.transitionDescriptionDraft();
        var transitionDestination = safeStatePanel.transitionDestinationDraft();
        var stair = safeStatePanel.stairGeometryDraft();
        return new DungeonEditorDraftState(
                safeStatePanel.roomNarrationDrafts().rooms().stream()
                        .map(room -> new DungeonEditorDraftState.RoomNarrationDraft(
                                room.roomId(),
                                room.visualPresent(),
                                room.visualDescription(),
                                room.exits().stream()
                                        .map(exit -> new DungeonEditorDraftState.ExitNarrationDraft(
                                                exit.label(),
                                                exit.q(),
                                                exit.r(),
                                                exit.level(),
                                                exit.direction(),
                                                exit.description(),
                                                exit.present()))
                                        .toList()))
                        .toList(),
                new DungeonEditorDraftState.LabelNameDraft(
                        labelTarget.kind().name(),
                        labelTarget.targetId(),
                        label.label(),
                        label.fallbackName(),
                        label.name(),
                        label.present()),
                new DungeonEditorDraftState.CorridorPointDraft(
                        corridor.targetPresent(),
                        corridor.present(),
                        corridor.label(),
                        corridor.q(),
                        corridor.r(),
                        corridor.level()),
                new DungeonEditorDraftState.TransitionDescriptionDraft(
                        transitionDescription.transitionId(),
                        transitionDescription.description(),
                        transitionDescription.present()),
                new DungeonEditorDraftState.TransitionDestinationDraft(
                        transitionDestination.targetPresent(),
                        transitionDestination.sourceTransitionId(),
                        transitionDestination.destinationTypeKey(),
                        transitionDestination.mapId(),
                        transitionDestination.tileId(),
                        transitionDestination.transitionId(),
                        transitionDestination.bidirectional(),
                        transitionDestination.present()),
                new DungeonEditorDraftState.StairGeometryDraft(
                        stair.targetPresent(),
                        stair.stairId(),
                        stair.shapeName(),
                        stair.directionName(),
                        stair.dimension1(),
                        stair.dimension2(),
                        stair.present()),
                new DungeonEditorDraftState.InlineLabelDraft(
                        safeInlineLabel.active(),
                        safeInlineLabel.target().kind().name(),
                        safeInlineLabel.target().targetId(),
                        safeInlineLabel.labelKind(),
                        safeInlineLabel.ownerId(),
                        safeInlineLabel.clusterId(),
                        safeInlineLabel.topologyKind(),
                        safeInlineLabel.topologyId(),
                        safeInlineLabel.draftText()));
    }

    private static final class StateDelivery {
        private final Consumer<DungeonEditorState> subscriber;
        private final UiDispatcher uiDispatcher;
        private final AtomicBoolean open = new AtomicBoolean(true);
        private final AtomicLong deliveryRevision = new AtomicLong();

        private StateDelivery(Consumer<DungeonEditorState> subscriber, UiDispatcher uiDispatcher) {
            this.subscriber = subscriber;
            this.uiDispatcher = uiDispatcher;
        }

        private void deliver(DungeonEditorRenderFrame frame) {
            long revision = deliveryRevision.incrementAndGet();
            DungeonEditorState state = stateFrom(frame);
            uiDispatcher.dispatch(() -> applyIfCurrent(revision, state));
        }

        private void applyIfCurrent(long revision, DungeonEditorState state) {
            if (open.get() && revision == deliveryRevision.get()) {
                subscriber.accept(state);
            }
        }

        private void close() {
            open.set(false);
            deliveryRevision.incrementAndGet();
        }
    }
}
