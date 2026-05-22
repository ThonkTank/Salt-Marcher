package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.SortedSet;
import java.util.TreeSet;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import shell.api.ServiceRegistry;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.map.model.DungeonAreaType;
import src.domain.dungeon.model.map.model.DungeonTopology;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonEditorSurface;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapId;

final class DungeonServiceAssembly {

    private final PublishedState editorPublishedState = new PublishedState();
    private final java.util.concurrent.atomic.AtomicReference<DungeonPublishedState> authoredPublishedState =
            new java.util.concurrent.atomic.AtomicReference<>();
    private final java.util.concurrent.atomic.AtomicReference<TravelRuntimeComponent> travelRuntime =
            new java.util.concurrent.atomic.AtomicReference<>();

    DungeonTravelApplicationService createTravelApplicationService(ServiceRegistry registry) {
        DungeonPublishedState publishedState = authoredPublishedState(registry);
        src.domain.dungeon.model.map.usecase.LoadDungeonMapUseCase loadDungeonMapUseCase = loadDungeonMapUseCase(registry);
        src.domain.dungeon.model.map.usecase.BuildDungeonDerivedStateUseCase derive = new src.domain.dungeon.model.map.usecase.BuildDungeonDerivedStateUseCase();
        return new DungeonTravelApplicationService(
                new src.domain.dungeon.model.travel.usecase.PublishDungeonTravelSurfaceUseCase(
                        new src.domain.dungeon.model.travel.usecase.LoadDungeonTravelSurfaceUseCase(loadDungeonMapUseCase, derive),
                        publishedState),
                new src.domain.dungeon.model.travel.usecase.PublishDungeonTravelMoveUseCase(
                        new src.domain.dungeon.model.travel.usecase.MoveDungeonTravelActionUseCase(
                        loadDungeonMapUseCase,
                        registry.require(src.domain.dungeon.model.map.repository.DungeonMapRepository.class),
                        derive),
                        publishedState));
    }

    DungeonTravelRuntimeApplicationService createTravelRuntimeApplicationService(ServiceRegistry registry) {
        return travelRuntimeComponent(registry).service();
    }

    src.domain.dungeon.published.DungeonAuthoredReadModel authoredReadModel(ServiceRegistry registry) {
        return authoredPublishedState(registry).authoredReadModel();
    }

    src.domain.dungeon.published.DungeonAuthoredMutationModel authoredMutationModel(ServiceRegistry registry) {
        return authoredPublishedState(registry).authoredMutationModel();
    }

    src.domain.dungeon.published.DungeonMapCatalogModel mapCatalogModel(ServiceRegistry registry) {
        return authoredPublishedState(registry).mapCatalogModel();
    }

    src.domain.dungeon.published.DungeonTravelModel dungeonTravelModel(ServiceRegistry registry) {
        return authoredPublishedState(registry).travelModel();
    }

    src.domain.dungeon.published.TravelDungeonModel travelDungeonModel(ServiceRegistry registry) {
        return travelRuntimeComponent(registry).travelModel();
    }

