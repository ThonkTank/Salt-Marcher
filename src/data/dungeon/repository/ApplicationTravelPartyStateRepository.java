package src.data.dungeon.repository;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.repository.TravelPartyStateRepository;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState.ActiveTravelStateData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState.PartyLocationData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.LocationKind;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.PartyDungeonTravelLocationSnapshot;
import src.domain.party.published.PartyOverworldTravelLocationSnapshot;
import src.domain.party.published.PartyTravelLocationSnapshot;
import src.domain.party.published.PartyTravelPositionsModel;
import src.domain.party.published.PartyTravelPositionsResult;
import src.domain.party.published.ReadStatus;

public final class ApplicationTravelPartyStateRepository implements TravelPartyStateRepository {

    private final ActivePartyModel activePartyModel;
    private final PartyTravelPositionsModel partyTravelPositionsModel;

    public ApplicationTravelPartyStateRepository(
            ActivePartyModel activePartyModel,
            PartyTravelPositionsModel partyTravelPositionsModel
    ) {
        this.activePartyModel = Objects.requireNonNull(activePartyModel, "activePartyModel");
        this.partyTravelPositionsModel = Objects.requireNonNull(partyTravelPositionsModel, "partyTravelPositionsModel");
    }

    @Override
    public ActiveTravelStateData loadActiveTravelState() {
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

    private static List<Long> attachedCharacterIds(
            List<Long> attachedCharacterIds,
            List<Long> fallbackIds
    ) {
        List<Long> attachedIds = (attachedCharacterIds == null ? List.<Long>of() : attachedCharacterIds).stream()
                .filter(id -> id != null && id > 0L)
                .toList();
        return attachedIds.isEmpty() ? fallbackIds : attachedIds;
    }

    private static @Nullable PartyLocationData toInternalPartyLocation(@Nullable PartyTravelLocationSnapshot location) {
        if (location instanceof PartyDungeonTravelLocationSnapshot dungeonLocation) {
            return new PartyLocationData(
                    new PositionData(
                            dungeonLocation.mapId(),
                            LocationKind.valueOf(dungeonLocation.locationKind().name()),
                            dungeonLocation.ownerId(),
                            new Cell(
                                    dungeonLocation.tile().q(),
                                    dungeonLocation.tile().r(),
                                    dungeonLocation.tile().level()),
                            dungeonLocation.heading().name()),
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
}
