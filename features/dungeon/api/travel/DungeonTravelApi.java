package features.dungeon.api.travel;

import features.dungeon.api.DungeonOverlaySettings;

/** Typed travel capability consumed by presentation and foreign features. */
public interface DungeonTravelApi {
    void refresh();

    void performAction(int selectedActionRowIndex);

    void selectMap(long mapId);

    void shiftProjectionLevel(int projectionLevelShift);

    void setOverlay(DungeonOverlaySettings overlaySettings);
}
