package src.domain.party;

import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;
import src.domain.party.application.AdjustPartyXpUseCase;
import src.domain.party.application.AwardPartyXpUseCase;
import src.domain.party.application.CreateCharacterUseCase;
import src.domain.party.application.DeleteCharacterUseCase;
import src.domain.party.application.MovePartyCharactersUseCase;
import src.domain.party.application.PartyBoundaryProjector;
import src.domain.party.application.PartyBoundaryRuntimeAdapter;
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
import src.domain.party.published.MutationResult;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PerformPartyRestCommand;
import src.domain.party.published.RestType;
import src.domain.party.published.SetPartyMembershipCommand;
import src.domain.party.published.UpdateCharacterCommand;
import src.domain.party.roster.port.PartyRosterRepository;
import src.domain.party.roster.value.PartyMutationStatus;

/**
 * Public backend facade for party management.
 */
public final class PartyApplicationService {

    private final PartyBoundaryRuntimeAdapter runtime;
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
        this.runtime = repository instanceof PartyBoundaryRuntimeAdapter adapter
                ? adapter
                : new PartyBoundaryRuntimeAdapter(repository);
        this.createCharacterUseCase = new CreateCharacterUseCase(runtime);
        this.updateCharacterUseCase = new UpdateCharacterUseCase(runtime);
        this.deleteCharacterUseCase = new DeleteCharacterUseCase(runtime);
        this.setPartyMembershipUseCase = new SetPartyMembershipUseCase(runtime);
        this.adjustPartyXpUseCase = new AdjustPartyXpUseCase(runtime);
        this.awardPartyXpUseCase = new AwardPartyXpUseCase(runtime);
        this.performPartyRestUseCase = new PerformPartyRestUseCase(runtime);
        this.movePartyCharactersUseCase = new MovePartyCharactersUseCase(runtime);
    }

    public void createCharacter(CreateCharacterCommand command) {
        CharacterDraft draft = command == null ? null : command.draft();
        MembershipState membership = command == null ? null : command.membership();
        runMutation(() -> createCharacterUseCase.execute(
                PartyBoundaryProjector.toDomainDraft(draft),
                PartyBoundaryProjector.toPartyMembership(membership)));
    }

    public void updateCharacter(UpdateCharacterCommand command) {
        runMutation(() -> updateCharacterUseCase.execute(
                command == null ? 0L : command.id(),
                PartyBoundaryProjector.toDomainDraft(command == null ? null : command.draft())));
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
                PartyBoundaryProjector.toPartyMembership(membership)));
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
        runMutation(() -> performPartyRestUseCase.execute(PartyBoundaryProjector.toPartyRestType(restType)));
    }

    public void moveCharacters(MovePartyCharactersCommand command) {
        MovePartyCharactersCommand effectiveCommand = command == null
                ? new MovePartyCharactersCommand(List.of(), null, true)
                : command;
        runMutation(() -> movePartyCharactersUseCase.execute(
                effectiveCommand.characterIds(),
                PartyBoundaryProjector.toDomainTravelLocation(effectiveCommand.target()),
                effectiveCommand.attachToPartyToken()));
    }

    public void calculateAdventuringDay(CalculateAdventuringDayCommand command) {
        runtime.publishAdventuringDayCalculation(command);
    }

    private void runMutation(Supplier<PartyMutationStatus> operation) {
        runtime.recordMutationResult(mutationResult(operation));
    }

    private static MutationResult mutationResult(Supplier<PartyMutationStatus> operation) {
        try {
            return new MutationResult(PartyBoundaryProjector.mapMutationStatus(operation.get()));
        } catch (IllegalStateException exception) {
            return new MutationResult(MutationStatus.STORAGE_ERROR);
        }
    }
}
