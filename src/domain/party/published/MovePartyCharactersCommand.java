package src.domain.party.published;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record MovePartyCharactersCommand(
        List<Long> characterIds,
        @Nullable PartyTravelLocationSnapshot target,
        boolean attachToPartyToken
) {

    public MovePartyCharactersCommand {
        characterIds = characterIds == null ? List.of() : List.copyOf(characterIds);
    }

    public String targetTravelSpace() {
        if (target instanceof PartyDungeonTravelLocationSnapshot) {
            return "DUNGEON";
        }
        if (target instanceof PartyOverworldTravelLocationSnapshot) {
            return "OVERWORLD";
        }
        return "";
    }

    public long targetMapId() {
        if (target instanceof PartyDungeonTravelLocationSnapshot dungeon) {
            return dungeon.mapId();
        }
        if (target instanceof PartyOverworldTravelLocationSnapshot overworld) {
            return overworld.mapId();
        }
        return 0L;
    }

    public long targetOverworldTileId() {
        if (target instanceof PartyOverworldTravelLocationSnapshot overworld) {
            return overworld.tileId();
        }
        return 0L;
    }

    public String targetDungeonLocationKind() {
        if (target instanceof PartyDungeonTravelLocationSnapshot dungeon) {
            return dungeon.locationKind().name();
        }
        return "";
    }

    public long targetDungeonOwnerId() {
        if (target instanceof PartyDungeonTravelLocationSnapshot dungeon) {
            return dungeon.ownerId();
        }
        return 0L;
    }

    public List<Integer> targetDungeonTile() {
        if (target instanceof PartyDungeonTravelLocationSnapshot dungeon) {
            return List.of(dungeon.tile().q(), dungeon.tile().r(), dungeon.tile().level());
        }
        return List.of(0, 0, 0);
    }

    public String targetDungeonHeading() {
        if (target instanceof PartyDungeonTravelLocationSnapshot dungeon) {
            return dungeon.heading().name();
        }
        return "";
    }
}
