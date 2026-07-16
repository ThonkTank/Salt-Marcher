package features.encounter.adapter.javafx.details;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import org.jspecify.annotations.Nullable;
import features.creatures.api.CreatureActionDetail;
import features.creatures.api.CreatureDetail;
import features.creatures.api.CreatureDetailResult;
import features.creatures.api.CreatureLookupStatus;

public final class CreatureDetailsContentModel {

    private static final String FEET_SUFFIX = " ft.";

    private final CreatureDetailResult result;
    private final ReadOnlyObjectWrapper<DetailState> detail = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyStringWrapper loadingText = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper errorText = new ReadOnlyStringWrapper("");

    public CreatureDetailsContentModel(CreatureDetailResult result) {
        this.result = Objects.requireNonNull(result, "result");
    }

    public ReadOnlyObjectProperty<DetailState> detailProperty() {
        return detail.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty loadingTextProperty() {
        return loadingText.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty errorTextProperty() {
        return errorText.getReadOnlyProperty();
    }

    public void load() {
        loadingText.set("Lade Kreaturenwerte...");
        errorText.set("");
        loadingText.set("");
        if (result.status() != CreatureLookupStatus.SUCCESS || result.detail() == null) {
            detail.set(null);
            errorText.set(errorText(result.status()));
            return;
        }
        detail.set(DetailPresenter.toPresentation(result.detail()));
    }

    private static String errorText(CreatureLookupStatus status) {
        if (status == CreatureLookupStatus.NOT_FOUND) {
            return "Kreatur nicht gefunden.";
        }
        return "Kreaturendetails konnten nicht geladen werden.";
    }

    public record DetailState(
            String name,
            String meta,
            List<PropertyLine> coreProperties,
            List<PropertyLine> abilities,
            List<PropertyLine> properties,
            List<ActionGroup> sections
    ) {
        public DetailState {
            coreProperties = coreProperties == null ? List.of() : List.copyOf(coreProperties);
            abilities = abilities == null ? List.of() : List.copyOf(abilities);
            properties = properties == null ? List.of() : List.copyOf(properties);
            sections = sections == null ? List.of() : List.copyOf(sections);
        }
    }

    public record PropertyLine(String label, String value) {
    }

    public record ActionGroup(String title, String description, List<ActionLine> actions) {
        public ActionGroup {
            actions = actions == null ? List.of() : List.copyOf(actions);
        }
    }

    public record ActionLine(String name, String description) {
    }

    private static final class DetailPresenter {

        private static DetailState toPresentation(CreatureDetail creature) {
            return new DetailState(
                    creature.name(),
                    MetaFormatter.meta(creature),
                    PropertyFormatter.coreProperties(creature),
                    PropertyFormatter.abilities(creature),
                    PropertyFormatter.properties(creature),
                    ActionFormatter.sections(creature));
        }
    }

    private static final class MetaFormatter {

        private static String meta(CreatureDetail creature) {
            StringBuilder meta = new StringBuilder();
            TextSupport.append(meta, creature.size(), " ");
            TextSupport.append(meta, creature.creatureType(), " ");
            if (!creature.subtypes().isEmpty()) {
                meta.append(" (").append(String.join(", ", creature.subtypes())).append(")");
            }
            if (TextSupport.present(creature.alignment())) {
                if (!meta.isEmpty()) {
                    meta.append(", ");
                }
                meta.append(creature.alignment());
            }
            return meta.toString();
        }
    }

    private static final class PropertyFormatter {

        private static List<PropertyLine> coreProperties(CreatureDetail creature) {
            List<PropertyLine> lines = new ArrayList<>();
            lines.add(new PropertyLine("Armor Class", creature.armorClass()
                    + TextSupport.parenthesized(creature.armorClassNotes())));
            lines.add(new PropertyLine("Hit Points", creature.hitPoints()
                    + TextSupport.parenthesized(creature.hitDiceExpression())));
            lines.add(new PropertyLine("Speed", speed(creature)));
            return lines;
        }

        private static List<PropertyLine> abilities(CreatureDetail creature) {
            return List.of(
                    ability("STR", creature.strength()),
                    ability("DEX", creature.dexterity()),
                    ability("CON", creature.constitution()),
                    ability("INT", creature.intelligence()),
                    ability("WIS", creature.wisdom()),
                    ability("CHA", creature.charisma()));
        }

        private static List<PropertyLine> properties(CreatureDetail creature) {
            List<PropertyLine> lines = new ArrayList<>();
            addIfPresent(lines, "Saving Throws", TextSupport.formatDelimited(creature.savingThrows()));
            addIfPresent(lines, "Skills", TextSupport.formatDelimited(creature.skills()));
            addIfPresent(lines, "Damage Vulnerabilities", creature.damageVulnerabilities());
            addIfPresent(lines, "Damage Resistances", creature.damageResistances());
            addIfPresent(lines, "Damage Immunities", creature.damageImmunities());
            addIfPresent(lines, "Condition Immunities", creature.conditionImmunities());
            addIfPresent(lines, "Senses", senses(creature));
            addIfPresent(lines, "Languages", creature.languages());
            lines.add(new PropertyLine("Challenge", creature.challengeRating()
                    + " (" + TextSupport.formatNumber(creature.xp()) + " XP)"));
            if (creature.proficiencyBonus() > 0) {
                lines.add(new PropertyLine("Proficiency Bonus", "+" + creature.proficiencyBonus()));
            }
            return lines;
        }

        private static PropertyLine ability(String label, int value) {
            int modifier = Math.floorDiv(value - 10, 2);
            String modifierText = modifier >= 0 ? "+" + modifier : String.valueOf(modifier);
            return new PropertyLine(label, value + " (" + modifierText + ")");
        }

        private static String speed(CreatureDetail creature) {
            StringBuilder speed = new StringBuilder().append(creature.walkSpeed()).append(FEET_SUFFIX);
            appendSpeed(speed, "fly", creature.flySpeed());
            appendSpeed(speed, "swim", creature.swimSpeed());
            appendSpeed(speed, "climb", creature.climbSpeed());
            appendSpeed(speed, "burrow", creature.burrowSpeed());
            return speed.toString();
        }

        private static @Nullable String senses(CreatureDetail creature) {
            StringBuilder text = new StringBuilder();
            String formatted = TextSupport.reformatColonDelimited(creature.senses(), FEET_SUFFIX);
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

        private static void addIfPresent(
                List<PropertyLine> lines,
                String label,
                @Nullable String value
        ) {
            if (TextSupport.present(value)) {
                lines.add(new PropertyLine(label, value));
            }
        }

        private static void appendSpeed(StringBuilder speed, String label, int value) {
            if (value > 0) {
                speed.append(", ").append(label).append(" ").append(value).append(FEET_SUFFIX);
            }
        }
    }

    private static final class ActionFormatter {

        private static List<ActionGroup> sections(CreatureDetail creature) {
            List<ActionLine> actions = creature.actions().stream()
                    .map(ActionFormatter::actionLine)
                    .toList();
            if (actions.isEmpty()) {
                return List.of();
            }
            return List.of(new ActionGroup("Actions", "", actions));
        }

        private static ActionLine actionLine(CreatureActionDetail action) {
            return new ActionLine(action.name(), action.description());
        }
    }

    private static final class TextSupport {

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

        private static String parenthesized(@Nullable String value) {
            return present(value) ? " (" + value + ")" : "";
        }

        private static boolean present(@Nullable String value) {
            return value != null && !value.isBlank();
        }

        private static String formatNumber(int value) {
            return java.text.NumberFormat.getIntegerInstance(Locale.US).format(value);
        }
    }
}
