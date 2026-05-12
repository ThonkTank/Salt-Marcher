package src.domain.dungeon.model.map.repository;

import java.util.List;
import src.domain.dungeon.application.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.application.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.application.SearchDungeonMapsUseCase;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTravelMoveFacts;
import src.domain.dungeon.model.map.model.DungeonTravelSurfaceFacts;

public interface DungeonPublishedStateRepository {

    enum CatalogMutationKind {
        CREATED,
        RENAMED,
        DELETED
    }

    void publishAuthoredSnapshot(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot);

    void publishAuthoredInspector(LoadDungeonSnapshotUseCase.InspectorSnapshotData snapshot);

    void publishAuthoredMutation(ApplyDungeonEditorOperationUseCase.OperationResultData result);

    void publishMapCatalog(List<SearchDungeonMapsUseCase.MapSummary> maps);

    void publishMapCatalogMutation(CatalogMutationKind mutationKind, DungeonMapIdentity mapId);

    void publishTravelSurface(DungeonTravelSurfaceFacts surface);

    void publishTravelMove(DungeonTravelMoveFacts result);
}
