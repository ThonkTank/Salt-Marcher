package features.party.api;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record PartyTravelPositionsResult(
        ReadStatus status,
        List<PartyTravelPositionSnapshot> positions,
        @Nullable PartyTravelLocationSnapshot partyTokenLocation,
        List<Long> partyTokenCharacterIds
) {
    public PartyTravelPositionsResult(
            ReadStatus status,
            List<PartyTravelPositionSnapshot> positions,
            @Nullable PartyTravelLocationSnapshot partyTokenLocation
    ) {
        this(status, positions, partyTokenLocation, partyTokenCharacterIdsFrom(positions));
    }

    public PartyTravelPositionsResult {
        status = status == null ? ReadStatus.SUCCESS : status;
        positions = positions == null ? List.of() : List.copyOf(positions);
        partyTokenCharacterIds = partyTokenCharacterIds == null ? List.of() : List.copyOf(partyTokenCharacterIds);
    }

    private static List<Long> partyTokenCharacterIdsFrom(List<PartyTravelPositionSnapshot> positions) {
        return (positions == null ? List.<PartyTravelPositionSnapshot>of() : positions).stream()
                .filter(PartyTravelPositionSnapshot::attachedToPartyToken)
                .map(PartyTravelPositionSnapshot::characterId)
                .toList();
    }
}
