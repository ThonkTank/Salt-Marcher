package ui.components;

import entities.Creature;
import javafx.concurrent.Task;
import javafx.geometry.HPos;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Label;
import javafx.scene.layout.ColumnConstraints;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.scene.text.Text;
import javafx.scene.text.TextFlow;
import javafx.application.Platform;
import services.CreatureService;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Rich D&D Beyond-style stat block component.
 * Usable both inline (expanded in lists/cards) and in modal windows.
 */
public class StatBlockPane extends VBox {

    // LRU cache (access-ordered LinkedHashMap, max 50 entries).
    // NOT thread-safe: all reads and writes must happen on the FX Application Thread.
    // The background Task only does the DB fetch; cache insertion happens in setOnSucceeded (FX thread).
    private static final Map<Long, Creature> creatureCache = new LinkedHashMap<>(16, 0.75f, true) {
        @Override protected boolean removeEldestEntry(Map.Entry<Long, Creature> eldest) {
            return size() > 50;
        }
    };

    public StatBlockPane(Creature c) {
        getStyleClass().add("stat-block-pane");
        setSpacing(0);
        setPadding(new Insets(16));
        setMaxWidth(580);

        buildHeader(c);
        buildCoreStats(c);
        buildAbilityGrid(c);
        buildProperties(c);
        buildActionSections(c);
    }

    private void buildHeader(Creature c) {
        // --- Header: Name ---
        Label name = new Label(c.Name);
        name.getStyleClass().add("stat-block-name");
        name.setWrapText(true);

        // --- Meta: Size Type (subtypes), Alignment ---
        StringBuilder meta = new StringBuilder();
        if (notEmpty(c.Size)) meta.append(c.Size);
        if (notEmpty(c.CreatureType)) {
            if (!meta.isEmpty()) meta.append(" ");
            meta.append(c.CreatureType);
        }
        if (c.Subtypes != null && !c.Subtypes.isEmpty())
            meta.append(" (").append(String.join(", ", c.Subtypes)).append(")");
        if (notEmpty(c.Alignment)) {
            if (!meta.isEmpty()) meta.append(", ");
            meta.append(c.Alignment);
        }
        Label metaLabel = new Label(meta.toString());
        metaLabel.getStyleClass().add("stat-block-meta");
        metaLabel.setWrapText(true);

        getChildren().addAll(name, metaLabel, separator());
    }

    private void buildCoreStats(Creature c) {
        // --- Core Stats: AC, HP, Speed ---
        addProperty("Armor Class", c.AC + (notEmpty(c.AcNotes) ? " (" + c.AcNotes + ")" : ""));
        addProperty("Hit Points", c.HP + (notEmpty(c.HitDice) ? " (" + c.HitDice + ")" : ""));

        StringBuilder speed = new StringBuilder().append(c.Speed).append(" ft.");
        if (c.FlySpeed > 0) speed.append(", fly ").append(c.FlySpeed).append(" ft.");
        if (c.SwimSpeed > 0) speed.append(", swim ").append(c.SwimSpeed).append(" ft.");
        if (c.ClimbSpeed > 0) speed.append(", climb ").append(c.ClimbSpeed).append(" ft.");
        if (c.BurrowSpeed > 0) speed.append(", burrow ").append(c.BurrowSpeed).append(" ft.");
        addProperty("Speed", speed.toString());

        getChildren().add(separator());
    }

