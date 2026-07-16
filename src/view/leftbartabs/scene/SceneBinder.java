package src.view.leftbartabs.scene;

import java.util.HashMap;
import java.util.Map;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.ColumnConstraints;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import shell.api.ShellBinding;
import shell.api.ShellSlot;
import src.domain.scene.SceneServiceAssembly;
import src.domain.scene.published.SceneCommand;
import src.domain.scene.published.SceneSnapshot;

final class SceneBinder {
    private final SceneServiceAssembly scenes;
    private final VBox controls = new VBox(10);
    private final BorderPane main = new BorderPane();
    private final ToggleGroup sceneGroup = new ToggleGroup();
    private Runnable unsubscribe = () -> { };

    SceneBinder(SceneServiceAssembly scenes) {
        this.scenes = scenes;
    }

    ShellBinding bind() {
        controls.getStyleClass().add("scene-runtime-controls");
        controls.setPadding(new Insets(10));
        main.getStyleClass().add("scene-runtime-main");
        render(scenes.model().current());
        unsubscribe = scenes.model().subscribe(this::render);
        return new Binding(controls, main, () -> unsubscribe.run());
    }

    private void render(SceneSnapshot snapshot) {
        renderControls(snapshot);
        SceneSnapshot.SceneEntry focused = snapshot.scenes().stream()
                .filter(SceneSnapshot.SceneEntry::focused).findFirst().orElse(null);
        if (focused == null) {
            main.setCenter(message("Szenen konnten nicht geladen werden."));
            return;
        }
        main.setTop(sceneHeader(focused));
        main.setCenter(sceneBoard(snapshot, focused));
    }

    private void renderControls(SceneSnapshot snapshot) {
        controls.getChildren().clear();
        Label eyebrow = label("LAUFENDE SZENEN", "scene-runtime-eyebrow");
        Label title = label("Am Spieltisch", "title-large");
        VBox switcher = new VBox(5);
        sceneGroup.getToggles().clear();
        for (SceneSnapshot.SceneEntry scene : snapshot.scenes()) {
            ToggleButton button = new ToggleButton(scene.title());
            button.setMaxWidth(Double.MAX_VALUE);
            button.getStyleClass().add("scene-runtime-switch");
            button.setToggleGroup(sceneGroup);
            button.setSelected(scene.focused());
            button.setOnAction(event -> apply(new SceneCommand.Focus(scene.sceneId())));
            switcher.getChildren().add(button);
        }

        TextField newTitle = new TextField();
        newTitle.setPromptText("Neue Szene");
        Button create = action("Szene anlegen", () -> {
            apply(new SceneCommand.Create(newTitle.getText()));
            newTitle.clear();
        }, "accent-action");

        ComboBox<PreparedChoice> prepared = new ComboBox<>();
        prepared.setMaxWidth(Double.MAX_VALUE);
        snapshot.preparedScenes().forEach(choice -> prepared.getItems().add(new PreparedChoice(choice)));
        prepared.setPromptText("Vorbereitete Szene");
        Button load = action("Aus Planer laden", () -> {
            PreparedChoice choice = prepared.getValue();
            if (choice != null) {
                apply(new SceneCommand.ImportPrepared(choice.value.sessionId(), choice.value.sceneId()));
            }
        }, "flat-action");

        Label status = label(snapshot.statusText(), snapshot.encounterSynchronized() ? "text-secondary" : "text-warning");
        status.setWrapText(true);
        controls.getChildren().addAll(eyebrow, title, switcher, divider(), newTitle, create,
                label("Schnellauswahl", "section-header"), prepared, load, status);
    }

