package src.domain.encounter.published;

import src.domain.encounter.generation.value.EncounterTuningIntent;

public final class EncounterGenerationTuning {

    public static final int AUTO_BALANCE_LEVEL = EncounterTuningIntent.AUTO_BALANCE_LEVEL;
    public static final double AUTO_AMOUNT_VALUE = EncounterTuningIntent.AUTO_AMOUNT_VALUE;
    public static final int AUTO_DIVERSITY_LEVEL = EncounterTuningIntent.AUTO_DIVERSITY_LEVEL;

    private final EncounterTuningIntent tuning;

    public EncounterGenerationTuning(
            int balanceLevel,
            double amountValue,
            int diversityLevel
    ) {
        this(new EncounterTuningIntent(balanceLevel, amountValue, diversityLevel));
    }

    public EncounterGenerationTuning(EncounterTuningIntent tuning) {
        this.tuning = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
    }

    public static EncounterGenerationTuning defaultTuning() {
        return new EncounterGenerationTuning(EncounterTuningIntent.defaultIntent());
    }

    public static EncounterGenerationTuning autoTuning() {
        return new EncounterGenerationTuning(EncounterTuningIntent.autoIntent());
    }

    public static EncounterGenerationTuning fromIntent(EncounterTuningIntent tuning) {
        return new EncounterGenerationTuning(tuning);
    }

    public EncounterTuningIntent toIntent() {
        return tuning;
    }

    public int balanceLevel() {
        return tuning.balanceLevel();
    }

    public double amountValue() {
        return tuning.amountValue();
    }

    public int diversityLevel() {
        return tuning.diversityLevel();
    }

    public boolean isBalanceAuto() {
        return tuning.isBalanceAuto();
    }

    public boolean isAmountAuto() {
        return tuning.isAmountAuto();
    }

    public boolean isDiversityAuto() {
        return tuning.isDiversityAuto();
    }

    public boolean hasAuto() {
        return tuning.hasAuto();
    }
}
