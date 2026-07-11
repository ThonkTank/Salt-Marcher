package src.domain.dungeon.model.runtime.travel.session;

import java.util.List;
import java.util.Locale;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.runtime.travel.projection.TravelActionKind;
import src.domain.dungeon.model.runtime.travel.projection.TravelHeading;

public final class TravelDungeonSessionSurface {

    private TravelDungeonSessionSurface() {
    }

    public enum ContextKind {
        DUNGEON,
        OVERWORLD;

        public boolean isOverworld() {
            return this == OVERWORLD;
        }
    }

    public enum LocationKind {
        TILE,
        STAIR_EXIT,
        TRANSITION;

        public static LocationKind defaultKind() {
            return TILE;
        }

        public static LocationKind fromName(@Nullable String name) {
            return switch (normalizeName(name)) {
                case "TRANSITION" -> TRANSITION;
                case "STAIR_EXIT" -> STAIR_EXIT;
                default -> TILE;
            };
        }
    }

    public enum TopologyKind {
        SQUARE,
        HEX;

        public static TopologyKind defaultKind() {
            return SQUARE;
        }

        public static TopologyKind fromName(@Nullable String name) {
            return "HEX".equals(normalizeName(name)) ? HEX : SQUARE;
        }
    }

    public enum AreaKind {
        ROOM,
        CORRIDOR;

        public static AreaKind defaultKind() {
            return ROOM;
        }

        public static AreaKind fromName(@Nullable String name) {
            return "CORRIDOR".equals(normalizeName(name)) ? CORRIDOR : ROOM;
        }

        public String defaultLabel() {
            return name();
        }
    }

    public enum FeatureKind {
        STAIR,
        TRANSITION;

        public static FeatureKind defaultKind() {
            return STAIR;
        }

        public static FeatureKind fromName(@Nullable String name) {
            return "TRANSITION".equals(normalizeName(name)) ? TRANSITION : STAIR;
        }
    }

    public enum OverlayMode {
        OFF,
        NEARBY,
        SELECTED;

        public static OverlayMode defaultMode() {
            return OFF;
        }

        public static OverlayMode fromKey(@Nullable String modeKey) {
            return switch (normalizeName(modeKey)) {
                case "NEARBY" -> NEARBY;
                case "SELECTED" -> SELECTED;
                default -> OFF;
            };
        }

        public String modeKey() {
            return name();
        }
    }

    public record OverlayState(
            OverlayMode mode,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels
    ) {
        public OverlayState {
            mode = mode == null ? OverlayMode.defaultMode() : mode;
            levelRange = Math.max(0, levelRange);
            opacity = Math.max(0.0, Math.min(1.0, opacity));
            selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
        }

        public static OverlayState defaults() {
            return new OverlayState(OverlayMode.defaultMode(), 2, 0.35, List.of());
        }

        public static OverlayState of(
                OverlayMode mode,
                int levelRange,
                double opacity,
                List<Integer> selectedLevels
        ) {
            return new OverlayState(mode, levelRange, opacity, selectedLevels);
        }

        @Override
        public List<Integer> selectedLevels() {
            return List.copyOf(selectedLevels);
        }
    }

    public record OverworldTarget(
            long mapId,
            long tileId
    ) {
        public OverworldTarget {
            mapId = Math.max(1L, mapId);
            tileId = Math.max(0L, tileId);
        }
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
                        TravelHeading.defaultHeading()),
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
                    ? new PositionData(1L, LocationKind.TILE, 0L, new Cell(0, 0, 0), TravelHeading.defaultHeading())
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
            TravelHeading heading
    ) {
        public PositionData {
            mapId = Math.max(1L, mapId);
            locationKind = locationKind == null ? LocationKind.TILE : locationKind;
            ownerId = Math.max(0L, ownerId);
            tile = tile == null ? new Cell(0, 0, 0) : tile;
            heading = heading == null ? TravelHeading.defaultHeading() : heading;
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
            TravelActionKind kind,
            String label,
            String destinationLabel,
            String helpText
    ) {
        public AvailableAction {
            id = id == null ? "" : id.trim();
            kind = kind == null ? TravelActionKind.defaultKind() : kind;
            label = label == null || label.isBlank() ? kind.name() : label.trim();
            destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
            helpText = helpText == null ? "" : helpText.trim();
        }

        public String displayLabel() {
            return destinationLabel.isBlank() ? label : label + ": " + destinationLabel;
        }
    }

    private static String normalizeName(@Nullable String name) {
        return name == null ? "" : name.trim().toUpperCase(Locale.ROOT);
    }
}
