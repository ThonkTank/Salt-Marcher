package src.domain.party.application;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.party.published.AdjustPartyXpCommand;
import src.domain.party.published.AwardPartyXpCommand;
import src.domain.party.published.CalculateAdventuringDayCommand;
import src.domain.party.published.CharacterDraft;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.DeleteCharacterCommand;
import src.domain.party.published.MembershipState;
import src.domain.party.published.MovePartyCharactersCommand;
import src.domain.party.published.PartyDungeonTravelLocationKind;
import src.domain.party.published.PartyDungeonTravelLocationSnapshot;
import src.domain.party.published.PartyOverworldTravelLocationSnapshot;
import src.domain.party.published.PartyTravelHeading;
import src.domain.party.published.PartyTravelLocationSnapshot;
import src.domain.party.published.PartyTravelTile;
import src.domain.party.published.PerformPartyRestCommand;
import src.domain.party.published.RestType;
import src.domain.party.published.SetPartyMembershipCommand;
import src.domain.party.published.UpdateCharacterCommand;
import src.domain.party.roster.value.PartyCharacterDraft;
import src.domain.party.roster.value.PartyMembership;
import src.domain.party.roster.value.PartyRestType;
import src.domain.party.roster.value.PartyTravelLocation;

public final class PartyBoundaryTranslator {

    public record CreateCharacterRequest(
            PartyCharacterDraft draft,
            PartyMembership membership
    ) {
        public static CreateCharacterRequest from(@Nullable CreateCharacterCommand command) {
            return new CreateCharacterRequest(
                    BoundaryValues.draft(command == null ? null : command.draft()),
                    BoundaryValues.membership(command == null ? null : command.membership()));
        }
    }

    public record UpdateCharacterRequest(
            long id,
            PartyCharacterDraft draft
    ) {
        public static UpdateCharacterRequest from(@Nullable UpdateCharacterCommand command) {
            return new UpdateCharacterRequest(
                    command == null ? 0L : command.id(),
                    BoundaryValues.draft(command == null ? null : command.draft()));
        }
    }

    public record DeleteCharacterRequest(long id) {

        public static DeleteCharacterRequest from(@Nullable DeleteCharacterCommand command) {
            return new DeleteCharacterRequest(command == null ? 0L : command.id());
        }
    }

    public record SetMembershipRequest(
            long id,
            PartyMembership membership
    ) {
        public static SetMembershipRequest from(@Nullable SetPartyMembershipCommand command) {
            return new SetMembershipRequest(
                    command == null ? 0L : command.id(),
                    BoundaryValues.membership(command == null ? null : command.membership()));
        }
    }

    public record AwardXpRequest(
            List<Long> ids,
            int xpPerCharacter
    ) {
        public static AwardXpRequest from(@Nullable AwardPartyXpCommand command) {
            AwardPartyXpCommand effective = command == null ? new AwardPartyXpCommand(List.of(), 0) : command;
            return new AwardXpRequest(effective.ids(), effective.xpPerCharacter());
        }

        public AwardXpRequest {
            ids = ids == null ? List.of() : List.copyOf(ids);
        }
    }

    public record AdjustXpRequest(
            List<Long> ids,
            int xpDelta
    ) {
        public static AdjustXpRequest from(@Nullable AdjustPartyXpCommand command) {
            AdjustPartyXpCommand effective = command == null ? new AdjustPartyXpCommand(List.of(), 0) : command;
            return new AdjustXpRequest(effective.ids(), effective.xpDelta());
        }

        public AdjustXpRequest {
            ids = ids == null ? List.of() : List.copyOf(ids);
        }
    }

    public record PartyRestRequest(PartyRestType restType) {

        public static PartyRestRequest from(@Nullable PerformPartyRestCommand command) {
            RestType restType = command == null ? null : command.restType();
            return new PartyRestRequest(restType == RestType.LONG_REST ? PartyRestType.LONG_REST : PartyRestType.SHORT_REST);
        }
    }

