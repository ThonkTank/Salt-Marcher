package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
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
import src.domain.dungeon.model.travel.usecase.ApplyTravelDungeonSessionUseCase;
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

    private final TravelRuntimePublishedState publishedState = new TravelRuntimePublishedState();
    private final ApplyTravelDungeonSessionUseCase applyUseCase;

    DungeonTravelRuntimeServiceAssembly(TravelDungeonSessionRepository repository) {
        applyUseCase = new ApplyTravelDungeonSessionUseCase(repository);
        publishedState.publishSessionSnapshot(applyUseCase.snapshot());
    }

    DungeonTravelRuntimeApplicationService applicationService() {
        return new DungeonTravelRuntimeApplicationService(applyUseCase, new TravelRuntimePublication());
    }

    TravelDungeonModel travelModel() {
        return publishedState.travelModel();
    }

    private final class TravelRuntimePublication
            implements DungeonTravelRuntimeApplicationService.TravelRuntimePublication {

        @Override
        public void publishCurrentSession() {
            publishedState.publishSessionSnapshot(applyUseCase.snapshot());
        }
    }

    private static final class TravelRuntimePublishedState {

        private final PublishedChannel<TravelDungeonSnapshot> travel =
                new PublishedChannel<>(TravelDungeonSnapshot.empty());
        private final TravelDungeonModel travelModel = new TravelDungeonModel(
                travel::current,
                travel::subscribe);

        private TravelDungeonModel travelModel() {
            return travelModel;
        }

        private void publishSessionSnapshot(SnapshotData snapshot) {
            travel.publish(toPublishedSnapshot(snapshot));
        }

        private static TravelDungeonSnapshot toPublishedSnapshot(SnapshotData snapshot) {
            SnapshotData safeSnapshot = snapshot == null
                    ? new SnapshotData(null, TravelOverlayState.defaults(), 0)
                    : snapshot;
            SurfaceData surface = safeSnapshot.surface();
            return new TravelDungeonSnapshot(
                    workspaceState(surface),
                    surfaceSnapshot(surface),
                    overlaySettings(safeSnapshot.overlayState()),
                    safeSnapshot.projectionLevel());
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
                    surface.actions().stream().map(TravelRuntimePublishedState::workspaceAction).toList());
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
                    surface.actions().stream().map(TravelRuntimePublishedState::surfaceAction).toList());
        }

        private static DungeonMapSnapshot travelMapSnapshot(MapData map) {
            MapData safeMap = map == null ? MapData.empty() : map;
            return new DungeonMapSnapshot(
                    DungeonTopologyKind.valueOf(safeMap.topology().name()),
                    safeMap.width(),
                    safeMap.height(),
                    safeMap.areas().stream().map(TravelRuntimePublishedState::area).toList(),
                    safeMap.boundaries().stream().map(TravelRuntimePublishedState::boundary).toList(),
                    safeMap.features().stream().map(TravelRuntimePublishedState::feature).toList());
        }

        private static DungeonAreaSnapshot area(AreaData area) {
            return new DungeonAreaSnapshot(
                    DungeonAreaKind.valueOf(area.kind().name()),
                    area.id(),
                    area.label(),
                    area.cells().stream().map(TravelRuntimePublishedState::cell).toList());
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
                    feature.cells().stream().map(TravelRuntimePublishedState::cell).toList(),
                    feature.description(),
                    feature.destinationLabel());
        }

        private static DungeonCellRef cell(DungeonCell cell) {
            DungeonCell safeCell = cell == null ? new DungeonCell(0, 0, 0) : cell;
            return new DungeonCellRef(safeCell.q(), safeCell.r(), safeCell.level());
        }

        private static DungeonTravelPosition travelPosition(PositionData position) {
            PositionData safePosition = position == null
                    ? new PositionData(1L, null, 0L, new DungeonCell(0, 0, 0), "SOUTH")
                    : position;
            return new DungeonTravelPosition(
                    new DungeonMapId(safePosition.mapId()),
                    DungeonTravelLocationKind.valueOf(safePosition.locationKind().name()),
                    safePosition.ownerId(),
                    cell(safePosition.tile()),
                    DungeonTravelHeading.valueOf(safePosition.headingToken()));
        }

        private static DungeonTravelActionSnapshot surfaceAction(AvailableAction action) {
            AvailableAction safeAction = action == null
                    ? new AvailableAction("", "Aktion", "")
                    : action;
            return new DungeonTravelActionSnapshot(
                    safeAction.id(),
                    DungeonTravelActionKind.TRAVERSAL,
                    safeAction.displayLabel(),
                    "",
                    safeAction.helpText());
        }

        private static TravelDungeonAction workspaceAction(AvailableAction action) {
            AvailableAction safeAction = action == null
                    ? new AvailableAction("", "Aktion", "")
                    : action;
            return new TravelDungeonAction(
                    safeAction.id(),
                    safeAction.displayLabel(),
                    safeAction.helpText());
        }
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
