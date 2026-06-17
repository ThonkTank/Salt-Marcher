package src.domain.party.model.roster.usecase;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.party.model.roster.PartyAdventuringDayCalculation;
import src.domain.party.model.roster.PartyAdventuringDayPlan;
import src.domain.party.model.roster.PartyCharacterProgress;
import src.domain.party.model.roster.helper.AdventuringDayProgressCalculationHelper;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;

public final class CalculateAdventuringDayUseCase {

    private final @Nullable PartyPublishedStateRepository publishedStateRepository;
    private final AdventuringDayProgressCalculationHelper progress =
            new AdventuringDayProgressCalculationHelper();

    public CalculateAdventuringDayUseCase() {
        this.publishedStateRepository = null;
    }

    public CalculateAdventuringDayUseCase(PartyPublishedStateRepository publishedStateRepository) {
        this.publishedStateRepository = java.util.Objects.requireNonNull(
                publishedStateRepository,
                "publishedStateRepository");
    }

    public void publish(List<Integer> levels, int totalGroupXp) {
        if (publishedStateRepository == null) {
            throw new IllegalStateException("publishedStateRepository");
        }
        PartyPublishedStateRepository publisher = publishedStateRepository;
        publisher.publishAdventuringDayCalculation(
                new PartyPublishedStateRepository.AdventuringDayCalculationPublication(levels, totalGroupXp));
    }

    public PartyAdventuringDayCalculation execute(List<Integer> levels, int totalGroupXp) {
        List<Integer> normalizedLevels = normalizeLevels(levels);
        return new PartyAdventuringDayCalculation(
                computeBudget(normalizedLevels),
                progress.compute(normalizedLevels, Math.max(0, totalGroupXp)));
    }

    private static PartyAdventuringDayPlan computeBudget(List<Integer> levels) {
        return PartyAdventuringDayPlan.forLevels(levels);
    }

    private static List<Integer> normalizeLevels(List<Integer> levels) {
        if (levels == null || levels.isEmpty()) {
            return List.of();
        }
        List<Integer> normalized = new ArrayList<>();
        for (Integer level : levels) {
            if (level != null) {
                normalized.add(PartyCharacterProgress.clampLevel(level));
            }
        }
        return List.copyOf(normalized);
    }

}
