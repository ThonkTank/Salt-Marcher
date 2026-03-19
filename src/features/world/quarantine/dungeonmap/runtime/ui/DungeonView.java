package features.world.quarantine.dungeonmap.runtime.ui;

import features.world.quarantine.dungeonmap.inspector.DungeonCorridorSummary;
import features.world.quarantine.dungeonmap.inspector.DungeonInspectorPort;
import features.world.quarantine.dungeonmap.inspector.DungeonInspectorPresenter;
import features.world.quarantine.dungeonmap.loading.DungeonLoadingState;
import features.world.quarantine.dungeonmap.runtime.model.DungeonRuntimeLoadState;
import features.world.quarantine.dungeonmap.runtime.application.DungeonRuntimePresenter;
import features.world.quarantine.dungeonmap.runtime.application.DungeonRuntimeWorkflow;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorComponent;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.runtime.model.DungeonRuntimeLocation;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.runtime.model.DungeonRuntimeState;
import ui.async.UiErrorReporter;
import javafx.scene.Node;
import ui.shell.AppView;
import ui.shell.NavigationIcons;

import java.util.Objects;

public final class DungeonView implements AppView {

    private final DungeonControls controls = new DungeonControls();
    private final DungeonRuntimeSplitWorkspace workspace = new DungeonRuntimeSplitWorkspace();
    private final DungeonRuntimeWorkflow applicationService;
    private final DungeonInspectorPort inspectorPort;

    private DungeonRuntimeState currentState;
    private boolean initialLoadDone;

    public DungeonView(DungeonInspectorPort inspectorPort, DungeonRuntimeWorkflow applicationService) {
        this.inspectorPort = Objects.requireNonNull(inspectorPort, "inspectorPort");
        this.applicationService = Objects.requireNonNull(applicationService, "applicationService");
        workspace.setOnRoomSelected(this::selectRoom);
        workspace.setOnCorridorSelected(this::selectCorridor);
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
        return "";
    }

    @Override
    public Node getNavigationGraphic() {
        return NavigationIcons.dungeon();
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
        DungeonLoadingState loadingState = loadState.loadingState();
        DungeonLayout layout = loadingState.layout();
        workspace.showLayout(layout, loadingState.renderState(), null, loadState.state().activeLocation());
        controls.setMaps(loadingState.maps());
        controls.selectMap(loadingState.selectedMapId());
        controls.setActiveRoomName(DungeonRuntimePresenter.activeLocationLabel(layout, loadState.state().activeLocation(), loadingState.corridorTopology()));
    }

    private void selectRoom(DungeonRoom room) {
        publishRoomDetails(room);
        movePartyToLocation(DungeonRuntimeLocation.room(room.roomId()));
    }

    private void selectCorridor(DungeonCorridor corridor) {
        publishCorridorDetails(corridor);
        CorridorComponent component = workspace.corridorComponentFor(corridor.corridorId());
        if (component == null) {
            return;
        }
        movePartyToLocation(DungeonRuntimeLocation.corridorComponent(component.componentId()));
    }

    private void publishRoomDetails(DungeonRoom room) {
        if (room == null || currentState == null || currentState.layout() == null) {
            return;
        }
        boolean active = currentState.activeLocation() != null
                && currentState.activeLocation().matchesRoom(room.roomId());
        var summary = DungeonInspectorPresenter.roomSummary(
                currentState.layout(),
                room,
                active);
        if (summary != null) {
            inspectorPort.showContent(summary.name(), "dungeon-room:" + summary.roomId(), () -> DungeonInspectorPresenter.buildRoomNode(summary));
        }
    }

    private void publishCorridorDetails(DungeonCorridor corridor) {
        if (corridor == null || currentState == null || currentState.layout() == null) {
            return;
        }
        var summary = corridorSummary(corridor);
        inspectorPort.showInfo(
                "Korridor",
                "dungeon-corridor:" + summary.corridorId(),
                DungeonInspectorPresenter.corridorLabel(summary));
    }

    private DungeonCorridorSummary corridorSummary(DungeonCorridor corridor) {
        CorridorComponent component = workspace.corridorComponentFor(corridor.corridorId());
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

}