    DungeonEditorApplicationService createEditorApplicationService(ServiceRegistry registry) {
        ServiceRegistry services = requireRegistry(registry);
        DungeonPublishedState publishedState = authoredPublishedState(services);
        src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState dungeonState = new src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState();
        src.domain.dungeon.model.map.usecase.ApplyDungeonMapCatalogUseCase catalogUseCase = mapCatalogUseCase(services);
        src.domain.dungeon.model.map.usecase.LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase = loadDungeonSnapshotUseCase(services);
        src.domain.dungeon.model.map.usecase.ApplyDungeonAuthoredMutationUseCase mutationUseCase = authoredMutationUseCase(services);
        src.domain.dungeon.model.editor.usecase.SearchDungeonEditorMapCatalogUseCase searchMapsUseCase =
                new src.domain.dungeon.model.editor.usecase.SearchDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, dungeonState);
        src.domain.dungeon.model.editor.usecase.CreateDungeonEditorMapCatalogUseCase createMapUseCase =
                new src.domain.dungeon.model.editor.usecase.CreateDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, dungeonState);
        src.domain.dungeon.model.editor.usecase.RenameDungeonEditorMapCatalogUseCase renameMapUseCase =
                new src.domain.dungeon.model.editor.usecase.RenameDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, dungeonState);
        src.domain.dungeon.model.editor.usecase.DeleteDungeonEditorMapCatalogUseCase deleteMapUseCase =
                new src.domain.dungeon.model.editor.usecase.DeleteDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, dungeonState);
        src.domain.dungeon.model.editor.usecase.PublishDungeonEditorAuthoredSnapshotUseCase publishAuthoredSnapshotUseCase =
                new src.domain.dungeon.model.editor.usecase.PublishDungeonEditorAuthoredSnapshotUseCase(
                        publishedState,
                        dungeonState);
        src.domain.dungeon.model.editor.usecase.PublishDungeonEditorAuthoredInspectorUseCase publishAuthoredInspectorUseCase =
                new src.domain.dungeon.model.editor.usecase.PublishDungeonEditorAuthoredInspectorUseCase(publishedState, dungeonState);
        src.domain.dungeon.model.editor.usecase.PublishDungeonEditorAuthoredMutationUseCase publishAuthoredMutationUseCase =
                new src.domain.dungeon.model.editor.usecase.PublishDungeonEditorAuthoredMutationUseCase(
                        publishedState,
                        dungeonState);
        src.domain.dungeon.model.editor.usecase.LoadDungeonEditorAuthoredMapUseCase loadMapUseCase =
                new src.domain.dungeon.model.editor.usecase.LoadDungeonEditorAuthoredMapUseCase(
                        loadDungeonSnapshotUseCase,
                        publishAuthoredSnapshotUseCase,
                        publishAuthoredInspectorUseCase);
        src.domain.dungeon.model.editor.usecase.PreviewDungeonEditorAuthoredOperationUseCase previewOperationUseCase =
                new src.domain.dungeon.model.editor.usecase.PreviewDungeonEditorAuthoredOperationUseCase(
                        mutationUseCase,
                        publishAuthoredMutationUseCase);
        src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorAuthoredOperationUseCase applyOperationUseCase =
                new src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorAuthoredOperationUseCase(
                        mutationUseCase,
                        publishAuthoredMutationUseCase);
        src.domain.dungeon.model.editor.usecase.SaveDungeonEditorAuthoredRoomNarrationUseCase saveRoomNarrationUseCase =
                new src.domain.dungeon.model.editor.usecase.SaveDungeonEditorAuthoredRoomNarrationUseCase(mutationUseCase, publishAuthoredMutationUseCase);
        src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow workflow = new src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow();
        src.domain.dungeon.model.editor.usecase.BuildDungeonEditorSnapshotUseCase snapshotBuilder = new src.domain.dungeon.model.editor.usecase.BuildDungeonEditorSnapshotUseCase(
                searchMapsUseCase,
                loadMapUseCase,
                previewOperationUseCase,
                dungeonState);
        src.domain.dungeon.model.editor.usecase.InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter =
                new src.domain.dungeon.model.editor.usecase.InterpretDungeonEditorMainViewInputUseCase();
        src.domain.dungeon.model.editor.usecase.PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase =
                new src.domain.dungeon.model.editor.usecase.PublishDungeonEditorSnapshotUseCase(editorPublishedState);
        src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorSessionEffectUseCase effectUseCase = new src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorSessionEffectUseCase(
                workflow,
                applyOperationUseCase,
                dungeonState,
                snapshotBuilder,
                snapshotPublicationUseCase);
        effectUseCase.publishCurrent();
        return new DungeonEditorApplicationService(
                new src.domain.dungeon.model.editor.usecase.SelectDungeonEditorMapUseCase(
                        workflow,
                        snapshotBuilder,
                        mainViewInterpreter,
                        snapshotPublicationUseCase),
                new src.domain.dungeon.model.editor.usecase.CreateDungeonEditorMapUseCase(
                        workflow,
                        createMapUseCase,
                        dungeonState,
                        snapshotBuilder,
                        mainViewInterpreter,
                        snapshotPublicationUseCase),
                new src.domain.dungeon.model.editor.usecase.RenameDungeonEditorMapUseCase(
                        workflow,
                        renameMapUseCase,
                        dungeonState,
                        snapshotBuilder,
                        snapshotPublicationUseCase),
                new src.domain.dungeon.model.editor.usecase.DeleteDungeonEditorMapUseCase(
                        workflow,
                        deleteMapUseCase,
                        dungeonState,
                        snapshotBuilder,
                        mainViewInterpreter,
                        snapshotPublicationUseCase),
                new src.domain.dungeon.model.editor.usecase.SetDungeonEditorViewModeUseCase(
                        workflow,
                        snapshotBuilder,
                        mainViewInterpreter,
                        snapshotPublicationUseCase),
                new src.domain.dungeon.model.editor.usecase.SetDungeonEditorToolUseCase(
                        workflow,
                        snapshotBuilder,
                        mainViewInterpreter,
                        snapshotPublicationUseCase),
                new src.domain.dungeon.model.editor.usecase.ShiftDungeonEditorProjectionLevelUseCase(workflow, snapshotBuilder, snapshotPublicationUseCase),
                new src.domain.dungeon.model.editor.usecase.SetDungeonEditorOverlayUseCase(workflow, snapshotBuilder, snapshotPublicationUseCase),
                new src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorSelectionUseCase(workflow, mainViewInterpreter, effectUseCase),
                new src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorPaintRoomUseCase(workflow, mainViewInterpreter, effectUseCase),
                new src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorDeleteRoomUseCase(workflow, mainViewInterpreter, effectUseCase),
                new src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorCreateWallUseCase(workflow, mainViewInterpreter, effectUseCase),
                new src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorDeleteWallUseCase(workflow, mainViewInterpreter, effectUseCase),
                new src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorCreateDoorUseCase(workflow, mainViewInterpreter, effectUseCase),
                new src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorDeleteDoorUseCase(workflow, mainViewInterpreter, effectUseCase),
                new src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorCreateCorridorUseCase(workflow, mainViewInterpreter, effectUseCase),
                new src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorDeleteCorridorUseCase(workflow, mainViewInterpreter, effectUseCase),
                new src.domain.dungeon.model.editor.usecase.SaveDungeonEditorRoomNarrationUseCase(workflow, saveRoomNarrationUseCase, effectUseCase));
    }

    src.domain.dungeon.published.DungeonEditorControlsModel createControlsModel(ServiceRegistry registry) {
        requireRegistry(registry);
        return editorPublishedState.controlsModel;
    }

    src.domain.dungeon.published.DungeonEditorMapSurfaceModel createMapSurfaceModel(ServiceRegistry registry) {
        requireRegistry(registry);
        return editorPublishedState.mapSurfaceModel;
    }

    src.domain.dungeon.published.DungeonEditorStateModel createStateModel(ServiceRegistry registry) {
        requireRegistry(registry);
        return editorPublishedState.stateModel;
    }

    private DungeonPublishedState authoredPublishedState(ServiceRegistry registry) {
        DungeonPublishedState existing = authoredPublishedState.get();
        if (existing != null) {
            return existing;
        }
        requireRegistry(registry);
        DungeonPublishedState candidate = new DungeonPublishedState();
        return authoredPublishedState.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(authoredPublishedState.get(), "authoredPublishedState");
    }

    private static src.domain.dungeon.model.map.usecase.LoadDungeonMapUseCase loadDungeonMapUseCase(ServiceRegistry registry) {
        return new src.domain.dungeon.model.map.usecase.LoadDungeonMapUseCase(registry.require(src.domain.dungeon.model.map.repository.DungeonMapRepository.class));
    }

    private static src.domain.dungeon.model.map.usecase.ApplyDungeonMapCatalogUseCase mapCatalogUseCase(ServiceRegistry registry) {
        src.domain.dungeon.model.map.repository.DungeonMapRepository repository = registry.require(src.domain.dungeon.model.map.repository.DungeonMapRepository.class);
        return new src.domain.dungeon.model.map.usecase.ApplyDungeonMapCatalogUseCase(
                new src.domain.dungeon.model.map.usecase.SearchDungeonMapsUseCase(repository),
                new src.domain.dungeon.model.map.usecase.CreateDungeonMapUseCase(repository),
                new src.domain.dungeon.model.map.usecase.RenameDungeonMapUseCase(repository),
                new src.domain.dungeon.model.map.usecase.DeleteDungeonMapUseCase(repository));
    }

    private static SnapshotAssemblyParts snapshotAssemblyParts(ServiceRegistry registry) {
        src.domain.dungeon.model.map.usecase.BuildDungeonDerivedStateUseCase derive =
                new src.domain.dungeon.model.map.usecase.BuildDungeonDerivedStateUseCase();
        return new SnapshotAssemblyParts(
                loadDungeonMapUseCase(registry),
                new src.domain.dungeon.model.map.usecase.PublishDungeonEditorHandlesUseCase(),
                derive,
                new src.domain.dungeon.model.map.usecase.AssembleDungeonSnapshotUseCase(derive));
    }

    private static src.domain.dungeon.model.map.usecase.LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase(ServiceRegistry registry) {
        SnapshotAssemblyParts parts = snapshotAssemblyParts(registry);
        src.domain.dungeon.model.map.usecase.InspectDungeonSelectionUseCase inspectDungeonSelectionUseCase =
                new src.domain.dungeon.model.map.usecase.InspectDungeonSelectionUseCase(parts.derive());
        return new src.domain.dungeon.model.map.usecase.LoadDungeonSnapshotUseCase(
                parts.loadDungeonMapUseCase(),
                parts.assembleDungeonSnapshotUseCase(),
                parts.publishDungeonEditorHandlesUseCase(),
                inspectDungeonSelectionUseCase);
    }

    private static src.domain.dungeon.model.map.usecase.ApplyDungeonAuthoredMutationUseCase authoredMutationUseCase(ServiceRegistry registry) {
        SnapshotAssemblyParts parts = snapshotAssemblyParts(registry);
        return new src.domain.dungeon.model.map.usecase.ApplyDungeonAuthoredMutationUseCase(new src.domain.dungeon.model.map.usecase.ApplyDungeonEditorOperationUseCase(
                parts.loadDungeonMapUseCase(),
                registry.require(src.domain.dungeon.model.map.repository.DungeonMapRepository.class),
                parts.derive(),
                parts.assembleDungeonSnapshotUseCase(),
                parts.publishDungeonEditorHandlesUseCase()));
    }

    private static src.domain.dungeon.published.DungeonCellRef publishedCellRef(src.domain.dungeon.model.map.model.DungeonCell cell) {
        src.domain.dungeon.model.map.model.DungeonCell safeCell =
                cell == null ? new src.domain.dungeon.model.map.model.DungeonCell(0, 0, 0) : cell;
        return new src.domain.dungeon.published.DungeonCellRef(safeCell.q(), safeCell.r(), safeCell.level());
    }

    private record SnapshotAssemblyParts(
            src.domain.dungeon.model.map.usecase.LoadDungeonMapUseCase loadDungeonMapUseCase,
            src.domain.dungeon.model.map.usecase.PublishDungeonEditorHandlesUseCase publishDungeonEditorHandlesUseCase,
            src.domain.dungeon.model.map.usecase.BuildDungeonDerivedStateUseCase derive,
            src.domain.dungeon.model.map.usecase.AssembleDungeonSnapshotUseCase assembleDungeonSnapshotUseCase
    ) {
    }

    private TravelRuntimeComponent travelRuntimeComponent(ServiceRegistry registry) {
        TravelRuntimeComponent existing = travelRuntime.get();
        if (existing != null) {
            return existing;
        }
        requireRegistry(registry);
        src.domain.dungeon.model.travel.usecase.ApplyTravelDungeonSessionUseCase applyUseCase = new src.domain.dungeon.model.travel.usecase.ApplyTravelDungeonSessionUseCase(
                travelDungeonSessionRuntimeAccess(registry));
        TravelRuntimeComponent.PublishedState publishedState = new TravelRuntimeComponent.PublishedState();
        publishedState.publishCurrentSession(applyUseCase.snapshot());
        src.domain.dungeon.model.travel.usecase.PublishTravelDungeonSessionUseCase publishUseCase =
                new src.domain.dungeon.model.travel.usecase.PublishTravelDungeonSessionUseCase(applyUseCase, publishedState);
        TravelRuntimeComponent candidate = new TravelRuntimeComponent(
                new DungeonTravelRuntimeApplicationService(publishUseCase),
                publishedState.travelModel());
        return travelRuntime.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(travelRuntime.get(), "travelRuntime");
    }

    private static src.domain.dungeon.model.travel.repository.TravelDungeonSessionRepository travelDungeonSessionRuntimeAccess(ServiceRegistry registry) {
        return registry.require(src.domain.dungeon.model.travel.repository.TravelDungeonSessionRepository.class);
    }

    private static ServiceRegistry requireRegistry(ServiceRegistry registry) {
        return Objects.requireNonNull(registry, "registry");
    }

    private static <T> Consumer<T> requireListener(Consumer<T> listener) {
        return Objects.requireNonNull(listener, "listener");
    }

    private record TravelRuntimeComponent(
            DungeonTravelRuntimeApplicationService service,
            src.domain.dungeon.published.TravelDungeonModel travelModel
    ) {

        private static final class PublishedState implements src.domain.dungeon.model.travel.repository.TravelDungeonSessionPublishedStateRepository {

            private final List<Consumer<src.domain.dungeon.published.TravelDungeonSnapshot>> listeners = new ArrayList<>();
            private final src.domain.dungeon.published.TravelDungeonModel travelModel = new src.domain.dungeon.published.TravelDungeonModel(this::currentSnapshot, this::subscribe);
            private src.domain.dungeon.published.TravelDungeonSnapshot currentSnapshot = src.domain.dungeon.published.TravelDungeonSnapshot.empty();

            private src.domain.dungeon.published.TravelDungeonModel travelModel() {
                return travelModel;
            }

            @Override
            public void publishCurrentSession(src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSnapshot.SnapshotData snapshot) {
                currentSnapshot = toPublishedSnapshot(snapshot);
                for (Consumer<src.domain.dungeon.published.TravelDungeonSnapshot> listener : List.copyOf(listeners)) {
                    listener.accept(currentSnapshot);
                }
            }

            private src.domain.dungeon.published.TravelDungeonSnapshot currentSnapshot() {
                return currentSnapshot;
            }

            private Runnable subscribe(Consumer<src.domain.dungeon.published.TravelDungeonSnapshot> listener) {
                Consumer<src.domain.dungeon.published.TravelDungeonSnapshot> safeListener = requireListener(listener);
                listeners.add(safeListener);
                return () -> listeners.remove(safeListener);
            }

            private static src.domain.dungeon.published.TravelDungeonSnapshot toPublishedSnapshot(src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSnapshot.SnapshotData snapshot) {
                if (snapshot == null) {
                    return src.domain.dungeon.published.TravelDungeonSnapshot.empty();
                }
                src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.SurfaceData surface = snapshot.surface();
                return new src.domain.dungeon.published.TravelDungeonSnapshot(
                        workspaceState(surface),
                        surfaceSnapshot(surface),
                        overlaySettings(snapshot.overlayState()),
                        snapshot.projectionLevel());
            }

            private static src.domain.dungeon.published.DungeonOverlaySettings overlaySettings(src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.TravelOverlayState overlayState) {
                src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.TravelOverlayState safeOverlay = overlayState == null
                        ? src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.TravelOverlayState.defaults()
                        : overlayState;
                return new src.domain.dungeon.published.DungeonOverlaySettings(
                        safeOverlay.modeKey(),
                        safeOverlay.levelRange(),
                        safeOverlay.opacity(),
                        safeOverlay.selectedLevels());
            }

            private static src.domain.dungeon.published.TravelDungeonWorkspaceState workspaceState(src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.SurfaceData surface) {
                if (surface == null) {
                    return null;
                }
                return new src.domain.dungeon.published.TravelDungeonWorkspaceState(
                        surface.mapName(),
                        surface.areaLabel(),
                        surface.tileLabel(),
                        surface.headingLabel(),
                        surface.statusLabel(),
                        surface.contextKind().isOverworld(),
                        surface.actions().stream().map(PublishedState::workspaceAction).toList());
            }

            private static src.domain.dungeon.published.DungeonTravelSurfaceSnapshot surfaceSnapshot(src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.SurfaceData surface) {
                if (surface == null) {
                    return null;
                }
                return new src.domain.dungeon.published.DungeonTravelSurfaceSnapshot(
                        src.domain.dungeon.published.DungeonTravelContextKind.valueOf(surface.contextKind().name()),
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

            private static src.domain.dungeon.published.DungeonMapSnapshot travelMapSnapshot(src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.MapData map) {
                src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.MapData safeMap = map == null ? src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.MapData.empty() : map;
                return new src.domain.dungeon.published.DungeonMapSnapshot(
                        DungeonTopologyKind.valueOf(safeMap.topology().name()),
                        safeMap.width(),
                        safeMap.height(),
                        safeMap.areas().stream().map(PublishedState::area).toList(),
                        safeMap.boundaries().stream().map(PublishedState::boundary).toList(),
                        safeMap.features().stream().map(PublishedState::feature).toList());
            }

            private static src.domain.dungeon.published.DungeonAreaSnapshot area(src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.AreaData area) {
                return new src.domain.dungeon.published.DungeonAreaSnapshot(
                        src.domain.dungeon.published.DungeonAreaKind.valueOf(area.kind().name()),
                        area.id(),
                        area.label(),
                        area.cells().stream().map(DungeonServiceAssembly::publishedCellRef).toList());
            }

            private static src.domain.dungeon.published.DungeonBoundarySnapshot boundary(src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.BoundaryData boundary) {
                return new src.domain.dungeon.published.DungeonBoundarySnapshot(
                        boundary.doorBoundary() ? "door" : "wall",
                        boundary.id(),
                        boundary.label(),
                        new src.domain.dungeon.published.DungeonEdgeRef(
                                publishedCellRef(boundary.edge().from()),
                                publishedCellRef(boundary.edge().to())));
            }

            private static src.domain.dungeon.published.DungeonFeatureSnapshot feature(src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.FeatureData feature) {
                return new src.domain.dungeon.published.DungeonFeatureSnapshot(
                        src.domain.dungeon.published.DungeonFeatureKind.valueOf(feature.kind().name()),
                        feature.id(),
                        feature.label(),
                        feature.cells().stream().map(DungeonServiceAssembly::publishedCellRef).toList(),
                        feature.description(),
                        feature.destinationLabel());
            }

            private static src.domain.dungeon.published.DungeonTravelPosition travelPosition(src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.PositionData position) {
                if (position == null) {
                    return new src.domain.dungeon.published.DungeonTravelPosition(
                            new src.domain.dungeon.published.DungeonMapId(1L),
                            src.domain.dungeon.published.DungeonTravelLocationKind.TILE,
                            0L,
                            new src.domain.dungeon.published.DungeonCellRef(0, 0, 0),
                            src.domain.dungeon.published.DungeonTravelHeading.defaultHeading());
                }
                return new src.domain.dungeon.published.DungeonTravelPosition(
                        new src.domain.dungeon.published.DungeonMapId(position.mapId()),
                        src.domain.dungeon.published.DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                        position.ownerId(),
                        publishedCellRef(position.tile()),
                        src.domain.dungeon.published.DungeonTravelHeading.valueOf(position.headingToken()));
            }

            private static src.domain.dungeon.published.DungeonTravelActionSnapshot surfaceAction(src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.AvailableAction action) {
                return new src.domain.dungeon.published.DungeonTravelActionSnapshot(
                        action.id(),
                        src.domain.dungeon.published.DungeonTravelActionKind.TRAVERSAL,
                        action.displayLabel(),
                        "",
                        action.helpText());
            }

            private static src.domain.dungeon.published.TravelDungeonAction workspaceAction(src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.AvailableAction action) {
                return new src.domain.dungeon.published.TravelDungeonAction(
                        action.id(),
                        action.displayLabel(),
                        action.helpText());
            }
        }
    }

    private static final class DungeonPublishedState implements src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository {

        private final PublishedChannel<src.domain.dungeon.published.DungeonAuthoredReadResult> authoredRead =
                new PublishedChannel<>(defaultAuthoredRead());
        private final PublishedChannel<src.domain.dungeon.published.DungeonAuthoredMutationResult> authoredMutation =
                new PublishedChannel<>(defaultAuthoredMutation());
        private final PublishedChannel<src.domain.dungeon.published.DungeonMapCatalogResponse> mapCatalog =
                new PublishedChannel<>(new src.domain.dungeon.published.DungeonMapCatalogResponse.MapList(List.of()));
        private final PublishedChannel<src.domain.dungeon.published.DungeonTravelResponse> travel =
                new PublishedChannel<>(defaultTravel());
        private final src.domain.dungeon.published.DungeonAuthoredReadModel authoredReadModel = new src.domain.dungeon.published.DungeonAuthoredReadModel(
                authoredRead::current,
                authoredRead::subscribe);
        private final src.domain.dungeon.published.DungeonAuthoredMutationModel authoredMutationModel = new src.domain.dungeon.published.DungeonAuthoredMutationModel(
                authoredMutation::current,
                authoredMutation::subscribe);
        private final src.domain.dungeon.published.DungeonMapCatalogModel mapCatalogModel = new src.domain.dungeon.published.DungeonMapCatalogModel(
                mapCatalog::current,
                mapCatalog::subscribe);
        private final src.domain.dungeon.published.DungeonTravelModel travelModel = new src.domain.dungeon.published.DungeonTravelModel(
                travel::current,
                travel::subscribe);

        private src.domain.dungeon.published.DungeonAuthoredReadModel authoredReadModel() {
            return authoredReadModel;
        }

        private src.domain.dungeon.published.DungeonAuthoredMutationModel authoredMutationModel() {
            return authoredMutationModel;
        }

        private src.domain.dungeon.published.DungeonMapCatalogModel mapCatalogModel() {
            return mapCatalogModel;
        }

        private src.domain.dungeon.published.DungeonTravelModel travelModel() {
            return travelModel;
        }

        @Override
        public void publishSnapshot(src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository.SnapshotPublication snapshot) {
            if (snapshot != null) {
                authoredRead.publish(new src.domain.dungeon.published.DungeonAuthoredReadResult.CommittedSnapshot(dungeonSnapshot(snapshot)));
            }
        }

        @Override
        public void publishInspector(src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository.InspectorPublication inspector) {
            if (inspector != null) {
                authoredRead.publish(new src.domain.dungeon.published.DungeonAuthoredReadResult.SelectionInspector(new src.domain.dungeon.published.DungeonInspectorSnapshot(
                        inspector.title(),
                        inspector.description(),
                        inspector.facts(),
                        roomNarrations(inspector))));
            }
        }

        @Override
        public void publishMutation(src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository.MutationPublication result) {
            if (result != null) {
                authoredMutation.publish(new src.domain.dungeon.published.DungeonAuthoredMutationResult.Operation(new src.domain.dungeon.published.DungeonOperationResult(
                        dungeonSnapshot(result.snapshot()),
                        result.validationMessages(),
                        result.reactionMessages())));
            }
        }

        @Override
        public void publishSearch(src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository.CatalogPublication result) {
            mapCatalog.publish(new src.domain.dungeon.published.DungeonMapCatalogResponse.MapList(summaries(result)));
        }

        @Override
        public void publishCreated(src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository.MapMutationPublication mutation) {
            mapCatalog.publish(mapMutation(src.domain.dungeon.published.DungeonMapCatalogResponse.MutationKind.CREATED, mutation.mapId()));
        }

        @Override
        public void publishRenamed(src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository.MapMutationPublication mutation) {
            mapCatalog.publish(mapMutation(src.domain.dungeon.published.DungeonMapCatalogResponse.MutationKind.RENAMED, mutation.mapId()));
        }

        @Override
        public void publishDeleted(src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository.MapMutationPublication mutation) {
            mapCatalog.publish(mapMutation(src.domain.dungeon.published.DungeonMapCatalogResponse.MutationKind.DELETED, mutation.mapId()));
        }

        @Override
        public void publishSurface(src.domain.dungeon.model.map.model.DungeonTravelSurfaceFacts surface) {
            if (surface != null) {
                travel.publish(new src.domain.dungeon.published.DungeonTravelResponse.Surface(surfaceSnapshot(surface)));
            }
        }

        @Override
        public void publishMove(src.domain.dungeon.model.map.model.DungeonTravelMoveFacts move) {
            if (move != null) {
                travel.publish(new src.domain.dungeon.published.DungeonTravelResponse.Move(new src.domain.dungeon.published.DungeonTravelMoveResult(
                        src.domain.dungeon.published.DungeonTravelMoveStatus.valueOf(move.status().name()),
                        move.message(),
                        surfaceSnapshot(move.surface()),
                        externalTarget(move.externalTarget()))));
            }
        }

        private static src.domain.dungeon.published.DungeonAuthoredReadResult defaultAuthoredRead() {
            return new src.domain.dungeon.published.DungeonAuthoredReadResult.CommittedSnapshot(defaultSnapshot());
        }

        private static src.domain.dungeon.published.DungeonAuthoredMutationResult defaultAuthoredMutation() {
            return new src.domain.dungeon.published.DungeonAuthoredMutationResult.Operation(new src.domain.dungeon.published.DungeonOperationResult(
                    defaultSnapshot(),
                    List.of(),
                    List.of()));
        }

        private static src.domain.dungeon.published.DungeonTravelResponse defaultTravel() {
            String defaultDungeonName = "Dungeon";
            return new src.domain.dungeon.published.DungeonTravelResponse.Surface(new src.domain.dungeon.published.DungeonTravelSurfaceSnapshot(
                    src.domain.dungeon.published.DungeonTravelContextKind.DUNGEON,
                    defaultDungeonName,
                    0,
                    src.domain.dungeon.published.DungeonMapSnapshot.empty(),
                    new src.domain.dungeon.published.DungeonTravelPosition(
                            new src.domain.dungeon.published.DungeonMapId(1L),
                            src.domain.dungeon.published.DungeonTravelLocationKind.TILE,
                            0L,
                            new src.domain.dungeon.published.DungeonCellRef(0, 0, 0),
                            src.domain.dungeon.published.DungeonTravelHeading.defaultHeading()),
                    defaultDungeonName,
                    "Kein Standort",
                    "",
                    "",
                    "",
                    "",
                    List.of()));
        }

        private static src.domain.dungeon.published.DungeonSnapshot defaultSnapshot() {
            return new src.domain.dungeon.published.DungeonSnapshot(
                    "Dungeon",
                    src.domain.dungeon.published.DungeonMapMode.EDITOR,
                    src.domain.dungeon.published.DungeonMapSnapshot.empty(),
                    List.of(),
                    List.of(),
                    0);
        }

        private static src.domain.dungeon.published.DungeonMapCatalogResponse mapMutation(
                src.domain.dungeon.published.DungeonMapCatalogResponse.MutationKind kind,
                src.domain.dungeon.model.map.model.DungeonMapIdentity mapId
        ) {
            return new src.domain.dungeon.published.DungeonMapCatalogResponse.MapMutation(kind, id(mapId));
        }

        private static List<src.domain.dungeon.published.DungeonMapSummary> summaries(
                src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository.CatalogPublication result
        ) {
            List<src.domain.dungeon.published.DungeonMapSummary> summaries = new ArrayList<>();
            for (src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository.MapSummaryPublication map :
                    result == null
                            ? List.<src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository.MapSummaryPublication>of()
                            : result.maps()) {
                summaries.add(summary(map));
            }
            return List.copyOf(summaries);
        }

        private static src.domain.dungeon.published.DungeonMapSummary summary(src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository.MapSummaryPublication map) {
            return new src.domain.dungeon.published.DungeonMapSummary(id(map.mapId()), map.mapName(), revision(map.revision()));
        }

        private static List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard> roomNarrations(
                src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository.InspectorPublication snapshot
        ) {
            List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard> roomNarrations = new ArrayList<>();
            for (src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository.RoomNarrationPublication roomNarration :
                    snapshot.roomNarrations()) {
                roomNarrations.add(roomNarration(roomNarration));
            }
            return List.copyOf(roomNarrations);
        }

        private static src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard roomNarration(
                src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository.RoomNarrationPublication roomNarration
        ) {
            return new src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard(
                    roomNarration.roomId(),
                    roomNarration.roomName(),
                    roomNarration.visualDescription(),
                    recordRoomExits(roomNarration.exits()));
        }

        private static List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomExitNarration> recordRoomExits(
                List<src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication> exits
        ) {
            List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomExitNarration> result = new ArrayList<>();
            for (src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication exit : exits) {
                result.add(new src.domain.dungeon.published.DungeonInspectorSnapshot.RoomExitNarration(
                        exit.label(),
                        cell(exit.cell()),
                        exit.direction().name(),
                        exit.description()));
            }
            return List.copyOf(result);
        }

        private static src.domain.dungeon.published.DungeonSnapshot dungeonSnapshot(
                src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository.@Nullable SnapshotPublication snapshot
        ) {
            if (snapshot == null) {
                return defaultSnapshot();
            }
            src.domain.dungeon.model.map.model.DungeonDerivedState derived = snapshot.derived();
            return new src.domain.dungeon.published.DungeonSnapshot(
                    snapshot.mapName(),
                    src.domain.dungeon.published.DungeonMapMode.EDITOR,
                    mapSnapshot(derived.map(), snapshot.editorHandles()),
                    derived.aggregates().stream().map(DungeonPublishedState::aggregateSummary).toList(),
                    derived.relations().summaries(),
                    revision(snapshot.revision()));
        }

        private static String aggregateSummary(src.domain.dungeon.model.map.model.DungeonState aggregate) {
            return aggregate.label() + " #" + aggregate.id();
        }

        private static src.domain.dungeon.published.DungeonMapSnapshot mapSnapshot(
                src.domain.dungeon.model.map.model.DungeonMapFacts facts,
                List<src.domain.dungeon.model.map.model.DungeonEditorHandleFacts> handles
        ) {
            src.domain.dungeon.model.map.model.DungeonMapFacts safeFacts = facts == null
                    ? new src.domain.dungeon.model.map.model.DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, List.of(), List.of())
                    : facts;
            List<src.domain.dungeon.model.map.model.DungeonEditorHandleFacts> safeHandles = handles == null ? List.of() : List.copyOf(handles);
            return new src.domain.dungeon.published.DungeonMapSnapshot(
                    topology(safeFacts),
                    safeFacts.width(),
                    safeFacts.height(),
                    safeFacts.areas().stream().map(DungeonPublishedState::area).toList(),
                    safeFacts.boundaries().stream().map(boundary -> new src.domain.dungeon.published.DungeonBoundarySnapshot(
                            boundary.kind(),
                            boundary.id(),
                            boundary.label(),
                            edge(boundary.edge()),
                            topologyRef(boundary.topologyRef()))).toList(),
                    safeFacts.features().stream().map(feature -> new src.domain.dungeon.published.DungeonFeatureSnapshot(
                            src.domain.dungeon.published.DungeonFeatureKind.valueOf(feature.kind().name()),
                            feature.id(),
                            feature.label(),
                            feature.cells().stream().map(DungeonPublishedState::cell).toList(),
                            feature.description(),
                            feature.destinationLabel(),
                            topologyRef(feature.topologyRef()))).toList(),
                    safeHandles.stream().map(DungeonPublishedState::handle).toList());
        }

        private static DungeonTopologyKind topology(src.domain.dungeon.model.map.model.DungeonMapFacts facts) {
            return facts.topology() == DungeonTopology.HEX ? DungeonTopologyKind.HEX : DungeonTopologyKind.SQUARE;
        }

        private static src.domain.dungeon.published.DungeonAreaSnapshot area(src.domain.dungeon.model.map.model.DungeonAreaFacts area) {
            return new src.domain.dungeon.published.DungeonAreaSnapshot(
                    area.kind() == DungeonAreaType.CORRIDOR ? src.domain.dungeon.published.DungeonAreaKind.CORRIDOR : src.domain.dungeon.published.DungeonAreaKind.ROOM,
                    area.id(),
                    area.clusterId(),
                    area.label(),
                    area.cells().stream().map(DungeonPublishedState::cell).toList(),
                    topologyRef(area.topologyRef()));
        }

        private static src.domain.dungeon.published.DungeonEditorHandleSnapshot handle(src.domain.dungeon.model.map.model.DungeonEditorHandleFacts handle) {
            return new src.domain.dungeon.published.DungeonEditorHandleSnapshot(
                    handleRef(handle.handle()),
                    handle.label(),
                    cell(handle.handle().cell()));
        }

        private static src.domain.dungeon.published.DungeonEditorHandleRef handleRef(src.domain.dungeon.model.map.model.DungeonEditorHandle handle) {
            return new src.domain.dungeon.published.DungeonEditorHandleRef(
                    src.domain.dungeon.published.DungeonEditorHandleKind.valueOf(handle.type().name()),
                    topologyRef(handle.topologyRef()),
                    handle.ownerId(),
                    handle.clusterId(),
                    handle.corridorId(),
                    handle.roomId(),
                    handle.index(),
                    cell(handle.cell()),
                    handle.direction().name());
        }

        private static src.domain.dungeon.published.DungeonTravelSurfaceSnapshot surfaceSnapshot(src.domain.dungeon.model.map.model.DungeonTravelSurfaceFacts surface) {
            return new src.domain.dungeon.published.DungeonTravelSurfaceSnapshot(
                    src.domain.dungeon.published.DungeonTravelContextKind.DUNGEON,
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

        private static src.domain.dungeon.published.DungeonTravelActionSnapshot travelAction(src.domain.dungeon.model.map.model.DungeonTravelActionFacts action) {
            return new src.domain.dungeon.published.DungeonTravelActionSnapshot(
                    action.actionId(),
                    src.domain.dungeon.published.DungeonTravelActionKind.valueOf(action.kind().name()),
                    action.label(),
                    action.destinationLabel(),
                    action.description());
        }

        private static src.domain.dungeon.published.DungeonTravelPosition travelPosition(src.domain.dungeon.model.map.model.DungeonTravelPositionFacts position) {
            return new src.domain.dungeon.published.DungeonTravelPosition(
                    id(position.mapId()),
                    src.domain.dungeon.published.DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                    position.ownerId(),
                    cell(position.tile()),
                    src.domain.dungeon.published.DungeonTravelHeading.valueOf(position.heading().name()));
        }

        private static src.domain.dungeon.published.DungeonTravelExternalTarget externalTarget(src.domain.dungeon.model.map.model.DungeonTravelExternalTargetFacts target) {
            if (target != null && target.isOverworldTile()) {
                return new src.domain.dungeon.published.DungeonTravelExternalTarget.OverworldTile(target.mapId(), target.tileId());
            }
            return null;
        }

        private static src.domain.dungeon.published.DungeonMapId id(src.domain.dungeon.model.map.model.DungeonMapIdentity identity) {
            return new src.domain.dungeon.published.DungeonMapId(identity == null ? 1L : identity.value());
        }

        private static src.domain.dungeon.published.DungeonCellRef cell(src.domain.dungeon.model.map.model.DungeonCell cell) {
            return publishedCellRef(cell);
        }

        private static src.domain.dungeon.published.DungeonEdgeRef edge(src.domain.dungeon.model.map.model.DungeonEdge edge) {
            if (edge == null) {
                return new src.domain.dungeon.published.DungeonEdgeRef(cell(null), cell(null));
            }
            return new src.domain.dungeon.published.DungeonEdgeRef(cell(edge.from()), cell(edge.to()));
        }

        private static src.domain.dungeon.published.DungeonTopologyElementRef topologyRef(DungeonTopologyRef ref) {
            if (ref == null) {
                return src.domain.dungeon.published.DungeonTopologyElementRef.empty();
            }
            return new src.domain.dungeon.published.DungeonTopologyElementRef(src.domain.dungeon.published.DungeonTopologyElementKind.valueOf(ref.kind().name()), ref.id());
        }

        private static int revision(long revision) {
            if (revision > Integer.MAX_VALUE) {
                return Integer.MAX_VALUE;
            }
            return Math.max(0, (int) revision);
        }

        private static final class PublishedChannel<T> {

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
                Consumer<T> safeListener = requireListener(listener);
                listeners.add(safeListener);
                return () -> listeners.remove(safeListener);
            }
        }
    }

    private static final class PublishedState implements src.domain.dungeon.model.editor.usecase.DungeonEditorSnapshotPublication {

        private final List<Consumer<src.domain.dungeon.published.DungeonEditorControlsSnapshot>> controlsListeners = new ArrayList<>();
        private final List<Consumer<src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot>> mapSurfaceListeners = new ArrayList<>();
        private final List<Consumer<src.domain.dungeon.published.DungeonEditorStateSnapshot>> stateListeners = new ArrayList<>();
        private final src.domain.dungeon.published.DungeonEditorControlsModel controlsModel = new src.domain.dungeon.published.DungeonEditorControlsModel(
                this::currentControls,
                this::subscribeControls);
        private final src.domain.dungeon.published.DungeonEditorMapSurfaceModel mapSurfaceModel = new src.domain.dungeon.published.DungeonEditorMapSurfaceModel(
                this::currentMapSurface,
                this::subscribeMapSurface);
        private final src.domain.dungeon.published.DungeonEditorStateModel stateModel = new src.domain.dungeon.published.DungeonEditorStateModel(
                this::currentState,
                this::subscribeState);
        private src.domain.dungeon.published.DungeonEditorControlsSnapshot currentControls = src.domain.dungeon.published.DungeonEditorControlsSnapshot.empty("");
        private src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot currentMapSurface = src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot.empty();
        private src.domain.dungeon.published.DungeonEditorStateSnapshot currentState = src.domain.dungeon.published.DungeonEditorStateSnapshot.empty("");

        @Override
        public void publishEditorSnapshot(src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot.SnapshotData snapshot) {
            src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot.SnapshotData safeSnapshot =
                    snapshot == null ? src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot.SnapshotData.empty("") : snapshot;
            SurfaceContext surfaceContext = surfaceContext(safeSnapshot.surface(), safeSnapshot.projectionLevel());
            currentControls = toControlsSnapshot(safeSnapshot, surfaceContext);
            currentMapSurface = toMapSurfaceSnapshot(safeSnapshot, surfaceContext.surface());
            currentState = toStateSnapshot(safeSnapshot, surfaceContext.surface());
            for (Consumer<src.domain.dungeon.published.DungeonEditorControlsSnapshot> listener : List.copyOf(controlsListeners)) {
                listener.accept(currentControls);
            }
            for (Consumer<src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot> listener : List.copyOf(mapSurfaceListeners)) {
                listener.accept(currentMapSurface);
            }
            for (Consumer<src.domain.dungeon.published.DungeonEditorStateSnapshot> listener : List.copyOf(stateListeners)) {
                listener.accept(currentState);
            }
        }

        private src.domain.dungeon.published.DungeonEditorControlsSnapshot currentControls() {
            return currentControls;
        }

        private src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot currentMapSurface() {
            return currentMapSurface;
        }

        private src.domain.dungeon.published.DungeonEditorStateSnapshot currentState() {
            return currentState;
        }

        private Runnable subscribeControls(Consumer<src.domain.dungeon.published.DungeonEditorControlsSnapshot> listener) {
            Consumer<src.domain.dungeon.published.DungeonEditorControlsSnapshot> safeListener = requireListener(listener);
            controlsListeners.add(safeListener);
            return () -> controlsListeners.remove(safeListener);
        }

        private Runnable subscribeMapSurface(Consumer<src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot> listener) {
            Consumer<src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot> safeListener = requireListener(listener);
            mapSurfaceListeners.add(safeListener);
            return () -> mapSurfaceListeners.remove(safeListener);
        }

        private Runnable subscribeState(Consumer<src.domain.dungeon.published.DungeonEditorStateSnapshot> listener) {
            Consumer<src.domain.dungeon.published.DungeonEditorStateSnapshot> safeListener = requireListener(listener);
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
                src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot map
        ) {
            for (src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Area area : map.areas()) {
                addWorkspaceCellLevels(levels, area.cells());
            }
            for (src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Feature feature : map.features()) {
                addWorkspaceCellLevels(levels, feature.cells());
            }
            for (src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Handle handle : map.editorHandles()) {
                levels.add(handle.cell().level());
            }
        }

        private static void addWorkspaceCellLevels(
                SortedSet<Integer> levels,
                List<src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Cell> cells
        ) {
            for (src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Cell cell
                    : cells == null ? List.<src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Cell>of() : cells) {
                levels.add(cell.level());
            }
        }

        private static src.domain.dungeon.published.DungeonEditorControlsSnapshot toControlsSnapshot(
                src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot.SnapshotData snapshot,
                SurfaceContext surfaceContext
        ) {
            return new src.domain.dungeon.published.DungeonEditorControlsSnapshot(
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

        private static src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot toMapSurfaceSnapshot(
                src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot.SnapshotData snapshot,
                @Nullable DungeonEditorSurface surface
        ) {
            return new src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot(
                    surface,
                    toPublishedSelection(snapshot.selection()),
                    toPublishedPreview(snapshot.preview()),
                    toPublishedViewMode(snapshot.viewMode()),
                    toPublishedOverlay(snapshot.overlaySettings()),
                    snapshot.projectionLevel(),
                    toPublishedTool(snapshot.selectedTool()));
        }

        private static src.domain.dungeon.published.DungeonEditorStateSnapshot toStateSnapshot(
                src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot.SnapshotData snapshot,
                @Nullable DungeonEditorSurface surface
        ) {
            return new src.domain.dungeon.published.DungeonEditorStateSnapshot(
                    toPublishedSelection(snapshot.selection()),
                    surface == null ? null : surface.inspector(),
                    toPublishedPreview(snapshot.preview()),
                    snapshot.statusText(),
                    toPublishedViewMode(snapshot.viewMode()),
                    toPublishedTool(snapshot.selectedTool()),
                    toPublishedOverlay(snapshot.overlaySettings()),
                    snapshot.projectionLevel());
        }

        private static List<src.domain.dungeon.published.DungeonMapSummary> publishedMapSummaries(
                List<src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary> maps
        ) {
            List<src.domain.dungeon.published.DungeonMapSummary> result = new ArrayList<>();
            for (src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary map
                    : maps == null ? List.<src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary>of() : maps) {
                result.add(toPublishedMapSummary(map));
            }
            return List.copyOf(result);
        }

        private static src.domain.dungeon.published.DungeonMapSummary toPublishedMapSummary(src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.@Nullable MapSummary map) {
            src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary safeMap = map == null
                    ? new src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary(new src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId(1L), "Dungeon Map", 0L)
                    : map;
            return new src.domain.dungeon.published.DungeonMapSummary(
                    new src.domain.dungeon.published.DungeonMapId(safeMap.mapId().value()),
                    safeMap.mapName(),
                    safeMap.revision());
        }

        private static @Nullable DungeonMapId toPublishedMapId(src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.@Nullable MapId mapId) {
            return mapId == null ? null : new src.domain.dungeon.published.DungeonMapId(mapId.value());
        }

        private static @Nullable DungeonEditorSurface toPublishedSurface(
                DungeonEditorSessionSnapshot.@Nullable SurfaceData surface
        ) {
            if (surface == null) {
                return null;
            }
            return new src.domain.dungeon.published.DungeonEditorSurface(
                    surface.mapName(),
                    surface.revision(),
                    toPublishedMap(surface.map()),
                    surface.previewMap() == null ? null : toPublishedMap(surface.previewMap()),
                    toPublishedInspector(surface.inspector()));
        }

        private static src.domain.dungeon.published.DungeonEditorMapSnapshot toPublishedMap(src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.@Nullable MapSnapshot map) {
            src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot safeMap = map == null
                    ? src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot.empty()
                    : map;
            return new src.domain.dungeon.published.DungeonEditorMapSnapshot(
                    safeMap.topology().name(),
                    safeMap.width(),
                    safeMap.height(),
                    toPublishedAreas(safeMap.areas()),
                    toPublishedBoundaries(safeMap.boundaries()),
                    toPublishedFeatures(safeMap.features()),
                    toPublishedEditorHandles(safeMap.editorHandles()));
        }

        private static List<src.domain.dungeon.published.DungeonEditorMapSnapshot.Area> toPublishedAreas(
                List<src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Area> areas
        ) {
            List<src.domain.dungeon.published.DungeonEditorMapSnapshot.Area> result = new ArrayList<>();
            for (src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Area area
                    : areas == null ? List.<src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Area>of() : areas) {
                result.add(toPublishedArea(area));
            }
            return List.copyOf(result);
        }

        private static src.domain.dungeon.published.DungeonEditorMapSnapshot.Area toPublishedArea(src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.@Nullable Area area) {
            if (area == null) {
                return new src.domain.dungeon.published.DungeonEditorMapSnapshot.Area(
                        "ROOM",
                        1L,
                        0L,
                        "ROOM",
                        List.of(),
                        src.domain.dungeon.published.DungeonEditorTopologyElementRef.empty());
            }
            return new src.domain.dungeon.published.DungeonEditorMapSnapshot.Area(
                    area.kind().name(),
                    area.id(),
                    area.clusterId(),
                    area.label(),
                    toPublishedCells(area.cells()),
                    toPublishedTopologyRef(area.topologyRef()));
        }

        private static List<src.domain.dungeon.published.DungeonEditorMapSnapshot.Boundary> toPublishedBoundaries(
                List<src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Boundary> boundaries
        ) {
            List<src.domain.dungeon.published.DungeonEditorMapSnapshot.Boundary> result = new ArrayList<>();
            for (src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Boundary boundary
                    : boundaries == null ? List.<src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Boundary>of() : boundaries) {
                result.add(toPublishedBoundary(boundary));
            }
            return List.copyOf(result);
        }

        private static src.domain.dungeon.published.DungeonEditorMapSnapshot.Boundary toPublishedBoundary(
                src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.@Nullable Boundary boundary
        ) {
            if (boundary == null) {
                return new src.domain.dungeon.published.DungeonEditorMapSnapshot.Boundary(
                        "boundary",
                        1L,
                        "boundary",
                        new src.domain.dungeon.published.DungeonEdgeRef(new src.domain.dungeon.published.DungeonCellRef(0, 0, 0), new src.domain.dungeon.published.DungeonCellRef(0, 0, 0)),
                        src.domain.dungeon.published.DungeonEditorTopologyElementRef.empty());
            }
            return new src.domain.dungeon.published.DungeonEditorMapSnapshot.Boundary(
                    boundary.kind().externalKind(),
                    boundary.id(),
                    boundary.label(),
                    toPublishedEdge(boundary.edge()),
                    toPublishedTopologyRef(boundary.topologyRef()));
        }

        private static List<src.domain.dungeon.published.DungeonEditorMapSnapshot.Feature> toPublishedFeatures(
                List<src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Feature> features
        ) {
            List<src.domain.dungeon.published.DungeonEditorMapSnapshot.Feature> result = new ArrayList<>();
            for (src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Feature feature
                    : features == null ? List.<src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Feature>of() : features) {
                result.add(toPublishedFeature(feature));
            }
            return List.copyOf(result);
        }

        private static src.domain.dungeon.published.DungeonEditorMapSnapshot.Feature toPublishedFeature(
                src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.@Nullable Feature feature
        ) {
            if (feature == null) {
                return new src.domain.dungeon.published.DungeonEditorMapSnapshot.Feature(
                        "STAIR",
                        1L,
                        "STAIR",
                        List.of(),
                        "",
                        "",
                        src.domain.dungeon.published.DungeonEditorTopologyElementRef.empty());
            }
            return new src.domain.dungeon.published.DungeonEditorMapSnapshot.Feature(
                    feature.kind().name(),
                    feature.id(),
                    feature.label(),
                    toPublishedCells(feature.cells()),
                    feature.description(),
                    feature.destinationLabel(),
                    toPublishedTopologyRef(feature.topologyRef()));
        }

        private static List<src.domain.dungeon.published.DungeonEditorHandleSnapshot> toPublishedEditorHandles(
                List<src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Handle> handles
        ) {
            List<src.domain.dungeon.published.DungeonEditorHandleSnapshot> result = new ArrayList<>();
            for (src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Handle handle
                    : handles == null ? List.<src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Handle>of() : handles) {
                result.add(toPublishedEditorHandle(handle));
            }
            return List.copyOf(result);
        }

        private static src.domain.dungeon.published.DungeonEditorHandleSnapshot toPublishedEditorHandle(
                src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.@Nullable Handle handle
        ) {
            if (handle == null) {
                return new src.domain.dungeon.published.DungeonEditorHandleSnapshot(
                        src.domain.dungeon.published.DungeonEditorHandleRef.empty(),
                        "CLUSTER_LABEL",
                        new src.domain.dungeon.published.DungeonCellRef(0, 0, 0));
            }
            return new src.domain.dungeon.published.DungeonEditorHandleSnapshot(
                    toPublishedHandleRefOrEmpty(handle.ref()),
                    handle.label(),
                    toPublishedCell(handle.cell()));
        }

        private static List<src.domain.dungeon.published.DungeonCellRef> toPublishedCells(List<src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Cell> cells) {
            List<src.domain.dungeon.published.DungeonCellRef> result = new ArrayList<>();
            for (src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Cell cell
                    : cells == null ? List.<src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Cell>of() : cells) {
                result.add(toPublishedCell(cell));
            }
            return List.copyOf(result);
        }

        private static @Nullable DungeonInspectorSnapshot toPublishedInspector(
                src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.@Nullable Inspector inspector
        ) {
            if (inspector == null) {
                return null;
            }
            return new src.domain.dungeon.published.DungeonInspectorSnapshot(
                    inspector.title(),
                    inspector.summary(),
                    inspector.facts(),
                    toPublishedRoomNarrationCards(inspector.roomNarrations()));
        }

        private static List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard> toPublishedRoomNarrationCards(
                List<src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.RoomNarrationCard> cards
        ) {
            List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard> result = new ArrayList<>();
            for (src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.RoomNarrationCard card
                    : cards == null ? List.<src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.RoomNarrationCard>of() : cards) {
                result.add(toPublishedRoomNarrationCard(card));
            }
            return List.copyOf(result);
        }

        private static src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard toPublishedRoomNarrationCard(
                src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.@Nullable RoomNarrationCard card
        ) {
            src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.RoomNarrationCard safeCard = card == null
                    ? new src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.RoomNarrationCard(0L, "Raum", "", List.of())
                    : card;
            return new src.domain.dungeon.published.DungeonInspectorSnapshot.RoomNarrationCard(
                    safeCard.roomId(),
                    safeCard.roomName(),
                    safeCard.visualDescription(),
                    toPublishedRoomExits(safeCard.exits()));
        }

        private static List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomExitNarration> toPublishedRoomExits(
                List<src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.RoomExitNarration> exits
        ) {
            List<src.domain.dungeon.published.DungeonInspectorSnapshot.RoomExitNarration> result = new ArrayList<>();
            for (src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.RoomExitNarration exit
                    : exits == null ? List.<src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.RoomExitNarration>of() : exits) {
                result.add(toPublishedRoomExit(exit));
            }
            return List.copyOf(result);
        }

        private static src.domain.dungeon.published.DungeonInspectorSnapshot.RoomExitNarration toPublishedRoomExit(
                src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.@Nullable RoomExitNarration exit
        ) {
            src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.RoomExitNarration safeExit = exit == null
                    ? new src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.RoomExitNarration("", src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Cell.empty(), "", "")
                    : exit;
            return new src.domain.dungeon.published.DungeonInspectorSnapshot.RoomExitNarration(
                    safeExit.label(),
                    toPublishedCell(safeExit.cell()),
                    safeExit.direction(),
                    safeExit.description());
        }

        private static src.domain.dungeon.published.DungeonOverlaySettings toPublishedOverlay(
                DungeonEditorSessionValues.@Nullable OverlaySettings overlay
        ) {
            DungeonEditorSessionValues.OverlaySettings safeOverlay = overlay == null
                    ? DungeonEditorSessionValues.OverlaySettings.defaults()
                    : overlay;
            return new src.domain.dungeon.published.DungeonOverlaySettings(
                    safeOverlay.modeKey(),
                    safeOverlay.levelRange(),
                    safeOverlay.opacity(),
                    safeOverlay.selectedLevels());
        }

        private static src.domain.dungeon.published.DungeonEditorStateSnapshot.Selection toPublishedSelection(
                DungeonEditorSessionValues.@Nullable Selection selection
        ) {
            DungeonEditorSessionValues.Selection safeSelection = selection == null
                    ? DungeonEditorSessionValues.Selection.empty()
                    : selection;
            return new src.domain.dungeon.published.DungeonEditorStateSnapshot.Selection(
                    toPublishedTopologyRef(safeSelection.topologyRef()),
                    safeSelection.clusterId(),
                    safeSelection.clusterSelection(),
                    safeSelection.handleRef().equals(DungeonEditorSessionValues.emptyHandleRef())
                            ? null
                            : toPublishedHandleRefOrEmpty(safeSelection.handleRef()));
        }

        private static src.domain.dungeon.published.DungeonEditorPreview toPublishedPreview(DungeonEditorSessionValues.@Nullable Preview preview) {
            if (preview == null || preview == DungeonEditorSessionValues.Preview.none()) {
                return src.domain.dungeon.published.DungeonEditorPreview.none();
            }
            return switch (preview) {
                case DungeonEditorSessionValues.RoomRectanglePreview room ->
                        new src.domain.dungeon.published.DungeonEditorPreview.RoomRectanglePreview(
                                toPublishedCell(room.start()),
                                toPublishedCell(room.end()),
                                room.deleteMode());
                case DungeonEditorSessionValues.ClusterBoundariesPreview boundaries ->
                        new src.domain.dungeon.published.DungeonEditorPreview.ClusterBoundariesPreview(
                                boundaries.clusterId(),
                                toPublishedEdges(boundaries.edges()),
                                boundaries.boundaryKind().name(),
                                boundaries.deleteMode());
                case DungeonEditorSessionValues.MoveHandlePreview moveHandle ->
                        new src.domain.dungeon.published.DungeonEditorPreview.MoveHandlePreview(
                                toPublishedHandleRefOrEmpty(moveHandle.handleRef()),
                                moveHandle.deltaQ(),
                                moveHandle.deltaR(),
                                moveHandle.deltaLevel());
                case DungeonEditorSessionValues.MoveBoundaryStretchPreview stretch ->
                        new src.domain.dungeon.published.DungeonEditorPreview.MoveBoundaryStretchPreview(
                                stretch.clusterId(),
                                toPublishedEdges(stretch.sourceEdges()),
                                stretch.deltaQ(),
                                stretch.deltaR(),
                                stretch.deltaLevel());
                case DungeonEditorSessionValues.CorridorCreatePreview ignored -> src.domain.dungeon.published.DungeonEditorPreview.none();
                case DungeonEditorSessionValues.DeleteCorridorPreview ignored -> src.domain.dungeon.published.DungeonEditorPreview.none();
                case DungeonEditorSessionValues.NoPreview ignored -> src.domain.dungeon.published.DungeonEditorPreview.none();
            };
        }

        private static List<src.domain.dungeon.published.DungeonEdgeRef> toPublishedEdges(List<src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Edge> edges) {
            List<src.domain.dungeon.published.DungeonEdgeRef> result = new ArrayList<>();
            for (src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Edge edge
                    : edges == null ? List.<src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.Edge>of() : edges) {
                result.add(toPublishedEdge(edge));
            }
            return List.copyOf(result);
        }

        private static DungeonEditorViewMode toPublishedViewMode(DungeonEditorSessionValues.@Nullable ViewMode viewMode) {
            return viewMode != null && "GRAPH".equals(viewMode.name())
                    ? DungeonEditorViewMode.GRAPH
                    : DungeonEditorViewMode.GRID;
        }

        private static DungeonEditorTool toPublishedTool(DungeonEditorSessionValues.@Nullable Tool tool) {
            return tool == null ? DungeonEditorTool.SELECT : DungeonEditorTool.valueOf(tool.name());
        }

        private static src.domain.dungeon.published.DungeonEditorHandleRef toPublishedHandleRefOrEmpty(
                src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.@Nullable HandleRef handleRef
        ) {
            if (handleRef == null) {
                return src.domain.dungeon.published.DungeonEditorHandleRef.empty();
            }
            return new src.domain.dungeon.published.DungeonEditorHandleRef(
                    src.domain.dungeon.published.DungeonEditorHandleKind.valueOf(handleRef.kind().name()),
                    toDomainTopologyRef(handleRef.topologyRef()),
                    handleRef.ownerId(),
                    handleRef.clusterId(),
                    handleRef.corridorId(),
                    handleRef.roomId(),
                    handleRef.index(),
                    toPublishedCell(handleRef.cell()),
                    handleRef.direction());
        }

        private static src.domain.dungeon.published.DungeonTopologyElementRef toDomainTopologyRef(@Nullable DungeonTopologyRef ref) {
            return ref == null
                    ? src.domain.dungeon.published.DungeonTopologyElementRef.empty()
                    : new src.domain.dungeon.published.DungeonTopologyElementRef(src.domain.dungeon.published.DungeonTopologyElementKind.valueOf(ref.kind().name()), ref.id());
        }

        private static src.domain.dungeon.published.DungeonEditorTopologyElementRef toPublishedTopologyRef(@Nullable DungeonTopologyRef ref) {
            return ref == null
                    ? src.domain.dungeon.published.DungeonEditorTopologyElementRef.empty()
                    : new src.domain.dungeon.published.DungeonEditorTopologyElementRef(ref.kind().name(), ref.id());
        }

        private static src.domain.dungeon.published.DungeonCellRef toPublishedCell(src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.@Nullable Cell mapCell) {
            return mapCell == null
                    ? new src.domain.dungeon.published.DungeonCellRef(0, 0, 0)
                    : new src.domain.dungeon.published.DungeonCellRef(mapCell.q(), mapCell.r(), mapCell.level());
        }

        private static src.domain.dungeon.published.DungeonEdgeRef toPublishedEdge(src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.@Nullable Edge mapEdge) {
            if (mapEdge == null) {
                return new src.domain.dungeon.published.DungeonEdgeRef(new src.domain.dungeon.published.DungeonCellRef(0, 0, 0), new src.domain.dungeon.published.DungeonCellRef(0, 0, 0));
            }
            return new src.domain.dungeon.published.DungeonEdgeRef(toPublishedCell(mapEdge.from()), toPublishedCell(mapEdge.to()));
        }

        private record SurfaceContext(
                @Nullable DungeonEditorSurface surface,
                List<Integer> reachableLevels,
                boolean surfacePresent
        ) {
        }
    }
}
