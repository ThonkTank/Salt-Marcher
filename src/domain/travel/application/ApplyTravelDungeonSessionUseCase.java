package src.domain.travel.application;

import java.util.List;
import java.util.Locale;
import org.jspecify.annotations.Nullable;

public final class ApplyTravelDungeonSessionUseCase {

    public interface SessionRepository {

        ActiveTravelStateData loadActiveTravelState();

        SurfaceData loadDungeonSurface(@Nullable PositionData position);

        MoveResultData moveDungeonAction(@Nullable PositionData position, String actionId);

        void saveDungeonPosition(PositionData position, List<Long> characterIds);

        boolean saveOverworldPosition(OverworldTargetData target, List<Long> characterIds);
    }

    private final SessionRepository runtimeAccess;
    private final LoadTravelDungeonSessionSurfaceUseCase loadTravelDungeonSessionSurfaceUseCase;
    private final ApplyTravelDungeonMovementUseCase applyTravelDungeonMovementUseCase;
    private final StabilizeTravelDungeonProjectionUseCase stabilizeTravelDungeonProjectionUseCase;
    private TravelOverlayState overlayState = TravelOverlayState.defaults();
    private int projectionLevel;
    private boolean projectionLevelInitialized;
    private @Nullable PositionData requestedPosition;
    private @Nullable SurfaceData currentSurface;

    public ApplyTravelDungeonSessionUseCase(SessionRepository runtimeAccess) {
        this.runtimeAccess = runtimeAccess;
        loadTravelDungeonSessionSurfaceUseCase = new LoadTravelDungeonSessionSurfaceUseCase();
        applyTravelDungeonMovementUseCase = new ApplyTravelDungeonMovementUseCase();
        stabilizeTravelDungeonProjectionUseCase = new StabilizeTravelDungeonProjectionUseCase();
    }

    public void primeRequestedPosition(@Nullable PositionData position) {
        if (currentSurface == null && requestedPosition == null && position != null) {
            requestedPosition = position;
        }
    }

    public void refresh() {
        currentSurface = loadTravelDungeonSessionSurfaceUseCase.load(runtimeAccess, currentPosition());
        stabilizeProjectionLevel();
    }

    public void move(String actionId) {
        currentSurface = applyTravelDungeonMovementUseCase.move(runtimeAccess, currentPosition(), actionId);
        stabilizeProjectionLevel();
    }

    public void setProjectionLevel(int nextProjectionLevel) {
        projectionLevel = nextProjectionLevel;
        stabilizeProjectionLevel();
    }

    public void setOverlay(String modeKey, int levelRange, double opacity, List<Integer> selectedLevels) {
        overlayState = TravelOverlayState.of(modeKey, levelRange, opacity, selectedLevels);
    }

    public SnapshotData snapshot() {
        if (currentSurface == null) {
            currentSurface = loadTravelDungeonSessionSurfaceUseCase.load(runtimeAccess, requestedPosition);
        }
        stabilizeProjectionLevel();
        return new SnapshotData(currentSurface, overlayState, projectionLevel);
    }

    private @Nullable PositionData currentPosition() {
        if (currentSurface == null || currentSurface.contextKind() != ContextKind.DUNGEON) {
            return requestedPosition;
        }
        return currentSurface.position();
    }

    private void stabilizeProjectionLevel() {
        StabilizeTravelDungeonProjectionUseCase.ProjectionLevelState projectionLevelState =
                stabilizeTravelDungeonProjectionUseCase.stabilize(
                        currentSurface,
                        projectionLevel,
                        projectionLevelInitialized);
        projectionLevel = projectionLevelState.level();
        projectionLevelInitialized = projectionLevelState.initialized();
    }

    static @Nullable PositionData toTravelPosition(@Nullable PartyLocationData location) {
        return location == null || location.outsideDungeon() ? null : location.dungeonPosition();
    }

    static SurfaceData outsideDungeonSurface(long tileId) {
        return new SurfaceData(
                ContextKind.OVERWORLD,
                "Overworld",
                0,
                MapData.empty(),
                new PositionData(
                        1L,
                        LocationKind.TILE,
                        0L,
                        new CellData(0, 0, 0),
                        "SOUTH"),
                "Overworld",
                "Overworld-Feld " + tileId,
                "-",
                "-",
                "Gruppe befindet sich ausserhalb des Dungeons",
                "",
                List.of());
    }

