package features.encounter.application;

import java.util.List;
import java.util.Optional;
import features.encounter.api.GeneratedEncounterPlanSource;
import features.encounter.domain.plan.EncounterPlanCreature;

public interface GeneratedEncounterPlanBatchRepository {

    Optional<StoredBatch> loadGeneratedBatch(GeneratedEncounterPlanSource source);

    StoredBatch saveGeneratedBatch(
            GeneratedEncounterPlanSource source,
            String batchFingerprint,
            List<ResolvedPlan> plans
    );

    record ResolvedPlan(
            int encounterNumber,
            String displayLabel,
            String specFingerprint,
            List<EncounterPlanCreature> creatures
    ) {

        public ResolvedPlan {
            if (encounterNumber <= 0) {
                throw new IllegalArgumentException("encounterNumber must be positive");
            }
            displayLabel = displayLabel == null ? "" : displayLabel.trim();
            specFingerprint = requireFingerprint(specFingerprint);
            creatures = creatures == null ? List.of() : List.copyOf(creatures);
            if (creatures.isEmpty()) {
                throw new IllegalArgumentException("Resolved encounter needs at least one creature");
            }
        }

        @Override
        public List<EncounterPlanCreature> creatures() {
            return List.copyOf(creatures);
        }
    }

    record StoredMapping(int encounterNumber, long planId, String specFingerprint) {

        public StoredMapping {
            if (encounterNumber <= 0 || planId <= 0) {
                throw new IllegalArgumentException("Stored generated encounter identity must be positive");
            }
            specFingerprint = requireFingerprint(specFingerprint);
        }
    }

    record StoredBatch(
            String batchFingerprint,
            int declaredEncounterCount,
            List<StoredMapping> mappings
    ) {

        public StoredBatch {
            batchFingerprint = requireFingerprint(batchFingerprint);
            if (declaredEncounterCount <= 0) {
                throw new IllegalArgumentException("declaredEncounterCount must be positive");
            }
            mappings = mappings == null ? List.of() : List.copyOf(mappings);
        }

        @Override
        public List<StoredMapping> mappings() {
            return List.copyOf(mappings);
        }
    }

    private static String requireFingerprint(String value) {
        String fingerprint = value == null ? "" : value.trim();
        if (fingerprint.isEmpty()) {
            throw new IllegalArgumentException("specFingerprint must not be blank");
        }
        return fingerprint;
    }
}
