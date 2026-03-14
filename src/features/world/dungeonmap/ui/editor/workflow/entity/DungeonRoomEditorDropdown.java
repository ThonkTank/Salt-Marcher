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

    private final VBox panel = new VBox(12);
    private final VBox content = new VBox(12);
    private final AnchoredDropdown dropdown;

    public DungeonRoomEditorDropdown() {
        panel.getStyleClass().addAll("dropdown-window", "dungeon-room-editor-sheet");
        panel.setPadding(new Insets(12));
        panel.setPrefWidth(760);

        ScrollPane scrollPane = new ScrollPane(content);
        scrollPane.setFitToWidth(true);
        scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        scrollPane.setPrefViewportHeight(720);
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

    public void hide() {
        dropdown.hide();
    }

    private Node buildHeader(DungeonRoom room) {
        Label title = new Label("Raum bearbeiten: " + (room.name() == null || room.name().isBlank() ? "Raum" : room.name()));
        title.getStyleClass().add("dropdown-title");
        Button closeButton = new Button("Schließen");
        closeButton.setOnAction(event -> hide());
        HBox row = new HBox(8, title, spacer(), closeButton);
        row.getStyleClass().add("dropdown-actions");
        return row;
    }

    private Node buildRoomEditor(DungeonRoom room, Consumer<DungeonRoom> onSaveRoom) {
        VBox card = sectionCard("Raum");
        TextField nameField = new TextField(room.name() == null ? "" : room.name());
        TextArea glanceArea = textArea(room.glanceDescription(), 4);
        TextArea detailArea = textArea(room.detailDescription(), 8);
        TextArea reactiveArea = textArea(room.reactiveChecks(), 4);
        TextArea gmArea = textArea(room.gmBackground(), 4);
        Button saveButton = new Button("Raum speichern");
        saveButton.setOnAction(event -> onSaveRoom.accept(room.withDetails(
                nameField.getText().trim(),
                glanceArea.getText(),
                detailArea.getText(),
                reactiveArea.getText(),
                gmArea.getText())));
        card.getChildren().addAll(
                field("Name", nameField),
                field("Blicktext", glanceArea),
                field("Detailbeschreibung", detailArea),
                field("Reaktive Checks", reactiveArea),
                field("GM-Hintergrund", gmArea),
                actionRow(saveButton));
        return card;
    }

    private Node buildFeatureSection(
            List<DungeonFeature> features,
            List<DungeonEncounterSummary> encounters,
            Consumer<DungeonFeature> onSaveFeature
    ) {
        VBox wrapper = new VBox(10);
        Label title = new Label("Features");
        title.getStyleClass().add("dungeon-gm-section-header");
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
        TextArea glanceArea = textArea(feature.glanceDescription(), 3);
        TextArea detailArea = textArea(feature.detailDescription(), 6);
        TextArea reactiveArea = textArea(feature.reactiveChecks(), 3);
        TextArea gmArea = textArea(feature.gmBackground(), 3);

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
                field("Name", nameField),
                field("Kategorie", categoryCombo),
                field("Encounter", encounterCombo),
                field("Reihenfolge", sortOrderSpinner),
                field("Blicktext", glanceArea),
                field("Detailbeschreibung", detailArea),
                field("Reaktive Checks", reactiveArea),
                field("GM-Hintergrund", gmArea),
                actionRow(saveButton));
        return card;
    }

    private static VBox sectionCard(String titleText) {
        VBox card = new VBox(8);
        card.getStyleClass().addAll("dungeon-editor-card", "dungeon-room-editor-card");
        card.setPadding(new Insets(10));
        Label title = new Label(titleText);
        title.getStyleClass().add("dungeon-gm-block-title");
        card.getChildren().add(title);
        return card;
    }

    private static VBox field(String title, Node input) {
        VBox box = new VBox(6);
        Label label = new Label(title);
        label.getStyleClass().addAll("section-header", "text-muted");
        box.getChildren().addAll(label, input);
        return box;
    }

    private static TextArea textArea(String value, int rows) {
        TextArea area = new TextArea(value == null ? "" : value);
        area.setWrapText(true);
        area.setPrefRowCount(rows);
        return area;
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
