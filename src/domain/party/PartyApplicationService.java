package src.domain.party;

import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;
import org.jspecify.annotations.Nullable;
import src.domain.party.application.AdjustPartyXpUseCase;
import src.domain.party.application.AwardPartyXpUseCase;
import src.domain.party.application.CreateCharacterUseCase;
import src.domain.party.application.DeleteCharacterUseCase;
import src.domain.party.application.MovePartyCharactersUseCase;
import src.domain.party.application.PerformPartyRestUseCase;
import src.domain.party.application.SetPartyMembershipUseCase;
import src.domain.party.application.UpdateCharacterUseCase;
import src.domain.party.published.AdjustPartyXpCommand;
import src.domain.party.published.AwardPartyXpCommand;
import src.domain.party.published.CalculateAdventuringDayCommand;
import src.domain.party.published.CharacterDraft;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.DeleteCharacterCommand;
import src.domain.party.published.MembershipState;
import src.domain.party.published.MovePartyCharactersCommand;
import src.domain.party.published.PartyDungeonTravelLocationSnapshot;
import src.domain.party.published.PartyOverworldTravelLocationSnapshot;
import src.domain.party.published.PartyTravelLocationSnapshot;
import src.domain.party.published.PerformPartyRestCommand;
import src.domain.party.published.RestType;
import src.domain.party.published.SetPartyMembershipCommand;
import src.domain.party.published.UpdateCharacterCommand;
import src.domain.party.roster.port.PartyRosterRepository;
import src.domain.party.roster.port.PartyRuntimeRepository;
import src.domain.party.roster.value.PartyCharacterDraft;
import src.domain.party.roster.value.PartyDungeonTravelLocation;
import src.domain.party.roster.value.PartyDungeonTravelLocationKind;
import src.domain.party.roster.value.PartyMembership;
import src.domain.party.roster.value.PartyMutationStatus;
import src.domain.party.roster.value.PartyOverworldTravelLocation;
import src.domain.party.roster.value.PartyRestType;
import src.domain.party.roster.value.PartyTravelHeading;
import src.domain.party.roster.value.PartyTravelLocation;
import src.domain.party.roster.value.PartyTravelTile;

/**
 * Public backend facade for party management.
 */
public final class PartyApplicationService {

    private final @Nullable PartyRuntimeRepository runtimeFeedback;
    private final CreateCharacterUseCase createCharacterUseCase;
    private final UpdateCharacterUseCase updateCharacterUseCase;
    private final DeleteCharacterUseCase deleteCharacterUseCase;
    private final SetPartyMembershipUseCase setPartyMembershipUseCase;
    private final AdjustPartyXpUseCase adjustPartyXpUseCase;
    private final AwardPartyXpUseCase awardPartyXpUseCase;
    private final PerformPartyRestUseCase performPartyRestUseCase;
    private final MovePartyCharactersUseCase movePartyCharactersUseCase;

    public PartyApplicationService(PartyRosterRepository rosterRepository) {
        PartyRosterRepository repository = Objects.requireNonNull(rosterRepository, "rosterRepository");
        this.runtimeFeedback = repository instanceof PartyRuntimeRepository feedback
                ? feedback
                : null;
        this.createCharacterUseCase = new CreateCharacterUseCase(repository);
        this.updateCharacterUseCase = new UpdateCharacterUseCase(repository);
        this.deleteCharacterUseCase = new DeleteCharacterUseCase(repository);
        this.setPartyMembershipUseCase = new SetPartyMembershipUseCase(repository);
        this.adjustPartyXpUseCase = new AdjustPartyXpUseCase(repository);
        this.awardPartyXpUseCase = new AwardPartyXpUseCase(repository);
        this.performPartyRestUseCase = new PerformPartyRestUseCase(repository);
        this.movePartyCharactersUseCase = new MovePartyCharactersUseCase(repository);
    }

