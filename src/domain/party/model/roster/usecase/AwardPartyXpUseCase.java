package src.domain.party.model.roster.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.model.PartyRosterMutation;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class AwardPartyXpUseCase {

    private final PartyRosterRepository repository;
    private final PartyPublishedStateRepository publishedStateRepository;

    public AwardPartyXpUseCase(
            PartyRosterRepository repository,
            PartyPublishedStateRepository publishedStateRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(List<Long> ids, int xpPerCharacter) {
        try {
            PartyMutationStatus status = award(ids, Math.max(0, xpPerCharacter));
            publish(status);
        } catch (IllegalStateException exception) {
            publishedStateRepository.publishStorageErrorMutation(new PartyPublishedStateRepository.StatePublication());
        }
    }

    private PartyMutationStatus award(List<Long> ids, int xpPerCharacter) {
        PartyRoster roster = repository.load();
        PartyRosterMutation mutation = roster.adjustXp(ids, xpPerCharacter);
        if (mutation.successful()) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }

    private void publish(PartyMutationStatus status) {
        if (PartyMutationStatus.SUCCESS.equals(status)) {
            publishedStateRepository.publishRepositoryBackedState(new PartyPublishedStateRepository.StatePublication());
        }
        publishedStateRepository.publishMutationStatus(status);
    }
}
