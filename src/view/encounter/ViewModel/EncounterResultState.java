package src.view.encounter.ViewModel;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.api.EncounterBudgetSummary;
import src.domain.encounter.api.EncounterGenerationResult;
import src.domain.encounter.api.EncounterLock;
import src.domain.encounter.api.GeneratedEncounter;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@SuppressWarnings("PMD.TooManyMethods")
final class EncounterResultState {

    private final Set<Long> excludedCreatureIds = new LinkedHashSet<>();

    private List<EncounterSnapshot.AlternativeViewData> alternatives = List.of();
    private EncounterSnapshot.@Nullable AlternativeViewData selectedAlternative;
    private List<EncounterLock> lockedCreatures = List.of();
    private String partySummary = "No active party.";
    private String thresholdsSummary = "";
    private String dailyBudgetSummary = "";
    private String lockSummary = "Locked: none";
    private String excludeSummary = "Excluded: none";
    private String statusText = "";
    private String resultSummary = "No encounters generated yet.";
    private String detailText = "Generate an encounter to inspect the composition.";

    List<Long> excludedCreatureIds() {
        return List.copyOf(excludedCreatureIds);
    }

    List<EncounterLock> lockedCreatures() {
        return lockedCreatures;
    }

    List<EncounterSnapshot.AlternativeViewData> alternatives() {
        return alternatives;
    }

    EncounterSnapshot.@Nullable AlternativeViewData selectedAlternative() {
        return selectedAlternative;
    }

    boolean hasSelectedAlternative() {
        return selectedAlternative != null;
    }

    void updateStatus(String text) {
        statusText = text;
    }

    void applyGenerationResult(EncounterGenerationResult result) {
        applyBudget(result.budget());
        applyAlternatives(result.encounters());
        statusText = result.message();
    }

    boolean selectAlternative(EncounterSnapshot.@Nullable AlternativeViewData alternative) {
        if (java.util.Objects.equals(selectedAlternative, alternative)) {
            return false;
        }
        selectedAlternative = alternative;
        detailText = EncounterTextFormatter.detailText(alternative);
        return true;
    }

    boolean lockSelected() {
        if (selectedAlternative == null) {
            statusText = "Select an encounter before locking.";
            return false;
        }
        lockedCreatures = selectedAlternative.creatures().stream()
                .map(creature -> new EncounterLock(creature.creatureId(), creature.quantity()))
                .toList();
        lockSummary = EncounterTextFormatter.lockSummary(lockedCreatures);
        return true;
    }

    void clearLocks() {
        lockedCreatures = List.of();
        lockSummary = EncounterTextFormatter.lockSummary(lockedCreatures);
    }

    boolean excludeSelected() {
        if (selectedAlternative == null) {
            statusText = "Select an encounter before excluding it.";
            return false;
        }
        for (EncounterSnapshot.CreatureViewData creature : selectedAlternative.creatures()) {
            excludedCreatureIds.add(creature.creatureId());
        }
        excludeSummary = EncounterTextFormatter.excludeSummary(excludedCreatureIds);
        return true;
    }

    void clearExclusions() {
        excludedCreatureIds.clear();
        excludeSummary = EncounterTextFormatter.excludeSummary(excludedCreatureIds);
    }

    EncounterSnapshot.TextViewData textViewData() {
        return new EncounterSnapshot.TextViewData(
                partySummary,
                thresholdsSummary,
                dailyBudgetSummary,
                lockSummary,
                excludeSummary,
                statusText,
                resultSummary,
                detailText);
    }

    private void applyBudget(@Nullable EncounterBudgetSummary budget) {
        if (budget == null || budget.partyLevels().isEmpty()) {
            partySummary = "No active party.";
            thresholdsSummary = "";
            dailyBudgetSummary = "";
            return;
        }
        partySummary = "Active party levels: "
                + budget.partyLevels().stream().map(String::valueOf).collect(Collectors.joining(", "))
                + "  |  Avg " + budget.averageLevel();
        thresholdsSummary = "Thresholds  E " + budget.easyXp() + "  M " + budget.mediumXp()
                + "  H " + budget.hardXp() + "  D " + budget.deadlyXp();
        dailyBudgetSummary = "Daily budget " + budget.consumedDailyXp() + "/" + budget.dailyBudgetXp()
                + " XP  |  Remaining " + budget.remainingDailyXp();
    }

    private void applyAlternatives(List<GeneratedEncounter> generatedEncounters) {
        alternatives = generatedEncounters == null
                ? List.of()
                : generatedEncounters.stream().map(EncounterAlternativeViewMapper::toAlternative).toList();
        resultSummary = alternatives.isEmpty()
                ? "No encounter suggestions available."
                : alternatives.size() + " encounter alternatives ready.";
        selectedAlternative = alternatives.isEmpty() ? null : alternatives.getFirst();
        detailText = EncounterTextFormatter.detailText(selectedAlternative);
    }
}
