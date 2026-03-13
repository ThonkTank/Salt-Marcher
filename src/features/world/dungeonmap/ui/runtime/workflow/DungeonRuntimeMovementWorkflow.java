package features.world.dungeonmap.ui.runtime.workflow;

import features.encounter.api.EncounterRuntimePort;
import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonEndpoint;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.service.runtime.DungeonMoveResult;
import features.world.dungeonmap.service.runtime.DungeonMoveStatus;
import features.world.dungeonmap.service.runtime.DungeonRuntimeCommandService;
import features.world.dungeonmap.ui.runtime.controls.DungeonViewControls;
import features.world.dungeonmap.ui.runtime.state.DungeonRuntimeViewState;
import features.world.dungeonmap.ui.shared.async.DungeonUiAsyncSupport;
import features.world.dungeonmap.ui.shared.format.DungeonAreaEncounterText;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import ui.async.UiErrorReporter;

public final class DungeonRuntimeMovementWorkflow {

    private final DungeonRuntimeViewState state;
    private final DungeonViewControls controls;
    private final DungeonMapPane canvas;
    private final DungeonRuntimeCommandService runtimeCommands = new DungeonRuntimeCommandService();
    private final EncounterRuntimePort encounterRuntimePort;
    private final Runnable reloadCurrentMap;

    public DungeonRuntimeMovementWorkflow(
            DungeonRuntimeViewState state,
            DungeonViewControls controls,
            DungeonMapPane canvas,
            EncounterRuntimePort encounterRuntimePort,
            Runnable reloadCurrentMap
    ) {
        this.state = state;
        this.controls = controls;
        this.canvas = canvas;
        this.encounterRuntimePort = encounterRuntimePort;
        this.reloadCurrentMap = reloadCurrentMap;
    }

    public void handleSquareClicked(DungeonSquare square) {
        if (state.currentState() == null || state.currentState().map() == null || square == null || square.squareId() == null) {
            if (state.requiresInitialPosition()) {
                state.setRuntimeStatusMessage("Startposition auf einem Dungeon-Feld wählen.");
                updateLocationLabels();
            }
            return;
        }
        if (state.requiresInitialPosition()) {
            setInitialPosition(square);
            return;
        }
        moveToSquare(square);
    }

    public void updateLocationLabels() {
        if (state.currentState() == null) {
            canvas.setPartyEndpoint(null);
            canvas.setPartySquare(null);
            controls.showLocation(null, null, null, null, state.runtimeStatusMessage());
            return;
        }
        if (state.requiresInitialPosition() || state.activeSquareId() == null) {
            canvas.setPartyEndpoint(null);
            canvas.setPartySquare(null);
            String statusText = state.runtimeStatusMessage() == null || state.runtimeStatusMessage().isBlank()
                    ? "Startposition auf der Karte wählen."
                    : state.runtimeStatusMessage();
            controls.showLocation(null, null, null, null, statusText);
            return;
        }
        DungeonSquare square = state.squareById(state.activeSquareId());
        if (square == null) {
            canvas.setPartyEndpoint(null);
            canvas.setPartySquare(null);
            controls.showLocation(null, null, null, null, state.runtimeStatusMessage());
            return;
        }
        DungeonEndpoint endpoint = state.endpointById(state.activeEndpointId());
        String encounterProfile = null;
        if (square.areaId() != null) {
            DungeonArea area = state.areaById(square.areaId());
            if (area != null) {
                encounterProfile = DungeonAreaEncounterText.formatAreaSummary(area);
            }
        }
        controls.showLocation(
                square.roomName(),
                square.areaName(),
                encounterProfile,
                endpoint == null ? null : endpoint.name(),
                state.runtimeStatusMessage());
        canvas.setPartyEndpoint(state.activeEndpointId());
        canvas.setPartySquare(state.activeSquareId());
    }

    private void setInitialPosition(DungeonSquare square) {
        DungeonUiAsyncSupport.submitValue(
                () -> runtimeCommands.setInitialPartyPosition(state.currentMapId(), square.squareId()),
                this::handleMoveResult,
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonRuntimeMovementWorkflow.setInitialPartyPosition()", ex));
    }

    private void moveToSquare(DungeonSquare square) {
        DungeonUiAsyncSupport.submitValue(
                () -> runtimeCommands.movePartyToSquare(state.currentMapId(), square.squareId()),
                this::handleMoveResult,
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonRuntimeMovementWorkflow.moveToSquare()", ex));
    }

    private void handleMoveResult(DungeonMoveResult result) {
        if (result == null) {
            return;
        }
        state.setRuntimeStatusMessage(result.message());
        if (result.status() == DungeonMoveStatus.NOT_CONNECTED
                || result.status() == DungeonMoveStatus.INVALID_DESTINATION
                || result.status() == DungeonMoveStatus.NO_CURRENT_POSITION) {
            updateLocationLabels();
            return;
        }
        if (!result.triggeredTableIds().isEmpty() && !encounterRuntimePort.launchEncounterFromTables(result.triggeredTableIds())) {
            state.setRuntimeStatusMessage("Random Encounter ausgelöst, aber ohne aktive Party nicht geöffnet.");
        }
        reloadCurrentMap.run();
    }
}
