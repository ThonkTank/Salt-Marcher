package src.domain.dungeon.model.map.repository;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.dungeon.model.map.helper.DungeonDefaultPublishedStateHelper;
import src.domain.dungeon.model.map.helper.DungeonMapCatalogPublishedProjectionHelper;
import src.domain.dungeon.model.map.helper.DungeonPublishedMapSnapshotProjectionHelper;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTravelMoveFacts;
import src.domain.dungeon.model.map.model.DungeonTravelSurfaceFacts;
import src.domain.dungeon.model.travel.helper.DungeonTravelPublishedProjectionHelper;
import src.domain.dungeon.published.DungeonAuthoredMutationModel;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadModel;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonMapCatalogModel;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonTravelModel;
import src.domain.dungeon.published.DungeonTravelResponse;

public final class DungeonPublishedStateApplicationRepository implements DungeonPublishedStateRepository {

    private final PublishedChannel<DungeonAuthoredReadResult> authoredRead =
            new PublishedChannel<>(DungeonDefaultPublishedStateHelper.authoredRead());
    private final PublishedChannel<DungeonAuthoredMutationResult> authoredMutation =
            new PublishedChannel<>(DungeonDefaultPublishedStateHelper.authoredMutation());
    private final PublishedChannel<DungeonMapCatalogResponse> mapCatalog =
            new PublishedChannel<>(new DungeonMapCatalogResponse.MapList(List.of()));
    private final PublishedChannel<DungeonTravelResponse> travel =
            new PublishedChannel<>(DungeonDefaultPublishedStateHelper.travel());
    private final DungeonPublishedMapSnapshotProjectionHelper mapSnapshotProjectionHelper =
            new DungeonPublishedMapSnapshotProjectionHelper();
    private final DungeonMapCatalogPublishedProjectionHelper mapCatalogProjectionHelper =
            new DungeonMapCatalogPublishedProjectionHelper();
    private final DungeonTravelPublishedProjectionHelper travelProjectionHelper =
            new DungeonTravelPublishedProjectionHelper(mapSnapshotProjectionHelper);
    private final DungeonAuthoredReadModel authoredReadModel = new DungeonAuthoredReadModel(
            authoredRead::current,
            authoredRead::subscribe);
    private final DungeonAuthoredMutationModel authoredMutationModel = new DungeonAuthoredMutationModel(
            authoredMutation::current,
            authoredMutation::subscribe);
    private final DungeonMapCatalogModel mapCatalogModel = new DungeonMapCatalogModel(
            mapCatalog::current,
            mapCatalog::subscribe);
    private final DungeonTravelModel travelModel = new DungeonTravelModel(
            travel::current,
            travel::subscribe);

    public DungeonAuthoredReadModel authoredReadModel() {
        return authoredReadModel;
    }

    public DungeonAuthoredMutationModel authoredMutationModel() {
        return authoredMutationModel;
    }

    public DungeonMapCatalogModel mapCatalogModel() {
        return mapCatalogModel;
    }

    public DungeonTravelModel travelModel() {
        return travelModel;
    }

    @Override
    public void publishAuthoredSnapshot(DungeonAuthoredReadResult snapshot) {
        publishAuthoredRead(snapshot == null ? authoredRead.current() : snapshot);
    }

    @Override
    public void publishAuthoredInspector(DungeonAuthoredReadResult snapshot) {
        publishAuthoredRead(snapshot == null ? authoredRead.current() : snapshot);
    }

    @Override
    public void publishAuthoredMutation(DungeonAuthoredMutationResult result) {
        DungeonAuthoredMutationResult next = result == null ? authoredMutation.current() : result;
        authoredMutation.publish(next);
    }

    @Override
    public void publishMapCatalog(DungeonMapCatalogResponse maps) {
        mapCatalog.publish(maps == null ? mapCatalog.current() : maps);
    }

    @Override
    public void publishMapCreated(DungeonMapIdentity mapId) {
        mapCatalog.publish(mapCatalogProjectionHelper.created(mapId));
    }

    @Override
    public void publishMapRenamed(DungeonMapIdentity mapId) {
        mapCatalog.publish(mapCatalogProjectionHelper.renamed(mapId));
    }

    @Override
    public void publishMapDeleted(DungeonMapIdentity mapId) {
        mapCatalog.publish(mapCatalogProjectionHelper.deleted(mapId));
    }

    @Override
    public void publishTravelSurface(DungeonTravelSurfaceFacts surface) {
        travel.publish(surface == null ? travel.current() : travelProjectionHelper.surface(surface));
    }

    @Override
    public void publishTravelMove(DungeonTravelMoveFacts result) {
        travel.publish(result == null ? travel.current() : travelProjectionHelper.move(result));
    }

    private void publishAuthoredRead(DungeonAuthoredReadResult result) {
        authoredRead.publish(result);
    }

    private static final class PublishedChannel<T> {

        private static final String LISTENER_PARAMETER = "listener";

        private final List<Consumer<T>> listeners = new java.util.ArrayList<>();
        private T current;

        private PublishedChannel(T initial) {
            current = Objects.requireNonNull(initial, "initial");
        }

        private T current() {
            return current;
        }

        private void publish(T next) {
            current = Objects.requireNonNull(next, "next");
            for (Consumer<T> listener : List.copyOf(listeners)) {
                listener.accept(current);
            }
        }

        private Runnable subscribe(Consumer<T> listener) {
            Consumer<T> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
            listeners.add(safeListener);
            return () -> listeners.remove(safeListener);
        }
    }
}
