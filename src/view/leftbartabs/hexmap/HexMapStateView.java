package src.view.leftbartabs.hexmap;

import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.Spinner;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

public final class HexMapStateView extends VBox {

    private static final String TEXT_MUTED = "text-muted";
    private static final String TEXT_SECONDARY = "text-secondary";
    private static final String UPDATING_KEY = "hex.state.updating";
    private static final int MAX_AUTHORED_RADIUS = 99;

    private final Label statusLabel = label("", TEXT_MUTED);
    private final Label travelLabel = label("", TEXT_SECONDARY);
    private final Label warningLabel = label("", "text-warning");
    private final Label failureLabel = label("", "text-warning");
    private final TextField mapNameField = new TextField();
    private final Spinner<Integer> radiusSpinner = new Spinner<>(0, MAX_AUTHORED_RADIUS, 2);
    private final Button saveMapButton = button("Speichern");
    private final Button confirmShrinkButton = button("Shrink bestaetigen");
    private final Label coordinateLabel = label("", TEXT_SECONDARY);
    private final Label terrainLabel = label("", TEXT_SECONDARY);
    private final Label elevationLabel = label("", TEXT_MUTED);
    private final Label biomeLabel = label("", TEXT_MUTED);
    private final Label explorationLabel = label("", TEXT_MUTED);
    private final Label notesLabel = label("", TEXT_MUTED);
    private final ComboBox<String> markerSelector = new ComboBox<>();
    private final TextField markerNameField = new TextField();
    private final ComboBox<String> markerTypeSelector = new ComboBox<>();
    private final TextArea markerNoteArea = new TextArea();
    private final Button saveMarkerButton = button("Marker speichern");
    private final VBox markerList = new VBox(6);
    private Consumer<HexMapStateViewInputEvent> eventConsumer = ignored -> { };

    public HexMapStateView() {
        getStyleClass().addAll("surface-root", "control-stack");
        mapNameField.setPromptText("Kartenname");
        mapNameField.setAccessibleText("Hex-Kartenname");
        radiusSpinner.setEditable(true);
        markerNameField.setPromptText("Markername");
        markerNameField.setAccessibleText("Hex-Markername");
        markerTypeSelector.setAccessibleText("Hex-Markertyp");
        markerSelector.setAccessibleText("Hex-Marker auswaehlen");
        markerNoteArea.setPromptText("Notiz optional");
        markerNoteArea.setAccessibleText("Hex-Markernotiz");
        markerNoteArea.setPrefRowCount(3);
        markerNoteArea.setWrapText(true);
        getChildren().addAll(
                section("Status", statusLabel, travelLabel, warningLabel, failureLabel),
                section("Karte", mapNameField, row(label("Radius", TEXT_MUTED), radiusSpinner),
                        row(saveMapButton, confirmShrinkButton)),
                section("Auswahl", coordinateLabel, terrainLabel, elevationLabel,
                        biomeLabel, explorationLabel, notesLabel),
                section("Marker", markerSelector, markerNameField, markerTypeSelector,
                        markerNoteArea, saveMarkerButton, markerList));
        saveMapButton.setOnAction(event -> publishMap(false));
        confirmShrinkButton.setOnAction(event -> publishMap(true));
        saveMarkerButton.setOnAction(event -> publishMarker());
        markerSelector.setOnAction(event -> {
            if (!updating()) {
                publishMarkerDraftFromSelection();
            }
        });
        markerNameField.textProperty().addListener((ignored, before, after) -> publishMarkerDraftFromFields());
        markerTypeSelector.setOnAction(event -> publishMarkerDraftFromFields());
        markerNoteArea.textProperty().addListener((ignored, before, after) -> publishMarkerDraftFromFields());
    }

    public void bind(HexMapStateContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        show(contentModel.projectionProperty().get());
        showMarkerDraft(contentModel.markerDraftProperty().get());
        contentModel.projectionProperty().addListener((ignored, before, after) -> {
            show(after);
            showMarkerDraft(contentModel.markerDraftProperty().get());
        });
        contentModel.markerDraftProperty().addListener((ignored, before, after) -> showMarkerDraft(after));
    }

    void bind(HexMapViewModel viewModel) {
        if (viewModel != null) {
            bind(viewModel.stateContentModel());
        }
    }

    public void onViewInputEvent(Consumer<HexMapStateViewInputEvent> consumer) {
        eventConsumer = consumer == null ? ignored -> { } : consumer;
    }

