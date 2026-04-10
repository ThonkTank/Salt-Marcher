package clean.creatures.statblock;

import clean.creatures.catalog.input.ComposeCatalogInput;
import clean.creatures.statblock.input.ComposeStatblockInput;
import clean.shell.input.ComposeShellInput;
import clean.shell.inspector.input.ComposeInspectorInput;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

/**
 * Clean creature statblock publisher for the shell-owned inspector.
 */
@SuppressWarnings("unused")
public final class StatblockObject {

    private final ComposeStatblockInput.StatblockInput statblock;

    public StatblockObject(ComposeStatblockInput input) {
        ComposeStatblockInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.statblock = new StatblockAssembly(resolvedInput).composeStatblock();
    }

    public ComposeStatblockInput.StatblockInput composeStatblock(ComposeStatblockInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return statblock;
    }

    private static final class StatblockAssembly {

        private final ComposeStatblockInput input;
        private ComposeInspectorInput.NavigatorInput inspectorNavigator;

        private StatblockAssembly(ComposeStatblockInput input) {
            this.input = input;
        }

        private ComposeStatblockInput.StatblockInput composeStatblock() {
            return new ComposeStatblockInput.StatblockInput(
                    this::connectShell,
                    this::showCreatureStatblock
            );
        }

        private void connectShell(ComposeShellInput.ShellHooksInput hooks) {
            inspectorNavigator = hooks == null ? null : hooks.inspectorNavigator();
        }

        private void showCreatureStatblock(ComposeStatblockInput.ShowCreatureStatblockInput input) {
            if (input == null || input.creatureId() == null || input.creatureId() <= 0L || inspectorNavigator == null) {
                return;
            }

            ComposeCatalogInput.LoadedCreatureInput loaded = this.input.catalog().loadCreature().apply(
                    new ComposeCatalogInput.LoadCreatureInput(input.creatureId())
            );
            if (!loaded.success()) {
                inspectorNavigator.showInfo().accept(new ComposeInspectorInput.InfoEntryInput(
                        "Kreatur",
                        "clean-creature:error:" + input.creatureId(),
                        "Die ausgewaehlte Kreatur konnte nicht geladen werden."
                ));
                return;
            }
            if (loaded.creature() == null) {
                inspectorNavigator.showInfo().accept(new ComposeInspectorInput.InfoEntryInput(
                        "Kreatur",
                        "clean-creature:missing:" + input.creatureId(),
                        "Zu dieser Kreatur liegen keine Statblock-Daten vor."
                ));
                return;
            }

            ComposeCatalogInput.CreatureDetailsInput creature = loaded.creature();
            String title = creature.name() == null || creature.name().isBlank() ? "Kreatur" : creature.name();
            String entryKey = "clean-creature:" + creature.creatureId() + ":" + normalizeMobCount(input.mobCount());
            inspectorNavigator.showContent().accept(new ComposeInspectorInput.HostedEntryInput(
                    title,
                    entryKey,
                    () -> createStatblockContent(creature, input.mobCount())
            ));
        }

