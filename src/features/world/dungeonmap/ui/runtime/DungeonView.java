package features.world.dungeonmap.ui.runtime;

import features.world.dungeonmap.api.DungeonCorridorSummary;
import features.world.dungeonmap.model.CorridorComponent;
import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonRuntimeLocation;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonRuntimeState;
import features.world.dungeonmap.ui.inspector.DungeonInspectorPresenter;
import features.world.dungeonmap.ui.workspace.DungeonSplitWorkspace;
import features.world.dungeonmap.ui.workspace.render.DungeonWorkspaceRenderState;
import features.world.dungeonmap.ui.workspace.DungeonViewMode;
import javafx.scene.Node;
import ui.async.UiErrorReporter;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.Objects;

public final class DungeonView implements AppView {

    private final DungeonControls controls = new DungeonControls();
    private final DungeonSplitWorkspace workspace = new DungeonSplitWorkspace(false);
    private final DungeonRuntimeApplicationService applicationService;
    private final DetailsNavigator detailsNavigator;

    private DungeonRuntimeState currentState;
    private DungeonWorkspaceRenderState currentRenderState;
    private boolean initialLoadDone;

    public DungeonView(DetailsNavigator detailsNavigator, DungeonRuntimeApplicationService applicationService) {
        this.detailsNavigator = Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        this.applicationService = Objects.requireNonNull(applicationService, "applicationService");
        workspace.setOnRoomSelected(this::selectRoom);
        workspace.setOnCorridorSelected(this::selectCorridor);
        workspace.setOnRoomMoved((room, center) -> { });
        controls.setOnMapSelected(this::loadRuntimeState);
    }

    @Override
    public Node getMainContent() {
        return workspace;
    }

    @Override
    public String getTitle() {
        return "Dungeon";
    }

    @Override
    public String getIconText() {
        return "\u25A9";
    }

    @Override
    public Node getControlsContent() {
        return controls;
    }

    @Override
    public void onShow() {
        if (!initialLoadDone) {
            loadPreferredRuntimeState();
            initialLoadDone = true;
        }
    }

    private void loadPreferredRuntimeState() {
        applicationService.loadPreferredState(this::showLoadState,
                throwable -> UiErrorReporter.reportBackgroundFailure("DungeonView.loadRuntimeState()", throwable));
    }

    private void loadRuntimeState(long mapId) {
        applicationService.loadState(mapId, this::showLoadState,
                throwable -> UiErrorReporter.reportBackgroundFailure("DungeonView.loadRuntimeState(mapId)", throwable));
    }

    private void showLoadState(DungeonRuntimeLoadState loadState) {
        currentState = loadState.state();
        currentRenderState = loadState.renderState();
        DungeonLayout layout = loadState.state().layout();
        workspace.showLayout(currentRenderState, null, loadState.state().activeLocation());
        controls.setMaps(loadState.maps());
        controls.selectMap(loadState.selectedMapId());
        controls.setActiveRoomName(activeLocationLabel(layout, loadState.state().activeLocation()));
    }

    private void selectRoom(DungeonRoom room) {
        publishRoomDetails(room);
        movePartyToLocation(DungeonRuntimeLocation.room(room.roomId()));
    }

    private void selectCorridor(DungeonCorridor corridor) {
        publishCorridorDetails(corridor);
        CorridorComponent component = currentRenderState == null
                ? null
                : currentRenderState.renderData().corridorTopology().componentForCorridor(corridor.corridorId());
        if (component == null) {
            return;
        }
        movePartyToLocation(DungeonRuntimeLocation.corridorComponent(component.componentId()));
    }

    private void publishRoomDetails(DungeonRoom room) {
        if (room == null || currentState == null || currentState.layout() == null) {
            return;
        }
        boolean active = currentState != null
                && currentState.activeLocation() != null
                && currentState.activeLocation().matchesRoom(room.roomId());
        var summary = DungeonInspectorPresenter.roomSummary(
                currentState.layout(),
                room,
                active);
        if (summary != null) {
            detailsNavigator.showDungeonRoom(summary);
        }
    }

    private void publishCorridorDetails(DungeonCorridor corridor) {
        if (corridor == null || currentState == null || currentState.layout() == null) {
            return;
        }
        var summary = corridorSummary(corridor);
        detailsNavigator.showInfo(
                "Korridor",
                new DetailsNavigator.EntryKey("dungeon-corridor", summary.corridorId()),
                DungeonInspectorPresenter.corridorLabel(summary));
    }

    private DungeonCorridorSummary corridorSummary(DungeonCorridor corridor) {
        CorridorComponent component = currentRenderState == null
                ? null
                : currentRenderState.renderData().corridorTopology().componentForCorridor(corridor.corridorId());
        boolean active = currentState.activeLocation() instanceof DungeonRuntimeLocation.CorridorComponent activeLocation
                && component != null
                && component.componentId().equals(activeLocation.componentId());
        return DungeonInspectorPresenter.corridorSummary(currentState.layout(), corridor, active);
    }

    private void movePartyToLocation(DungeonRuntimeLocation location) {
        if (currentState == null || currentState.layout() == null || currentState.layout().map() == null || location == null) {
            return;
        }
        if (location.equals(currentState.activeLocation())) {
            return;
        }
        long mapId = currentState.layout().map().mapId();
        applicationService.moveParty(mapId, location,
                () -> loadRuntimeState(mapId),
                throwable -> UiErrorReporter.reportBackgroundFailure("DungeonView.moveParty()", throwable));
    }

    private String activeLocationLabel(DungeonLayout layout, DungeonRuntimeLocation location) {
        if (location == null || layout == null) {
            return null;
        }
        if (location instanceof DungeonRuntimeLocation.CorridorComponent corridorComponent) {
            CorridorComponent component = currentRenderState == null
                    ? null
                    : currentRenderState.renderData().corridorTopology().componentById(corridorComponent.componentId());
            if (component == null) {
                return null;
            }
            return component.roomIds().stream()
                    .sorted()
                    .map(roomId -> {
                        DungeonRoom room = DungeonInspectorPresenter.findRoom(layout, roomId);
                        return room == null ? "Raum " + roomId : room.name();
                    })
                    .reduce((left, right) -> left + ", " + right)
                    .orElse("Korridor");
        }
        if (location instanceof DungeonRuntimeLocation.Room roomLocation) {
            DungeonRoom room = DungeonInspectorPresenter.findRoom(layout, roomLocation.roomId());
            return room == null ? null : room.name();
        }
        return null;
    }
}
