package src.domain.party.application;

import src.domain.party.roster.entity.PartyCharacter;
import src.domain.party.roster.value.PartyRosterProjection;
import src.domain.party.roster.port.PartyRosterRepository;

import java.util.List;

public final class LoadPartySnapshotUseCase {

    private final PartyRosterRepository repository;

    public LoadPartySnapshotUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public PartySnapshotProjection execute() {
        PartyRosterProjection roster = repository.load().projection();
        return new PartySnapshotProjection(
                roster.activeMembers(),
                roster.reserveMembers(),
                roster.averageActiveLevel());
    }

    public record PartySnapshotProjection(
            List<PartyCharacter> activeMembers,
            List<PartyCharacter> reserveMembers,
            int averageLevel
    ) {
        public PartySnapshotProjection {
            activeMembers = activeMembers == null ? List.of() : List.copyOf(activeMembers);
            reserveMembers = reserveMembers == null ? List.of() : List.copyOf(reserveMembers);
        }
    }
}
