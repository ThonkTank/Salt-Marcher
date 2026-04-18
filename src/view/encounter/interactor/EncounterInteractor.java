package src.view.encounter.interactor;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.creaturesAPI;
import src.domain.encounter.api.EncounterBudgetSummary;
import src.domain.encounter.api.EncounterCreature;
import src.domain.encounter.api.EncounterDifficultyBand;
import src.domain.encounter.api.EncounterGenerationRequest;
import src.domain.encounter.api.EncounterLock;
import src.domain.encounter.encounterAPI;
import src.view.encounter.Model.EncounterModel;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class EncounterInteractor {

    private final encounterAPI encounters;
    private final creaturesAPI creatures;
    private final EncounterModel model;
    private final EncounterModelUpdater updater;
    private final Set<Long> excludedCreatureIds = new LinkedHashSet<>();
    private List<EncounterLock> lockedCreatures = List.of();

    public EncounterInteractor(encounterAPI encounters, creaturesAPI creatures, EncounterModel model) {
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.model = Objects.requireNonNull(model, "model");
        this.updater = new EncounterModelUpdater(model);
    }

    public void initialize() {
        model.alternatives().selectedAlternativeProperty()
                .addListener((ignored, before, after) -> model.texts().detailTextProperty().set(EncounterTextFormatter.detailText(after)));
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
        updater.applyBudget(result.budget());
        updater.applyAlternatives(result.encounters());
        model.texts().statusTextProperty().set(result.message());
    }

    public void reroll() {
        generate();
    }

    public void lockSelected() {
        EncounterModel.EncounterAlternativeViewData selected = model.alternatives().selectedAlternativeProperty().get();
        if (selected == null) {
            model.texts().statusTextProperty().set("Select an encounter before locking.");
            return;
        }
        lockedCreatures = selected.creatures().stream()
                .map(creature -> new EncounterLock(creature.creatureId(), creature.quantity()))
                .toList();
        updater.updateLockSummary(lockedCreatures);
        generate();
    }

    public void clearLocks() {
        lockedCreatures = List.of();
        updater.updateLockSummary(lockedCreatures);
        generate();
    }

    public void excludeSelected() {
        EncounterModel.EncounterAlternativeViewData selected = model.alternatives().selectedAlternativeProperty().get();
        if (selected == null) {
            model.texts().statusTextProperty().set("Select an encounter before excluding it.");
            return;
        }
        for (EncounterModel.EncounterCreatureViewData creature : selected.creatures()) {
            excludedCreatureIds.add(creature.creatureId());
        }
        updater.updateExcludeSummary(excludedCreatureIds);
        generate();
    }

    public void clearExclusions() {
        excludedCreatureIds.clear();
        updater.updateExcludeSummary(excludedCreatureIds);
        generate();
    }

    private void loadFilterOptions() {
        creaturesAPI.CreatureFilterOptionsResult filterOptionsResult = creatures.loadFilterOptions();
        if (filterOptionsResult.status() != creaturesAPI.ReadStatus.SUCCESS) {
            model.texts().statusTextProperty().set("Creature filters could not be loaded.");
            return;
        }
        model.applyFilterOptions(
                filterOptionsResult.options().types(),
                filterOptionsResult.options().subtypes(),
                filterOptionsResult.options().biomes());
    }
}
