package src.domain.hex;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.hex.model.map.HexEditorState;
import src.domain.hex.model.map.HexEditorWorkspace;
import src.domain.hex.model.map.port.HexTravelPositionPort;
import src.domain.hex.model.map.repository.HexEditorPublishedStateRepository;
import src.domain.hex.model.map.repository.HexMapRepository;
import src.domain.hex.model.map.repository.HexTravelPartyPositionApplicationRepository;
import src.domain.hex.model.map.repository.HexTravelPartyPositionRepository;
import src.domain.hex.model.map.usecase.CreateHexMapUseCase;
import src.domain.hex.model.map.usecase.LoadHexEditorStateUseCase;
import src.domain.hex.model.map.usecase.LoadHexEditorUseCase;
import src.domain.hex.model.map.usecase.MoveHexPartyTokenUseCase;
import src.domain.hex.model.map.usecase.PaintHexTerrainUseCase;
import src.domain.hex.model.map.usecase.RenameHexMapUseCase;
import src.domain.hex.model.map.usecase.SaveHexMarkerUseCase;
import src.domain.hex.model.map.usecase.SelectHexMapUseCase;
import src.domain.hex.model.map.usecase.SelectHexTileUseCase;
import src.domain.hex.model.map.usecase.SetHexEditorToolUseCase;
import src.domain.hex.model.map.usecase.UpdateHexMapUseCase;
import src.domain.hex.model.map.usecase.UpdateHexTravelPositionUseCase;
import src.domain.hex.published.HexEditorModel;
import src.domain.hex.published.HexEditorSnapshot;
import src.domain.hex.published.HexTravelModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.PartyTravelPositionsModel;

final class HexServiceAssembly implements HexEditorPublishedStateRepository {

    private final HexMapRepository repository;
    private final HexTravelPartyPositionRepository travelRepository;
    private final HexTravelPublishedStateServiceAssembly travelPublishedState;
    private final HexEditorWorkspace workspace = new HexEditorWorkspace();
    private final List<Consumer<HexEditorSnapshot>> listeners = new ArrayList<>();
    private HexEditorSnapshot currentSnapshot = HexEditorSnapshot.empty("No Hex map loaded.");

    HexServiceAssembly(
            HexMapRepository repository,
            PartyTravelPositionsModel partyTravelPositions,
            PartyApplicationService partyApplicationService
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.travelPublishedState = new HexTravelPublishedStateServiceAssembly();
        HexTravelPartyBoundaryServiceAssembly partyBoundary = new HexTravelPartyBoundaryServiceAssembly(
                Objects.requireNonNull(partyApplicationService, "partyApplicationService"));
        this.travelRepository = new HexTravelPartyPositionApplicationRepository(
                partyBoundary);
        registerTravelPositionPort(Objects.requireNonNull(partyTravelPositions, "partyTravelPositions"));
    }

    HexEditorApplicationService editorApplicationService() {
        LoadHexEditorStateUseCase loadState = new LoadHexEditorStateUseCase(
                repository,
                workspace,
                this);
        return new HexEditorApplicationService(
                new CreateHexMapUseCase(repository, loadState),
                new LoadHexEditorUseCase(loadState),
                new SelectHexMapUseCase(repository, loadState),
                new UpdateHexMapUseCase(repository, loadState),
                new RenameHexMapUseCase(repository, loadState),
                new SelectHexTileUseCase(repository, loadState),
                new PaintHexTerrainUseCase(repository, loadState),
                new SaveHexMarkerUseCase(repository, loadState),
                new SetHexEditorToolUseCase(loadState));
    }

    HexEditorModel editorModel() {
        return new HexEditorModel(this::current, this::subscribe);
    }

    HexTravelApplicationService travelApplicationService() {
        return new HexTravelApplicationService(new MoveHexPartyTokenUseCase(repository, travelRepository));
    }

    HexTravelModel travelModel() {
        return travelPublishedState.model();
    }

    @Override
    public void publish(HexEditorState state) {
        currentSnapshot = HexEditorSnapshotProjectionServiceAssembly.project(Objects.requireNonNull(state, "state"));
        for (Consumer<HexEditorSnapshot> listener : List.copyOf(listeners)) {
            listener.accept(currentSnapshot);
        }
    }

    private HexEditorSnapshot current() {
        return currentSnapshot;
    }

    private Runnable subscribe(Consumer<HexEditorSnapshot> listener) {
        Consumer<HexEditorSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
        listeners.add(safeListener);
        safeListener.accept(currentSnapshot);
        return () -> listeners.remove(safeListener);
    }

    private void registerTravelPositionPort(PartyTravelPositionsModel partyTravelPositions) {
        HexTravelPositionPort travelPositionPort = new HexTravelPositionPort(
                new UpdateHexTravelPositionUseCase(repository, travelPublishedState));
        travelPositionPort.acceptPartyTravelPosition(
                HexTravelPartyBoundaryServiceAssembly.toFact(partyTravelPositions.current()));
        partyTravelPositions.subscribe(result -> travelPositionPort.acceptPartyTravelPosition(
                HexTravelPartyBoundaryServiceAssembly.toFact(result)));
    }

}
