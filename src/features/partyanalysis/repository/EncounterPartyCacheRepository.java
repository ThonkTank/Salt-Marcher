package features.partyanalysis.repository;

import features.partyanalysis.model.AnalysisModelVersion;
import features.party.api.PartyApi;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HexFormat;
import java.util.List;

public final class EncounterPartyCacheRepository {
    private EncounterPartyCacheRepository() {
        throw new AssertionError("No instances");
    }

    public enum CacheStatus {
        VALID,
        INVALID,
        REBUILDING,
        ERROR
    }

    public record CacheState(
            String partyCompHash,
            int partyCompVersion,
            int analysisModelVersion,
            Long activeRunId,
            CacheStatus cacheStatus
    ) {}

    public static CacheState ensureState(Connection conn) throws SQLException {
        String hash = computeCurrentPartyHash(conn);
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT OR IGNORE INTO encounter_party_cache_state "
                        + "(id, party_comp_hash, party_comp_version, analysis_model_version, active_run_id, cache_status, updated_at) "
                        + "VALUES (1, ?, 0, ?, NULL, 'INVALID', CURRENT_TIMESTAMP)")) {
            insert.setString(1, hash);
            insert.setInt(2, AnalysisModelVersion.current());
            insert.executeUpdate();
        }
        return getState(conn);
    }

    public static CacheState getState(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT party_comp_hash, party_comp_version, analysis_model_version, active_run_id, cache_status "
                        + "FROM encounter_party_cache_state "
                        + "WHERE id = 1");
             ResultSet rs = ps.executeQuery()) {
            if (!rs.next()) {
                return ensureState(conn);
            }
            Number runIdRaw = (Number) rs.getObject("active_run_id");
            Long activeRunId = runIdRaw != null ? runIdRaw.longValue() : null;
            return new CacheState(
                    rs.getString("party_comp_hash"),
                    rs.getInt("party_comp_version"),
                    rs.getInt("analysis_model_version"),
                    activeRunId,
                    parseStatus(rs.getString("cache_status")));
        }
    }

    public static CacheState invalidateForCurrentParty(Connection conn) throws SQLException {
        CacheState state = ensureState(conn);
        String currentHash = computeCurrentPartyHash(conn);
        if (!currentHash.equals(state.partyCompHash())) {
            try (PreparedStatement update = conn.prepareStatement(
                    "UPDATE encounter_party_cache_state "
                            + "SET party_comp_hash = ?, "
                            + "party_comp_version = party_comp_version + 1, "
                            + "analysis_model_version = ?, "
                            + "active_run_id = NULL, "
                            + "cache_status = 'INVALID', "
                            + "last_error = NULL, "
                            + "updated_at = CURRENT_TIMESTAMP "
                            + "WHERE id = 1")) {
                update.setString(1, currentHash);
                update.setInt(2, AnalysisModelVersion.current());
                update.executeUpdate();
            }
            return getState(conn);
        }
        if (state.analysisModelVersion() != AnalysisModelVersion.current()) {
            try (PreparedStatement update = conn.prepareStatement(
                    "UPDATE encounter_party_cache_state "
                            + "SET analysis_model_version = ?, "
                            + "active_run_id = NULL, "
                            + "cache_status = 'INVALID', "
                            + "last_error = NULL, "
                            + "updated_at = CURRENT_TIMESTAMP "
                            + "WHERE id = 1")) {
                update.setInt(1, AnalysisModelVersion.current());
                update.executeUpdate();
            }
            return getState(conn);
        }
        return state;
    }

    public static CacheState invalidateForCreatureDataChange(Connection conn) throws SQLException {
        ensureState(conn);
        try (PreparedStatement update = conn.prepareStatement(
                "UPDATE encounter_party_cache_state "
                        + "SET party_comp_version = party_comp_version + 1, "
                        + "analysis_model_version = ?, "
                        + "active_run_id = NULL, "
                        + "cache_status = 'INVALID', "
                        + "last_error = NULL, "
                        + "updated_at = CURRENT_TIMESTAMP "
                        + "WHERE id = 1")) {
            update.setInt(1, AnalysisModelVersion.current());
            update.executeUpdate();
        }
        return getState(conn);
    }

    public static boolean markRebuilding(Connection conn, long runId, int expectedVersion, String expectedHash) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE encounter_party_cache_state "
                        + "SET active_run_id = ?, cache_status = 'REBUILDING', last_error = NULL, updated_at = CURRENT_TIMESTAMP "
                        + "WHERE id = 1 "
                        + "AND party_comp_version = ? "
                        + "AND analysis_model_version = ? "
                        + "AND party_comp_hash = ? "
                        + "AND cache_status <> 'REBUILDING'")) {
            ps.setLong(1, runId);
            ps.setInt(2, expectedVersion);
            ps.setInt(3, AnalysisModelVersion.current());
            ps.setString(4, expectedHash);
            return ps.executeUpdate() == 1;
        }
    }

    public static boolean markValid(Connection conn, long activeRunId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE encounter_party_cache_state "
                        + "SET active_run_id = ?, cache_status = 'VALID', last_error = NULL, updated_at = CURRENT_TIMESTAMP "
                        + "WHERE id = 1 AND active_run_id = ? AND cache_status = 'REBUILDING'")) {
            ps.setLong(1, activeRunId);
            ps.setLong(2, activeRunId);
            return ps.executeUpdate() == 1;
        }
    }

    public static boolean markError(Connection conn, long activeRunId, String message) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE encounter_party_cache_state "
                        + "SET active_run_id = NULL, cache_status = 'ERROR', last_error = ?, updated_at = CURRENT_TIMESTAMP "
                        + "WHERE id = 1 AND active_run_id = ?")) {
            ps.setString(1, message);
            ps.setLong(2, activeRunId);
            return ps.executeUpdate() == 1;
        }
    }

    public static String computeCurrentPartyHash(Connection conn) throws SQLException {
        List<Integer> levels = PartyApi.loadActivePartyLevelsForComposition(conn);
        StringBuilder raw = new StringBuilder();
        raw.append("party:");
        for (int i = 0; i < levels.size(); i++) {
            if (i > 0) raw.append(',');
            raw.append(levels.get(i));
        }
        return sha256(raw.toString());
    }

    private static CacheStatus parseStatus(String raw) {
        if (raw == null || raw.isBlank()) return CacheStatus.INVALID;
        try {
            return CacheStatus.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return CacheStatus.INVALID;
        }
    }

    private static String sha256(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
