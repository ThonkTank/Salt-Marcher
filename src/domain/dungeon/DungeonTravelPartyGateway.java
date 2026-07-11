package src.domain.dungeon;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.runtime.travel.projection.TravelHeading;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState.ActiveTravelStateData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState.PartyLocationData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.LocationKind;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.OverworldTarget;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.PositionData;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.MovePartyCharactersCommand;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyDungeonTravelLocationKind;
import src.domain.party.published.PartyDungeonTravelLocationSnapshot;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartyOverworldTravelLocationSnapshot;
import src.domain.party.published.PartyTravelHeading;
import src.domain.party.published.PartyTravelLocationSnapshot;
import src.domain.party.published.PartyTravelPositionsModel;
import src.domain.party.published.PartyTravelPositionsResult;
import src.domain.party.published.PartyTravelTile;
import src.domain.party.published.ReadStatus;

final class DungeonTravelPartyGateway {

    private final ActivePartyModel activePartyModel;
    private final PartyTravelPositionsModel partyTravelPositionsModel;
    private final PartyApplicationService party;
    private final PartyMutationModel partyMutationModel;

    DungeonTravelPartyGateway(
            ActivePartyModel activePartyModel,
            PartyTravelPositionsModel partyTravelPositionsModel,
            PartyApplicationService party,
            PartyMutationModel partyMutationModel
    ) {
        this.activePartyModel = Objects.requireNonNull(activePartyModel, "activePartyModel");
        this.partyTravelPositionsModel = Objects.requireNonNull(
                partyTravelPositionsModel,
                "partyTravelPositionsModel");
        this.party = Objects.requireNonNull(party, "party");
        this.partyMutationModel = Objects.requireNonNull(partyMutationModel, "partyMutationModel");
    }

    ActiveTravelStateData loadActiveTravelState() {
        ActivePartyResult activeParty = activePartyModel.current();
        List<Long> activeCharacterIds = activeParty.status() == ReadStatus.SUCCESS
                ? activeParty.memberIds()
                : List.of();
        PartyTravelPositionsResult travelPositions = partyTravelPositionsModel.current();
        List<Long> travelCharacterIds = travelPositions.status() == ReadStatus.SUCCESS
                ? attachedCharacterIds(travelPositions.partyTokenCharacterIds(), activeCharacterIds)
                : activeCharacterIds;
        return new ActiveTravelStateData(
                travelCharacterIds,
                toInternalPartyLocation(travelPositions.partyTokenLocation()));
    }

    boolean saveDungeonPosition(PositionData position, List<Long> characterIds) {
        if (position == null || characterIds == null || characterIds.isEmpty()) {
            return false;
        }
        if (position.locationKind() == LocationKind.STAIR_EXIT) {
            return false;
        }
        party.moveCharacters(new MovePartyCharactersCommand(
                characterIds,
                new PartyDungeonTravelLocationSnapshot(
                        position.mapId(),
                        position.locationKind() == LocationKind.TRANSITION
                                ? PartyDungeonTravelLocationKind.TRANSITION
                                : PartyDungeonTravelLocationKind.TILE,
                        position.ownerId(),
                        new PartyTravelTile(position.tile().q(), position.tile().r(), position.tile().level()),
                        partyTravelHeading(position.heading())),
                true));
        return partyMutationModel.current().status() == MutationStatus.SUCCESS;
    }

    boolean saveOverworldPosition(OverworldTarget target, List<Long> characterIds) {
        if (target == null || characterIds == null || characterIds.isEmpty()) {
            return false;
        }
        party.moveCharacters(new MovePartyCharactersCommand(
                characterIds,
                new PartyOverworldTravelLocationSnapshot(target.mapId(), target.tileId()),
                true));
        return partyMutationModel.current().status() == MutationStatus.SUCCESS;
    }

    private static List<Long> attachedCharacterIds(
            List<Long> attachedCharacterIds,
            List<Long> fallbackIds
    ) {
        List<Long> attachedIds = (attachedCharacterIds == null ? List.<Long>of() : attachedCharacterIds).stream()
                .filter(id -> id != null && id > 0L)
                .toList();
        return attachedIds.isEmpty() ? fallbackIds : attachedIds;
    }

    private static @Nullable PartyLocationData toInternalPartyLocation(
            @Nullable PartyTravelLocationSnapshot location
    ) {
        if (location instanceof PartyDungeonTravelLocationSnapshot dungeonLocation) {
            return new PartyLocationData(
                    new PositionData(
                            dungeonLocation.mapId(),
                            LocationKind.fromName(dungeonLocation.locationKind().name()),
                            dungeonLocation.ownerId(),
                            new Cell(
                                    dungeonLocation.tile().q(),
                                    dungeonLocation.tile().r(),
                                    dungeonLocation.tile().level()),
                            TravelHeading.fromName(dungeonLocation.heading().name())),
                    0L,
                    false);
        }
        if (location instanceof PartyOverworldTravelLocationSnapshot overworldLocation) {
            return new PartyLocationData(
                    null,
                    overworldLocation.tileId(),
                    true);
        }
        return null;
    }

    private static PartyTravelHeading partyTravelHeading(TravelHeading heading) {
        return switch (heading == null ? TravelHeading.defaultHeading() : heading) {
            case NORTH -> PartyTravelHeading.NORTH;
            case EAST -> PartyTravelHeading.EAST;
            case WEST -> PartyTravelHeading.WEST;
            case SOUTH -> PartyTravelHeading.SOUTH;
        };
    }
}
