package features.creatures.api;

/**
 * Public maintenance facade for creature startup repairs and maintenance tasks.
 */
public final class CreatureMaintenanceService {

    private CreatureMaintenanceService() {
        throw new AssertionError("No instances");
    }

    public static BackfillSummary backfillMissingRoles() {
        features.creatures.maintenance.CreatureRoleBackfillService.BackfillSummary summary =
                features.creatures.maintenance.CreatureRoleBackfillService.backfillMissingRoles();
        return new BackfillSummary(summary.checked(), summary.updated(), summary.failed());
    }

    public static BackfillSummary recomputeAllRoles() {
        features.creatures.maintenance.CreatureRoleBackfillService.BackfillSummary summary =
                features.creatures.maintenance.CreatureRoleBackfillService.recomputeAllRoles();
        return new BackfillSummary(summary.checked(), summary.updated(), summary.failed());
    }

    public record BackfillSummary(int checked, int updated, int failed) {}
}
