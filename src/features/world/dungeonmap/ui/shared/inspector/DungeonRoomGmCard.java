package features.world.dungeonmap.ui.shared.inspector;

import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonRoom;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.scene.text.Text;
import javafx.scene.text.TextFlow;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;

public final class DungeonRoomGmCard extends VBox {
    private static final String LABEL_REACTIVE_CHECKS = "Reaktive Checks";
    private static final String LABEL_GM_BACKGROUND = "GM-Hintergrund";

    public interface Callbacks {
        void saveRoom(DungeonRoom room);

        void saveFeature(DungeonFeature feature);
    }

    public DungeonRoomGmCard(DungeonRoom room, List<DungeonFeature> features) {
        this(room, null, features, null);
    }

    public DungeonRoomGmCard(DungeonRoom room, String areaName, List<DungeonFeature> features) {
        this(room, areaName, features, null);
    }

    public DungeonRoomGmCard(DungeonRoom room, String areaName, List<DungeonFeature> features, Callbacks callbacks) {
        getStyleClass().add("dungeon-gm-card");
        setSpacing(0);
        setPadding(new Insets(8, 0, 8, 0));

        appendHeader(room, areaName);
        appendSeparator();

        appendRoomField(room.glanceDescription(), null, "Raumbeschreibung", false, callbacks, value ->
                room.withDetails(room.name(), value, room.detailDescription(), room.reactiveChecks(), room.gmBackground()));
        appendFeatureFields(safe(features), FeatureFieldSpec.glance(), callbacks);

        appendRoomField(room.reactiveChecks(), LABEL_REACTIVE_CHECKS, LABEL_REACTIVE_CHECKS, true, callbacks, value ->
                room.withDetails(room.name(), room.glanceDescription(), room.detailDescription(), value, room.gmBackground()));
        appendFeatureFields(safe(features), FeatureFieldSpec.reactiveChecks(), callbacks);

        appendRoomField(room.detailDescription(), null, "Raumdetails", false, callbacks, value ->
                room.withDetails(room.name(), room.glanceDescription(), value, room.reactiveChecks(), room.gmBackground()));
        appendFeatureFields(safe(features), FeatureFieldSpec.detail(), callbacks);

        appendRoomField(room.gmBackground(), LABEL_GM_BACKGROUND, LABEL_GM_BACKGROUND, true, callbacks, value ->
                room.withDetails(room.name(), room.glanceDescription(), room.detailDescription(), room.reactiveChecks(), value));
        appendFeatureFields(safe(features), FeatureFieldSpec.gmBackground(), callbacks);
    }

    private void appendHeader(DungeonRoom room, String areaName) {
        Label title = new Label(formatRoomTitle(room));
        title.getStyleClass().add("dungeon-gm-title");
        title.setWrapText(true);
        getChildren().add(title);

        if (areaName != null && !areaName.isBlank()) {
            Label meta = new Label("Bereich: " + areaName.trim());
            meta.getStyleClass().add("dungeon-gm-meta");
            meta.setWrapText(true);
            getChildren().add(meta);
        }
    }

    private void appendEntry(javafx.scene.Node entry) {
        if (entry == null) {
            return;
        }
        getChildren().add(entry);
    }

    private void appendRoomField(
            String text,
            String visibleTitle,
            String editLabel,
            boolean subdued,
            Callbacks callbacks,
            Function<String, DungeonRoom> updater
    ) {
        if (text == null || text.isBlank()) {
            return;
        }
        Consumer<String> onSave = callbacks == null ? null : value -> callbacks.saveRoom(updater.apply(value));
        appendEntry(new EditableFlowEntry(visibleTitle, text, editLabel, onSave, subdued));
    }

    private void appendFeatureFields(List<DungeonFeature> features, FeatureFieldSpec spec, Callbacks callbacks) {
        for (DungeonFeature feature : features) {
            String text = spec.textExtractor().apply(feature);
            if (feature == null || text == null || text.isBlank()) {
                continue;
            }
            String visibleTitle = spec.subdued()
                    ? spec.visibleLabel() + " (" + feature + ")"
                    : feature.toString();
            String editLabel = spec.subdued()
                    ? spec.editLabel() + " - " + feature
                    : feature.toString();
            Consumer<String> onSave = callbacks == null ? null : value -> callbacks.saveFeature(spec.updater().apply(feature, value));
            appendEntry(new EditableFlowEntry(visibleTitle, text, editLabel, onSave, spec.subdued()));
        }
    }

    private void appendSeparator() {
        Region separator = new Region();
        separator.getStyleClass().add("stat-block-separator");
        separator.setMinHeight(2);
        separator.setPrefHeight(2);
        separator.setMaxHeight(2);
        VBox.setMargin(separator, new Insets(6, 0, 6, 0));
        getChildren().add(separator);
    }

    private static List<DungeonFeature> safe(List<DungeonFeature> features) {
        return features == null ? List.of() : features;
    }

    private static String formatRoomTitle(DungeonRoom room) {
        String title = room == null || room.name() == null || room.name().isBlank() ? "Raum" : room.name().trim();
        return room == null || room.roomId() == null ? title : room.roomId() + ": " + title;
    }

