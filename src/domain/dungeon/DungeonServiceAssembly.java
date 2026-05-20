package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import shell.api.ServiceRegistry;
import src.domain.dungeon.application.ApplyDungeonAuthoredMutationUseCase;
import src.domain.dungeon.application.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.application.ApplyDungeonMapCatalogUseCase;
import src.domain.dungeon.application.ApplyDungeonTravelUseCase;
import src.domain.dungeon.application.AssembleDungeonSnapshotUseCase;
import src.domain.dungeon.application.BuildDungeonDerivedStateUseCase;
import src.domain.dungeon.application.CreateDungeonMapUseCase;
import src.domain.dungeon.application.DeleteDungeonMapUseCase;
import src.domain.dungeon.application.InspectDungeonSelectionUseCase;
import src.domain.dungeon.application.LoadDungeonMapUseCase;
import src.domain.dungeon.application.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.application.LoadDungeonTravelSurfaceUseCase;
import src.domain.dungeon.application.MoveDungeonTravelActionUseCase;
import src.domain.dungeon.application.PublishDungeonEditorHandlesUseCase;
import src.domain.dungeon.application.RefreshDungeonAuthoredUseCase;
import src.domain.dungeon.application.RenameDungeonMapUseCase;
import src.domain.dungeon.application.SearchDungeonMapsUseCase;
import src.domain.dungeon.model.editor.helper.DungeonEditorSnapshotProjectionHelper;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.editor.port.DungeonEditorDungeonPort;
import src.domain.dungeon.model.editor.repository.DungeonEditorDungeonRepository;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorCreateCorridorUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorCreateDoorUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorCreateWallUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorDeleteCorridorUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorDeleteDoorUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorDeleteRoomUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorDeleteWallUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorPaintRoomUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorSelectionUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.model.editor.usecase.BuildDungeonEditorSnapshotUseCase;
import src.domain.dungeon.model.editor.usecase.CreateDungeonEditorMapUseCase;
import src.domain.dungeon.model.editor.usecase.DeleteDungeonEditorMapUseCase;
import src.domain.dungeon.model.editor.usecase.DungeonEditorSnapshotPublication;
import src.domain.dungeon.model.editor.usecase.InterpretDungeonEditorMainViewInputUseCase;
import src.domain.dungeon.model.editor.usecase.PublishDungeonEditorSnapshotUseCase;
import src.domain.dungeon.model.editor.usecase.RenameDungeonEditorMapUseCase;
import src.domain.dungeon.model.editor.usecase.SaveDungeonEditorRoomNarrationUseCase;
import src.domain.dungeon.model.editor.usecase.SelectDungeonEditorMapUseCase;
import src.domain.dungeon.model.editor.usecase.SetDungeonEditorOverlayUseCase;
import src.domain.dungeon.model.editor.usecase.SetDungeonEditorToolUseCase;
import src.domain.dungeon.model.editor.usecase.SetDungeonEditorViewModeUseCase;
import src.domain.dungeon.model.editor.usecase.ShiftDungeonEditorProjectionLevelUseCase;
import src.domain.dungeon.model.map.repository.DungeonMapRepository;
import src.domain.dungeon.model.map.repository.DungeonPublishedStateApplicationRepository;
import src.domain.dungeon.model.travel.repository.ApplicationTravelDungeonSessionRepository;
import src.domain.dungeon.model.travel.repository.TravelPartyStateRepository;
import src.domain.dungeon.model.travel.usecase.ApplyTravelDungeonSessionUseCase;
import src.domain.dungeon.published.DungeonAuthoredMutationModel;
import src.domain.dungeon.published.DungeonAuthoredReadModel;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorStateModel;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonMapCatalogModel;
import src.domain.dungeon.published.DungeonTravelModel;
import src.domain.dungeon.published.TravelDungeonModel;

final class DungeonServiceAssembly {

    private final PublishedState editorPublishedState = new PublishedState();
    private final AtomicReference<DungeonPublishedStateApplicationRepository> authoredPublishedState =
            new AtomicReference<>();
    private final AtomicReference<DungeonTravelRuntimeApplicationService> travelRuntime = new AtomicReference<>();

