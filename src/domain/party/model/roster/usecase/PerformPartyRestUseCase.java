package src.domain.party.model.roster.usecase;

import java.util.Objects;
import src.domain.party.model.roster.PartyMutationStatus;
import src.domain.party.model.roster.PartyRestType;
import src.domain.party.model.roster.PartyRoster;
import src.domain.party.model.roster.PartyRosterMutation;
import src.domain.party.model.roster.repository.PartyEncounterSessionRepository;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class PerformPartyRestUseCase {

    private static final String LONG_REST_TYPE = "LONG_REST";

    private final PartyRosterRepository repository;
    private final PartyPublishedStateRepository publishedStateRepository;
    private final PartyEncounterSessionRepository encounterSessionRepository;

    public PerformPartyRestUseCase(
            PartyRosterRepository repository,
            PartyPublishedStateRepository publishedStateRepository,
            PartyEncounterSessionRepository encounterSessionRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.encounterSessionRepository =
                Objects.requireNonNull(encounterSessionRepository, "encounterSessionRepository");
    }

    public void execute(String restType) {
        try {
            PartyMutationStatus status = perform(restType(restType));
            publish(status);
        } catch (IllegalStateException exception) {
            publishedStateRepository.publishStorageErrorMutation(new PartyPublishedStateRepository.StatePublication());
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
            publishedStateRepository.publishRepositoryBackedState(new PartyPublishedStateRepository.StatePublication());
            encounterSessionRepository.refreshEncounterSession();
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
