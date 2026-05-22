package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.SortedSet;
import java.util.TreeSet;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import shell.api.ServiceRegistry;
import src.domain.dungeon.model.map.model.DungeonAreaFacts;
import src.domain.dungeon.model.map.model.DungeonAreaType;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonDerivedState;
import src.domain.dungeon.model.map.model.DungeonEdge;
import src.domain.dungeon.model.map.model.DungeonEditorHandle;
import src.domain.dungeon.model.map.model.DungeonEditorHandleFacts;
import src.domain.dungeon.model.map.model.DungeonMapFacts;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonState;
import src.domain.dungeon.model.map.model.DungeonTopology;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.model.map.model.DungeonTravelActionFacts;
import src.domain.dungeon.model.map.model.DungeonTravelExternalTargetFacts;
import src.domain.dungeon.model.map.model.DungeonTravelMoveFacts;
import src.domain.dungeon.model.map.model.DungeonTravelPositionFacts;
import src.domain.dungeon.model.map.model.DungeonTravelSurfaceFacts;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorCreateCorridorUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorCreateDoorUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorCreateWallUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorAuthoredOperationUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorDeleteCorridorUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorDeleteDoorUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorDeleteRoomUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorDeleteWallUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorPaintRoomUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorSelectionUseCase;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.model.editor.usecase.BuildDungeonEditorSnapshotUseCase;
import src.domain.dungeon.model.editor.usecase.CreateDungeonEditorMapCatalogUseCase;
import src.domain.dungeon.model.editor.usecase.CreateDungeonEditorMapUseCase;
import src.domain.dungeon.model.editor.usecase.DeleteDungeonEditorMapCatalogUseCase;
import src.domain.dungeon.model.editor.usecase.DeleteDungeonEditorMapUseCase;
import src.domain.dungeon.model.editor.usecase.DungeonEditorSnapshotPublication;
import src.domain.dungeon.model.editor.usecase.InterpretDungeonEditorMainViewInputUseCase;
import src.domain.dungeon.model.editor.usecase.LoadDungeonEditorAuthoredMapUseCase;
import src.domain.dungeon.model.editor.usecase.PreviewDungeonEditorAuthoredOperationUseCase;
import src.domain.dungeon.model.editor.usecase.PublishDungeonEditorAuthoredInspectorUseCase;
import src.domain.dungeon.model.editor.usecase.PublishDungeonEditorAuthoredMutationUseCase;
import src.domain.dungeon.model.editor.usecase.PublishDungeonEditorAuthoredSnapshotUseCase;
import src.domain.dungeon.model.editor.usecase.PublishDungeonEditorSnapshotUseCase;
import src.domain.dungeon.model.editor.usecase.RenameDungeonEditorMapCatalogUseCase;
import src.domain.dungeon.model.editor.usecase.RenameDungeonEditorMapUseCase;
import src.domain.dungeon.model.editor.usecase.SaveDungeonEditorAuthoredRoomNarrationUseCase;
import src.domain.dungeon.model.editor.usecase.SaveDungeonEditorRoomNarrationUseCase;
import src.domain.dungeon.model.editor.usecase.SearchDungeonEditorMapCatalogUseCase;
import src.domain.dungeon.model.editor.usecase.SelectDungeonEditorMapUseCase;
import src.domain.dungeon.model.editor.usecase.SetDungeonEditorOverlayUseCase;
import src.domain.dungeon.model.editor.usecase.SetDungeonEditorToolUseCase;
import src.domain.dungeon.model.editor.usecase.SetDungeonEditorViewModeUseCase;
import src.domain.dungeon.model.editor.usecase.ShiftDungeonEditorProjectionLevelUseCase;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.map.repository.DungeonMapRepository;
import src.domain.dungeon.model.map.usecase.AssembleDungeonSnapshotUseCase;
import src.domain.dungeon.model.map.usecase.ApplyDungeonAuthoredMutationUseCase;
import src.domain.dungeon.model.map.usecase.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.model.map.usecase.ApplyDungeonMapCatalogUseCase;
import src.domain.dungeon.model.map.usecase.BuildDungeonDerivedStateUseCase;
import src.domain.dungeon.model.map.usecase.CreateDungeonMapUseCase;
import src.domain.dungeon.model.map.usecase.DeleteDungeonMapUseCase;
import src.domain.dungeon.model.map.usecase.InspectDungeonSelectionUseCase;
import src.domain.dungeon.model.map.usecase.LoadDungeonMapUseCase;
import src.domain.dungeon.model.map.usecase.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.model.map.usecase.PublishDungeonEditorHandlesUseCase;
import src.domain.dungeon.model.map.usecase.RenameDungeonMapUseCase;
import src.domain.dungeon.model.map.usecase.PublishDungeonMapCatalogCreateUseCase;
import src.domain.dungeon.model.map.usecase.PublishDungeonMapCatalogDeleteUseCase;
import src.domain.dungeon.model.map.usecase.PublishDungeonMapCatalogRenameUseCase;
import src.domain.dungeon.model.map.usecase.PublishDungeonMapCatalogSearchUseCase;
import src.domain.dungeon.model.map.usecase.SearchDungeonMapsUseCase;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSnapshot.SnapshotData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.AvailableAction;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.AreaData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.BoundaryData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.FeatureData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.MapData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.TravelOverlayState;
import src.domain.dungeon.model.travel.repository.TravelDungeonSessionPublishedStateRepository;
import src.domain.dungeon.model.travel.repository.TravelDungeonSessionRepository;
import src.domain.dungeon.model.travel.usecase.ApplyTravelDungeonSessionUseCase;
import src.domain.dungeon.model.travel.usecase.LoadDungeonTravelSurfaceUseCase;
import src.domain.dungeon.model.travel.usecase.MoveDungeonTravelActionUseCase;
import src.domain.dungeon.model.travel.usecase.PublishTravelDungeonSessionUseCase;
import src.domain.dungeon.model.travel.usecase.PublishDungeonTravelMoveUseCase;
import src.domain.dungeon.model.travel.usecase.PublishDungeonTravelSurfaceUseCase;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonAuthoredMutationModel;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadModel;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorStateModel;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorSurface;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapCatalogModel;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapMode;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTopologyElementKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeon.published.DungeonTravelActionKind;
import src.domain.dungeon.published.DungeonTravelActionSnapshot;
import src.domain.dungeon.published.DungeonTravelContextKind;
import src.domain.dungeon.published.DungeonTravelExternalTarget;
import src.domain.dungeon.published.DungeonTravelHeading;
import src.domain.dungeon.published.DungeonTravelLocationKind;
import src.domain.dungeon.published.DungeonTravelMoveResult;
import src.domain.dungeon.published.DungeonTravelMoveStatus;
import src.domain.dungeon.published.DungeonTravelModel;
import src.domain.dungeon.published.DungeonTravelPosition;
import src.domain.dungeon.published.DungeonTravelResponse;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;
import src.domain.dungeon.published.TravelDungeonModel;
import src.domain.dungeon.published.TravelDungeonAction;
import src.domain.dungeon.published.TravelDungeonSnapshot;
import src.domain.dungeon.published.TravelDungeonWorkspaceState;

