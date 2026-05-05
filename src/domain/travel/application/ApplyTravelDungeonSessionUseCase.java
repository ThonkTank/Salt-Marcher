package src.domain.travel.application;

import java.util.List;
import org.jspecify.annotations.Nullable;

public final class ApplyTravelDungeonSessionUseCase {

    public interface RuntimeAccess {

        ActiveTravelStateData loadActiveTravelState();

        SurfaceData loadDungeonSurface(@Nullable PositionData position);

        MoveResultData moveDungeonAction(@Nullable PositionData position, String actionId);

        void saveDungeonPosition(PositionData position, List<Long> characterIds);

        boolean saveOverworldPosition(OverworldTargetData target, List<Long> characterIds);
    }

    private final RuntimeAccess runtimeAccess;
    private final LoadTravelDungeonSessionSurfaceUseCase loadTravelDungeonSessionSurfaceUseCase;
    private final ApplyTravelDungeonMovementUseCase applyTravelDungeonMovementUseCase;
    private final StabilizeTravelDungeonProjectionUseCase stabilizeTravelDungeonProjectionUseCase;
    private OverlayData overlaySettings = OverlayData.defaults();
    private int projectionLevel;
    private boolean projectionLevelInitialized;
    private @Nullable PositionData requestedPosition;
    private @Nullable SurfaceData currentSurface;

