package src.domain.party;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
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
        if (command == null) {
            createCharacterUseCase.execute(null, null, 0, 0, 0, "RESERVE");
            return;
        }
        createCharacterUseCase.execute(
                command.createDraftName(),
                command.createDraftPlayerName(),
                command.createDraftLevel(),
                command.createDraftPassivePerception(),
                command.createDraftArmorClass(),
                command.membershipName());
    }

    public void updateCharacter(src.domain.party.published.UpdateCharacterCommand command) {
        if (command == null) {
            updateCharacterUseCase.execute(0L, null, null, 0, 0, 0);
            return;
        }
        updateCharacterUseCase.execute(
                command.id(),
                command.updateDraftName(),
                command.updateDraftPlayerName(),
                command.updateDraftLevel(),
                command.updateDraftPassivePerception(),
                command.updateDraftArmorClass());
    }

    public void deleteCharacter(src.domain.party.published.DeleteCharacterCommand command) {
        deleteCharacterUseCase.execute(command == null ? 0L : command.id());
    }

    public void setMembership(src.domain.party.published.SetPartyMembershipCommand command) {
        if (command == null) {
            setPartyMembershipUseCase.execute(0L, "RESERVE");
            return;
        }
        setPartyMembershipUseCase.execute(
                command.id(),
                command.membershipName());
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
        performPartyRestUseCase.execute(command == null ? "SHORT_REST" : command.restTypeName());
    }

    public void moveCharacters(src.domain.party.published.MovePartyCharactersCommand command) {
        if (command == null) {
            movePartyCharactersUseCase.execute(List.of(), "", 0L, 0L, "", 0L, List.of(0, 0, 0), "", true);
            return;
        }
        movePartyCharactersUseCase.execute(
                ids(command.characterIds()),
                command.targetTravelSpace(),
                command.targetMapId(),
                command.targetOverworldTileId(),
                command.targetDungeonLocationKind(),
                command.targetDungeonOwnerId(),
                command.targetDungeonTile(),
                command.targetDungeonHeading(),
                command.attachToPartyToken());
    }

    public void calculateAdventuringDay(src.domain.party.published.CalculateAdventuringDayCommand command) {
        calculateAdventuringDayUseCase.publish(
                levels(command == null ? null : command.levels()),
                command == null ? 0 : command.totalGroupXp());
    }

    private static List<Long> ids(@Nullable List<Long> ids) {
        return ids == null ? List.of() : List.copyOf(ids);
    }

    private static List<Integer> levels(@Nullable List<Integer> levels) {
        return levels == null ? List.of() : List.copyOf(levels);
    }
}
