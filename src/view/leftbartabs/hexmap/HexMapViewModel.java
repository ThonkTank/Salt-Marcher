package src.view.leftbartabs.hexmap;

import java.util.Comparator;
import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.hex.model.map.HexEditorMode;
import src.domain.hex.model.map.HexMarkerKind;
import src.domain.hex.model.map.HexTerrain;
import src.domain.hex.published.HexEditorSnapshot;
import src.domain.hex.published.HexTravelSnapshot;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel;

final class HexMapViewModel {

    private static final String NO_MAP_TEXT = "Keine Hex-Karte geladen.";
    private static final String NO_TRAVEL_TEXT = "Keine Hex-Reiseposition ausgewaehlt.";
    private static final String LARGE_MAP_TEXT = "Hex-Karte ist fuer die Canvas-Ansicht zu gross.";
    static final int MAX_RENDERED_RADIUS = 20;
    private static final int DEFAULT_CREATE_RADIUS = 2;
    private static final double TILE_WIDTH = 78.0;
    private static final double TILE_HEIGHT = 62.0;
    private static final double HORIZONTAL_STEP = 58.0;
    private static final double VERTICAL_STEP = 48.0;
    private static final double CANVAS_MARGIN = 48.0;
    private static final double HALF_TILE_WIDTH = TILE_WIDTH / 2.0;
    private static final double QUARTER_TILE_WIDTH = TILE_WIDTH / 4.0;
    private static final double HALF_TILE_HEIGHT = TILE_HEIGHT / 2.0;
    private static final CatalogCrudControlsContentModel.Actions HEX_MAP_ACTIONS =
            new CatalogCrudControlsContentModel.Actions(true, true, false, true, true, true, false, true);

    private final CatalogCrudControlsContentModel mapCatalogContentModel = new CatalogCrudControlsContentModel();
    private final ReadOnlyObjectWrapper<ControlsProjection> controlsProjection =
            new ReadOnlyObjectWrapper<>(ControlsProjection.initial());
    private final ReadOnlyObjectWrapper<MainProjection> mainProjection =
            new ReadOnlyObjectWrapper<>(MainProjection.initial());
    private final ReadOnlyObjectWrapper<TileLayer> tileLayer =
            new ReadOnlyObjectWrapper<>(TileLayer.empty());
    private final ReadOnlyObjectWrapper<PartyTokenItem> partyToken =
            new ReadOnlyObjectWrapper<>(PartyTokenItem.none());
    private final ReadOnlyObjectWrapper<StateProjection> stateProjection =
            new ReadOnlyObjectWrapper<>(StateProjection.initial());
    private final ReadOnlyObjectWrapper<MarkerDraftProjection> markerDraft =
            new ReadOnlyObjectWrapper<>(MarkerDraftProjection.initial());
    private final MarkerDraftState markerDraftState = new MarkerDraftState();
    private final Properties properties = new Properties(
            controlsProjection.getReadOnlyProperty(),
            mainProjection.getReadOnlyProperty(),
            tileLayer.getReadOnlyProperty(),
            partyToken.getReadOnlyProperty(),
            stateProjection.getReadOnlyProperty(),
            markerDraft.getReadOnlyProperty());
    private HexEditorSnapshot editorSnapshot = HexEditorSnapshot.empty(NO_MAP_TEXT);
    private HexTravelSnapshot travelSnapshot = HexTravelSnapshot.empty(NO_TRAVEL_TEXT);

    CatalogCrudControlsContentModel mapCatalogContentModel() {
        return mapCatalogContentModel;
    }

    Properties properties() {
        return properties;
    }

    void applySnapshot(HexEditorSnapshot snapshot) {
        editorSnapshot = snapshot == null ? HexEditorSnapshot.empty(NO_MAP_TEXT) : snapshot;
        refreshProjection();
        refreshMapCatalog();
    }

    void applyTravelSnapshot(HexTravelSnapshot snapshot) {
        travelSnapshot = snapshot == null ? HexTravelSnapshot.empty(NO_TRAVEL_TEXT) : snapshot;
        refreshTravelProjection();
    }

    void showLocalFailure(String failureText) {
        stateProjection.set(stateProjection.get().withFailure(failureText));
    }

    void updateMarkerDraft(long markerId, String name, HexMarkerKind type, String note) {
        StateProjection current = stateProjection.get();
        markerDraftState.update(current, markerId, name, type, note);
        markerDraft.set(markerDraftState.projection(current));
    }

