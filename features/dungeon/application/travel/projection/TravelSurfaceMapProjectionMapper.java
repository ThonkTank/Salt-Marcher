package features.dungeon.application.travel.projection;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.projection.DungeonAreaFacts;
import features.dungeon.domain.core.projection.DungeonBoundaryFacts;
import features.dungeon.domain.core.projection.DungeonFeatureFacts;
import features.dungeon.domain.core.projection.DungeonFeatureType;
import features.dungeon.domain.core.projection.DungeonMapFacts;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.AreaKind;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.FeatureKind;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.TopologyKind;

final class TravelSurfaceMapProjectionMapper {

    private TravelSurfaceMapProjectionMapper() {
    }

    static TravelDungeonSessionSurface.MapData toRuntimeMap(@Nullable DungeonMapFacts map) {
        if (map == null) {
            return TravelDungeonSessionSurface.MapData.empty();
        }
        return new TravelDungeonSessionSurface.MapData(
                map.topology() == features.dungeon.domain.core.geometry.DungeonTopology.HEX
                        ? TopologyKind.HEX
                        : TopologyKind.SQUARE,
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
                area.kind() == features.dungeon.domain.core.projection.DungeonAreaType.CORRIDOR
                        ? AreaKind.CORRIDOR
                        : AreaKind.ROOM,
                area.id(),
                area.label(),
                area.cells().stream().map(TravelGeometryProjectionMapper::cellOrOrigin).toList(),
                area.topologyRef());
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
                TravelGeometryProjectionMapper.edgeOrOrigin(boundary.edge()),
                boundary.topologyRef());
    }

    private static List<TravelDungeonSessionSurface.FeatureData> toRuntimeFeatures(List<DungeonFeatureFacts> features) {
        if (features == null || features.isEmpty()) {
            return List.of();
        }
        List<TravelDungeonSessionSurface.FeatureData> result = new ArrayList<>();
        for (DungeonFeatureFacts feature : features) {
            if (isTravelFeature(feature)) {
                result.add(toRuntimeFeature(feature));
            }
        }
        return List.copyOf(result);
    }

    private static boolean isTravelFeature(DungeonFeatureFacts feature) {
        return feature != null
                && (feature.kind() == DungeonFeatureType.STAIR || feature.kind() == DungeonFeatureType.TRANSITION);
    }

    private static TravelDungeonSessionSurface.FeatureData toRuntimeFeature(DungeonFeatureFacts feature) {
        return new TravelDungeonSessionSurface.FeatureData(
                feature.kind() == DungeonFeatureType.TRANSITION
                        ? FeatureKind.TRANSITION
                        : FeatureKind.STAIR,
                feature.id(),
                feature.label(),
                feature.cells().stream().map(TravelGeometryProjectionMapper::cellOrOrigin).toList(),
                feature.description(),
                feature.destinationLabel(),
                feature.topologyRef());
    }
}
