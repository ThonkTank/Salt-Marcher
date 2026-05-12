package src.domain.party.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.party.model.roster.model.PartyCharacter;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyRestType;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class PerformPartyRestUseCase {

    private final PartyRosterRepository repository;
    private final PartyPublishedStateRepository publishedStateRepository;

    public PerformPartyRestUseCase(
            PartyRosterRepository repository,
            PartyPublishedStateRepository publishedStateRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(String restType) {
        try {
            PartyMutationStatus status = perform(restType(restType));
            publish(status);
        } catch (IllegalStateException exception) {
            publishedStateRepository.publishStorageErrorMutation();
        }
    }

    private PartyMutationStatus perform(PartyRestType restType) {
        PartyRoster roster = repository.load();
        List<PartyCharacter> nextCharacters = new ArrayList<>(roster.characters().size());
        for (PartyCharacter character : roster.characters()) {
            nextCharacters.add(character.membership().isActive() ? restedCharacter(character, restType) : character);
        }
        repository.save(roster.withCharacters(nextCharacters));
        return PartyMutationStatus.SUCCESS;
    }

    private static PartyCharacter restedCharacter(PartyCharacter character, PartyRestType restType) {
        return new PartyCharacter(
                character.id(),
                character.identity(),
                character.progress().afterRest(restType),
                character.combat(),
                character.membership(),
                character.travel());
    }

    private void publish(PartyMutationStatus status) {
        if (status == PartyMutationStatus.SUCCESS) {
            publishedStateRepository.publishRepositoryBackedState();
        }
        publishedStateRepository.publishMutationStatus(status);
    }

    private static PartyRestType restType(String restType) {
        if ("LONG_REST".equals(restType)) {
            return PartyRestType.LONG_REST;
        }
        return PartyRestType.SHORT_REST;
    }
}
