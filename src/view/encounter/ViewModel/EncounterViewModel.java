package src.view.encounter.ViewModel;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.api.CreatureFilterOptionsResult;
import src.domain.creatures.api.CreatureReadStatus;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.api.EncounterBudgetSummary;
import src.domain.encounter.api.EncounterCreature;
import src.domain.encounter.api.EncounterDifficultyBand;
import src.domain.encounter.api.EncounterGenerationResult;
import src.domain.encounter.api.EncounterGenerationRequest;
import src.domain.encounter.api.EncounterLock;
import src.domain.encounter.api.GeneratedEncounter;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

public final class EncounterViewModel {

    private static final List<String> DIFFICULTY_OPTIONS = List.of("EASY", "MEDIUM", "HARD", "DEADLY");

    private final EncounterApplicationService encounters;
    private final CreaturesApplicationService creatures;
    private final List<Runnable> listeners = new ArrayList<>();
    private final Set<String> selectedTypes = new LinkedHashSet<>();
    private final Set<String> selectedSubtypes = new LinkedHashSet<>();
    private final Set<String> selectedBiomes = new LinkedHashSet<>();
    private final Set<Long> excludedCreatureIds = new LinkedHashSet<>();

    private String selectedDifficulty = "MEDIUM";
    private List<String> availableTypes = List.of();
    private List<String> availableSubtypes = List.of();
    private List<String> availableBiomes = List.of();
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
        if (difficulty == null || difficulty.isBlank() || Objects.equals(selectedDifficulty, difficulty)) {
            return;
        }
        selectedDifficulty = difficulty;
        publish();
    }

    public void setTypeSelected(String value, boolean selected) {
        updateSelection(selectedTypes, value, selected);
    }

    public void setSubtypeSelected(String value, boolean selected) {
        updateSelection(selectedSubtypes, value, selected);
    }

    public void setBiomeSelected(String value, boolean selected) {
        updateSelection(selectedBiomes, value, selected);
    }

    public void clearFilters() {
        selectedTypes.clear();
        selectedSubtypes.clear();
        selectedBiomes.clear();
        publish();
    }

    public void removeFilterValue(String value) {
        boolean changed = selectedTypes.remove(value);
        changed |= selectedSubtypes.remove(value);
        changed |= selectedBiomes.remove(value);
        if (changed) {
            publish();
        }
    }

    public void selectAlternative(EncounterSnapshot.@Nullable AlternativeViewData alternative) {
        if (Objects.equals(selectedAlternative, alternative)) {
            return;
        }
        selectedAlternative = alternative;
        detailText = detailText(alternative);
        publish();
    }

    public void generate() {
        EncounterGenerationResult result = encounters.generate(new EncounterGenerationRequest(
                List.copyOf(selectedTypes),
                List.copyOf(selectedSubtypes),
                List.copyOf(selectedBiomes),
                EncounterDifficultyBand.valueOf(selectedDifficulty),
                5,
                List.copyOf(excludedCreatureIds),
                lockedCreatures));
        applyBudget(result.budget());
        applyAlternatives(result.encounters());
        statusText = result.message();
        publish();
    }

    public void reroll() {
        generate();
    }

    public void lockSelected() {
        if (selectedAlternative == null) {
            statusText = "Select an encounter before locking.";
            publish();
            return;
        }
        lockedCreatures = selectedAlternative.creatures().stream()
                .map(creature -> new EncounterLock(creature.creatureId(), creature.quantity()))
                .toList();
        lockSummary = lockSummary(lockedCreatures);
        generate();
    }

    public void clearLocks() {
        lockedCreatures = List.of();
        lockSummary = lockSummary(lockedCreatures);
        generate();
    }

    public void excludeSelected() {
        if (selectedAlternative == null) {
            statusText = "Select an encounter before excluding it.";
            publish();
            return;
        }
        for (EncounterSnapshot.CreatureViewData creature : selectedAlternative.creatures()) {
            excludedCreatureIds.add(creature.creatureId());
        }
        excludeSummary = excludeSummary(excludedCreatureIds);
        generate();
    }

    public void clearExclusions() {
        excludedCreatureIds.clear();
        excludeSummary = excludeSummary(excludedCreatureIds);
        generate();
    }

    private void loadFilterOptions() {
        CreatureFilterOptionsResult filterOptionsResult = creatures.loadFilterOptions();
        if (filterOptionsResult.status() != CreatureReadStatus.SUCCESS) {
            statusText = "Creature filters could not be loaded.";
            publish();
            return;
        }
        availableTypes = filterOptionsResult.options().types();
        availableSubtypes = filterOptionsResult.options().subtypes();
        availableBiomes = filterOptionsResult.options().biomes();
        selectedTypes.retainAll(availableTypes);
        selectedSubtypes.retainAll(availableSubtypes);
        selectedBiomes.retainAll(availableBiomes);
        publish();
    }

    private void updateSelection(Set<String> values, @Nullable String value, boolean selected) {
        if (value == null || value.isBlank()) {
            return;
        }
        boolean changed;
        if (selected) {
            changed = values.add(value);
        } else {
            changed = values.remove(value);
        }
        if (changed) {
            publish();
        }
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
                : generatedEncounters.stream().map(this::toAlternative).toList();
        resultSummary = alternatives.isEmpty()
                ? "No encounter suggestions available."
                : alternatives.size() + " encounter alternatives ready.";
        selectedAlternative = alternatives.isEmpty() ? null : alternatives.getFirst();
        detailText = detailText(selectedAlternative);
    }

    private EncounterSnapshot.AlternativeViewData toAlternative(GeneratedEncounter encounter) {
        List<EncounterSnapshot.CreatureViewData> creaturesViewData = encounter.creatures().stream()
                .map(this::toCreature)
                .toList();
        return new EncounterSnapshot.AlternativeViewData(
                encounter.title(),
                encounter.achievedDifficulty().name(),
                encounter.creatureCount(),
                encounter.adjustedXp(),
                creatureSummary(encounter.creatures()),
                encounter.highlights().isEmpty() ? "" : encounter.highlights().getFirst(),
                creaturesViewData,
                encounter.highlights());
    }

    private EncounterSnapshot.CreatureViewData toCreature(EncounterCreature creature) {
        return new EncounterSnapshot.CreatureViewData(
                creature.creatureId(),
                creature.name(),
                creature.challengeRating(),
                creature.xp(),
                creature.quantity(),
                creature.role(),
                creature.tags());
    }

    private void publish() {
        snapshot = new EncounterSnapshot(
                DIFFICULTY_OPTIONS,
                selectedDifficulty,
                new EncounterSnapshot.FilterOptionsViewData(availableTypes, availableSubtypes, availableBiomes),
                new EncounterSnapshot.FilterSelectionViewData(
                        List.copyOf(selectedTypes),
                        List.copyOf(selectedSubtypes),
                        List.copyOf(selectedBiomes)),
                alternatives,
                selectedAlternative,
                new EncounterSnapshot.TextViewData(
                        partySummary,
                        thresholdsSummary,
                        dailyBudgetSummary,
                        lockSummary,
                        excludeSummary,
                        statusText,
                        resultSummary,
                        detailText),
                selectedAlternative != null,
                selectedAlternative != null);
        for (Runnable listener : List.copyOf(listeners)) {
            listener.run();
        }
    }

    private static String lockSummary(List<EncounterLock> lockedCreatures) {
        if (lockedCreatures.isEmpty()) {
            return "Locked: none";
        }
        String summary = lockedCreatures.stream()
                .map(lock -> lock.quantity() + "x #" + lock.creatureId())
                .collect(Collectors.joining(", "));
        return "Locked: " + summary;
    }

    private static String excludeSummary(Set<Long> excludedCreatureIds) {
        if (excludedCreatureIds.isEmpty()) {
            return "Excluded: none";
        }
        return "Excluded creature ids: "
                + excludedCreatureIds.stream().map(String::valueOf).collect(Collectors.joining(", "));
    }

    private static String creatureSummary(List<EncounterCreature> creatures) {
        return creatures.stream()
                .map(creature -> creature.quantity() + "x " + creature.name())
                .collect(Collectors.joining(" + "));
    }

    private static String detailText(EncounterSnapshot.@Nullable AlternativeViewData selected) {
        if (selected == null) {
            return "Generate an encounter to inspect the composition.";
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
        for (EncounterSnapshot.CreatureViewData creature : selected.creatures()) {
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
        return text.toString();
    }
}
