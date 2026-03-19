package features.world.quarantine.dungeonmap.mapstate;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;

public final class DungeonMapState {

    private DungeonLayout currentLayout;

    public DungeonLayout currentLayout() {
        return currentLayout;
    }

    public void setLayout(DungeonLayout layout) {
        this.currentLayout = layout;
    }

    public void clearLayout() {
        this.currentLayout = null;
    }
}
