package features.scene.adapter.javafx;

import features.scene.api.SceneApi;
import features.scene.api.SceneCommand;
import features.scene.api.SceneModel;
import features.scene.api.SceneSnapshot;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import shell.api.ShellBinding;
import shell.api.ShellSlot;

final class SceneBinder {

    private final SceneApi scenes;
    private final SceneModel model;
    private final VBox controls = new VBox(10.0);
    private final BorderPane main = new BorderPane();
    private final Map<Long, SceneDraft> sceneDrafts = new HashMap<>();
    private SceneSnapshot latestSnapshot = SceneSnapshot.uninitialized();
    private PendingCreate pendingCreate;
    private String newSceneDraft = "";
    private long pendingDeleteSceneId;

    SceneBinder(SceneApi scenes, SceneModel model) {
        this.scenes = Objects.requireNonNull(scenes, "scenes");
        this.model = Objects.requireNonNull(model, "model");
    }

    ShellBinding bind() {
        controls.setPadding(new Insets(12.0));
        main.setPadding(new Insets(12.0));
        model.subscribe(this::render);
        render(model.current());
        return new Binding(controls, main, scenes);
    }

    private void render(SceneSnapshot snapshot) {
        reconcileDrafts(snapshot);
        latestSnapshot = snapshot;
        renderControls(snapshot);
        renderMain(snapshot);
    }

    private void renderControls(SceneSnapshot snapshot) {
        controls.getChildren().clear();
        controls.getChildren().add(title("Szenen"));
        controls.getChildren().add(status(snapshot.statusText()));
        for (SceneSnapshot.SceneEntry scene : snapshot.scenes()) {
            controls.getChildren().add(sceneNavigation(scene));
        }
        controls.getChildren().add(createSceneControls());
        if (!snapshot.preparedScenes().isEmpty()) {
            controls.getChildren().add(preparedSceneControls(snapshot.preparedScenes()));
        }
    }

    private Node sceneNavigation(SceneSnapshot.SceneEntry scene) {
        String suffix = scene.defaultScene() ? " · Standard" : "";
        Label label = new Label(scene.title() + suffix);
        if (scene.focused()) {
            label.getStyleClass().add("text-accent");
        }
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        Button focus = button(scene.focused() ? "Aktiv" : "Öffnen",
                () -> execute(new SceneCommand.Focus(scene.sceneId())));
        focus.setDisable(scene.focused());
        HBox row = new HBox(6.0, label, spacer, focus);
        row.setAlignment(Pos.CENTER_LEFT);
        if (!scene.defaultScene()) {
            row.getChildren().add(button("Löschen", () -> requestDelete(scene.sceneId())));
        }
        if (pendingDeleteSceneId != scene.sceneId()) {
            return row;
        }
        Label warning = status("Szene und zugehörigen Encounter-Kontext wirklich löschen?");
        HBox actions = new HBox(
                6.0,
                button("Abbrechen", this::cancelDelete),
                button("Endgültig löschen", this::confirmDelete));
        return new VBox(6.0, row, warning, actions);
    }

    private Node createSceneControls() {
        TextField title = new TextField();
        title.setPromptText("Neue Szene");
        title.setText(newSceneDraft);
        title.textProperty().addListener((ignored, previous, value) -> newSceneDraft = value);
        Button create = button("Szene anlegen", () -> createScene(title.getText()));
        VBox box = panel("Neue Laufzeitszene");
        box.getChildren().addAll(title, create);
        return box;
    }

    private Node preparedSceneControls(List<SceneSnapshot.PreparedChoice> preparedScenes) {
        ComboBox<PreparedChoice> choices = new ComboBox<>();
        choices.setMaxWidth(Double.MAX_VALUE);
        preparedScenes.stream().map(PreparedChoice::new).forEach(choices.getItems()::add);
        choices.getSelectionModel().selectFirst();
        Button importButton = button("Vorbereitete Szene laden", () -> {
            PreparedChoice selected = choices.getValue();
            if (selected != null) {
                execute(new SceneCommand.ImportPrepared(selected.value.sessionId(), selected.value.sceneId()));
            }
        });
        VBox box = panel("Session Planner");
        box.getChildren().addAll(choices, importButton);
        return box;
    }

    private void renderMain(SceneSnapshot snapshot) {
        if (!snapshot.initialized()) {
            main.setCenter(message(snapshot.statusText()));
            return;
        }
        SceneSnapshot.SceneEntry focused = snapshot.scenes().stream()
                .filter(SceneSnapshot.SceneEntry::focused)
                .findFirst()
                .orElse(null);
        if (focused == null) {
            main.setCenter(message("Keine fokussierte Szene verfügbar."));
            return;
        }
        VBox content = new VBox(12.0, details(focused), assignmentGrid(snapshot, focused));
        content.setFillWidth(true);
        main.setCenter(content);
    }

