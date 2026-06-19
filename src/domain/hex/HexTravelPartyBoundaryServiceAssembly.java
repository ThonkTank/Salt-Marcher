package src.domain.hex;

import java.util.List;
import java.util.Objects;
import src.domain.hex.model.map.HexPartyTravelPositionFact;
import src.domain.hex.model.map.repository.HexTravelPartyPositionWriterRepository;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.MovePartyCharactersCommand;
import src.domain.party.published.PartyOverworldTravelLocationSnapshot;
import src.domain.party.published.PartyTravelPositionsResult;
import src.domain.party.published.ReadStatus;

final class HexTravelPartyBoundaryServiceAssembly implements HexTravelPartyPositionWriterRepository {

    private final PartyApplicationService party;

    HexTravelPartyBoundaryServiceAssembly(PartyApplicationService party) {
        this.party = Objects.requireNonNull(party, "party");
    }

    @Override
    public void movePartyToken(long mapId, long tileId, List<Long> characterIds) {
        party.moveCharacters(new MovePartyCharactersCommand(
                characterIds,
                new PartyOverworldTravelLocationSnapshot(mapId, tileId),
                true));
    }

    static HexPartyTravelPositionFact toFact(PartyTravelPositionsResult result) {
        PartyTravelPositionsResult safeResult = result == null
                ? new PartyTravelPositionsResult(ReadStatus.STORAGE_ERROR, List.of(), null)
                : result;
        if (safeResult.status() != ReadStatus.SUCCESS) {
            return HexPartyTravelPositionFact.unavailable("Hex-Reise konnte nicht geladen werden.");
        }
        Object location = safeResult.partyTokenLocation();
        if (!(location instanceof PartyOverworldTravelLocationSnapshot overworld)) {
            return HexPartyTravelPositionFact.unavailable("Keine Hex-Reiseposition ausgewaehlt.");
        }
        return HexPartyTravelPositionFact.active(
                overworld.mapId(),
                overworld.tileId(),
                safeResult.partyTokenCharacterIds());
    }
}