    public record SnapshotData(
            @Nullable SurfaceData surface,
            TravelOverlayState overlayState,
            int projectionLevel
    ) {
        public SnapshotData {
            overlayState = overlayState == null ? TravelOverlayState.defaults() : overlayState;
        }
    }

    public static final class TravelOverlayState {

        private final String modeKey;
        private final int levelRange;
        private final double opacity;
        private final List<Integer> selectedLevels;

        private TravelOverlayState(String modeKey, int levelRange, double opacity, List<Integer> selectedLevels) {
            this.modeKey = modeKey == null || modeKey.isBlank() ? "OFF" : modeKey;
            this.levelRange = Math.max(0, levelRange);
            this.opacity = Math.max(0.0, Math.min(1.0, opacity));
            this.selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
        }

        public static TravelOverlayState defaults() {
            return new TravelOverlayState("OFF", 2, 0.35, List.of());
        }

        public static TravelOverlayState of(String modeKey, int levelRange, double opacity, List<Integer> selectedLevels) {
            return new TravelOverlayState(modeKey, levelRange, opacity, selectedLevels);
        }

        public String modeKey() {
            return modeKey;
        }

        public int levelRange() {
            return levelRange;
        }

        public double opacity() {
            return opacity;
        }

        public List<Integer> selectedLevels() {
            return List.copyOf(selectedLevels);
        }
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
            contextKind = normalizeContextKind(contextKind);
            mapName = normalizeMapName(mapName);
            revision = normalizeRevision(revision);
            map = normalizeMap(map);
            position = normalizePosition(position);
            surfaceTitle = normalizeSurfaceTitle(surfaceTitle, mapName);
            areaLabel = normalizeAreaLabel(areaLabel);
            tileLabel = normalizeDetailLabel(tileLabel);
            headingLabel = normalizeDetailLabel(headingLabel);
            statusLabel = normalizeDetailLabel(statusLabel);
            visualDescription = normalizeVisualDescription(visualDescription);
            actions = normalizeActions(actions);
        }

        private static ContextKind normalizeContextKind(ContextKind contextKind) {
            return contextKind == null ? ContextKind.DUNGEON : contextKind;
        }

        private static String normalizeMapName(String mapName) {
            return mapName == null || mapName.isBlank() ? "Dungeon" : mapName.trim();
        }

        private static int normalizeRevision(int revision) {
            return Math.max(0, revision);
        }

        private static MapData normalizeMap(MapData map) {
            return map == null ? MapData.empty() : map;
        }

        private static PositionData normalizePosition(PositionData position) {
            return position == null
                    ? new PositionData(1L, LocationKind.TILE, 0L, new CellData(0, 0, 0), "SOUTH")
                    : position;
        }

        private static String normalizeSurfaceTitle(String surfaceTitle, String mapName) {
            return surfaceTitle == null || surfaceTitle.isBlank() ? mapName : surfaceTitle.trim();
        }

        private static String normalizeAreaLabel(String areaLabel) {
            return areaLabel == null || areaLabel.isBlank() ? "Kein Standort" : areaLabel.trim();
        }

        private static String normalizeDetailLabel(String label) {
            return label == null ? "" : label.trim();
        }

        private static String normalizeVisualDescription(String visualDescription) {
            return visualDescription == null ? "" : visualDescription.trim();
        }

        private static List<AvailableAction> normalizeActions(List<AvailableAction> actions) {
            return actions == null ? List.of() : List.copyOf(actions);
        }

