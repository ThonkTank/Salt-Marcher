package src.domain.dungeon.model.runtime.travel.projection;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues;
import src.domain.dungeon.model.core.projection.DungeonAreaFacts;
import src.domain.dungeon.model.core.projection.DungeonBoundaryFacts;
import src.domain.dungeon.model.core.projection.DungeonFeatureFacts;
import src.domain.dungeon.model.core.projection.DungeonMapFacts;

final class TravelSurfaceMapProjectionMapper {

    private TravelSurfaceMapProjectionMapper() {
    }

    static TravelDungeonSessionSurface.MapData toRuntimeMap(@Nullable DungeonMapFacts map) {
        if (map == null) {
            return TravelDungeonSessionSurface.MapData.empty();
        }
        return new TravelDungeonSessionSurface.MapData(
                TravelDungeonSessionValues.TopologyKind.fromName(map.topology().name()),
                map.width(),
                map.height(),
                toRuntimeAreas(map.areas()),
                toRuntimeBoundaries(map.boundaries()),
                toRuntimeFeatures(map.features()));
    }

    private static List<TravelDungeonSessionSurface.AreaData> toRuntimeAreas(List<DungeonAreaFacts> areas) {
        if (areas == null || areas.isEmpty()) {
            return List.of();
        }
        List<TravelDungeonSessionSurface.AreaData> result = new ArrayList<>();
        for (DungeonAreaFacts area : areas) {
            if (area != null) {
                result.add(toRuntimeArea(area));
            }
        }
        return List.copyOf(result);
    }

    private static TravelDungeonSessionSurface.AreaData toRuntimeArea(DungeonAreaFacts area) {
        return new TravelDungeonSessionSurface.AreaData(
                TravelDungeonSessionValues.AreaKind.fromName(area.kind().name()),
                area.id(),
                area.label(),
                area.cells().stream().map(TravelGeometryProjectionMapper::toCoreCell).toList());
    }

    private static List<TravelDungeonSessionSurface.BoundaryData> toRuntimeBoundaries(
            List<DungeonBoundaryFacts> boundaries
    ) {
        if (boundaries == null || boundaries.isEmpty()) {
            return List.of();
        }
        List<TravelDungeonSessionSurface.BoundaryData> result = new ArrayList<>();
        for (DungeonBoundaryFacts boundary : boundaries) {
            if (boundary != null) {
                result.add(toRuntimeBoundary(boundary));
            }
        }
        return List.copyOf(result);
    }

    private static TravelDungeonSessionSurface.BoundaryData toRuntimeBoundary(DungeonBoundaryFacts boundary) {
        return new TravelDungeonSessionSurface.BoundaryData(
                "door".equalsIgnoreCase(boundary.kind()),
                boundary.id(),
                boundary.label(),
                TravelGeometryProjectionMapper.toCoreEdge(boundary.edge()));
    }

    private static List<TravelDungeonSessionSurface.FeatureData> toRuntimeFeatures(List<DungeonFeatureFacts> features) {
        if (features == null || features.isEmpty()) {
            return List.of();
        }
        List<TravelDungeonSessionSurface.FeatureData> result = new ArrayList<>();
        for (DungeonFeatureFacts feature : features) {
            if (feature != null) {
                result.add(toRuntimeFeature(feature));
            }
        }
        return List.copyOf(result);
    }

    private static TravelDungeonSessionSurface.FeatureData toRuntimeFeature(DungeonFeatureFacts feature) {
        return new TravelDungeonSessionSurface.FeatureData(
                TravelDungeonSessionValues.FeatureKind.fromName(feature.kind().name()),
                feature.id(),
                feature.label(),
                feature.cells().stream().map(TravelGeometryProjectionMapper::toCoreCell).toList(),
                feature.description(),
                feature.destinationLabel());
    }
}
