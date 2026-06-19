package src.view.leftbartabs.hexmap;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.hex.published.HexEditorSnapshot;
import src.domain.hex.published.HexTravelSnapshot;

public final class HexMapStateContentModel {

    private static final String NO_MAP_STATUS = "Keine Hex-Karte geladen.";
    private static final String NO_TRAVEL_STATUS = "Keine Hex-Reiseposition ausgewaehlt.";

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.initial());
    private HexEditorSnapshot editorSnapshot = HexEditorSnapshot.empty(NO_MAP_STATUS);
    private HexTravelSnapshot travelSnapshot = HexTravelSnapshot.empty(NO_TRAVEL_STATUS);

    ReadOnlyObjectProperty<Projection> projectionProperty() {
        return projection.getReadOnlyProperty();
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
        projection.set(Projection.from(editorSnapshot, travelSnapshot));
    }

    void showLocalFailure(String failureText) {
        Projection current = projection.get();
        projection.set(current.withFailure(failureText));
    }

    record Projection(
            String statusText,
            String failureText,
            String warningText,
            boolean tileSelected,
            String coordinateText,
            String terrainText,
            String elevationText,
            String biomeText,
            String explorationText,
            String notesText,
            String travelText,
            List<MarkerItem> markers
    ) {

        Projection {
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
            markers = markers == null ? List.of() : List.copyOf(markers);
        }

        static Projection initial() {
            return new Projection(
                    NO_MAP_STATUS,
                    "",
                    "",
                    false,
                    "Kein Hex ausgewaehlt",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "Keine Hex-Reiseposition ausgewaehlt.",
                    List.of());
        }

        static Projection from(HexEditorSnapshot snapshot, HexTravelSnapshot travelSnapshot) {
            HexEditorSnapshot safeSnapshot = snapshot == null
                    ? HexEditorSnapshot.empty(NO_MAP_STATUS)
                    : snapshot;
            HexTravelSnapshot safeTravel = travelSnapshot == null
                    ? HexTravelSnapshot.empty(NO_TRAVEL_STATUS)
                    : travelSnapshot;
            return safeSnapshot.selectedTile()
                    .map(tile -> fromTile(safeSnapshot, safeTravel, tile))
                    .orElseGet(() -> new Projection(
                            safeSnapshot.statusText(),
                            safeSnapshot.failureText(),
                            safeSnapshot.warningText(),
                            false,
                            "Kein Hex ausgewaehlt",
                            "",
                            "",
                            "",
                            "",
                            "",
                            travelText(safeTravel),
                            List.of()));
        }

        private static Projection fromTile(
                HexEditorSnapshot snapshot,
                HexTravelSnapshot travelSnapshot,
                HexEditorSnapshot.TileDetails tile
        ) {
            return new Projection(
                    snapshot.statusText(),
                    snapshot.failureText(),
                    snapshot.warningText(),
                    true,
                    tile.q() + "," + tile.r(),
                    HexMapVocabularyContentPartModel.terrainLabel(tile.terrain()),
                    fallback(tile.elevation(), "nicht verfuegbar"),
                    fallback(tile.biome(), "nicht verfuegbar"),
                    fallback(tile.explorationState(), "nicht verfuegbar"),
                    fallback(tile.notes(), "keine Notizen"),
                    travelText(travelSnapshot),
                    tile.markers().stream().map(MarkerItem::from).toList());
        }

        Projection withFailure(String nextFailureText) {
            return new Projection(
                    statusText,
                    nextFailureText,
                    warningText,
                    tileSelected,
                    coordinateText,
                    terrainText,
                    elevationText,
                biomeText,
                explorationText,
                notesText,
                travelText,
                markers);
        }

        private static String travelText(HexTravelSnapshot travelSnapshot) {
            if (travelSnapshot == null || !travelSnapshot.active()) {
                return "Reise: keine Hex-Reiseposition";
            }
            return "Reise: " + travelSnapshot.locationText();
        }
    }

    record MarkerItem(String name, String typeLabel, String note) {

        MarkerItem {
            name = safeText(name);
            typeLabel = safeText(typeLabel);
            note = safeText(note);
        }

        static MarkerItem from(HexEditorSnapshot.MarkerSnapshot marker) {
            return new MarkerItem(
                    marker.name(),
                    HexMapVocabularyContentPartModel.markerLabel(marker.type()),
                    marker.note());
        }
    }

    private static String fallback(String text, String fallback) {
        String safeText = safeText(text);
        return safeText.isBlank() ? fallback : safeText;
    }

    private static String safeText(String text) {
        return text == null ? "" : text.trim();
    }
}
