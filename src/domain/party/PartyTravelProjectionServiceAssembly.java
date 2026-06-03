package src.domain.party;

import org.jspecify.annotations.Nullable;
import src.domain.party.model.roster.PartyTravelLocation;
import src.domain.party.model.roster.usecase.LoadPartyTravelPositionsUseCase;
import src.domain.party.published.PartyDungeonTravelLocationSnapshot;
import src.domain.party.published.PartyOverworldTravelLocationSnapshot;
import src.domain.party.published.PartyTravelLocationSnapshot;
import src.domain.party.published.PartyTravelPositionSnapshot;
import src.domain.party.published.PartyTravelPositionsResult;
import src.domain.party.published.PartyTravelTile;
import src.domain.party.published.ReadStatus;

final class PartyTravelProjectionServiceAssembly {

    private PartyTravelProjectionServiceAssembly() {
    }

    static PartyTravelPositionsResult failedPartyTravelPositionsResult() {
        return new PartyTravelPositionsResult(ReadStatus.STORAGE_ERROR, java.util.List.of(), null);
    }

    static PartyTravelPositionsResult mapTravelPositionsResult(LoadPartyTravelPositionsUseCase.Result result) {
        return new PartyTravelPositionsResult(
                ReadStatus.SUCCESS,
                result.positions().stream()
                        .map(PartyTravelProjectionServiceAssembly::mapTravelPosition)
                        .toList(),
                mapTravelLocation(result.partyTokenLocation()));
    }

    private static PartyTravelPositionSnapshot mapTravelPosition(
            LoadPartyTravelPositionsUseCase.TravelPosition position
    ) {
        return new PartyTravelPositionSnapshot(
                position.characterId(),
                position.attachedToPartyToken(),
                mapTravelLocation(position.location()));
    }

    private static @Nullable PartyTravelLocationSnapshot mapTravelLocation(@Nullable PartyTravelLocation location) {
        if (location != null && location.isDungeon()) {
            return new PartyDungeonTravelLocationSnapshot(
                    location.mapId(),
                    toPublishedDungeonLocationKind(location.dungeonLocationKind()),
                    location.dungeonOwnerId(),
                    new PartyTravelTile(
                            location.dungeonTile().q(),
                            location.dungeonTile().r(),
                            location.dungeonTile().level()),
                    toPublishedHeading(location.dungeonHeading()));
        }
        if (location != null && location.isOverworld()) {
            return new PartyOverworldTravelLocationSnapshot(location.mapId(), location.overworldTileId());
        }
        return null;
    }

    private static src.domain.party.published.PartyDungeonTravelLocationKind toPublishedDungeonLocationKind(
            src.domain.party.model.roster.PartyDungeonTravelLocationKind locationKind
    ) {
        return src.domain.party.published.PartyDungeonTravelLocationKind.valueOf(locationKind.name());
    }

    private static src.domain.party.published.PartyTravelHeading toPublishedHeading(
            src.domain.party.model.roster.PartyTravelHeading heading
    ) {
        return src.domain.party.published.PartyTravelHeading.valueOf(heading.name());
    }
}