    DungeonAuthoredApplicationService createAuthoredApplicationService(ServiceRegistry registry) {
        DungeonPublishedStateApplicationRepository publishedState = authoredPublishedState(registry);
        LoadDungeonMapUseCase loadDungeonMapUseCase = loadDungeonMapUseCase(registry);
        PublishDungeonEditorHandlesUseCase publishDungeonEditorHandlesUseCase = new PublishDungeonEditorHandlesUseCase();
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        AssembleDungeonSnapshotUseCase assembleDungeonSnapshotUseCase = new AssembleDungeonSnapshotUseCase(derive);
        InspectDungeonSelectionUseCase inspectDungeonSelectionUseCase = new InspectDungeonSelectionUseCase(derive);
        LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase = new LoadDungeonSnapshotUseCase(
                loadDungeonMapUseCase,
                assembleDungeonSnapshotUseCase,
                publishDungeonEditorHandlesUseCase,
                inspectDungeonSelectionUseCase);
        ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase = new ApplyDungeonEditorOperationUseCase(
                loadDungeonMapUseCase,
                registry.require(DungeonMapRepository.class),
                derive,
                assembleDungeonSnapshotUseCase,
                publishDungeonEditorHandlesUseCase);
        return new DungeonAuthoredApplicationService(
                new RefreshDungeonAuthoredUseCase(loadDungeonSnapshotUseCase, publishedState),
                new ApplyDungeonAuthoredMutationUseCase(applyDungeonEditorOperationUseCase, publishedState));
    }

    DungeonCatalogApplicationService createCatalogApplicationService(ServiceRegistry registry) {
        DungeonPublishedStateApplicationRepository publishedState = authoredPublishedState(registry);
        DungeonMapRepository repository = registry.require(DungeonMapRepository.class);
        return new DungeonCatalogApplicationService(new ApplyDungeonMapCatalogUseCase(
                new SearchDungeonMapsUseCase(repository),
                new CreateDungeonMapUseCase(repository),
                new RenameDungeonMapUseCase(repository),
                new DeleteDungeonMapUseCase(repository),
                publishedState));
    }

    DungeonTravelApplicationService createTravelApplicationService(ServiceRegistry registry) {
        DungeonPublishedStateApplicationRepository publishedState = authoredPublishedState(registry);
        LoadDungeonMapUseCase loadDungeonMapUseCase = loadDungeonMapUseCase(registry);
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        return new DungeonTravelApplicationService(new ApplyDungeonTravelUseCase(
                new LoadDungeonTravelSurfaceUseCase(loadDungeonMapUseCase, derive),
                new MoveDungeonTravelActionUseCase(loadDungeonMapUseCase, registry.require(DungeonMapRepository.class), derive),
                publishedState));
    }

    DungeonTravelRuntimeApplicationService createTravelRuntimeApplicationService(ServiceRegistry registry) {
        DungeonTravelRuntimeApplicationService existing = travelRuntime.get();
        if (existing != null) {
            return existing;
        }
        ApplicationTravelDungeonSessionRepository dungeonSessionRepository =
                new ApplicationTravelDungeonSessionRepository(
                        registry.require(TravelPartyStateRepository.class),
                        registry.require(DungeonTravelApplicationService.class),
                        registry.require(DungeonTravelModel.class));
        DungeonTravelRuntimeApplicationService candidate = new DungeonTravelRuntimeApplicationService(
                new ApplyTravelDungeonSessionUseCase(dungeonSessionRepository));
        return travelRuntime.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(travelRuntime.get(), "travelRuntime");
    }

    DungeonAuthoredReadModel authoredReadModel(ServiceRegistry registry) {
        return authoredPublishedState(registry).authoredReadModel();
    }

    DungeonAuthoredMutationModel authoredMutationModel(ServiceRegistry registry) {
        return authoredPublishedState(registry).authoredMutationModel();
    }

    DungeonMapCatalogModel mapCatalogModel(ServiceRegistry registry) {
        return authoredPublishedState(registry).mapCatalogModel();
    }

    DungeonTravelModel dungeonTravelModel(ServiceRegistry registry) {
        return authoredPublishedState(registry).travelModel();
    }

    TravelDungeonModel travelDungeonModel(ServiceRegistry registry) {
        return createTravelRuntimeApplicationService(registry).travelModel();
    }

