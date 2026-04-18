package src.view.encounter.interactor;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.api.EncounterBudgetSummary;
import src.domain.encounter.api.EncounterCreature;
import src.domain.encounter.api.EncounterLock;
import src.domain.encounter.api.GeneratedEncounter;
import src.view.encounter.Model.EncounterModel;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

final class EncounterModelUpdater {

    private final EncounterModel model;

    EncounterModelUpdater(EncounterModel model) {
        this.model = model;
    }

    void applyBudget(@Nullable EncounterBudgetSummary budget) {
        EncounterTextFormatter.BudgetText text = EncounterTextFormatter.budgetText(budget);
        model.texts().partySummaryProperty().set(text.partySummary());
        model.texts().thresholdsSummaryProperty().set(text.thresholdsSummary());
        model.texts().dailyBudgetSummaryProperty().set(text.dailyBudgetSummary());
    }

    void applyAlternatives(List<GeneratedEncounter> encounters) {
        List<EncounterModel.EncounterAlternativeViewData> alternatives = new ArrayList<>();
        for (GeneratedEncounter encounter : encounters) {
            alternatives.add(toAlternative(encounter));
        }
        model.alternatives().alternatives().setAll(alternatives);
        model.texts().resultSummaryProperty().set(alternatives.isEmpty()
                ? "No encounter suggestions available."
                : alternatives.size() + " encounter alternatives ready.");
        model.alternatives().selectedAlternativeProperty().set(alternatives.isEmpty() ? null : alternatives.getFirst());
        model.texts().detailTextProperty().set(EncounterTextFormatter.detailText(model.alternatives().selectedAlternativeProperty().get()));
    }

    void updateLockSummary(List<EncounterLock> lockedCreatures) {
        model.texts().lockSummaryProperty().set(EncounterTextFormatter.lockSummary(lockedCreatures));
    }

    void updateExcludeSummary(Set<Long> excludedCreatureIds) {
        model.texts().excludeSummaryProperty().set(EncounterTextFormatter.excludeSummary(excludedCreatureIds));
    }

    private EncounterModel.EncounterAlternativeViewData toAlternative(GeneratedEncounter encounter) {
        List<EncounterModel.EncounterCreatureViewData> creatures = encounter.creatures().stream()
                .map(this::toCreature)
                .toList();
        return new EncounterModel.EncounterAlternativeViewData(
                encounter.title(),
                encounter.achievedDifficulty().name(),
                encounter.creatureCount(),
                encounter.adjustedXp(),
                EncounterTextFormatter.creatureSummary(encounter.creatures()),
                encounter.highlights().isEmpty() ? "" : encounter.highlights().getFirst(),
                creatures,
                encounter.highlights());
    }

    private EncounterModel.EncounterCreatureViewData toCreature(EncounterCreature creature) {
        return new EncounterModel.EncounterCreatureViewData(
                creature.creatureId(),
                creature.name(),
                creature.challengeRating(),
                creature.xp(),
                creature.quantity(),
                creature.role(),
                creature.tags());
    }
}
