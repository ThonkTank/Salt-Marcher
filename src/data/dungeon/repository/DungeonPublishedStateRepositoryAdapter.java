package src.data.dungeon.repository;

import java.util.ArrayList;
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

    private final List<Consumer<DungeonAuthoredReadResult>> authoredReadListeners = new ArrayList<>();
    private final List<Consumer<DungeonAuthoredMutationResult>> authoredMutationListeners = new ArrayList<>();
    private final List<Consumer<DungeonMapCatalogResponse>> mapCatalogListeners = new ArrayList<>();
    private final List<Consumer<DungeonTravelResponse>> travelListeners = new ArrayList<>();
    private final DungeonPublishedStateProjector projector = new DungeonPublishedStateProjector();
    public final DungeonAuthoredReadModel authoredReadModel = new DungeonAuthoredReadModel(
            this::currentAuthoredRead,
            this::subscribeAuthoredReadListener);
    public final DungeonAuthoredMutationModel authoredMutationModel = new DungeonAuthoredMutationModel(
            this::currentAuthoredMutation,
            this::subscribeAuthoredMutationListener);
    public final DungeonMapCatalogModel mapCatalogModel = new DungeonMapCatalogModel(
            this::currentMapCatalog,
            this::subscribeMapCatalogListener);
    public final DungeonTravelModel travelModel = new DungeonTravelModel(
            this::currentTravel,
            this::subscribeTravelListener);
    private DungeonAuthoredReadResult currentAuthoredRead = emptyAuthoredRead();
    private DungeonAuthoredMutationResult currentAuthoredMutation = emptyAuthoredMutation();
    private DungeonMapCatalogResponse currentMapCatalog = new DungeonMapCatalogResponse.MapList(List.of());
    private DungeonTravelResponse currentTravel = emptyTravel();

    @Override
    public void publishAuthoredSnapshot(Object snapshot) {
        publishAuthoredRead(snapshot instanceof LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshotData
                ? projector.authoredSnapshot(snapshotData)
                : currentAuthoredRead);
    }

    @Override
    public void publishAuthoredInspector(Object snapshot) {
        publishAuthoredRead(snapshot instanceof LoadDungeonSnapshotUseCase.InspectorSnapshotData inspectorData
                ? projector.authoredInspector(inspectorData)
                : currentAuthoredRead);
    }

    @Override
    public void publishAuthoredMutation(Object result) {
        currentAuthoredMutation = result instanceof ApplyDungeonEditorOperationUseCase.OperationResultData operationResult
                ? projector.authoredMutation(operationResult)
                : currentAuthoredMutation;
        for (Consumer<DungeonAuthoredMutationResult> listener : List.copyOf(authoredMutationListeners)) {
            listener.accept(currentAuthoredMutation);
        }
    }

    @Override
    public void publishMapCatalog(Object maps) {
        currentMapCatalog = maps instanceof List<?> mapList
                ? projector.mapCatalog(mapList.stream()
                        .filter(SearchDungeonMapsUseCase.MapSummary.class::isInstance)
                        .map(SearchDungeonMapsUseCase.MapSummary.class::cast)
                        .toList())
                : currentMapCatalog;
        publishCurrentMapCatalog();
    }

    @Override
    public void publishMapCatalogMutation(CatalogMutationKind mutationKind, DungeonMapIdentity mapId) {
        currentMapCatalog = projector.mapMutation(
                DungeonMapCatalogResponse.MutationKind.valueOf(mutationKind.name()),
                mapId);
        publishCurrentMapCatalog();
    }

    @Override
    public void publishTravelSurface(Object surface) {
        currentTravel = surface instanceof DungeonTravelSurfaceFacts surfaceFacts
                ? projector.travelSurface(surfaceFacts)
                : currentTravel;
        publishCurrentTravel();
    }

    @Override
    public void publishTravelMove(Object result) {
        currentTravel = result instanceof DungeonTravelMoveFacts moveFacts
                ? projector.travelMove(moveFacts)
                : currentTravel;
        publishCurrentTravel();
    }

    private void publishAuthoredRead(DungeonAuthoredReadResult result) {
        currentAuthoredRead = result;
        for (Consumer<DungeonAuthoredReadResult> listener : List.copyOf(authoredReadListeners)) {
            listener.accept(currentAuthoredRead);
        }
    }

    private void publishCurrentMapCatalog() {
        for (Consumer<DungeonMapCatalogResponse> listener : List.copyOf(mapCatalogListeners)) {
            listener.accept(currentMapCatalog);
        }
    }

    private void publishCurrentTravel() {
        for (Consumer<DungeonTravelResponse> listener : List.copyOf(travelListeners)) {
            listener.accept(currentTravel);
        }
    }

    private DungeonAuthoredReadResult currentAuthoredRead() {
        return currentAuthoredRead;
    }

    private DungeonAuthoredMutationResult currentAuthoredMutation() {
        return currentAuthoredMutation;
    }

    private DungeonMapCatalogResponse currentMapCatalog() {
        return currentMapCatalog;
    }

    private DungeonTravelResponse currentTravel() {
        return currentTravel;
    }

    private Runnable subscribeAuthoredReadListener(Consumer<DungeonAuthoredReadResult> listener) {
        Consumer<DungeonAuthoredReadResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        authoredReadListeners.add(safeListener);
        return () -> authoredReadListeners.remove(safeListener);
    }

    private Runnable subscribeAuthoredMutationListener(Consumer<DungeonAuthoredMutationResult> listener) {
        Consumer<DungeonAuthoredMutationResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        authoredMutationListeners.add(safeListener);
        return () -> authoredMutationListeners.remove(safeListener);
    }

    private Runnable subscribeMapCatalogListener(Consumer<DungeonMapCatalogResponse> listener) {
        Consumer<DungeonMapCatalogResponse> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        mapCatalogListeners.add(safeListener);
        return () -> mapCatalogListeners.remove(safeListener);
    }

    private Runnable subscribeTravelListener(Consumer<DungeonTravelResponse> listener) {
        Consumer<DungeonTravelResponse> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        travelListeners.add(safeListener);
        return () -> travelListeners.remove(safeListener);
    }

    private static DungeonAuthoredReadResult emptyAuthoredRead() {
        return new DungeonAuthoredReadResult.CommittedSnapshot(new DungeonSnapshot(
                "Dungeon",
                DungeonMapMode.EDITOR,
                DungeonMapSnapshot.empty(),
                List.of(),
                List.of(),
                0));
    }

    private static DungeonAuthoredMutationResult emptyAuthoredMutation() {
        return new DungeonAuthoredMutationResult.Operation(new DungeonOperationResult(
                new DungeonSnapshot(
                        "Dungeon",
                        DungeonMapMode.EDITOR,
                        DungeonMapSnapshot.empty(),
                        List.of(),
                        List.of(),
                        0),
                List.of(),
                List.of()));
    }

    private static DungeonTravelResponse emptyTravel() {
        return new DungeonTravelResponse.Surface(new DungeonTravelSurfaceSnapshot(
                DungeonTravelContextKind.DUNGEON,
                "Dungeon",
                0,
                DungeonMapSnapshot.empty(),
                new DungeonTravelPosition(
                        new DungeonMapId(1L),
                        DungeonTravelLocationKind.TILE,
                        0L,
                        new DungeonCellRef(0, 0, 0),
                        DungeonTravelHeading.defaultHeading()),
                "Dungeon",
                "Kein Standort",
                "",
                "",
                "",
                "",
                List.of()));
    }
}
