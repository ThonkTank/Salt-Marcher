package src.domain.party.application;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.party.model.roster.model.PartyCharacterDraft;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.model.PartyRosterMutation;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class UpdateCharacterUseCase {

    private final PartyRosterRepository repository;
    private final PartyPublishedStateRepository publishedStateRepository;

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
        PartyRoster roster = repository.load();
        PartyRosterMutation mutation = roster.updateCharacter(id, draft);
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
}
