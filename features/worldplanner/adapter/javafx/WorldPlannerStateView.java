package features.worldplanner.adapter.javafx;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

public final class WorldPlannerStateView extends VBox {

    private static final int NPCS = 0;
    private static final int FACTIONS = 1;
    private static final int LOCATIONS = 2;
    private static final int NOTES_ROWS = 3;
    private static final int SINGLE_CHOICE_COUNT = 1;
    private static final String EDITOR_STYLE = "world-planner-editor";

    private final Label moduleTitle = new Label();
    private final Label status = wrap();
    private final Label nextAction = wrap();
    private final TextField npcName = new TextField();
    private final ComboBox<String> statblockChoice = new ComboBox<>();
    private final TextArea appearanceNotes = notesArea();
    private final TextArea behaviorNotes = notesArea();
    private final TextArea historyNotes = notesArea();
    private final TextArea generalNotes = notesArea();
    private final TextField npcDisposition = new TextField("0");
    private final TextField factionName = new TextField();
    private final ComboBox<String> primaryEncounterTableChoice = new ComboBox<>();
    private final ComboBox<String> npcChoice = new ComboBox<>();
    private final ComboBox<String> inventoryStatblockChoice = new ComboBox<>();
    private final CheckBox finiteInventory = new CheckBox("Finite");
    private final TextField inventoryQuantity = new TextField();
    private final TextField factionDisposition = new TextField("0");
    private final TextField locationName = new TextField();
    private final ComboBox<String> factionChoice = new ComboBox<>();
    private final ComboBox<String> locationTableChoice = new ComboBox<>();
    private final VBox npcEditor = new VBox(8);
    private final VBox factionEditor = new VBox(8);
    private final VBox locationEditor = new VBox(8);
    private Consumer<StateInput> eventSink = event -> { };

    public WorldPlannerStateView() {
        getStyleClass().add("world-planner-state");
        moduleTitle.getStyleClass().add("world-planner-section-title");
        configureEditors();
        getChildren().addAll(
                moduleTitle,
                labelled("Status", status),
                labelled("Next", nextAction),
                npcEditor,
                factionEditor,
                locationEditor);
    }

    public void bind(WorldPlannerViewModel viewModel) {
        WorldPlannerViewModel safeModel = Objects.requireNonNull(viewModel, "viewModel");
        safeModel.stateProjectionProperty().addListener((observable, oldValue, newValue) -> render(newValue));
        render(safeModel.stateProjectionProperty().get());
    }

    public void onViewInputEvent(Consumer<StateInput> sink) {
        eventSink = sink == null ? event -> { } : sink;
    }

    private void configureEditors() {
        npcName.setPromptText("NPC Name");
        statblockChoice.setPromptText("Statblock waehlen");
        factionName.setPromptText("Fraktionsname");
        primaryEncounterTableChoice.setPromptText("Encounter Table waehlen");
        npcChoice.setPromptText("NPC waehlen");
        inventoryStatblockChoice.setPromptText("Bestand-Statblock waehlen");
        inventoryQuantity.setPromptText("Anzahl");
        npcDisposition.setPromptText("Haltungsmodifikator -50 bis 50");
        factionDisposition.setPromptText("Fraktionshaltung -50 bis 50");
        locationName.setPromptText("Location Name");
        factionChoice.setPromptText("Fraktion waehlen");
        locationTableChoice.setPromptText("Location-Tabelle waehlen");
        npcEditor.getStyleClass().add(EDITOR_STYLE);
        factionEditor.getStyleClass().add(EDITOR_STYLE);
        locationEditor.getStyleClass().add(EDITOR_STYLE);
        npcEditor.getChildren().setAll(new Label("Edit NPC"), npcFields(), npcActions());
        factionEditor.getChildren().setAll(new Label("Edit Faction"), factionFields(), factionActions());
        locationEditor.getChildren().setAll(new Label("Edit Location"), locationFields(), locationActions());
    }

