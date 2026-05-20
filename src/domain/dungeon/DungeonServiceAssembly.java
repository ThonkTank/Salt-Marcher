package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
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
import src.domain.dungeon.model.map.usecase.RefreshDungeonAuthoredUseCase;
import src.domain.dungeon.model.map.usecase.RenameDungeonMapUseCase;
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
import src.domain.dungeon.model.travel.usecase.ApplyDungeonTravelUseCase;
import src.domain.dungeon.model.travel.usecase.ApplyTravelDungeonSessionUseCase;
import src.domain.dungeon.model.travel.usecase.LoadDungeonTravelSurfaceUseCase;
import src.domain.dungeon.model.travel.usecase.MoveDungeonTravelActionUseCase;
import src.domain.dungeon.model.travel.usecase.PublishTravelDungeonSessionUseCase;
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
import src.domain.dungeon.published.DungeonEditorStateModel;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
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

    DungeonAuthoredApplicationService createAuthoredApplicationService(ServiceRegistry registry) {
        DungeonPublishedState publishedState = authoredPublishedState(registry);
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
                new RefreshDungeonAuthoredUseCase(loadDungeonSnapshotUseCase),
                new ApplyDungeonAuthoredMutationUseCase(applyDungeonEditorOperationUseCase),
                publishedState);
    }

    DungeonCatalogApplicationService createCatalogApplicationService(ServiceRegistry registry) {
        DungeonPublishedState publishedState = authoredPublishedState(registry);
        DungeonMapRepository repository = registry.require(DungeonMapRepository.class);
        return new DungeonCatalogApplicationService(new ApplyDungeonMapCatalogUseCase(
                new SearchDungeonMapsUseCase(repository),
                new CreateDungeonMapUseCase(repository),
                new RenameDungeonMapUseCase(repository),
                new DeleteDungeonMapUseCase(repository)),
                publishedState);
    }

    DungeonTravelApplicationService createTravelApplicationService(ServiceRegistry registry) {
        DungeonPublishedState publishedState = authoredPublishedState(registry);
        LoadDungeonMapUseCase loadDungeonMapUseCase = loadDungeonMapUseCase(registry);
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        return new DungeonTravelApplicationService(new ApplyDungeonTravelUseCase(
                new LoadDungeonTravelSurfaceUseCase(loadDungeonMapUseCase, derive),
                new MoveDungeonTravelActionUseCase(loadDungeonMapUseCase, registry.require(DungeonMapRepository.class), derive)),
                publishedState);
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
        return travelRuntimeComponent(registry).assembly().travelModel();
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

    private TravelRuntimeComponent travelRuntimeComponent(ServiceRegistry registry) {
        TravelRuntimeComponent existing = travelRuntime.get();
        if (existing != null) {
            return existing;
        }
        Objects.requireNonNull(registry, "registry");
        TravelRuntimeAssembly assembly = new TravelRuntimeAssembly(
                registry.require(TravelDungeonSessionRepository.class));
        TravelRuntimeComponent candidate = new TravelRuntimeComponent(
                assembly.applicationService(),
                assembly);
        return travelRuntime.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(travelRuntime.get(), "travelRuntime");
    }

    private record TravelRuntimeComponent(
            DungeonTravelRuntimeApplicationService service,
            TravelRuntimeAssembly assembly
    ) {
    }

    private static final class TravelRuntimeAssembly {

        private final PublishTravelDungeonSessionUseCase publishUseCase;
        private final TravelDungeonModel travelModel;

        private TravelRuntimeAssembly(TravelDungeonSessionRepository repository) {
            ApplyTravelDungeonSessionUseCase applyUseCase =
                    new ApplyTravelDungeonSessionUseCase(Objects.requireNonNull(repository, "repository"));
            PublishedState publishedState = new PublishedState();
            publishedState.publishCurrentSession(applyUseCase.snapshot());
            publishUseCase = new PublishTravelDungeonSessionUseCase(applyUseCase, publishedState);
            travelModel = publishedState.travelModel();
        }

        private DungeonTravelRuntimeApplicationService applicationService() {
            return new DungeonTravelRuntimeApplicationService(publishUseCase);
        }

        private TravelDungeonModel travelModel() {
            return travelModel;
        }

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

    private static final class DungeonPublishedState implements
            DungeonAuthoredApplicationService.AuthoredPublication,
            DungeonCatalogApplicationService.CatalogPublication,
            DungeonTravelApplicationService.TravelPublication {

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
        public void publishSnapshot(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
            if (snapshot != null) {
                authoredRead.publish(new DungeonAuthoredReadResult.CommittedSnapshot(dungeonSnapshot(snapshot)));
            }
        }

        @Override
        public void publishInspector(LoadDungeonSnapshotUseCase.InspectorSnapshotData inspector) {
            if (inspector != null) {
                authoredRead.publish(new DungeonAuthoredReadResult.SelectionInspector(new DungeonInspectorSnapshot(
                        inspector.title(),
                        inspector.description(),
                        inspector.facts(),
                        roomNarrations(inspector))));
            }
        }

        @Override
        public void publishMutation(ApplyDungeonEditorOperationUseCase.OperationResultData result) {
            if (result != null) {
                authoredMutation.publish(new DungeonAuthoredMutationResult.Operation(new DungeonOperationResult(
                        dungeonSnapshot(result.snapshot()),
                        result.validationMessages(),
                        result.reactionMessages())));
            }
        }

        @Override
        public void publishSearch(ApplyDungeonMapCatalogUseCase.MapCatalogResult result) {
            mapCatalog.publish(new DungeonMapCatalogResponse.MapList(result == null
                    ? List.of()
                    : result.maps().stream().map(DungeonPublishedState::summary).toList()));
        }

        @Override
        public void publishCreated(DungeonMapIdentity mapId) {
            mapCatalog.publish(mapMutation(DungeonMapCatalogResponse.MutationKind.CREATED, mapId));
        }

        @Override
        public void publishRenamed(DungeonMapIdentity mapId) {
            mapCatalog.publish(mapMutation(DungeonMapCatalogResponse.MutationKind.RENAMED, mapId));
        }

        @Override
        public void publishDeleted(DungeonMapIdentity mapId) {
            mapCatalog.publish(mapMutation(DungeonMapCatalogResponse.MutationKind.DELETED, mapId));
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

        private static DungeonMapSummary summary(SearchDungeonMapsUseCase.MapSummary map) {
            return new DungeonMapSummary(id(map.mapId()), map.mapName(), revision(map.revision()));
        }

        private static List<DungeonInspectorSnapshot.RoomNarrationCard> roomNarrations(
                LoadDungeonSnapshotUseCase.InspectorSnapshotData snapshot
        ) {
            return snapshot.roomNarrations().stream()
                    .map(roomNarration -> new DungeonInspectorSnapshot.RoomNarrationCard(
                            roomNarration.roomId(),
                            roomNarration.roomName(),
                            roomNarration.visualDescription(),
                            roomNarration.exits().stream()
                                    .map(exit -> new DungeonInspectorSnapshot.RoomExitNarration(
                                            exit.label(),
                                            cell(exit.cell()),
                                            exit.direction().name(),
                                            exit.description()))
                                    .toList()))
                    .toList();
        }

        private static DungeonSnapshot dungeonSnapshot(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
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
