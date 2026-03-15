package features.world.dungeonmap.ui.editor.workflow.entity;

import features.world.dungeonmap.api.catalog.DungeonEncounterSummary;
import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonFeatureCategory;
import features.world.dungeonmap.model.domain.DungeonRoom;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.Spinner;
import javafx.scene.control.SpinnerValueFactory;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import ui.components.AnchoredDropdown;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;

public final class DungeonRoomEditorDropdown {
    private static final double PANEL_WIDTH = 980;
    private static final double VIEWPORT_WIDTH = 944;
    private static final double VIEWPORT_HEIGHT = 560;

    private final VBox panel = new VBox(12);
    private final VBox content = new VBox(12);
    private final AnchoredDropdown dropdown;

    public DungeonRoomEditorDropdown() {
        panel.getStyleClass().addAll("dropdown-window", "dungeon-room-editor-sheet");
        panel.setPadding(new Insets(12));
        panel.setMinWidth(PANEL_WIDTH);
        panel.setPrefWidth(PANEL_WIDTH);
        panel.setMaxWidth(PANEL_WIDTH);

        content.setFillWidth(true);
        content.setMinWidth(VIEWPORT_WIDTH);
        content.setPrefWidth(VIEWPORT_WIDTH);
        content.setMaxWidth(VIEWPORT_WIDTH);

        ScrollPane scrollPane = new ScrollPane(content);
        scrollPane.setFitToWidth(true);
        scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        scrollPane.setPrefViewportWidth(VIEWPORT_WIDTH);
        scrollPane.setPrefViewportHeight(VIEWPORT_HEIGHT);
        scrollPane.setMinWidth(VIEWPORT_WIDTH);
        scrollPane.setPrefWidth(VIEWPORT_WIDTH);
        scrollPane.setMaxWidth(VIEWPORT_WIDTH);
        scrollPane.getStyleClass().add("dungeon-room-editor-scroll");

        panel.getChildren().add(scrollPane);
        dropdown = new AnchoredDropdown(panel);
    }

    public void show(
            Node anchor,
            DungeonRoom room,
            List<DungeonFeature> features,
            List<DungeonEncounterSummary> encounters,
            Consumer<DungeonRoom> onSaveRoom,
            Consumer<DungeonFeature> onSaveFeature
    ) {
        if (anchor == null || room == null) {
            return;
        }
        content.getChildren().setAll(
                buildHeader(room),
                buildRoomEditor(room, onSaveRoom),
                buildFeatureSection(features, encounters, onSaveFeature));
        dropdown.show(anchor, AnchoredDropdown.HorizontalAlignment.RIGHT, 6);
    }

    public void showFeature(
            Node anchor,
            DungeonFeature feature,
            List<DungeonEncounterSummary> encounters,
            Consumer<DungeonFeature> onSaveFeature
    ) {
        if (anchor == null || feature == null) {
            return;
        }
        content.getChildren().setAll(
                buildFeatureHeader(feature),
                buildFeatureEditor(feature, encounters, onSaveFeature));
        dropdown.show(anchor, AnchoredDropdown.HorizontalAlignment.RIGHT, 6);
    }

    public void hide() {
        dropdown.hide();
    }

    private Node buildHeader(DungeonRoom room) {
        Label title = new Label("Raum bearbeiten: " + (room.name() == null || room.name().isBlank() ? "Raum" : room.name()));
        title.getStyleClass().add("dropdown-title");
        title.setWrapText(true);
        title.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(title, Priority.ALWAYS);
        Button closeButton = new Button("Schließen");
        closeButton.setOnAction(event -> hide());
        HBox row = new HBox(8, title, spacer(), closeButton);
        row.getStyleClass().add("dropdown-actions");
        return row;
    }

    private Node buildFeatureHeader(DungeonFeature feature) {
        String label = feature.name() == null || feature.name().isBlank()
                ? (feature.category() == null ? "Feature" : feature.category().label())
                : feature.name();
        Label title = new Label("Feature bearbeiten: " + label);
        title.getStyleClass().add("dropdown-title");
        title.setWrapText(true);
        title.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(title, Priority.ALWAYS);
        Button closeButton = new Button("Schließen");
        closeButton.setOnAction(event -> hide());
        HBox row = new HBox(8, title, spacer(), closeButton);
        row.getStyleClass().add("dropdown-actions");
        return row;
    }