    void render(StateProjection projection) {
        int activeModuleIndex = projection.activeModuleIndex();
        moduleTitle.setText(projection.moduleTitle());
        status.setText(projection.statusText());
        nextAction.setText(projection.nextActionText());
        renderNpc(projection.npc());
        renderFaction(projection.faction());
        renderLocation(projection.location());
        visible(npcEditor, activeModuleIndex == NPCS);
        visible(factionEditor, activeModuleIndex == FACTIONS);
        visible(locationEditor, activeModuleIndex == LOCATIONS);
    }

    private void renderNpc(NpcEditor npc) {
        npcName.setText(npc.displayName());
        renderChoices(statblockChoice, npc.statblockLabels(), npc.selectedStatblockLabel());
        appearanceNotes.setText(npc.appearanceNotes());
        behaviorNotes.setText(npc.behaviorNotes());
        historyNotes.setText(npc.historyNotes());
        generalNotes.setText(npc.generalNotes());
        npcDisposition.setText(npc.dispositionModifierText());
    }

    private void renderFaction(FactionEditor faction) {
        factionName.setText(faction.displayName());
        renderChoices(primaryEncounterTableChoice, faction.encounterTableLabels(), faction.selectedPrimaryTableLabel());
        renderChoices(npcChoice, faction.npcReferenceLabels(), "");
        renderChoices(inventoryStatblockChoice, faction.statblockLabels(), "");
        factionDisposition.setText(faction.dispositionText());
    }

    private void renderLocation(LocationEditor location) {
        locationName.setText(location.displayName());
        renderChoices(factionChoice, location.factionReferenceLabels(), "");
        renderChoices(locationTableChoice, location.encounterTableLabels(), "");
    }

    private Node npcFields() {
        GridPane fields = grid();
        fields.addRow(0, npcName, statblockChoice);
        fields.addRow(1, labelled("Aussehen", appearanceNotes), labelled("Verhalten", behaviorNotes));
        fields.addRow(2, labelled("History", historyNotes), labelled("Notizen", generalNotes));
        fields.addRow(3, labelled("Haltungsmodifikator", npcDisposition));
        return fields;
    }

    private Node factionFields() {
        GridPane fields = grid();
        fields.addRow(0, factionName, primaryEncounterTableChoice);
        fields.addRow(1, npcChoice, inventoryStatblockChoice);
        fields.addRow(2, finiteInventory, inventoryQuantity);
        fields.addRow(3, labelled("Haltung zu den PCs", factionDisposition));
        return fields;
    }

    private Node locationFields() {
        GridPane fields = grid();
        fields.addRow(0, locationName);
        fields.addRow(1, factionChoice);
        fields.addRow(2, locationTableChoice);
        return fields;
    }

    private Node npcActions() {
        Button create = action(NPCS, "NPC anlegen", actions(true, false, false, false, false, false, false, false, false));
        Button updateNotes = action(NPCS, "Notizen speichern",
                actions(false, true, false, false, false, false, false, false, false));
        Button defeat = action(NPCS, "Besiegt", actions(false, false, true, false, false, false, false, false, false));
        Button reactivate = action(NPCS, "Aktiv", actions(false, false, false, true, false, false, false, false, false));
        Button addToEncounter = action(NPCS, "Zum Encounter",
                actions(false, false, false, false, true, false, false, false, false));
        Button disposition = action(NPCS, "Haltung setzen",
                new ActionSnapshot(false, false, false, false, false, false, false, false, false, true, false));
        return new HBox(8, create, updateNotes, disposition, defeat, reactivate, addToEncounter);
    }

    private Node factionActions() {
        Button create = action(FACTIONS, "Fraktion anlegen",
                actions(true, false, false, false, false, false, false, false, false));
        Button addNpc = action(FACTIONS, "NPC hinzufuegen",
                actions(false, false, false, false, false, true, false, false, false));
        Button limit = action(FACTIONS, "Bestand setzen",
                actions(false, false, false, false, false, false, true, false, false));
        Button disposition = action(FACTIONS, "Haltung setzen",
                new ActionSnapshot(false, false, false, false, false, false, false, false, false, false, true));
        return new HBox(8, create, addNpc, disposition, limit);
    }

