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
import src.domain.party.published.AdjustPartyXpCommand;
import src.domain.party.published.AwardPartyXpCommand;
import src.domain.party.published.CalculateAdventuringDayCommand;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.DeleteCharacterCommand;
import src.domain.party.published.MovePartyCharactersCommand;
import src.domain.party.published.PerformPartyRestCommand;
import src.domain.party.published.SetPartyMembershipCommand;
import src.domain.party.published.UpdateCharacterCommand;

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

    PartyApplicationService(
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

    public void createCharacter(CreateCharacterCommand command) {
        src.domain.party.published.CharacterDraft draft = command == null ? null : command.draft();
        createCharacterUseCase.execute(
                draft == null ? null : draft.name(),
                draft == null ? null : draft.playerName(),
                draft == null ? 0 : draft.level(),
                draft == null ? 0 : draft.passivePerception(),
                draft == null ? 0 : draft.armorClass(),
                BoundaryValues.membershipName(command == null ? null : command.membership()));
    }

    public void updateCharacter(UpdateCharacterCommand command) {
        src.domain.party.published.CharacterDraft draft = command == null ? null : command.draft();
        updateCharacterUseCase.execute(
                command == null ? 0L : command.id(),
                draft == null ? null : draft.name(),
                draft == null ? null : draft.playerName(),
                draft == null ? 0 : draft.level(),
                draft == null ? 0 : draft.passivePerception(),
                draft == null ? 0 : draft.armorClass());
    }

    public void deleteCharacter(DeleteCharacterCommand command) {
        deleteCharacterUseCase.execute(command == null ? 0L : command.id());
    }

    public void setMembership(SetPartyMembershipCommand command) {
        setPartyMembershipUseCase.execute(
                command == null ? 0L : command.id(),
                BoundaryValues.membershipName(command == null ? null : command.membership()));
    }

    public void awardXp(AwardPartyXpCommand command) {
        awardPartyXpUseCase.execute(
                BoundaryValues.ids(command == null ? null : command.ids()),
                command == null ? 0 : command.xpPerCharacter());
    }

    public void adjustXp(AdjustPartyXpCommand command) {
        adjustPartyXpUseCase.execute(
                BoundaryValues.ids(command == null ? null : command.ids()),
                command == null ? 0 : command.xpDelta());
    }

    public void performRest(PerformPartyRestCommand command) {
        performPartyRestUseCase.execute(BoundaryValues.restTypeName(command == null ? null : command.restType()));
    }

    public void moveCharacters(MovePartyCharactersCommand command) {
        TravelLocationInput location = BoundaryValues.travelLocation(command == null ? null : command.target());
        movePartyCharactersUseCase.execute(
                BoundaryValues.ids(command == null ? null : command.characterIds()),
                location.travelSpace(),
                location.mapId(),
                location.tileId(),
                location.dungeonLocationKind(),
                location.ownerId(),
                location.q(),
                location.r(),
                location.level(),
                location.heading(),
                command == null || command.attachToPartyToken());
    }

    public void calculateAdventuringDay(CalculateAdventuringDayCommand command) {
        calculateAdventuringDayUseCase.publish(
                BoundaryValues.levels(command == null ? null : command.levels()),
                command == null ? 0 : command.totalGroupXp());
    }

    private static final class BoundaryValues {

        private static String membershipName(
                src.domain.party.published.MembershipState membershipState
        ) {
            src.domain.party.published.MembershipState effective = membershipState == null
                    ? src.domain.party.published.MembershipState.valueOf("RESERVE")
                    : membershipState;
            return effective.name();
        }

        private static List<Long> ids(List<Long> ids) {
            return ids == null ? List.of() : List.copyOf(ids);
        }

        private static List<Integer> levels(List<Integer> levels) {
            return levels == null ? List.of() : List.copyOf(levels);
        }

        private static String restTypeName(
                src.domain.party.published.RestType restType
        ) {
            src.domain.party.published.RestType effective = restType == null
                    ? src.domain.party.published.RestType.valueOf("SHORT_REST")
                    : restType;
            return effective.name();
        }

        private static TravelLocationInput travelLocation(
                src.domain.party.published.PartyTravelLocationSnapshot location
        ) {
            if (location instanceof src.domain.party.published.PartyDungeonTravelLocationSnapshot dungeon) {
                src.domain.party.published.PartyTravelTile tile = tile(dungeon.tile());
                return new TravelLocationInput(
                        "DUNGEON",
                        dungeon.mapId(),
                        0L,
                        dungeonLocationKindName(dungeon.locationKind()),
                        dungeon.ownerId(),
                        tile.q(),
                        tile.r(),
                        tile.level(),
                        headingName(dungeon.heading()));
            }
            if (location instanceof src.domain.party.published.PartyOverworldTravelLocationSnapshot overworld) {
                return new TravelLocationInput(
                        "OVERWORLD",
                        overworld.mapId(),
                        overworld.tileId(),
                        "",
                        0L,
                        0,
                        0,
                        0,
                        "");
            }
            return TravelLocationInput.empty();
        }

        private static String dungeonLocationKindName(
                src.domain.party.published.PartyDungeonTravelLocationKind locationKind
        ) {
            src.domain.party.published.PartyDungeonTravelLocationKind effective = locationKind == null
                    ? src.domain.party.published.PartyDungeonTravelLocationKind.valueOf("TILE")
                    : locationKind;
            return effective.name();
        }

        private static src.domain.party.published.PartyTravelTile tile(
                src.domain.party.published.PartyTravelTile tile
        ) {
            return tile == null
                    ? new src.domain.party.published.PartyTravelTile(0, 0, 0)
                    : tile;
        }

        private static String headingName(
                src.domain.party.published.PartyTravelHeading heading
        ) {
            src.domain.party.published.PartyTravelHeading effective = heading == null
                    ? src.domain.party.published.PartyTravelHeading.defaultHeading()
                    : heading;
            return effective.name();
        }
    }

    private record TravelLocationInput(
            String travelSpace,
            long mapId,
            long tileId,
            String dungeonLocationKind,
            long ownerId,
            int q,
            int r,
            int level,
            String heading
    ) {
        private static TravelLocationInput empty() {
            return new TravelLocationInput("", 0L, 0L, "", 0L, 0, 0, 0, "");
        }
    }
}
