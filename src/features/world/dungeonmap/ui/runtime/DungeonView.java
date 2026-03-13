package features.world.dungeonmap.ui.runtime;

import features.encounter.api.EncounterRuntimePort;
import features.world.dungeonmap.service.DungeonMapQueryService;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonRuntimeState;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.service.runtime.DungeonMoveStatus;
import features.world.dungeonmap.service.runtime.DungeonRuntimeCommandService;
import features.world.dungeonmap.service.runtime.DungeonRuntimeQueryService;
import features.world.dungeonmap.ui.DungeonAreaEncounterText;
import features.world.dungeonmap.ui.DungeonUiAsyncSupport;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import javafx.scene.Node;
import ui.async.UiErrorReporter;
import ui.shell.AppView;

import java.util.HashMap;
import java.util.Map;

public class DungeonView implements AppView {

    private final DungeonViewControls controls = new DungeonViewControls();
    private final DungeonMapPane canvas = new DungeonMapPane();
    private DungeonMapState currentState;
    private Long activeEndpointId;
    private Long activeSquareId;
    private boolean requiresInitialPosition;
    private final Map<Long, DungeonEndpoint> endpointsById = new HashMap<>();
    private final Map<Long, DungeonSquare> squaresById = new HashMap<>();
    private final Map<Long, DungeonArea> areasById = new HashMap<>();
    private long loadRequestToken = 0;
    private Long selectedMapId;
    private String runtimeStatusMessage;
    private final DungeonMapQueryService queries;
    private final DungeonRuntimeQueryService runtimeQueries = new DungeonRuntimeQueryService();
    private final DungeonRuntimeCommandService runtimeCommands = new DungeonRuntimeCommandService();
    private final EncounterRuntimePort encounterRuntimePort;

    public DungeonView(DungeonMapQueryService queries, EncounterRuntimePort encounterRuntimePort) {
        this.queries = queries;
        this.encounterRuntimePort = encounterRuntimePort;
        controls.setOnMapSelected(this::handleMapSelected);
        canvas.setOnCellClicked(interaction -> handleSquareClicked(interaction.square()));
        canvas.setOnEndpointClicked(endpoint -> {
            if (endpoint != null && endpoint.squareId() != null) {
                handleSquareClicked(squaresById.get(endpoint.squareId()));
            }
        });
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
        DungeonUiAsyncSupport.submitValue(
                queries::getAllMaps,
                maps -> controls.setMaps(maps, selectedMapId),
                ex -> {
                    canvas.showLoadError("Dungeonliste konnte nicht geladen werden");
                    UiErrorReporter.reportBackgroundFailure("DungeonView.loadMapList()", ex);
                });
        loadMap(null);
    }

    private void handleMapSelected(Long mapId) {
        runtimeStatusMessage = null;
        loadMap(mapId);
    }

    private void loadMap(Long mapId) {
        if (mapId != null) {
            selectedMapId = mapId;
        }
        long requestToken = ++loadRequestToken;
        DungeonUiAsyncSupport.submitValue(
                () -> runtimeQueries.loadRuntimeState(mapId),
                runtimeState -> {
                    if (requestToken != loadRequestToken) {
                        return;
                    }
                    applyRuntimeState(runtimeState);
                },
                ex -> handleLoadFailure(requestToken, mapId, ex));
    }

    private void applyRuntimeState(DungeonRuntimeState runtimeState) {
        currentState = runtimeState.mapState();
        activeEndpointId = runtimeState.activeEndpointId();
        activeSquareId = runtimeState.activeSquareId();
        requiresInitialPosition = runtimeState.requiresInitialPosition();
        selectedMapId = currentState == null || currentState.map() == null ? null : currentState.map().mapId();
        if (currentState == null) {
            canvas.showEmptyState();
            canvas.setPartyEndpoint(null);
            canvas.setPartySquare(null);
            controls.selectMap(null);
            controls.showLocation(null, null, null, null, null);
            return;
        }
        rebuildLookups();
        controls.selectMap(selectedMapId);
        canvas.loadState(currentState);
        canvas.setSelectedSelection(DungeonSelection.none());
        updateLocationLabels();
    }