final class DungeonServiceAssembly {

    private final PublishedState editorPublishedState = new PublishedState();
    private final java.util.concurrent.atomic.AtomicReference<DungeonPublishedState> authoredPublishedState =
            new java.util.concurrent.atomic.AtomicReference<>();
    private final java.util.concurrent.atomic.AtomicReference<TravelRuntimeComponent> travelRuntime =
            new java.util.concurrent.atomic.AtomicReference<>();

    DungeonCatalogApplicationService createCatalogApplicationService(ServiceRegistry registry) {
        DungeonPublishedState publishedState = authoredPublishedState(registry);
        DungeonMapRepository repository = registry.require(DungeonMapRepository.class);
        return new DungeonCatalogApplicationService(
                new PublishDungeonMapCatalogSearchUseCase(new SearchDungeonMapsUseCase(repository), publishedState),
                new PublishDungeonMapCatalogCreateUseCase(new CreateDungeonMapUseCase(repository), publishedState),
                new PublishDungeonMapCatalogRenameUseCase(new RenameDungeonMapUseCase(repository), publishedState),
                new PublishDungeonMapCatalogDeleteUseCase(new DeleteDungeonMapUseCase(repository), publishedState));
    }

    DungeonTravelApplicationService createTravelApplicationService(ServiceRegistry registry) {
        DungeonPublishedState publishedState = authoredPublishedState(registry);
        LoadDungeonMapUseCase loadDungeonMapUseCase = loadDungeonMapUseCase(registry);
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        return new DungeonTravelApplicationService(
                new PublishDungeonTravelSurfaceUseCase(
                        new LoadDungeonTravelSurfaceUseCase(loadDungeonMapUseCase, derive),
                        publishedState),
                new PublishDungeonTravelMoveUseCase(
                        new MoveDungeonTravelActionUseCase(
                        loadDungeonMapUseCase,
                        registry.require(DungeonMapRepository.class),
                        derive),
                        publishedState));
    }

    DungeonTravelRuntimeApplicationService createTravelRuntimeApplicationService(ServiceRegistry registry) {
        return travelRuntimeComponent(registry).service();
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
        return travelRuntimeComponent(registry).travelModel();
    }

