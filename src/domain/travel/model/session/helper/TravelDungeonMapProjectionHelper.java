package src.domain.travel.model.session.helper;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonMapProjectionContent;
import src.domain.travel.application.ApplyTravelDungeonSessionUseCase;
import src.domain.travel.published.TravelDungeonMapProjectionSnapshot;

public final class TravelDungeonMapProjectionHelper {

    private TravelDungeonMapProjectionHelper() {
    }

    public static @Nullable TravelDungeonMapProjectionSnapshot projection(
            ApplyTravelDungeonSessionUseCase.@Nullable SurfaceData surface
    ) {
        if (surface == null || surface.contextKind() != ApplyTravelDungeonSessionUseCase.ContextKind.DUNGEON) {
            return null;
        }
        ProjectionAccumulator projection = assemble(surface.map());
        ApplyTravelDungeonSessionUseCase.MapData map = surface.map();
        return new TravelDungeonMapProjectionSnapshot(
                surface.mapName(),
                TravelDungeonMapProjectionValueHelper.topology(map.topology()),
                map.width(),
                map.height(),
                new DungeonMapProjectionContent<>(
                        projection.cells(),
                        projection.edges(),
                        projection.labels(),
                        projection.markers(),
                        projection.graphNodes(),
                        projection.graphLinks()),
                partyToken(surface.position()));
    }

    private static ProjectionAccumulator assemble(ApplyTravelDungeonSessionUseCase.MapData map) {
        ProjectionAccumulator projection = new ProjectionAccumulator(
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>());
        renderAreas(map, projection.cells(), projection.graphNodes());
        renderBoundaries(map, projection.edges());
        renderFeatures(map, projection.cells(), projection.labels(), projection.markers());
        addFallbackGraphLinks(projection.graphNodes(), projection.graphLinks());
        return projection;
    }

    private static void renderAreas(
            ApplyTravelDungeonSessionUseCase.MapData map,
            List<TravelDungeonMapProjectionSnapshot.CellProjection> cells,
            List<TravelDungeonMapProjectionSnapshot.GraphNodeProjection> graphNodes
    ) {
        for (ApplyTravelDungeonSessionUseCase.AreaData area : map.areas()) {
            List<TravelDungeonMapProjectionSnapshot.CellProjection> areaCells = area.cells().stream()
                    .map(cell -> TravelDungeonMapProjectionValueHelper.cell(area, cell))
                    .toList();
            cells.addAll(areaCells);
            if (areaCells.isEmpty()) {
                continue;
            }
            CellCenter center = centerOf(areaCells);
            graphNodes.add(new TravelDungeonMapProjectionSnapshot.GraphNodeProjection(
                    area.id(),
                    0L,
                    area.label(),
                    center.q(),
                    center.r(),
                    false));
        }
    }

    private static void renderBoundaries(
            ApplyTravelDungeonSessionUseCase.MapData map,
            List<TravelDungeonMapProjectionSnapshot.EdgeProjection> edges
    ) {
        for (ApplyTravelDungeonSessionUseCase.BoundaryData boundary : map.boundaries()) {
            edges.add(TravelDungeonMapProjectionValueHelper.edge(boundary));
        }
    }

    private static void renderFeatures(
            ApplyTravelDungeonSessionUseCase.MapData map,
            List<TravelDungeonMapProjectionSnapshot.CellProjection> cells,
            List<TravelDungeonMapProjectionSnapshot.LabelProjection> labels,
            List<TravelDungeonMapProjectionSnapshot.MarkerProjection> markers
    ) {
        for (ApplyTravelDungeonSessionUseCase.FeatureData feature : map.features()) {
            List<TravelDungeonMapProjectionSnapshot.CellProjection> featureCells = feature.cells().stream()
                    .map(cell -> TravelDungeonMapProjectionValueHelper.featureCell(feature, cell))
                    .toList();
            cells.addAll(featureCells);
            if (featureCells.isEmpty()) {
                continue;
            }
            CellCenter center = centerOf(featureCells);
            int level = featureCells.getFirst().level();
            TravelDungeonMapProjectionSnapshot.TopologyRef topologyRef =
                    TravelDungeonMapProjectionValueHelper.featureTopologyRef(feature);
            labels.add(new TravelDungeonMapProjectionSnapshot.LabelProjection(
                    feature.label(),
                    center.q(),
                    center.r(),
                    level,
                    feature.id(),
                    0L,
                    topologyRef,
                    false,
                    false));
            markers.add(TravelDungeonMapProjectionValueHelper.featureMarker(
                    feature,
                    center.q(),
                    center.r(),
                    level,
                    topologyRef));
        }
    }

    private static void addFallbackGraphLinks(
            List<TravelDungeonMapProjectionSnapshot.GraphNodeProjection> graphNodes,
            List<TravelDungeonMapProjectionSnapshot.GraphLinkProjection> graphLinks
    ) {
        if (!graphLinks.isEmpty() || graphNodes.size() <= 1) {
            return;
        }
        for (int index = 1; index < graphNodes.size(); index++) {
            graphLinks.add(new TravelDungeonMapProjectionSnapshot.GraphLinkProjection(
                    graphNodes.get(index - 1).id(),
                    graphNodes.get(index).id(),
                    false));
        }
    }

    private static TravelDungeonMapProjectionSnapshot.@Nullable PartyTokenProjection partyToken(
            ApplyTravelDungeonSessionUseCase.@Nullable PositionData position
    ) {
        if (position == null) {
            return null;
        }
        return new TravelDungeonMapProjectionSnapshot.PartyTokenProjection(
                position.tile().q() + 0.5,
                position.tile().r() + 0.5,
                position.tile().level(),
                TravelDungeonMapProjectionValueHelper.heading(position.headingToken()),
                true);
    }

    private static CellCenter centerOf(List<TravelDungeonMapProjectionSnapshot.CellProjection> cells) {
        double q = 0.0;
        double r = 0.0;
        for (TravelDungeonMapProjectionSnapshot.CellProjection cell : cells) {
            q += cell.q() + 0.5;
            r += cell.r() + 0.5;
        }
        int count = Math.max(1, cells.size());
        return new CellCenter(q / count, r / count);
    }

    private record ProjectionAccumulator(
            List<TravelDungeonMapProjectionSnapshot.CellProjection> cells,
            List<TravelDungeonMapProjectionSnapshot.EdgeProjection> edges,
            List<TravelDungeonMapProjectionSnapshot.LabelProjection> labels,
            List<TravelDungeonMapProjectionSnapshot.MarkerProjection> markers,
            List<TravelDungeonMapProjectionSnapshot.GraphNodeProjection> graphNodes,
            List<TravelDungeonMapProjectionSnapshot.GraphLinkProjection> graphLinks
    ) {
    }

    private record CellCenter(double q, double r) {
    }
}
