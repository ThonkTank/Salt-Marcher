package src.view.creatures.assembly;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.api.CreatureDetail;

import java.util.List;

final class CreatureDetailFormatter {

    private final CreatureDetail detail;

    CreatureDetailFormatter(CreatureDetail detail) {
        this.detail = detail;
    }

    String typeLine() {
        String subtypeSuffix = detail.subtypes().isEmpty() ? "" : " (" + joinValues(detail.subtypes()) + ")";
        return detail.size() + " " + detail.creatureType() + subtypeSuffix;
    }

    String hitPoints() {
        return detail.hitPoints() + hitDiceSuffix();
    }

    String armorClass() {
        if (detail.armorClassNotes() == null || detail.armorClassNotes().isBlank()) {
            return Integer.toString(detail.armorClass());
        }
        return detail.armorClass() + " (" + detail.armorClassNotes() + ")";
    }

    String speeds() {
        List<String> parts = new java.util.ArrayList<>();
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
        return parts.isEmpty() ? "—" : String.join(" | ", parts) + " ft";
    }

    String abilityScores() {
        return "STR " + detail.strength()
                + " | DEX " + detail.dexterity()
                + " | CON " + detail.constitution()
                + " | INT " + detail.intelligence()
                + " | WIS " + detail.wisdom()
                + " | CHA " + detail.charisma();
    }

    String damageProfile() {
        List<String> parts = new java.util.ArrayList<>();
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
        return parts.isEmpty() ? "—" : String.join(" | ", parts);
    }

    String joinValues(List<String> values) {
        if (values == null || values.isEmpty()) {
            return "—";
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

    private static String signed(int value) {
        return value >= 0 ? "+" + value : Integer.toString(value);
    }
}
