package features.world.dungeon.dungeonmap.input;

import features.world.dungeon.dungeonmap.state.DungeonLevelOverlayMode;

@SuppressWarnings("unused")
public record SetLevelOverlayModeInput(
        DungeonLevelOverlayMode mode
) {
}
