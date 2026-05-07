package src.data.travel.repository;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.MovePartyCharactersCommand;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyDungeonTravelLocationKind;
import src.domain.party.published.PartyDungeonTravelLocationSnapshot;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartyOverworldTravelLocationSnapshot;
import src.domain.party.published.PartyTravelHeading;
import src.domain.party.published.PartyTravelLocationSnapshot;
import src.domain.party.published.PartyTravelPositionSnapshot;
import src.domain.party.published.PartyTravelPositionsModel;
import src.domain.party.published.PartyTravelPositionsResult;
import src.domain.party.published.PartyTravelTile;
import src.domain.party.published.ReadStatus;
import src.domain.travel.application.ApplyTravelDungeonSessionUseCase;
import src.domain.travel.session.port.TravelPartyStateRepository;

public final class ApplicationTravelPartyStateRepository implements TravelPartyStateRepository {

    private final PartyApplicationService party;
    private final ActivePartyModel activePartyModel;
    private final PartyTravelPositionsModel partyTravelPositionsModel;
    private final PartyMutationModel partyMutationModel;

    public ApplicationTravelPartyStateRepository(
            PartyApplicationService party,
            ActivePartyModel activePartyModel,
            PartyTravelPositionsModel partyTravelPositionsModel,
            PartyMutationModel partyMutationModel
    ) {
        this.party = Objects.requireNonNull(party, "party");
        this.activePartyModel = Objects.requireNonNull(activePartyModel, "activePartyModel");
        this.partyTravelPositionsModel = Objects.requireNonNull(partyTravelPositionsModel, "partyTravelPositionsModel");
        this.partyMutationModel = Objects.requireNonNull(partyMutationModel, "partyMutationModel");
    }

    @Override
    public ApplyTravelDungeonSessionUseCase.ActiveTravelStateData loadActiveTravelState() {
        ActivePartyResult activeParty = activePartyModel.current();
        List<Long> activeCharacterIds = activeParty.status() == ReadStatus.SUCCESS
                ? activeParty.members().stream()
                        .map(PartyMemberSummary::id)
                        .filter(id -> id != null && id > 0L)
                        .toList()
                : List.of();
        PartyTravelPositionsResult travelPositions = partyTravelPositionsModel.current();
        List<Long> travelCharacterIds = travelPositions.status() == ReadStatus.SUCCESS
                ? attachedCharacterIds(travelPositions.positions(), activeCharacterIds)
                : activeCharacterIds;
        return new ApplyTravelDungeonSessionUseCase.ActiveTravelStateData(
                travelCharacterIds,
                toInternalPartyLocation(travelPositions.partyTokenLocation()));
    }

    @Override
    public void saveDungeonPosition(
            ApplyTravelDungeonSessionUseCase.PositionData position,
            List<Long> characterIds
    ) {
        if (position == null || characterIds == null || characterIds.isEmpty()) {
            return;
        }
        party.moveCharacters(new MovePartyCharactersCommand(
                characterIds,
                new PartyDungeonTravelLocationSnapshot(
                        position.mapId(),
                        position.locationKind() == ApplyTravelDungeonSessionUseCase.LocationKind.TRANSITION
                                ? PartyDungeonTravelLocationKind.TRANSITION
                                : PartyDungeonTravelLocationKind.TILE,
                        position.ownerId(),
                        new PartyTravelTile(position.tile().q(), position.tile().r(), position.tile().level()),
                        PartyTravelHeading.valueOf(position.heading().name())),
                true));
    }

    @Override
    public boolean saveOverworldPosition(
            ApplyTravelDungeonSessionUseCase.OverworldTargetData target,
            List<Long> characterIds
    ) {
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
            List<PartyTravelPositionSnapshot> positions,
            List<Long> fallbackIds
    ) {
        List<Long> attachedIds = (positions == null ? List.<PartyTravelPositionSnapshot>of() : positions).stream()
                .filter(PartyTravelPositionSnapshot::attachedToPartyToken)
                .map(PartyTravelPositionSnapshot::characterId)
                .toList();
        return attachedIds.isEmpty() ? fallbackIds : attachedIds;
    }

    private static ApplyTravelDungeonSessionUseCase.@Nullable PartyLocationData toInternalPartyLocation(
            @Nullable PartyTravelLocationSnapshot location
    ) {
        if (location instanceof PartyDungeonTravelLocationSnapshot dungeonLocation) {
            return new ApplyTravelDungeonSessionUseCase.PartyLocationData(
                    new ApplyTravelDungeonSessionUseCase.PositionData(
                            dungeonLocation.mapId(),
                            ApplyTravelDungeonSessionUseCase.LocationKind.valueOf(dungeonLocation.locationKind().name()),
                            dungeonLocation.ownerId(),
                            new ApplyTravelDungeonSessionUseCase.CellData(
                                    dungeonLocation.tile().q(),
                                    dungeonLocation.tile().r(),
                                    dungeonLocation.tile().level()),
                            ApplyTravelDungeonSessionUseCase.Direction.fromName(dungeonLocation.heading().name())),
                    0L,
                    false);
        }
        if (location instanceof PartyOverworldTravelLocationSnapshot overworldLocation) {
            return new ApplyTravelDungeonSessionUseCase.PartyLocationData(
                    null,
                    overworldLocation.tileId(),
                    true);
        }
        return null;
    }
}