    DungeonEditorApplicationService createEditorApplicationService(ServiceRegistry registry) {
        ServiceRegistry services = Objects.requireNonNull(registry, "registry");
        DungeonPublishedState publishedState = authoredPublishedState(services);
        DungeonEditorDungeonState dungeonState = new DungeonEditorDungeonState();
        ApplyDungeonMapCatalogUseCase catalogUseCase = mapCatalogUseCase(services);
        LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase = loadDungeonSnapshotUseCase(services);
        ApplyDungeonAuthoredMutationUseCase mutationUseCase = authoredMutationUseCase(services);
        SearchDungeonEditorMapCatalogUseCase searchMapsUseCase =
                new SearchDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, dungeonState);
        CreateDungeonEditorMapCatalogUseCase createMapUseCase =
                new CreateDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, dungeonState);
        RenameDungeonEditorMapCatalogUseCase renameMapUseCase =
                new RenameDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, dungeonState);
        DeleteDungeonEditorMapCatalogUseCase deleteMapUseCase =
                new DeleteDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, dungeonState);
        PublishDungeonEditorAuthoredSnapshotUseCase publishAuthoredSnapshotUseCase =
                new PublishDungeonEditorAuthoredSnapshotUseCase(
                        publishedState,
                        dungeonState);
        PublishDungeonEditorAuthoredInspectorUseCase publishAuthoredInspectorUseCase =
                new PublishDungeonEditorAuthoredInspectorUseCase(publishedState, dungeonState);
        PublishDungeonEditorAuthoredMutationUseCase publishAuthoredMutationUseCase =
                new PublishDungeonEditorAuthoredMutationUseCase(
                        publishedState,
                        dungeonState);
        LoadDungeonEditorAuthoredMapUseCase loadMapUseCase =
                new LoadDungeonEditorAuthoredMapUseCase(
                        loadDungeonSnapshotUseCase,
                        publishAuthoredSnapshotUseCase,
                        publishAuthoredInspectorUseCase);
        PreviewDungeonEditorAuthoredOperationUseCase previewOperationUseCase =
                new PreviewDungeonEditorAuthoredOperationUseCase(
                        mutationUseCase,
                        publishAuthoredMutationUseCase);
        ApplyDungeonEditorAuthoredOperationUseCase applyOperationUseCase =
                new ApplyDungeonEditorAuthoredOperationUseCase(
                        mutationUseCase,
                        publishAuthoredMutationUseCase);
        SaveDungeonEditorAuthoredRoomNarrationUseCase saveRoomNarrationUseCase =
                new SaveDungeonEditorAuthoredRoomNarrationUseCase(mutationUseCase, publishAuthoredMutationUseCase);
        DungeonEditorSessionWorkflow workflow = new DungeonEditorSessionWorkflow();
        BuildDungeonEditorSnapshotUseCase snapshotBuilder = new BuildDungeonEditorSnapshotUseCase(
                searchMapsUseCase,
                loadMapUseCase,
                previewOperationUseCase,
                dungeonState);
        InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter =
                new InterpretDungeonEditorMainViewInputUseCase();
        PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase =
                new PublishDungeonEditorSnapshotUseCase(editorPublishedState);
        ApplyDungeonEditorSessionEffectUseCase effectUseCase = new ApplyDungeonEditorSessionEffectUseCase(
                workflow,
                applyOperationUseCase,
                dungeonState,
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
                        createMapUseCase,
                        dungeonState,
                        snapshotBuilder,
                        mainViewInterpreter,
                        snapshotPublicationUseCase),
                new RenameDungeonEditorMapUseCase(
                        workflow,
                        renameMapUseCase,
                        dungeonState,
                        snapshotBuilder,
                        snapshotPublicationUseCase),
                new DeleteDungeonEditorMapUseCase(
                        workflow,
                        deleteMapUseCase,
                        dungeonState,
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
                new SaveDungeonEditorRoomNarrationUseCase(workflow, saveRoomNarrationUseCase, effectUseCase));
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

    private DungeonPublishedState authoredPublishedState(ServiceRegistry registry) {
        DungeonPublishedState existing = authoredPublishedState.get();
        if (existing != null) {
            return existing;
        }
        Objects.requireNonNull(registry, "registry");
        DungeonPublishedState candidate = new DungeonPublishedState();
        return authoredPublishedState.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(authoredPublishedState.get(), "authoredPublishedState");
    }

    private static LoadDungeonMapUseCase loadDungeonMapUseCase(ServiceRegistry registry) {
        return new LoadDungeonMapUseCase(registry.require(DungeonMapRepository.class));
    }

    private static ApplyDungeonMapCatalogUseCase mapCatalogUseCase(ServiceRegistry registry) {
        DungeonMapRepository repository = registry.require(DungeonMapRepository.class);
        return new ApplyDungeonMapCatalogUseCase(
                new SearchDungeonMapsUseCase(repository),
                new CreateDungeonMapUseCase(repository),
                new RenameDungeonMapUseCase(repository),
                new DeleteDungeonMapUseCase(repository));
    }

    private static LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase(ServiceRegistry registry) {
        LoadDungeonMapUseCase loadDungeonMapUseCase = loadDungeonMapUseCase(registry);
        PublishDungeonEditorHandlesUseCase publishDungeonEditorHandlesUseCase = new PublishDungeonEditorHandlesUseCase();
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        AssembleDungeonSnapshotUseCase assembleDungeonSnapshotUseCase = new AssembleDungeonSnapshotUseCase(derive);
        InspectDungeonSelectionUseCase inspectDungeonSelectionUseCase = new InspectDungeonSelectionUseCase(derive);
        return new LoadDungeonSnapshotUseCase(
                loadDungeonMapUseCase,
                assembleDungeonSnapshotUseCase,
                publishDungeonEditorHandlesUseCase,
                inspectDungeonSelectionUseCase);
    }

    private static ApplyDungeonAuthoredMutationUseCase authoredMutationUseCase(ServiceRegistry registry) {
        LoadDungeonMapUseCase loadDungeonMapUseCase = loadDungeonMapUseCase(registry);
        PublishDungeonEditorHandlesUseCase publishDungeonEditorHandlesUseCase = new PublishDungeonEditorHandlesUseCase();
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        AssembleDungeonSnapshotUseCase assembleDungeonSnapshotUseCase = new AssembleDungeonSnapshotUseCase(derive);
        return new ApplyDungeonAuthoredMutationUseCase(new ApplyDungeonEditorOperationUseCase(
                loadDungeonMapUseCase,
                registry.require(DungeonMapRepository.class),
                derive,
                assembleDungeonSnapshotUseCase,
                publishDungeonEditorHandlesUseCase));
    }

    private TravelRuntimeComponent travelRuntimeComponent(ServiceRegistry registry) {
        TravelRuntimeComponent existing = travelRuntime.get();
        if (existing != null) {
            return existing;
        }
        Objects.requireNonNull(registry, "registry");
        ApplyTravelDungeonSessionUseCase applyUseCase = new ApplyTravelDungeonSessionUseCase(
                travelDungeonSessionRuntimeAccess(registry));
        TravelRuntimeComponent.PublishedState publishedState = new TravelRuntimeComponent.PublishedState();
        publishedState.publishCurrentSession(applyUseCase.snapshot());
        PublishTravelDungeonSessionUseCase publishUseCase =
                new PublishTravelDungeonSessionUseCase(applyUseCase, publishedState);
        TravelRuntimeComponent candidate = new TravelRuntimeComponent(
                new DungeonTravelRuntimeApplicationService(publishUseCase),
                publishedState.travelModel());
        return travelRuntime.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(travelRuntime.get(), "travelRuntime");
    }

    private static TravelDungeonSessionRepository travelDungeonSessionRuntimeAccess(ServiceRegistry registry) {
        return registry.require(TravelDungeonSessionRepository.class);
    }

    private record TravelRuntimeComponent(
            DungeonTravelRuntimeApplicationService service,
            TravelDungeonModel travelModel
    ) {

        private static final class PublishedState implements TravelDungeonSessionPublishedStateRepository {

            private final List<Consumer<TravelDungeonSnapshot>> listeners = new ArrayList<>();
            private final TravelDungeonModel travelModel = new TravelDungeonModel(this::currentSnapshot, this::subscribe);
            private TravelDungeonSnapshot currentSnapshot = TravelDungeonSnapshot.empty();

            private TravelDungeonModel travelModel() {
                return travelModel;
            }

            @Override
            public void publishCurrentSession(SnapshotData snapshot) {
                currentSnapshot = toPublishedSnapshot(snapshot);
                for (Consumer<TravelDungeonSnapshot> listener : List.copyOf(listeners)) {
                    listener.accept(currentSnapshot);
                }
            }

            private TravelDungeonSnapshot currentSnapshot() {
                return currentSnapshot;
            }

            private Runnable subscribe(Consumer<TravelDungeonSnapshot> listener) {
                Consumer<TravelDungeonSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
                listeners.add(safeListener);
                return () -> listeners.remove(safeListener);
            }

            private static TravelDungeonSnapshot toPublishedSnapshot(SnapshotData snapshot) {
                if (snapshot == null) {
                    return TravelDungeonSnapshot.empty();
                }
                SurfaceData surface = snapshot.surface();
                return new TravelDungeonSnapshot(
                        workspaceState(surface),
                        surfaceSnapshot(surface),
                        overlaySettings(snapshot.overlayState()),
                        snapshot.projectionLevel());
            }

            private static DungeonOverlaySettings overlaySettings(TravelOverlayState overlayState) {
                TravelOverlayState safeOverlay = overlayState == null
                        ? TravelOverlayState.defaults()
                        : overlayState;
                return new DungeonOverlaySettings(
                        safeOverlay.modeKey(),
                        safeOverlay.levelRange(),
                        safeOverlay.opacity(),
                        safeOverlay.selectedLevels());
            }

            private static TravelDungeonWorkspaceState workspaceState(SurfaceData surface) {
                if (surface == null) {
                    return null;
                }
                return new TravelDungeonWorkspaceState(
                        surface.mapName(),
                        surface.areaLabel(),
                        surface.tileLabel(),
                        surface.headingLabel(),
                        surface.statusLabel(),
                        surface.contextKind().isOverworld(),
                        surface.actions().stream().map(PublishedState::workspaceAction).toList());
            }

            private static DungeonTravelSurfaceSnapshot surfaceSnapshot(SurfaceData surface) {
                if (surface == null) {
                    return null;
                }
                return new DungeonTravelSurfaceSnapshot(
                        DungeonTravelContextKind.valueOf(surface.contextKind().name()),
                        surface.mapName(),
                        surface.revision(),
                        travelMapSnapshot(surface.map()),
                        travelPosition(surface.position()),
                        surface.surfaceTitle(),
                        surface.areaLabel(),
                        surface.tileLabel(),
                        surface.headingLabel(),
                        surface.statusLabel(),
                        surface.visualDescription(),
                        surface.actions().stream().map(PublishedState::surfaceAction).toList());
            }

            private static DungeonMapSnapshot travelMapSnapshot(MapData map) {
                MapData safeMap = map == null ? MapData.empty() : map;
                return new DungeonMapSnapshot(
                        DungeonTopologyKind.valueOf(safeMap.topology().name()),
                        safeMap.width(),
                        safeMap.height(),
                        safeMap.areas().stream().map(PublishedState::area).toList(),
                        safeMap.boundaries().stream().map(PublishedState::boundary).toList(),
                        safeMap.features().stream().map(PublishedState::feature).toList());
            }

            private static DungeonAreaSnapshot area(AreaData area) {
                return new DungeonAreaSnapshot(
                        DungeonAreaKind.valueOf(area.kind().name()),
                        area.id(),
                        area.label(),
                        area.cells().stream().map(PublishedState::cell).toList());
            }

            private static DungeonBoundarySnapshot boundary(BoundaryData boundary) {
                return new DungeonBoundarySnapshot(
                        boundary.doorBoundary() ? "door" : "wall",
                        boundary.id(),
                        boundary.label(),
                        new DungeonEdgeRef(cell(boundary.edge().from()), cell(boundary.edge().to())));
            }

            private static DungeonFeatureSnapshot feature(FeatureData feature) {
                return new DungeonFeatureSnapshot(
                        DungeonFeatureKind.valueOf(feature.kind().name()),
                        feature.id(),
                        feature.label(),
                        feature.cells().stream().map(PublishedState::cell).toList(),
                        feature.description(),
                        feature.destinationLabel());
            }

            private static DungeonCellRef cell(DungeonCell cell) {
                DungeonCell safeCell = cell == null ? new DungeonCell(0, 0, 0) : cell;
                return new DungeonCellRef(safeCell.q(), safeCell.r(), safeCell.level());
            }

            private static DungeonTravelPosition travelPosition(PositionData position) {
                if (position == null) {
                    return new DungeonTravelPosition(
                            new DungeonMapId(1L),
                            DungeonTravelLocationKind.TILE,
                            0L,
                            new DungeonCellRef(0, 0, 0),
                            DungeonTravelHeading.defaultHeading());
                }
                return new DungeonTravelPosition(
                        new DungeonMapId(position.mapId()),
                        DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                        position.ownerId(),
                        cell(position.tile()),
                        DungeonTravelHeading.valueOf(position.headingToken()));
            }

            private static DungeonTravelActionSnapshot surfaceAction(AvailableAction action) {
                return new DungeonTravelActionSnapshot(
                        action.id(),
                        DungeonTravelActionKind.TRAVERSAL,
                        action.displayLabel(),
                        "",
                        action.helpText());
            }

            private static TravelDungeonAction workspaceAction(AvailableAction action) {
                return new TravelDungeonAction(
                        action.id(),
                        action.displayLabel(),
                        action.helpText());
            }
        }
    }

    private static final class DungeonPublishedState implements DungeonAuthoredPublishedStateRepository {

        private static final String DEFAULT_DUNGEON_NAME = "Dungeon";

        private final PublishedChannel<DungeonAuthoredReadResult> authoredRead =
                new PublishedChannel<>(defaultAuthoredRead());
        private final PublishedChannel<DungeonAuthoredMutationResult> authoredMutation =
                new PublishedChannel<>(defaultAuthoredMutation());
        private final PublishedChannel<DungeonMapCatalogResponse> mapCatalog =
                new PublishedChannel<>(new DungeonMapCatalogResponse.MapList(List.of()));
        private final PublishedChannel<DungeonTravelResponse> travel =
                new PublishedChannel<>(defaultTravel());
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

        private DungeonAuthoredReadModel authoredReadModel() {
            return authoredReadModel;
        }

        private DungeonAuthoredMutationModel authoredMutationModel() {
            return authoredMutationModel;
        }

        private DungeonMapCatalogModel mapCatalogModel() {
            return mapCatalogModel;
        }

        private DungeonTravelModel travelModel() {
            return travelModel;
        }

        @Override
        public void publishSnapshot(DungeonAuthoredPublishedStateRepository.SnapshotPublication snapshot) {
            if (snapshot != null) {
                authoredRead.publish(new DungeonAuthoredReadResult.CommittedSnapshot(dungeonSnapshot(snapshot)));
            }
        }

        @Override
        public void publishInspector(DungeonAuthoredPublishedStateRepository.InspectorPublication inspector) {
            if (inspector != null) {
                authoredRead.publish(new DungeonAuthoredReadResult.SelectionInspector(new DungeonInspectorSnapshot(
                        inspector.title(),
                        inspector.description(),
                        inspector.facts(),
                        roomNarrations(inspector))));
            }
        }

        @Override
        public void publishMutation(DungeonAuthoredPublishedStateRepository.MutationPublication result) {
            if (result != null) {
                authoredMutation.publish(new DungeonAuthoredMutationResult.Operation(new DungeonOperationResult(
                        dungeonSnapshot(result.snapshot()),
                        result.validationMessages(),
                        result.reactionMessages())));
            }
        }

        @Override
        public void publishSearch(DungeonAuthoredPublishedStateRepository.CatalogPublication result) {
            mapCatalog.publish(new DungeonMapCatalogResponse.MapList(summaries(result)));
        }

        @Override
        public void publishCreated(DungeonAuthoredPublishedStateRepository.MapMutationPublication mutation) {
            mapCatalog.publish(mapMutation(DungeonMapCatalogResponse.MutationKind.CREATED, mutation.mapId()));
        }

        @Override
        public void publishRenamed(DungeonAuthoredPublishedStateRepository.MapMutationPublication mutation) {
            mapCatalog.publish(mapMutation(DungeonMapCatalogResponse.MutationKind.RENAMED, mutation.mapId()));
        }

        @Override
        public void publishDeleted(DungeonAuthoredPublishedStateRepository.MapMutationPublication mutation) {
            mapCatalog.publish(mapMutation(DungeonMapCatalogResponse.MutationKind.DELETED, mutation.mapId()));
        }

        @Override
        public void publishSurface(DungeonTravelSurfaceFacts surface) {
            if (surface != null) {
                travel.publish(new DungeonTravelResponse.Surface(surfaceSnapshot(surface)));
            }
        }

        @Override
        public void publishMove(DungeonTravelMoveFacts move) {
            if (move != null) {
                travel.publish(new DungeonTravelResponse.Move(new DungeonTravelMoveResult(
                        DungeonTravelMoveStatus.valueOf(move.status().name()),
                        move.message(),
                        surfaceSnapshot(move.surface()),
                        externalTarget(move.externalTarget()))));
            }
        }

        private static DungeonAuthoredReadResult defaultAuthoredRead() {
            return new DungeonAuthoredReadResult.CommittedSnapshot(defaultSnapshot());
        }

        private static DungeonAuthoredMutationResult defaultAuthoredMutation() {
            return new DungeonAuthoredMutationResult.Operation(new DungeonOperationResult(
                    defaultSnapshot(),
                    List.of(),
                    List.of()));
        }

        private static DungeonTravelResponse defaultTravel() {
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

        private static DungeonSnapshot defaultSnapshot() {
            return new DungeonSnapshot(
                    DEFAULT_DUNGEON_NAME,
                    DungeonMapMode.EDITOR,
                    DungeonMapSnapshot.empty(),
                    List.of(),
                    List.of(),
                    0);
        }

        private static DungeonMapCatalogResponse mapMutation(
                DungeonMapCatalogResponse.MutationKind kind,
                DungeonMapIdentity mapId
        ) {
            return new DungeonMapCatalogResponse.MapMutation(kind, id(mapId));
        }

        private static List<DungeonMapSummary> summaries(
                DungeonAuthoredPublishedStateRepository.CatalogPublication result
        ) {
            List<DungeonMapSummary> summaries = new ArrayList<>();
            for (DungeonAuthoredPublishedStateRepository.MapSummaryPublication map :
                    result == null
                            ? List.<DungeonAuthoredPublishedStateRepository.MapSummaryPublication>of()
                            : result.maps()) {
                summaries.add(summary(map));
            }
            return List.copyOf(summaries);
        }

        private static DungeonMapSummary summary(DungeonAuthoredPublishedStateRepository.MapSummaryPublication map) {
            return new DungeonMapSummary(id(map.mapId()), map.mapName(), revision(map.revision()));
        }

        private static List<DungeonInspectorSnapshot.RoomNarrationCard> roomNarrations(
                DungeonAuthoredPublishedStateRepository.InspectorPublication snapshot
        ) {
            List<DungeonInspectorSnapshot.RoomNarrationCard> roomNarrations = new ArrayList<>();
            for (DungeonAuthoredPublishedStateRepository.RoomNarrationPublication roomNarration :
                    snapshot.roomNarrations()) {
                roomNarrations.add(roomNarration(roomNarration));
            }
            return List.copyOf(roomNarrations);
        }

        private static DungeonInspectorSnapshot.RoomNarrationCard roomNarration(
                DungeonAuthoredPublishedStateRepository.RoomNarrationPublication roomNarration
        ) {
            return new DungeonInspectorSnapshot.RoomNarrationCard(
                    roomNarration.roomId(),
                    roomNarration.roomName(),
                    roomNarration.visualDescription(),
                    recordRoomExits(roomNarration.exits()));
        }

        private static List<DungeonInspectorSnapshot.RoomExitNarration> recordRoomExits(
                List<DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication> exits
        ) {
            List<DungeonInspectorSnapshot.RoomExitNarration> result = new ArrayList<>();
            for (DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication exit : exits) {
                result.add(new DungeonInspectorSnapshot.RoomExitNarration(
                        exit.label(),
                        cell(exit.cell()),
                        exit.direction().name(),
                        exit.description()));
            }
            return List.copyOf(result);
        }

        private static DungeonSnapshot dungeonSnapshot(
                DungeonAuthoredPublishedStateRepository.@Nullable SnapshotPublication snapshot
        ) {
            if (snapshot == null) {
                return defaultSnapshot();
            }
            DungeonDerivedState derived = snapshot.derived();
            return new DungeonSnapshot(
                    snapshot.mapName(),
                    DungeonMapMode.EDITOR,
                    mapSnapshot(derived.map(), snapshot.editorHandles()),
                    derived.aggregates().stream().map(DungeonPublishedState::aggregateSummary).toList(),
                    derived.relations().summaries(),
                    revision(snapshot.revision()));
        }

        private static String aggregateSummary(DungeonState aggregate) {
            return aggregate.label() + " #" + aggregate.id();
        }

        private static DungeonMapSnapshot mapSnapshot(
                DungeonMapFacts facts,
                List<DungeonEditorHandleFacts> handles
        ) {
            DungeonMapFacts safeFacts = facts == null
                    ? new DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, List.of(), List.of())
                    : facts;
            List<DungeonEditorHandleFacts> safeHandles = handles == null ? List.of() : List.copyOf(handles);
            return new DungeonMapSnapshot(
                    topology(safeFacts),
                    safeFacts.width(),
                    safeFacts.height(),
                    safeFacts.areas().stream().map(DungeonPublishedState::area).toList(),
                    safeFacts.boundaries().stream().map(boundary -> new DungeonBoundarySnapshot(
                            boundary.kind(),
                            boundary.id(),
                            boundary.label(),
                            edge(boundary.edge()),
                            topologyRef(boundary.topologyRef()))).toList(),
                    safeFacts.features().stream().map(feature -> new DungeonFeatureSnapshot(
                            DungeonFeatureKind.valueOf(feature.kind().name()),
                            feature.id(),
                            feature.label(),
                            feature.cells().stream().map(DungeonPublishedState::cell).toList(),
                            feature.description(),
                            feature.destinationLabel(),
                            topologyRef(feature.topologyRef()))).toList(),
                    safeHandles.stream().map(DungeonPublishedState::handle).toList());
        }

        private static DungeonTopologyKind topology(DungeonMapFacts facts) {
            return facts.topology() == DungeonTopology.HEX ? DungeonTopologyKind.HEX : DungeonTopologyKind.SQUARE;
        }

        private static DungeonAreaSnapshot area(DungeonAreaFacts area) {
            return new DungeonAreaSnapshot(
                    area.kind() == DungeonAreaType.CORRIDOR ? DungeonAreaKind.CORRIDOR : DungeonAreaKind.ROOM,
                    area.id(),
                    area.clusterId(),
                    area.label(),
                    area.cells().stream().map(DungeonPublishedState::cell).toList(),
                    topologyRef(area.topologyRef()));
        }

        private static DungeonEditorHandleSnapshot handle(DungeonEditorHandleFacts handle) {
            return new DungeonEditorHandleSnapshot(
                    handleRef(handle.handle()),
                    handle.label(),
                    cell(handle.handle().cell()));
        }

        private static DungeonEditorHandleRef handleRef(DungeonEditorHandle handle) {
            return new DungeonEditorHandleRef(
                    DungeonEditorHandleKind.valueOf(handle.type().name()),
                    topologyRef(handle.topologyRef()),
                    handle.ownerId(),
                    handle.clusterId(),
                    handle.corridorId(),
                    handle.roomId(),
                    handle.index(),
                    cell(handle.cell()),
                    handle.direction().name());
        }

        private static DungeonTravelSurfaceSnapshot surfaceSnapshot(DungeonTravelSurfaceFacts surface) {
            return new DungeonTravelSurfaceSnapshot(
                    DungeonTravelContextKind.DUNGEON,
                    surface.mapName(),
                    revision(surface.revision()),
                    mapSnapshot(surface.map(), List.of()),
                    travelPosition(surface.position()),
                    surface.surfaceTitle(),
                    surface.areaLabel(),
                    surface.tileLabel(),
                    surface.headingLabel(),
                    surface.statusLabel(),
                    surface.visualDescription(),
                    surface.actions().stream().map(DungeonPublishedState::travelAction).toList());
        }

        private static DungeonTravelActionSnapshot travelAction(DungeonTravelActionFacts action) {
            return new DungeonTravelActionSnapshot(
                    action.actionId(),
                    DungeonTravelActionKind.valueOf(action.kind().name()),
                    action.label(),
                    action.destinationLabel(),
                    action.description());
        }

        private static DungeonTravelPosition travelPosition(DungeonTravelPositionFacts position) {
            return new DungeonTravelPosition(
                    id(position.mapId()),
                    DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                    position.ownerId(),
                    cell(position.tile()),
                    DungeonTravelHeading.valueOf(position.heading().name()));
        }

        private static DungeonTravelExternalTarget externalTarget(DungeonTravelExternalTargetFacts target) {
            if (target != null && target.isOverworldTile()) {
                return new DungeonTravelExternalTarget.OverworldTile(target.mapId(), target.tileId());
            }
            return null;
        }

        private static DungeonMapId id(DungeonMapIdentity identity) {
            return new DungeonMapId(identity == null ? 1L : identity.value());
        }

        private static DungeonCellRef cell(DungeonCell cell) {
            DungeonCell safeCell = cell == null ? new DungeonCell(0, 0, 0) : cell;
            return new DungeonCellRef(safeCell.q(), safeCell.r(), safeCell.level());
        }

        private static DungeonEdgeRef edge(DungeonEdge edge) {
            if (edge == null) {
                return new DungeonEdgeRef(cell(null), cell(null));
            }
            return new DungeonEdgeRef(cell(edge.from()), cell(edge.to()));
        }

        private static DungeonTopologyElementRef topologyRef(DungeonTopologyRef ref) {
            if (ref == null) {
                return DungeonTopologyElementRef.empty();
            }
            return new DungeonTopologyElementRef(DungeonTopologyElementKind.valueOf(ref.kind().name()), ref.id());
        }

        private static int revision(long revision) {
            if (revision > Integer.MAX_VALUE) {
                return Integer.MAX_VALUE;
            }
            return Math.max(0, (int) revision);
        }

        private static final class PublishedChannel<T> {

            private static final String LISTENER_PARAMETER = "listener";

            private final List<Consumer<T>> listeners = new ArrayList<>();
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
            DungeonEditorSessionSnapshot.SnapshotData safeSnapshot =
                    snapshot == null ? DungeonEditorSessionSnapshot.SnapshotData.empty("") : snapshot;
            SurfaceContext surfaceContext = surfaceContext(safeSnapshot.surface(), safeSnapshot.projectionLevel());
            currentControls = toControlsSnapshot(safeSnapshot, surfaceContext);
            currentMapSurface = toMapSurfaceSnapshot(safeSnapshot, surfaceContext.surface());
            currentState = toStateSnapshot(safeSnapshot, surfaceContext.surface());
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

        private static SurfaceContext surfaceContext(
                DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
                int fallbackLevel
        ) {
            SortedSet<Integer> levels = new TreeSet<>();
            if (surface != null && surface.map() != null) {
                addWorkspaceMapLevels(levels, surface.map());
                if (surface.previewMap() != null) {
                    addWorkspaceMapLevels(levels, surface.previewMap());
                }
            }
            if (levels.isEmpty()) {
                levels.add(fallbackLevel);
            }
            return new SurfaceContext(toPublishedSurface(surface), new ArrayList<>(levels), surface != null);
        }

        private static void addWorkspaceMapLevels(
                SortedSet<Integer> levels,
                DungeonEditorWorkspaceValues.MapSnapshot map
        ) {
            for (DungeonEditorWorkspaceValues.Area area : map.areas()) {
                addWorkspaceCellLevels(levels, area.cells());
            }
            for (DungeonEditorWorkspaceValues.Feature feature : map.features()) {
                addWorkspaceCellLevels(levels, feature.cells());
            }
            for (DungeonEditorWorkspaceValues.Handle handle : map.editorHandles()) {
                levels.add(handle.cell().level());
            }
        }

        private static void addWorkspaceCellLevels(
                SortedSet<Integer> levels,
                List<DungeonEditorWorkspaceValues.Cell> cells
        ) {
            for (DungeonEditorWorkspaceValues.Cell cell
                    : cells == null ? List.<DungeonEditorWorkspaceValues.Cell>of() : cells) {
                levels.add(cell.level());
            }
        }

        private static DungeonEditorControlsSnapshot toControlsSnapshot(
                DungeonEditorSessionSnapshot.SnapshotData snapshot,
                SurfaceContext surfaceContext
        ) {
            return new DungeonEditorControlsSnapshot(
                    publishedMapSummaries(snapshot.maps()),
                    toPublishedMapId(snapshot.selectedMapId()),
                    toPublishedViewMode(snapshot.viewMode()),
                    toPublishedTool(snapshot.selectedTool()),
                    snapshot.projectionLevel(),
                    toPublishedOverlay(snapshot.overlaySettings()),
                    surfaceContext.reachableLevels(),
                    surfaceContext.surfacePresent(),
                    snapshot.statusText());
        }

        private static DungeonEditorMapSurfaceSnapshot toMapSurfaceSnapshot(
                DungeonEditorSessionSnapshot.SnapshotData snapshot,
                @Nullable DungeonEditorSurface surface
        ) {
            return new DungeonEditorMapSurfaceSnapshot(
                    surface,
                    toPublishedSelection(snapshot.selection()),
                    toPublishedPreview(snapshot.preview()),
                    toPublishedViewMode(snapshot.viewMode()),
                    toPublishedOverlay(snapshot.overlaySettings()),
                    snapshot.projectionLevel(),
                    toPublishedTool(snapshot.selectedTool()));
        }

        private static DungeonEditorStateSnapshot toStateSnapshot(
                DungeonEditorSessionSnapshot.SnapshotData snapshot,
                @Nullable DungeonEditorSurface surface
        ) {
            return new DungeonEditorStateSnapshot(
                    toPublishedSelection(snapshot.selection()),
                    surface == null ? null : surface.inspector(),
                    toPublishedPreview(snapshot.preview()),
                    snapshot.statusText(),
                    toPublishedViewMode(snapshot.viewMode()),
                    toPublishedTool(snapshot.selectedTool()),
                    toPublishedOverlay(snapshot.overlaySettings()),
                    snapshot.projectionLevel());
        }

        private static List<DungeonMapSummary> publishedMapSummaries(
                List<DungeonEditorWorkspaceValues.MapSummary> maps
        ) {
            List<DungeonMapSummary> result = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.MapSummary map
                    : maps == null ? List.<DungeonEditorWorkspaceValues.MapSummary>of() : maps) {
                result.add(toPublishedMapSummary(map));
            }
            return List.copyOf(result);
        }

        private static DungeonMapSummary toPublishedMapSummary(DungeonEditorWorkspaceValues.@Nullable MapSummary map) {
            DungeonEditorWorkspaceValues.MapSummary safeMap = map == null
                    ? new DungeonEditorWorkspaceValues.MapSummary(new DungeonEditorWorkspaceValues.MapId(1L), "Dungeon Map", 0L)
                    : map;
            return new DungeonMapSummary(
                    new DungeonMapId(safeMap.mapId().value()),
                    safeMap.mapName(),
                    safeMap.revision());
        }

        private static @Nullable DungeonMapId toPublishedMapId(DungeonEditorWorkspaceValues.@Nullable MapId mapId) {
            return mapId == null ? null : new DungeonMapId(mapId.value());
        }

        private static @Nullable DungeonEditorSurface toPublishedSurface(
                DungeonEditorSessionSnapshot.@Nullable SurfaceData surface
        ) {
            if (surface == null) {
                return null;
            }
            return new DungeonEditorSurface(
                    surface.mapName(),
                    surface.revision(),
                    toPublishedMap(surface.map()),
                    surface.previewMap() == null ? null : toPublishedMap(surface.previewMap()),
                    toPublishedInspector(surface.inspector()));
        }

        private static DungeonEditorMapSnapshot toPublishedMap(DungeonEditorWorkspaceValues.@Nullable MapSnapshot map) {
            DungeonEditorWorkspaceValues.MapSnapshot safeMap = map == null
                    ? DungeonEditorWorkspaceValues.MapSnapshot.empty()
                    : map;
            return new DungeonEditorMapSnapshot(
                    safeMap.topology().name(),
                    safeMap.width(),
                    safeMap.height(),
                    toPublishedAreas(safeMap.areas()),
                    toPublishedBoundaries(safeMap.boundaries()),
                    toPublishedFeatures(safeMap.features()),
                    toPublishedEditorHandles(safeMap.editorHandles()));
        }

        private static List<DungeonEditorMapSnapshot.Area> toPublishedAreas(
                List<DungeonEditorWorkspaceValues.Area> areas
        ) {
            List<DungeonEditorMapSnapshot.Area> result = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.Area area
                    : areas == null ? List.<DungeonEditorWorkspaceValues.Area>of() : areas) {
                result.add(toPublishedArea(area));
            }
            return List.copyOf(result);
        }

        private static DungeonEditorMapSnapshot.Area toPublishedArea(DungeonEditorWorkspaceValues.@Nullable Area area) {
            if (area == null) {
                return new DungeonEditorMapSnapshot.Area(
                        "ROOM",
                        1L,
                        0L,
                        "ROOM",
                        List.of(),
                        DungeonEditorTopologyElementRef.empty());
            }
            return new DungeonEditorMapSnapshot.Area(
                    area.kind().name(),
                    area.id(),
                    area.clusterId(),
                    area.label(),
                    toPublishedCells(area.cells()),
                    toPublishedTopologyRef(area.topologyRef()));
        }

        private static List<DungeonEditorMapSnapshot.Boundary> toPublishedBoundaries(
                List<DungeonEditorWorkspaceValues.Boundary> boundaries
        ) {
            List<DungeonEditorMapSnapshot.Boundary> result = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.Boundary boundary
                    : boundaries == null ? List.<DungeonEditorWorkspaceValues.Boundary>of() : boundaries) {
                result.add(toPublishedBoundary(boundary));
            }
            return List.copyOf(result);
        }

        private static DungeonEditorMapSnapshot.Boundary toPublishedBoundary(
                DungeonEditorWorkspaceValues.@Nullable Boundary boundary
        ) {
            if (boundary == null) {
                return new DungeonEditorMapSnapshot.Boundary(
                        "boundary",
                        1L,
                        "boundary",
                        new DungeonEdgeRef(new DungeonCellRef(0, 0, 0), new DungeonCellRef(0, 0, 0)),
                        DungeonEditorTopologyElementRef.empty());
            }
            return new DungeonEditorMapSnapshot.Boundary(
                    boundary.kind().externalKind(),
                    boundary.id(),
                    boundary.label(),
                    toPublishedEdge(boundary.edge()),
                    toPublishedTopologyRef(boundary.topologyRef()));
        }

        private static List<DungeonEditorMapSnapshot.Feature> toPublishedFeatures(
                List<DungeonEditorWorkspaceValues.Feature> features
        ) {
            List<DungeonEditorMapSnapshot.Feature> result = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.Feature feature
                    : features == null ? List.<DungeonEditorWorkspaceValues.Feature>of() : features) {
                result.add(toPublishedFeature(feature));
            }
            return List.copyOf(result);
        }

        private static DungeonEditorMapSnapshot.Feature toPublishedFeature(
                DungeonEditorWorkspaceValues.@Nullable Feature feature
        ) {
            if (feature == null) {
                return new DungeonEditorMapSnapshot.Feature(
                        "STAIR",
                        1L,
                        "STAIR",
                        List.of(),
                        "",
                        "",
                        DungeonEditorTopologyElementRef.empty());
            }
            return new DungeonEditorMapSnapshot.Feature(
                    feature.kind().name(),
                    feature.id(),
                    feature.label(),
                    toPublishedCells(feature.cells()),
                    feature.description(),
                    feature.destinationLabel(),
                    toPublishedTopologyRef(feature.topologyRef()));
        }

        private static List<DungeonEditorHandleSnapshot> toPublishedEditorHandles(
                List<DungeonEditorWorkspaceValues.Handle> handles
        ) {
            List<DungeonEditorHandleSnapshot> result = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.Handle handle
                    : handles == null ? List.<DungeonEditorWorkspaceValues.Handle>of() : handles) {
                result.add(toPublishedEditorHandle(handle));
            }
            return List.copyOf(result);
        }

        private static DungeonEditorHandleSnapshot toPublishedEditorHandle(
                DungeonEditorWorkspaceValues.@Nullable Handle handle
        ) {
            if (handle == null) {
                return new DungeonEditorHandleSnapshot(
                        DungeonEditorHandleRef.empty(),
                        "CLUSTER_LABEL",
                        new DungeonCellRef(0, 0, 0));
            }
            return new DungeonEditorHandleSnapshot(
                    toPublishedHandleRefOrEmpty(handle.ref()),
                    handle.label(),
                    toPublishedCell(handle.cell()));
        }

        private static List<DungeonCellRef> toPublishedCells(List<DungeonEditorWorkspaceValues.Cell> cells) {
            List<DungeonCellRef> result = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.Cell cell
                    : cells == null ? List.<DungeonEditorWorkspaceValues.Cell>of() : cells) {
                result.add(toPublishedCell(cell));
            }
            return List.copyOf(result);
        }

        private static @Nullable DungeonInspectorSnapshot toPublishedInspector(
                DungeonEditorWorkspaceValues.@Nullable Inspector inspector
        ) {
            if (inspector == null) {
                return null;
            }
            return new DungeonInspectorSnapshot(
                    inspector.title(),
                    inspector.summary(),
                    inspector.facts(),
                    toPublishedRoomNarrationCards(inspector.roomNarrations()));
        }

        private static List<DungeonInspectorSnapshot.RoomNarrationCard> toPublishedRoomNarrationCards(
                List<DungeonEditorWorkspaceValues.RoomNarrationCard> cards
        ) {
            List<DungeonInspectorSnapshot.RoomNarrationCard> result = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.RoomNarrationCard card
                    : cards == null ? List.<DungeonEditorWorkspaceValues.RoomNarrationCard>of() : cards) {
                result.add(toPublishedRoomNarrationCard(card));
            }
            return List.copyOf(result);
        }

        private static DungeonInspectorSnapshot.RoomNarrationCard toPublishedRoomNarrationCard(
                DungeonEditorWorkspaceValues.@Nullable RoomNarrationCard card
        ) {
            DungeonEditorWorkspaceValues.RoomNarrationCard safeCard = card == null
                    ? new DungeonEditorWorkspaceValues.RoomNarrationCard(0L, "Raum", "", List.of())
                    : card;
            return new DungeonInspectorSnapshot.RoomNarrationCard(
                    safeCard.roomId(),
                    safeCard.roomName(),
                    safeCard.visualDescription(),
                    toPublishedRoomExits(safeCard.exits()));
        }

        private static List<DungeonInspectorSnapshot.RoomExitNarration> toPublishedRoomExits(
                List<DungeonEditorWorkspaceValues.RoomExitNarration> exits
        ) {
            List<DungeonInspectorSnapshot.RoomExitNarration> result = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.RoomExitNarration exit
                    : exits == null ? List.<DungeonEditorWorkspaceValues.RoomExitNarration>of() : exits) {
                result.add(toPublishedRoomExit(exit));
            }
            return List.copyOf(result);
        }

        private static DungeonInspectorSnapshot.RoomExitNarration toPublishedRoomExit(
                DungeonEditorWorkspaceValues.@Nullable RoomExitNarration exit
        ) {
            DungeonEditorWorkspaceValues.RoomExitNarration safeExit = exit == null
                    ? new DungeonEditorWorkspaceValues.RoomExitNarration("", DungeonEditorWorkspaceValues.Cell.empty(), "", "")
                    : exit;
            return new DungeonInspectorSnapshot.RoomExitNarration(
                    safeExit.label(),
                    toPublishedCell(safeExit.cell()),
                    safeExit.direction(),
                    safeExit.description());
        }

        private static DungeonOverlaySettings toPublishedOverlay(
                DungeonEditorSessionValues.@Nullable OverlaySettings overlay
        ) {
            DungeonEditorSessionValues.OverlaySettings safeOverlay = overlay == null
                    ? DungeonEditorSessionValues.OverlaySettings.defaults()
                    : overlay;
            return new DungeonOverlaySettings(
                    safeOverlay.modeKey(),
                    safeOverlay.levelRange(),
                    safeOverlay.opacity(),
                    safeOverlay.selectedLevels());
        }

        private static DungeonEditorStateSnapshot.Selection toPublishedSelection(
                DungeonEditorSessionValues.@Nullable Selection selection
        ) {
            DungeonEditorSessionValues.Selection safeSelection = selection == null
                    ? DungeonEditorSessionValues.Selection.empty()
                    : selection;
            return new DungeonEditorStateSnapshot.Selection(
                    toPublishedTopologyRef(safeSelection.topologyRef()),
                    safeSelection.clusterId(),
                    safeSelection.clusterSelection(),
                    safeSelection.handleRef().equals(DungeonEditorSessionValues.emptyHandleRef())
                            ? null
                            : toPublishedHandleRefOrEmpty(safeSelection.handleRef()));
        }

        private static DungeonEditorPreview toPublishedPreview(DungeonEditorSessionValues.@Nullable Preview preview) {
            if (preview == null || preview == DungeonEditorSessionValues.Preview.none()) {
                return DungeonEditorPreview.none();
            }
            return switch (preview) {
                case DungeonEditorSessionValues.RoomRectanglePreview room ->
                        new DungeonEditorPreview.RoomRectanglePreview(
                                toPublishedCell(room.start()),
                                toPublishedCell(room.end()),
                                room.deleteMode());
                case DungeonEditorSessionValues.ClusterBoundariesPreview boundaries ->
                        new DungeonEditorPreview.ClusterBoundariesPreview(
                                boundaries.clusterId(),
                                toPublishedEdges(boundaries.edges()),
                                boundaries.boundaryKind().name(),
                                boundaries.deleteMode());
                case DungeonEditorSessionValues.MoveHandlePreview moveHandle ->
                        new DungeonEditorPreview.MoveHandlePreview(
                                toPublishedHandleRefOrEmpty(moveHandle.handleRef()),
                                moveHandle.deltaQ(),
                                moveHandle.deltaR(),
                                moveHandle.deltaLevel());
                case DungeonEditorSessionValues.MoveBoundaryStretchPreview stretch ->
                        new DungeonEditorPreview.MoveBoundaryStretchPreview(
                                stretch.clusterId(),
                                toPublishedEdges(stretch.sourceEdges()),
                                stretch.deltaQ(),
                                stretch.deltaR(),
                                stretch.deltaLevel());
                case DungeonEditorSessionValues.CorridorCreatePreview ignored -> DungeonEditorPreview.none();
                case DungeonEditorSessionValues.DeleteCorridorPreview ignored -> DungeonEditorPreview.none();
                case DungeonEditorSessionValues.NoPreview ignored -> DungeonEditorPreview.none();
            };
        }

        private static List<DungeonEdgeRef> toPublishedEdges(List<DungeonEditorWorkspaceValues.Edge> edges) {
            List<DungeonEdgeRef> result = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.Edge edge
                    : edges == null ? List.<DungeonEditorWorkspaceValues.Edge>of() : edges) {
                result.add(toPublishedEdge(edge));
            }
            return List.copyOf(result);
        }

        private static DungeonEditorViewMode toPublishedViewMode(DungeonEditorSessionValues.@Nullable ViewMode viewMode) {
            return viewMode == DungeonEditorSessionValues.ViewMode.GRAPH
                    ? DungeonEditorViewMode.GRAPH
                    : DungeonEditorViewMode.GRID;
        }

        private static DungeonEditorTool toPublishedTool(DungeonEditorSessionValues.@Nullable Tool tool) {
            return tool == null ? DungeonEditorTool.SELECT : DungeonEditorTool.valueOf(tool.name());
        }

        private static DungeonEditorHandleRef toPublishedHandleRefOrEmpty(
                DungeonEditorWorkspaceValues.@Nullable HandleRef handleRef
        ) {
            if (handleRef == null) {
                return DungeonEditorHandleRef.empty();
            }
            return new DungeonEditorHandleRef(
                    DungeonEditorHandleKind.valueOf(handleRef.kind().name()),
                    toDomainTopologyRef(handleRef.topologyRef()),
                    handleRef.ownerId(),
                    handleRef.clusterId(),
                    handleRef.corridorId(),
                    handleRef.roomId(),
                    handleRef.index(),
                    toPublishedCell(handleRef.cell()),
                    handleRef.direction());
        }

        private static DungeonTopologyElementRef toDomainTopologyRef(@Nullable DungeonTopologyRef ref) {
            return ref == null
                    ? DungeonTopologyElementRef.empty()
                    : new DungeonTopologyElementRef(DungeonTopologyElementKind.valueOf(ref.kind().name()), ref.id());
        }

        private static DungeonEditorTopologyElementRef toPublishedTopologyRef(@Nullable DungeonTopologyRef ref) {
            return ref == null
                    ? DungeonEditorTopologyElementRef.empty()
                    : new DungeonEditorTopologyElementRef(ref.kind().name(), ref.id());
        }

        private static DungeonCellRef toPublishedCell(DungeonEditorWorkspaceValues.@Nullable Cell mapCell) {
            return mapCell == null
                    ? new DungeonCellRef(0, 0, 0)
                    : new DungeonCellRef(mapCell.q(), mapCell.r(), mapCell.level());
        }

        private static DungeonEdgeRef toPublishedEdge(DungeonEditorWorkspaceValues.@Nullable Edge mapEdge) {
            if (mapEdge == null) {
                return new DungeonEdgeRef(new DungeonCellRef(0, 0, 0), new DungeonCellRef(0, 0, 0));
            }
            return new DungeonEdgeRef(toPublishedCell(mapEdge.from()), toPublishedCell(mapEdge.to()));
        }

        private record SurfaceContext(
                @Nullable DungeonEditorSurface surface,
                List<Integer> reachableLevels,
                boolean surfacePresent
        ) {
        }
    }
}
