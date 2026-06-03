package src.domain.party.model.roster.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.party.model.roster.PartyCharacterDraft;
import src.domain.party.model.roster.PartyMembership;
import src.domain.party.model.roster.PartyMutationStatus;
import src.domain.party.model.roster.PartyRoster;
import src.domain.party.model.roster.PartyRosterMutation;
import src.domain.party.model.roster.repository.PartyEncounterSessionRepository;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class CreateCharacterUseCase {

    private final PartyRosterRepository repository;
    private final PartyPublishedStateRepository publishedStateRepository;
    private final PartyEncounterSessionRepository encounterSessionRepository;

    public CreateCharacterUseCase(
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
            @Nullable String name,
            @Nullable String playerName,
            int level,
            int passivePerception,
            int armorClass,
            String membership
    ) {
        runMutation(
                new PartyCharacterDraft(name, playerName, level, passivePerception, armorClass),
                PartyMembership.valueOf(membership));
    }

    private void runMutation(PartyCharacterDraft draft, PartyMembership membership) {
        try {
            PartyMutationStatus status = create(draft, membership);
            publish(status);
        } catch (IllegalStateException exception) {
            publishedStateRepository.publishStorageErrorMutation(
                    new PartyPublishedStateRepository.StatePublication());
        }
    }

    private PartyMutationStatus create(PartyCharacterDraft draft, PartyMembership membership) {
        PartyRoster roster = repository.load();
        PartyRosterMutation mutation = persistCreatedRoster(roster.createCharacter(draft, membership));
        return mutation.status();
    }

    private PartyRosterMutation persistCreatedRoster(PartyRosterMutation mutation) {
        if (mutation.successful()) {
            repository.save(mutation.roster());
        }
        return mutation;
    }

    private void publish(PartyMutationStatus status) {
        if (PartyMutationStatus.SUCCESS.equals(status)) {
            publishedStateRepository.publishRepositoryBackedState(
                    new PartyPublishedStateRepository.StatePublication());
            encounterSessionRepository.refreshEncounterSession();
        }
        publishedStateRepository.publishMutationStatus(status);
    }
}
