package features.encounter.api;

import java.util.LinkedHashSet;
import java.util.List;

public record GeneratedEncounterPlanSummaryBatchQuery(List<Long> planIds) {
    public GeneratedEncounterPlanSummaryBatchQuery {
        planIds = planIds == null ? List.of() : List.copyOf(planIds);
        if (planIds.isEmpty() || planIds.stream().anyMatch(id -> id == null || id.longValue() <= 0L)
                || new LinkedHashSet<>(planIds).size() != planIds.size()) {
            throw new IllegalArgumentException("planIds must be positive and unique");
        }
    }

    @Override
    public List<Long> planIds() {
        return List.copyOf(planIds);
    }
}