    DungeonEditorApplicationService createEditorApplicationService(ServiceRegistry registry) {
        ServiceRegistry services = Objects.requireNonNull(registry, "registry");
        DungeonEditorDungeonRepository dungeonRepository = new DungeonEditorDungeonRepository(
                services.require(DungeonCatalogApplicationService.class),
                services.require(DungeonAuthoredApplicationService.class));
        DungeonEditorDungeonPort dungeonPort = new DungeonEditorDungeonPort(
                services.require(DungeonMapCatalogModel.class),
                services.require(DungeonAuthoredReadModel.class),
                services.require(DungeonAuthoredMutationModel.class));
        DungeonEditorSessionWorkflow workflow = new DungeonEditorSessionWorkflow();
        BuildDungeonEditorSnapshotUseCase snapshotBuilder = new BuildDungeonEditorSnapshotUseCase(
                dungeonRepository,
                dungeonPort);
        InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter =
                new InterpretDungeonEditorMainViewInputUseCase();
        PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase =
                new PublishDungeonEditorSnapshotUseCase(editorPublishedState);
        ApplyDungeonEditorSessionEffectUseCase effectUseCase = new ApplyDungeonEditorSessionEffectUseCase(
                workflow,
                dungeonRepository,
                dungeonPort,
                snapshotBuilder,
                snapshotPublicationUseCase);
        effectUseCase.publishCurrent();
        return new DungeonEditorApplicationService(
                new SelectDungeonEditorMapUseCase(
                        workflow,
                        snapshotBuilder,
                        mainViewInterpreter,
                        snapshotPublicationUseCase),
                new CreateDungeonEditorMapUseCase(
                        workflow,
                        dungeonRepository,
                        dungeonPort,
                        snapshotBuilder,
                        mainViewInterpreter,
                        snapshotPublicationUseCase),
                new RenameDungeonEditorMapUseCase(
                        workflow,
                        dungeonRepository,
                        dungeonPort,
                        snapshotBuilder,
                        snapshotPublicationUseCase),
                new DeleteDungeonEditorMapUseCase(
                        workflow,
                        dungeonRepository,
                        dungeonPort,
                        snapshotBuilder,
                        mainViewInterpreter,
                        snapshotPublicationUseCase),
                new SetDungeonEditorViewModeUseCase(
                        workflow,
                        snapshotBuilder,
                        mainViewInterpreter,
                        snapshotPublicationUseCase),
                new SetDungeonEditorToolUseCase(
                        workflow,
                        snapshotBuilder,
                        mainViewInterpreter,
                        snapshotPublicationUseCase),
                new ShiftDungeonEditorProjectionLevelUseCase(workflow, snapshotBuilder, snapshotPublicationUseCase),
                new SetDungeonEditorOverlayUseCase(workflow, snapshotBuilder, snapshotPublicationUseCase),
                new ApplyDungeonEditorSelectionUseCase(workflow, mainViewInterpreter, effectUseCase),
                new ApplyDungeonEditorPaintRoomUseCase(workflow, mainViewInterpreter, effectUseCase),
                new ApplyDungeonEditorDeleteRoomUseCase(workflow, mainViewInterpreter, effectUseCase),
                new ApplyDungeonEditorCreateWallUseCase(workflow, mainViewInterpreter, effectUseCase),
                new ApplyDungeonEditorDeleteWallUseCase(workflow, mainViewInterpreter, effectUseCase),
                new ApplyDungeonEditorCreateDoorUseCase(workflow, mainViewInterpreter, effectUseCase),
                new ApplyDungeonEditorDeleteDoorUseCase(workflow, mainViewInterpreter, effectUseCase),
                new ApplyDungeonEditorCreateCorridorUseCase(workflow, mainViewInterpreter, effectUseCase),
                new ApplyDungeonEditorDeleteCorridorUseCase(workflow, mainViewInterpreter, effectUseCase),
                new SaveDungeonEditorRoomNarrationUseCase(workflow, dungeonRepository, effectUseCase));
    }

    DungeonEditorControlsModel createControlsModel(ServiceRegistry registry) {
        Objects.requireNonNull(registry, "registry");
        return editorPublishedState.controlsModel;
    }

