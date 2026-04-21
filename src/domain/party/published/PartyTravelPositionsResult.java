package src.domain.party.published;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record PartyTravelPositionsResult(
        ReadStatus status,
        List<PartyTravelPositionSnapshot> positions,
        @Nullable PartyTravelLocationSnapshot partyTokenLocation
) {

    public PartyTravelPositionsResult {
        status = status == null ? ReadStatus.SUCCESS : status;
        positions = positions == null ? List.of() : List.copyOf(positions);
    }
}
