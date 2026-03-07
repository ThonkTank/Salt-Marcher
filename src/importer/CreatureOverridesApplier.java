package importer;

import features.creaturecatalog.model.ChallengeRating;
import features.creaturecatalog.model.Creature;
import features.creaturecatalog.repository.CreatureRepository;
import features.gamerules.model.MonsterRole;
import features.gamerules.service.RoleClassifier;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/**
 * Applies deterministic creature field overrides from a versioned CSV file.
 */
public final class CreatureOverridesApplier {
    public static final Path DEFAULT_OVERRIDES_PATH = Path.of("data", "creature_overrides.csv");

    private CreatureOverridesApplier() {
        throw new AssertionError("No instances");
    }

    public record ApplySummary(int checked, int updated, int missing) {}

    private record OverrideRow(String sourceSlug, String crOverride, int xpOverride, String reason) {}

    public static ApplySummary applyFromDefaultFile(Connection conn, boolean failOnMissing) throws SQLException, IOException {
        return applyFromFile(conn, DEFAULT_OVERRIDES_PATH, failOnMissing);
    }

    public static ApplySummary applyFromFile(Connection conn, Path csvPath, boolean failOnMissing)
            throws SQLException, IOException {
        List<OverrideRow> rows = readOverrides(csvPath);
        if (rows.isEmpty()) return new ApplySummary(0, 0, 0);

        int missing = 0;
        int updated = 0;

        boolean initialAutoCommit = conn.getAutoCommit();
        conn.setAutoCommit(false);
        try {
            for (OverrideRow row : rows) {
                Long creatureId = queryCreatureIdBySourceSlug(conn, row.sourceSlug());
                if (creatureId == null) {
                    missing++;
                    continue;
                }
                applyCrAndXp(conn, creatureId, row);
                Creature refreshed = CreatureRepository.getCreature(conn, creatureId);
                if (refreshed == null) {
                    throw new SQLException("Creature missing after override apply: id=" + creatureId);
                }
                MonsterRole role = refreshed.CR != null
                        ? RoleClassifier.classify(refreshed)
                        : MonsterRole.BRUTE;
                CreatureRepository.updateRole(conn, creatureId, role.name());
                updated++;
            }
            if (missing > 0 && failOnMissing) {
                conn.rollback();
                throw new SQLException("Creature override(s) reference missing source_slug entries: " + missing);
            }
            conn.commit();
        } catch (SQLException e) {
            conn.rollback();
            throw e;
        } finally {
            conn.setAutoCommit(initialAutoCommit);
        }

        return new ApplySummary(rows.size(), updated, missing);
    }

    private static List<OverrideRow> readOverrides(Path csvPath) throws IOException {
        if (!Files.exists(csvPath)) return List.of();

        List<String> lines = Files.readAllLines(csvPath);
        List<OverrideRow> rows = new ArrayList<>();
        for (int i = 0; i < lines.size(); i++) {
            String raw = lines.get(i);
            if (raw == null) continue;
            String line = raw.trim();
            if (line.isEmpty() || line.startsWith("#")) continue;
            if (i == 0 && line.toLowerCase().startsWith("source_slug,")) continue;

            List<String> parts;
            try {
                parts = parseCsvLine(raw);
            } catch (IllegalArgumentException e) {
                throw new IOException("Invalid CSV quoting at line " + (i + 1) + ": " + raw, e);
            }
            if (parts.size() < 3) {
                throw new IOException("Invalid override row at line " + (i + 1) + ": " + raw);
            }
            String sourceSlug = parts.get(0).trim();
            String cr = parts.get(1).trim();
            String xpRaw = parts.get(2).trim();
            String reason = parts.size() >= 4 ? parts.get(3).trim() : "";

            if (sourceSlug.isEmpty()) {
                throw new IOException("Override row has blank source_slug at line " + (i + 1));
            }
            ChallengeRating.of(cr); // validates supported CR shape
            int xp;
            try {
                xp = Integer.parseInt(xpRaw);
            } catch (NumberFormatException e) {
                throw new IOException("Invalid xp_override at line " + (i + 1) + ": " + xpRaw, e);
            }
            if (xp < 0) {
                throw new IOException("xp_override must be >= 0 at line " + (i + 1) + ": " + xp);
            }

            rows.add(new OverrideRow(sourceSlug, cr, xp, reason));
        }
        return rows;
    }

    private static void applyCrAndXp(Connection conn, Long creatureId, OverrideRow row) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE creatures SET cr = ?, xp = ? WHERE id = ?")) {
            ps.setString(1, row.crOverride());
            ps.setInt(2, row.xpOverride());
            ps.setLong(3, creatureId);
            ps.executeUpdate();
        }
    }

    private static Long queryCreatureIdBySourceSlug(Connection conn, String sourceSlug) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("SELECT id FROM creatures WHERE source_slug = ?")) {
            ps.setString(1, sourceSlug);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getLong("id");
            }
        }
        return null;
    }

    private static List<String> parseCsvLine(String line) {
        List<String> out = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cell.append('"');
                    i++;
                    continue;
                }
                inQuotes = !inQuotes;
                continue;
            }
            if (ch == ',' && !inQuotes) {
                out.add(cell.toString());
                cell.setLength(0);
                continue;
            }
            cell.append(ch);
        }
        if (inQuotes) {
            throw new IllegalArgumentException("Unclosed quote in CSV line: " + line);
        }
        out.add(cell.toString());
        return out;
    }
}
