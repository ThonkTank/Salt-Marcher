package features.world.dungeonmap.ui.runtime;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonRuntimeState;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.service.DungeonRuntimeService;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import javafx.scene.Node;
import ui.async.UiErrorReporter;
import ui.shell.AppView;

import java.util.HashMap;
import java.util.Map;

public class DungeonView implements AppView {

    private final DungeonViewControls controls = new DungeonViewControls();
    private final DungeonMapPane canvas = new DungeonMapPane();
    private final DungeonRuntimeApplicationService applicationService = new DungeonRuntimeApplicationService();
    private DungeonMapState currentState;
    private Long activeEndpointId;
    private final Map<Long, DungeonEndpoint> endpointsById = new HashMap<>();
    private final Map<Long, DungeonSquare> squaresById = new HashMap<>();
    private final Map<Long, DungeonArea> areasById = new HashMap<>();
    private long loadRequestToken = 0;
    private Long selectedMapId;

    public DungeonView() {
        controls.setOnMapSelected(this::loadMap);
        canvas.setOnEndpointClicked(this::moveToEndpoint);
        canvas.setShowEndpoints(true);
        canvas.setShowLinks(true);
    }

    @Override
    public Node getMainContent() {
        return canvas;
    }

    @Override
    public String getTitle() {
        return "Dungeon";
    }

    @Override
    public String getIconText() {
        return "\u25a3";
    }

    @Override
    public Node getControlsContent() {
        return controls;
    }

    @Override
    public void onShow() {
        applicationService.loadMapList(
                maps -> controls.setMaps(maps, selectedMapId),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonView.loadMapList()", ex));
        loadMap(null);
    }

    private void loadMap(Long mapId) {
        if (mapId != null) {
            selectedMapId = mapId;
        }
        long requestToken = ++loadRequestToken;
        applicationService.loadRuntimeState(mapId,
                runtimeState -> {
                    if (requestToken != loadRequestToken) {
                        return;
                    }
                    applyRuntimeState(runtimeState);
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonView.loadMap()", ex));
    }

    private void applyRuntimeState(DungeonRuntimeState runtimeState) {
        currentState = runtimeState.mapState();
        activeEndpointId = runtimeState.activeEndpointId();
        selectedMapId = currentState == null || currentState.map() == null ? null : currentState.map().mapId();
        if (currentState == null) {
            canvas.setPartyEndpoint(null);
            controls.selectMap(null);
            controls.showLocation(null, null, null);
            return;
        }
        rebuildLookups();
        controls.selectMap(selectedMapId);
        canvas.loadState(currentState);
        canvas.setSelectedSelection(DungeonSelection.none());
        updateLocationLabels();
    }

    private void moveToEndpoint(DungeonEndpoint endpoint) {
        if (currentState == null || currentState.map() == null || endpoint == null) {
            return;
        }
        applicationService.movePartyToEndpoint(currentState.map().mapId(), endpoint.endpointId(),
                result -> {
                    if (result.status() == DungeonRuntimeService.MoveStatus.NOT_CONNECTED) {
                        return;
                    }
                    loadMap(currentState.map().mapId());
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonView.moveToEndpoint()", ex));
    }

    private void updateLocationLabels() {
        if (currentState == null || activeEndpointId == null) {
            canvas.setPartyEndpoint(null);
            controls.showLocation(null, null, null);
            return;
        }
        DungeonEndpoint endpoint = endpointsById.get(activeEndpointId);
        if (endpoint == null) {
            canvas.setPartyEndpoint(null);
            controls.showLocation(null, null, null);
            return;
        }
        DungeonSquare square = squaresById.get(endpoint.squareId());
        if (square == null) {
            canvas.setPartyEndpoint(null);
            controls.showLocation(null, null, null);
            return;
        }
        String roomName = square.roomName();
        String areaName = square.areaName();
        String tableName = null;
        if (square.areaId() != null) {
            DungeonArea area = areasById.get(square.areaId());
            if (area != null) {
                tableName = area.encounterTableName();
            }
        }
        controls.showLocation(roomName, areaName, tableName);
        canvas.setPartyEndpoint(activeEndpointId);
    }

    private void rebuildLookups() {
        endpointsById.clear();
        squaresById.clear();
        areasById.clear();
        for (DungeonEndpoint endpoint : currentState.endpoints()) {
            endpointsById.put(endpoint.endpointId(), endpoint);
        }
        for (DungeonSquare square : currentState.squares()) {
            if (square.squareId() != null) {
                squaresById.put(square.squareId(), square);
            }
        }
        for (DungeonArea area : currentState.areas()) {
            areasById.put(area.areaId(), area);
        }
    }
}
