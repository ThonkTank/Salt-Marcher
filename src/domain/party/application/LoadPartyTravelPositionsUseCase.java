package src.domain.party.application;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.party.roster.entity.PartyCharacter;
import src.domain.party.roster.port.PartyRosterRepository;
import src.domain.party.roster.value.PartyTravelLocation;

public final class LoadPartyTravelPositionsUseCase {

    private final PartyRosterRepository repository;

    public LoadPartyTravelPositionsUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public Result execute(List<Long> characterIds) {
        Set<Long> requestedIds = new LinkedHashSet<>(characterIds == null ? List.of() : characterIds);
        List<TravelPosition> positions = repository.load().characters().stream()
                .filter(character -> requestedIds.isEmpty() || requestedIds.contains(character.id()))
                .map(LoadPartyTravelPositionsUseCase::travelPosition)
                .toList();
        PartyTravelLocation partyTokenLocation = positions.stream()
                .filter(TravelPosition::attachedToPartyToken)
                .map(TravelPosition::location)
                .filter(location -> location != null)
                .findFirst()
                .orElse(null);
        return new Result(positions, partyTokenLocation);
    }

    private static TravelPosition travelPosition(PartyCharacter character) {
        return new TravelPosition(
                character.id(),
                character.travel().attachedToPartyToken(),
                character.travel().location());
    }

    public record Result(
            List<TravelPosition> positions,
            @Nullable PartyTravelLocation partyTokenLocation
    ) {
        public Result {
            positions = positions == null ? List.of() : List.copyOf(positions);
        }
    }

    public record TravelPosition(
            long characterId,
            boolean attachedToPartyToken,
            @Nullable PartyTravelLocation location
    ) {
    }
}
