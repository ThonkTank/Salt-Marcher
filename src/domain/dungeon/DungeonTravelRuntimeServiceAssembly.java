package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSnapshot.SnapshotData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.AvailableAction;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.AreaData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.BoundaryData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.FeatureData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.MapData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.TravelOverlayState;
import src.domain.dungeon.model.travel.repository.TravelDungeonSessionRepository;
import src.domain.dungeon.model.travel.repository.TravelDungeonSessionPublishedStateRepository;
import src.domain.dungeon.model.travel.usecase.ApplyTravelDungeonSessionUseCase;
import src.domain.dungeon.model.travel.usecase.PublishTravelDungeonSessionUseCase;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeon.published.DungeonTravelActionKind;
import src.domain.dungeon.published.DungeonTravelActionSnapshot;
import src.domain.dungeon.published.DungeonTravelContextKind;
import src.domain.dungeon.published.DungeonTravelHeading;
import src.domain.dungeon.published.DungeonTravelLocationKind;
import src.domain.dungeon.published.DungeonTravelPosition;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;
import src.domain.dungeon.published.TravelDungeonAction;
import src.domain.dungeon.published.TravelDungeonModel;
import src.domain.dungeon.published.TravelDungeonSnapshot;
import src.domain.dungeon.published.TravelDungeonWorkspaceState;

final class DungeonTravelRuntimeServiceAssembly {

    private final PublishTravelDungeonSessionUseCase publishUseCase;
    private final TravelDungeonModel travelModel;

    DungeonTravelRuntimeServiceAssembly(TravelDungeonSessionRepository repository) {
        ApplyTravelDungeonSessionUseCase applyUseCase =
                new ApplyTravelDungeonSessionUseCase(Objects.requireNonNull(repository, "repository"));
        PublishedState publishedState = new PublishedState(applyUseCase::snapshot);
        publishUseCase = new PublishTravelDungeonSessionUseCase(applyUseCase, publishedState);
        travelModel = publishedState.travelModel();
    }

    DungeonTravelRuntimeApplicationService applicationService() {
        return new DungeonTravelRuntimeApplicationService(publishUseCase);
    }

    TravelDungeonModel travelModel() {
        return travelModel;
    }

    private static final class PublishedState implements TravelDungeonSessionPublishedStateRepository {

        private final Supplier<SnapshotData> snapshotSource;
        private final List<Consumer<TravelDungeonSnapshot>> listeners = new ArrayList<>();
        private final TravelDungeonModel travelModel = new TravelDungeonModel(this::currentSnapshot, this::subscribe);
        private TravelDungeonSnapshot currentSnapshot = TravelDungeonSnapshot.empty();
        private boolean initialized;

        private PublishedState(Supplier<SnapshotData> snapshotSource) {
            this.snapshotSource = Objects.requireNonNull(snapshotSource, "snapshotSource");
        }

        private TravelDungeonModel travelModel() {
            return travelModel;
        }

        @Override
        public void publishCurrentSession(SnapshotData snapshot) {
            currentSnapshot = toPublishedSnapshot(snapshot);
            initialized = true;
            for (Consumer<TravelDungeonSnapshot> listener : List.copyOf(listeners)) {
                listener.accept(currentSnapshot);
            }
        }

        private TravelDungeonSnapshot currentSnapshot() {
            if (!initialized) {
                currentSnapshot = toPublishedSnapshot(snapshotSource.get());
                initialized = true;
            }
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
