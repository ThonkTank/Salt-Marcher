package src.domain.party.application;

import java.util.List;
import java.util.Objects;
import src.domain.party.model.roster.helper.PartyRosterXpAllocationHelper;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class AwardPartyXpUseCase {

    private final PartyRosterRepository repository;
    private final PartyPublishedStateRepository publishedStateRepository;
    private final PartyRosterXpAllocationHelper xpAllocator = new PartyRosterXpAllocationHelper();

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
            publishedStateRepository.publishStorageErrorMutation();
        }
    }

    private PartyMutationStatus award(List<Long> ids, int xpPerCharacter) {
        PartyRoster roster = repository.load();
        PartyRosterXpAllocationHelper.Result result = xpAllocator.apply(roster.characters(), ids, xpPerCharacter);
        if (!result.validRequest()) {
            return PartyMutationStatus.INVALID_INPUT;
        }
        if (!result.updatedAny()) {
            return PartyMutationStatus.NOT_FOUND;
        }
        repository.save(roster.withCharacters(result.characters()));
        return PartyMutationStatus.SUCCESS;
    }

    private void publish(PartyMutationStatus status) {
        if (PartyMutationStatus.SUCCESS.equals(status)) {
            publishedStateRepository.publishRepositoryBackedState();
        }
        publishedStateRepository.publishMutationStatus(status);
    }
}
