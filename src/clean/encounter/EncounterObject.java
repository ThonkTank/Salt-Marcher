package clean.encounter;

import clean.encounter.input.ComposeEncounterInput;
import clean.shell.input.ComposeShellInput;
import clean.shell.scene.input.ComposeSceneInput;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

/**
 * Clean encounter runtime owner surfaced through the shell-owned Scene pane.
 */
public final class EncounterObject {

    private final ComposeEncounterInput.EncounterInput encounter;

    public EncounterObject(ComposeEncounterInput input) {
        ComposeEncounterInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.encounter = new EncounterAssembly(resolvedInput).composeEncounter();
    }

    public ComposeEncounterInput.EncounterInput composeEncounter(ComposeEncounterInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return encounter;
    }

    private static final class EncounterAssembly {

        private final java.util.LinkedHashMap<Long, RosterEntry> rosterEntries = new java.util.LinkedHashMap<>();
        private ComposeSceneInput.HandleInput encounterSceneHandle;

        private EncounterAssembly(ComposeEncounterInput input) {
        }

        private ComposeEncounterInput.EncounterInput composeEncounter() {
            return new ComposeEncounterInput.EncounterInput(
                    this::connectShell,
                    this::addCreature
            );
        }

        private void connectShell(ComposeShellInput.ShellHooksInput hooks) {
            if (hooks == null || hooks.sceneRegistry() == null) {
                return;
            }
            if (encounterSceneHandle == null) {
                encounterSceneHandle = hooks.sceneRegistry().registerScene().apply(
                        new ComposeSceneInput.RegistrationInput("Encounter", createSceneContent())
                );
            } else {
                encounterSceneHandle.setContent().accept(createSceneContent());
            }
            if (encounterSceneHandle != null) {
                encounterSceneHandle.activate().run();
            }
        }

        private void addCreature(ComposeEncounterInput.AddCreatureInput input) {
            if (input == null || input.creatureId() <= 0L || isBlank(input.creatureName())) {
                return;
            }
            RosterEntry existingEntry = rosterEntries.get(input.creatureId());
            if (existingEntry == null) {
                rosterEntries.put(input.creatureId(), new RosterEntry(input.creatureId(), input.creatureName(), 1));
            } else {
                rosterEntries.put(input.creatureId(), new RosterEntry(
                        existingEntry.creatureId(),
                        existingEntry.creatureName(),
                        existingEntry.count() + 1
                ));
            }
            refreshScene();
        }

        private void refreshScene() {
            if (encounterSceneHandle == null) {
                return;
            }
            encounterSceneHandle.setContent().accept(createSceneContent());
            encounterSceneHandle.activate().run();
        }

        private Node createSceneContent() {
            VBox root = new VBox(8);
            root.setPadding(new Insets(12));

            Label title = new Label("Encounter");
            title.getStyleClass().add("title");

            Label subtitle = new Label(rosterEntries.isEmpty()
                    ? "Monster per +Add hinzufügen..."
                    : rosterEntries.size() + " Statblocks im aktiven Encounter.");
            subtitle.getStyleClass().add("text-secondary");

            Label templateLabel = new Label("Generierung, Save und Combat werden hier lokal weiter aufgebaut.");
            templateLabel.getStyleClass().addAll("small", "text-muted");
            templateLabel.setWrapText(true);

            VBox rosterList = new VBox(6);
            if (rosterEntries.isEmpty()) {
                Label placeholder = new Label("Noch keine Kreaturen im Encounter.");
                placeholder.getStyleClass().add("text-muted");
                placeholder.setWrapText(true);
                rosterList.getChildren().add(placeholder);
            } else {
                for (RosterEntry entry : rosterEntries.values()) {
                    rosterList.getChildren().add(createRosterCard(entry));
                }
            }

            ScrollPane rosterScroll = new ScrollPane(rosterList);
            rosterScroll.setFitToWidth(true);
            rosterScroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
            VBox.setVgrow(rosterScroll, Priority.ALWAYS);

            Button generateButton = new Button("Generieren");
            generateButton.getStyleClass().add("neutral-action");
            generateButton.setDisable(true);
            generateButton.setMaxWidth(Double.MAX_VALUE);

            Button combatButton = new Button("Kampf starten");
            combatButton.getStyleClass().add("accent");
            combatButton.setDisable(true);
            combatButton.setMaxWidth(Double.MAX_VALUE);

            HBox actionRow = new HBox(12, generateButton, combatButton);
            HBox.setHgrow(generateButton, Priority.ALWAYS);
            HBox.setHgrow(combatButton, Priority.ALWAYS);

            root.getChildren().addAll(title, subtitle, templateLabel, rosterScroll, actionRow);
            return root;
        }

        private static Node createRosterCard(RosterEntry entry) {
            Label name = new Label(entry.creatureName());
            name.getStyleClass().add("bold");

            Label count = new Label("x" + entry.count());
            count.getStyleClass().add("text-secondary");

            Region spacer = new Region();
            HBox.setHgrow(spacer, Priority.ALWAYS);

            HBox row = new HBox(8, name, spacer, count);
            row.setAlignment(Pos.CENTER_LEFT);

            VBox card = new VBox(4, row);
            card.getStyleClass().add("card");
            return card;
        }

        private static boolean isBlank(String value) {
            return value == null || value.isBlank();
        }

        private record RosterEntry(
                long creatureId,
                String creatureName,
                int count
        ) {
        }
    }
}
