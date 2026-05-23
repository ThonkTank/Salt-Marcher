package src.domain.party.model.roster.usecase;

import java.util.Objects;
import src.domain.party.model.roster.model.PartyMembership;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.model.PartyRosterMutation;
import src.domain.party.model.roster.repository.PartyEncounterSessionRepository;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class SetPartyMembershipUseCase {

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
            publishMembershipResult(updateMembership(id, PartyMembership.valueOf(membership)));
        } catch (IllegalStateException exception) {
            publishedStateRepository.publishStorageErrorMutation(new PartyPublishedStateRepository.StatePublication());
        }
    }

    private PartyMutationStatus updateMembership(long id, PartyMembership membership) {
        PartyRoster roster = repository.load();
        PartyRosterMutation mutation = persistMembershipChange(roster.setMembership(id, membership));
        return mutation.status();
    }

    private PartyRosterMutation persistMembershipChange(PartyRosterMutation mutation) {
        if (!mutation.successful()) {
            return mutation;
        }
        repository.save(mutation.roster());
        return mutation;
    }

    private void publishMembershipResult(PartyMutationStatus status) {
        if (!PartyMutationStatus.SUCCESS.equals(status)) {
            publishedStateRepository.publishMutationStatus(status);
            return;
        }
        publishedStateRepository.publishRepositoryBackedState(new PartyPublishedStateRepository.StatePublication());
        encounterSessionRepository.refreshEncounterSession();
        publishedStateRepository.publishMutationStatus(status);
    }
}
