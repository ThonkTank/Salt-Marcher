package features.encounter.application;

import features.encounter.api.PreparedEncounterBatch;
import features.encounter.domain.plan.EncounterPlan;
import java.util.List;

public interface GeneratedEncounterBatchRepository {

    CommitOutcome commit(PreparedEncounterBatch batch);

    List<EncounterPlan> loadPlansByIds(List<Long> planIds);

    default PlanRead loadPlansByIdsWithCount(List<Long> planIds) {
        return new PlanRead(loadPlansByIds(planIds), 0);
    }

    record PlanRead(List<EncounterPlan> plans, int statementCount) {
        public PlanRead {
            plans = plans == null ? List.of() : List.copyOf(plans);
            if (statementCount < 0) {
                throw new IllegalArgumentException("statementCount must be nonnegative");
            }
        }
    }

    record CommitOutcome(Status status, List<Mapping> mappings) {
        public enum Status { COMMITTED, EQUAL_RETRY, CONFLICT }

        public CommitOutcome {
            if (status == null) {
                throw new IllegalArgumentException("status is required");
            }
            mappings = mappings == null ? List.of() : List.copyOf(mappings);
            if (status != Status.CONFLICT && mappings.isEmpty()) {
                throw new IllegalArgumentException("successful commit outcome requires mappings");
            }
            if (status == Status.CONFLICT && !mappings.isEmpty()) {
                throw new IllegalArgumentException("conflict must not expose mappings");
            }
        }

        @Override
        public List<Mapping> mappings() {
            return List.copyOf(mappings);
        }
    }

    record Mapping(int encounterNumber, long planId) {
        public Mapping {
            if (encounterNumber <= 0 || planId <= 0L) {
                throw new IllegalArgumentException("mapping identities must be positive");
            }
        }
    }
}
