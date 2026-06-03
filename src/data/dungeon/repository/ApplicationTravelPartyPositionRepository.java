package src.data.dungeon.repository;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.runtime.repository.TravelPartyPositionRepository;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.LocationKind;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.OverworldTarget;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.MovePartyCharactersCommand;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyDungeonTravelLocationKind;
import src.domain.party.published.PartyDungeonTravelLocationSnapshot;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartyOverworldTravelLocationSnapshot;
import src.domain.party.published.PartyTravelHeading;
import src.domain.party.published.PartyTravelTile;

public final class ApplicationTravelPartyPositionRepository implements TravelPartyPositionRepository {

    private final PartyApplicationService party;
    private final PartyMutationModel partyMutationModel;

    public ApplicationTravelPartyPositionRepository(
            PartyApplicationService party,
            PartyMutationModel partyMutationModel
    ) {
        this.party = Objects.requireNonNull(party, "party");
        this.partyMutationModel = Objects.requireNonNull(partyMutationModel, "partyMutationModel");
    }

    @Override
    public boolean saveDungeonPosition(PositionData position, List<Long> characterIds) {
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
                        partyTravelHeading(position.headingToken())),
                true));
        return partyMutationModel.current().status() == MutationStatus.SUCCESS;
    }

    @Override
    public boolean saveOverworldPosition(OverworldTarget target, List<Long> characterIds) {
        if (target == null || characterIds == null || characterIds.isEmpty()) {
            return false;
        }
        party.moveCharacters(new MovePartyCharactersCommand(
                characterIds,
                new PartyOverworldTravelLocationSnapshot(target.mapId(), target.tileId()),
                true));
        return partyMutationModel.current().status() == MutationStatus.SUCCESS;
    }

    private static PartyTravelHeading partyTravelHeading(String headingToken) {
        return switch (headingToken == null ? "" : headingToken.trim()) {
            case "NORTH" -> PartyTravelHeading.NORTH;
            case "EAST" -> PartyTravelHeading.EAST;
            case "WEST" -> PartyTravelHeading.WEST;
            default -> PartyTravelHeading.SOUTH;
        };
    }
}
