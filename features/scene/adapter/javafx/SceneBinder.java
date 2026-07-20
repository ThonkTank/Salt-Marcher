package features.scene.adapter.javafx;

import features.scene.api.SceneApi;
import features.scene.api.SceneCommand;
import features.scene.api.SceneModel;
import features.scene.api.SceneParticipantKind;
import features.scene.api.SceneSnapshot;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.LongConsumer;
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
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import shell.api.ShellBinding;
import shell.api.ShellSlot;

final class SceneBinder {

    private final SceneApi scenes;
    private final SceneModel model;
    private final LongConsumer openStatblock;
    private final VBox controls = new VBox(10.0);
    private final BorderPane main = new BorderPane();
    private final Map<Long, SceneDraft> sceneDrafts = new HashMap<>();
    private SceneSnapshot latestSnapshot = SceneSnapshot.uninitialized();
    private PendingCreate pendingCreate;
    private String newSceneDraft = "";
    private long pendingDeleteSceneId;

    SceneBinder(SceneApi scenes, SceneModel model, LongConsumer openStatblock) {
        this.scenes = Objects.requireNonNull(scenes, "scenes");
        this.model = Objects.requireNonNull(model, "model");
        this.openStatblock = Objects.requireNonNull(openStatblock, "openStatblock");
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
        Node board = board(snapshot, focused);
        VBox content = new VBox(12.0, locationBanner(snapshot, focused), details(focused), board);
        content.setFillWidth(true);
        VBox.setVgrow(board, Priority.ALWAYS);
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

    private Node locationBanner(SceneSnapshot snapshot, SceneSnapshot.SceneEntry scene) {
        ComboBox<LocationChoice> choices = new ComboBox<>();
        choices.getItems().add(new LocationChoice(0L, "Kein Ort"));
        snapshot.availableLocations().stream()
                .map(location -> new LocationChoice(location.id(), location.name()))
                .forEach(choices.getItems()::add);
        choices.getSelectionModel().select(choices.getItems().stream()
                .filter(choice -> choice.id() == scene.locationId())
                .findFirst().orElse(choices.getItems().getFirst()));
        Button apply = button("Ort übernehmen", () -> {
            LocationChoice selected = choices.getValue();
            if (selected != null) {
                execute(new SceneCommand.SetLocation(scene.sceneId(), selected.id()));
            }
        });
        Label pin = title("📍 " + (scene.locationName().isBlank() ? "Kein Ort gesetzt" : scene.locationName()));
        HBox banner = new HBox(10.0, pin, choices, apply);
        banner.setAlignment(Pos.CENTER_LEFT);
        banner.setPadding(new Insets(10.0));
        banner.getStyleClass().add("scene-board-location");
        return banner;
    }

    private Node board(SceneSnapshot snapshot, SceneSnapshot.SceneEntry scene) {
        Node party = partyBoard(snapshot, scene);
        Node npcs = npcBoard(snapshot, scene);
        Node mobs = mobBoard(snapshot, scene);
        VBox right = new VBox(12.0, npcs, mobs);
        right.setFillWidth(true);
        right.setPrefWidth(340.0);
        right.setMinWidth(280.0);
        VBox.setVgrow(npcs, Priority.ALWAYS);
        VBox.setVgrow(mobs, Priority.ALWAYS);
        HBox body = new HBox(12.0, party, right);
        body.setFillHeight(true);
        HBox.setHgrow(party, Priority.ALWAYS);
        return body;
    }

    private Node partyBoard(SceneSnapshot snapshot, SceneSnapshot.SceneEntry scene) {
        HBox cards = new HBox(8.0);
        cards.setAlignment(Pos.CENTER_LEFT);
        for (SceneSnapshot.PartyChoice member : snapshot.activePartyMembers()) {
            cards.getChildren().add(pcCard(scene, member));
        }
        if (snapshot.activePartyMembers().isEmpty()) {
            cards.getChildren().add(status("Keine aktiven PCs."));
        }
        ScrollPane horizontal = new ScrollPane(cards);
        horizontal.setFitToHeight(true);
        horizontal.setHbarPolicy(ScrollPane.ScrollBarPolicy.AS_NEEDED);
        horizontal.setVbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        VBox box = panel("Party");
        box.getChildren().add(horizontal);
        VBox.setVgrow(horizontal, Priority.ALWAYS);
        return box;
    }

    private Node pcCard(SceneSnapshot.SceneEntry scene, SceneSnapshot.PartyChoice member) {
        boolean assignedHere = member.sceneId() == scene.sceneId();
        boolean assignedElsewhere = member.sceneId() > 0L && !assignedHere;
        Runnable command = assignedHere
                ? () -> execute(new SceneCommand.UnassignPc(member.id()))
                : () -> execute(new SceneCommand.AssignPc(scene.sceneId(), member.id()));
        VBox card = card(member.name());
        card.getChildren().add(status("Stufe " + member.level()));
        if (assignedElsewhere) {
            card.getChildren().add(status("In anderer Szene"));
        }
        card.getChildren().add(button(assignedHere ? "Entfernen" : "Hierher", command));
        if (assignedHere) {
            decorateWithState(card, scene, SceneParticipantKind.PC, member.id());
        }
        return card;
    }

    private Node npcBoard(SceneSnapshot snapshot, SceneSnapshot.SceneEntry scene) {
        VBox rows = new VBox(8.0);
        for (SceneSnapshot.NpcChoice npc : scene.npcs()) {
            rows.getChildren().add(npcCard(scene, npc, true));
        }
        for (SceneSnapshot.NpcChoice npc : snapshot.availableNpcs()) {
            if (scene.npcs().stream().noneMatch(selected -> selected.id() == npc.id())) {
                rows.getChildren().add(npcCard(scene, npc, false));
            }
        }
        if (scene.npcs().isEmpty() && snapshot.availableNpcs().isEmpty()) {
            rows.getChildren().add(status("Keine World-Planner-NPCs."));
        }
        ScrollPane scroll = scroll(rows);
        VBox box = panel("NPCs");
        box.getChildren().add(scroll);
        VBox.setVgrow(scroll, Priority.ALWAYS);
        return box;
    }

    private Node npcCard(SceneSnapshot.SceneEntry scene, SceneSnapshot.NpcChoice npc, boolean assignedHere) {
        VBox card = card(npc.name());
        card.getChildren().add(status(npc.active() ? "Aktiv" : "Inaktiv"));
        HBox actions = new HBox(6.0);
        actions.setAlignment(Pos.CENTER_LEFT);
        if (npc.statblockId() > 0L) {
            actions.getChildren().add(button("Statblock", () -> openStatblock.accept(npc.statblockId())));
        }
        actions.getChildren().add(button(assignedHere ? "Entfernen" : "Hierher",
                assignedHere
                        ? () -> execute(new SceneCommand.UnassignNpc(npc.id()))
                        : () -> execute(new SceneCommand.AssignNpc(scene.sceneId(), npc.id()))));
        card.getChildren().add(actions);
        if (assignedHere) {
            decorateWithState(card, scene, SceneParticipantKind.NPC, npc.id());
        }
        return card;
    }

    private Node mobBoard(SceneSnapshot snapshot, SceneSnapshot.SceneEntry scene) {
        VBox rows = new VBox(8.0);
        for (SceneSnapshot.MobChoice mob : scene.mobs()) {
            rows.getChildren().add(mobCard(scene, mob));
        }
        if (scene.mobs().isEmpty()) {
            rows.getChildren().add(status("Noch keine Mobs in dieser Szene."));
        }
        ScrollPane scroll = scroll(rows);
        VBox box = panel("Mobs");
        box.getChildren().add(mobAddControl(snapshot, scene));
        box.getChildren().add(scroll);
        VBox.setVgrow(scroll, Priority.ALWAYS);
        return box;
    }

    private Node mobAddControl(SceneSnapshot snapshot, SceneSnapshot.SceneEntry scene) {
        ComboBox<CreaturePick> choices = new ComboBox<>();
        choices.setMaxWidth(Double.MAX_VALUE);
        snapshot.availableCreatures().stream().map(CreaturePick::new).forEach(choices.getItems()::add);
        if (!choices.getItems().isEmpty()) {
            choices.getSelectionModel().selectFirst();
        }
        TextField count = new TextField("1");
        count.setPrefColumnCount(3);
        Button add = button("Mob hinzufügen", () -> {
            CreaturePick selected = choices.getValue();
            if (selected != null) {
                execute(new SceneCommand.AssignMob(scene.sceneId(), selected.value.id(), parseCount(count.getText())));
            }
        });
        add.setDisable(choices.getItems().isEmpty());
        if (choices.getItems().isEmpty()) {
            return new VBox(6.0, status("Kreaturen-Katalog wird geladen …"));
        }
        HBox row = new HBox(6.0, choices, count, add);
        row.setAlignment(Pos.CENTER_LEFT);
        HBox.setHgrow(choices, Priority.ALWAYS);
        return row;
    }

    private Node mobCard(SceneSnapshot.SceneEntry scene, SceneSnapshot.MobChoice mob) {
        VBox card = card(mob.name() + "  ×" + mob.count());
        card.getChildren().add(status(mobStats(mob)));
        HBox actions = new HBox(6.0);
        actions.setAlignment(Pos.CENTER_LEFT);
        if (mob.creatureId() > 0L) {
            actions.getChildren().add(button("Statblock", () -> openStatblock.accept(mob.creatureId())));
        }
        actions.getChildren().addAll(
                button("−", () -> execute(new SceneCommand.SetMobCount(
                        scene.sceneId(), mob.creatureId(), mob.count() - 1))),
                button("+", () -> execute(new SceneCommand.SetMobCount(
                        scene.sceneId(), mob.creatureId(), mob.count() + 1))),
                button("Entfernen", () -> execute(new SceneCommand.UnassignMob(
                        scene.sceneId(), mob.creatureId()))));
        card.getChildren().add(actions);
        decorateWithState(card, scene, SceneParticipantKind.MOB, mob.creatureId());
        return card;
    }

    private void decorateWithState(
            VBox card, SceneSnapshot.SceneEntry scene, SceneParticipantKind kind, long refId) {
        SceneSnapshot.ParticipantStateView state = scene.participantState(kind, refId);
        if (state.defeated()) {
            card.getStyleClass().add("scene-board-card-defeated");
            card.getChildren().add(status("Besiegt"));
        }
        Button toggle = button(
                state.defeated() ? "Aktivieren" : "Besiegt",
                () -> execute(new SceneCommand.SetParticipantDefeated(
                        scene.sceneId(), kind, refId, !state.defeated())));
        TextField note = new TextField(state.notes());
        note.setPromptText("Notiz");
        note.setOnAction(event -> commitNote(scene, kind, refId, note.getText(), state.notes()));
        note.focusedProperty().addListener((observable, hadFocus, hasFocus) -> {
            if (hadFocus && !hasFocus) {
                commitNote(scene, kind, refId, note.getText(), state.notes());
            }
        });
        card.getChildren().addAll(toggle, note);
    }

    private void commitNote(
            SceneSnapshot.SceneEntry scene, SceneParticipantKind kind, long refId, String text, String previous) {
        if (!text.trim().equals(previous)) {
            execute(new SceneCommand.SetParticipantNotes(scene.sceneId(), kind, refId, text));
        }
    }

    private static String mobStats(SceneSnapshot.MobChoice mob) {
        StringBuilder builder = new StringBuilder();
        if (!mob.challengeRating().isBlank()) {
            builder.append("CR ").append(mob.challengeRating());
        }
        if (mob.hitPoints() > 0) {
            append(builder, "HP " + mob.hitPoints());
        }
        if (mob.armorClass() > 0) {
            append(builder, "AC " + mob.armorClass());
        }
        return builder.isEmpty() ? "Keine Statblock-Werte geladen." : builder.toString();
    }

    private static void append(StringBuilder builder, String value) {
        if (!builder.isEmpty()) {
            builder.append(" · ");
        }
        builder.append(value);
    }

    private static int parseCount(String text) {
        try {
            return Math.max(1, Integer.parseInt(text.trim()));
        } catch (NumberFormatException exception) {
            return 1;
        }
    }

    private static VBox card(String name) {
        Label heading = new Label(name);
        heading.setWrapText(true);
        heading.getStyleClass().add("scene-board-card-title");
        VBox card = new VBox(4.0, heading);
        card.setMinWidth(150.0);
        card.getStyleClass().addAll("entity-card", "scene-board-card");
        return card;
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

    private record CreaturePick(SceneSnapshot.CreatureChoice value) {
        @Override
        public String toString() {
            return value.challengeRating().isBlank()
                    ? value.name()
                    : value.name() + " (CR " + value.challengeRating() + ")";
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