        private Node createStatblockContent(
                ComposeCatalogInput.CreatureDetailsInput creature,
                Integer mobCount
        ) {
            VBox root = new VBox(12);
            root.setFillWidth(true);
            root.setPadding(new Insets(12));

            Label title = new Label(creature.name());
            title.getStyleClass().add("heading");

            Label meta = new Label(formatMeta(creature));
            meta.getStyleClass().add("text-muted");
            meta.setWrapText(true);

            VBox overviewCard = new VBox(
                    6,
                    createPropertyRow("Armor Class", creature.ac() + formatParenthetical(creature.acNotes())),
                    createPropertyRow("Hit Points", creature.hp() + formatParenthetical(creature.hitDice())),
                    createPropertyRow("Speed", formatSpeed(creature)),
                    createPropertyRow("Challenge", formatChallenge(creature)),
                    createPropertyRow("Initiative", formatSigned(creature.initiativeBonus())),
                    createPropertyRow("Proficiency", formatSigned(creature.proficiencyBonus()))
            );
            overviewCard.getStyleClass().add("card");
            overviewCard.setPadding(new Insets(12));

            GridPane abilities = createAbilitiesGrid(creature);

            VBox detailsCard = new VBox(6);
            detailsCard.getStyleClass().add("card");
            detailsCard.setPadding(new Insets(12));
            addPropertyIfPresent(detailsCard, "Saving Throws", formatDelimited(creature.savingThrows()));
            addPropertyIfPresent(detailsCard, "Skills", formatDelimited(creature.skills()));
            addPropertyIfPresent(detailsCard, "Damage Vulnerabilities", creature.damageVulnerabilities());
            addPropertyIfPresent(detailsCard, "Damage Resistances", creature.damageResistances());
            addPropertyIfPresent(detailsCard, "Damage Immunities", creature.damageImmunities());
            addPropertyIfPresent(detailsCard, "Condition Immunities", creature.conditionImmunities());
            addPropertyIfPresent(detailsCard, "Senses", formatSenses(creature));
            addPropertyIfPresent(detailsCard, "Languages", creature.languages());
            addPropertyIfPresent(detailsCard, "Biomes", String.join(", ", creature.biomes()));

            if (mobCount != null && mobCount > 1) {
                Label mobLabel = new Label("Mob count: " + mobCount);
                mobLabel.getStyleClass().add("text-muted");
                root.getChildren().add(mobLabel);
            }

            root.getChildren().addAll(title, meta, overviewCard, abilities, detailsCard);
            appendActionSection(root, "Traits", creature.traits());
            appendActionSection(root, "Actions", creature.actions());
            appendActionSection(root, "Bonus Actions", creature.bonusActions());
            appendActionSection(root, "Reactions", creature.reactions());
            appendActionSection(root, "Legendary Actions", creature.legendaryActions());
            return root;
        }

        private static GridPane createAbilitiesGrid(ComposeCatalogInput.CreatureDetailsInput creature) {
            GridPane grid = new GridPane();
            grid.setHgap(12);
            grid.setVgap(6);
            grid.getStyleClass().add("card");
            grid.setPadding(new Insets(12));
            addAbilityCell(grid, 0, "STR", creature.strength());
            addAbilityCell(grid, 1, "DEX", creature.dexterity());
            addAbilityCell(grid, 2, "CON", creature.constitution());
            addAbilityCell(grid, 3, "INT", creature.intelligence());
            addAbilityCell(grid, 4, "WIS", creature.wisdom());
            addAbilityCell(grid, 5, "CHA", creature.charisma());
            return grid;
        }

        private static void addAbilityCell(GridPane grid, int column, String labelText, int score) {
            Label label = new Label(labelText);
            label.getStyleClass().add("subheading");
            Label value = new Label(score + " (" + formatSigned((score - 10) / 2) + ")");
            value.getStyleClass().add("text-muted");
            VBox box = new VBox(2, label, value);
            grid.add(box, column, 0);
        }

        private static void appendActionSection(
                VBox root,
                String title,
                java.util.List<ComposeCatalogInput.CreatureActionInput> actions
        ) {
            if (actions == null || actions.isEmpty()) {
                return;
            }
            Label sectionTitle = new Label(title);
            sectionTitle.getStyleClass().add("subheading");

            VBox card = new VBox(8);
            card.getStyleClass().add("card");
            card.setPadding(new Insets(12));
            for (ComposeCatalogInput.CreatureActionInput action : actions) {
                Label name = new Label(action.name());
                name.getStyleClass().add("subheading");
                Label description = new Label(formatActionDescription(action));
                description.getStyleClass().add("text-muted");
                description.setWrapText(true);
                VBox block = new VBox(2, name, description);
                card.getChildren().add(block);
            }
            root.getChildren().addAll(sectionTitle, card);
        }

