package src.domain.party.application;

import java.util.Objects;
import src.domain.party.model.roster.model.PartyMembership;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.model.PartyRosterMutation;
import src.domain.party.model.roster.repository.PartyEncounterSessionRepository;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class SetPartyMembershipUseCase {

    private static final String ACTIVE_MEMBERSHIP = "ACTIVE";

    private final PartyRosterRepository repository;
    private final PartyPublishedStateRepository publishedStateRepository;
    private final PartyEncounterSessionRepository encounterSessionRepository;

    public SetPartyMembershipUseCase(
            PartyRosterRepository repository,
            PartyPublishedStateRepository publishedStateRepository,
            PartyEncounterSessionRepository encounterSessionRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.encounterSessionRepository =
                Objects.requireNonNull(encounterSessionRepository, "encounterSessionRepository");
    }

    public void execute(long id, String membership) {
        try {
            PartyMutationStatus status = updateMembership(id, membership(membership));
            publish(status);
        } catch (IllegalStateException exception) {
            publishedStateRepository.publishStorageErrorMutation();
        }
    }

    private PartyMutationStatus updateMembership(long id, PartyMembership membership) {
        PartyRoster roster = repository.load();
        PartyRosterMutation mutation = roster.setMembership(id, membership);
        if (mutation.successful()) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }

    private void publish(PartyMutationStatus status) {
        if (PartyMutationStatus.SUCCESS.equals(status)) {
            publishedStateRepository.publishRepositoryBackedState();
            encounterSessionRepository.refreshEncounterSession();
        }
        publishedStateRepository.publishMutationStatus(status);
    }

    private static PartyMembership membership(String membership) {
        if (ACTIVE_MEMBERSHIP.equals(membership)) {
            return PartyMembership.ACTIVE;
        }
        return PartyMembership.RESERVE;
    }
}