    public record MoveCharactersRequest(
            List<Long> characterIds,
            @Nullable PartyTravelLocation target,
            boolean attachToPartyToken
    ) {
        public static MoveCharactersRequest from(@Nullable MovePartyCharactersCommand command) {
            MovePartyCharactersCommand effective = command == null
                    ? new MovePartyCharactersCommand(List.of(), null, true)
                    : command;
            return new MoveCharactersRequest(
                    effective.characterIds(),
                    BoundaryValues.travelLocation(effective.target()),
                    effective.attachToPartyToken());
        }

        public MoveCharactersRequest {
            characterIds = characterIds == null ? List.of() : List.copyOf(characterIds);
        }
    }

    public record AdventuringDayCalculationRequest(
            List<Integer> levels,
            int totalGroupXp
    ) {
        public static AdventuringDayCalculationRequest from(@Nullable CalculateAdventuringDayCommand command) {
            CalculateAdventuringDayCommand effective = command == null
                    ? new CalculateAdventuringDayCommand(List.of(), 0)
                    : command;
            return new AdventuringDayCalculationRequest(effective.levels(), effective.totalGroupXp());
        }

        public AdventuringDayCalculationRequest {
            levels = levels == null ? List.of() : List.copyOf(levels);
        }
    }

    private static final class BoundaryValues {

        private static PartyMembership membership(@Nullable MembershipState membershipState) {
            if (membershipState == MembershipState.ACTIVE) {
                return PartyMembership.ACTIVE;
            }
            return PartyMembership.RESERVE;
        }

        private static PartyCharacterDraft draft(@Nullable CharacterDraft draft) {
            if (draft == null) {
                return new PartyCharacterDraft("", "", 0, 0, 0);
            }
            return new PartyCharacterDraft(
                    draft.name(),
                    draft.playerName(),
                    draft.level(),
                    draft.passivePerception(),
                    draft.armorClass());
        }

        private static @Nullable PartyTravelLocation travelLocation(@Nullable PartyTravelLocationSnapshot location) {
            if (location instanceof PartyDungeonTravelLocationSnapshot dungeon) {
                return new src.domain.party.roster.value.PartyDungeonTravelLocation(
                        dungeon.mapId(),
                        toInternalDungeonLocationKind(dungeon.locationKind()),
                        dungeon.ownerId(),
                        toInternalTile(dungeon.tile()),
                        toInternalHeading(dungeon.heading()));
            }
            if (location instanceof PartyOverworldTravelLocationSnapshot overworld) {
                return new src.domain.party.roster.value.PartyOverworldTravelLocation(
                        overworld.mapId(),
                        overworld.tileId());
            }
            return null;
        }

        private static src.domain.party.roster.value.PartyDungeonTravelLocationKind toInternalDungeonLocationKind(
                @Nullable PartyDungeonTravelLocationKind locationKind
        ) {
            return locationKind == PartyDungeonTravelLocationKind.TRANSITION
                    ? src.domain.party.roster.value.PartyDungeonTravelLocationKind.TRANSITION
                    : src.domain.party.roster.value.PartyDungeonTravelLocationKind.TILE;
        }

        private static src.domain.party.roster.value.PartyTravelTile toInternalTile(@Nullable PartyTravelTile tile) {
            PartyTravelTile safeTile = tile == null ? new PartyTravelTile(0, 0, 0) : tile;
            return new src.domain.party.roster.value.PartyTravelTile(
                    safeTile.q(),
                    safeTile.r(),
                    safeTile.level());
        }

        private static src.domain.party.roster.value.PartyTravelHeading toInternalHeading(
                @Nullable PartyTravelHeading heading
        ) {
            PartyTravelHeading effective = heading == null ? PartyTravelHeading.defaultHeading() : heading;
            return switch (effective) {
                case NORTH -> src.domain.party.roster.value.PartyTravelHeading.NORTH;
                case EAST -> src.domain.party.roster.value.PartyTravelHeading.EAST;
                case WEST -> src.domain.party.roster.value.PartyTravelHeading.WEST;
                case SOUTH -> src.domain.party.roster.value.PartyTravelHeading.SOUTH;
            };
        }
    }
}
