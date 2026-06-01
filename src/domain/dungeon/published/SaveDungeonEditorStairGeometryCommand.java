package src.domain.dungeon.published;

public record SaveDungeonEditorStairGeometryCommand(
        long stairId,
        String shapeName,
        String directionName,
        int dimension1,
        int dimension2
) {
    public SaveDungeonEditorStairGeometryCommand {
        stairId = Math.max(0L, stairId);
        shapeName = shapeName == null ? "" : shapeName.trim();
        directionName = directionName == null ? "" : directionName.trim();
        dimension1 = Math.max(0, dimension1);
        dimension2 = Math.max(0, dimension2);
    }
}
