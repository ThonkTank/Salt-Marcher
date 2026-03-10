package features.creatures.ui.shared.statblock;

import features.creatures.api.StatBlockRequest;
import features.creatures.model.Creature;
import javafx.beans.value.ChangeListener;
import javafx.beans.value.ObservableIntegerValue;
import javafx.geometry.HPos;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.ColumnConstraints;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.scene.text.Text;
import javafx.scene.text.TextFlow;
import shared.creatures.parser.ActionToHitParser;
import java.util.ArrayList;
import java.util.List;

/**
 * Rich D&D Beyond-style stat block component.
 * Usable both inline (expanded in lists/cards) and in modal windows.
 */
public class StatBlockPane extends VBox {

    private final MobContext mobContext;
    private final List<MobActionBinding> mobActionBindings = new ArrayList<>();
    private final ChangeListener<Number> mobTargetAcListener = (obs, oldValue, newValue) -> refreshMobActionHits();
    private boolean mobListenerAttached;

    public StatBlockPane(Creature c) {
        this(c, StatBlockRequest.forCreature(c.Id), null);
    }

    public StatBlockPane(Creature c, StatBlockRequest request) {
        this(c, request, null);
    }

    public StatBlockPane(Creature c, StatBlockRequest request, ObservableIntegerValue targetAcInput) {
        getStyleClass().add("stat-block-pane");
        setSpacing(0);
        setPadding(new Insets(16));
        setMaxWidth(580);
        this.mobContext = resolveMobContext(request, targetAcInput);

        buildHeader(c);
        buildCoreStats(c);
        buildAbilityGrid(c);
        buildProperties(c);
        buildActionSections(c);
        configureMobTargetAcLifecycle();
    }

    private void buildHeader(Creature c) {
        Label name = new Label(c.Name);
        name.getStyleClass().add("stat-block-name");
        name.setWrapText(true);

        StringBuilder meta = new StringBuilder();
        if (notEmpty(c.Size)) meta.append(c.Size);
        if (notEmpty(c.CreatureType)) {
            if (!meta.isEmpty()) meta.append(" ");
            meta.append(c.CreatureType);
        }
        if (c.Subtypes != null && !c.Subtypes.isEmpty()) {
            meta.append(" (").append(String.join(", ", c.Subtypes)).append(")");
        }
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
        GridPane abilities = new GridPane();
        abilities.getStyleClass().add("stat-block-abilities");
        abilities.setAlignment(Pos.CENTER);
        abilities.setHgap(0);
        abilities.setPadding(new Insets(4, 0, 4, 0));

        String[] labels = {"STR", "DEX", "CON", "INT", "WIS", "CHA"};
        int[] scores = {c.Str, c.Dex, c.Con, c.Intel, c.Wis, c.Cha};

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
        addTraitSection(c.Traits);
        addActionSection("Actions", null, c.Actions, true);
        addActionSection("Bonus Actions", null, c.BonusActions, true);
        addActionSection("Reactions", null, c.Reactions, false);

        String legendaryDesc = c.LegendaryActionCount > 0
                ? "The creature can take " + c.LegendaryActionCount
                + " legendary actions, choosing from the options below."
                : null;
        addActionSection("Legendary Actions", legendaryDesc, c.LegendaryActions, true);
    }

    private static MobContext resolveMobContext(StatBlockRequest request, ObservableIntegerValue targetAcInput) {
        if (request == null || request.mobCount() == null || targetAcInput == null) {
            return null;
        }
        return new MobContext(MobAttackCalculator.clampMobCount(request.mobCount()), targetAcInput);
    }

    private static Integer resolveToHitBonus(Creature.Action action) {
        if (action == null) return null;
        if (action.ToHitBonus != null) return action.ToHitBonus;
        return ActionToHitParser.extractToHitBonus(action.Description);
    }

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

    private void addTraitSection(List<Creature.Action> traits) {
        addActionSection(null, null, traits, false);
    }

