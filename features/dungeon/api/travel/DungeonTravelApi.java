package features.dungeon.api.travel;

import features.dungeon.api.DungeonOverlaySettings;
import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonTravelActionId;

/** Typed travel capability consumed by presentation and foreign features. */
public interface DungeonTravelApi {
    void refresh();

    void performAction(DungeonTravelActionId actionId);

    void moveTo(DungeonCellRef target);

    void selectMap(long mapId);

    void shiftProjectionLevel(int projectionLevelShift);

    void setOverlay(DungeonOverlaySettings overlaySettings);
}