    private Node sceneHeader(SceneSnapshot.SceneEntry scene) {
        TextField title = new TextField(scene.title());
        title.getStyleClass().add("scene-runtime-title-input");
        TextArea notes = new TextArea(scene.notes());
        notes.setPromptText("Was ist in dieser Szene wichtig?");
        notes.setPrefRowCount(2);
        Button save = action("Szene speichern", () -> apply(
                new SceneCommand.UpdateDetails(scene.sceneId(), title.getText(), notes.getText())), "accent-action");
        Button delete = action(scene.defaultScene() ? "Standardszene" : "Szene löschen", () -> {
            if (!scene.defaultScene()) {
                apply(new SceneCommand.Delete(scene.sceneId()));
            }
        }, scene.defaultScene() ? "flat-action" : "danger-action");
        delete.setDisable(scene.defaultScene());
        VBox header = new VBox(8,
                new HBox(8, label(scene.defaultScene() ? "STANDARD" : "AKTIV", "scene-runtime-scene-mark"), title),
                notes,
                new HBox(8, save, delete));
        header.setPadding(new Insets(14));
        header.getStyleClass().add("scene-runtime-header");
        HBox.setHgrow(title, Priority.ALWAYS);
        return header;
    }

    private Node sceneBoard(SceneSnapshot snapshot, SceneSnapshot.SceneEntry scene) {
        GridPane board = new GridPane();
        board.setHgap(10);
        board.setPadding(new Insets(10));
        for (int i = 0; i < 3; i++) {
            ColumnConstraints column = new ColumnConstraints();
            column.setPercentWidth(100.0 / 3.0);
            column.setHgrow(Priority.ALWAYS);
            board.getColumnConstraints().add(column);
        }
        board.add(partyPanel(snapshot, scene), 0, 0);
        board.add(npcPanel(snapshot, scene), 1, 0);
        board.add(locationPanel(snapshot, scene), 2, 0);
        return board;
    }

    private Node partyPanel(SceneSnapshot snapshot, SceneSnapshot.SceneEntry scene) {
        VBox rows = panel("PCs", "Wer spielt hier gerade?");
        for (SceneSnapshot.PartyChoice pc : scene.partyMembers()) {
            rows.getChildren().add(row(pc.name() + " · Stufe " + pc.level(), "Entfernen",
                    () -> apply(new SceneCommand.UnassignPc(pc.id()))));
        }
        for (SceneSnapshot.PartyChoice pc : snapshot.activePartyMembers()) {
            if (pc.sceneId() == scene.sceneId()) {
                continue;
            }
            String assignment = pc.sceneId() == 0L
                    ? "unzugeordnet"
                    : "in " + sceneTitle(snapshot, pc.sceneId());
            rows.getChildren().add(row(pc.name() + " · " + assignment, "Hierher",
                    () -> apply(new SceneCommand.AssignPc(scene.sceneId(), pc.id()))));
        }
        if (snapshot.activePartyMembers().isEmpty()) {
            rows.getChildren().add(empty("Keine aktiven PCs verfügbar."));
        }
        return scroll(rows);
    }

    private static String sceneTitle(SceneSnapshot snapshot, long sceneId) {
        return snapshot.scenes().stream()
                .filter(scene -> scene.sceneId() == sceneId)
                .map(SceneSnapshot.SceneEntry::title)
                .findFirst()
                .orElse("anderer Szene");
    }

    private Node npcPanel(SceneSnapshot snapshot, SceneSnapshot.SceneEntry scene) {
        VBox rows = panel("NPCs", "Haltung bestimmt die Kampfseite.");
        for (SceneSnapshot.NpcChoice npc : scene.npcs()) {
            String disposition = switch (npc.disposition()) {
                case HOSTILE -> "Feindlich";
                case FRIENDLY -> "Freundlich";
                case NEUTRAL -> "Neutral";
            };
            rows.getChildren().add(row(npc.name() + " · " + disposition + " " + signed(npc.effectiveDisposition()),
                    "Entfernen", () -> apply(new SceneCommand.RemoveNpc(scene.sceneId(), npc.id()))));
        }
        for (SceneSnapshot.NpcChoice npc : snapshot.availableNpcs()) {
            if (scene.npcs().stream().noneMatch(selected -> selected.id() == npc.id())) {
                rows.getChildren().add(row(npc.name(), "Hinzufügen",
                        () -> apply(new SceneCommand.AddNpc(scene.sceneId(), npc.id()))));
            }
        }
        if (snapshot.availableNpcs().isEmpty()) {
            rows.getChildren().add(empty("NPCs zuerst im World Planner anlegen."));
        }
        return scroll(rows);
    }

