package src.domain.dungeon;

final class DungeonTravelRuntimePublishedStateServiceAssembly
        implements src.domain.dungeon.model.runtime.repository.TravelDungeonSessionPublishedStateRepository {

    private final DungeonTravelPublishedState publishedState = new DungeonTravelPublishedState();

    src.domain.dungeon.published.TravelDungeonModel travelModel() {
        return publishedState.travelModel();
    }

    @Override
    public void publishCurrentSession(src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSnapshot.SnapshotData snapshot) {
        publishedState.publishCurrentSession(snapshot);
    }
}
