package src.domain.party.application;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.party.model.roster.helper.PartyCharacterDraftValidationHelper;
import src.domain.party.model.roster.helper.PartyLevelProgressionHelper;
import src.domain.party.model.roster.model.PartyCharacter;
import src.domain.party.model.roster.model.PartyCharacterCombatProfile;
import src.domain.party.model.roster.model.PartyCharacterDraft;
import src.domain.party.model.roster.model.PartyCharacterIdentity;
import src.domain.party.model.roster.model.PartyCharacterProgress;
import src.domain.party.model.roster.model.PartyMembership;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class CreateCharacterUseCase {

    private static final String ACTIVE_MEMBERSHIP = "ACTIVE";

    private final PartyRosterRepository repository;
    private final PartyPublishedStateRepository publishedStateRepository;
    private final PartyCharacterDraftValidationHelper draftValidator = new PartyCharacterDraftValidationHelper();

    public CreateCharacterUseCase(
            PartyRosterRepository repository,
            PartyPublishedStateRepository publishedStateRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
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
                membership(membership));
    }

    private void runMutation(PartyCharacterDraft draft, PartyMembership membership) {
        try {
            PartyMutationStatus status = create(draft, membership);
            publish(status);
        } catch (IllegalStateException exception) {
            publishedStateRepository.publishStorageErrorMutation();
        }
    }

    private PartyMutationStatus create(PartyCharacterDraft draft, PartyMembership membership) {
        PartyRoster roster = repository.load();
        if (!draftValidator.isValid(draft)) {
            return PartyMutationStatus.INVALID_INPUT;
        }
        PartyCharacter character = new PartyCharacter(
                roster.nextCharacterId(),
                new PartyCharacterIdentity(draft.name(), draft.playerName()),
                new PartyCharacterProgress(
                        draft.level(),
                        PartyLevelProgressionHelper.minimumXpForLevel(draft.level()),
                        0,
                        0,
                        0),
                new PartyCharacterCombatProfile(draft.passivePerception(), draft.armorClass()),
                membership);
        repository.save(roster.withCreatedCharacter(character));
        return PartyMutationStatus.SUCCESS;
    }

    private void publish(PartyMutationStatus status) {
        if (status == PartyMutationStatus.SUCCESS) {
            publishedStateRepository.publishRepositoryBackedState();
        }
        publishedStateRepository.publishMutationStatus(status);
    }

    private static PartyMembership membership(String membership) {
        if (ACTIVE_MEMBERSHIP.equals(membership)) {
            return PartyMembership.ACTIVE;
        }
        return PartyMembership.RESERVE;
    }
}
