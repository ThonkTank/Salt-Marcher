package src.view.details.creature;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.api.CreatureActionDetail;
import src.domain.creatures.api.CreatureDetail;
import src.domain.creatures.api.CreatureDetailResult;
import src.domain.creatures.api.CreatureLookupStatus;

public final class CreatureDetailsViewModel {

    private static final NumberFormat INTEGER_FORMAT = NumberFormat.getIntegerInstance(Locale.US);

    private final CreaturesApplicationService creatures;
    private final long creatureId;
    private final ReadOnlyObjectWrapper<DetailPresentation> detail = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyStringWrapper loadingText = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper errorText = new ReadOnlyStringWrapper("");

    public CreatureDetailsViewModel(CreaturesApplicationService creatures, long creatureId) {
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.creatureId = creatureId;
    }

    public ReadOnlyObjectProperty<DetailPresentation> detailProperty() {
        return detail.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty loadingTextProperty() {
        return loadingText.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty errorTextProperty() {
        return errorText.getReadOnlyProperty();
    }

    public void load() {
        loadingText.set("Loading stat block...");
        errorText.set("");
        CreatureDetailResult result = creatures.loadCreatureDetail(creatureId);
        loadingText.set("");
        if (result.status() != CreatureLookupStatus.SUCCESS || result.detail() == null) {
            detail.set(null);
            errorText.set(errorText(result.status()));
            return;
        }
        detail.set(toPresentation(result.detail()));
    }

    private static DetailPresentation toPresentation(CreatureDetail creature) {
        return new DetailPresentation(
                creature.name(),
                meta(creature),
                coreProperties(creature),
                abilities(creature),
                properties(creature),
                sections(creature));
    }

    private static String meta(CreatureDetail creature) {
        StringBuilder meta = new StringBuilder();
        append(meta, creature.size(), " ");
        append(meta, creature.creatureType(), " ");
        if (!creature.subtypes().isEmpty()) {
            meta.append(" (").append(String.join(", ", creature.subtypes())).append(")");
        }
        if (present(creature.alignment())) {
            if (!meta.isEmpty()) {
                meta.append(", ");
            }
            meta.append(creature.alignment());
        }
        return meta.toString();
    }

    private static List<PropertyLine> coreProperties(CreatureDetail creature) {
        List<PropertyLine> lines = new ArrayList<>();
        String armorClassNotes = creature.armorClassNotes();
        String hitDiceExpression = creature.hitDiceExpression();
        lines.add(new PropertyLine("Armor Class", creature.armorClass()
                + (present(armorClassNotes) ? " (" + armorClassNotes + ")" : "")));
        lines.add(new PropertyLine("Hit Points", creature.hitPoints()
                + (present(hitDiceExpression) ? " (" + hitDiceExpression + ")" : "")));
        lines.add(new PropertyLine("Speed", speed(creature)));
        return lines;
    }

    private static List<AbilityScore> abilities(CreatureDetail creature) {
        return List.of(
                ability("STR", creature.strength()),
                ability("DEX", creature.dexterity()),
                ability("CON", creature.constitution()),
                ability("INT", creature.intelligence()),
                ability("WIS", creature.wisdom()),
                ability("CHA", creature.charisma()));
    }

    private static AbilityScore ability(String label, int value) {
        int modifier = Math.floorDiv(value - 10, 2);
        String modifierText = modifier >= 0 ? "+" + modifier : String.valueOf(modifier);
        return new AbilityScore(label, value + " (" + modifierText + ")");
    }

    private static List<PropertyLine> properties(CreatureDetail creature) {
        List<PropertyLine> lines = new ArrayList<>();
        addIfPresent(lines, "Saving Throws", formatDelimited(creature.savingThrows()));
        addIfPresent(lines, "Skills", formatDelimited(creature.skills()));
        addIfPresent(lines, "Damage Vulnerabilities", creature.damageVulnerabilities());
        addIfPresent(lines, "Damage Resistances", creature.damageResistances());
        addIfPresent(lines, "Damage Immunities", creature.damageImmunities());
        addIfPresent(lines, "Condition Immunities", creature.conditionImmunities());
        addIfPresent(lines, "Senses", senses(creature));
        addIfPresent(lines, "Languages", creature.languages());
        lines.add(new PropertyLine("Challenge", creature.challengeRating()
                + " (" + INTEGER_FORMAT.format(creature.xp()) + " XP)"));
        if (creature.proficiencyBonus() > 0) {
            lines.add(new PropertyLine("Proficiency Bonus", "+" + creature.proficiencyBonus()));
        }
        return lines;
    }

    private static List<ActionSection> sections(CreatureDetail creature) {
        List<ActionSection> sections = new ArrayList<>();
        List<ActionLine> actions = creature.actions().stream()
                .map(CreatureDetailsViewModel::actionLine)
                .toList();
        if (!actions.isEmpty()) {
            sections.add(new ActionSection("Actions", "", actions));
        }
        return sections;
    }

    private static ActionLine actionLine(CreatureActionDetail action) {
        return new ActionLine(action.name(), action.description());
    }

    private static String speed(CreatureDetail creature) {
        StringBuilder speed = new StringBuilder().append(creature.walkSpeed()).append(" ft.");
        if (creature.flySpeed() > 0) {
            speed.append(", fly ").append(creature.flySpeed()).append(" ft.");
        }
        if (creature.swimSpeed() > 0) {
            speed.append(", swim ").append(creature.swimSpeed()).append(" ft.");
        }
        if (creature.climbSpeed() > 0) {
            speed.append(", climb ").append(creature.climbSpeed()).append(" ft.");
        }
        if (creature.burrowSpeed() > 0) {
            speed.append(", burrow ").append(creature.burrowSpeed()).append(" ft.");
        }
        return speed.toString();
    }

    private static @Nullable String senses(CreatureDetail creature) {
        StringBuilder text = new StringBuilder();
        String formatted = reformatColonDelimited(creature.senses(), " ft.");
        if (formatted != null) {
            text.append(formatted);
        }
        if (creature.passivePerception() > 0) {
            if (!text.isEmpty()) {
                text.append(", ");
            }
            text.append("passive Perception ").append(creature.passivePerception());
        }
        return text.isEmpty() ? null : text.toString();
    }

    private static @Nullable String formatDelimited(@Nullable String raw) {
        return reformatColonDelimited(raw, "");
    }

    private static @Nullable String reformatColonDelimited(@Nullable String raw, String valueSuffix) {
        if (!present(raw)) {
            return null;
        }
        StringBuilder text = new StringBuilder();
        for (String part : commaParts(raw)) {
            if (!text.isEmpty()) {
                text.append(", ");
            }
            String trimmed = part.trim();
            int colon = trimmed.indexOf(':');
            if (colon > 0) {
                text.append(trimmed, 0, colon)
                        .append(" ")
                        .append(trimmed.substring(colon + 1))
                        .append(valueSuffix);
            } else {
                text.append(trimmed);
            }
        }
        return text.toString();
    }

    private static List<String> commaParts(String raw) {
        List<String> parts = new ArrayList<>();
        int start = 0;
        int separator = raw.indexOf(',');
        while (separator >= 0) {
            parts.add(raw.substring(start, separator));
            start = separator + 1;
            separator = raw.indexOf(',', start);
        }
        parts.add(raw.substring(start));
        return parts;
    }

    private static void append(StringBuilder target, @Nullable String value, String separator) {
        if (!present(value)) {
            return;
        }
        if (!target.isEmpty()) {
            target.append(separator);
        }
        target.append(value);
    }

    private static void addIfPresent(List<PropertyLine> lines, String label, @Nullable String value) {
        if (present(value)) {
            lines.add(new PropertyLine(label, value));
        }
    }

    private static boolean present(@Nullable String value) {
        return value != null && !value.isBlank();
    }

    private static String errorText(CreatureLookupStatus status) {
        if (status == CreatureLookupStatus.NOT_FOUND) {
            return "Creature not found.";
        }
        return "Creature details could not be loaded.";
    }

    public record DetailPresentation(
            String name,
            String meta,
            List<PropertyLine> coreProperties,
            List<AbilityScore> abilities,
            List<PropertyLine> properties,
            List<ActionSection> sections
    ) {
        public DetailPresentation {
            coreProperties = coreProperties == null ? List.of() : List.copyOf(coreProperties);
            abilities = abilities == null ? List.of() : List.copyOf(abilities);
            properties = properties == null ? List.of() : List.copyOf(properties);
            sections = sections == null ? List.of() : List.copyOf(sections);
        }
    }

    public record PropertyLine(String label, String value) {
    }

    public record AbilityScore(String label, String value) {
    }

    public record ActionSection(String title, String description, List<ActionLine> actions) {
        public ActionSection {
            actions = actions == null ? List.of() : List.copyOf(actions);
        }
    }

    public record ActionLine(String name, String description) {
    }
}
