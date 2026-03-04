package repositories;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.BiConsumer;

import database.DatabaseManager;
import entities.Creature;

public class CreatureRepository {

    // -------------------------------------------------------------------------
    // Mapping
    // -------------------------------------------------------------------------

    private static Creature mapCreatureFields(ResultSet rs) throws SQLException {
        Creature c = new Creature();
        c.Id               = rs.getLong("id");
        c.Name             = rs.getString("name");
        c.Size             = rs.getString("size");
        c.CreatureType     = rs.getString("creature_type");
        c.Subtypes         = new ArrayList<>(); // loaded via loadSubtypes()
        c.Alignment        = rs.getString("alignment");
        c.CR               = rs.getString("cr");
        c.XP               = rs.getInt("xp");
        c.HP               = rs.getInt("hp");
        c.HitDice          = rs.getString("hit_dice");
        c.AC               = rs.getInt("ac");
        c.AcNotes          = rs.getString("ac_notes");
        c.Speed            = rs.getInt("speed");
        c.FlySpeed         = rs.getInt("fly_speed");
        c.SwimSpeed        = rs.getInt("swim_speed");
        c.ClimbSpeed       = rs.getInt("climb_speed");
        c.BurrowSpeed      = rs.getInt("burrow_speed");
        c.Str              = rs.getInt("str");
        c.Dex              = rs.getInt("dex");
        c.Con              = rs.getInt("con");
        c.Intel            = rs.getInt("intel");
        c.Wis              = rs.getInt("wis");
        c.Cha              = rs.getInt("cha");
        c.InitiativeBonus  = rs.getInt("initiative_bonus");
        c.ProficiencyBonus = rs.getInt("proficiency_bonus");
        c.SavingThrows     = rs.getString("saving_throws");
        c.Skills           = rs.getString("skills");
        c.DamageVulnerabilities = rs.getString("damage_vulnerabilities");
        c.DamageResistances     = rs.getString("damage_resistances");
        c.DamageImmunities      = rs.getString("damage_immunities");
        c.ConditionImmunities   = rs.getString("condition_immunities");
        c.Senses           = rs.getString("senses");
        c.PassivePerception= rs.getInt("passive_perception");
        c.Languages        = rs.getString("languages");
        c.LegendaryActionCount = rs.getInt("legendary_action_count");

        c.Biomes = new ArrayList<>(); // loaded via loadBiomes()

        c.Traits           = new ArrayList<>(); // loaded via loadActions()
        c.Actions          = new ArrayList<>(); // loaded via loadActions()
        c.BonusActions     = new ArrayList<>(); // loaded via loadActions()
        c.Reactions        = new ArrayList<>(); // loaded via loadActions()
        c.LegendaryActions = new ArrayList<>(); // loaded via loadActions()
        return c;
    }

    private static String placeholders(int count) {
        return String.join(",", Collections.nCopies(count, "?"));
    }

