package src.domain.party;

import src.domain.party.model.roster.usecase.AdjustPartyXpUseCase;
import src.domain.party.model.roster.usecase.AwardPartyXpUseCase;
import src.domain.party.model.roster.usecase.CalculateAdventuringDayUseCase;
import src.domain.party.model.roster.usecase.CreateCharacterUseCase;
import src.domain.party.model.roster.usecase.DeleteCharacterUseCase;
import src.domain.party.model.roster.usecase.MovePartyCharactersUseCase;
import src.domain.party.model.roster.usecase.PerformPartyRestUseCase;
import src.domain.party.model.roster.usecase.SetPartyMembershipUseCase;
import src.domain.party.model.roster.usecase.UpdateCharacterUseCase;

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
        this.createCharacterUseCase =
                java.util.Objects.requireNonNull(createCharacterUseCase, "createCharacterUseCase");
        this.updateCharacterUseCase =
                java.util.Objects.requireNonNull(updateCharacterUseCase, "updateCharacterUseCase");
        this.deleteCharacterUseCase =
                java.util.Objects.requireNonNull(deleteCharacterUseCase, "deleteCharacterUseCase");
        this.setPartyMembershipUseCase =
                java.util.Objects.requireNonNull(setPartyMembershipUseCase, "setPartyMembershipUseCase");
        this.adjustPartyXpUseCase =
                java.util.Objects.requireNonNull(adjustPartyXpUseCase, "adjustPartyXpUseCase");
        this.awardPartyXpUseCase =
                java.util.Objects.requireNonNull(awardPartyXpUseCase, "awardPartyXpUseCase");
        this.performPartyRestUseCase =
                java.util.Objects.requireNonNull(performPartyRestUseCase, "performPartyRestUseCase");
        this.movePartyCharactersUseCase =
                java.util.Objects.requireNonNull(movePartyCharactersUseCase, "movePartyCharactersUseCase");
        this.calculateAdventuringDayUseCase =
                java.util.Objects.requireNonNull(
                        calculateAdventuringDayUseCase,
                        "calculateAdventuringDayUseCase");
    }

    public void createCharacter(src.domain.party.published.CreateCharacterCommand command) {
        createCharacterUseCase.execute(
                command == null ? null : command.createDraftName(),
                command == null ? null : command.createDraftPlayerName(),
                command == null ? 0 : command.createDraftLevel(),
                command == null ? 0 : command.createDraftPassivePerception(),
                command == null ? 0 : command.createDraftArmorClass(),
                command == null ? "RESERVE" : command.membershipName());
    }

    public void updateCharacter(src.domain.party.published.UpdateCharacterCommand command) {
        updateCharacterUseCase.execute(
                command == null ? 0L : command.id(),
                command == null ? null : command.updateDraftName(),
                command == null ? null : command.updateDraftPlayerName(),
                command == null ? 0 : command.updateDraftLevel(),
                command == null ? 0 : command.updateDraftPassivePerception(),
                command == null ? 0 : command.updateDraftArmorClass());
    }

    public void deleteCharacter(src.domain.party.published.DeleteCharacterCommand command) {
        deleteCharacterUseCase.execute(command == null ? 0L : command.id());
    }

    public void setMembership(src.domain.party.published.SetPartyMembershipCommand command) {
        setPartyMembershipUseCase.execute(
                command == null ? 0L : command.id(),
                command == null ? "RESERVE" : command.membershipName());
    }

    public void awardXp(src.domain.party.published.AwardPartyXpCommand command) {
        awardPartyXpUseCase.execute(
                command == null ? java.util.Collections.emptyList() : command.ids(),
                command == null ? 0 : command.xpPerCharacter());
    }

    public void adjustXp(src.domain.party.published.AdjustPartyXpCommand command) {
        adjustPartyXpUseCase.execute(
                command == null ? java.util.Collections.emptyList() : command.ids(),
                command == null ? 0 : command.xpDelta());
    }

    public void performRest(src.domain.party.published.PerformPartyRestCommand command) {
        performPartyRestUseCase.execute(command == null ? "SHORT_REST" : command.restTypeName());
    }

    public void moveCharacters(src.domain.party.published.MovePartyCharactersCommand command) {
        MovePartyCharactersUseCase.TravelTarget travelTarget = null;
        if (command != null && command.target() != null && command.target().isDungeon()) {
            travelTarget = new MovePartyCharactersUseCase.TravelTarget(
                    true,
                    command.target().mapId(),
                    command.target().dungeonLocationKindName(),
                    command.target().dungeonOwnerId(),
                    command.target().dungeonTileQ(),
                    command.target().dungeonTileR(),
                    command.target().dungeonTileLevel(),
                    command.target().dungeonHeadingName(),
                    0L);
        } else if (command != null && command.target() != null && command.target().isOverworld()) {
            travelTarget = new MovePartyCharactersUseCase.TravelTarget(
                    false,
                    command.target().mapId(),
                    "TILE",
                    0L,
                    0,
                    0,
                    0,
                    "SOUTH",
                    command.target().overworldTileId());
        }
        movePartyCharactersUseCase.execute(new MovePartyCharactersUseCase.TravelCommand(
                command == null ? java.util.Collections.emptyList() : command.characterIds(),
                travelTarget,
                command == null || command.attachToPartyToken()));
    }

    public void calculateAdventuringDay(src.domain.party.published.CalculateAdventuringDayCommand command) {
        calculateAdventuringDayUseCase.publish(
                command == null ? java.util.Collections.emptyList() : command.levels(),
                command == null ? 0 : command.totalGroupXp());
    }
}
