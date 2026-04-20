package src.domain.encounter.application;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.published.CreatureDetail;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.generation.value.EncounterCreatureFacts;
import src.domain.encounter.generation.value.EncounterDraft;
import src.domain.encounter.generation.value.EncounterDraftEntry;
import src.domain.encounter.generation.value.EncounterDraftMetrics;
import src.domain.encounter.generation.policy.EncounterRoleClassifier;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class AssembleEncounterResultUseCase {

    private static final int MINIMUM_BLENDED_ROLE_COUNT = 2;
    private static final int ACTION_ECONOMY_CREATURE_COUNT = 5;
    private static final int BASE_HIGHLIGHT_COUNT = 1;

    private final CreaturesApplicationService creatures;

    AssembleEncounterResultUseCase(CreaturesApplicationService creatures) {
        this.creatures = creatures;
    }

    List<EncounterGenerationUseCase.GeneratedEncounterData> assemble(List<EncounterDraft> drafts, int alternativeCount) {
        Map<Long, CreatureDetail> detailCache = new LinkedHashMap<>();
        List<EncounterGenerationUseCase.GeneratedEncounterData> encounters = new ArrayList<>();
        for (EncounterDraft draft : drafts.stream().limit(alternativeCount).toList()) {
            EncounterDraftMetrics metrics = draft.metrics();
            List<EncounterGenerationUseCase.EncounterCreatureData> creatures = new ArrayList<>();
            for (EncounterDraftEntry entry : draft.entries()) {
                CreatureDetail detail = detailCache.computeIfAbsent(entry.creatureId(), this::loadCreatureDetailOrNull);
                EncounterCreatureFacts facts = detail == null ? entry.facts() : PrepareEncounterGenerationUseCase.toFacts(detail);
                EncounterRoleClassifier.Classification classification = EncounterRoleClassifier.classify(facts);
                creatures.add(new EncounterGenerationUseCase.EncounterCreatureData(
                        entry.creatureId(),
                        entry.creatureName(),
                        entry.challengeRating(),
                        entry.xp(),
                        entry.quantity(),
                        classification.role(),
                        classification.tags()));
            }
            encounters.add(new EncounterGenerationUseCase.GeneratedEncounterData(
                    draft.title(),
                    draft.achievedDifficulty(),
                    metrics.creatureCount(),
                    metrics.totalBaseXp(),
                    metrics.adjustedXp(),
                    metrics.multiplier(),
                    highlightsFor(draft, creatures),
                    creatures));
        }
        return encounters;
    }

    private @Nullable CreatureDetail loadCreatureDetailOrNull(long creatureId) {
        CreatureDetailResult result = creatures.loadCreatureDetail(creatureId);
        if (result.status() != CreatureLookupStatus.SUCCESS) {
            return null;
        }
        return result.detail();
    }

    private static List<String> highlightsFor(
            EncounterDraft draft,
            List<EncounterGenerationUseCase.EncounterCreatureData> creatures
    ) {
        EncounterDraftMetrics metrics = draft.metrics();
        List<String> highlights = new ArrayList<>();
        highlights.add("Adjusted XP " + metrics.adjustedXp() + " vs target " + metrics.targetAdjustedXp());
        if (creatures.stream().anyMatch(creature -> "Boss".equals(creature.role()))) {
            highlights.add("Includes a boss-style anchor.");
        }
        long distinctRoles = creatures.stream().map(EncounterGenerationUseCase.EncounterCreatureData::role).distinct().count();
        if (distinctRoles >= MINIMUM_BLENDED_ROLE_COUNT) {
            highlights.add("Blends " + distinctRoles + " combat roles.");
        }
        if (metrics.creatureCount() >= ACTION_ECONOMY_CREATURE_COUNT) {
            highlights.add("Leans on action economy through numbers.");
        }
        if (highlights.size() == BASE_HIGHLIGHT_COUNT) {
            highlights.add("Compact composition that stays close to the requested band.");
        }
        return highlights;
    }
}