    private static void loadActions(Connection conn, List<Creature> creatures) throws SQLException {
        if (creatures.isEmpty()) return;

        Map<Long, Creature> byId = new HashMap<>();
        for (Creature c : creatures) byId.put(c.Id, c);

        String sql = "SELECT creature_id, action_type, name, description FROM creature_actions WHERE creature_id IN ("
                + placeholders(creatures.size()) + ")";

        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            int idx = 1;
            for (Creature c : creatures) ps.setLong(idx++, c.Id);
            try (ResultSet ar = ps.executeQuery()) {
                while (ar.next()) {
                    Creature c = byId.get(ar.getLong("creature_id"));
                    if (c == null) continue;
                    Creature.Action action = new Creature.Action();
                    action.Name        = ar.getString("name");
                    action.Description = ar.getString("description");
                    String type = ar.getString("action_type");
                    switch (type) {
                        case "trait":            c.Traits.add(action);           break;
                        case "bonus_action":     c.BonusActions.add(action);     break;
                        case "reaction":         c.Reactions.add(action);        break;
                        case "legendary_action": c.LegendaryActions.add(action); break;
                        default:                 c.Actions.add(action);          break;
                    }
                }
            }
        }
    }

    private static void loadBiomes(Connection conn, List<Creature> creatures) throws SQLException {
        loadStringList(conn, creatures, "creature_biomes", "biome", (c, v) -> c.Biomes.add(v));
    }

    private static void loadSubtypes(Connection conn, List<Creature> creatures) throws SQLException {
        loadStringList(conn, creatures, "creature_subtypes", "subtype", (c, v) -> c.Subtypes.add(v));
    }

    private static void loadStringList(Connection conn, List<Creature> creatures,
            String table, String valueColumn,
            java.util.function.BiConsumer<Creature, String> adder) throws SQLException {
        if (creatures.isEmpty()) return;
        Map<Long, Creature> byId = new HashMap<>();
        for (Creature c : creatures) byId.put(c.Id, c);
        String sql = "SELECT creature_id, " + valueColumn + " FROM " + table
                   + " WHERE creature_id IN (" + placeholders(creatures.size()) + ")";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            int idx = 1;
            for (Creature c : creatures) ps.setLong(idx++, c.Id);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Creature c = byId.get(rs.getLong("creature_id"));
                    if (c != null) adder.accept(c, rs.getString(valueColumn));
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // SQL constants (shared with MonsterImporter for PreparedStatement reuse)
    // -------------------------------------------------------------------------

    public static final String CREATURE_INSERT_SQL = "INSERT OR REPLACE INTO creatures("
            + "id, name, size, creature_type, subtype, alignment,"
            + "cr, xp, hp, hit_dice, ac, ac_notes,"
            + "speed, fly_speed, swim_speed, climb_speed, burrow_speed,"
            + "str, dex, con, intel, wis, cha,"
            + "initiative_bonus, proficiency_bonus,"
            + "saving_throws, skills,"
            + "damage_vulnerabilities, damage_resistances, damage_immunities, condition_immunities,"
            + "senses, passive_perception, languages, biomes, legendary_action_count"
            + ") VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

    public static final String ACTION_INSERT_SQL =
            "INSERT INTO creature_actions(creature_id, action_type, name, description) VALUES(?,?,?,?)";

    // -------------------------------------------------------------------------
    // Save
    // -------------------------------------------------------------------------

    public static void saveCreature(Creature c) {
        try (Connection conn = DatabaseManager.getConnection()) {
            conn.setAutoCommit(false);
            try {
                try (PreparedStatement ps = conn.prepareStatement(CREATURE_INSERT_SQL)) {
                    bindCreatureParams(ps, c);
                    ps.executeUpdate();
                }

                try (PreparedStatement ps = conn.prepareStatement(ACTION_INSERT_SQL)) {
                    insertAllActions(ps, c);
                    ps.executeBatch();
                }

                saveBiomes(conn, c);
                saveSubtypes(conn, c);
                conn.commit();
            } catch (SQLException e) {
                try { conn.rollback(); } catch (SQLException ignored) {}
                throw e;
            } finally {
                conn.setAutoCommit(true);  // Restore shared connection state
            }
        } catch (SQLException e) {
            System.err.println("Fehler beim Speichern von '" + c.Name + "': " + e.getMessage());
        }
    }

    /** Speichert Kreatur auf einer vorhandenen Connection (für Batch-Import). */
    public static void saveCreature(Creature c, Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(CREATURE_INSERT_SQL)) {
            bindCreatureParams(ps, c);
            ps.executeUpdate();
        }

        try (PreparedStatement ps = conn.prepareStatement(ACTION_INSERT_SQL)) {
            insertAllActions(ps, c);
            ps.executeBatch();
        }

        saveBiomes(conn, c);
        saveSubtypes(conn, c);
    }

    /** Speichert Kreatur mit vorbereiteten Statements (für Bulk-Import). */
    public static void saveCreatureBatch(Creature c, PreparedStatement creaturePs,
                                         PreparedStatement actionPs) throws SQLException {
        bindCreatureParams(creaturePs, c);
        creaturePs.executeUpdate();

        insertAllActions(actionPs, c);
        actionPs.executeBatch();
    }

    private static void bindCreatureParams(PreparedStatement ps, Creature c) throws SQLException {
        ps.clearParameters();
        ps.setLong  (1,  c.Id);
        ps.setString(2,  c.Name);
        ps.setString(3,  c.Size);
        ps.setString(4,  c.CreatureType);
        // LEGACY COLUMN: subtype column maintained for schema backward-compat, actual subtypes stored in creature_subtypes junction table
        ps.setString(5,  null);
        ps.setString(6,  c.Alignment);
        ps.setString(7,  c.CR);
        ps.setInt   (8,  c.XP);
        ps.setInt   (9,  c.HP);
        ps.setString(10, c.HitDice);
        ps.setInt   (11, c.AC);
        ps.setString(12, c.AcNotes);
        ps.setInt   (13, c.Speed);
        ps.setInt   (14, c.FlySpeed);
        ps.setInt   (15, c.SwimSpeed);
        ps.setInt   (16, c.ClimbSpeed);
        ps.setInt   (17, c.BurrowSpeed);
        ps.setInt   (18, c.Str);
        ps.setInt   (19, c.Dex);
        ps.setInt   (20, c.Con);
        ps.setInt   (21, c.Intel);
        ps.setInt   (22, c.Wis);
        ps.setInt   (23, c.Cha);
        ps.setInt   (24, c.InitiativeBonus);
        ps.setInt   (25, c.ProficiencyBonus);
        ps.setString(26, c.SavingThrows);
        ps.setString(27, c.Skills);
        ps.setString(28, c.DamageVulnerabilities);
        ps.setString(29, c.DamageResistances);
        ps.setString(30, c.DamageImmunities);
        ps.setString(31, c.ConditionImmunities);
        ps.setString(32, c.Senses);
        ps.setInt   (33, c.PassivePerception);
        ps.setString(34, c.Languages);
        // LEGACY COLUMN: biomes column maintained for schema backward-compat, actual biomes stored in creature_biomes junction table
        ps.setString(35, "");
        ps.setInt   (36, c.LegendaryActionCount);
    }

    private static void saveBiomes(Connection conn, Creature c) throws SQLException {
        saveJunctionValues(conn, "creature_biomes", "biome", c.Id, c.Biomes);
    }

    private static void saveSubtypes(Connection conn, Creature c) throws SQLException {
        saveJunctionValues(conn, "creature_subtypes", "subtype", c.Id, c.Subtypes);
    }

    private static final Set<String> ALLOWED_JUNCTIONS =
            Set.of("creature_biomes:biome", "creature_subtypes:subtype");

    private static void saveJunctionValues(Connection conn, String table, String column,
                                           Long creatureId, List<String> values) throws SQLException {
        if (!ALLOWED_JUNCTIONS.contains(table + ":" + column))
            throw new IllegalArgumentException("Invalid junction table/column: " + table + "." + column);
        try (PreparedStatement del = conn.prepareStatement(
                "DELETE FROM " + table + " WHERE creature_id = ?")) {
            del.setLong(1, creatureId);
            del.executeUpdate();
        }
        if (values != null && !values.isEmpty()) {
            try (PreparedStatement ins = conn.prepareStatement(
                    "INSERT OR IGNORE INTO " + table + "(creature_id, " + column + ") VALUES(?, ?)")) {
                for (String v : values) {
                    String trimmed = v.trim();
                    if (!trimmed.isEmpty()) {
                        ins.setLong(1, creatureId);
                        ins.setString(2, trimmed);
                        ins.addBatch();
                    }
                }
                ins.executeBatch();
            }
        }
    }

    private static void insertAllActions(PreparedStatement ps, Creature c) throws SQLException {
        insertActions(ps, c.Id, "trait",            c.Traits);
        insertActions(ps, c.Id, "action",           c.Actions);
        insertActions(ps, c.Id, "bonus_action",     c.BonusActions);
        insertActions(ps, c.Id, "reaction",         c.Reactions);
        insertActions(ps, c.Id, "legendary_action", c.LegendaryActions);
    }

    private static void insertActions(PreparedStatement ps, Long creatureId,
                                      String type, List<Creature.Action> actions) throws SQLException {
        if (actions == null) return;
        for (Creature.Action a : actions) {
            ps.setLong  (1, creatureId);
            ps.setString(2, type);
            ps.setString(3, a.Name);
            ps.setString(4, a.Description);
            ps.addBatch();
        }
    }

    // -------------------------------------------------------------------------
    // Queries (für EncounterGenerator — Signaturen unverändert)
    // -------------------------------------------------------------------------

    public static Creature getCreature(Long id) {
        String sql = "SELECT * FROM creatures WHERE id = ?";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    Creature c = mapCreatureFields(rs);
                    List<Creature> single = List.of(c);
                    loadActions(conn, single);
                    loadBiomes(conn, single);
                    loadSubtypes(conn, single);
                    return c;
                }
            }
        } catch (SQLException e) {
            System.err.println("Fehler beim Laden: " + e.getMessage());
        }
        return null;
    }

    public static List<Creature> getCreaturesByFilters(List<String> creatureTypes, int minXP, int maxXP,
                                                        List<String> biomes, List<String> subtypes) {
        List<Creature> creatures = new ArrayList<>();
        StringBuilder sql = new StringBuilder("SELECT * FROM creatures WHERE xp >= ? AND xp <= ?");
        List<Object> params = new ArrayList<>();
        params.add(minXP);
        params.add(maxXP);
        appendTypeClause(sql, params, creatureTypes);
        appendSubtypeClause(sql, params, subtypes);
        appendBiomesClause(sql, params, biomes);

        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql.toString())) {
            int idx = 1;
            for (Object p : params) {
                if (p instanceof String s) ps.setString(idx++, s);
                else if (p instanceof Integer i) ps.setInt(idx++, i);
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) creatures.add(mapCreatureFields(rs));
            }
            loadActions(conn, creatures);
            loadBiomes(conn, creatures);
            loadSubtypes(conn, creatures);
        } catch (SQLException e) {
            System.err.println("Fehler beim Laden: " + e.getMessage());
        }
        return creatures;
    }

    public static List<Creature> searchByName(String query, int limit) {
        return searchByName(query, limit, true);
    }

    public static List<Creature> searchByName(String query, int limit, boolean loadRelations) {
        List<Creature> creatures = new ArrayList<>();
        String sql = "SELECT * FROM creatures WHERE name LIKE ? COLLATE NOCASE LIMIT ?";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, "%" + query + "%");
            ps.setInt(2, limit);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) creatures.add(mapCreatureFields(rs));
            }
            if (loadRelations) {
                loadActions(conn, creatures);
                loadBiomes(conn, creatures);
                loadSubtypes(conn, creatures);
            }
        } catch (SQLException e) {
            System.err.println("Fehler bei Kreaturensuche: " + e.getMessage());
        }
        return creatures;
    }

    // -------------------------------------------------------------------------
    // CR-to-XP mapping (standard 5e SRD)
    // -------------------------------------------------------------------------

    private static final LinkedHashMap<String, Integer> CR_TO_XP = new LinkedHashMap<>();
    static {
        CR_TO_XP.put("0", 10);       CR_TO_XP.put("1/8", 25);
        CR_TO_XP.put("1/4", 50);     CR_TO_XP.put("1/2", 100);
        CR_TO_XP.put("1", 200);      CR_TO_XP.put("2", 450);
        CR_TO_XP.put("3", 700);      CR_TO_XP.put("4", 1100);
        CR_TO_XP.put("5", 1800);     CR_TO_XP.put("6", 2300);
        CR_TO_XP.put("7", 2900);     CR_TO_XP.put("8", 3900);
        CR_TO_XP.put("9", 5000);     CR_TO_XP.put("10", 5900);
        CR_TO_XP.put("11", 7200);    CR_TO_XP.put("12", 8400);
        CR_TO_XP.put("13", 10000);   CR_TO_XP.put("14", 11500);
        CR_TO_XP.put("15", 13000);   CR_TO_XP.put("16", 15000);
        CR_TO_XP.put("17", 18000);   CR_TO_XP.put("18", 20000);
        CR_TO_XP.put("19", 22000);   CR_TO_XP.put("20", 25000);
        CR_TO_XP.put("21", 33000);   CR_TO_XP.put("22", 41000);
        CR_TO_XP.put("23", 50000);   CR_TO_XP.put("24", 62000);
        CR_TO_XP.put("25", 75000);   CR_TO_XP.put("26", 90000);
        CR_TO_XP.put("27", 105000);  CR_TO_XP.put("28", 120000);
        CR_TO_XP.put("29", 135000);  CR_TO_XP.put("30", 155000);
    }

    public static List<String> getCrValues() {
        return new ArrayList<>(CR_TO_XP.keySet());
    }

    // -------------------------------------------------------------------------
    // Filtered search (for encounter builder)
    // -------------------------------------------------------------------------

    public record SearchResult(int totalCount, List<Creature> creatures) {}

    public static SearchResult searchWithFiltersAndCount(
            String nameQuery,
            String crMin, String crMax,
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments,
            String sortColumn, String sortDirection,
            int limit, int offset) {

        // Build WHERE clause once, reuse for both queries
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> params = new ArrayList<>();

        appendNameClause(where, params, nameQuery);
        appendCrRangeClause(where, params, crMin, crMax);
        appendSizeClause(where, params, sizes);
        appendTypeClause(where, params, types);
        appendSubtypeClause(where, params, subtypes);
        appendBiomesClause(where, params, biomes);
        appendAlignmentClause(where, params, alignments);

        String col = switch (sortColumn != null ? sortColumn : "name") {
            case "name" -> "name";
            case "cr", "xp"   -> "xp";  // Both CR and XP sort by the xp column value
            case "type"       -> "creature_type";
            case "size"       -> "size";
            default           -> throw new IllegalArgumentException("Invalid sort column: " + sortColumn);
        };
        String dir = "DESC".equalsIgnoreCase(sortDirection) ? "DESC" : "ASC";
        String whereStr = where.toString();

        int totalCount = 0;
        List<Creature> creatures = new ArrayList<>();

        try (Connection conn = DatabaseManager.getConnection()) {
            // Count query
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT COUNT(*) FROM creatures" + whereStr)) {
                bindParams(ps, params);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) totalCount = rs.getInt(1);
                }
            }

            // Data query
            String dataSql = "SELECT * FROM creatures" + whereStr
                    + " ORDER BY " + col + " " + dir + " LIMIT ? OFFSET ?";
            try (PreparedStatement ps = conn.prepareStatement(dataSql)) {
                int idx = bindParams(ps, params);
                ps.setInt(idx++, limit);
                ps.setInt(idx, offset);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) creatures.add(mapCreatureFields(rs));
                }
            }
        } catch (SQLException e) {
            System.err.println("Fehler bei gefilterter Suche: " + e.getMessage());
        }
        return new SearchResult(totalCount, creatures);
    }

    private static int bindParams(PreparedStatement ps, List<Object> params) throws SQLException {
        int idx = 1;
        for (Object p : params) {
            if (p instanceof String s) ps.setString(idx++, s);
            else if (p instanceof Integer i) ps.setInt(idx++, i);
        }
        return idx;
    }

    // -------------------------------------------------------------------------
    // Distinct value queries (for filter population)
    // -------------------------------------------------------------------------

    public static List<String> getDistinctTypes() {
        return getDistinctColumn("creature_type");
    }

    public static List<String> getDistinctSubtypes() {
        return getDistinctFromTable("creature_subtypes", "subtype", "Distinct-Subtypes");
    }

    public static List<String> getDistinctSizes() {
        // Basis-Groessen in fester Reihenfolge — kombinierte Werte wie "Medium or Small"
        // werden durch den LIKE-Filter korrekt abgedeckt
        return List.of("Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan");
    }

    public static List<String> getDistinctAlignments() {
        return getDistinctColumn("alignment");
    }

    public static List<String> getDistinctBiomes() {
        return getDistinctFromTable("creature_biomes", "biome", "Distinct-Biomes");
    }

    private static List<String> getDistinctFromTable(String table, String column, String errorLabel) {
        List<String> values = new ArrayList<>();
        String sql = "SELECT DISTINCT " + column + " FROM " + table + " ORDER BY " + column;
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) values.add(rs.getString(1));
        } catch (SQLException e) {
            System.err.println("Fehler bei " + errorLabel + ": " + e.getMessage());
        }
        return values;
    }

    private static final Set<String> ALLOWED_DISTINCT_COLUMNS =
            Set.of("creature_type", "alignment");

    private static List<String> getDistinctColumn(String column) {
        if (!ALLOWED_DISTINCT_COLUMNS.contains(column))
            throw new IllegalArgumentException("Invalid column: " + column);
        List<String> values = new ArrayList<>();
        String sql = "SELECT DISTINCT " + column + " FROM creatures WHERE "
                + column + " IS NOT NULL AND " + column + " != '' ORDER BY " + column;
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) values.add(rs.getString(1));
        } catch (SQLException e) {
            System.err.println("Fehler bei Distinct-Query: " + e.getMessage());
        }
        return values;
    }

    // -------------------------------------------------------------------------
    // SQL helpers for multi-select filters
    // -------------------------------------------------------------------------

    private static void appendNameClause(StringBuilder sql, List<Object> params, String nameQuery) {
        if (nameQuery == null || nameQuery.isBlank()) return;
        sql.append(" AND LOWER(name) LIKE LOWER(?)");
        params.add("%" + nameQuery.trim() + "%");
    }

    private static void appendCrRangeClause(StringBuilder sql, List<Object> params,
                                             String crMin, String crMax) {
        Integer xpMin = crMin != null ? CR_TO_XP.get(crMin) : null;
        Integer xpMax = crMax != null ? CR_TO_XP.get(crMax) : null;
        if (xpMin != null) {
            sql.append(" AND xp >= ?");
            params.add(xpMin);
        }
        if (xpMax != null) {
            sql.append(" AND xp <= ?");
            params.add(xpMax);
        }
    }

    private static void appendSizeClause(StringBuilder sql, List<Object> params, List<String> sizes) {
        if (sizes == null || sizes.isEmpty()) return;
        // LIKE-basiert, damit "Medium or Small" bei Filter "Small" matcht
        sql.append(" AND (");
        for (int i = 0; i < sizes.size(); i++) {
            if (i > 0) sql.append(" OR ");
            sql.append("LOWER(size) LIKE LOWER(?)");
        }
        sql.append(")");
        for (String s : sizes) params.add("%" + s + "%");
    }

    private static final Set<String> ALLOWED_IN_CLAUSE_COLUMNS =
            Set.of("creature_type", "alignment", "size");

    private static void appendLowerInClause(StringBuilder sql, List<Object> params,
                                               String column, List<String> values) {
        if (values == null || values.isEmpty()) return;
        if (!ALLOWED_IN_CLAUSE_COLUMNS.contains(column))
            throw new IllegalArgumentException("Invalid column for IN clause: " + column);
        sql.append(" AND LOWER(").append(column).append(") IN (");
        sql.append(String.join(", ", Collections.nCopies(values.size(), "LOWER(?)")));
        sql.append(")");
        params.addAll(values);
    }

    private static void appendAlignmentClause(StringBuilder sql, List<Object> params, List<String> alignments) {
        appendLowerInClause(sql, params, "alignment", alignments);
    }

    private static void appendTypeClause(StringBuilder sql, List<Object> params, List<String> types) {
        appendLowerInClause(sql, params, "creature_type", types);
    }

    private static void appendSubtypeClause(StringBuilder sql, List<Object> params, List<String> subtypes) {
        if (subtypes == null || subtypes.isEmpty()) return;
        sql.append(" AND id IN (SELECT creature_id FROM creature_subtypes WHERE LOWER(subtype) IN (");
        sql.append(String.join(", ", Collections.nCopies(subtypes.size(), "LOWER(?)")));
        sql.append("))");
        params.addAll(subtypes);
    }

    private static void appendBiomesClause(StringBuilder sql, List<Object> params, List<String> biomes) {
        if (biomes == null || biomes.isEmpty()) return;
        sql.append(" AND id IN (SELECT creature_id FROM creature_biomes WHERE biome IN (");
        sql.append(placeholders(biomes.size()));
        sql.append("))");
        params.addAll(biomes);
    }
}
