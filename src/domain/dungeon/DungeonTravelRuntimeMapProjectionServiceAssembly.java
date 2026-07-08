package src.domain.dungeon;

import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonTopologyKind;

final class DungeonTravelRuntimeMapProjectionServiceAssembly {

    private DungeonTravelRuntimeMapProjectionServiceAssembly() {
    }

    static src.domain.dungeon.published.DungeonMapSnapshot mapSnapshot(
            src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.MapData map
    ) {
        src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.MapData safeMap =
                map == null ? src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.MapData.empty() : map;
        return new src.domain.dungeon.published.DungeonMapSnapshot(
                DungeonTopologyKind.valueOf(safeMap.topology().name()),
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream().map(DungeonTravelRuntimeMapProjectionServiceAssembly::area).toList(),
                safeMap.boundaries().stream().map(DungeonTravelRuntimeMapProjectionServiceAssembly::boundary).toList(),
                safeMap.features().stream().map(DungeonTravelRuntimeMapProjectionServiceAssembly::feature).toList());
    }

    private static src.domain.dungeon.published.DungeonAreaSnapshot area(
            src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.AreaData area
    ) {
        return new src.domain.dungeon.published.DungeonAreaSnapshot(
                src.domain.dungeon.published.DungeonAreaKind.valueOf(area.kind().name()),
                area.id(),
                0L,
                area.label(),
                area.cells().stream().map(DungeonTravelRuntimeMapProjectionServiceAssembly::cell).toList(),
                topologyRef(area.topologyRef()));
    }

    private static src.domain.dungeon.published.DungeonBoundarySnapshot boundary(
            src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.BoundaryData boundary
    ) {
        return new src.domain.dungeon.published.DungeonBoundarySnapshot(
                boundary.doorBoundary() ? "door" : "wall",
                boundary.id(),
                boundary.label(),
                edge(boundary.edge()),
                topologyRef(boundary.topologyRef()));
    }

    private static src.domain.dungeon.published.DungeonFeatureSnapshot feature(
            src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.FeatureData feature
    ) {
        return new src.domain.dungeon.published.DungeonFeatureSnapshot(
                src.domain.dungeon.published.DungeonFeatureKind.valueOf(feature.kind().name()),
                feature.id(),
                feature.label(),
                feature.cells().stream().map(DungeonTravelRuntimeMapProjectionServiceAssembly::cell).toList(),
                feature.description(),
                feature.destinationLabel(),
                topologyRef(feature.topologyRef()),
                null);
    }

    private static src.domain.dungeon.published.DungeonCellRef cell(Cell cell) {
        Cell safeCell = cell == null ? new Cell(0, 0, 0) : cell;
        return new src.domain.dungeon.published.DungeonCellRef(
                safeCell.q(),
                safeCell.r(),
                safeCell.level());
    }

    private static src.domain.dungeon.published.DungeonEdgeRef edge(Edge edge) {
        Edge safeEdge = edge == null
                ? new Edge(new Cell(0, 0, 0), new Cell(0, 0, 0))
                : edge;
        return new src.domain.dungeon.published.DungeonEdgeRef(cell(safeEdge.from()), cell(safeEdge.to()));
    }

    private static src.domain.dungeon.published.DungeonTopologyElementRef topologyRef(DungeonTopologyRef ref) {
        if (ref == null) {
            return src.domain.dungeon.published.DungeonTopologyElementRef.empty();
        }
        return new src.domain.dungeon.published.DungeonTopologyElementRef(
                publishedTopologyKind(ref),
                ref.id());
    }

    private static src.domain.dungeon.published.DungeonTopologyElementKind publishedTopologyKind(
            DungeonTopologyRef ref
    ) {
        try {
            return src.domain.dungeon.published.DungeonTopologyElementKind.valueOf(ref.kind().name());
        } catch (IllegalArgumentException exception) {
            return src.domain.dungeon.published.DungeonTopologyElementKind.EMPTY;
        }
    }
}
