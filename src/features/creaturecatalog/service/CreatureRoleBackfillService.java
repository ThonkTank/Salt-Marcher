package features.creaturecatalog.service;

import database.DatabaseManager;
import features.creaturecatalog.model.Creature;
import features.creaturecatalog.repository.CreatureRepository;
import features.encounter.model.MonsterRole;
import features.encounter.model.MonsterRoleParser;
import features.gamerules.service.RoleClassifier;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/**
 * One-shot startup repair for legacy creatures with missing or invalid persisted roles.
 */
public final class CreatureRoleBackfillService {
    private CreatureRoleBackfillService() {}

    public record BackfillSummary(int checked, int updated, int failed) {}

    public static BackfillSummary backfillMissingRoles() {
        try (Connection conn = DatabaseManager.getConnection()) {
            List<Long> pending = collectPendingRoleIds(conn);
            if (pending.isEmpty()) return new BackfillSummary(0, 0, 0);

            boolean initialAutoCommit = conn.getAutoCommit();
            int updated = 0;
            int failed = 0;
            conn.setAutoCommit(false);
            try {
                for (Long creatureId : pending) {
                    try {
                        Creature creature = CreatureRepository.getCreature(conn, creatureId);
                        if (creature == null) {
                            failed++;
                            continue;
                        }
                        MonsterRole role = creature.CR != null
                                ? RoleClassifier.classify(creature)
                                : MonsterRole.BRUTE;
                        CreatureRepository.updateRole(conn, creatureId, role.name());
                        updated++;
                    } catch (RuntimeException | SQLException e) {
                        failed++;
                        System.err.println("CreatureRoleBackfillService: role backfill failed for id="
                                + creatureId + ": " + e.getMessage());
                    }
                }
                conn.commit();
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(initialAutoCommit);
            }
            return new BackfillSummary(pending.size(), updated, failed);
        } catch (SQLException e) {
            System.err.println("CreatureRoleBackfillService.backfillMissingRoles(): " + e.getMessage());
            return new BackfillSummary(0, 0, 1);
        }
    }

    private static List<Long> collectPendingRoleIds(Connection conn) {
        List<Long> pending = new ArrayList<>();
        for (CreatureRepository.RoleValue roleValue : CreatureRepository.getRoleValues(conn)) {
            if (MonsterRoleParser.parseOrNull(roleValue.role()) == null) {
                pending.add(roleValue.id());
            }
        }
        return pending;
    }
}
