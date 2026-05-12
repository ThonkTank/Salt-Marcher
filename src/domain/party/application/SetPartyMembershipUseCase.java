package src.domain.party.application;

import java.util.Objects;
import src.domain.party.model.roster.helper.PartyRosterMutationHelper;
import src.domain.party.model.roster.model.PartyMembership;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class SetPartyMembershipUseCase {

    private static final String ACTIVE_MEMBERSHIP = "ACTIVE";

    private final PartyRosterRepository repository;
    private final PartyPublishedStateRepository publishedStateRepository;
    private final PartyRosterMutationHelper mutations = new PartyRosterMutationHelper();

    public SetPartyMembershipUseCase(
            PartyRosterRepository repository,
            PartyPublishedStateRepository publishedStateRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
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
        java.util.List<src.domain.party.model.roster.model.PartyCharacter> nextCharacters =
                mutations.updateMembership(roster.characters(), id, membership);
        if (nextCharacters.isEmpty()) {
            return PartyMutationStatus.NOT_FOUND;
        }
        repository.save(roster.withCharacters(nextCharacters));
        return PartyMutationStatus.SUCCESS;
    }

    private void publish(PartyMutationStatus status) {
        if (status == PartyMutationStatus.SUCCESS) {
            publishedStateRepository.publishRepositoryBackedState();
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