    List<Long> partyTokenCharacterIds() {
        return travelSnapshot.partyTokenCharacterIds();
    }

    private void refreshProjection() {
        ControlsProjection nextControls = ControlsProjection.from(editorSnapshot);
        MainProjection nextMain = MainProjection.from(editorSnapshot, travelSnapshot);
        StateProjection nextState = StateProjection.from(editorSnapshot, travelSnapshot);
        controlsProjection.set(nextControls);
        mainProjection.set(nextMain);
        tileLayer.set(TileLayer.from(editorSnapshot));
        partyToken.set(nextMain.partyToken());
        markerDraftState.sync(nextState);
        stateProjection.set(nextState);
        markerDraft.set(markerDraftState.projection(nextState));
    }

    private void refreshTravelProjection() {
        MainProjection nextMain = MainProjection.from(editorSnapshot, travelSnapshot);
        StateProjection nextState = StateProjection.from(editorSnapshot, travelSnapshot);
        mainProjection.set(nextMain);
        partyToken.set(nextMain.partyToken());
        markerDraftState.sync(nextState);
        stateProjection.set(nextState);
        markerDraft.set(markerDraftState.projection(nextState));
    }

    private void refreshMapCatalog() {
        String selectedMapId = editorSnapshot.selectedMap()
                .map(map -> Long.toString(map.mapId().value()))
                .orElse("");
        mapCatalogContentModel.showCatalog(new CatalogCrudControlsContentModel.CatalogState(
                "Hex-Karten",
                "Hex-Karte auswaehlen",
                "Keine Hex-Karten verfuegbar.",
                selectedMapId,
                editorSnapshot.catalog().stream()
                        .map(summary -> new CatalogCrudControlsContentModel.Item(
                                Long.toString(summary.mapId().value()),
                                summary.displayName(),
                                "Radius " + summary.radius(),
                                0L,
                                true))
                        .toList(),
                HEX_MAP_ACTIONS,
                false,
                editorSnapshot.statusText()));
    }

    record Properties(
            ReadOnlyObjectProperty<ControlsProjection> controls,
            ReadOnlyObjectProperty<MainProjection> main,
            ReadOnlyObjectProperty<TileLayer> tileLayer,
            ReadOnlyObjectProperty<PartyTokenItem> partyToken,
            ReadOnlyObjectProperty<StateProjection> state,
            ReadOnlyObjectProperty<MarkerDraftProjection> markerDraft
    ) {
    }

    record ControlsProjection(
            boolean mapLoaded,
            List<HexMapVocabulary.Option<HexEditorMode>> tools,
            HexEditorMode activeTool,
            List<HexMapVocabulary.Option<HexTerrain>> terrains,
            HexTerrain activeTerrain
    ) {

        ControlsProjection {
            tools = tools == null ? List.of() : List.copyOf(tools);
            activeTool = activeTool == null ? HexMapVocabulary.tool("") : activeTool;
            terrains = terrains == null ? List.of() : List.copyOf(terrains);
            activeTerrain = activeTerrain == null ? HexMapVocabulary.terrain("") : activeTerrain;
        }

        static ControlsProjection initial() {
            return new ControlsProjection(
                    false,
                    HexMapVocabulary.TOOL_OPTIONS,
                    HexMapVocabulary.tool(""),
                    HexMapVocabulary.TERRAIN_OPTIONS,
                    HexMapVocabulary.terrain(""));
        }

        static ControlsProjection from(HexEditorSnapshot snapshot) {
            HexEditorSnapshot safeSnapshot = snapshot == null
                    ? HexEditorSnapshot.empty(NO_MAP_TEXT)
                    : snapshot;
            return new ControlsProjection(
                    safeSnapshot.selectedMap().isPresent(),
                    HexMapVocabulary.TOOL_OPTIONS,
                    HexMapVocabulary.tool(safeSnapshot.activeTool()),
                    HexMapVocabulary.TERRAIN_OPTIONS,
                    HexMapVocabulary.terrain(safeSnapshot.activeTerrain()));
        }

        List<String> terrainLabels() {
            return terrains.stream().map(HexMapVocabulary.Option::label).toList();
        }

        List<String> toolLabels() {
            return tools.stream().map(HexMapVocabulary.Option::label).toList();
        }

        int activeToolOptionIndex() {
            return HexMapVocabulary.optionIndex(tools, activeTool);
        }

        int paintTerrainToolOptionIndex() {
            return HexMapVocabulary.optionIndex(tools, HexEditorMode.PAINT_TERRAIN);
        }

        int activeTerrainOptionIndex() {
            return HexMapVocabulary.optionIndex(terrains, activeTerrain);
        }

        HexTerrain terrain(int optionIndex) {
            return HexMapVocabulary.optionValue(terrains, optionIndex, HexMapVocabulary.terrain(""));
        }

        HexEditorMode tool(int optionIndex) {
            return HexMapVocabulary.optionValue(tools, optionIndex, HexMapVocabulary.tool(""));
        }

        boolean toolChanged(HexEditorMode tool, HexTerrain terrain) {
            return activeTool != tool || activeTerrain != terrain;
        }
    }

