package src.domain.encounter.application;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.helper.EncounterRoleClassificationHelper;
import src.domain.encounter.model.generation.model.EncounterCreatureFacts;
import src.domain.encounter.model.generation.model.EncounterDraft;
import src.domain.encounter.model.generation.model.EncounterDraftEntry;
import src.domain.encounter.model.generation.model.EncounterDraftMetrics;
import src.domain.encounter.model.generation.model.GeneratedEncounterCreatureData;
import src.domain.encounter.model.reference.repository.EncounterCreatureRepository;
import src.domain.encounter.model.reference.model.EncounterCreatureReference;

final class AssembleEncounterResultUseCase {

    private final EncounterCreatureRepository creatures;

    AssembleEncounterResultUseCase(EncounterCreatureRepository creatures) {
        this.creatures = creatures;
    }

    List<EncounterGenerationUseCase.GeneratedAlternative> assemble(List<EncounterDraft> drafts, int alternativeCount) {
        Map<Long, EncounterCreatureReference> detailCache = new LinkedHashMap<>();
        List<EncounterGenerationUseCase.GeneratedAlternative> encounters = new ArrayList<>();
        for (EncounterDraft draft : drafts.stream().limit(alternativeCount).toList()) {
            EncounterDraftMetrics metrics = draft.metrics();
            List<GeneratedEncounterCreatureData> creatures = new ArrayList<>();
            for (EncounterDraftEntry entry : draft.entries()) {
                EncounterCreatureReference detail = detailCache.computeIfAbsent(entry.creatureId(), this::loadCreatureDetailOrNull);
                EncounterCreatureFacts facts = detail == null ? entry.facts() : detail.toFacts();
                EncounterRoleClassificationHelper.Classification classification = EncounterRoleClassificationHelper.classify(facts);
                creatures.add(new GeneratedEncounterCreatureData(
                        entry.creatureId(),
                        entry.creatureName(),
                        entry.challengeRating(),
                        entry.xp(),
                        entry.quantity(),
                        classification.role(),
                        classification.tags()));
            }
            encounters.add(new EncounterGenerationUseCase.GeneratedAlternative(
                    draft.title(),
                    draft.achievedDifficulty(),
                    metrics.adjustedXp(),
                    creatures));
        }
        return encounters;
    }

    private @Nullable EncounterCreatureReference loadCreatureDetailOrNull(long creatureId) {
        return creatures.loadCreature(creatureId).orElse(null);
    }
}
