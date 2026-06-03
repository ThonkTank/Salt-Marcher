package src.domain.party.model.roster.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.party.model.roster.PartyCharacterDraft;
import src.domain.party.model.roster.PartyMutationStatus;
import src.domain.party.model.roster.PartyRoster;
import src.domain.party.model.roster.PartyRosterMutation;
import src.domain.party.model.roster.repository.PartyEncounterSessionRepository;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class UpdateCharacterUseCase {

    private final PartyRosterRepository repository;
    private final PartyPublishedStateRepository publishedStateRepository;
    private final PartyEncounterSessionRepository encounterSessionRepository;

    public UpdateCharacterUseCase(
            PartyRosterRepository repository,
            PartyPublishedStateRepository publishedStateRepository,
            PartyEncounterSessionRepository encounterSessionRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.encounterSessionRepository =
                Objects.requireNonNull(encounterSessionRepository, "encounterSessionRepository");
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
            publishedStateRepository.publishStorageErrorMutation(new PartyPublishedStateRepository.StatePublication());
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
            publishedStateRepository.publishRepositoryBackedState(new PartyPublishedStateRepository.StatePublication());
            encounterSessionRepository.refreshEncounterSession();
        }
        publishedStateRepository.publishMutationStatus(status);
    }
}
