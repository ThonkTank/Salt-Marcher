package src.domain.party.model.roster.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.party.model.roster.PartyMutationStatus;
import src.domain.party.model.roster.PartyRoster;
import src.domain.party.model.roster.PartyRosterMutation;
import src.domain.party.model.roster.repository.PartyEncounterSessionRepository;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class AdjustPartyXpUseCase {

    private final PartyRosterRepository repository;
    private final PartyPublishedStateRepository publishedStateRepository;
    private final PartyEncounterSessionRepository encounterSessionRepository;

    public AdjustPartyXpUseCase(
            PartyRosterRepository repository,
            PartyPublishedStateRepository publishedStateRepository,
            PartyEncounterSessionRepository encounterSessionRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.encounterSessionRepository =
                Objects.requireNonNull(encounterSessionRepository, "encounterSessionRepository");
    }

    public void execute(List<Long> ids, int xpDelta) {
        try {
            PartyMutationStatus status = adjust(ids, xpDelta);
            publish(status);
        } catch (IllegalStateException exception) {
            publishedStateRepository.publishStorageErrorMutation(new PartyPublishedStateRepository.StatePublication());
        }
    }

    private PartyMutationStatus adjust(List<Long> ids, int xpDelta) {
        PartyRoster roster = repository.load();
        PartyRosterMutation mutation = roster.adjustXp(ids, xpDelta);
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
}
