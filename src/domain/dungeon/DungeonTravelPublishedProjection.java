package src.domain.dungeon;

import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSnapshot;
import src.domain.dungeon.published.TravelDungeonSnapshot;

final class DungeonTravelPublishedProjection {

    private DungeonTravelPublishedProjection() {
    }

    static TravelDungeonSnapshot snapshot(TravelDungeonSessionSnapshot.SnapshotData snapshot) {
        return DungeonTravelRuntimeSurfaceProjectionServiceAssembly.snapshot(snapshot);
    }
}
