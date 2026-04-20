package src.domain.party.application;

import src.domain.party.roster.value.PartyRosterProjection;
import src.domain.party.roster.port.PartyRosterRepository;

import java.util.List;

public final class LoadActivePartyCompositionUseCase {

    public record ActiveComposition(
            List<Integer> activePartyLevels,
            int averageActiveLevel
    ) {
        public ActiveComposition {
            activePartyLevels = activePartyLevels == null ? List.of() : List.copyOf(activePartyLevels);
        }
    }

    private final PartyRosterRepository repository;

    public LoadActivePartyCompositionUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public ActiveComposition execute() {
        PartyRosterProjection roster = repository.load().projection();
        return new ActiveComposition(
                roster.activeLevelsByComposition(),
                roster.averageActiveLevel());
    }
}
