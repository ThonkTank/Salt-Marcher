package src.view.creatures.ViewModel;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.api.CreatureActionDetail;
import src.domain.creatures.api.CreatureDetail;

public final class CreatureInspectorViewMapper {

    private CreatureInspectorViewMapper() {
    }

    public static CreatureInspectorViewData toViewData(CreatureDetail detail) {
        var formatter = new Formatter(detail);
        List<CreatureInspectorViewData.Section> sections = new ArrayList<>();
        sections.add(section("Identity",
                field("Type", formatter.typeLine()),
                field("CR", detail.challengeRating()),
                field("XP", Integer.toString(detail.xp())),
                field("Biomes", formatter.joinValues(detail.biomes()))));
        sections.add(section("Defenses",
                field("HP", formatter.hitPoints()),
                field("AC", formatter.armorClass()),
                field("Senses", detail.senses()),
                field("Passive Perception", Integer.toString(detail.passivePerception())),
                field("Condition Immunities", detail.conditionImmunities()),
                field("Damage Profile", formatter.damageProfile())));
        sections.add(section("Combat Stats",
                field("Initiative Bonus", signed(detail.initiativeBonus())),
                field("Proficiency Bonus", signed(detail.proficiencyBonus())),
                field("Speed", formatter.speeds()),
                field("Abilities", formatter.abilityScores()),
                field("Saving Throws", detail.savingThrows()),
                field("Skills", detail.skills())));
        sections.add(section("Narrative",
                field("Alignment", detail.alignment()),
                field("Languages", detail.languages()),
                field("Armor Notes", detail.armorClassNotes())));
        sections.addAll(actionSections(detail.actions()));
        return new CreatureInspectorViewData(sections);
    }

    private static List<CreatureInspectorViewData.Section> actionSections(List<CreatureActionDetail> actions) {
        if (actions == null || actions.isEmpty()) {
            return List.of();
        }
        Map<String, List<CreatureActionDetail>> grouped = new LinkedHashMap<>();
        for (CreatureActionDetail action : actions) {
            grouped.computeIfAbsent(sectionTitle(action.actionType()), ignored -> new ArrayList<>()).add(action);
        }
        List<CreatureInspectorViewData.Section> sections = new ArrayList<>();
        for (Map.Entry<String, List<CreatureActionDetail>> entry : grouped.entrySet()) {
            List<CreatureInspectorViewData.Field> fields = new ArrayList<>();
            for (CreatureActionDetail action : entry.getValue()) {
                fields.add(field(action.name(), description(action)));
            }
            sections.add(new CreatureInspectorViewData.Section(entry.getKey(), fields));
        }
        return sections;
    }

    private static CreatureInspectorViewData.Section section(
            String title,
            CreatureInspectorViewData.Field... fields) {
        return new CreatureInspectorViewData.Section(title, List.of(fields));
    }

    private static CreatureInspectorViewData.Field field(String label, @Nullable String value) {
        return new CreatureInspectorViewData.Field(label, value == null || value.isBlank() ? "-" : value);
    }

    private static String sectionTitle(String actionType) {
        if (actionType == null || actionType.isBlank()) {
            return "Actions";
        }
        return switch (actionType) {
            case "trait" -> "Traits";
            case "bonus_action" -> "Bonus Actions";
            case "reaction" -> "Reactions";
            case "legendary_action" -> "Legendary Actions";
            default -> "Actions";
        };
    }

    private static String description(CreatureActionDetail action) {
        String description = action.description() == null ? "" : action.description().trim();
        if (action.toHitBonus() == null) {
            return description.isEmpty() ? "-" : description;
        }
        String prefix = "To hit " + signed(action.toHitBonus());
        return description.isEmpty() ? prefix : prefix + " | " + description;
    }

    private static String signed(int value) {
        return value >= 0 ? "+" + value : Integer.toString(value);
    }

    private static final class Formatter {

        private final CreatureDetail detail;

        private Formatter(CreatureDetail detail) {
            this.detail = detail;
        }

        private String typeLine() {
            String subtypeSuffix = detail.subtypes().isEmpty() ? "" : " (" + joinValues(detail.subtypes()) + ")";
            return detail.size() + " " + detail.creatureType() + subtypeSuffix;
        }

        private String hitPoints() {
            return detail.hitPoints() + hitDiceSuffix();
        }

        private String armorClass() {
            if (detail.armorClassNotes() == null || detail.armorClassNotes().isBlank()) {
                return Integer.toString(detail.armorClass());
            }
            return detail.armorClass() + " (" + detail.armorClassNotes() + ")";
        }

        private String speeds() {
            List<String> parts = new ArrayList<>();
            if (detail.walkSpeed() > 0) {
                parts.add("walk " + detail.walkSpeed());
            }
            if (detail.flySpeed() > 0) {
                parts.add("fly " + detail.flySpeed());
            }
            if (detail.swimSpeed() > 0) {
                parts.add("swim " + detail.swimSpeed());
            }
            if (detail.climbSpeed() > 0) {
                parts.add("climb " + detail.climbSpeed());
            }
            if (detail.burrowSpeed() > 0) {
                parts.add("burrow " + detail.burrowSpeed());
            }
            return parts.isEmpty() ? "-" : String.join(" | ", parts) + " ft";
        }

        private String abilityScores() {
            return "STR " + detail.strength()
                    + " | DEX " + detail.dexterity()
                    + " | CON " + detail.constitution()
                    + " | INT " + detail.intelligence()
                    + " | WIS " + detail.wisdom()
                    + " | CHA " + detail.charisma();
        }

        private String damageProfile() {
            List<String> parts = new ArrayList<>();
            String vulnerabilities = blankToNull(detail.damageVulnerabilities());
            if (vulnerabilities != null) {
                parts.add("Vuln: " + vulnerabilities);
            }
            String resistances = blankToNull(detail.damageResistances());
            if (resistances != null) {
                parts.add("Res: " + resistances);
            }
            String immunities = blankToNull(detail.damageImmunities());
            if (immunities != null) {
                parts.add("Imm: " + immunities);
            }
            return parts.isEmpty() ? "-" : String.join(" | ", parts);
        }

        private String joinValues(List<String> values) {
            if (values == null || values.isEmpty()) {
                return "-";
            }
            return String.join(", ", values);
        }

        private String hitDiceSuffix() {
            if (detail.hitDiceExpression() != null && !detail.hitDiceExpression().isBlank()) {
                return " (" + detail.hitDiceExpression() + ")";
            }
            if (detail.hitDiceCount() == null || detail.hitDiceSides() == null) {
                return "";
            }
            int modifier = detail.hitDiceModifier() == null ? 0 : detail.hitDiceModifier();
            String modifierSuffix = modifier == 0 ? "" : signed(modifier);
            return " (" + detail.hitDiceCount() + "d" + detail.hitDiceSides() + modifierSuffix + ")";
        }

        private static @Nullable String blankToNull(@Nullable String value) {
            if (value == null) {
                return null;
            }
            String trimmed = value.trim();
            return trimmed.isEmpty() ? null : trimmed;
        }
    }
}
