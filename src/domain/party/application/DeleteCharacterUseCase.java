package src.domain.party.application;

import java.util.Objects;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.model.PartyRosterMutation;
import src.domain.party.model.roster.repository.PartyEncounterSessionRepository;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class DeleteCharacterUseCase {

    private final PartyRosterRepository repository;
    private final PartyPublishedStateRepository publishedStateRepository;
    private final PartyEncounterSessionRepository encounterSessionRepository;

    public DeleteCharacterUseCase(
            PartyRosterRepository repository,
            PartyPublishedStateRepository publishedStateRepository,
            PartyEncounterSessionRepository encounterSessionRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.encounterSessionRepository =
                Objects.requireNonNull(encounterSessionRepository, "encounterSessionRepository");
    }

    public void execute(long id) {
        try {
            PartyMutationStatus status = delete(id);
            publish(status);
        } catch (IllegalStateException exception) {
            publishedStateRepository.publishStorageErrorMutation();
        }
    }

    private PartyMutationStatus delete(long id) {
        PartyRoster roster = repository.load();
        PartyRosterMutation mutation = roster.deleteCharacter(id);
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
}
