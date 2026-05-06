package src.domain.dungeon;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.application.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.application.AssembleDungeonSnapshotUseCase;
import src.domain.dungeon.application.BuildDungeonDerivedStateUseCase;
import src.domain.dungeon.application.CreateDungeonMapUseCase;
import src.domain.dungeon.application.DeleteDungeonMapUseCase;
import src.domain.dungeon.application.DungeonAuthoredRuntimeAdapter;
import src.domain.dungeon.application.DungeonCatalogRuntimeAdapter;
import src.domain.dungeon.application.DungeonTravelRuntimeAdapter;
import src.domain.dungeon.application.InspectDungeonSelectionUseCase;
import src.domain.dungeon.application.LoadDungeonMapUseCase;
import src.domain.dungeon.application.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.application.LoadDungeonTravelSurfaceUseCase;
import src.domain.dungeon.application.MoveDungeonTravelActionUseCase;
import src.domain.dungeon.application.PublishDungeonEditorHandlesUseCase;
import src.domain.dungeon.application.RenameDungeonMapUseCase;
import src.domain.dungeon.application.SearchDungeonMapsUseCase;
import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.port.DungeonMapSearch;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadQuery;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonMapCatalogRequest;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonTravelRequest;
import src.domain.dungeon.published.DungeonTravelResponse;

/**
 * Public dungeon feature facade used by editor and travel interactors.
 */
public final class DungeonApplicationService {

    private final DungeonAuthoredRuntimeAdapter authoredRuntimeAdapter;
    private final DungeonCatalogRuntimeAdapter catalogRuntimeAdapter;
    private final DungeonTravelRuntimeAdapter travelRuntimeAdapter;

    public DungeonApplicationService(
            DungeonMapRepository mapRepository,
            DungeonMapSearch mapSearch
    ) {
        DungeonMapRepository repository = Objects.requireNonNull(mapRepository, "mapRepository");
        DungeonMapSearch search = Objects.requireNonNull(mapSearch, "mapSearch");
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        LoadDungeonMapUseCase loadDungeonMapUseCase = new LoadDungeonMapUseCase(repository, search);
        PublishDungeonEditorHandlesUseCase publishDungeonEditorHandlesUseCase =
                new PublishDungeonEditorHandlesUseCase();
        AssembleDungeonSnapshotUseCase assembleDungeonSnapshotUseCase =
                new AssembleDungeonSnapshotUseCase(derive);
        InspectDungeonSelectionUseCase inspectDungeonSelectionUseCase =
                new InspectDungeonSelectionUseCase(derive);
        LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase = new LoadDungeonSnapshotUseCase(
                loadDungeonMapUseCase,
                assembleDungeonSnapshotUseCase,
                publishDungeonEditorHandlesUseCase,
                inspectDungeonSelectionUseCase);
        ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase =
                new ApplyDungeonEditorOperationUseCase(
                        loadDungeonMapUseCase,
                        repository::save,
                        derive::execute,
                        assembleDungeonSnapshotUseCase,
                        publishDungeonEditorHandlesUseCase);
        SearchDungeonMapsUseCase searchDungeonMapsUseCase = new SearchDungeonMapsUseCase(search);
        CreateDungeonMapUseCase createDungeonMapUseCase =
                new CreateDungeonMapUseCase(repository::nextMapId, repository::save);
        RenameDungeonMapUseCase renameDungeonMapUseCase =
                new RenameDungeonMapUseCase(repository::findById, repository::save);
        DeleteDungeonMapUseCase deleteDungeonMapUseCase = new DeleteDungeonMapUseCase(repository::delete);
        LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase =
                new LoadDungeonTravelSurfaceUseCase(loadDungeonMapUseCase, derive);
        MoveDungeonTravelActionUseCase moveDungeonTravelActionUseCase =
                new MoveDungeonTravelActionUseCase(loadDungeonMapUseCase, repository::findById, derive::execute);

        this.authoredRuntimeAdapter = new DungeonAuthoredRuntimeAdapter(
                loadDungeonSnapshotUseCase,
                applyDungeonEditorOperationUseCase);
        this.catalogRuntimeAdapter = new DungeonCatalogRuntimeAdapter(
                searchDungeonMapsUseCase,
                createDungeonMapUseCase,
                renameDungeonMapUseCase,
                deleteDungeonMapUseCase);
        this.travelRuntimeAdapter = new DungeonTravelRuntimeAdapter(
                loadDungeonTravelSurfaceUseCase,
                moveDungeonTravelActionUseCase);
    }

    public DungeonAuthoredReadResult loadAuthored(@Nullable DungeonAuthoredReadQuery query) {
        return authoredRuntimeAdapter.load(query);
    }

    public DungeonAuthoredMutationResult mutateAuthored(@Nullable DungeonAuthoredMutationCommand command) {
        return authoredRuntimeAdapter.mutate(command);
    }

    public DungeonMapCatalogResponse catalog(@Nullable DungeonMapCatalogRequest request) {
        return catalogRuntimeAdapter.handle(request);
    }

    public DungeonTravelResponse travel(@Nullable DungeonTravelRequest request) {
        return travelRuntimeAdapter.handle(request);
    }
}