    record MainProjection(
            String title,
            String subtitle,
            String status,
            String emptyText,
            boolean mapLoaded,
            long selectedMapId,
            int radius,
            HexEditorMode activeTool,
            String activeToolLabel,
            HexTerrain activeTerrain,
            String activeTerrainLabel,
            PartyTokenItem partyToken
    ) {

        MainProjection {
            title = safeText(title);
            subtitle = safeText(subtitle);
            status = safeText(status);
            emptyText = safeText(emptyText);
            activeTool = activeTool == null ? HexMapVocabulary.tool("") : activeTool;
            activeToolLabel = safeText(activeToolLabel);
            activeTerrain = activeTerrain == null ? HexMapVocabulary.terrain("") : activeTerrain;
            activeTerrainLabel = safeText(activeTerrainLabel);
            partyToken = partyToken == null ? PartyTokenItem.none() : partyToken;
        }

        static MainProjection initial() {
            return new MainProjection(
                    "Hex-Karte",
                    "Ueberlandkarte",
                    NO_MAP_TEXT,
                    NO_MAP_TEXT,
                    false,
                    0L,
                    0,
                    HexMapVocabulary.tool(""),
                    HexMapVocabulary.label(HexMapVocabulary.tool("")),
                    HexMapVocabulary.terrain(""),
                    HexMapVocabulary.label(HexMapVocabulary.terrain("")),
                    PartyTokenItem.none());
        }

        static MainProjection from(HexEditorSnapshot snapshot, HexTravelSnapshot travelSnapshot) {
            HexEditorSnapshot safeSnapshot = snapshot == null
                    ? HexEditorSnapshot.empty(NO_MAP_TEXT)
                    : snapshot;
            HexTravelSnapshot safeTravel = travelSnapshot == null
                    ? HexTravelSnapshot.empty(NO_TRAVEL_TEXT)
                    : travelSnapshot;
            return safeSnapshot.selectedMap()
                    .map(map -> loaded(safeSnapshot, safeTravel, map))
                    .orElseGet(() -> unloaded(safeSnapshot));
        }

        private static MainProjection unloaded(HexEditorSnapshot snapshot) {
            HexEditorMode tool = HexMapVocabulary.tool(snapshot.activeTool());
            HexTerrain terrain = HexMapVocabulary.terrain(snapshot.activeTerrain());
            return new MainProjection(
                    "Hex-Karte",
                    "Keine Karte ausgewaehlt",
                    snapshot.statusText(),
                    NO_MAP_TEXT,
                    false,
                    0L,
                    0,
                    tool,
                    HexMapVocabulary.label(tool),
                    terrain,
                    HexMapVocabulary.label(terrain),
                    PartyTokenItem.none());
        }

        private static MainProjection loaded(
                HexEditorSnapshot snapshot,
                HexTravelSnapshot travelSnapshot,
                HexEditorSnapshot.MapSnapshot map
        ) {
            int radius = map.radius();
            boolean renderable = radius <= MAX_RENDERED_RADIUS;
            HexEditorMode tool = HexMapVocabulary.tool(snapshot.activeTool());
            HexTerrain terrain = HexMapVocabulary.terrain(snapshot.activeTerrain());
            return new MainProjection(
                    map.displayName(),
                    "Radius " + radius + " | " + map.tileCount() + " Hexfelder",
                    renderable ? snapshot.statusText() : LARGE_MAP_TEXT,
                    renderable ? "" : LARGE_MAP_TEXT + " Maximaler Canvas-Radius: " + MAX_RENDERED_RADIUS + ".",
                    renderable,
                    map.mapId().value(),
                    radius,
                    tool,
                    HexMapVocabulary.label(tool),
                    terrain,
                    HexMapVocabulary.label(terrain),
                    renderable ? PartyTokenItem.from(travelSnapshot, map.mapId().value(), radius) : PartyTokenItem.none());
        }
    }

