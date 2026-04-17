package src.view.encounter.interactor;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.creaturesAPI;
import src.domain.encounter.api.EncounterBudgetSummary;
import src.domain.encounter.api.EncounterCreature;
import src.domain.encounter.api.EncounterDifficultyBand;
import src.domain.encounter.api.EncounterGenerationRequest;
import src.domain.encounter.api.EncounterLock;
import src.domain.encounter.api.GeneratedEncounter;
import src.domain.encounter.encounterAPI;
import src.view.encounter.Model.EncounterModel;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

public final class EncounterInteractor {

    private final encounterAPI encounters;
    private final creaturesAPI creatures;
    private final EncounterModel model;
    private final Set<Long> excludedCreatureIds = new LinkedHashSet<>();
    private List<EncounterLock> lockedCreatures = List.of();

    public EncounterInteractor(encounterAPI encounters, creaturesAPI creatures, EncounterModel model) {
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.model = Objects.requireNonNull(model, "model");
    }

    public void initialize() {
        model.selectedAlternativeProperty().addListener((ignored, before, after) -> updateDetailText(after));
        loadFilterOptions();
        generate();
    }

    public void generate() {
        encounterAPI.GenerateResult result = encounters.generate(new EncounterGenerationRequest(
                List.copyOf(model.filterSelection().selectedTypes()),
                List.copyOf(model.filterSelection().selectedSubtypes()),
                List.copyOf(model.filterSelection().selectedBiomes()),
                EncounterDifficultyBand.valueOf(model.selectedDifficultyProperty().get()),
                5,
                List.copyOf(excludedCreatureIds),
                lockedCreatures));
        applyBudget(result.budget());
        applyAlternatives(result.encounters());
        model.statusTextProperty().set(result.message());
    }

    public void reroll() {
        generate();
    }

    public void lockSelected() {
        EncounterModel.EncounterAlternativeViewData selected = model.selectedAlternativeProperty().get();
        if (selected == null) {
            model.statusTextProperty().set("Select an encounter before locking.");
            return;
        }
        lockedCreatures = selected.creatures().stream()
                .map(creature -> new EncounterLock(creature.creatureId(), creature.quantity()))
                .toList();
        updateLockSummary();
        generate();
    }

    public void clearLocks() {
        lockedCreatures = List.of();
        updateLockSummary();
        generate();
    }

    public void excludeSelected() {
        EncounterModel.EncounterAlternativeViewData selected = model.selectedAlternativeProperty().get();
        if (selected == null) {
            model.statusTextProperty().set("Select an encounter before excluding it.");
            return;
        }
        for (EncounterModel.EncounterCreatureViewData creature : selected.creatures()) {
            excludedCreatureIds.add(creature.creatureId());
        }
        updateExcludeSummary();
        generate();
    }

    public void clearExclusions() {
        excludedCreatureIds.clear();
        updateExcludeSummary();
        generate();
    }

    private void loadFilterOptions() {
        creaturesAPI.CreatureFilterOptionsResult filterOptionsResult = creatures.loadFilterOptions();
        if (filterOptionsResult.status() != creaturesAPI.ReadStatus.SUCCESS) {
            model.statusTextProperty().set("Creature filters could not be loaded.");
            return;
        }
        model.applyFilterOptions(
                filterOptionsResult.options().types(),
                filterOptionsResult.options().subtypes(),
                filterOptionsResult.options().biomes());
    }

    private void applyBudget(@Nullable EncounterBudgetSummary budget) {
        if (budget == null || budget.partyLevels().isEmpty()) {
            model.partySummaryProperty().set("No active party.");
            model.thresholdsSummaryProperty().set("");
            model.dailyBudgetSummaryProperty().set("");
            return;
        }
        model.partySummaryProperty().set("Active party levels: "
                + budget.partyLevels().stream().map(String::valueOf).collect(Collectors.joining(", "))
                + "  |  Avg " + budget.averageLevel());
        model.thresholdsSummaryProperty().set("Thresholds  E "
                + budget.easyXp() + "  M " + budget.mediumXp()
                + "  H " + budget.hardXp() + "  D " + budget.deadlyXp());
        model.dailyBudgetSummaryProperty().set("Daily budget "
                + budget.consumedDailyXp() + "/" + budget.dailyBudgetXp()
                + " XP  |  Remaining " + budget.remainingDailyXp());
    }

