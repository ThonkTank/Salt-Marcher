package src.domain.dungeon.model.runtime.travel.session;

import java.util.List;
import java.util.Locale;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.ActionKind;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.AreaKind;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.ContextKind;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.FeatureKind;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.LocationKind;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.TopologyKind;

public final class TravelDungeonSessionSurface {

    private TravelDungeonSessionSurface() {
    }

    public static SurfaceData outsideDungeonSurface(long tileId) {
        return new SurfaceData(
                ContextKind.OVERWORLD,
                "Overworld",
                0,
                MapData.empty(),
                new PositionData(
                        1L,
                        LocationKind.TILE,
                        0L,
                        new Cell(0, 0, 0),
                        "SOUTH"),
                "Overworld",
                "Overworld-Feld " + tileId,
                "-",
                "-",
                "Gruppe befindet sich ausserhalb des Dungeons",
                "",
                List.of(),
                false);
    }

    public record SurfaceData(
            ContextKind contextKind,
            String mapName,
            int revision,
            MapData map,
            PositionData position,
            String surfaceTitle,
            String areaLabel,
            String tileLabel,
            String headingLabel,
            String statusLabel,
            String visualDescription,
            List<AvailableAction> actions,
            boolean navigationEnabled
    ) {
        public SurfaceData {
            contextKind = contextKind == null ? ContextKind.DUNGEON : contextKind;
            mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName.trim();
            revision = Math.max(0, revision);
            map = map == null ? MapData.empty() : map;
            position = position == null
                    ? new PositionData(1L, LocationKind.TILE, 0L, new Cell(0, 0, 0), "SOUTH")
                    : position;
            surfaceTitle = surfaceTitle == null || surfaceTitle.isBlank() ? mapName : surfaceTitle.trim();
            areaLabel = areaLabel == null || areaLabel.isBlank() ? "Kein Standort" : areaLabel.trim();
            tileLabel = tileLabel == null ? "" : tileLabel.trim();
            headingLabel = headingLabel == null ? "" : headingLabel.trim();
            statusLabel = statusLabel == null ? "" : statusLabel.trim();
            visualDescription = visualDescription == null ? "" : visualDescription.trim();
            actions = actions == null ? List.of() : List.copyOf(actions);
        }

        @Override
        public List<AvailableAction> actions() {
            return List.copyOf(actions);
        }
    }

    public record PositionData(
            long mapId,
            LocationKind locationKind,
            long ownerId,
            Cell tile,
            String headingToken
    ) {
        public PositionData {
            mapId = Math.max(1L, mapId);
            locationKind = locationKind == null ? LocationKind.TILE : locationKind;
            ownerId = Math.max(0L, ownerId);
            tile = tile == null ? new Cell(0, 0, 0) : tile;
            headingToken = normalizeHeadingToken(headingToken);
        }

        private static String normalizeHeadingToken(@Nullable String token) {
            return switch (token == null ? "" : token.trim().toUpperCase(Locale.ROOT)) {
                case "NORTH" -> "NORTH";
                case "EAST" -> "EAST";
                case "WEST" -> "WEST";
                default -> "SOUTH";
            };
        }
    }

    public record MapData(
            TopologyKind topology,
            int width,
            int height,
            List<AreaData> areas,
            List<BoundaryData> boundaries,
            List<FeatureData> features
    ) {
        public MapData {
            topology = topology == null ? TopologyKind.defaultKind() : topology;
            width = Math.max(1, width);
            height = Math.max(1, height);
            areas = areas == null ? List.of() : List.copyOf(areas);
            boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
            features = features == null ? List.of() : List.copyOf(features);
        }

        public static MapData empty() {
            return new MapData(TopologyKind.defaultKind(), 1, 1, List.of(), List.of(), List.of());
        }

        @Override
        public List<AreaData> areas() {
            return List.copyOf(areas);
        }

        @Override
        public List<BoundaryData> boundaries() {
            return List.copyOf(boundaries);
        }

        @Override
        public List<FeatureData> features() {
            return List.copyOf(features);
        }
    }

    public record AreaData(
            AreaKind kind,
            long id,
            String label,
            List<Cell> cells,
            DungeonTopologyRef topologyRef
    ) {
        public AreaData {
            kind = kind == null ? AreaKind.defaultKind() : kind;
            id = Math.max(1L, id);
            label = label == null || label.isBlank() ? kind.defaultLabel() : label.trim();
            cells = cells == null ? List.of() : List.copyOf(cells);
            topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        }

        @Override
        public List<Cell> cells() {
            return List.copyOf(cells);
        }
    }

    public record BoundaryData(
            boolean doorBoundary,
            long id,
            String label,
            Edge edge,
            DungeonTopologyRef topologyRef
    ) {
        public BoundaryData {
            id = Math.max(1L, id);
            label = label == null || label.isBlank() ? (doorBoundary ? "door" : "wall") : label.trim();
            edge = edge == null ? new Edge(new Cell(0, 0, 0), new Cell(0, 0, 0)) : edge;
            topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        }
    }

    public record FeatureData(
            FeatureKind kind,
            long id,
            String label,
            List<Cell> cells,
            String description,
            String destinationLabel,
            DungeonTopologyRef topologyRef
    ) {
        public FeatureData {
            kind = kind == null ? FeatureKind.defaultKind() : kind;
            id = Math.max(1L, id);
            label = label == null || label.isBlank() ? kind.name() : label.trim();
            cells = cells == null ? List.of() : List.copyOf(cells);
            description = description == null ? "" : description.trim();
            destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
            topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        }

        @Override
        public List<Cell> cells() {
            return List.copyOf(cells);
        }
    }

    public record AvailableAction(
            String id,
            ActionKind kind,
            String label,
            String destinationLabel,
            String helpText
    ) {
        public AvailableAction {
            id = id == null ? "" : id.trim();
            kind = kind == null ? ActionKind.defaultKind() : kind;
            label = label == null || label.isBlank() ? kind.name() : label.trim();
            destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
            helpText = helpText == null ? "" : helpText.trim();
        }

        public String displayLabel() {
            return destinationLabel.isBlank() ? label : label + ": " + destinationLabel;
        }
    }

}