    record TileLayer(
            boolean mapLoaded,
            double canvasWidth,
            double canvasHeight,
            List<double[]> hits,
            List<TileItem> tiles
    ) {

        TileLayer {
            hits = hits == null ? List.of() : List.copyOf(hits);
            tiles = tiles == null ? List.of() : List.copyOf(tiles);
        }

        static TileLayer empty() {
            return new TileLayer(false, CANVAS_MARGIN * 2.0, CANVAS_MARGIN * 2.0, List.of(), List.of());
        }

        static TileLayer from(HexEditorSnapshot snapshot) {
            HexEditorSnapshot safeSnapshot = snapshot == null
                    ? HexEditorSnapshot.empty(NO_MAP_TEXT)
                    : snapshot;
            return safeSnapshot.selectedMap()
                    .map(map -> loaded(safeSnapshot, map))
                    .orElseGet(TileLayer::empty);
        }

        private static TileLayer loaded(HexEditorSnapshot snapshot, HexEditorSnapshot.MapSnapshot map) {
            int radius = map.radius();
            if (radius > MAX_RENDERED_RADIUS) {
                return empty();
            }
            List<TileItem> tileItems = snapshot.tiles().stream()
                    .sorted(Comparator.comparingInt(HexEditorSnapshot.TileSnapshot::r)
                            .thenComparingInt(HexEditorSnapshot.TileSnapshot::q))
                    .map(tile -> TileItem.from(tile, radius))
                    .toList();
            double canvasWidth = tileItems.stream()
                    .mapToDouble(TileItem::centerX)
                    .max()
                    .orElse(CANVAS_MARGIN)
                    + CANVAS_MARGIN;
            double canvasHeight = tileItems.stream()
                    .mapToDouble(TileItem::centerY)
                    .max()
                    .orElse(CANVAS_MARGIN)
                    + CANVAS_MARGIN;
            return new TileLayer(
                    true,
                    canvasWidth,
                    canvasHeight,
                    tileItems.stream().map(TileItem::hitData).toList(),
                    tileItems);
        }
    }

    record TileItem(
            int q,
            int r,
            double centerX,
            double centerY,
            HexTerrain terrain,
            String terrainLabel,
            boolean selected,
            String markerText,
            double[] xPoints,
            double[] yPoints
    ) {

        TileItem {
            terrain = terrain == null ? HexMapVocabulary.terrain("") : terrain;
            terrainLabel = safeText(terrainLabel);
            markerText = safeText(markerText);
            xPoints = xPoints == null ? new double[0] : xPoints.clone();
            yPoints = yPoints == null ? new double[0] : yPoints.clone();
        }

        static TileItem from(HexEditorSnapshot.TileSnapshot tile, int radius) {
            Point center = center(tile.q(), tile.r(), radius);
            HexTerrain terrain = HexMapVocabulary.terrain(tile.terrain());
            return new TileItem(
                    tile.q(),
                    tile.r(),
                    center.x(),
                    center.y(),
                    terrain,
                    HexMapVocabulary.label(terrain),
                    tile.selected(),
                    markerText(tile.markers()),
                    xPoints(center.x()),
                    yPoints(center.y()));
        }

        String coordinateText() {
            return q + "," + r;
        }

        @Override
        public double[] xPoints() {
            return xPoints.clone();
        }

        @Override
        public double[] yPoints() {
            return yPoints.clone();
        }

        double[] rawXPoints() {
            return xPoints;
        }

        double[] rawYPoints() {
            return yPoints;
        }

        double[] hitData() {
            return new double[] {q, r, centerX, centerY};
        }

        private static double[] xPoints(double centerX) {
            return new double[] {
                    centerX - QUARTER_TILE_WIDTH,
                    centerX + QUARTER_TILE_WIDTH,
                    centerX + HALF_TILE_WIDTH,
                    centerX + QUARTER_TILE_WIDTH,
                    centerX - QUARTER_TILE_WIDTH,
                    centerX - HALF_TILE_WIDTH
            };
        }

        private static double[] yPoints(double centerY) {
            return new double[] {
                    centerY - HALF_TILE_HEIGHT,
                    centerY - HALF_TILE_HEIGHT,
                    centerY,
                    centerY + HALF_TILE_HEIGHT,
                    centerY + HALF_TILE_HEIGHT,
                    centerY
            };
        }

        private static String markerText(List<HexEditorSnapshot.MarkerSnapshot> markers) {
            if (markers == null || markers.isEmpty()) {
                return "";
            }
            return markers.size() == 1
                    ? HexMapVocabulary.label(HexMapVocabulary.markerKind(markers.getFirst().type()))
                    : markers.size() + " Marker";
        }
    }

