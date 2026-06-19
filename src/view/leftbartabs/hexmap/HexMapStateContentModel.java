package src.view.leftbartabs.hexmap;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.hex.published.HexEditorSnapshot;

public final class HexMapStateContentModel {

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.initial());

    ReadOnlyObjectProperty<Projection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void applySnapshot(HexEditorSnapshot snapshot) {
        projection.set(Projection.from(snapshot));
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
            markers = markers == null ? List.of() : List.copyOf(markers);
        }

        static Projection initial() {
            return new Projection(
                    "Keine Hex-Karte geladen.",
                    "",
                    "",
                    false,
                    "Kein Hex ausgewaehlt",
                    "",
                    "",
                    "",
                    "",
                    "",
                    List.of());
        }

        static Projection from(HexEditorSnapshot snapshot) {
            HexEditorSnapshot safeSnapshot = snapshot == null
                    ? HexEditorSnapshot.empty("Keine Hex-Karte geladen.")
                    : snapshot;
            return safeSnapshot.selectedTile()
                    .map(tile -> fromTile(safeSnapshot, tile))
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
                            List.of()));
        }

        private static Projection fromTile(
                HexEditorSnapshot snapshot,
                HexEditorSnapshot.TileDetails tile
        ) {
            return new Projection(
                    snapshot.statusText(),
                    snapshot.failureText(),
                    snapshot.warningText(),
                    true,
                    tile.q() + "," + tile.r(),
                    terrainLabel(tile.terrain()),
                    fallback(tile.elevation(), "nicht verfuegbar"),
                    fallback(tile.biome(), "nicht verfuegbar"),
                    fallback(tile.explorationState(), "nicht verfuegbar"),
                    fallback(tile.notes(), "keine Notizen"),
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
                    markers);
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
                    markerLabel(marker.type()),
                    marker.note());
        }
    }

    private static String terrainLabel(String terrain) {
        return switch (safeKey(terrain, "GRASSLAND")) {
            case "FOREST" -> "Wald";
            case "MOUNTAINS" -> "Gebirge";
            case "WATER" -> "Wasser";
            case "DESERT" -> "Wueste";
            case "SWAMP" -> "Sumpf";
            default -> "Grasland";
        };
    }

    private static String markerLabel(String markerType) {
        return switch (safeKey(markerType, "LANDMARK")) {
            case "SETTLEMENT" -> "Siedlung";
            case "DANGER" -> "Gefahr";
            case "RESOURCE" -> "Ressource";
            default -> "Landmarke";
        };
    }

    private static String fallback(String text, String fallback) {
        String safeText = safeText(text);
        return safeText.isBlank() ? fallback : safeText;
    }

    private static String safeKey(String text, String fallback) {
        String safeText = safeText(text);
        return safeText.isBlank() ? fallback : safeText;
    }

    private static String safeText(String text) {
        return text == null ? "" : text.trim();
    }
}