    public ApplyTravelDungeonSessionUseCase(RuntimeAccess runtimeAccess) {
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

    public void apply(@Nullable Command command) {
        Command effectiveCommand = command == null
                ? new Command(Action.REFRESH, "", projectionLevel, overlaySettings)
                : command;
        switch (effectiveCommand.action()) {
            case REFRESH -> currentSurface = loadTravelDungeonSessionSurfaceUseCase.load(
                    runtimeAccess,
                    currentPosition());
            case ACTION -> currentSurface = applyTravelDungeonMovementUseCase.move(
                    runtimeAccess,
                    currentPosition(),
                    effectiveCommand.actionId());
            case SET_PROJECTION_LEVEL -> projectionLevel = effectiveCommand.projectionLevel();
            case SET_OVERLAY -> overlaySettings = effectiveCommand.overlaySettings();
        }
        stabilizeProjectionLevel();
    }

    public SnapshotData snapshot() {
        if (currentSurface == null) {
            currentSurface = loadTravelDungeonSessionSurfaceUseCase.load(runtimeAccess, requestedPosition);
        }
        stabilizeProjectionLevel();
        return new SnapshotData(currentSurface, overlaySettings, projectionLevel);
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
        if (!(location instanceof DungeonPartyLocationData dungeonLocation)) {
            return null;
        }
        return new PositionData(
                dungeonLocation.mapId(),
                dungeonLocation.locationKind(),
                dungeonLocation.ownerId(),
                dungeonLocation.tile(),
                dungeonLocation.heading());
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
                        Heading.SOUTH),
                "Overworld",
                "Overworld-Feld " + tileId,
                "-",
                "-",
                "Gruppe befindet sich ausserhalb des Dungeons",
                "",
                List.of());
    }

    public record Command(
            Action action,
            String actionId,
            int projectionLevel,
            OverlayData overlaySettings
    ) {
        public Command {
            action = action == null ? Action.REFRESH : action;
            actionId = actionId == null ? "" : actionId.trim();
            overlaySettings = overlaySettings == null ? OverlayData.defaults() : overlaySettings;
        }
    }

    public enum Action {
        REFRESH,
        ACTION,
        SET_PROJECTION_LEVEL,
        SET_OVERLAY
    }

    public record SnapshotData(
            @Nullable SurfaceData surface,
            OverlayData overlaySettings,
            int projectionLevel
    ) {
        public SnapshotData {
            overlaySettings = overlaySettings == null ? OverlayData.defaults() : overlaySettings;
        }
    }

    public record OverlayData(
            String modeKey,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels
    ) {
        public OverlayData {
            modeKey = normalizeModeKey(modeKey);
            levelRange = normalizeLevelRange(levelRange);
            opacity = normalizeOpacity(opacity);
            selectedLevels = normalizeSelectedLevels(selectedLevels);
        }

        public static OverlayData defaults() {
            return new OverlayData("OFF", 2, 0.35, List.of());
        }

        private static String normalizeModeKey(String modeKey) {
            return modeKey == null || modeKey.isBlank() ? "OFF" : modeKey;
        }

        private static int normalizeLevelRange(int levelRange) {
            return Math.max(0, levelRange);
        }

        private static double normalizeOpacity(double opacity) {
            return Math.max(0.0, Math.min(1.0, opacity));
        }

        private static List<Integer> normalizeSelectedLevels(List<Integer> selectedLevels) {
            return selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
        }

        @Override
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
            List<ActionData> actions
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
                    ? new PositionData(1L, LocationKind.TILE, 0L, new CellData(0, 0, 0), Heading.SOUTH)
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

        private static List<ActionData> normalizeActions(List<ActionData> actions) {
            return actions == null ? List.of() : List.copyOf(actions);
        }

        @Override
        public List<ActionData> actions() {
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
            Heading heading
    ) {
        public PositionData {
            mapId = Math.max(1L, mapId);
            locationKind = locationKind == null ? LocationKind.TILE : locationKind;
            ownerId = Math.max(0L, ownerId);
            tile = tile == null ? new CellData(0, 0, 0) : tile;
            heading = heading == null ? Heading.SOUTH : heading;
        }
    }

    public enum LocationKind {
        TILE,
        TRANSITION
    }

    public enum Heading {
        NORTH,
        EAST,
        SOUTH,
        WEST
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
            topology = topology == null ? TopologyKind.SQUARE : topology;
            width = Math.max(1, width);
            height = Math.max(1, height);
            areas = areas == null ? List.of() : List.copyOf(areas);
            boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
            features = features == null ? List.of() : List.copyOf(features);
        }

        public static MapData empty() {
            return new MapData(TopologyKind.SQUARE, 1, 1, List.of(), List.of(), List.of());
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

    public enum TopologyKind {
        SQUARE,
        HEX
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
            BoundaryKind kind,
            long id,
            String label,
            EdgeData edge
    ) {
        public BoundaryData {
            kind = kind == null ? BoundaryKind.WALL : kind;
            id = Math.max(1L, id);
            label = label == null || label.isBlank() ? kind.externalKind() : label.trim();
            edge = edge == null ? new EdgeData(new CellData(0, 0, 0), new CellData(0, 0, 0)) : edge;
        }
    }

    public enum BoundaryKind {
        WALL,
        DOOR;

        public static BoundaryKind fromExternalKind(String kind) {
            return "door".equalsIgnoreCase(kind) ? DOOR : WALL;
        }

        public String externalKind() {
            return this == DOOR ? "door" : "wall";
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

    public record ActionData(
            String actionId,
            String label,
            String description
    ) {
        public ActionData {
            actionId = actionId == null ? "" : actionId.trim();
            label = label == null || label.isBlank() ? "Aktion" : label.trim();
            description = description == null ? "" : description.trim();
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

    public sealed interface PartyLocationData permits DungeonPartyLocationData, OverworldPartyLocationData {
    }

    public record DungeonPartyLocationData(
            long mapId,
            LocationKind locationKind,
            long ownerId,
            CellData tile,
            Heading heading
    ) implements PartyLocationData {
        public DungeonPartyLocationData {
            mapId = Math.max(1L, mapId);
            locationKind = locationKind == null ? LocationKind.TILE : locationKind;
            ownerId = Math.max(0L, ownerId);
            tile = tile == null ? new CellData(0, 0, 0) : tile;
            heading = heading == null ? Heading.SOUTH : heading;
        }
    }

    public record OverworldPartyLocationData(long mapId, long tileId) implements PartyLocationData {
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
    }
}
