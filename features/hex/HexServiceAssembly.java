package features.hex;

import features.hex.adapter.javafx.hexmap.HexMapContribution;
import features.hex.adapter.sqlite.repository.SqliteHexMapRepository;
import features.hex.api.HexEditorApi;
import features.hex.api.HexEditorModel;
import features.hex.api.HexTravelApi;
import features.hex.api.HexTravelModel;
import features.hex.application.HexEditorApplicationService;
import features.hex.application.HexEditorPublishedState;
import features.hex.application.HexEditorWorkspace;
import features.hex.application.HexTravelApplicationService;
import features.hex.application.HexTravelPublishedState;
import features.hex.domain.map.repository.HexMapRepository;
import features.party.api.PartyApi;
import features.party.api.PartyTravelPositionsModel;

import platform.diagnostics.Diagnostics;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;

import shell.api.ShellContribution;

import java.util.Objects;

public final class HexServiceAssembly {

    private final HexEditorApplicationService editorApplicationService;
    private final HexTravelApplicationService travelApplicationService;
    private final HexEditorModel editorModel;
    private final HexTravelModel travelModel;

    public static FeatureStoreDefinition storeDefinition() {
        return SqliteHexMapRepository.storeDefinition();
    }

    public HexServiceAssembly(
            HexMapRepository repository,
            PartyTravelPositionsModel partyTravelPositions,
            PartyApi partyApplicationService
    ) {
        this(
                repository,
                partyTravelPositions,
                partyApplicationService,
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                NoopDiagnostics.INSTANCE);
    }

    public static Component create(
            FeatureStoreHandle store,
            PartyTravelPositionsModel partyTravelPositions,
            PartyApi party,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        HexServiceAssembly assembly = new HexServiceAssembly(
                new SqliteHexMapRepository(store),
                partyTravelPositions,
                party,
                executionLane,
                uiDispatcher,
                diagnostics,
                false);
        return new Component(assembly);
    }

    public HexServiceAssembly(
            HexMapRepository repository,
            PartyTravelPositionsModel partyTravelPositions,
            PartyApi partyApplicationService,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        this(
                repository,
                partyTravelPositions,
                partyApplicationService,
                executionLane,
                uiDispatcher,
                diagnostics,
                true);
    }

    private HexServiceAssembly(
            HexMapRepository repository,
            PartyTravelPositionsModel partyTravelPositions,
            PartyApi partyApplicationService,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics,
            boolean startReadback
    ) {
        HexMapRepository safeRepository = Objects.requireNonNull(repository, "repository");
        ExecutionLane lane = Objects.requireNonNull(executionLane, "executionLane");
        UiDispatcher dispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
        Diagnostics safeDiagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
        HexEditorPublishedState editorState = new HexEditorPublishedState(dispatcher);
        editorModel = editorState.model();
        HexTravelPublishedState travelState = new HexTravelPublishedState(dispatcher);
        travelModel = travelState.model();
        editorApplicationService = new HexEditorApplicationService(
                safeRepository,
                new HexEditorWorkspace(),
                editorState,
                lane,
                safeDiagnostics);
        travelApplicationService = new HexTravelApplicationService(
                safeRepository,
                Objects.requireNonNull(partyApplicationService, "partyApplicationService"),
                travelState,
                lane,
                safeDiagnostics);
        PartyTravelPositionsModel safeTravelPositions = Objects.requireNonNull(
                partyTravelPositions, "partyTravelPositions");
        this.partyTravelPositions = safeTravelPositions;
        if (startReadback) {
            start();
        }
    }

    public HexEditorApi editorApplication() {
        return editorApplicationService;
    }

    public HexTravelApi travelApplication() {
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

    private final PartyTravelPositionsModel partyTravelPositions;
    private boolean started;

    private synchronized void start() {
        if (started) {
            return;
        }
        started = true;
        registerTravelReadback(partyTravelPositions);
    }

    public static final class Component {

        private final HexServiceAssembly assembly;

        private Component(HexServiceAssembly assembly) {
            this.assembly = Objects.requireNonNull(assembly, "assembly");
        }

        public HexEditorApi editor() {
            return assembly.editorApplicationService;
        }

        public HexTravelApi travel() {
            return assembly.travelApplicationService;
        }

        public HexEditorModel editorModel() {
            return assembly.editorModel;
        }

        public HexTravelModel travelModel() {
            return assembly.travelModel;
        }

        public void start() {
            assembly.start();
        }

        public ShellContribution mapContribution() {
            return new HexMapContribution(
                    assembly.editorApplicationService,
                    assembly.travelApplicationService,
                    assembly.editorModel,
                    assembly.travelModel);
        }

    }
}
