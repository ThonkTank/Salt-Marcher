package features.encounter.adapter.javafx.state;

import features.encounter.api.EncounterStateSnapshot;

final class EncounterStateVocabulary {

    private static final double HEALTHY_THRESHOLD = 0.5;
    private static final double WOUNDED_THRESHOLD = 0.25;

    private EncounterStateVocabulary() {
    }

    static int contentIndex(EncounterStateSnapshot.Mode mode) {
        EncounterStateSnapshot.Mode safeMode = mode == null ? EncounterStateSnapshot.Mode.BUILDER : mode;
        return switch (safeMode) {
            case INITIATIVE -> 1;
            case COMBAT -> 2;
            case RESULTS -> 3;
            case BUILDER -> 0;
        };
    }

    static String initiativeSectionLabel(String kind) {
        return "SC".equals(kind) ? "Spieler" : kind;
    }

    static EncounterStateViewModel.HpMeterDisplay hpMeterDisplay(EncounterStateViewModel.CombatCard card) {
        EncounterStateViewModel.CombatCard safeCard = card == null
                ? new EncounterStateViewModel.CombatCard("", "", false, false, false, 0, 0, 0, 0, 1, "")
                : card;
        double fraction = safeCard.maxHp() > 0
                ? clampPercent((double) safeCard.currentHp() / safeCard.maxHp())
                : 0.0;
        String hpText = safeCard.currentHp() + " / " + safeCard.maxHp();
        return new EncounterStateViewModel.HpMeterDisplay(
                fraction,
                (fraction <= WOUNDED_THRESHOLD ? "! " : "") + hpText,
                safeCard.name() + " HP " + hpText,
                hpFillStyle(fraction));
    }

    static double clampPercent(double value) {
        if (Double.isNaN(value)) {
            return 1.0;
        }
        return Math.max(0.0, Math.min(1.0, value));
    }

    private static String hpFillStyle(double fraction) {
        if (fraction > HEALTHY_THRESHOLD) {
            return "hp-fill-healthy";
        }
        if (fraction > WOUNDED_THRESHOLD) {
            return "hp-fill-wounded";
        }
        return "hp-fill-critical";
    }
}