    private Node locationPanel(SceneSnapshot snapshot, SceneSnapshot.SceneEntry scene) {
        VBox rows = panel("Ort", "Genau ein Ort steuert die Encounter-Quelle.");
        ComboBox<LocationChoice> choices = new ComboBox<>();
        choices.setMaxWidth(Double.MAX_VALUE);
        choices.getItems().add(new LocationChoice(0L, "Kein Ort"));
        snapshot.availableLocations().forEach(location -> choices.getItems().add(new LocationChoice(location.id(), location.name())));
        choices.getSelectionModel().select(choices.getItems().stream()
                .filter(choice -> choice.id == scene.locationId()).findFirst().orElse(choices.getItems().getFirst()));
        Button apply = action("Ort übernehmen", () -> {
            LocationChoice choice = choices.getValue();
            if (choice != null) {
                apply(new SceneCommand.SetLocation(scene.sceneId(), choice.id));
            }
        }, "accent-action");
        rows.getChildren().addAll(label(scene.locationName().isBlank() ? "Kein Ort gesetzt" : scene.locationName(), "scene-runtime-location"), choices, apply);
        return scroll(rows);
    }

    private static VBox panel(String title, String subtitle) {
        VBox box = new VBox(8, label(title, "scene-runtime-panel-title"), label(subtitle, "text-secondary"));
        box.setPadding(new Insets(12));
        box.getStyleClass().add("scene-runtime-panel");
        return box;
    }

    private static Node scroll(VBox content) {
        ScrollPane scroll = new ScrollPane(content);
        scroll.setFitToWidth(true);
        scroll.setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE);
        GridPane.setHgrow(scroll, Priority.ALWAYS);
        GridPane.setVgrow(scroll, Priority.ALWAYS);
        return scroll;
    }

    private static HBox row(String text, String action, Runnable handler) {
        Label label = label(text, "scene-runtime-row-label");
        label.setWrapText(true);
        Button button = action(action, handler, "flat-action");
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox row = new HBox(6, label, spacer, button);
        row.setAlignment(Pos.CENTER_LEFT);
        row.getStyleClass().add("scene-runtime-row");
        return row;
    }

    private static Button action(String text, Runnable handler, String style) {
        Button button = new Button(text);
        button.getStyleClass().add(style);
        button.setOnAction(event -> handler.run());
        return button;
    }

    private void apply(SceneCommand command) {
        scenes.application().apply(command);
        scenes.publish();
    }

    private static Label label(String text, String style) {
        Label label = new Label(text == null ? "" : text);
        label.getStyleClass().add(style);
        return label;
    }

    private static Label empty(String text) {
        Label label = label(text, "text-muted");
        label.setWrapText(true);
        return label;
    }

    private static Region divider() {
        Region divider = new Region();
        divider.getStyleClass().add("scene-runtime-divider");
        return divider;
    }

    private static Node message(String text) {
        Label label = empty(text);
        BorderPane pane = new BorderPane(label);
        pane.setPadding(new Insets(20));
        return pane;
    }

    private static String signed(int value) { return value >= 0 ? "+" + value : String.valueOf(value); }

    private record Binding(Node controls, Node main, Runnable dispose) implements ShellBinding {
        @Override public String title() { return "Szenen"; }
        @Override public Map<ShellSlot, Node> slotContent() {
            Map<ShellSlot, Node> slots = new HashMap<>();
            slots.put(ShellSlot.COCKPIT_CONTROLS, controls);
            slots.put(ShellSlot.COCKPIT_MAIN, main);
            return Map.copyOf(slots);
        }
        @Override public void onDeactivate() { }
    }

    private static final class PreparedChoice {
        private final SceneSnapshot.PreparedChoice value;
        private PreparedChoice(SceneSnapshot.PreparedChoice value) { this.value = value; }
        @Override public String toString() { return value.sessionName() + " · " + value.title(); }
    }

    private static final class LocationChoice {
        private final long id;
        private final String name;
        private LocationChoice(long id, String name) { this.id = id; this.name = name; }
        @Override public String toString() { return name; }
    }
}