        @Override
        public List<AvailableAction> actions() {
            return List.copyOf(actions);
        }
    }

    public enum ContextKind {
        DUNGEON,
        OVERWORLD
    }

    public record PositionData(
            long mapId,
            LocationKind locationKind,
            long ownerId,
            CellData tile,
            String headingToken
    ) {
        public PositionData {
            mapId = Math.max(1L, mapId);
            locationKind = locationKind == null ? LocationKind.TILE : locationKind;
            ownerId = Math.max(0L, ownerId);
            tile = tile == null ? new CellData(0, 0, 0) : tile;
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

    public enum LocationKind {
        TILE,
        TRANSITION
    }

    public record MapData(
            GridTopology topology,
            int width,
            int height,
            List<AreaData> areas,
            List<BoundaryData> boundaries,
            List<FeatureData> features
    ) {
        public MapData {
            topology = topology == null ? GridTopology.SQUARE : topology;
            width = Math.max(1, width);
            height = Math.max(1, height);
            areas = areas == null ? List.of() : List.copyOf(areas);
            boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
            features = features == null ? List.of() : List.copyOf(features);
        }

        public static MapData empty() {
            return new MapData(GridTopology.SQUARE, 1, 1, List.of(), List.of(), List.of());
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

    public enum GridTopology {
        SQUARE,
        HEX;

        public static GridTopology fromName(String topologyName) {
            return "HEX".equalsIgnoreCase(topologyName) ? HEX : SQUARE;
        }

        public boolean isHex() {
            return this == HEX;
        }
    }

    public record AreaData(
            AreaKind kind,
            long id,
            String label,
            List<CellData> cells
    ) {
        public AreaData {
            kind = kind == null ? AreaKind.ROOM : kind;
            id = Math.max(1L, id);
            label = label == null || label.isBlank() ? kind.name() : label.trim();
            cells = cells == null ? List.of() : List.copyOf(cells);
        }

        @Override
        public List<CellData> cells() {
            return List.copyOf(cells);
        }
    }

    public enum AreaKind {
        ROOM,
        CORRIDOR
    }

    public record BoundaryData(
            boolean doorBoundary,
            long id,
            String label,
            EdgeData edge
    ) {
        public BoundaryData {
            id = Math.max(1L, id);
            label = label == null || label.isBlank() ? (doorBoundary ? "door" : "wall") : label.trim();
            edge = edge == null ? new EdgeData(new CellData(0, 0, 0), new CellData(0, 0, 0)) : edge;
        }
    }

    public record FeatureData(
            FeatureKind kind,
            long id,
            String label,
            List<CellData> cells,
            String description,
            String destinationLabel
    ) {
        public FeatureData {
            kind = kind == null ? FeatureKind.STAIR : kind;
            id = Math.max(1L, id);
            label = label == null || label.isBlank() ? kind.name() : label.trim();
            cells = cells == null ? List.of() : List.copyOf(cells);
            description = description == null ? "" : description.trim();
            destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
        }

        @Override
        public List<CellData> cells() {
            return List.copyOf(cells);
        }
    }

    public enum FeatureKind {
        STAIR,
        TRANSITION
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

    public record EdgeData(CellData from, CellData to) {
        public EdgeData {
            from = from == null ? new CellData(0, 0, 0) : from;
            to = to == null ? from : to;
        }
    }

    public record CellData(int q, int r, int level) {
    }

    public record ActiveTravelStateData(
            List<Long> travelCharacterIds,
            @Nullable PartyLocationData partyLocation
    ) {
        public ActiveTravelStateData {
            travelCharacterIds = travelCharacterIds == null ? List.of() : List.copyOf(travelCharacterIds);
        }

        @Override
        public List<Long> travelCharacterIds() {
            return List.copyOf(travelCharacterIds);
        }
    }

    public record PartyLocationData(
            @Nullable PositionData dungeonPosition,
            long overworldTileId,
            boolean outsideDungeon
    ) {
        public PartyLocationData {
            overworldTileId = Math.max(0L, overworldTileId);
        }
    }

    public record MoveResultData(
            MoveStatus status,
            SurfaceData surface,
            @Nullable OverworldTargetData externalTarget
    ) {
        public MoveResultData {
            status = status == null ? MoveStatus.NO_MAP : status;
            surface = surface == null ? outsideDungeonSurface(0L) : surface;
        }
    }

    public enum MoveStatus {
        SUCCESS,
        INVALID_ACTION,
        TARGET_UNAVAILABLE,
        EXTERNAL_TARGET,
        NO_MAP;

        public boolean isSuccess() {
            return this == SUCCESS;
        }

        public boolean isExternalTarget() {
            return this == EXTERNAL_TARGET;
        }
    }

    public record OverworldTargetData(long mapId, long tileId) {
        public OverworldTargetData {
            mapId = Math.max(1L, mapId);
            tileId = Math.max(0L, tileId);
        }
    }
}
