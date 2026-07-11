package src.domain.dungeon;

import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.AreaData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.BoundaryData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.FeatureData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.MapData;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonTopologyElementKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.DungeonTopologyKind;

final class DungeonTravelPublishedMapProjection {

    private DungeonTravelPublishedMapProjection() {
    }

    static DungeonMapSnapshot mapSnapshot(MapData map) {
        MapData safeMap = map == null ? MapData.empty() : map;
        return new DungeonMapSnapshot(
                DungeonTopologyKind.valueOf(safeMap.topology().name()),
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream().map(DungeonTravelPublishedMapProjection::area).toList(),
                safeMap.boundaries().stream().map(DungeonTravelPublishedMapProjection::boundary).toList(),
                safeMap.features().stream().map(DungeonTravelPublishedMapProjection::feature).toList());
    }

    static DungeonCellRef cell(Cell cell) {
        Cell safeCell = cell == null ? new Cell(0, 0, 0) : cell;
        return new DungeonCellRef(
                safeCell.q(),
                safeCell.r(),
                safeCell.level());
    }

    private static DungeonAreaSnapshot area(AreaData area) {
        return new DungeonAreaSnapshot(
                DungeonAreaKind.valueOf(area.kind().name()),
                area.id(),
                0L,
                area.label(),
                area.cells().stream().map(DungeonTravelPublishedMapProjection::cell).toList(),
                topologyRef(area.topologyRef()));
    }

    private static DungeonBoundarySnapshot boundary(BoundaryData boundary) {
        return new DungeonBoundarySnapshot(
                boundary.doorBoundary() ? "door" : "wall",
                boundary.id(),
                boundary.label(),
                edge(boundary.edge()),
                topologyRef(boundary.topologyRef()));
    }

    private static DungeonFeatureSnapshot feature(FeatureData feature) {
        return new DungeonFeatureSnapshot(
                DungeonFeatureKind.valueOf(feature.kind().name()),
                feature.id(),
                feature.label(),
                feature.cells().stream().map(DungeonTravelPublishedMapProjection::cell).toList(),
                feature.description(),
                feature.destinationLabel(),
                topologyRef(feature.topologyRef()),
                null);
    }

    private static DungeonEdgeRef edge(Edge edge) {
        Edge safeEdge = edge == null
                ? new Edge(new Cell(0, 0, 0), new Cell(0, 0, 0))
                : edge;
        return new DungeonEdgeRef(cell(safeEdge.from()), cell(safeEdge.to()));
    }

    private static DungeonTopologyElementRef topologyRef(DungeonTopologyRef ref) {
        if (ref == null) {
            return DungeonTopologyElementRef.empty();
        }
        return new DungeonTopologyElementRef(
                publishedTopologyKind(ref),
                ref.id());
    }

    private static DungeonTopologyElementKind publishedTopologyKind(DungeonTopologyRef ref) {
        try {
            return DungeonTopologyElementKind.valueOf(ref.kind().name());
        } catch (IllegalArgumentException exception) {
            return DungeonTopologyElementKind.EMPTY;
        }
    }
}