    record PartyTokenItem(boolean active, double centerX, double centerY) {

        static PartyTokenItem none() {
            return new PartyTokenItem(false, 0.0, 0.0);
        }

        static PartyTokenItem from(HexTravelSnapshot travelSnapshot, long selectedMapId, int radius) {
            if (travelSnapshot == null || !travelSnapshot.active() || travelSnapshot.mapId() != selectedMapId) {
                return none();
            }
            Point center = center(travelSnapshot.q(), travelSnapshot.r(), radius);
            return new PartyTokenItem(true, center.x(), center.y());
        }
    }

    record StateProjection(
            long selectedMapId,
            String selectedMapName,
            int selectedMapRadius,
            boolean mapLoaded,
            String statusText,
            String failureText,
            String warningText,
            boolean tileSelected,
            String coordinateText,
            int selectedQ,
            int selectedR,
            String terrainText,
            String elevationText,
            String biomeText,
            String explorationText,
            String notesText,
            String travelText,
            List<HexMapVocabulary.Option<HexMarkerKind>> markerTypes,
            List<MarkerItem> markers
    ) {

        StateProjection {
            selectedMapName = safeText(selectedMapName);
            statusText = safeText(statusText);
            failureText = safeText(failureText);
            warningText = safeText(warningText);
            coordinateText = safeText(coordinateText);
            terrainText = safeText(terrainText);
            elevationText = safeText(elevationText);
            biomeText = safeText(biomeText);
            explorationText = safeText(explorationText);
            notesText = safeText(notesText);
            travelText = safeText(travelText);
            markerTypes = markerTypes == null ? List.of() : List.copyOf(markerTypes);
            markers = markers == null ? List.of() : List.copyOf(markers);
        }

        static StateProjection initial() {
            return new StateProjection(
                    0L,
                    "",
                    DEFAULT_CREATE_RADIUS,
                    false,
                    NO_MAP_TEXT,
                    "",
                    "",
                    false,
                    "Kein Hex ausgewaehlt",
                    0,
                    0,
                    "",
                    "",
                    "",
                    "",
                    "",
                    "Keine Hex-Reiseposition ausgewaehlt.",
                    HexMapVocabulary.MARKER_TYPE_OPTIONS,
                    List.of());
        }

        static StateProjection from(HexEditorSnapshot snapshot, HexTravelSnapshot travelSnapshot) {
            HexEditorSnapshot safeSnapshot = snapshot == null
                    ? HexEditorSnapshot.empty(NO_MAP_TEXT)
                    : snapshot;
            HexTravelSnapshot safeTravel = travelSnapshot == null
                    ? HexTravelSnapshot.empty(NO_TRAVEL_TEXT)
                    : travelSnapshot;
            MapState mapState = MapState.from(safeSnapshot);
            return safeSnapshot.selectedTile()
                    .map(tile -> fromTile(safeSnapshot, safeTravel, mapState, tile))
                    .orElseGet(() -> withoutTile(safeSnapshot, safeTravel, mapState));
        }

        StateProjection withFailure(String nextFailureText) {
            return new StateProjection(
                    selectedMapId,
                    selectedMapName,
                    selectedMapRadius,
                    mapLoaded,
                    statusText,
                    nextFailureText,
                    warningText,
                    tileSelected,
                    coordinateText,
                    selectedQ,
                    selectedR,
                    terrainText,
                    elevationText,
                    biomeText,
                    explorationText,
                    notesText,
                    travelText,
                    markerTypes,
                    markers);
        }

        List<MarkerSelectorItem> markerOptions() {
            return java.util.stream.Stream.concat(
                            java.util.stream.Stream.of(new MarkerSelectorItem(
                                    0L,
                                    "Neuer Marker",
                                    "",
                                    HexMapVocabulary.markerKind(""),
                                    "")),
                            markers.stream().map(MarkerSelectorItem::from))
                    .toList();
        }

        MarkerItem markerById(long markerId) {
            return markers.stream()
                    .filter(marker -> marker.markerId() == markerId)
                    .findFirst()
                    .orElse(null);
        }

        List<String> markerOptionLabels() {
            return markerOptions().stream().map(MarkerSelectorItem::label).toList();
        }

        int selectedMarkerOptionIndex(long selectedMarkerId) {
            List<MarkerSelectorItem> options = markerOptions();
            for (int index = 0; index < options.size(); index++) {
                if (options.get(index).markerId() == selectedMarkerId) {
                    return index;
                }
            }
            return 0;
        }

        MarkerSelectorItem markerOption(int optionIndex) {
            List<MarkerSelectorItem> options = markerOptions();
            return optionIndex >= 0 && optionIndex < options.size() ? options.get(optionIndex) : options.get(0);
        }

        List<String> markerTypeLabels() {
            return markerTypes.stream().map(HexMapVocabulary.Option::label).toList();
        }

        int markerTypeOptionIndex(HexMarkerKind kind) {
            return HexMapVocabulary.optionIndex(markerTypes, kind == null ? HexMapVocabulary.markerKind("") : kind);
        }

        HexMarkerKind markerType(int optionIndex) {
            return HexMapVocabulary.optionValue(
                    markerTypes,
                    optionIndex,
                    HexMapVocabulary.markerKind(""));
        }

        private static StateProjection withoutTile(
                HexEditorSnapshot snapshot,
                HexTravelSnapshot travelSnapshot,
                MapState mapState
        ) {
            return new StateProjection(
                    mapState.mapId(),
                    mapState.name(),
                    mapState.radius(),
                    mapState.loaded(),
                    snapshot.statusText(),
                    snapshot.failureText(),
                    snapshot.warningText(),
                    false,
                    "Kein Hex ausgewaehlt",
                    0,
                    0,
                    "",
                    "",
                    "",
                    "",
                    "",
                    travelText(travelSnapshot),
                    HexMapVocabulary.MARKER_TYPE_OPTIONS,
                    List.of());
        }

        private static StateProjection fromTile(
                HexEditorSnapshot snapshot,
                HexTravelSnapshot travelSnapshot,
                MapState mapState,
                HexEditorSnapshot.TileDetails tile
        ) {
            return new StateProjection(
                    mapState.mapId(),
                    mapState.name(),
                    mapState.radius(),
                    mapState.loaded(),
                    snapshot.statusText(),
                    snapshot.failureText(),
                    snapshot.warningText(),
                    true,
                    tile.q() + "," + tile.r(),
                    tile.q(),
                    tile.r(),
                    HexMapVocabulary.label(HexMapVocabulary.terrain(tile.terrain())),
                    fallback(tile.elevation(), "nicht verfuegbar"),
                    fallback(tile.biome(), "nicht verfuegbar"),
                    fallback(tile.explorationState(), "nicht verfuegbar"),
                    fallback(tile.notes(), "keine Notizen"),
                    travelText(travelSnapshot),
                    HexMapVocabulary.MARKER_TYPE_OPTIONS,
                    tile.markers().stream().map(MarkerItem::from).toList());
        }

        private static String travelText(HexTravelSnapshot travelSnapshot) {
            if (travelSnapshot == null || !travelSnapshot.active()) {
                return "Reise: keine Hex-Reiseposition";
            }
            return "Reise: " + travelSnapshot.locationText();
        }
    }

