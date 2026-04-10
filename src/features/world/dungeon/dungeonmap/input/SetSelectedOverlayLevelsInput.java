package features.world.dungeon.dungeonmap.input;

import java.util.List;

@SuppressWarnings("unused")
public record SetSelectedOverlayLevelsInput(
        List<Integer> levels
) {
}
