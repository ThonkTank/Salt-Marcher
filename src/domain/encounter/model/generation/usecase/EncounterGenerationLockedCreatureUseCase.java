package src.domain.encounter.model.generation.usecase;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import src.domain.encounter.model.generation.EncounterCandidateProfile;
import src.domain.encounter.model.generation.EncounterGenerationRequest;
import src.domain.encounter.model.plan.EncounterPlanCreature;
import src.domain.encounter.model.reference.EncounterCreatureReference;
import src.domain.encounter.model.reference.port.ApplicationEncounterCreatureCatalogPort;
import src.domain.encounter.model.reference.repository.EncounterCreatureRepository;

final class EncounterGenerationLockedCreatureUseCase {

    private EncounterGenerationLockedCreatureUseCase() {
    }

    static LockedCreatures loadLockedCreatures(
            EncounterCreatureRepository creatures,
            ApplicationEncounterCreatureCatalogPort creatureCatalog,
            EncounterGenerationRequest request
    ) {
        Map<Long, Integer> lockedQuantities = toLockedQuantityMap(request.lockedCreatures());
        Map<Long, EncounterCandidateProfile> lockedProfiles =
                loadLockedProfiles(creatures, creatureCatalog, lockedQuantities);
        if (lockedProfiles.size() != lockedQuantities.size()) {
            return LockedCreatures.failure("A locked creature could not be loaded.");
        }
        return LockedCreatures.success(lockedQuantities, lockedProfiles);
    }

    private static Map<Long, Integer> toLockedQuantityMap(List<EncounterPlanCreature> locks) {
        Map<Long, Integer> quantities = new LinkedHashMap<>();
        for (EncounterPlanCreature lock : locks) {
            if (lock == null || lock.creatureId() <= 0) {
                continue;
            }
            long creatureId = lock.creatureId();
            int quantity = Math.max(1, lock.quantity());
            Integer previousQuantity = quantities.get(creatureId);
            quantities.put(creatureId, previousQuantity == null ? quantity : previousQuantity + quantity);
        }
        return quantities;
    }

    private static Map<Long, EncounterCandidateProfile> loadLockedProfiles(
            EncounterCreatureRepository creatures,
            ApplicationEncounterCreatureCatalogPort creatureCatalog,
            Map<Long, Integer> lockedQuantities
    ) {
        Map<Long, EncounterCandidateProfile> profiles = new LinkedHashMap<>();
        for (Long creatureId : lockedQuantities.keySet()) {
            creatures.requestCreature(creatureId);
            Optional<EncounterCreatureReference> reference = creatureCatalog.loadCreature();
            if (reference.isPresent()) {
                profiles.put(creatureId, EncounterCandidateProfile.fromFacts(reference.orElseThrow().toFacts()));
            }
        }
        return profiles;
    }

    record LockedCreatures(
            boolean success,
            Map<Long, Integer> lockedQuantities,
            Map<Long, EncounterCandidateProfile> lockedProfiles,
            String message
    ) {

        EncounterGenerationPreparationUseCase failure() {
            return EncounterGenerationPreparationUseCase.failure(message);
        }

        private static LockedCreatures success(
                Map<Long, Integer> lockedQuantities,
                Map<Long, EncounterCandidateProfile> lockedProfiles
        ) {
            return new LockedCreatures(true, lockedQuantities, lockedProfiles, "");
        }

        private static LockedCreatures failure(String message) {
            return new LockedCreatures(false, Map.of(), Map.of(), message);
        }
    }
}
