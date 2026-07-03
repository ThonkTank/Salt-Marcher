package src.view.leftbartabs.hexmap;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.hex.published.HexEditorSnapshot;
import src.domain.hex.published.HexTravelSnapshot;

public final class HexMapStateContentModel {

    private static final String NO_MAP_STATUS = "Keine Hex-Karte geladen.";
    private static final String NO_TRAVEL_STATUS = "Keine Hex-Reiseposition ausgewaehlt.";
    private static final String DEFAULT_MARKER_TYPE = HexMapVocabularyContentPartModel.DEFAULT_MARKER_TYPE;

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.initial());
    private final ReadOnlyObjectWrapper<MarkerDraftProjection> markerDraft =
            new ReadOnlyObjectWrapper<>(MarkerDraftProjection.initial());
    private HexEditorSnapshot editorSnapshot = HexEditorSnapshot.empty(NO_MAP_STATUS);
    private HexTravelSnapshot travelSnapshot = HexTravelSnapshot.empty(NO_TRAVEL_STATUS);
    private long draftMapId;
    private int draftQ;
    private int draftR;
    private long markerDraftId;
    private String markerDraftName = "";
    private String markerDraftTypeKey = DEFAULT_MARKER_TYPE;
    private String markerDraftNote = "";

    ReadOnlyObjectProperty<Projection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<MarkerDraftProjection> markerDraftProperty() {
        return markerDraft.getReadOnlyProperty();
    }

    Projection currentProjection() {
        return projection.get();
    }

    long resolvedMarkerId(int markerOptionIndex) {
        return currentProjection().markerOption(markerOptionIndex).markerId();
    }

    String resolvedMarkerName(int markerOptionIndex, String markerName, boolean markerSelectionRequested) {
        if (markerSelectionRequested) {
            return currentProjection().markerOption(markerOptionIndex).name();
        }
        return safeText(markerName);
    }

    String resolvedMarkerTypeKey(
            int markerOptionIndex,
            int markerTypeOptionIndex,
            boolean markerSelectionRequested
    ) {
        Projection current = currentProjection();
        if (markerSelectionRequested) {
            return current.markerOption(markerOptionIndex).typeKey();
        }
        return current.markerTypeKey(markerTypeOptionIndex);
    }

    String resolvedMarkerNote(int markerOptionIndex, String markerNote, boolean markerSelectionRequested) {
        if (markerSelectionRequested) {
            return currentProjection().markerOption(markerOptionIndex).note();
        }
        return safeText(markerNote);
    }

    void applySnapshot(HexEditorSnapshot snapshot) {
        editorSnapshot = snapshot == null ? HexEditorSnapshot.empty(NO_MAP_STATUS) : snapshot;
        refreshProjection();
    }

    void applyTravelSnapshot(HexTravelSnapshot snapshot) {
        travelSnapshot = snapshot == null
                ? HexTravelSnapshot.empty(NO_TRAVEL_STATUS)
                : snapshot;
        refreshProjection();
    }

    private void refreshProjection() {
        Projection nextProjection = Projection.from(editorSnapshot, travelSnapshot);
        syncMarkerDraft(nextProjection);
        projection.set(nextProjection);
        publishMarkerDraft(nextProjection);
    }

    void showLocalFailure(String failureText) {
        Projection current = projection.get();
        projection.set(current.withFailure(failureText));
    }

    void updateMarkerDraft(long markerId, String name, String typeKey, String note) {
        Projection current = projection.get();
        syncDraftContext(current);
        markerDraftId = Math.max(0L, markerId);
        markerDraftName = safeText(name);
        markerDraftTypeKey = markerTypeOrDefault(typeKey);
        markerDraftNote = safeText(note);
        publishMarkerDraft(current);
    }

    private void publishMarkerDraft(Projection current) {
        Projection safeProjection = current == null ? Projection.initial() : current;
        markerDraft.set(new MarkerDraftProjection(
                safeProjection.selectedMarkerOptionIndex(markerDraftId),
                markerDraftName,
                safeProjection.markerTypeOptionIndex(markerDraftTypeKey),
                markerDraftNote));
    }

    private void syncMarkerDraft(Projection projection) {
        if (!projection.mapLoaded() || !projection.tileSelected()) {
            clearMarkerDraftContext();
            return;
        }
        if (draftMapId != projection.selectedMapId()
                || draftQ != projection.selectedQ()
                || draftR != projection.selectedR()) {
            draftMapId = projection.selectedMapId();
            draftQ = projection.selectedQ();
            draftR = projection.selectedR();
            setDefaultMarkerDraft();
            return;
        }
        if (markerDraftId > 0L && projection.markerById(markerDraftId) == null) {
            setDefaultMarkerDraft();
        }
    }

    private void syncDraftContext(Projection projection) {
        if (projection == null || !projection.mapLoaded() || !projection.tileSelected()) {
            clearMarkerDraftContext();
            return;
        }
        if (draftMapId != projection.selectedMapId()
                || draftQ != projection.selectedQ()
                || draftR != projection.selectedR()) {
            draftMapId = projection.selectedMapId();
            draftQ = projection.selectedQ();
            draftR = projection.selectedR();
            setDefaultMarkerDraft();
        }
    }

    private void clearMarkerDraftContext() {
        draftMapId = 0L;
        draftQ = 0;
        draftR = 0;
        setDefaultMarkerDraft();
    }

    private void setDefaultMarkerDraft() {
        markerDraftId = 0L;
        markerDraftName = "";
        markerDraftTypeKey = DEFAULT_MARKER_TYPE;
        markerDraftNote = "";
    }

    record Projection(
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
            List<HexMapVocabularyContentPartModel.Option> markerTypes,
            List<MarkerItem> markers
    ) {

        Projection {
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

        static Projection initial() {
            return new Projection(
                    0L,
                    "",
                    2,
                    false,
                    NO_MAP_STATUS,
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
                    HexMapVocabularyContentPartModel.MARKER_TYPE_OPTIONS,
                    List.of());
        }

        static Projection from(HexEditorSnapshot snapshot, HexTravelSnapshot travelSnapshot) {
            HexEditorSnapshot safeSnapshot = snapshot == null
                    ? HexEditorSnapshot.empty(NO_MAP_STATUS)
                    : snapshot;
            HexTravelSnapshot safeTravel = travelSnapshot == null
                    ? HexTravelSnapshot.empty(NO_TRAVEL_STATUS)
                    : travelSnapshot;
            MapState mapState = MapState.from(safeSnapshot);
            return safeSnapshot.selectedTile()
                    .map(tile -> fromTile(safeSnapshot, safeTravel, mapState, tile))
                    .orElseGet(() -> new Projection(
                            mapState.mapId(),
                            mapState.name(),
                            mapState.radius(),
                            mapState.loaded(),
                            safeSnapshot.statusText(),
                            safeSnapshot.failureText(),
                            safeSnapshot.warningText(),
                            false,
                            "Kein Hex ausgewaehlt",
                            0,
                            0,
                            "",
                            "",
                            "",
                            "",
                            "",
                            travelText(safeTravel),
                            HexMapVocabularyContentPartModel.MARKER_TYPE_OPTIONS,
                            List.of()));
        }

        private static Projection fromTile(
                HexEditorSnapshot snapshot,
                HexTravelSnapshot travelSnapshot,
                MapState mapState,
                HexEditorSnapshot.TileDetails tile
        ) {
            return new Projection(
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
                    HexMapVocabularyContentPartModel.terrainLabel(tile.terrain()),
                    fallback(tile.elevation(), "nicht verfuegbar"),
                    fallback(tile.biome(), "nicht verfuegbar"),
                    fallback(tile.explorationState(), "nicht verfuegbar"),
                    fallback(tile.notes(), "keine Notizen"),
                    travelText(travelSnapshot),
                    HexMapVocabularyContentPartModel.MARKER_TYPE_OPTIONS,
                    tile.markers().stream().map(MarkerItem::from).toList());
        }

        Projection withFailure(String nextFailureText) {
            return new Projection(
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

        private static String travelText(HexTravelSnapshot travelSnapshot) {
            if (travelSnapshot == null || !travelSnapshot.active()) {
                return "Reise: keine Hex-Reiseposition";
            }
            return "Reise: " + travelSnapshot.locationText();
        }

        List<MarkerSelectorItem> markerOptions() {
            return java.util.stream.Stream.concat(
                            java.util.stream.Stream.of(new MarkerSelectorItem(
                                    0L,
                                    "Neuer Marker",
                                    "",
                                    DEFAULT_MARKER_TYPE,
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
            return markerOptions().stream()
                    .map(MarkerSelectorItem::label)
                    .toList();
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
            return optionIndex >= 0 && optionIndex < options.size()
                    ? options.get(optionIndex)
                    : options.get(0);
        }

        List<String> markerTypeLabels() {
            return markerTypes.stream()
                    .map(HexMapVocabularyContentPartModel.Option::label)
                    .toList();
        }

        int markerTypeOptionIndex(String key) {
            int index = markerTypeIndex(key);
            if (index >= 0) {
                return index;
            }
            int defaultIndex = markerTypeIndex(DEFAULT_MARKER_TYPE);
            return defaultIndex >= 0 ? defaultIndex : 0;
        }

        String markerTypeKey(int optionIndex) {
            return optionIndex >= 0 && optionIndex < markerTypes.size()
                    ? markerTypes.get(optionIndex).key()
                    : markerTypeOrDefault(DEFAULT_MARKER_TYPE);
        }

        private int markerTypeIndex(String key) {
            String safeKey = safeText(key);
            for (int index = 0; index < markerTypes.size(); index++) {
                if (markerTypes.get(index).key().equals(safeKey)) {
                    return index;
                }
            }
            return -1;
        }
    }

    record MarkerDraftProjection(
            int markerOptionIndex,
            String name,
            int markerTypeOptionIndex,
            String note
    ) {

        MarkerDraftProjection {
            markerOptionIndex = Math.max(0, markerOptionIndex);
            name = safeText(name);
            markerTypeOptionIndex = Math.max(0, markerTypeOptionIndex);
            note = safeText(note);
        }

        static MarkerDraftProjection initial() {
            return new MarkerDraftProjection(0, "", defaultMarkerTypeOptionIndex(), "");
        }
    }

    record MarkerSelectorItem(long markerId, String label, String name, String typeKey, String note) {

        MarkerSelectorItem {
            markerId = Math.max(0L, markerId);
            label = safeText(label);
            name = safeText(name);
            typeKey = markerTypeOrDefault(typeKey);
            note = safeText(note);
        }

        static MarkerSelectorItem from(MarkerItem marker) {
            return new MarkerSelectorItem(
                    marker.markerId(),
                    marker.name(),
                    marker.name(),
                    marker.typeKey(),
                    marker.note());
        }

        @Override
        public String toString() {
            return label;
        }
    }

    record MarkerItem(long markerId, String name, String typeKey, String typeLabel, String note) {

        MarkerItem {
            markerId = Math.max(0L, markerId);
            name = safeText(name);
            typeKey = safeText(typeKey);
            typeLabel = safeText(typeLabel);
            note = safeText(note);
        }

        static MarkerItem from(HexEditorSnapshot.MarkerSnapshot marker) {
            return new MarkerItem(
                    marker.markerId().value(),
                    marker.name(),
                    marker.type(),
                    HexMapVocabularyContentPartModel.markerLabel(marker.type()),
                    marker.note());
        }
    }

    record MapState(long mapId, String name, int radius, boolean loaded) {

        MapState {
            mapId = Math.max(0L, mapId);
            name = safeText(name);
            radius = Math.max(0, radius);
        }

        static MapState from(HexEditorSnapshot snapshot) {
            HexEditorSnapshot safeSnapshot = snapshot == null
                    ? HexEditorSnapshot.empty(NO_MAP_STATUS)
                    : snapshot;
            return safeSnapshot.selectedMap()
                    .map(map -> new MapState(
                            map.mapId().value(),
                            map.displayName(),
                            map.radius(),
                            true))
                    .orElseGet(() -> new MapState(0L, "", 2, false));
        }
    }

    private static String fallback(String text, String fallback) {
        String safeText = safeText(text);
        return safeText.isBlank() ? fallback : safeText;
    }

    private static String safeText(String text) {
        return text == null ? "" : text.trim();
    }

    private static String markerTypeOrDefault(String markerTypeKey) {
        String safeKey = safeText(markerTypeKey);
        if (safeKey.isBlank()) {
            return DEFAULT_MARKER_TYPE;
        }
        return safeKey;
    }

    private static int defaultMarkerTypeOptionIndex() {
        return HexMapVocabularyContentPartModel.defaultMarkerTypeOptionIndex();
    }
}
