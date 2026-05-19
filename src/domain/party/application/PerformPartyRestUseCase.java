package src.domain.party.application;

import java.util.Objects;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyRestType;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.model.PartyRosterMutation;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class PerformPartyRestUseCase {

    private static final String LONG_REST_TYPE = "LONG_REST";

    private final PartyRosterRepository repository;
    private final PartyPublishedStateRepository publishedStateRepository;

    public PerformPartyRestUseCase(
            PartyRosterRepository repository,
            PartyPublishedStateRepository publishedStateRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(String restType) {
        try {
            PartyMutationStatus status = perform(restType(restType));
            publish(status);
        } catch (IllegalStateException exception) {
            publishedStateRepository.publishStorageErrorMutation();
        }
    }

    private PartyMutationStatus perform(PartyRestType restType) {
        PartyRoster roster = repository.load();
        PartyRosterMutation mutation = roster.performRest(restType);
        if (mutation.successful()) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }

    private void publish(PartyMutationStatus status) {
        if (PartyMutationStatus.SUCCESS.equals(status)) {
            publishedStateRepository.publishRepositoryBackedState();
        }
        publishedStateRepository.publishMutationStatus(status);
    }

    private static PartyRestType restType(String restType) {
        if (LONG_REST_TYPE.equals(restType)) {
            return PartyRestType.LONG_REST;
        }
        return PartyRestType.SHORT_REST;
    }
}
