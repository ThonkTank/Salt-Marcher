package src.view.leftbartabs.hexmap;

import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class HexMapStateView extends VBox {

    private static final String TEXT_MUTED = "text-muted";

    private final Label statusLabel = label("", TEXT_MUTED);
    private final Label warningLabel = label("", "text-warning");
    private final Label failureLabel = label("", "text-warning");
    private final Label coordinateLabel = label("", "text-secondary");
    private final Label terrainLabel = label("", "text-secondary");
    private final Label elevationLabel = label("", TEXT_MUTED);
    private final Label biomeLabel = label("", TEXT_MUTED);
    private final Label explorationLabel = label("", TEXT_MUTED);
    private final Label notesLabel = label("", TEXT_MUTED);
    private final VBox markerList = new VBox(6);

    public HexMapStateView() {
        getStyleClass().addAll("surface-root", "control-stack");
        getChildren().addAll(
                section("Status", statusLabel, warningLabel, failureLabel),
                section("Auswahl", coordinateLabel, terrainLabel, elevationLabel,
                        biomeLabel, explorationLabel, notesLabel),
                section("Marker", markerList));
    }

    public void bind(HexMapStateContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        show(contentModel.projectionProperty().get());
        contentModel.projectionProperty().addListener((ignored, before, after) -> show(after));
    }

    private void show(HexMapStateContentModel.Projection projection) {
        if (projection == null) {
            return;
        }
        statusLabel.setText(blankFallback(projection.statusText(), "Kein Status"));
        warningLabel.setText(projection.warningText());
        failureLabel.setText(projection.failureText());
        warningLabel.setVisible(!projection.warningText().isBlank());
        warningLabel.setManaged(!projection.warningText().isBlank());
        failureLabel.setVisible(!projection.failureText().isBlank());
        failureLabel.setManaged(!projection.failureText().isBlank());
        coordinateLabel.setText("Position: " + projection.coordinateText());
        terrainLabel.setText(projection.tileSelected() ? "Terrain: " + projection.terrainText() : "Terrain: -");
        elevationLabel.setText("Hoehe: " + projection.elevationText());
        biomeLabel.setText("Biom: " + projection.biomeText());
        explorationLabel.setText("Erkundung: " + projection.explorationText());
        notesLabel.setText("Notizen: " + projection.notesText());
        markerList.getChildren().clear();
        if (projection.markers().isEmpty()) {
            markerList.getChildren().add(label("Keine Marker auf diesem Hex.", TEXT_MUTED));
        } else {
            for (HexMapStateContentModel.MarkerItem marker : projection.markers()) {
                markerList.getChildren().add(markerNode(marker));
            }
        }
    }

    private static Node markerNode(HexMapStateContentModel.MarkerItem marker) {
        VBox box = new VBox(2);
        box.getStyleClass().add("content-card");
        box.getChildren().add(label(marker.name() + " | " + marker.typeLabel(), "text-secondary"));
        if (!marker.note().isBlank()) {
            box.getChildren().add(label(marker.note(), TEXT_MUTED));
        }
        return box;
    }

    private static VBox section(String title, Node... nodes) {
        VBox box = new VBox(8);
        box.getStyleClass().add("content-card");
        box.getChildren().add(label(title, "section-title"));
        box.getChildren().addAll(nodes);
        return box;
    }

    private static String blankFallback(String text, String fallback) {
        return text == null || text.isBlank() ? fallback : text;
    }

    private static Label label(String text, String... styleClasses) {
        Label label = new Label(text);
        label.setWrapText(true);
        label.getStyleClass().addAll(styleClasses);
        return label;
    }
}
