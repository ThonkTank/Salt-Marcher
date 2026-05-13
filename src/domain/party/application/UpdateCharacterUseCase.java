package src.domain.party.application;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.party.model.roster.helper.PartyCharacterDraftValidationHelper;
import src.domain.party.model.roster.helper.PartyRosterMutationHelper;
import src.domain.party.model.roster.model.PartyCharacterDraft;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class UpdateCharacterUseCase {

    private final PartyRosterRepository repository;
    private final PartyPublishedStateRepository publishedStateRepository;
    private final PartyCharacterDraftValidationHelper draftValidator = new PartyCharacterDraftValidationHelper();
    private final PartyRosterMutationHelper mutations = new PartyRosterMutationHelper();

    public UpdateCharacterUseCase(
            PartyRosterRepository repository,
            PartyPublishedStateRepository publishedStateRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(
            long id,
            @Nullable String name,
            @Nullable String playerName,
            int level,
            int passivePerception,
            int armorClass
    ) {
        try {
            PartyMutationStatus status = update(id, new PartyCharacterDraft(
                    name,
                    playerName,
                    level,
                    passivePerception,
                    armorClass));
            publish(status);
        } catch (IllegalStateException exception) {
            publishedStateRepository.publishStorageErrorMutation();
        }
    }

    private PartyMutationStatus update(long id, PartyCharacterDraft draft) {
        if (!draftValidator.isValid(draft)) {
            return PartyMutationStatus.INVALID_INPUT;
        }
        PartyRoster roster = repository.load();
        java.util.List<src.domain.party.model.roster.model.PartyCharacter> nextCharacters =
                mutations.updateDraft(roster.characters(), id, draft);
        if (nextCharacters.isEmpty()) {
            return PartyMutationStatus.NOT_FOUND;
        }
        repository.save(roster.withCharacters(nextCharacters));
        return PartyMutationStatus.SUCCESS;
    }

    private void publish(PartyMutationStatus status) {
        if (PartyMutationStatus.SUCCESS.equals(status)) {
            publishedStateRepository.publishRepositoryBackedState();
        }
        publishedStateRepository.publishMutationStatus(status);
    }
}