    private Node details(SceneSnapshot.SceneEntry scene) {
        SceneDraft draft = sceneDrafts.get(scene.sceneId());
        TextField title = new TextField(draft == null ? scene.title() : draft.title());
        TextArea notes = new TextArea(draft == null ? scene.notes() : draft.notes());
        notes.setPromptText("Szenennotizen");
        notes.setPrefRowCount(3);
        title.textProperty().addListener((ignored, previous, value) ->
                rememberSceneDraft(scene.sceneId(), value, notes.getText()));
        notes.textProperty().addListener((ignored, previous, value) ->
                rememberSceneDraft(scene.sceneId(), title.getText(), value));
        Button save = button("Szene speichern", () -> saveSceneDraft(scene.sceneId(), title, notes));
        VBox box = panel(scene.title());
        if (scene.provenance().present()) {
            box.getChildren().add(status("Kopie aus " + scene.provenance().sourceSessionName()));
        }
        box.getChildren().addAll(title, notes, save);
        return box;
    }

    private Node assignmentGrid(SceneSnapshot snapshot, SceneSnapshot.SceneEntry scene) {
        GridPane grid = new GridPane();
        grid.setHgap(10.0);
        grid.setVgap(10.0);
        grid.add(partyPanel(snapshot, scene), 0, 0);
        grid.add(npcPanel(snapshot, scene), 1, 0);
        grid.add(locationPanel(snapshot, scene), 2, 0);
        for (int column = 0; column < 3; column++) {
            GridPane.setHgrow(grid.getChildren().get(column), Priority.ALWAYS);
            GridPane.setVgrow(grid.getChildren().get(column), Priority.ALWAYS);
        }
        return grid;
    }

    private Node partyPanel(SceneSnapshot snapshot, SceneSnapshot.SceneEntry scene) {
        VBox rows = panel("PCs");
        for (SceneSnapshot.PartyChoice member : snapshot.activePartyMembers()) {
            boolean assignedHere = member.sceneId() == scene.sceneId();
            String action = assignedHere ? "Entfernen" : "Hierher";
            Runnable command = assignedHere
                    ? () -> execute(new SceneCommand.UnassignPc(member.id()))
                    : () -> execute(new SceneCommand.AssignPc(scene.sceneId(), member.id()));
            rows.getChildren().add(row(member.name() + " · Stufe " + member.level(), action, command));
        }
        if (snapshot.activePartyMembers().isEmpty()) {
            rows.getChildren().add(status("Keine aktiven PCs."));
        }
        return scroll(rows);
    }

    private Node npcPanel(SceneSnapshot snapshot, SceneSnapshot.SceneEntry scene) {
        VBox rows = panel("NPCs");
        for (SceneSnapshot.NpcChoice npc : scene.npcs()) {
            rows.getChildren().add(row(npc.name(), "Entfernen",
                    () -> execute(new SceneCommand.UnassignNpc(npc.id()))));
        }
        for (SceneSnapshot.NpcChoice npc : snapshot.availableNpcs()) {
            if (scene.npcs().stream().noneMatch(selected -> selected.id() == npc.id())) {
                rows.getChildren().add(row(npc.name(), "Hierher",
                        () -> execute(new SceneCommand.AssignNpc(scene.sceneId(), npc.id()))));
            }
        }
        if (scene.npcs().isEmpty() && snapshot.availableNpcs().isEmpty()) {
            rows.getChildren().add(status("Keine World-Planner-NPCs."));
        }
        return scroll(rows);
    }

    private Node locationPanel(SceneSnapshot snapshot, SceneSnapshot.SceneEntry scene) {
        VBox rows = panel("Ort");
        ComboBox<LocationChoice> choices = new ComboBox<>();
        choices.setMaxWidth(Double.MAX_VALUE);
        choices.getItems().add(new LocationChoice(0L, "Kein Ort"));
        snapshot.availableLocations().stream()
                .map(location -> new LocationChoice(location.id(), location.name()))
                .forEach(choices.getItems()::add);
        choices.getSelectionModel().select(choices.getItems().stream()
                .filter(choice -> choice.id == scene.locationId())
                .findFirst().orElse(choices.getItems().getFirst()));
        rows.getChildren().addAll(
                status(scene.locationName().isBlank() ? "Kein Ort gesetzt" : scene.locationName()),
                choices,
                button("Ort übernehmen", () -> {
                    LocationChoice selected = choices.getValue();
                    if (selected != null) {
                        execute(new SceneCommand.SetLocation(scene.sceneId(), selected.id));
                    }
                }));
        return scroll(rows);
    }