    record MarkerDraftProjection(int markerOptionIndex, String name, int markerTypeOptionIndex, String note) {

        MarkerDraftProjection {
            markerOptionIndex = Math.max(0, markerOptionIndex);
            name = safeText(name);
            markerTypeOptionIndex = Math.max(0, markerTypeOptionIndex);
            note = safeText(note);
        }

        static MarkerDraftProjection initial() {
            return new MarkerDraftProjection(0, "", HexMapVocabulary.defaultMarkerTypeOptionIndex(), "");
        }
    }

    record MarkerSelectorItem(long markerId, String label, String name, HexMarkerKind type, String note) {

        MarkerSelectorItem {
            markerId = Math.max(0L, markerId);
            label = safeText(label);
            name = safeText(name);
            type = type == null ? HexMapVocabulary.markerKind("") : type;
            note = safeText(note);
        }

        static MarkerSelectorItem from(MarkerItem marker) {
            return new MarkerSelectorItem(
                    marker.markerId(),
                    marker.name(),
                    marker.name(),
                    marker.type(),
                    marker.note());
        }

        @Override
        public String toString() {
            return label;
        }
    }

    record MarkerItem(long markerId, String name, HexMarkerKind type, String typeLabel, String note) {

        MarkerItem {
            markerId = Math.max(0L, markerId);
            name = safeText(name);
            type = type == null ? HexMapVocabulary.markerKind("") : type;
            typeLabel = safeText(typeLabel);
            note = safeText(note);
        }

