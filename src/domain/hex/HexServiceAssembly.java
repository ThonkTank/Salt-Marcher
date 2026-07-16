package src.domain.hex;

import java.util.Objects;
import src.domain.hex.model.map.HexEditorWorkspace;
import src.domain.hex.model.map.repository.HexMapRepository;
import src.domain.hex.published.HexEditorModel;
import src.domain.hex.published.HexTravelModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.PartyTravelPositionsModel;

public final class HexServiceAssembly {

    private final HexEditorApplicationService editorApplicationService;
    private final HexTravelApplicationService travelApplicationService;
    private final HexEditorModel editorModel = new HexEditorModel();
    private final HexTravelModel travelModel = new HexTravelModel();

    public HexServiceAssembly(
            HexMapRepository repository,
            PartyTravelPositionsModel partyTravelPositions,
            PartyApplicationService partyApplicationService
    ) {
        HexMapRepository safeRepository = Objects.requireNonNull(repository, "repository");
        editorApplicationService = new HexEditorApplicationService(
                safeRepository,
                new HexEditorWorkspace(),
                editorModel);
        travelApplicationService = new HexTravelApplicationService(
                safeRepository,
                Objects.requireNonNull(partyApplicationService, "partyApplicationService"),
                travelModel);
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
