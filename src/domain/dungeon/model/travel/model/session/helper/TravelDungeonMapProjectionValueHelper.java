package src.domain.dungeon.model.travel.model.session.helper;

import java.util.Locale;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.AreaData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.BoundaryData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.CellData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.EdgeData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.FeatureData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.AreaKind;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.FeatureKind;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.GridTopology;
import src.domain.dungeon.published.TravelDungeonMapProjectionSnapshot;

public final class TravelDungeonMapProjectionValueHelper {

    private TravelDungeonMapProjectionValueHelper() {
    }

    public static TravelDungeonMapProjectionSnapshot.CellProjection cell(
            AreaData area,
            CellData cell
    ) {
        return new TravelDungeonMapProjectionSnapshot.CellProjection(
                cell.q(),
                cell.r(),
                cell.level(),
                area.label(),
                area.kind() == AreaKind.CORRIDOR
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
            FeatureData feature,
            CellData cell
    ) {
        return new TravelDungeonMapProjectionSnapshot.CellProjection(
                cell.q(),
                cell.r(),
                cell.level(),
                feature.label(),
                feature.kind() == FeatureKind.TRANSITION
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
            BoundaryData boundary
    ) {
        EdgeData edge = boundary.edge();
        return new TravelDungeonMapProjectionSnapshot.EdgeProjection(
                edge.from().q(),
                edge.from().r(),
                edge.to().q(),
                edge.to().r(),
                edge.from().level(),
                edgeKind(boundary.doorBoundary()),
                boundary.label(),
                boundary.id(),
                TravelDungeonMapProjectionSnapshot.TopologyRef.empty(),
                false,
                false);
    }

    public static TravelDungeonMapProjectionSnapshot.MarkerProjection featureMarker(
            FeatureData feature,
            double centerQ,
            double centerR,
            int level,
            TravelDungeonMapProjectionSnapshot.TopologyRef topologyRef
    ) {
        boolean transition = feature.kind() == FeatureKind.TRANSITION;
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

    public static DungeonTopologyKind topology(GridTopology topology) {
        return topology != null && topology.isHex()
                ? DungeonTopologyKind.HEX
                : DungeonTopologyKind.SQUARE;
    }

    public static TravelDungeonMapProjectionSnapshot.EdgeKind edgeKind(
            boolean doorBoundary
    ) {
        return doorBoundary
                ? TravelDungeonMapProjectionSnapshot.EdgeKind.DOOR
                : TravelDungeonMapProjectionSnapshot.EdgeKind.WALL;
    }

    public static TravelDungeonMapProjectionSnapshot.TopologyRef areaTopologyRef(
            AreaData area
    ) {
        return new TravelDungeonMapProjectionSnapshot.TopologyRef(
                area.kind() == AreaKind.CORRIDOR ? "CORRIDOR" : "ROOM",
                area.id());
    }

    public static TravelDungeonMapProjectionSnapshot.TopologyRef featureTopologyRef(
            FeatureData feature
    ) {
        return new TravelDungeonMapProjectionSnapshot.TopologyRef(
                feature.kind() == FeatureKind.TRANSITION ? "TRANSITION" : "STAIR",
                feature.id());
    }

    public static TravelDungeonMapProjectionSnapshot.Heading heading(
            @Nullable String headingToken
    ) {
        String directionName = headingToken == null
                ? "SOUTH"
                : headingToken.trim().toUpperCase(Locale.ROOT);
        return switch (directionName) {
            case "NORTH" -> TravelDungeonMapProjectionSnapshot.Heading.NORTH;
            case "EAST" -> TravelDungeonMapProjectionSnapshot.Heading.EAST;
            case "WEST" -> TravelDungeonMapProjectionSnapshot.Heading.WEST;
            default -> TravelDungeonMapProjectionSnapshot.Heading.SOUTH;
        };
    }
}