    private void buildAbilityGrid(Creature c) {
        // --- Ability Scores Grid ---
        GridPane abilities = new GridPane();
        abilities.getStyleClass().add("stat-block-abilities");
        abilities.setAlignment(Pos.CENTER);
        abilities.setHgap(0);
        abilities.setPadding(new Insets(4, 0, 4, 0));

        String[] labels = {"STR", "DEX", "CON", "INT", "WIS", "CHA"};
        int[] scores = {c.Str, c.Dex, c.Con, c.Intel, c.Wis, c.Cha}; // Intel = Intelligence (named to avoid Java's int keyword)

        for (int i = 0; i < 6; i++) {
            ColumnConstraints cc = new ColumnConstraints();
            cc.setPercentWidth(100.0 / 6);
            cc.setHalignment(HPos.CENTER);
            abilities.getColumnConstraints().add(cc);

            Label header = new Label(labels[i]);
            header.getStyleClass().add("stat-block-ability-header");

            int mod = Math.floorDiv(scores[i] - 10, 2);
            String modStr = (mod >= 0 ? "+" : "") + mod;
            Label value = new Label(scores[i] + " (" + modStr + ")");
            value.getStyleClass().add("stat-block-ability-value");

            abilities.add(header, i, 0);
            abilities.add(value, i, 1);
        }

        getChildren().addAll(abilities, separator());
    }

    private void buildProperties(Creature c) {
        // --- Properties ---
        addPropertyIfPresent("Saving Throws", formatDelimited(c.SavingThrows));
        addPropertyIfPresent("Skills", formatDelimited(c.Skills));
        addPropertyIfPresent("Damage Vulnerabilities", c.DamageVulnerabilities);
        addPropertyIfPresent("Damage Resistances", c.DamageResistances);
        addPropertyIfPresent("Damage Immunities", c.DamageImmunities);
        addPropertyIfPresent("Condition Immunities", c.ConditionImmunities);
        addPropertyIfPresent("Senses", formatSenses(c.Senses, c.PassivePerception));
        addPropertyIfPresent("Languages", c.Languages);

        addProperty("Challenge", c.CR + " (" + String.format("%,d", c.XP) + " XP)");
        if (c.ProficiencyBonus > 0) addProperty("Proficiency Bonus", "+" + c.ProficiencyBonus);

        getChildren().add(separator());
    }

    private void buildActionSections(Creature c) {
        // --- Action Sections ---
        addTraitSection(c.Traits);
        addActionSection("Actions", null, c.Actions);
        addActionSection("Bonus Actions", null, c.BonusActions);
        addActionSection("Reactions", null, c.Reactions);

        String legendaryDesc = c.LegendaryActionCount > 0
                ? "The creature can take " + c.LegendaryActionCount
                  + " legendary actions, choosing from the options below."
                : null;
        addActionSection("Legendary Actions", legendaryDesc, c.LegendaryActions);
    }

    /**
     * Loads a stat block into {@code container} asynchronously.
     * Replaces the container's children with a loading placeholder, then with the stat block on success.
     * Returns the background Task so the caller can cancel it if the user navigates away
     * before the load completes. Returns {@code null} if the creature is already cached
     * (load completes synchronously, no task to cancel).
     * Must be called on the FX Application Thread.
     */
    public static Task<Creature> loadAsync(Long creatureId, VBox container) {
        if (!Platform.isFxApplicationThread())
            throw new IllegalStateException("StatBlockPane.loadAsync must be called on the FX Application Thread");
        Label loading = new Label("Lade Stat Block...");
        loading.getStyleClass().add("stat-block-loading");
        container.getChildren().setAll(loading);

        Creature cached = creatureCache.get(creatureId);
        if (cached != null) {
            container.getChildren().setAll(new StatBlockPane(cached));
            return null;
        }

        Task<Creature> task = new Task<>() {
            @Override protected Creature call() { return CreatureService.getCreature(creatureId); }
        };
        task.setOnSucceeded(e -> {
            Creature c = task.getValue();
            if (c != null) {
                creatureCache.put(creatureId, c);
                container.getChildren().setAll(new StatBlockPane(c));
            }
        });
        task.setOnFailed(e -> {
            System.err.println("StatBlockPane.loadAsync(id=" + creatureId + "): "
                    + task.getException().getMessage());
            container.getChildren().setAll(new Label("Fehler beim Laden."));
        });
        Thread t = new Thread(task, "sm-stat-block");
        t.setDaemon(true);
        t.start();
        return task;
    }

    // ---- Layout helpers ----

