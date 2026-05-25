package src.domain.dungeon;

import src.domain.dungeon.published.DungeonTopologyKind;

final class DungeonTravelRuntimeMapProjectionServiceAssembly {

    private DungeonTravelRuntimeMapProjectionServiceAssembly() {
    }

    static src.domain.dungeon.published.DungeonMapSnapshot mapSnapshot(
            src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface.MapData map
    ) {
        src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface.MapData safeMap =
                map == null ? src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface.MapData.empty() : map;
        return new src.domain.dungeon.published.DungeonMapSnapshot(
                DungeonTopologyKind.valueOf(safeMap.topology().name()),
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream().map(DungeonTravelRuntimeMapProjectionServiceAssembly::area).toList(),
                safeMap.boundaries().stream().map(DungeonTravelRuntimeMapProjectionServiceAssembly::boundary).toList(),
                safeMap.features().stream().map(DungeonTravelRuntimeMapProjectionServiceAssembly::feature).toList());
    }

    private static src.domain.dungeon.published.DungeonAreaSnapshot area(
            src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface.AreaData area
    ) {
        return new src.domain.dungeon.published.DungeonAreaSnapshot(
                src.domain.dungeon.published.DungeonAreaKind.valueOf(area.kind().name()),
                area.id(),
                area.label(),
                area.cells().stream().map(DungeonPublishedMapProjectionServiceAssembly::cell).toList());
    }

    private static src.domain.dungeon.published.DungeonBoundarySnapshot boundary(
            src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface.BoundaryData boundary
    ) {
        return new src.domain.dungeon.published.DungeonBoundarySnapshot(
                boundary.doorBoundary() ? "door" : "wall",
                boundary.id(),
                boundary.label(),
                new src.domain.dungeon.published.DungeonEdgeRef(
                        DungeonPublishedMapProjectionServiceAssembly.cell(boundary.edge().from()),
                        DungeonPublishedMapProjectionServiceAssembly.cell(boundary.edge().to())));
    }

    private static src.domain.dungeon.published.DungeonFeatureSnapshot feature(
            src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface.FeatureData feature
    ) {
        return new src.domain.dungeon.published.DungeonFeatureSnapshot(
                src.domain.dungeon.published.DungeonFeatureKind.valueOf(feature.kind().name()),
                feature.id(),
                feature.label(),
                feature.cells().stream().map(DungeonPublishedMapProjectionServiceAssembly::cell).toList(),
                feature.description(),
                feature.destinationLabel());
    }
}