    private void handleSquareClicked(DungeonSquare square) {
        if (currentState == null || currentState.map() == null || square == null || square.squareId() == null) {
            if (requiresInitialPosition) {
                runtimeStatusMessage = "Startposition auf einem Dungeon-Feld wählen.";
                updateLocationLabels();
            }
            return;
        }
        if (requiresInitialPosition) {
            setInitialPosition(square);
            return;
        }
        moveToSquare(square);
    }

    private void setInitialPosition(DungeonSquare square) {
        DungeonUiAsyncSupport.submitValue(
                () -> runtimeCommands.setInitialPartyPosition(currentState.map().mapId(), square.squareId()),
                this::handleMoveResult,
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonView.setInitialPartyPosition()", ex));
    }

    private void moveToSquare(DungeonSquare square) {
        DungeonUiAsyncSupport.submitValue(
                () -> runtimeCommands.movePartyToSquare(currentState.map().mapId(), square.squareId()),
                this::handleMoveResult,
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonView.moveToSquare()", ex));
    }

    private void handleMoveResult(features.world.dungeonmap.service.runtime.DungeonMoveResult result) {
        if (result == null) {
            return;
        }
        runtimeStatusMessage = result.message();
        if (result.status() == DungeonMoveStatus.NOT_CONNECTED
                || result.status() == DungeonMoveStatus.INVALID_DESTINATION
                || result.status() == DungeonMoveStatus.NO_CURRENT_POSITION) {
            updateLocationLabels();
            return;
        }
        if (!result.triggeredTableIds().isEmpty() && !encounterRuntimePort.launchEncounterFromTables(result.triggeredTableIds())) {
            runtimeStatusMessage = "Random Encounter ausgelöst, aber ohne aktive Party nicht geöffnet.";
        }
        loadMap(currentState.map().mapId());
    }

    private void updateLocationLabels() {
        if (currentState == null) {
            canvas.setPartyEndpoint(null);
            canvas.setPartySquare(null);
            controls.showLocation(null, null, null, null, runtimeStatusMessage);
            return;
        }
        if (requiresInitialPosition || activeSquareId == null) {
            canvas.setPartyEndpoint(null);
            canvas.setPartySquare(null);
            String statusText = runtimeStatusMessage == null || runtimeStatusMessage.isBlank()
                    ? "Startposition auf der Karte wählen."
                    : runtimeStatusMessage;
            controls.showLocation(null, null, null, null, statusText);
            return;
        }
        DungeonSquare square = squaresById.get(activeSquareId);
        if (square == null) {
            canvas.setPartyEndpoint(null);
            canvas.setPartySquare(null);
            controls.showLocation(null, null, null, null, runtimeStatusMessage);
            return;
        }
        DungeonEndpoint endpoint = activeEndpointId == null ? null : endpointsById.get(activeEndpointId);
        String roomName = square.roomName();
        String areaName = square.areaName();
        String encounterProfile = null;
        if (square.areaId() != null) {
            DungeonArea area = areasById.get(square.areaId());
            if (area != null) {
                encounterProfile = DungeonAreaEncounterText.formatAreaSummary(area);
            }
        }
        controls.showLocation(roomName, areaName, encounterProfile, endpoint == null ? null : endpoint.name(), runtimeStatusMessage);
        canvas.setPartyEndpoint(activeEndpointId);
        canvas.setPartySquare(activeSquareId);
    }

    private void handleLoadFailure(long requestToken, Long mapId, Throwable throwable) {
        if (requestToken != loadRequestToken) {
            return;
        }
        currentState = null;
        activeEndpointId = null;
        activeSquareId = null;
        requiresInitialPosition = false;
        if (mapId != null) {
            selectedMapId = mapId;
        }
        canvas.showLoadError("Dungeon konnte nicht geladen werden");
        canvas.setPartyEndpoint(null);
        canvas.setPartySquare(null);
        controls.showLocation(null, null, null, null, runtimeStatusMessage);
        UiErrorReporter.reportBackgroundFailure("DungeonView.loadMap()", throwable);
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