        private static void addPropertyIfPresent(VBox container, String label, String value) {
            if (value == null || value.isBlank()) {
                return;
            }
            container.getChildren().add(createPropertyRow(label, value));
        }

        private static Node createPropertyRow(String labelText, String valueText) {
            Label label = new Label(labelText);
            label.getStyleClass().add("subheading");
            Label value = new Label(valueText);
            value.getStyleClass().add("text-muted");
            value.setWrapText(true);

            Region spacer = new Region();
            HBox.setHgrow(spacer, Priority.ALWAYS);
            HBox row = new HBox(8, label, spacer, value);
            row.setFillHeight(true);
            return row;
        }

        private static String formatMeta(ComposeCatalogInput.CreatureDetailsInput creature) {
            StringBuilder builder = new StringBuilder();
            if (creature.size() != null && !creature.size().isBlank()) {
                builder.append(creature.size());
            }
            if (creature.creatureType() != null && !creature.creatureType().isBlank()) {
                if (!builder.isEmpty()) {
                    builder.append(" ");
                }
                builder.append(creature.creatureType());
            }
            if (creature.subtypes() != null && !creature.subtypes().isEmpty()) {
                builder.append(" (").append(String.join(", ", creature.subtypes())).append(")");
            }
            if (creature.alignment() != null && !creature.alignment().isBlank()) {
                if (!builder.isEmpty()) {
                    builder.append(", ");
                }
                builder.append(creature.alignment());
            }
            return builder.toString();
        }

        private static String formatSpeed(ComposeCatalogInput.CreatureDetailsInput creature) {
            java.util.List<String> parts = new java.util.ArrayList<>();
            if (creature.speed() > 0) {
                parts.add(creature.speed() + " ft.");
            }
            if (creature.flySpeed() > 0) {
                parts.add("fly " + creature.flySpeed() + " ft.");
            }
            if (creature.swimSpeed() > 0) {
                parts.add("swim " + creature.swimSpeed() + " ft.");
            }
            if (creature.climbSpeed() > 0) {
                parts.add("climb " + creature.climbSpeed() + " ft.");
            }
            if (creature.burrowSpeed() > 0) {
                parts.add("burrow " + creature.burrowSpeed() + " ft.");
            }
            return parts.isEmpty() ? "0 ft." : String.join(", ", parts);
        }

        private static String formatChallenge(ComposeCatalogInput.CreatureDetailsInput creature) {
            return (creature.cr() == null || creature.cr().isBlank() ? "0" : creature.cr())
                    + " (" + String.format("%,d", creature.xp()) + " XP)";
        }

        private static String formatDelimited(String value) {
            return value == null ? "" : value.replace(",", ", ");
        }

        private static String formatSenses(ComposeCatalogInput.CreatureDetailsInput creature) {
            String senses = formatDelimited(creature.senses());
            if (creature.passivePerception() <= 0) {
                return senses;
            }
            return senses.isBlank()
                    ? "passive Perception " + creature.passivePerception()
                    : senses + ", passive Perception " + creature.passivePerception();
        }

        private static String formatActionDescription(ComposeCatalogInput.CreatureActionInput action) {
            String description = action.description() == null ? "" : action.description().trim();
            if (action.toHitBonus() == null) {
                return description;
            }
            return description.isBlank()
                    ? "To Hit +" + action.toHitBonus()
                    : "To Hit +" + action.toHitBonus() + " — " + description;
        }

        private static String formatSigned(int value) {
            return value >= 0 ? "+" + value : Integer.toString(value);
        }

        private static String formatParenthetical(String value) {
            return value == null || value.isBlank() ? "" : " (" + value + ")";
        }

        private static int normalizeMobCount(Integer mobCount) {
            return mobCount == null || mobCount < 1 ? 1 : mobCount;
        }
    }
}
