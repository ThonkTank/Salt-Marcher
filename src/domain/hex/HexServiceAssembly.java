package src.domain.hex;

import java.util.Objects;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;
import src.domain.hex.model.map.HexEditorWorkspace;
import src.domain.hex.model.map.repository.HexMapRepository;
import src.domain.hex.published.HexEditorModel;
import src.domain.hex.published.HexTravelModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.PartyTravelPositionsModel;

public final class HexServiceAssembly {

    private final HexEditorApplicationService editorApplicationService;
    private final HexTravelApplicationService travelApplicationService;
    private final HexEditorModel editorModel;
    private final HexTravelModel travelModel;

    public HexServiceAssembly(
            HexMapRepository repository,
            PartyTravelPositionsModel partyTravelPositions,
            PartyApplicationService partyApplicationService
    ) {
        this(
                repository,
                partyTravelPositions,
                partyApplicationService,
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                NoopDiagnostics.INSTANCE);
    }

    public HexServiceAssembly(
            HexMapRepository repository,
            PartyTravelPositionsModel partyTravelPositions,
            PartyApplicationService partyApplicationService,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        HexMapRepository safeRepository = Objects.requireNonNull(repository, "repository");
        ExecutionLane lane = Objects.requireNonNull(executionLane, "executionLane");
        UiDispatcher dispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
        Diagnostics safeDiagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
        editorModel = new HexEditorModel(dispatcher);
        travelModel = new HexTravelModel(dispatcher);
        editorApplicationService = new HexEditorApplicationService(
                safeRepository,
                new HexEditorWorkspace(),
                editorModel,
                lane,
                safeDiagnostics);
        travelApplicationService = new HexTravelApplicationService(
                safeRepository,
                Objects.requireNonNull(partyApplicationService, "partyApplicationService"),
                travelModel,
                lane,
                safeDiagnostics);
        registerTravelReadback(Objects.requireNonNull(partyTravelPositions, "partyTravelPositions"));
    }

    public HexEditorApplicationService editorApplication() {
        return editorApplicationService;
    }

    public HexTravelApplicationService travelApplication() {
        return travelApplicationService;
    }

    public HexEditorModel editorModel() {
        return editorModel;
    }

    public HexTravelModel travelModel() {
        return travelModel;
    }

    private void registerTravelReadback(PartyTravelPositionsModel partyTravelPositions) {
        travelApplicationService.acceptPartyTravelPosition(partyTravelPositions.current());
        partyTravelPositions.subscribe(travelApplicationService::acceptPartyTravelPosition);
    }
}