    private void addProperty(String label, String value) {
        TextFlow flow = new TextFlow();
        Text lbl = new Text(label + "  ");
        lbl.getStyleClass().add("stat-block-prop-label");
        Text val = new Text(value);
        val.getStyleClass().add("stat-block-prop-value");
        flow.getChildren().addAll(lbl, val);
        flow.setPadding(new Insets(1, 0, 1, 0));
        getChildren().add(flow);
    }

    private void addPropertyIfPresent(String label, String value) {
        if (notEmpty(value)) addProperty(label, value);
    }

    /** Adds a trait section without a header or description (renders traits directly). */
    private void addTraitSection(List<Creature.Action> traits) {
        addActionSection(null, null, traits);
    }

    private void addActionSection(String title, String description, List<Creature.Action> actions) {
        if (actions == null || actions.isEmpty()) return;

        if (title != null) {
            Label header = new Label(title);
            header.getStyleClass().add("stat-block-section-header");
            header.setPadding(new Insets(8, 0, 2, 0));
            getChildren().add(header);
        }

        if (notEmpty(description)) {
            Label desc = new Label(description);
            desc.getStyleClass().add("stat-block-meta");
            desc.setWrapText(true);
            desc.setPadding(new Insets(0, 0, 4, 0));
            getChildren().add(desc);
        }

        for (Creature.Action a : actions) {
            getChildren().add(createActionEntry(a));
        }
    }

    private Region createActionEntry(Creature.Action a) {
        TextFlow flow = new TextFlow();
        flow.setPadding(new Insets(2, 0, 2, 0));

        Text nameText = new Text(a.Name + ". ");
        nameText.getStyleClass().add("stat-block-action-name");
        flow.getChildren().add(nameText);

        if (notEmpty(a.Description)) {
            Text descText = new Text(a.Description);
            descText.getStyleClass().add("stat-block-action-desc");
            flow.getChildren().add(descText);
        }

        return flow;
    }

    private Region separator() {
        Region sep = new Region();
        sep.getStyleClass().add("stat-block-separator");
        sep.setMinHeight(2);
        sep.setMaxHeight(2);
        VBox.setMargin(sep, new Insets(6, 0, 6, 0));
        return sep;
    }

    // ---- Formatting helpers ----

    /**
     * Converts DB delimited format ("KEY:value,KEY:value") to display format ("KEY value, KEY value").
     * See CLAUDE.md "Delimited string formats" for the storage convention.
     */
    static String formatDelimited(String raw) {
        return reformatColonDelimited(raw, "");
    }

    static String formatSenses(String senses, int passivePerception) {
        StringBuilder sb = new StringBuilder();
        String formatted = reformatColonDelimited(senses, " ft.");
        if (formatted != null) sb.append(formatted);
        if (passivePerception > 0) {
            if (!sb.isEmpty()) sb.append(", ");
            sb.append("passive Perception ").append(passivePerception);
        }
        return !sb.isEmpty() ? sb.toString() : null;
    }

    /**
     * Parses the DB delimited format ("KEY:value,KEY:value") into display form ("KEY value, KEY value").
     * {@code valueSuffix} is appended to each value (e.g. " ft." for senses, "" for saving throws).
     * See CLAUDE.md "Delimited string formats" for the storage convention used across all stat columns.
     */
    private static String reformatColonDelimited(String raw, String valueSuffix) {
        if (!notEmpty(raw)) return null;
        StringBuilder sb = new StringBuilder();
        for (String part : raw.split(",")) {
            if (!sb.isEmpty()) sb.append(", ");
            String trimmed = part.trim();
            int colon = trimmed.indexOf(':');
            if (colon > 0) {
                sb.append(trimmed.substring(0, colon)).append(" ")
                  .append(trimmed.substring(colon + 1)).append(valueSuffix);
            } else {
                sb.append(trimmed);
            }
        }
        return sb.toString();
    }

    private static boolean notEmpty(String s) { return s != null && !s.isBlank(); }
}
