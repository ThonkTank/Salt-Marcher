package src.view.encounter.ViewModel;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.api.CreatureFilterOptionsResult;
import src.domain.creatures.api.CreatureReadStatus;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.api.EncounterDifficultyBand;
import src.domain.encounter.api.EncounterGenerationRequest;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@SuppressWarnings("PMD.TooManyMethods")
public final class EncounterViewModel {

    private final EncounterApplicationService encounters;
    private final CreaturesApplicationService creatures;
    private final List<Runnable> listeners = new ArrayList<>();
    private final EncounterFilterState filters = new EncounterFilterState();
    private final EncounterResultState results = new EncounterResultState();

    private EncounterSnapshot snapshot = EncounterSnapshot.empty();

    public EncounterViewModel(EncounterApplicationService encounters, CreaturesApplicationService creatures) {
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.creatures = Objects.requireNonNull(creatures, "creatures");
    }

    public EncounterSnapshot snapshot() {
        return snapshot;
    }

    public void addChangeListener(Runnable listener) {
        listeners.add(Objects.requireNonNull(listener, "listener"));
    }

    public void initialize() {
        loadFilterOptions();
        generate();
    }

    public void setSelectedDifficulty(@Nullable String difficulty) {
        if (filters.setSelectedDifficulty(difficulty)) {
            publish();
        }
    }

    public void setTypeSelected(String value, boolean selected) {
        updateSelection(filters.setTypeSelected(value, selected));
    }

    public void setSubtypeSelected(String value, boolean selected) {
        updateSelection(filters.setSubtypeSelected(value, selected));
    }

    public void setBiomeSelected(String value, boolean selected) {
        updateSelection(filters.setBiomeSelected(value, selected));
    }

    public void clearFilters() {
        filters.clearFilters();
        publish();
    }

    public void removeFilterValue(String value) {
        updateSelection(filters.removeFilterValue(value));
    }

    public void selectAlternative(EncounterSnapshot.@Nullable AlternativeViewData alternative) {
        if (results.selectAlternative(alternative)) {
            publish();
        }
    }

    public void generate() {
        results.applyGenerationResult(encounters.generate(new EncounterGenerationRequest(
                filters.selectedTypes(),
                filters.selectedSubtypes(),
                filters.selectedBiomes(),
                EncounterDifficultyBand.valueOf(filters.selectedDifficulty()),
                5,
                results.excludedCreatureIds(),
                results.lockedCreatures())));
        publish();
    }

    public void reroll() {
        generate();
    }

    public void lockSelected() {
        if (results.lockSelected()) {
            generate();
            return;
        }
        publish();
    }

    public void clearLocks() {
        results.clearLocks();
        generate();
    }

    public void excludeSelected() {
        if (results.excludeSelected()) {
            generate();
            return;
        }
        publish();
    }

    public void clearExclusions() {
        results.clearExclusions();
        generate();
    }

    private void loadFilterOptions() {
        CreatureFilterOptionsResult filterOptionsResult = creatures.loadFilterOptions();
        if (filterOptionsResult.status() != CreatureReadStatus.SUCCESS) {
            results.updateStatus("Creature filters could not be loaded.");
            publish();
            return;
        }
        filters.applyOptions(filterOptionsResult.options());
        publish();
    }

    private void updateSelection(boolean changed) {
        if (changed) {
            publish();
        }
    }

    private void publish() {
        snapshot = new EncounterSnapshot(
                filters.difficultyOptions(),
                filters.selectedDifficulty(),
                filters.optionsViewData(),
                filters.selectionViewData(),
                results.alternatives(),
                results.selectedAlternative(),
                results.textViewData(),
                results.hasSelectedAlternative(),
                results.hasSelectedAlternative());
        for (Runnable listener : List.copyOf(listeners)) {
            listener.run();
        }
    }
}
