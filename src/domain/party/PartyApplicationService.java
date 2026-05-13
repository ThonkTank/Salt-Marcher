package src.domain.party;

import java.util.List;
import java.util.Objects;
import src.domain.party.application.AdjustPartyXpUseCase;
import src.domain.party.application.AwardPartyXpUseCase;
import src.domain.party.application.CalculateAdventuringDayUseCase;
import src.domain.party.application.CreateCharacterUseCase;
import src.domain.party.application.DeleteCharacterUseCase;
import src.domain.party.application.MovePartyCharactersUseCase;
import src.domain.party.application.PerformPartyRestUseCase;
import src.domain.party.application.SetPartyMembershipUseCase;
import src.domain.party.application.UpdateCharacterUseCase;

/**
 * Public backend facade for party management.
 */
@SuppressWarnings("PMD.CouplingBetweenObjects")
public final class PartyApplicationService {

    private final CreateCharacterUseCase createCharacterUseCase;
    private final UpdateCharacterUseCase updateCharacterUseCase;
    private final DeleteCharacterUseCase deleteCharacterUseCase;
    private final SetPartyMembershipUseCase setPartyMembershipUseCase;
    private final AdjustPartyXpUseCase adjustPartyXpUseCase;
    private final AwardPartyXpUseCase awardPartyXpUseCase;
    private final PerformPartyRestUseCase performPartyRestUseCase;
    private final MovePartyCharactersUseCase movePartyCharactersUseCase;
    private final CalculateAdventuringDayUseCase calculateAdventuringDayUseCase;

    public PartyApplicationService(
            CreateCharacterUseCase createCharacterUseCase,
            UpdateCharacterUseCase updateCharacterUseCase,
            DeleteCharacterUseCase deleteCharacterUseCase,
            SetPartyMembershipUseCase setPartyMembershipUseCase,
            AdjustPartyXpUseCase adjustPartyXpUseCase,
            AwardPartyXpUseCase awardPartyXpUseCase,
            PerformPartyRestUseCase performPartyRestUseCase,
            MovePartyCharactersUseCase movePartyCharactersUseCase,
            CalculateAdventuringDayUseCase calculateAdventuringDayUseCase
    ) {
        this.createCharacterUseCase = Objects.requireNonNull(createCharacterUseCase, "createCharacterUseCase");
        this.updateCharacterUseCase = Objects.requireNonNull(updateCharacterUseCase, "updateCharacterUseCase");
        this.deleteCharacterUseCase = Objects.requireNonNull(deleteCharacterUseCase, "deleteCharacterUseCase");
        this.setPartyMembershipUseCase = Objects.requireNonNull(setPartyMembershipUseCase, "setPartyMembershipUseCase");
        this.adjustPartyXpUseCase = Objects.requireNonNull(adjustPartyXpUseCase, "adjustPartyXpUseCase");
        this.awardPartyXpUseCase = Objects.requireNonNull(awardPartyXpUseCase, "awardPartyXpUseCase");
        this.performPartyRestUseCase = Objects.requireNonNull(performPartyRestUseCase, "performPartyRestUseCase");
        this.movePartyCharactersUseCase = Objects.requireNonNull(movePartyCharactersUseCase, "movePartyCharactersUseCase");
        this.calculateAdventuringDayUseCase =
                Objects.requireNonNull(calculateAdventuringDayUseCase, "calculateAdventuringDayUseCase");
    }

    public void createCharacter(src.domain.party.published.CreateCharacterCommand command) {
        createCharacterUseCase.execute(
                command == null || command.draft() == null ? null : command.draft().name(),
                command == null || command.draft() == null ? null : command.draft().playerName(),
                command == null || command.draft() == null ? 0 : command.draft().level(),
                command == null || command.draft() == null ? 0 : command.draft().passivePerception(),
                command == null || command.draft() == null ? 0 : command.draft().armorClass(),
                command == null || command.membership() == null ? "RESERVE" : command.membership().name());
    }

    public void updateCharacter(src.domain.party.published.UpdateCharacterCommand command) {
        updateCharacterUseCase.execute(
                command == null ? 0L : command.id(),
                command == null || command.draft() == null ? null : command.draft().name(),
                command == null || command.draft() == null ? null : command.draft().playerName(),
                command == null || command.draft() == null ? 0 : command.draft().level(),
                command == null || command.draft() == null ? 0 : command.draft().passivePerception(),
                command == null || command.draft() == null ? 0 : command.draft().armorClass());
    }

    public void deleteCharacter(src.domain.party.published.DeleteCharacterCommand command) {
        deleteCharacterUseCase.execute(command == null ? 0L : command.id());
    }

    public void setMembership(src.domain.party.published.SetPartyMembershipCommand command) {
        setPartyMembershipUseCase.execute(
                command == null ? 0L : command.id(),
                command == null || command.membership() == null ? "RESERVE" : command.membership().name());
    }

    public void awardXp(src.domain.party.published.AwardPartyXpCommand command) {
        awardPartyXpUseCase.execute(
                ids(command == null ? null : command.ids()),
                command == null ? 0 : command.xpPerCharacter());
    }

    public void adjustXp(src.domain.party.published.AdjustPartyXpCommand command) {
        adjustPartyXpUseCase.execute(
                ids(command == null ? null : command.ids()),
                command == null ? 0 : command.xpDelta());
    }

    public void performRest(src.domain.party.published.PerformPartyRestCommand command) {
        performPartyRestUseCase.execute(command == null || command.restType() == null ? "SHORT_REST" : command.restType().name());
    }

    public void moveCharacters(src.domain.party.published.MovePartyCharactersCommand command) {
        movePartyCharactersUseCase.execute(
                ids(command == null ? null : command.characterIds()),
                command == null ? "" : command.targetTravelSpace(),
                command == null ? 0L : command.targetMapId(),
                command == null ? 0L : command.targetOverworldTileId(),
                command == null ? "" : command.targetDungeonLocationKind(),
                command == null ? 0L : command.targetDungeonOwnerId(),
                command == null ? List.of(0, 0, 0) : command.targetDungeonTile(),
                command == null ? "" : command.targetDungeonHeading(),
                command == null || command.attachToPartyToken());
    }

    public void calculateAdventuringDay(src.domain.party.published.CalculateAdventuringDayCommand command) {
        calculateAdventuringDayUseCase.publish(
                levels(command == null ? null : command.levels()),
                command == null ? 0 : command.totalGroupXp());
    }

    private static List<Long> ids(List<Long> ids) {
        return ids == null ? List.of() : List.copyOf(ids);
    }

    private static List<Integer> levels(List<Integer> levels) {
        return levels == null ? List.of() : List.copyOf(levels);
    }
}