    public void createCharacter(CreateCharacterCommand command) {
        CharacterDraft draft = command == null ? null : command.draft();
        MembershipState membership = command == null ? null : command.membership();
        runMutation(() -> createCharacterUseCase.execute(
                toDomainDraft(draft),
                toPartyMembership(membership)));
    }

    public void updateCharacter(UpdateCharacterCommand command) {
        runMutation(() -> updateCharacterUseCase.execute(
                command == null ? 0L : command.id(),
                toDomainDraft(command == null ? null : command.draft())));
    }

    public void deleteCharacter(DeleteCharacterCommand command) {
        long id = command == null ? 0L : command.id();
        runMutation(() -> deleteCharacterUseCase.execute(id));
    }

    public void setMembership(SetPartyMembershipCommand command) {
        long id = command == null ? 0L : command.id();
        MembershipState membership = command == null ? null : command.membership();
        runMutation(() -> setPartyMembershipUseCase.execute(
                id,
                toPartyMembership(membership)));
    }

    public void awardXp(AwardPartyXpCommand command) {
        AwardPartyXpCommand effectiveCommand = command == null ? new AwardPartyXpCommand(List.of(), 0) : command;
        runMutation(() -> awardPartyXpUseCase.execute(
                effectiveCommand.ids(),
                effectiveCommand.xpPerCharacter()));
    }

    public void adjustXp(AdjustPartyXpCommand command) {
        AdjustPartyXpCommand effectiveCommand = command == null ? new AdjustPartyXpCommand(List.of(), 0) : command;
        runMutation(() -> adjustPartyXpUseCase.execute(
                effectiveCommand.ids(),
                effectiveCommand.xpDelta()));
    }

    public void performRest(PerformPartyRestCommand command) {
        RestType restType = command == null ? null : command.restType();
        runMutation(() -> performPartyRestUseCase.execute(toPartyRestType(restType)));
    }

    public void moveCharacters(MovePartyCharactersCommand command) {
        MovePartyCharactersCommand effectiveCommand = command == null
                ? new MovePartyCharactersCommand(List.of(), null, true)
                : command;
        runMutation(() -> movePartyCharactersUseCase.execute(
                effectiveCommand.characterIds(),
                toDomainTravelLocation(effectiveCommand.target()),
                effectiveCommand.attachToPartyToken()));
    }

    public void calculateAdventuringDay(CalculateAdventuringDayCommand command) {
        CalculateAdventuringDayCommand effectiveCommand = command == null
                ? new CalculateAdventuringDayCommand(List.of(), 0)
                : command;
        if (runtimeFeedback != null) {
            runtimeFeedback.publishAdventuringDayCalculation(
                    effectiveCommand.levels(),
                    effectiveCommand.totalGroupXp());
        }
    }

    private void runMutation(Supplier<PartyMutationStatus> operation) {
        try {
            PartyMutationStatus status = operation.get();
            if (runtimeFeedback != null) {
                runtimeFeedback.recordMutationStatus(status);
            }
        } catch (IllegalStateException exception) {
            if (runtimeFeedback != null) {
                runtimeFeedback.recordStorageErrorMutation();
            }
        }
    }

    private static PartyMembership toPartyMembership(@Nullable MembershipState membershipState) {
        return membershipState == null ? PartyMembership.RESERVE : membershipState.toInternal();
    }

    private static PartyRestType toPartyRestType(@Nullable RestType restType) {
        return restType == null ? PartyRestType.SHORT_REST : restType.toInternal();
    }

    private static PartyCharacterDraft toDomainDraft(@Nullable CharacterDraft draft) {
        return draft == null ? new PartyCharacterDraft("", "", 0, 0, 0) : draft.toInternal();
    }

    private static @Nullable PartyTravelLocation toDomainTravelLocation(
            @Nullable PartyTravelLocationSnapshot location
    ) {
        if (location instanceof PartyDungeonTravelLocationSnapshot dungeon) {
            return dungeon.toInternal();
        }
        if (location instanceof PartyOverworldTravelLocationSnapshot overworld) {
            return overworld.toInternal();
        }
        return null;
    }

}
