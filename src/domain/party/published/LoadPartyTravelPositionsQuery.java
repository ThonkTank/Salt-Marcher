package src.domain.party.published;

import java.util.List;

public record LoadPartyTravelPositionsQuery(
        List<Long> characterIds
) {

    public LoadPartyTravelPositionsQuery {
        characterIds = characterIds == null ? List.of() : List.copyOf(characterIds);
    }
}