    private Node buildRoomEditor(DungeonRoom room, Consumer<DungeonRoom> onSaveRoom) {
        VBox card = sectionCard("Raum");
        TextField nameField = new TextField(room.name() == null ? "" : room.name());
        TextArea lightArea = textArea(room.lightLevel());
        TextArea visualArea = textArea(room.visualDescription());
        TextArea soundsArea = textArea(room.soundsDescription());
        TextArea smellsArea = textArea(room.smellsDescription());
        TextArea otherArea = textArea(room.otherDescription());
        TextArea reactiveArea = textArea(room.reactiveChecks());
        TextArea gmArea = textArea(room.gmBackground());
        Button saveButton = new Button("Raum speichern");
        saveButton.setOnAction(event -> onSaveRoom.accept(room.withMetadata(
                nameField.getText().trim(),
                lightArea.getText(),
                visualArea.getText(),
                soundsArea.getText(),
                smellsArea.getText(),
                otherArea.getText(),
                room.glanceDescription(),
                room.detailDescription(),
                reactiveArea.getText(),
                gmArea.getText())));
        card.getChildren().addAll(
                field("Name", nameField),
                twoColumnFields(
                        field("Lichtlevel", lightArea),
                        field("Visuelle Beschreibung", visualArea)),
                twoColumnFields(
                        field("Geräusche", soundsArea),
                        field("Gerüche", smellsArea)),
                twoColumnFields(
                        field("Anderes", otherArea),
                        field("Mechanische Effekte und Inhalte", reactiveArea)),
                field("GM-Details", gmArea),
                actionRow(saveButton));
        return card;
    }

    private Node buildFeatureSection(
            List<DungeonFeature> features,
            List<DungeonEncounterSummary> encounters,
            Consumer<DungeonFeature> onSaveFeature
    ) {
        VBox wrapper = new VBox(10);
        wrapper.setMaxWidth(Double.MAX_VALUE);
        Label title = new Label("Features");
        title.getStyleClass().add("dungeon-gm-section-header");
        title.setWrapText(true);
        title.setMaxWidth(Double.MAX_VALUE);
        wrapper.getChildren().add(title);
        for (DungeonFeature feature : features == null ? List.<DungeonFeature>of() : features) {
            wrapper.getChildren().add(buildFeatureEditor(feature, encounters, onSaveFeature));
        }
        return wrapper;
    }

    private Node buildFeatureEditor(
            DungeonFeature feature,
            List<DungeonEncounterSummary> encounters,
            Consumer<DungeonFeature> onSaveFeature
    ) {
        VBox card = sectionCard(feature.toString());
        ComboBox<DungeonFeatureCategory> categoryCombo = new ComboBox<>();
        categoryCombo.setMaxWidth(Double.MAX_VALUE);
        categoryCombo.getItems().setAll(DungeonFeatureCategory.values());
        categoryCombo.setConverter(namedConverter(DungeonFeatureCategory::label));
        categoryCombo.setValue(feature.category() == null ? DungeonFeatureCategory.CURIOSITY : feature.category());

        ComboBox<DungeonEncounterSummary> encounterCombo = new ComboBox<>();
        encounterCombo.setMaxWidth(Double.MAX_VALUE);
        encounterCombo.getItems().setAll(encounters == null ? List.of() : encounters);
        encounterCombo.setConverter(namedConverter(DungeonEncounterSummary::name));
        encounterCombo.setValue(findById(encounters, feature.encounterId(), DungeonEncounterSummary::encounterId));
        updateEncounterComboState(encounterCombo, categoryCombo.getValue());
        categoryCombo.valueProperty().addListener((obs, oldValue, newValue) -> updateEncounterComboState(encounterCombo, newValue));

        TextField nameField = new TextField(feature.name() == null ? "" : feature.name());
        Spinner<Integer> sortOrderSpinner = new Spinner<>();
        sortOrderSpinner.setValueFactory(new SpinnerValueFactory.IntegerSpinnerValueFactory(-999, 999, feature.sortOrder()));
        sortOrderSpinner.setEditable(true);
        sortOrderSpinner.setMaxWidth(Double.MAX_VALUE);
        TextArea glanceArea = textArea(feature.glanceDescription());
        TextArea detailArea = textArea(feature.detailDescription());
        TextArea reactiveArea = textArea(feature.reactiveChecks());
        TextArea gmArea = textArea(feature.gmBackground());

        Button saveButton = new Button("Feature speichern");
        saveButton.setOnAction(event -> {
            DungeonFeatureCategory category = categoryCombo.getValue() == null ? DungeonFeatureCategory.CURIOSITY : categoryCombo.getValue();
            DungeonEncounterSummary encounter = encounterCombo.getValue();
            onSaveFeature.accept(feature.withEditorValues(
                    category,
                    category == DungeonFeatureCategory.ENCOUNTER && encounter != null ? encounter.encounterId() : null,
                    nameField.getText().trim(),
                    glanceArea.getText(),
                    detailArea.getText(),
                    reactiveArea.getText(),
                    gmArea.getText(),
                    sortOrderSpinner.getValue() == null ? 0 : sortOrderSpinner.getValue()));
        });

        card.getChildren().addAll(
                twoColumnFields(
                        field("Name", nameField),
                        field("Kategorie", categoryCombo)),
                twoColumnFields(
                        field("Encounter", encounterCombo),
                        field("Reihenfolge", sortOrderSpinner)),
                twoColumnFields(
                        field("At a glance", glanceArea),
                        field("Detailbeschreibung", detailArea)),
                twoColumnFields(
                        field("Mechanische Effekte und Inhalte", reactiveArea),
                        field("GM details", gmArea)),
                actionRow(saveButton));
        return card;
    }

