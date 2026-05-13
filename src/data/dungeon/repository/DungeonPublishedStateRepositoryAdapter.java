package src.data.dungeon.repository;

import java.util.List;
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
import src.domain.dungeon.published.DungeonMapCatalogModel;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonTravelModel;
import src.domain.dungeon.published.DungeonTravelResponse;

public final class DungeonPublishedStateRepositoryAdapter implements DungeonPublishedStateRepository {

    private final PublishedChannel<DungeonAuthoredReadResult> authoredRead =
            new PublishedChannel<>(DefaultDungeonPublishedState.authoredRead());
    private final PublishedChannel<DungeonAuthoredMutationResult> authoredMutation =
            new PublishedChannel<>(DefaultDungeonPublishedState.authoredMutation());
    private final PublishedChannel<DungeonMapCatalogResponse> mapCatalog =
            new PublishedChannel<>(new DungeonMapCatalogResponse.MapList(List.of()));
    private final PublishedChannel<DungeonTravelResponse> travel =
            new PublishedChannel<>(DefaultDungeonPublishedState.travel());
    private final DungeonPublishedMapSnapshotProjector mapSnapshotProjector = new DungeonPublishedMapSnapshotProjector();
    private final DungeonPublishedAuthoredProjector authoredProjector =
            new DungeonPublishedAuthoredProjector(mapSnapshotProjector);
    private final DungeonPublishedMapCatalogProjector mapCatalogProjector = new DungeonPublishedMapCatalogProjector();
    private final DungeonPublishedTravelProjector travelProjector =
            new DungeonPublishedTravelProjector(mapSnapshotProjector);
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
                ? authoredProjector.snapshot(snapshotData)
                : authoredRead.current());
    }

    @Override
    public void publishAuthoredInspector(Object snapshot) {
        publishAuthoredRead(snapshot instanceof LoadDungeonSnapshotUseCase.InspectorSnapshotData inspectorData
                ? authoredProjector.inspector(inspectorData)
                : authoredRead.current());
    }

    @Override
    public void publishAuthoredMutation(Object result) {
        DungeonAuthoredMutationResult next = result instanceof ApplyDungeonEditorOperationUseCase.OperationResultData operationResult
                ? authoredProjector.mutation(operationResult)
                : authoredMutation.current();
        authoredMutation.publish(next);
    }

    @Override
    public void publishMapCatalog(Object maps) {
        DungeonMapCatalogResponse next = maps instanceof List<?> mapList
                ? mapCatalogProjector.catalog(mapList.stream()
                        .filter(SearchDungeonMapsUseCase.MapSummary.class::isInstance)
                        .map(SearchDungeonMapsUseCase.MapSummary.class::cast)
                        .toList())
                : mapCatalog.current();
        mapCatalog.publish(next);
    }

    @Override
    public void publishMapCreated(DungeonMapIdentity mapId) {
        mapCatalog.publish(mapCatalogProjector.created(mapId));
    }

    @Override
    public void publishMapRenamed(DungeonMapIdentity mapId) {
        mapCatalog.publish(mapCatalogProjector.renamed(mapId));
    }

    @Override
    public void publishMapDeleted(DungeonMapIdentity mapId) {
        mapCatalog.publish(mapCatalogProjector.deleted(mapId));
    }

    @Override
    public void publishTravelSurface(Object surface) {
        DungeonTravelResponse next = surface instanceof DungeonTravelSurfaceFacts surfaceFacts
                ? travelProjector.surface(surfaceFacts)
                : travel.current();
        travel.publish(next);
    }

    @Override
    public void publishTravelMove(Object result) {
        DungeonTravelResponse next = result instanceof DungeonTravelMoveFacts moveFacts
                ? travelProjector.move(moveFacts)
                : travel.current();
        travel.publish(next);
    }

    private void publishAuthoredRead(DungeonAuthoredReadResult result) {
        authoredRead.publish(result);
    }

}
