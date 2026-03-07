package importer;

import database.DatabaseManager;

import java.sql.Connection;

/**
 * CLI utility to apply creature CR/XP overrides from the repo CSV.
 */
public final class CreatureOverridesTool {
    private CreatureOverridesTool() {
        throw new AssertionError("No instances");
    }

    public static void main(String[] args) throws Exception {
        DatabaseManager.setupDatabase();
        try (Connection conn = DatabaseManager.getConnection()) {
            CreatureOverridesApplier.ApplySummary summary =
                    CreatureOverridesApplier.applyFromDefaultFile(conn, true);
            System.out.println("Creature overrides checked=" + summary.checked()
                    + ", updated=" + summary.updated()
                    + ", missing=" + summary.missing()
                    + ", file=" + CreatureOverridesApplier.DEFAULT_OVERRIDES_PATH);
        }
    }
}
