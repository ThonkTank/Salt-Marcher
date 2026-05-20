package src.domain.dungeon.model.travel.model.session.model;

import java.util.List;
import java.util.Locale;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonAreaType;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonEdge;
import src.domain.dungeon.model.map.model.DungeonFeatureType;
import src.domain.dungeon.model.map.model.DungeonTopology;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.ContextKind;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.LocationKind;

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
                        new DungeonCell(0, 0, 0),
                        "SOUTH"),
                "Overworld",
                "Overworld-Feld " + tileId,
                "-",
                "-",
                "Gruppe befindet sich ausserhalb des Dungeons",
                "",
                List.of());
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
            List<AvailableAction> actions
    ) {
        public SurfaceData {
            contextKind = contextKind == null ? ContextKind.DUNGEON : contextKind;
            mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName.trim();
            revision = Math.max(0, revision);
            map = map == null ? MapData.empty() : map;
            position = position == null
                    ? new PositionData(1L, LocationKind.TILE, 0L, new DungeonCell(0, 0, 0), "SOUTH")
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
            DungeonCell tile,
            String headingToken
    ) {
        public PositionData {
            mapId = Math.max(1L, mapId);
            locationKind = locationKind == null ? LocationKind.TILE : locationKind;
            ownerId = Math.max(0L, ownerId);
            tile = tile == null ? new DungeonCell(0, 0, 0) : tile;
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
            DungeonTopology topology,
            int width,
            int height,
            List<AreaData> areas,
            List<BoundaryData> boundaries,
            List<FeatureData> features
    ) {
        public MapData {
            topology = topology == null ? DungeonTopology.SQUARE : topology;
            width = Math.max(1, width);
            height = Math.max(1, height);
            areas = areas == null ? List.of() : List.copyOf(areas);
            boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
            features = features == null ? List.of() : List.copyOf(features);
        }

        public static MapData empty() {
            return new MapData(DungeonTopology.SQUARE, 1, 1, List.of(), List.of(), List.of());
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
            DungeonAreaType kind,
            long id,
            String label,
            List<DungeonCell> cells
    ) {
        public AreaData {
            kind = kind == null ? DungeonAreaType.ROOM : kind;
            id = Math.max(1L, id);
            label = label == null || label.isBlank() ? kind.name() : label.trim();
            cells = cells == null ? List.of() : List.copyOf(cells);
        }

        @Override
        public List<DungeonCell> cells() {
            return List.copyOf(cells);
        }
    }

    public record BoundaryData(
            boolean doorBoundary,
            long id,
            String label,
            DungeonEdge edge
    ) {
        public BoundaryData {
            id = Math.max(1L, id);
            label = label == null || label.isBlank() ? (doorBoundary ? "door" : "wall") : label.trim();
            edge = edge == null ? new DungeonEdge(new DungeonCell(0, 0, 0), new DungeonCell(0, 0, 0)) : edge;
        }
    }

    public record FeatureData(
            DungeonFeatureType kind,
            long id,
            String label,
            List<DungeonCell> cells,
            String description,
            String destinationLabel
    ) {
        public FeatureData {
            kind = kind == null ? DungeonFeatureType.STAIR : kind;
            id = Math.max(1L, id);
            label = label == null || label.isBlank() ? kind.name() : label.trim();
            cells = cells == null ? List.of() : List.copyOf(cells);
            description = description == null ? "" : description.trim();
            destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
        }

        @Override
        public List<DungeonCell> cells() {
            return List.copyOf(cells);
        }
    }

    public record AvailableAction(
            String id,
            String displayLabel,
            String helpText
    ) {
        public AvailableAction {
            id = id == null ? "" : id.trim();
            displayLabel = displayLabel == null || displayLabel.isBlank() ? "Aktion" : displayLabel.trim();
            helpText = helpText == null ? "" : helpText.trim();
        }
    }

}