        static MarkerItem from(HexEditorSnapshot.MarkerSnapshot marker) {
            HexMarkerKind type = HexMapVocabulary.markerKind(marker.type());
            return new MarkerItem(
                    marker.markerId().value(),
                    marker.name(),
                    type,
                    HexMapVocabulary.label(type),
                    marker.note());
        }
    }

    private static final class MarkerDraftState {

        private long draftMapId;
        private int draftQ;
        private int draftR;
        private long markerId;
        private String markerName = "";
        private HexMarkerKind markerType = HexMapVocabulary.markerKind("");
        private String markerNote = "";

        void sync(StateProjection projection) {
            if (!projection.mapLoaded() || !projection.tileSelected()) {
                clearContext();
                return;
            }
            if (draftMapId != projection.selectedMapId()
                    || draftQ != projection.selectedQ()
                    || draftR != projection.selectedR()) {
                draftMapId = projection.selectedMapId();
                draftQ = projection.selectedQ();
                draftR = projection.selectedR();
                setDefault();
                return;
            }
            if (markerId > 0L && projection.markerById(markerId) == null) {
                setDefault();
            }
        }

        void update(StateProjection projection, long nextMarkerId, String name, HexMarkerKind type, String note) {
            syncContext(projection);
            markerId = Math.max(0L, nextMarkerId);
            markerName = safeText(name);
            markerType = type == null ? HexMapVocabulary.markerKind("") : type;
            markerNote = safeText(note);
        }

        MarkerDraftProjection projection(StateProjection projection) {
            StateProjection safeProjection = projection == null ? StateProjection.initial() : projection;
            return new MarkerDraftProjection(
                    safeProjection.selectedMarkerOptionIndex(markerId),
                    markerName,
                    safeProjection.markerTypeOptionIndex(markerType),
                    markerNote);
        }

        private void syncContext(StateProjection projection) {
            if (projection == null || !projection.mapLoaded() || !projection.tileSelected()) {
                clearContext();
                return;
            }
            if (draftMapId != projection.selectedMapId()
                    || draftQ != projection.selectedQ()
                    || draftR != projection.selectedR()) {
                draftMapId = projection.selectedMapId();
                draftQ = projection.selectedQ();
                draftR = projection.selectedR();
                setDefault();
            }
        }

        private void clearContext() {
            draftMapId = 0L;
            draftQ = 0;
            draftR = 0;
            setDefault();
        }

        private void setDefault() {
            markerId = 0L;
            markerName = "";
            markerType = HexMapVocabulary.markerKind("");
            markerNote = "";
        }
    }

    private record MapState(long mapId, String name, int radius, boolean loaded) {

        MapState {
            mapId = Math.max(0L, mapId);
            name = safeText(name);
            radius = Math.max(0, radius);
        }

        static MapState from(HexEditorSnapshot snapshot) {
            HexEditorSnapshot safeSnapshot = snapshot == null
                    ? HexEditorSnapshot.empty(NO_MAP_TEXT)
                    : snapshot;
            return safeSnapshot.selectedMap()
                    .map(map -> new MapState(map.mapId().value(), map.displayName(), map.radius(), true))
                    .orElseGet(() -> new MapState(0L, "", DEFAULT_CREATE_RADIUS, false));
        }
    }

    private record Point(double x, double y) {
    }

    private static Point center(int q, int r, int radius) {
        int row = r + radius;
        int column = q + radius + Math.floorDiv(r + radius, 2);
        return new Point(
                CANVAS_MARGIN + Math.max(0, column) * HORIZONTAL_STEP,
                CANVAS_MARGIN + Math.max(0, row) * VERTICAL_STEP);
    }

    private static String fallback(String text, String fallback) {
        String safeText = safeText(text);
        return safeText.isBlank() ? fallback : safeText;
    }

    private static String safeText(String text) {
        return text == null ? "" : text.trim();
    }
}