    private record FeatureFieldSpec(
            Function<DungeonFeature, String> textExtractor,
            String visibleLabel,
            String editLabel,
            boolean subdued,
            FeatureValueUpdater updater
    ) {
        private static FeatureFieldSpec glance() {
            return new FeatureFieldSpec(
                    DungeonFeature::glanceDescription,
                    null,
                    null,
                    false,
                    (feature, value) -> feature.withEditorValues(
                            feature.category(),
                            feature.encounterId(),
                            feature.name(),
                            value,
                            feature.detailDescription(),
                            feature.reactiveChecks(),
                            feature.gmBackground(),
                            feature.sortOrder()));
        }

        private static FeatureFieldSpec reactiveChecks() {
            return new FeatureFieldSpec(
                    DungeonFeature::reactiveChecks,
                    LABEL_REACTIVE_CHECKS,
                    LABEL_REACTIVE_CHECKS,
                    true,
                    (feature, value) -> feature.withEditorValues(
                            feature.category(),
                            feature.encounterId(),
                            feature.name(),
                            feature.glanceDescription(),
                            feature.detailDescription(),
                            value,
                            feature.gmBackground(),
                            feature.sortOrder()));
        }

        private static FeatureFieldSpec detail() {
            return new FeatureFieldSpec(
                    DungeonFeature::detailDescription,
                    null,
                    null,
                    false,
                    (feature, value) -> feature.withEditorValues(
                            feature.category(),
                            feature.encounterId(),
                            feature.name(),
                            feature.glanceDescription(),
                            value,
                            feature.reactiveChecks(),
                            feature.gmBackground(),
                            feature.sortOrder()));
        }

        private static FeatureFieldSpec gmBackground() {
            return new FeatureFieldSpec(
                    DungeonFeature::gmBackground,
                    LABEL_GM_BACKGROUND,
                    LABEL_GM_BACKGROUND,
                    true,
                    (feature, value) -> feature.withEditorValues(
                            feature.category(),
                            feature.encounterId(),
                            feature.name(),
                            feature.glanceDescription(),
                            feature.detailDescription(),
                            feature.reactiveChecks(),
                            value,
                            feature.sortOrder()));
        }
    }

    @FunctionalInterface
    private interface FeatureValueUpdater {
        DungeonFeature apply(DungeonFeature feature, String value);
    }

    private static final class EditableFlowEntry extends VBox {
        private final VBox readBox = new VBox(0);
        private final VBox editBox = new VBox(4);

        private EditableFlowEntry(String title, String text, String editLabelText, Consumer<String> onSave, boolean subdued) {
            setSpacing(0);
            getStyleClass().add("dungeon-gm-entry");

            HBox readRow = new HBox(6);
            readRow.setAlignment(Pos.TOP_LEFT);
            TextFlow flow = createFlow(title, text, subdued);
            HBox.setHgrow(flow, Priority.ALWAYS);
            readRow.getChildren().add(flow);
            if (onSave != null) {
                Button editButton = inlineAction("Ändern");
                editButton.setOnAction(event -> setEditing(true));
                readRow.getChildren().add(editButton);
            }
            readBox.getChildren().add(readRow);

            if (onSave == null) {
                getChildren().add(readBox);
                return;
            }

            TextArea editor = new TextArea(text == null ? "" : text);
            editor.setWrapText(true);
            editor.setPrefRowCount(rowCountFor(text));
            editor.getStyleClass().add("dungeon-gm-inline-editor");
            if (editLabelText != null && !editLabelText.isBlank()) {
                Label editLabel = new Label(editLabelText);
                editLabel.getStyleClass().add("dungeon-gm-inline-edit-title");
                editBox.getChildren().add(editLabel);
            }
            HBox actions = new HBox(6);
            Button saveButton = new Button("Speichern");
            Button cancelButton = new Button("Abbrechen");
            saveButton.getStyleClass().add("dungeon-gm-inline-action");
            cancelButton.getStyleClass().add("dungeon-gm-inline-action");
            saveButton.setOnAction(event -> onSave.accept(editor.getText()));
            cancelButton.setOnAction(event -> setEditing(false));
            actions.getChildren().addAll(saveButton, cancelButton);
            editBox.getChildren().addAll(editor, actions);
            editBox.setVisible(false);
            editBox.setManaged(false);

            getChildren().addAll(readBox, editBox);
        }

        private void setEditing(boolean editing) {
            readBox.setVisible(!editing);
            readBox.setManaged(!editing);
            editBox.setVisible(editing);
            editBox.setManaged(editing);
        }

        private static TextFlow createFlow(String title, String body, boolean subdued) {
            TextFlow flow = new TextFlow();
            flow.getStyleClass().add("dungeon-gm-flow");
            flow.setPadding(new Insets(2, 0, 2, 0));
            if (title != null && !title.isBlank()) {
                Text nameText = new Text(title + ". ");
                nameText.getStyleClass().add(subdued ? "dungeon-gm-subtle-title" : "stat-block-action-name");
                flow.getChildren().add(nameText);
            }
            Text bodyText = new Text(body == null ? "—" : body);
            bodyText.getStyleClass().add(subdued ? "dungeon-gm-subtle-body" : "stat-block-action-desc");
            flow.getChildren().add(bodyText);
            return flow;
        }

        private static int rowCountFor(String value) {
            if (value == null || value.isBlank()) {
                return 3;
            }
            int rows = value.split("\\R", -1).length;
            return Math.max(3, Math.min(5, rows + 1));
        }
    }

    private static Button inlineAction(String text) {
        Button button = new Button(text);
        button.getStyleClass().add("dungeon-gm-inline-action");
        return button;
    }
}