    private static VBox sectionCard(String titleText) {
        VBox card = new VBox(8);
        card.getStyleClass().addAll("dungeon-editor-card", "dungeon-room-editor-card");
        card.setPadding(new Insets(10));
        card.setMaxWidth(Double.MAX_VALUE);
        Label title = new Label(titleText);
        title.getStyleClass().add("dungeon-gm-block-title");
        title.setWrapText(true);
        title.setMaxWidth(Double.MAX_VALUE);
        card.getChildren().add(title);
        return card;
    }

    private static VBox field(String title, Node input) {
        VBox box = new VBox(6);
        box.setMaxWidth(Double.MAX_VALUE);
        Label label = new Label(title);
        label.getStyleClass().addAll("section-header", "text-muted");
        box.getChildren().addAll(label, input);
        if (input instanceof Region region) {
            region.setMaxWidth(Double.MAX_VALUE);
        }
        return box;
    }

    private static Node twoColumnFields(Node left, Node right) {
        GridPane grid = new GridPane();
        grid.setHgap(12);
        grid.setVgap(0);
        grid.setMaxWidth(Double.MAX_VALUE);
        GridPane.setHgrow(left, Priority.ALWAYS);
        GridPane.setHgrow(right, Priority.ALWAYS);
        grid.add(left, 0, 0);
        grid.add(right, 1, 0);
        return grid;
    }

    private static TextArea textArea(String value) {
        TextArea area = new TextArea(value == null ? "" : value);
        area.setWrapText(true);
        area.setPrefRowCount(1);
        area.setMinHeight(Region.USE_PREF_SIZE);
        bindCompactHeight(area);
        return area;
    }

    private static void bindCompactHeight(TextArea area) {
        updateTextAreaHeight(area);
        area.textProperty().addListener((obs, oldValue, newValue) -> updateTextAreaHeight(area));
    }

    private static void updateTextAreaHeight(TextArea area) {
        int rows = estimatedRows(area == null ? null : area.getText());
        area.setPrefRowCount(rows);
        area.setMaxHeight(Region.USE_PREF_SIZE);
    }

    private static int estimatedRows(String value) {
        if (value == null || value.isBlank()) {
            return 1;
        }
        int lineCount = value.split("\\R", -1).length;
        int wrappedEstimate = Math.max(1, (int) Math.ceil(value.length() / 80.0));
        return Math.max(1, Math.min(3, Math.max(lineCount, wrappedEstimate)));
    }

    private static HBox actionRow(Node... nodes) {
        HBox row = new HBox(8, nodes);
        row.getStyleClass().add("dropdown-actions");
        return row;
    }

    private static Region spacer() {
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        return spacer;
    }

    private static <T> StringConverter<T> namedConverter(Function<T, String> labelProvider) {
        return new StringConverter<>() {
            @Override
            public String toString(T object) {
                return object == null ? "" : labelProvider.apply(object);
            }

            @Override
            public T fromString(String string) {
                return null;
            }
        };
    }

    private static void updateEncounterComboState(ComboBox<DungeonEncounterSummary> comboBox, DungeonFeatureCategory category) {
        boolean enabled = category == DungeonFeatureCategory.ENCOUNTER;
        comboBox.setDisable(!enabled);
        if (!enabled) {
            comboBox.setValue(null);
        }
    }

    private static <T> T findById(List<T> values, Long id, Function<T, Long> idAccessor) {
        if (values == null || id == null) {
            return null;
        }
        for (T value : values) {
            if (id.equals(idAccessor.apply(value))) {
                return value;
            }
        }
        return null;
    }
}
