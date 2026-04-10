package features.world.hexmap.travelsurface.input;

import java.util.List;

@SuppressWarnings("unused")
public record ShowDungeonTravelInput(
        String mapName,
        String areaLabel,
        String cellLabel,
        String headingLabel,
        String statusLabel,
        List<DungeonTravelActionInput> actions,
        Runnable centerAction
) {
    public record DungeonTravelActionInput(String label, Runnable action) {
    }
}
