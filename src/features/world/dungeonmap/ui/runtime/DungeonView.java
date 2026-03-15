package features.world.dungeonmap.ui.runtime;

import features.world.dungeonmap.api.DungeonRoomSummary;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonRuntimeState;
import features.world.dungeonmap.ui.shared.DungeonSplitWorkspace;
import javafx.scene.Node;
import ui.async.UiErrorReporter;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

public final class DungeonView implements AppView {

    private final DungeonControls controls = new DungeonControls();
    private final DungeonSplitWorkspace workspace = new DungeonSplitWorkspace(false);
    private final DungeonApplicationService applicationService = new DungeonApplicationService();
    private final DetailsNavigator detailsNavigator;

    private DungeonRuntimeState currentState;
    private boolean initialLoadDone;

    public DungeonView(DetailsNavigator detailsNavigator) {
        this.detailsNavigator = detailsNavigator;
        workspace.setOnRoomSelected(this::selectRoom);
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
            applicationService.loadRuntimeState(state -> {
                        showState(state);
                        applicationService.loadMaps(maps -> {
                                    controls.setMaps(maps);
                                    if (state.layout() != null && state.layout().map() != null) {
                                        controls.selectMap(state.layout().map().mapId());
                                    }
                                },
                                throwable -> UiErrorReporter.reportBackgroundFailure("DungeonView.loadMaps()", throwable));
                    },
                    throwable -> UiErrorReporter.reportBackgroundFailure("DungeonView.loadRuntimeState()", throwable));
            initialLoadDone = true;
        }
    }

    private void loadRuntimeState(long mapId) {
        applicationService.loadRuntimeState(mapId, this::showState,
                throwable -> UiErrorReporter.reportBackgroundFailure("DungeonView.loadRuntimeState(mapId)", throwable));
    }

    private void showState(DungeonRuntimeState state) {
        currentState = state;
        DungeonLayout layout = state.layout();
        Long activeRoomId = state.activeRoomId();
        workspace.showLayout(layout, activeRoomId, activeRoomId);
        controls.selectMap(layout.map().mapId());
        controls.setActiveRoomName(layout.rooms().stream()
                .filter(room -> room.roomId() != null && room.roomId().equals(activeRoomId))
                .map(DungeonRoom::name)
                .findFirst()
                .orElse(null));
    }

    private void selectRoom(DungeonRoom room) {
        detailsNavigator.showDungeonRoom(new DungeonRoomSummary(
                room.roomId(),
                currentState != null && currentState.layout() != null && currentState.layout().map() != null
                        ? currentState.layout().map().mapId()
                        : room.mapId(),
                room.name(),
                room.center().x(),
                room.center().y(),
                room.relativeVertices().size(),
                currentState != null && room.roomId() != null && room.roomId().equals(currentState.activeRoomId())));
        if (currentState == null || currentState.layout() == null || currentState.layout().map() == null || room.roomId() == null) {
            return;
        }
        long mapId = currentState.layout().map().mapId();
        applicationService.moveParty(mapId, room.roomId(),
                () -> loadRuntimeState(mapId),
                throwable -> UiErrorReporter.reportBackgroundFailure("DungeonView.moveParty()", throwable));
    }
}
