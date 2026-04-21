package src.domain.encounter.generation.policy;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.SplittableRandom;
import src.domain.encounter.generation.value.EncounterDifficultyIntent;
import src.domain.encounter.generation.value.EncounterDraft;
import src.domain.encounter.generation.value.EncounterGenerationAttempt;
import src.domain.encounter.generation.value.EncounterTuningIntent;

public final class EncounterAutoTuningPolicy {

    private static final List<EncounterDifficultyIntent> AUTO_DIFFICULTIES = List.of(
            EncounterDifficultyIntent.EASY,
            EncounterDifficultyIntent.MEDIUM,
            EncounterDifficultyIntent.HARD,
            EncounterDifficultyIntent.DEADLY);
    private static final int DEFAULT_BALANCE_LEVEL = 3;
    private static final double DEFAULT_AMOUNT_VALUE = 3.0;
    private static final int DEFAULT_DIVERSITY_LEVEL = 2;

    private EncounterAutoTuningPolicy() {
    }

    // PMD: the branching is the bounded Auto resolution policy; splitting it would obscure the generated attempt order.
    @SuppressWarnings({"PMD.CognitiveComplexity", "PMD.CyclomaticComplexity", "PMD.NPathComplexity"})
    public static List<EncounterGenerationAttempt> resolveAttempts(
            EncounterDifficultyIntent requestedDifficulty,
            boolean difficultyAuto,
            EncounterTuningIntent requestedTuning,
            long generationSeed,
            int maxAttempts
    ) {
        EncounterDifficultyIntent explicitDifficulty = requestedDifficulty == null
                ? EncounterDifficultyIntent.MEDIUM
                : requestedDifficulty;
        EncounterTuningIntent tuning = requestedTuning == null ? EncounterTuningIntent.defaultIntent() : requestedTuning;
        int limit = Math.max(1, maxAttempts);
        if (!difficultyAuto && !tuning.hasAuto()) {
            return List.of(new EncounterGenerationAttempt(explicitDifficulty, tuning, false));
        }

        SplittableRandom random = new SplittableRandom(generationSeed == 0L ? 1L : generationSeed);
        List<EncounterGenerationAttempt> attempts = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        addAttempt(attempts, seen, neutralDifficulty(explicitDifficulty, difficultyAuto), neutralTuning(tuning), true);
        List<EncounterDifficultyIntent> difficultyOrder = shuffledDifficulties(random);
        while (attempts.size() < limit) {
            int index = attempts.size() - 1;
            EncounterDifficultyIntent difficulty = difficultyAuto
                    ? difficultyOrder.get(Math.floorMod(index, difficultyOrder.size()))
                    : explicitDifficulty;
            EncounterTuningIntent resolvedTuning = new EncounterTuningIntent(
                    tuning.isBalanceAuto() ? 1 + random.nextInt(5) : tuning.balanceLevel(),
                    tuning.isAmountAuto() ? gaussianLevel(random, DEFAULT_AMOUNT_VALUE, 1.15) : tuning.amountValue(),
                    tuning.isDiversityAuto() ? 1 + random.nextInt(4) : tuning.diversityLevel());
            if (!addAttempt(attempts, seen, difficulty, resolvedTuning, true)
                    && seen.size() >= AUTO_DIFFICULTIES.size() * 5 * 5 * 4) {
                break;
            }
        }
        return List.copyOf(attempts);
    }

    public static boolean prefersFallbackDrafts(List<EncounterDraft> candidate, List<EncounterDraft> current) {
        return fallbackScore(candidate) > fallbackScore(current);
    }

    private static int fallbackScore(List<EncounterDraft> drafts) {
        return drafts == null || drafts.isEmpty() ? Integer.MIN_VALUE : drafts.getFirst().metrics().score();
    }

    private static EncounterDifficultyIntent neutralDifficulty(
            EncounterDifficultyIntent requestedDifficulty,
            boolean difficultyAuto
    ) {
        return difficultyAuto ? EncounterDifficultyIntent.MEDIUM : requestedDifficulty;
    }

    private static EncounterTuningIntent neutralTuning(EncounterTuningIntent tuning) {
        return new EncounterTuningIntent(
                tuning.isBalanceAuto() ? DEFAULT_BALANCE_LEVEL : tuning.balanceLevel(),
                tuning.isAmountAuto() ? DEFAULT_AMOUNT_VALUE : tuning.amountValue(),
                tuning.isDiversityAuto() ? DEFAULT_DIVERSITY_LEVEL : tuning.diversityLevel());
    }

    private static boolean addAttempt(
            List<EncounterGenerationAttempt> attempts,
            Set<String> seen,
            EncounterDifficultyIntent difficulty,
            EncounterTuningIntent tuning,
            boolean autoResolved
    ) {
        String key = difficulty.name()
                + ':'
                + tuning.balanceLevel()
                + ':'
                + Math.round(tuning.amountValue() * 100.0)
                + ':'
                + tuning.diversityLevel();
        if (!seen.add(key)) {
            return false;
        }
        attempts.add(new EncounterGenerationAttempt(difficulty, tuning, autoResolved));
        return true;
    }

    private static List<EncounterDifficultyIntent> shuffledDifficulties(SplittableRandom random) {
        List<EncounterDifficultyIntent> result = new ArrayList<>(AUTO_DIFFICULTIES);
        for (int index = result.size() - 1; index > 0; index--) {
            int swap = random.nextInt(index + 1);
            EncounterDifficultyIntent current = result.get(index);
            result.set(index, result.get(swap));
            result.set(swap, current);
        }
        return result;
    }

    private static double gaussianLevel(SplittableRandom random, double center, double deviation) {
        double first = Math.max(Double.MIN_VALUE, random.nextDouble());
        double second = random.nextDouble();
        double gaussian = Math.sqrt(-2.0 * Math.log(first)) * Math.cos(2.0 * Math.PI * second);
        return Math.max(1.0, Math.min(5.0, center + gaussian * deviation));
    }
}
