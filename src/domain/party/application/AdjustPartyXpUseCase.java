package src.domain.party.application;

import java.util.List;
import java.util.Objects;
import src.domain.party.model.roster.helper.PartyRosterXpAllocationHelper;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class AdjustPartyXpUseCase {

    private final PartyRosterRepository repository;
    private final PartyPublishedStateRepository publishedStateRepository;
    private final PartyRosterXpAllocationHelper xpAllocator = new PartyRosterXpAllocationHelper();

    public AdjustPartyXpUseCase(
            PartyRosterRepository repository,
            PartyPublishedStateRepository publishedStateRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(List<Long> ids, int xpDelta) {
        try {
            PartyMutationStatus status = adjust(ids, xpDelta);
            publish(status);
        } catch (IllegalStateException exception) {
            publishedStateRepository.publishStorageErrorMutation();
        }
    }

    private PartyMutationStatus adjust(List<Long> ids, int xpDelta) {
        PartyRoster roster = repository.load();
        PartyRosterXpAllocationHelper.Result result = xpAllocator.apply(roster.characters(), ids, xpDelta);
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
        if (status == PartyMutationStatus.SUCCESS) {
            publishedStateRepository.publishRepositoryBackedState();
        }
        publishedStateRepository.publishMutationStatus(status);
    }
}
