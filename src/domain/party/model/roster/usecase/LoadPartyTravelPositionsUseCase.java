package src.domain.party.model.roster.usecase;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.party.model.roster.PartyCharacter;
import src.domain.party.model.roster.PartyTravelLocation;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class LoadPartyTravelPositionsUseCase {

    private final PartyRosterRepository repository;

    public LoadPartyTravelPositionsUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public Result execute(List<Long> characterIds) {
        Set<Long> requestedIds = new LinkedHashSet<>(characterIds == null ? List.of() : characterIds);
        List<TravelPosition> positions = new ArrayList<>();
        PartyTravelLocation partyTokenLocation = null;
        for (PartyCharacter character : repository.load().characters()) {
            if (!requestedIds.isEmpty() && !requestedIds.contains(character.id())) {
                continue;
            }
            TravelPosition position = travelPosition(character);
            positions.add(position);
            if (partyTokenLocation == null && position.attachedToPartyToken() && position.location() != null) {
                partyTokenLocation = position.location();
            }
        }
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
