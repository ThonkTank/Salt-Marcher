package features.world.dungeon.stair.input;

public record MoveStairInput(
        long mapId,
        long stairId,
        CreateStairInput.DraftInput draft,
        TranslationInput translation
) {
    public record TranslationInput(
            int dxCells,
            int dyCells,
            int dzLevels
    ) {
    }
}
