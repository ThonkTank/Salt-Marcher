package importer;

import database.DatabaseManager;
import features.creaturecatalog.service.CreatureRoleBackfillService;

/**
 * CLI utility to recompute and persist tactical roles for all creatures.
 */
public final class CreatureRoleRecomputeTool {
    private CreatureRoleRecomputeTool() {
        throw new AssertionError("No instances");
    }

    public static void main(String[] args) throws Exception {
        DatabaseManager.setupDatabase();
        CreatureRoleBackfillService.BackfillSummary summary = CreatureRoleBackfillService.recomputeAllRoles();
        System.out.println("Role recompute checked=" + summary.checked()
                + ", updated=" + summary.updated()
                + ", failed=" + summary.failed());
        if (summary.failed() > 0) {
            System.exit(2);
        }
    }
}