    DungeonEditorMapSurfaceModel createMapSurfaceModel(ServiceRegistry registry) {
        Objects.requireNonNull(registry, "registry");
        return editorPublishedState.mapSurfaceModel;
    }

    DungeonEditorStateModel createStateModel(ServiceRegistry registry) {
        Objects.requireNonNull(registry, "registry");
        return editorPublishedState.stateModel;
    }

    private DungeonPublishedStateApplicationRepository authoredPublishedState(ServiceRegistry registry) {
        DungeonPublishedStateApplicationRepository existing = authoredPublishedState.get();
        if (existing != null) {
            return existing;
        }
        Objects.requireNonNull(registry, "registry");
        DungeonPublishedStateApplicationRepository candidate = new DungeonPublishedStateApplicationRepository();
        return authoredPublishedState.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(authoredPublishedState.get(), "authoredPublishedState");
    }

    private static LoadDungeonMapUseCase loadDungeonMapUseCase(ServiceRegistry registry) {
        return new LoadDungeonMapUseCase(registry.require(DungeonMapRepository.class));
    }

    private static final class PublishedState implements DungeonEditorSnapshotPublication {

        private final List<Consumer<DungeonEditorControlsSnapshot>> controlsListeners = new ArrayList<>();
        private final List<Consumer<DungeonEditorMapSurfaceSnapshot>> mapSurfaceListeners = new ArrayList<>();
        private final List<Consumer<DungeonEditorStateSnapshot>> stateListeners = new ArrayList<>();
        private final DungeonEditorControlsModel controlsModel = new DungeonEditorControlsModel(
                this::currentControls,
                this::subscribeControls);
        private final DungeonEditorMapSurfaceModel mapSurfaceModel = new DungeonEditorMapSurfaceModel(
                this::currentMapSurface,
                this::subscribeMapSurface);
        private final DungeonEditorStateModel stateModel = new DungeonEditorStateModel(
                this::currentState,
                this::subscribeState);
        private DungeonEditorControlsSnapshot currentControls = DungeonEditorControlsSnapshot.empty("");
        private DungeonEditorMapSurfaceSnapshot currentMapSurface = DungeonEditorMapSurfaceSnapshot.empty();
        private DungeonEditorStateSnapshot currentState = DungeonEditorStateSnapshot.empty("");

        @Override
        public void publishEditorSnapshot(DungeonEditorSessionSnapshot.SnapshotData snapshot) {
            currentControls = DungeonEditorSnapshotProjectionHelper.toControlsSnapshot(snapshot);
            currentMapSurface = DungeonEditorSnapshotProjectionHelper.toMapSurfaceSnapshot(snapshot);
            currentState = DungeonEditorSnapshotProjectionHelper.toStateSnapshot(snapshot);
            for (Consumer<DungeonEditorControlsSnapshot> listener : List.copyOf(controlsListeners)) {
                listener.accept(currentControls);
            }
            for (Consumer<DungeonEditorMapSurfaceSnapshot> listener : List.copyOf(mapSurfaceListeners)) {
                listener.accept(currentMapSurface);
            }
            for (Consumer<DungeonEditorStateSnapshot> listener : List.copyOf(stateListeners)) {
                listener.accept(currentState);
            }
        }

        private DungeonEditorControlsSnapshot currentControls() {
            return currentControls;
        }

        private DungeonEditorMapSurfaceSnapshot currentMapSurface() {
            return currentMapSurface;
        }

        private DungeonEditorStateSnapshot currentState() {
            return currentState;
        }

        private Runnable subscribeControls(Consumer<DungeonEditorControlsSnapshot> listener) {
            Consumer<DungeonEditorControlsSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
            controlsListeners.add(safeListener);
            return () -> controlsListeners.remove(safeListener);
        }

        private Runnable subscribeMapSurface(Consumer<DungeonEditorMapSurfaceSnapshot> listener) {
            Consumer<DungeonEditorMapSurfaceSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
            mapSurfaceListeners.add(safeListener);
            return () -> mapSurfaceListeners.remove(safeListener);
        }

        private Runnable subscribeState(Consumer<DungeonEditorStateSnapshot> listener) {
            Consumer<DungeonEditorStateSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
            stateListeners.add(safeListener);
            return () -> stateListeners.remove(safeListener);
        }
    }
}
