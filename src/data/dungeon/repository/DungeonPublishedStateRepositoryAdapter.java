package src.data.dungeon.repository;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.dungeon.application.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.application.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.application.SearchDungeonMapsUseCase;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTravelMoveFacts;
import src.domain.dungeon.model.map.model.DungeonTravelSurfaceFacts;
import src.domain.dungeon.model.map.repository.DungeonPublishedStateRepository;
import src.domain.dungeon.published.DungeonAuthoredMutationModel;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadModel;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonMapMode;
import src.domain.dungeon.published.DungeonMapCatalogModel;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTravelContextKind;
import src.domain.dungeon.published.DungeonTravelHeading;
import src.domain.dungeon.published.DungeonTravelLocationKind;
import src.domain.dungeon.published.DungeonTravelModel;
import src.domain.dungeon.published.DungeonTravelPosition;
import src.domain.dungeon.published.DungeonTravelResponse;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;
import src.domain.dungeon.published.DungeonCellRef;

public final class DungeonPublishedStateRepositoryAdapter implements DungeonPublishedStateRepository {

    private static final String LISTENER_PARAMETER = "listener";

    private final PublishedChannel<DungeonAuthoredReadResult> authoredRead =
            new PublishedChannel<>(DefaultDungeonPublishedState.authoredRead());
    private final PublishedChannel<DungeonAuthoredMutationResult> authoredMutation =
            new PublishedChannel<>(DefaultDungeonPublishedState.authoredMutation());
    private final PublishedChannel<DungeonMapCatalogResponse> mapCatalog =
            new PublishedChannel<>(new DungeonMapCatalogResponse.MapList(List.of()));
    private final PublishedChannel<DungeonTravelResponse> travel =
            new PublishedChannel<>(DefaultDungeonPublishedState.travel());
    private final DungeonPublishedStateProjector projector = new DungeonPublishedStateProjector();
    public final DungeonAuthoredReadModel authoredReadModel = new DungeonAuthoredReadModel(
            authoredRead::current,
            authoredRead::subscribe);
    public final DungeonAuthoredMutationModel authoredMutationModel = new DungeonAuthoredMutationModel(
            authoredMutation::current,
            authoredMutation::subscribe);
    public final DungeonMapCatalogModel mapCatalogModel = new DungeonMapCatalogModel(
            mapCatalog::current,
            mapCatalog::subscribe);
    public final DungeonTravelModel travelModel = new DungeonTravelModel(
            travel::current,
            travel::subscribe);

    @Override
    public void publishAuthoredSnapshot(Object snapshot) {
        publishAuthoredRead(snapshot instanceof LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshotData
                ? projector.authoredSnapshot(snapshotData)
                : authoredRead.current());
    }

    @Override
    public void publishAuthoredInspector(Object snapshot) {
        publishAuthoredRead(snapshot instanceof LoadDungeonSnapshotUseCase.InspectorSnapshotData inspectorData
                ? projector.authoredInspector(inspectorData)
                : authoredRead.current());
    }

    @Override
    public void publishAuthoredMutation(Object result) {
        DungeonAuthoredMutationResult next = result instanceof ApplyDungeonEditorOperationUseCase.OperationResultData operationResult
                ? projector.authoredMutation(operationResult)
                : authoredMutation.current();
        authoredMutation.publish(next);
    }

    @Override
    public void publishMapCatalog(Object maps) {
        DungeonMapCatalogResponse next = maps instanceof List<?> mapList
                ? projector.mapCatalog(mapList.stream()
                        .filter(SearchDungeonMapsUseCase.MapSummary.class::isInstance)
                        .map(SearchDungeonMapsUseCase.MapSummary.class::cast)
                        .toList())
                : mapCatalog.current();
        mapCatalog.publish(next);
    }

    @Override
    public void publishMapCatalogMutation(CatalogMutationKind mutationKind, DungeonMapIdentity mapId) {
        mapCatalog.publish(projector.mapMutation(
                DungeonMapCatalogResponse.MutationKind.valueOf(mutationKind.name()),
                mapId));
    }

    @Override
    public void publishTravelSurface(Object surface) {
        DungeonTravelResponse next = surface instanceof DungeonTravelSurfaceFacts surfaceFacts
                ? projector.travelSurface(surfaceFacts)
                : travel.current();
        travel.publish(next);
    }

    @Override
    public void publishTravelMove(Object result) {
        DungeonTravelResponse next = result instanceof DungeonTravelMoveFacts moveFacts
                ? projector.travelMove(moveFacts)
                : travel.current();
        travel.publish(next);
    }

    private void publishAuthoredRead(DungeonAuthoredReadResult result) {
        authoredRead.publish(result);
    }

    private static final class PublishedChannel<T> {

        private final List<Consumer<T>> listeners = new java.util.ArrayList<>();
        private T current;

        private PublishedChannel(T initial) {
            this.current = Objects.requireNonNull(initial, "initial");
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

    private static final class DefaultDungeonPublishedState {

        private static final String DEFAULT_DUNGEON_NAME = "Dungeon";

        private static DungeonAuthoredReadResult authoredRead() {
            return new DungeonAuthoredReadResult.CommittedSnapshot(snapshot());
        }

        private static DungeonAuthoredMutationResult authoredMutation() {
            return new DungeonAuthoredMutationResult.Operation(new DungeonOperationResult(
                    snapshot(),
                    List.of(),
                    List.of()));
        }

        private static DungeonTravelResponse travel() {
            return new DungeonTravelResponse.Surface(new DungeonTravelSurfaceSnapshot(
                    DungeonTravelContextKind.DUNGEON,
                    DEFAULT_DUNGEON_NAME,
                    0,
                    DungeonMapSnapshot.empty(),
                    new DungeonTravelPosition(
                            new DungeonMapId(1L),
                            DungeonTravelLocationKind.TILE,
                            0L,
                            new DungeonCellRef(0, 0, 0),
                            DungeonTravelHeading.defaultHeading()),
                    DEFAULT_DUNGEON_NAME,
                    "Kein Standort",
                    "",
                    "",
                    "",
                    "",
                    List.of()));
        }

        private static DungeonSnapshot snapshot() {
            return new DungeonSnapshot(
                    DEFAULT_DUNGEON_NAME,
                    DungeonMapMode.EDITOR,
                    DungeonMapSnapshot.empty(),
                    List.of(),
                    List.of(),
                    0);
        }
    }
}