    private static HBox row(String text, String action, Runnable handler) {
        Label label = new Label(text);
        label.setWrapText(true);
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox row = new HBox(6.0, label, spacer, button(action, handler));
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private static VBox panel(String heading) {
        VBox box = new VBox(8.0, title(heading));
        box.setPadding(new Insets(10.0));
        box.getStyleClass().add("scene-runtime-panel");
        return box;
    }

    private static ScrollPane scroll(VBox content) {
        ScrollPane scroll = new ScrollPane(content);
        scroll.setFitToWidth(true);
        scroll.setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE);
        return scroll;
    }

    private static Label title(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("scene-runtime-panel-title");
        return label;
    }

    private static Label status(String text) {
        Label label = new Label(text == null ? "" : text);
        label.setWrapText(true);
        label.getStyleClass().add("text-secondary");
        return label;
    }

    private static Node message(String text) {
        BorderPane pane = new BorderPane(status(text));
        pane.setPadding(new Insets(20.0));
        return pane;
    }

    private static Button button(String text, Runnable action) {
        Button button = new Button(text);
        button.setOnAction(event -> action.run());
        return button;
    }

    private void execute(SceneCommand command) {
        scenes.execute(command);
    }

    private void createScene(String title) {
        Set<Long> existingIds = new HashSet<>();
        latestSnapshot.scenes().forEach(scene -> existingIds.add(scene.sceneId()));
        newSceneDraft = title == null ? "" : title;
        pendingCreate = new PendingCreate(Set.copyOf(existingIds));
        execute(new SceneCommand.Create(newSceneDraft));
    }

    private void rememberSceneDraft(long sceneId, String title, String notes) {
        sceneDrafts.put(sceneId, new SceneDraft(title, notes, false));
    }

    private void saveSceneDraft(long sceneId, TextField title, TextArea notes) {
        SceneDraft draft = new SceneDraft(title.getText().trim(), notes.getText().trim(), true);
        sceneDrafts.put(sceneId, draft);
        execute(new SceneCommand.UpdateDetails(sceneId, draft.title(), draft.notes()));
    }

    private void reconcileDrafts(SceneSnapshot snapshot) {
        Set<Long> visibleIds = new HashSet<>();
        snapshot.scenes().forEach(scene -> visibleIds.add(scene.sceneId()));
        sceneDrafts.entrySet().removeIf(entry -> !visibleIds.contains(entry.getKey()));
        for (SceneSnapshot.SceneEntry scene : snapshot.scenes()) {
            SceneDraft draft = sceneDrafts.get(scene.sceneId());
            if (draft != null && draft.pendingSave()
                    && draft.title().equals(scene.title())
                    && draft.notes().equals(scene.notes())) {
                sceneDrafts.remove(scene.sceneId());
            }
        }
        if (pendingCreate != null && visibleIds.stream().anyMatch(id -> !pendingCreate.existingSceneIds().contains(id))) {
            pendingCreate = null;
            newSceneDraft = "";
        }
        if (pendingDeleteSceneId > 0L && !visibleIds.contains(pendingDeleteSceneId)) {
            pendingDeleteSceneId = 0L;
        }
    }

    private void requestDelete(long sceneId) {
        pendingDeleteSceneId = sceneId;
        renderControls(latestSnapshot);
    }

    private void cancelDelete() {
        pendingDeleteSceneId = 0L;
        renderControls(latestSnapshot);
    }

    private void confirmDelete() {
        long sceneId = pendingDeleteSceneId;
        pendingDeleteSceneId = 0L;
        renderControls(latestSnapshot);
        if (sceneId > 0L) {
            execute(new SceneCommand.Delete(sceneId));
        }
    }

    private record Binding(Node controls, Node main, SceneApi scenes) implements ShellBinding {
        @Override
        public String title() {
            return "Szenen";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(ShellSlot.COCKPIT_CONTROLS, controls, ShellSlot.COCKPIT_MAIN, main);
        }

        @Override
        public void onActivate() {
            scenes.execute(new SceneCommand.Initialize());
        }
    }

    private record PreparedChoice(SceneSnapshot.PreparedChoice value) {
        @Override
        public String toString() {
            return value.sessionName() + " · " + value.title();
        }
    }

    private record LocationChoice(long id, String name) {
        @Override
        public String toString() {
            return name;
        }
    }

    private record SceneDraft(String title, String notes, boolean pendingSave) {
        private SceneDraft {
            title = title == null ? "" : title;
            notes = notes == null ? "" : notes;
        }
    }

    private record PendingCreate(Set<Long> existingSceneIds) {
        private PendingCreate {
            existingSceneIds = Set.copyOf(existingSceneIds);
        }
    }
}