    private void show(HexMapStateContentModel.Projection nextProjection) {
        if (nextProjection == null) {
            return;
        }
        withSuppressedEvents(() -> {
            statusLabel.setText(blankFallback(nextProjection.statusText(), "Kein Status"));
            travelLabel.setText(nextProjection.travelText());
            warningLabel.setText(nextProjection.warningText());
            failureLabel.setText(nextProjection.failureText());
            warningLabel.setVisible(!nextProjection.warningText().isBlank());
            warningLabel.setManaged(!nextProjection.warningText().isBlank());
            failureLabel.setVisible(!nextProjection.failureText().isBlank());
            failureLabel.setManaged(!nextProjection.failureText().isBlank());
            mapNameField.setText(nextProjection.selectedMapName());
            radiusSpinner.getValueFactory().setValue(nextProjection.selectedMapRadius());
            coordinateLabel.setText("Position: " + nextProjection.coordinateText());
            terrainLabel.setText(nextProjection.tileSelected() ? "Terrain: " + nextProjection.terrainText() : "Terrain: -");
            elevationLabel.setText("Hoehe: " + nextProjection.elevationText());
            biomeLabel.setText("Biom: " + nextProjection.biomeText());
            explorationLabel.setText("Erkundung: " + nextProjection.explorationText());
            notesLabel.setText("Notizen: " + nextProjection.notesText());
            markerTypeSelector.getItems().setAll(nextProjection.markerTypeLabels());
            markerSelector.getItems().setAll(nextProjection.markerOptionLabels());
            showMarkerList(nextProjection);
            boolean mapLoaded = nextProjection.mapLoaded();
            mapNameField.setDisable(!mapLoaded);
            radiusSpinner.setDisable(!mapLoaded);
            saveMapButton.setDisable(!mapLoaded);
            confirmShrinkButton.setDisable(!mapLoaded || nextProjection.warningText().isBlank());
            boolean markerEnabled = mapLoaded && nextProjection.tileSelected();
            markerSelector.setDisable(!markerEnabled);
            markerNameField.setDisable(!markerEnabled);
            markerTypeSelector.setDisable(!markerEnabled);
            markerNoteArea.setDisable(!markerEnabled);
            saveMarkerButton.setDisable(!markerEnabled);
        });
    }

    private void showMarkerDraft(HexMapStateContentModel.MarkerDraftProjection draft) {
        if (draft == null) {
            return;
        }
        withSuppressedEvents(() -> {
            selectByIndex(markerSelector, draft.markerOptionIndex());
            markerNameField.setText(draft.name());
            selectByIndex(markerTypeSelector, draft.markerTypeOptionIndex());
            markerNoteArea.setText(draft.note());
        });
    }

    private void showMarkerList(HexMapStateContentModel.Projection projection) {
        markerList.getChildren().clear();
        if (projection.markers().isEmpty()) {
            markerList.getChildren().add(label("Keine Marker auf diesem Hex.", TEXT_MUTED));
            return;
        }
        for (HexMapStateContentModel.MarkerItem marker : projection.markers()) {
            markerList.getChildren().add(markerNode(marker));
        }
    }

    private void publishMap(boolean confirmShrink) {
        eventConsumer.accept(new HexMapStateViewInputEvent(
                true,
                false,
                mapNameField.getText(),
                rawRadius(),
                confirmShrink,
                -1,
                false,
                "",
                -1,
                ""));
    }

    private void publishMarker() {
        eventConsumer.accept(new HexMapStateViewInputEvent(
                false,
                true,
                mapNameField.getText(),
                rawRadius(),
                false,
                markerSelector.getSelectionModel().getSelectedIndex(),
                false,
                markerNameField.getText(),
                markerTypeSelector.getSelectionModel().getSelectedIndex(),
                markerNoteArea.getText()));
    }

    private void publishMarkerDraftFromSelection() {
        if (updating()) {
            return;
        }
        eventConsumer.accept(new HexMapStateViewInputEvent(
                false,
                false,
                mapNameField.getText(),
                rawRadius(),
                false,
                markerSelector.getSelectionModel().getSelectedIndex(),
                true,
                "",
                -1,
                ""));
    }

    private void publishMarkerDraftFromFields() {
        if (updating()) {
            return;
        }
        eventConsumer.accept(new HexMapStateViewInputEvent(
                false,
                false,
                mapNameField.getText(),
                rawRadius(),
                false,
                markerSelector.getSelectionModel().getSelectedIndex(),
                false,
                markerNameField.getText(),
                markerTypeSelector.getSelectionModel().getSelectedIndex(),
                markerNoteArea.getText()));
    }

    private static Node markerNode(HexMapStateContentModel.MarkerItem marker) {
        VBox box = new VBox(2);
        box.getStyleClass().add("content-card");
        box.getChildren().add(label(marker.name() + " | " + marker.typeLabel(), TEXT_SECONDARY));
        if (!marker.note().isBlank()) {
            box.getChildren().add(label(marker.note(), TEXT_MUTED));
        }
        return box;
    }

    private boolean updating() {
        Object value = getProperties().get(UPDATING_KEY);
        return value instanceof Boolean updatingValue && updatingValue;
    }

    private void setUpdating(boolean nextUpdating) {
        getProperties().put(UPDATING_KEY, nextUpdating);
    }

    private void withSuppressedEvents(Runnable updateAction) {
        setUpdating(true);
        try {
            updateAction.run();
        } finally {
            setUpdating(false);
        }
    }

    private String rawRadius() {
        Integer radius = radiusSpinner.getValue();
        return radius == null ? "" : radius.toString();
    }

    private static void selectByIndex(
            ComboBox<String> comboBox,
            int index
    ) {
        if (index >= 0 && index < comboBox.getItems().size()) {
            comboBox.getSelectionModel().select(index);
            return;
        }
        comboBox.getSelectionModel().selectFirst();
    }

    private static VBox section(String title, Node... nodes) {
        VBox box = new VBox(8);
        box.getStyleClass().add("content-card");
        box.getChildren().add(label(title, "section-title"));
        box.getChildren().addAll(nodes);
        return box;
    }

    private static HBox row(Node... nodes) {
        return new HBox(8, nodes);
    }

    private static Button button(String text) {
        Button button = new Button(text);
        button.getStyleClass().add("toolbar-action-button");
        return button;
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
