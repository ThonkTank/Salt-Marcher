package src.domain.encounter.application;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.generation.policy.EncounterRoleClassifier;
import src.domain.encounter.generation.value.EncounterCreatureFacts;
import src.domain.encounter.generation.value.EncounterDraft;
import src.domain.encounter.generation.value.EncounterDraftEntry;
import src.domain.encounter.generation.value.EncounterDraftMetrics;
import src.domain.encounter.reference.port.EncounterCreatureLookup;
import src.domain.encounter.reference.value.EncounterCreatureReference;

final class AssembleEncounterResultUseCase {

    private final EncounterCreatureLookup creatures;

    AssembleEncounterResultUseCase(EncounterCreatureLookup creatures) {
        this.creatures = creatures;
    }

    List<EncounterGenerationUseCase.GeneratedAlternative> assemble(List<EncounterDraft> drafts, int alternativeCount) {
        Map<Long, EncounterCreatureReference> detailCache = new LinkedHashMap<>();
        List<EncounterGenerationUseCase.GeneratedAlternative> encounters = new ArrayList<>();
        for (EncounterDraft draft : drafts.stream().limit(alternativeCount).toList()) {
            EncounterDraftMetrics metrics = draft.metrics();
            List<EncounterGenerationUseCase.GeneratedCreature> creatures = new ArrayList<>();
            for (EncounterDraftEntry entry : draft.entries()) {
                EncounterCreatureReference detail = detailCache.computeIfAbsent(entry.creatureId(), this::loadCreatureDetailOrNull);
                EncounterCreatureFacts facts = detail == null ? entry.facts() : detail.toFacts();
                EncounterRoleClassifier.Classification classification = EncounterRoleClassifier.classify(facts);
                creatures.add(new EncounterGenerationUseCase.GeneratedCreature(
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
