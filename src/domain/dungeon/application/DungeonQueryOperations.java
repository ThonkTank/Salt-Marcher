package src.domain.dungeon.application;

import src.domain.dungeon.published.BaseMapSnapshot;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.LoadMapSnapshotQuery;
import src.domain.dungeon.published.SearchMapsQuery;
import src.domain.dungeon.map.DungeonMapRepository;

import java.util.List;

/**
 * Internal read coordinator for the public dungeon API facade.
 */
public final class DungeonQueryOperations {

    private final LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase;
    private final SearchDungeonMapsUseCase searchDungeonMapsUseCase;
    private final LoadMapSnapshotUseCase loadMapSnapshotUseCase;

    public DungeonQueryOperations(DungeonDocumentStore store, DungeonMapRepository repository) {
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        this.loadDungeonSnapshotUseCase = new LoadDungeonSnapshotUseCase(store, derive);
        this.searchDungeonMapsUseCase = new SearchDungeonMapsUseCase(repository, store);
        this.loadMapSnapshotUseCase = new LoadMapSnapshotUseCase(repository, store, derive);
    }

    public DungeonSnapshot loadSnapshot() {
        return loadDungeonSnapshotUseCase.execute();
    }

    public DungeonInspectorSnapshot describeSelection(String ownerKind, long ownerId) {
        return loadDungeonSnapshotUseCase.describeSelection(ownerKind, ownerId);
    }

    public List<DungeonMapSummary> searchMaps(SearchMapsQuery query) {
        return searchDungeonMapsUseCase.execute(query);
    }

    public BaseMapSnapshot loadMapSnapshot(LoadMapSnapshotQuery query) {
        return loadMapSnapshotUseCase.execute(query);
    }
}