    private void applyAlternatives(List<GeneratedEncounter> encounters) {
        List<EncounterModel.EncounterAlternativeViewData> alternatives = new ArrayList<>();
        for (GeneratedEncounter encounter : encounters) {
            List<EncounterModel.EncounterCreatureViewData> creatures = encounter.creatures().stream()
                    .map(creature -> new EncounterModel.EncounterCreatureViewData(
                            creature.creatureId(),
                            creature.name(),
                            creature.challengeRating(),
                            creature.xp(),
                            creature.quantity(),
                            creature.role(),
                            creature.tags()))
                    .toList();
            alternatives.add(new EncounterModel.EncounterAlternativeViewData(
                    encounter.title(),
                    encounter.achievedDifficulty().name(),
                    encounter.creatureCount(),
                    encounter.adjustedXp(),
                    creatureSummary(encounter.creatures()),
                    encounter.highlights().isEmpty() ? "" : encounter.highlights().getFirst(),
                    creatures,
                    encounter.highlights()));
        }
        model.alternatives().setAll(alternatives);
        model.resultSummaryProperty().set(alternatives.isEmpty()
                ? "No encounter suggestions available."
                : alternatives.size() + " encounter alternatives ready.");
        model.selectedAlternativeProperty().set(alternatives.isEmpty() ? null : alternatives.getFirst());
        updateDetailText(model.selectedAlternativeProperty().get());
        updateLockSummary();
        updateExcludeSummary();
    }

    private void updateLockSummary() {
        if (lockedCreatures.isEmpty()) {
            model.lockSummaryProperty().set("Locked: none");
            return;
        }
        String summary = lockedCreatures.stream()
                .map(lock -> lock.quantity() + "x #" + lock.creatureId())
                .collect(Collectors.joining(", "));
        model.lockSummaryProperty().set("Locked: " + summary);
    }

    private void updateExcludeSummary() {
        if (excludedCreatureIds.isEmpty()) {
            model.excludeSummaryProperty().set("Excluded: none");
            return;
        }
        model.excludeSummaryProperty().set("Excluded creature ids: "
                + excludedCreatureIds.stream().map(String::valueOf).collect(Collectors.joining(", ")));
    }

    private void updateDetailText(EncounterModel.EncounterAlternativeViewData selected) {
        if (selected == null) {
            model.detailTextProperty().set("Generate an encounter to inspect the composition.");
            return;
        }
        StringBuilder text = new StringBuilder();
        text.append(selected.title()).append('\n');
        text.append(selected.difficultyLabel()).append("  |  ")
                .append(selected.adjustedXp()).append(" adjusted XP  |  ")
                .append(selected.creatureCount()).append(" creatures").append('\n');
        if (!selected.highlights().isEmpty()) {
            text.append('\n').append("Highlights").append('\n');
            for (String highlight : selected.highlights()) {
                text.append("- ").append(highlight).append('\n');
            }
        }
        text.append('\n').append("Composition").append('\n');
        for (EncounterModel.EncounterCreatureViewData creature : selected.creatures()) {
            text.append("- ")
                    .append(creature.quantity()).append("x ")
                    .append(creature.name())
                    .append(" (CR ").append(creature.challengeRating())
                    .append(", ").append(creature.xp()).append(" XP, ")
                    .append(creature.role()).append(')');
            if (!creature.tags().isEmpty()) {
                text.append(" [").append(String.join(", ", creature.tags())).append(']');
            }
            text.append('\n');
        }
        model.detailTextProperty().set(text.toString());
    }

    private static String creatureSummary(List<EncounterCreature> creatures) {
        return creatures.stream()
                .map(creature -> creature.quantity() + "x " + creature.name())
                .collect(Collectors.joining(" + "));
    }
}
