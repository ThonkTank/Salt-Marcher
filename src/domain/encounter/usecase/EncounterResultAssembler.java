package src.domain.encounter.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.api.CreatureDetail;
import src.domain.creatures.creaturesAPI;
import src.domain.encounter.api.EncounterCreature;
import src.domain.encounter.api.GeneratedEncounter;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class EncounterResultAssembler {

    private final creaturesAPI creatures;

    EncounterResultAssembler(creaturesAPI creatures) {
        this.creatures = creatures;
    }

    List<GeneratedEncounter> assemble(List<EncounterDraft> drafts, int alternativeCount) {
        Map<Long, CreatureDetail> detailCache = new LinkedHashMap<>();
        List<GeneratedEncounter> encounters = new ArrayList<>();
        for (EncounterDraft draft : drafts.stream().limit(alternativeCount).toList()) {
            List<EncounterCreature> creatures = new ArrayList<>();
            for (EncounterDraftEntry entry : draft.entries()) {
                CreatureDetail detail = detailCache.computeIfAbsent(entry.profile().id(), this::loadCreatureDetailOrNull);
                EncounterRoleClassifier.Classification classification = EncounterRoleClassifier.classify(entry.profile().toCandidate(), detail);
                creatures.add(new EncounterCreature(
                        entry.profile().id(),
                        entry.profile().name(),
                        entry.profile().challengeRating(),
                        entry.profile().xp(),
                        entry.quantity(),
                        classification.role(),
                        classification.tags()));
            }
            encounters.add(new GeneratedEncounter(
                    draft.title(),
                    draft.achievedDifficulty(),
                    draft.creatureCount(),
                    draft.totalBaseXp(),
                    draft.adjustedXp(),
                    draft.multiplier(),
                    highlightsFor(draft, creatures),
                    creatures));
        }
        return encounters;
    }

    private @Nullable CreatureDetail loadCreatureDetailOrNull(long creatureId) {
        creaturesAPI.CreatureDetailResult result = creatures.loadCreatureDetail(creatureId);
        if (result.status() != creaturesAPI.LookupStatus.SUCCESS) {
            return null;
        }
        return result.detail();
    }

    private static List<String> highlightsFor(EncounterDraft draft, List<EncounterCreature> creatures) {
        List<String> highlights = new ArrayList<>();
        highlights.add("Adjusted XP " + draft.adjustedXp() + " vs target " + draft.targetAdjustedXp());
        if (creatures.stream().anyMatch(creature -> "Boss".equals(creature.role()))) {
            highlights.add("Includes a boss-style anchor.");
        }
        long distinctRoles = creatures.stream().map(EncounterCreature::role).distinct().count();
        if (distinctRoles >= 2) {
            highlights.add("Blends " + distinctRoles + " combat roles.");
        }
        if (draft.creatureCount() >= 5) {
            highlights.add("Leans on action economy through numbers.");
        }
        if (highlights.size() == 1) {
            highlights.add("Compact composition that stays close to the requested band.");
        }
        return highlights;
    }
}
