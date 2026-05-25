package src.domain.dungeon;

final class DungeonTravelRuntimePublishedStateServiceAssembly
        implements src.domain.dungeon.model.worldspace.repository.TravelDungeonSessionPublishedStateRepository {

    private final DungeonPublishedChannelServiceAssembly<src.domain.dungeon.published.TravelDungeonSnapshot> snapshots =
            new DungeonPublishedChannelServiceAssembly<>(src.domain.dungeon.published.TravelDungeonSnapshot.empty());
    private final src.domain.dungeon.published.TravelDungeonModel travelModel =
            new src.domain.dungeon.published.TravelDungeonModel(snapshots::current, snapshots::subscribe);

    src.domain.dungeon.published.TravelDungeonModel travelModel() {
        return travelModel;
    }

    @Override
    public void publishCurrentSession(src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSnapshot.SnapshotData snapshot) {
        snapshots.publish(DungeonTravelRuntimeSurfaceProjectionServiceAssembly.snapshot(snapshot));
    }
}