    private Node locationActions() {
        Button create = action(LOCATIONS, "Location anlegen",
                actions(true, false, false, false, false, false, false, false, false));
        Button linkFaction = action(LOCATIONS, "Fraktion linken",
                actions(false, false, false, false, false, false, false, true, false));
        Button linkTable = action(LOCATIONS, "Tabelle linken",
                actions(false, false, false, false, false, false, false, false, true));
        return new HBox(8, create, linkFaction, linkTable);
    }

    private Button action(int moduleIndex, String label, ActionSnapshot actions) {
        Button button = new Button(label);
        button.setOnAction(event -> eventSink.accept(snapshot(moduleIndex, actions)));
        return button;
    }

    private StateInput snapshot(
            int moduleIndex,
            ActionSnapshot actions
    ) {
        return new StateInput(
                moduleIndex,
                new NpcSnapshot(
                        npcName.getText(),
                        statblockChoice.getSelectionModel().getSelectedIndex(),
                        appearanceNotes.getText(),
                        behaviorNotes.getText(),
                        historyNotes.getText(),
                        generalNotes.getText(),
                        npcDisposition.getText()),
                new FactionSnapshot(
                        factionName.getText(),
                        primaryEncounterTableChoice.getSelectionModel().getSelectedIndex(),
                        npcChoice.getSelectionModel().getSelectedIndex(),
                        inventoryStatblockChoice.getSelectionModel().getSelectedIndex(),
                        finiteInventory.isSelected(),
                        inventoryQuantity.getText(),
                        factionDisposition.getText()),
                new LocationSnapshot(
                        locationName.getText(),
                        factionChoice.getSelectionModel().getSelectedIndex(),
                        locationTableChoice.getSelectionModel().getSelectedIndex()),
                actions);
    }

    private static ActionSnapshot actions(
            boolean create,
            boolean saveNotes,
            boolean defeat,
            boolean reactivate,
            boolean addToEncounter,
            boolean addNpc,
            boolean setInventoryLimit,
            boolean linkFaction,
            boolean linkTable
    ) {
        return new ActionSnapshot(
                create,
                saveNotes,
                defeat,
                reactivate,
                addToEncounter,
                addNpc,
                setInventoryLimit,
                linkFaction,
                linkTable);
    }

    private static void renderChoices(ComboBox<String> comboBox, List<String> rows, String selected) {
        String current = comboBox.getValue();
        comboBox.getItems().setAll(rows == null ? List.of() : rows);
        if (!selected.isBlank() && comboBox.getItems().contains(selected)) {
            comboBox.setValue(selected);
        } else if (current != null && comboBox.getItems().contains(current)) {
            comboBox.setValue(current);
        } else if (comboBox.getItems().size() == SINGLE_CHOICE_COUNT) {
            comboBox.setValue(comboBox.getItems().getFirst());
        } else {
            comboBox.setValue(null);
        }
    }

    private static void visible(Node node, boolean visible) {
        node.setVisible(visible);
        node.setManaged(visible);
    }

    private static Label wrap() {
        Label label = new Label();
        label.setWrapText(true);
        return label;
    }

    private static VBox labelled(String title, Node value) {
        Label label = new Label(title);
        label.getStyleClass().add("text-muted");
        VBox section = new VBox(2, label, value);
        section.getStyleClass().add("world-planner-note-section");
        return section;
    }

    private static TextArea notesArea() {
        TextArea area = new TextArea();
        area.setPrefRowCount(NOTES_ROWS);
        area.setWrapText(true);
        return area;
    }

    private static GridPane grid() {
        GridPane pane = new GridPane();
        pane.getStyleClass().add("world-planner-grid");
        return pane;
    }
}
