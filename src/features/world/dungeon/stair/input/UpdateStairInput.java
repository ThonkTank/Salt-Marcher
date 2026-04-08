package features.world.dungeon.stair.input;

public record UpdateStairInput(
        long mapId,
        long stairId,
        CreateStairInput.DraftInput draft
) {
}
