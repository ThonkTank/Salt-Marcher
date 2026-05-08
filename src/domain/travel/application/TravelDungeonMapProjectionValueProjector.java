package src.domain.travel.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonMapProjectionContent;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.travel.published.TravelDungeonMapProjectionSnapshot;

public final class TravelDungeonMapProjectionValueProjector {

    private TravelDungeonMapProjectionValueProjector() {
    }

    public static TravelDungeonMapProjectionSnapshot.CellProjection cell(
            ApplyTravelDungeonSessionUseCase.AreaData area,
            ApplyTravelDungeonSessionUseCase.CellData cell
    ) {
        return new TravelDungeonMapProjectionSnapshot.CellProjection(
                cell.q(),
                cell.r(),
                cell.level(),
                area.label(),
                area.kind() == ApplyTravelDungeonSessionUseCase.AreaKind.CORRIDOR
                        ? TravelDungeonMapProjectionSnapshot.CellKind.CORRIDOR
                        : TravelDungeonMapProjectionSnapshot.CellKind.ROOM,
                area.id(),
                0L,
                areaTopologyRef(area),
                false,
                false,
                false,
                false);
    }

    public static TravelDungeonMapProjectionSnapshot.CellProjection featureCell(
            ApplyTravelDungeonSessionUseCase.FeatureData feature,
            ApplyTravelDungeonSessionUseCase.CellData cell
    ) {
        return new TravelDungeonMapProjectionSnapshot.CellProjection(
                cell.q(),
                cell.r(),
                cell.level(),
                feature.label(),
                feature.kind() == ApplyTravelDungeonSessionUseCase.FeatureKind.TRANSITION
                        ? TravelDungeonMapProjectionSnapshot.CellKind.TRANSITION
                        : TravelDungeonMapProjectionSnapshot.CellKind.STAIR,
                feature.id(),
                0L,
                featureTopologyRef(feature),
                false,
                false,
                false,
                false);
    }

    public static TravelDungeonMapProjectionSnapshot.EdgeProjection edge(
            ApplyTravelDungeonSessionUseCase.BoundaryData boundary
    ) {
        ApplyTravelDungeonSessionUseCase.EdgeData edge = boundary.edge();
        return new TravelDungeonMapProjectionSnapshot.EdgeProjection(
                edge.from().q(),
                edge.from().r(),
                edge.to().q(),
                edge.to().r(),
                edge.from().level(),
                edgeKind(boundary.kind()),
                boundary.label(),
                boundary.id(),
                TravelDungeonMapProjectionSnapshot.TopologyRef.empty(),
                false,
                false);
    }

    public static TravelDungeonMapProjectionSnapshot.MarkerProjection featureMarker(
            ApplyTravelDungeonSessionUseCase.FeatureData feature,
            double centerQ,
            double centerR,
            int level,
            TravelDungeonMapProjectionSnapshot.TopologyRef topologyRef
    ) {
        boolean transition = feature.kind() == ApplyTravelDungeonSessionUseCase.FeatureKind.TRANSITION;
        return new TravelDungeonMapProjectionSnapshot.MarkerProjection(
                transition ? "->" : "z",
                centerQ,
                centerR,
                level,
                transition
                        ? TravelDungeonMapProjectionSnapshot.MarkerKind.WAYPOINT
                        : TravelDungeonMapProjectionSnapshot.MarkerKind.STAIR,
                false,
                new TravelDungeonMapProjectionSnapshot.MarkerHandle(
                        transition ? "CORRIDOR_WAYPOINT" : "STAIR_ANCHOR",
                        topologyRef,
                        feature.id(),
                        0L,
                        0L,
                        0L,
                        0,
                        (int) Math.floor(centerQ),
                        (int) Math.floor(centerR),
                        level,
                        ""),
                false);
    }

    public static DungeonTopologyKind topology(ApplyTravelDungeonSessionUseCase.GridTopology topology) {
        return ApplyTravelDungeonSessionUseCase.GridTopology.HEX.equals(topology)
                ? DungeonTopologyKind.HEX
                : DungeonTopologyKind.SQUARE;
    }

    public static TravelDungeonMapProjectionSnapshot.EdgeKind edgeKind(
            ApplyTravelDungeonSessionUseCase.BoundaryKind boundaryKind
    ) {
        return boundaryKind == ApplyTravelDungeonSessionUseCase.BoundaryKind.DOOR
                ? TravelDungeonMapProjectionSnapshot.EdgeKind.DOOR
                : TravelDungeonMapProjectionSnapshot.EdgeKind.WALL;
    }

    public static TravelDungeonMapProjectionSnapshot.TopologyRef areaTopologyRef(
            ApplyTravelDungeonSessionUseCase.AreaData area
    ) {
        return new TravelDungeonMapProjectionSnapshot.TopologyRef(
                area.kind() == ApplyTravelDungeonSessionUseCase.AreaKind.CORRIDOR ? "CORRIDOR" : "ROOM",
                area.id());
    }

    public static TravelDungeonMapProjectionSnapshot.TopologyRef featureTopologyRef(
            ApplyTravelDungeonSessionUseCase.FeatureData feature
    ) {
        return new TravelDungeonMapProjectionSnapshot.TopologyRef(
                feature.kind() == ApplyTravelDungeonSessionUseCase.FeatureKind.TRANSITION ? "TRANSITION" : "STAIR",
                feature.id());
    }

    public static TravelDungeonMapProjectionSnapshot.Heading heading(
            ApplyTravelDungeonSessionUseCase.@Nullable Direction heading
    ) {
        String directionName = heading == null
                ? ApplyTravelDungeonSessionUseCase.Direction.SOUTH.name()
                : heading.name();
        return switch (directionName) {
            case "NORTH" -> TravelDungeonMapProjectionSnapshot.Heading.NORTH;
            case "EAST" -> TravelDungeonMapProjectionSnapshot.Heading.EAST;
            case "WEST" -> TravelDungeonMapProjectionSnapshot.Heading.WEST;
            default -> TravelDungeonMapProjectionSnapshot.Heading.SOUTH;
        };
    }
}