    private void addActionSection(String title, String description, List<Creature.Action> actions, boolean showMobHitHint) {
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
            getChildren().add(createActionEntry(a, showMobHitHint));
        }
    }

    private Region createActionEntry(Creature.Action a, boolean showMobHitHint) {
        Integer toHit = resolveToHitBonus(a);
        if (showMobHitHint && mobContext != null && toHit != null) {
            return createMobActionEntry(a, toHit);
        }

        TextFlow flow = new TextFlow();
        flow.setPadding(new Insets(2, 0, 2, 0));

        String actionTitle = formatActionTitle(a.Name);
        if (actionTitle != null) {
            Text nameText = new Text(actionTitle);
            nameText.getStyleClass().add("stat-block-action-name");
            flow.getChildren().add(nameText);
        }

        if (notEmpty(a.Description)) {
            Text descText = new Text(a.Description);
            descText.getStyleClass().add("stat-block-action-desc");
            flow.getChildren().add(descText);
        }

        return flow;
    }

    private Region createMobActionEntry(Creature.Action action, int toHitBonus) {
        VBox wrapper = new VBox(2);
        wrapper.setPadding(new Insets(2, 0, 2, 0));

        String actionTitle = formatActionTitle(action.Name);
        Label nameLabel = new Label(actionTitle != null ? actionTitle.trim() : "");
        nameLabel.getStyleClass().add("stat-block-action-name-label");

        Label hitsLabel = new Label();
        hitsLabel.getStyleClass().add("stat-block-action-mob-hits");
        mobActionBindings.add(new MobActionBinding(toHitBonus, hitsLabel));

        HBox head = new HBox(8, nameLabel, hitsLabel);
        head.setAlignment(Pos.CENTER_LEFT);
        wrapper.getChildren().add(head);

        if (notEmpty(action.Description)) {
            TextFlow descFlow = new TextFlow();
            Text descText = new Text(action.Description);
            descText.getStyleClass().add("stat-block-action-desc");
            descFlow.getChildren().add(descText);
            wrapper.getChildren().add(descFlow);
        }
        return wrapper;
    }

    private void configureMobTargetAcLifecycle() {
        if (mobContext == null || mobActionBindings.isEmpty()) {
            return;
        }
        refreshMobActionHits();
        sceneProperty().addListener((obs, oldScene, newScene) -> {
            if (newScene == null) {
                detachMobTargetAcListener();
            } else {
                attachMobTargetAcListener();
            }
        });
        if (getScene() != null) {
            attachMobTargetAcListener();
        }
    }

    private void attachMobTargetAcListener() {
        if (mobListenerAttached || mobContext == null) {
            return;
        }
        mobContext.targetAc().addListener(mobTargetAcListener);
        mobListenerAttached = true;
    }

    private void detachMobTargetAcListener() {
        if (!mobListenerAttached || mobContext == null) {
            return;
        }
        mobContext.targetAc().removeListener(mobTargetAcListener);
        mobListenerAttached = false;
    }

    private void refreshMobActionHits() {
        if (mobContext == null || mobActionBindings.isEmpty()) {
            return;
        }
        int targetAc = mobContext.targetAc().get();
        int mobCount = mobContext.mobCount();
        for (MobActionBinding binding : mobActionBindings) {
            int neededRoll = MobAttackCalculator.requiredRoll(targetAc, binding.toHitBonus());
            int hitsPerAction = MobAttackCalculator.expectedHits(
                    neededRoll,
                    mobCount,
                    MobAttackCalculator.RollMode.NORMAL);
            binding.hitsLabel().setText("Treffer: " + hitsPerAction);
        }
    }

    private Region separator() {
        Region sep = new Region();
        sep.getStyleClass().add("stat-block-separator");
        sep.setMinHeight(2);
        sep.setMaxHeight(2);
        VBox.setMargin(sep, new Insets(6, 0, 6, 0));
        return sep;
    }

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

    private static String reformatColonDelimited(String raw, String valueSuffix) {
        if (!notEmpty(raw)) return null;
        StringBuilder sb = new StringBuilder();
        for (String part : raw.split(",")) {
            if (!sb.isEmpty()) sb.append(", ");
            String trimmed = part.trim();
            int colon = trimmed.indexOf(':');
            if (colon > 0) {
                sb.append(trimmed, 0, colon).append(" ")
                        .append(trimmed.substring(colon + 1)).append(valueSuffix);
            } else {
                sb.append(trimmed);
            }
        }
        return sb.toString();
    }

    private static boolean notEmpty(String s) {
        return s != null && !s.isBlank();
    }

    private static String formatActionTitle(String name) {
        if (!notEmpty(name)) {
            return null;
        }
        return name + ". ";
    }

    private record MobActionBinding(int toHitBonus, Label hitsLabel) {}
    private record MobContext(int mobCount, ObservableIntegerValue targetAc) {}
}
