package src.view.dungeonshared.ViewModel;

public record DungeonMapSummaryViewModel(
        long mapId,
        String mapName,
        long revision
) {
    @Override
    public String toString() {
        return mapName + "  (rev " + revision + ")";
    }
}
