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
import src.domain.party.published.PartyTravelLocationSnapshot;
import src.domain.party.model.roster.model.PartyDungeonTravelLocationKind;
import src.domain.party.model.roster.model.PartyTravelHeading;
import src.domain.party.model.roster.model.PartyTravelLocation;
import src.domain.party.model.roster.model.PartyTravelTile;

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
                CommandInputs.copyOrEmpty(command == null ? null : command.ids()),
                command == null ? 0 : command.xpPerCharacter());
    }

    public void adjustXp(src.domain.party.published.AdjustPartyXpCommand command) {
        adjustPartyXpUseCase.execute(
                CommandInputs.copyOrEmpty(command == null ? null : command.ids()),
                command == null ? 0 : command.xpDelta());
    }

    public void performRest(src.domain.party.published.PerformPartyRestCommand command) {
        performPartyRestUseCase.execute(command == null ? "SHORT_REST" : command.restTypeName());
    }

    public void moveCharacters(src.domain.party.published.MovePartyCharactersCommand command) {
        if (command == null) {
            movePartyCharactersUseCase.execute(List.of(), null, true);
            return;
        }
        movePartyCharactersUseCase.execute(
                CommandInputs.copyOrEmpty(command.characterIds()),
                CommandInputs.travelLocation(command.target()),
                command.attachToPartyToken());
    }

    public void calculateAdventuringDay(src.domain.party.published.CalculateAdventuringDayCommand command) {
        calculateAdventuringDayUseCase.publish(
                CommandInputs.copyOrEmpty(command == null ? null : command.levels()),
                command == null ? 0 : command.totalGroupXp());
    }

    private static final class CommandInputs {

        private CommandInputs() {
        }

        private static <T> List<T> copyOrEmpty(@Nullable List<T> values) {
            return values == null ? List.of() : List.copyOf(values);
        }

        private static @Nullable PartyTravelLocation travelLocation(@Nullable PartyTravelLocationSnapshot target) {
            if (target instanceof src.domain.party.published.PartyDungeonTravelLocationSnapshot dungeon) {
                return PartyTravelLocation.dungeon(
                        dungeon.mapId(),
                        PartyDungeonTravelLocationKind.valueOf(dungeon.locationKind().name()),
                        dungeon.ownerId(),
                        new PartyTravelTile(dungeon.tile().q(), dungeon.tile().r(), dungeon.tile().level()),
                        PartyTravelHeading.valueOf(dungeon.heading().name()));
            }
            if (target instanceof src.domain.party.published.PartyOverworldTravelLocationSnapshot overworld) {
                return PartyTravelLocation.overworld(overworld.mapId(), overworld.tileId());
            }
            return null;
        }
    }
}
