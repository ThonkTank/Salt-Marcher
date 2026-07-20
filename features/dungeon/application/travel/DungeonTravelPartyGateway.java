package features.dungeon.application.travel;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.application.travel.projection.TravelHeading;
import features.dungeon.application.travel.session.TravelDungeonActiveState.ActiveTravelStateData;
import features.dungeon.application.travel.session.TravelDungeonActiveState.PartyLocationData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.LocationKind;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.OverworldTarget;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.PositionData;
import features.party.api.PartyApi;
import features.party.api.ActivePartyModel;
import features.party.api.ActivePartyResult;
import features.party.api.MovePartyCharactersCommand;
import features.party.api.MutationResult;
import features.party.api.PartyDungeonTravelLocationKind;
import features.party.api.PartyDungeonTravelLocationSnapshot;
import features.party.api.PartyOverworldTravelLocationSnapshot;
import features.party.api.PartyTravelHeading;
import features.party.api.PartyTravelLocationSnapshot;
import features.party.api.PartyTravelPositionsModel;
import features.party.api.PartyTravelPositionsResult;
import features.party.api.PartyTravelTile;
import features.party.api.ReadStatus;

public final class DungeonTravelPartyGateway {

    private final ActivePartyModel activePartyModel;
    private final PartyTravelPositionsModel partyTravelPositionsModel;
    private final PartyApi party;

    public DungeonTravelPartyGateway(
            ActivePartyModel activePartyModel,
            PartyTravelPositionsModel partyTravelPositionsModel,
            PartyApi party
    ) {
        this.activePartyModel = Objects.requireNonNull(activePartyModel, "activePartyModel");
        this.partyTravelPositionsModel = Objects.requireNonNull(
                partyTravelPositionsModel,
                "partyTravelPositionsModel");
        this.party = Objects.requireNonNull(party, "party");
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
                toInternalPartyLocation(travelPositions.partyTokenLocation()),
                travelPositions.revision());
    }

    CompletionStage<MutationResult> moveDungeonPosition(PositionData position, List<Long> characterIds) {
        if (position == null || characterIds == null || characterIds.isEmpty()) {
            return CompletableFuture.completedFuture(
                    new MutationResult(features.party.api.MutationStatus.INVALID_INPUT));
        }
        if (position.locationKind() == LocationKind.STAIR_EXIT) {
            return CompletableFuture.completedFuture(
                    new MutationResult(features.party.api.MutationStatus.INVALID_INPUT));
        }
        return moveCharacters(new MovePartyCharactersCommand(
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
    }

    CompletionStage<MutationResult> moveOverworldPosition(OverworldTarget target, List<Long> characterIds) {
        if (target == null || characterIds == null || characterIds.isEmpty()) {
            return CompletableFuture.completedFuture(
                    new MutationResult(features.party.api.MutationStatus.INVALID_INPUT));
        }
        return moveCharacters(new MovePartyCharactersCommand(
                characterIds,
                new PartyOverworldTravelLocationSnapshot(target.mapId(), target.tileId()),
                true));
    }

    private CompletionStage<MutationResult> moveCharacters(MovePartyCharactersCommand command) {
        try {
            return Objects.requireNonNull(party.moveCharacters(command), "party move completion");
        } catch (RuntimeException exception) {
            return CompletableFuture.failedFuture(exception);
        }
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
                            locationKind(dungeonLocation.locationKind()),
                            dungeonLocation.ownerId(),
                            new Cell(
                                    dungeonLocation.tile().q(),
                                    dungeonLocation.tile().r(),
                                    dungeonLocation.tile().level()),
                            travelHeading(dungeonLocation.heading())),
                    0L,
                    0L,
                    false);
        }
        if (location instanceof PartyOverworldTravelLocationSnapshot overworldLocation) {
            return new PartyLocationData(
                    null,
                    overworldLocation.mapId(),
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

    private static LocationKind locationKind(PartyDungeonTravelLocationKind kind) {
        return kind == PartyDungeonTravelLocationKind.TRANSITION
                ? LocationKind.TRANSITION
                : LocationKind.TILE;
    }

    private static TravelHeading travelHeading(PartyTravelHeading heading) {
        return switch (heading == null ? PartyTravelHeading.SOUTH : heading) {
            case NORTH -> TravelHeading.NORTH;
            case EAST -> TravelHeading.EAST;
            case SOUTH -> TravelHeading.SOUTH;
            case WEST -> TravelHeading.WEST;
        };
    }
}
