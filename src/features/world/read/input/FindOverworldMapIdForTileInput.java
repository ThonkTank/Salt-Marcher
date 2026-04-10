package features.world.read.input;

@SuppressWarnings("unused")
public record FindOverworldMapIdForTileInput(long tileId) {

    public record FoundOverworldMapIdForTileInput(Long mapId) {
    }
}
