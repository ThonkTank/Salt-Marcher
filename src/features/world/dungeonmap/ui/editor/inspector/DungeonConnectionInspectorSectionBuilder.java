package features.world.dungeonmap.ui.editor.inspector;

import features.world.dungeonmap.model.domain.DungeonEndpoint;
import features.world.dungeonmap.model.domain.DungeonEndpointRole;
import features.world.dungeonmap.model.domain.DungeonLink;
import features.world.dungeonmap.model.domain.DungeonLinkAnchor;
import features.world.dungeonmap.model.domain.DungeonPassage;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;

import java.util.List;

final class DungeonConnectionInspectorSectionBuilder {

    private final DungeonEditorState state;
    private final DungeonConnectionInspectorActions connectionActions;

    DungeonConnectionInspectorSectionBuilder(
            DungeonEditorState state,
            DungeonConnectionInspectorActions connectionActions
    ) {
        this.state = state;
        this.connectionActions = connectionActions;
    }

    VBox buildEndpointEditor(DungeonEndpoint endpoint) {
        VBox box = DungeonInspectorCards.editorCard();
        TextField nameField = new TextField(endpoint.name() == null ? "" : endpoint.name());
        TextArea notesArea = DungeonInspectorCards.compactTextArea(endpoint.notes());
        ComboBox<DungeonEndpointRole> roleCombo = new ComboBox<>();
        roleCombo.setMaxWidth(Double.MAX_VALUE);
        roleCombo.getItems().setAll(DungeonEndpointRole.values());
        roleCombo.setConverter(DungeonInspectorCards.namedConverter(this::endpointRoleLabel));
        roleCombo.setValue(endpoint.role() == null ? DungeonEndpointRole.BOTH : endpoint.role());
        CheckBox defaultEntryCheckBox = new CheckBox("Standard-Eingang");
        defaultEntryCheckBox.setSelected(endpoint.defaultEntry());
        updateDefaultEntryState(defaultEntryCheckBox, roleCombo.getValue());
        roleCombo.valueProperty().addListener((obs, oldValue, newValue) -> updateDefaultEntryState(defaultEntryCheckBox, newValue));

        Button saveButton = DungeonInspectorCards.saveButton(() -> {
            DungeonEndpointRole selectedRole = roleCombo.getValue() == null ? DungeonEndpointRole.BOTH : roleCombo.getValue();
            connectionActions.saveEndpoint(new DungeonEndpoint(
                    endpoint.endpointId(),
                    endpoint.mapId(),
                    endpoint.squareId(),
                    nameField.getText().trim(),
                    notesArea.getText(),
                    selectedRole,
                    defaultEntryCheckBox.isSelected() && selectedRole.allowsEntry(),
                    endpoint.x(),
                    endpoint.y()));
        });
        Button deleteButton = DungeonInspectorCards.dangerButton("Löschen");
        deleteButton.setOnAction(event -> connectionActions.deleteEndpoint(endpoint.endpointId(), deleteButton));

        box.getChildren().addAll(
                DungeonInspectorCards.secondary(DungeonInspectorCards.titleOrFallback(endpoint.name(), "Übergang")
                        + " • " + DungeonInspectorCards.formatPosition(endpoint.x(), endpoint.y())),
                DungeonInspectorCards.section("Name", nameField),
                DungeonInspectorCards.section("Notizen", notesArea),
                DungeonInspectorCards.section("Typ", roleCombo, defaultEntryCheckBox, DungeonInspectorCards.saveRow(saveButton, deleteButton)));
        return box;
    }

    VBox buildPassageEditor(DungeonPassage passage) {
        VBox box = DungeonInspectorCards.editorCard();
        TextField nameField = new TextField(passage.name() == null ? "" : passage.name());
        TextArea notesArea = DungeonInspectorCards.compactTextArea(passage.notes());
        ComboBox<DungeonEndpoint> endpointCombo = new ComboBox<>();
        endpointCombo.setMaxWidth(Double.MAX_VALUE);
        endpointCombo.setConverter(new StringConverter<>() {
            @Override
            public String toString(DungeonEndpoint endpoint) {
                return endpoint == null ? "Kein Übergang" : DungeonInspectorCards.titleOrFallback(endpoint.name(), "Übergang");
            }

            @Override
            public DungeonEndpoint fromString(String string) {
                return null;
            }
        });
        endpointCombo.getItems().setAll(state.index().endpointsById().values());
        endpointCombo.setValue(DungeonInspectorCards.findById(
                List.copyOf(state.index().endpointsById().values()),
                passage.endpointId(),
                DungeonEndpoint::endpointId));

        Button saveButton = DungeonInspectorCards.saveButton(() -> connectionActions.savePassage(new DungeonPassage(
                passage.passageId(),
                passage.mapId(),
                passage.x(),
                passage.y(),
                passage.direction(),
                nameField.getText().trim(),
                notesArea.getText(),
                endpointCombo.getValue() == null ? null : endpointCombo.getValue().endpointId())));
        Button deleteButton = DungeonInspectorCards.dangerButton("Zurücksetzen");
        deleteButton.setOnAction(event -> connectionActions.deletePassage(passage.passageId(), deleteButton));

        box.getChildren().addAll(
                DungeonInspectorCards.secondary(DungeonInspectorCards.titleOrFallback(passage.name(), "Durchgang")
                        + " • " + DungeonInspectorCards.formatPassagePosition(passage)),
                DungeonInspectorCards.section("Übergang", endpointCombo),
                DungeonInspectorCards.section("Name", nameField),
                DungeonInspectorCards.section("Notizen", notesArea, DungeonInspectorCards.saveRow(saveButton, deleteButton)));
        return box;
    }

    VBox buildLinkEditor(DungeonLink link, DungeonLinkAnchor currentAnchor, String counterpartName) {
        VBox box = new VBox(6);
        TextField labelField = new TextField(link.label() == null ? "" : link.label());
        Button saveButton = DungeonInspectorCards.saveButton(() -> {
            if (link.linkId() != null) {
                connectionActions.updateLinkLabel(link.linkId(), labelField.getText().trim(), null);
            }
        });
        Button deleteButton = DungeonInspectorCards.dangerButton("Löschen");
        deleteButton.setOnAction(event -> connectionActions.deleteLink(link.linkId()));
        box.getChildren().addAll(
                DungeonInspectorCards.secondary(counterpartName),
                DungeonInspectorCards.section("Label", labelField, DungeonInspectorCards.saveRow(saveButton, deleteButton)));
        return box;
    }

    private void updateDefaultEntryState(CheckBox defaultEntryCheckBox, DungeonEndpointRole role) {
        DungeonEndpointRole effectiveRole = role == null ? DungeonEndpointRole.BOTH : role;
        boolean enabled = effectiveRole.allowsEntry();
        defaultEntryCheckBox.setDisable(!enabled);
        if (!enabled) {
            defaultEntryCheckBox.setSelected(false);
        }
    }

    private String endpointRoleLabel(DungeonEndpointRole role) {
        DungeonEndpointRole effectiveRole = role == null ? DungeonEndpointRole.BOTH : role;
        return switch (effectiveRole) {
            case ENTRY -> "Eingang";
            case EXIT -> "Ausgang";
            case BOTH -> "Ein- und Ausgang";
        };
    }
}
