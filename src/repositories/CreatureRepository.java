package repositories;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.BiConsumer;

import database.DatabaseManager;
import entities.Creature;
import entities.ChallengeRating;

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
        c.Subtypes         = new ArrayList<>(); // populated by loadSubtypes()
        c.Alignment        = rs.getString("alignment");
        try {
            c.CR = ChallengeRating.of(rs.getString("cr"));
        } catch (IllegalArgumentException e) {
            System.err.println("CreatureRepository.mapCreatureFields(): Invalid CR: " + e.getMessage());
            c.CR = ChallengeRating.of("0");  // fallback
        }
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
        c.Role = rs.getString("role");

        c.Biomes = new ArrayList<>(); // populated by loadBiomes()

        c.Traits           = new ArrayList<>(); // populated by loadActions()
        c.Actions          = new ArrayList<>(); // populated by loadActions()
        c.BonusActions     = new ArrayList<>(); // populated by loadActions()
        c.Reactions        = new ArrayList<>(); // populated by loadActions()
        c.LegendaryActions = new ArrayList<>(); // populated by loadActions()
        return c;
    }

    private static String placeholders(int count) {
        return String.join(",", Collections.nCopies(count, "?"));
    }

    private static Map<Long, Creature> indexById(List<Creature> creatures) {
        Map<Long, Creature> byId = new HashMap<>(creatures.size() * 2);
        for (Creature c : creatures) byId.put(c.Id, c);
        return byId;
    }

    private static void loadActions(Connection conn, List<Creature> creatures) throws SQLException {
        if (creatures.isEmpty()) return;

        Map<Long, Creature> byId = indexById(creatures);

        String sql = "SELECT creature_id, action_type, name, description FROM creature_actions WHERE creature_id IN ("
                + placeholders(creatures.size()) + ")";

        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            int idx = 1;
            for (Creature c : creatures) ps.setLong(idx++, c.Id);
            try (ResultSet ar = ps.executeQuery()) {
                while (ar.next()) {
                    Creature c = byId.get(ar.getLong("creature_id"));
                    if (c == null) continue;
                    Creature.Action action = new Creature.Action(ar.getString("name"), ar.getString("description"));
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
        Map<Long, Creature> byId = indexById(creatures);
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

    // Parameter positions for bindCreatureParams / MonsterImporter:
    // 1=id, 2=name, 3=size, 4=creature_type, 5=alignment,
    // 6=cr, 7=xp, 8=hp, 9=hit_dice, 10=ac, 11=ac_notes,
    // 12=speed, 13=fly_speed, 14=swim_speed, 15=climb_speed, 16=burrow_speed,
    // 17=str, 18=dex, 19=con, 20=intel, 21=wis, 22=cha,
    // 23=initiative_bonus, 24=proficiency_bonus, 25=saving_throws, 26=skills,
    // 27=damage_vulnerabilities, 28=damage_resistances, 29=damage_immunities, 30=condition_immunities,
    // 31=senses, 32=passive_perception, 33=languages, 34=legendary_action_count, 35=role
    public static final String CREATURE_INSERT_SQL = "INSERT OR REPLACE INTO creatures("
            + "id, name, size, creature_type, alignment,"
            + "cr, xp, hp, hit_dice, ac, ac_notes,"
            + "speed, fly_speed, swim_speed, climb_speed, burrow_speed,"
            + "str, dex, con, intel, wis, cha,"
            + "initiative_bonus, proficiency_bonus,"
            + "saving_throws, skills,"
            + "damage_vulnerabilities, damage_resistances, damage_immunities, condition_immunities,"
            + "senses, passive_perception, languages, legendary_action_count, role"
            + ") VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

    public static final String ACTION_INSERT_SQL =
            "INSERT INTO creature_actions(creature_id, action_type, name, description) VALUES(?,?,?,?)";

    // -------------------------------------------------------------------------
    // Save
    // -------------------------------------------------------------------------

    /**
     * Saves a creature and its junction table rows within an open bulk-import connection.
     * Caller must have set {@code autoCommit(false)} before calling.
     */
    public static void save(Creature c, Connection conn) throws SQLException {
        try (PreparedStatement creaturePs = conn.prepareStatement(CREATURE_INSERT_SQL);
             PreparedStatement actionPs   = conn.prepareStatement(ACTION_INSERT_SQL)) {
            saveCreatureBatch(c, creaturePs, actionPs, conn);
        }
    }

    /**
     * Low-level batch step: binds and executes inserts using caller-managed statements.
     * A {@code Connection} parameter is required because saving to {@code creature_biomes} and
     * {@code creature_subtypes} needs additional statements within the same transaction.
     * Caller must have set {@code autoCommit(false)} before calling.
     */
    public static void saveCreatureBatch(Creature c, PreparedStatement creaturePs,
                                         PreparedStatement actionPs, Connection conn) throws SQLException {
        bindCreatureParams(creaturePs, c);
        creaturePs.executeUpdate();

        insertAllActions(actionPs, c);
        actionPs.executeBatch();

        saveBiomes(conn, c);
        saveSubtypes(conn, c);
    }

    private static void bindCreatureParams(PreparedStatement ps, Creature c) throws SQLException {
        ps.clearParameters();
        ps.setLong  (1,  c.Id);
        ps.setString(2,  c.Name);
        ps.setString(3,  c.Size);
        ps.setString(4,  c.CreatureType);
        ps.setString(5,  c.Alignment);
        ps.setString(6,  c.CR != null ? c.CR.display : null);
        ps.setInt   (7,  c.XP);
        ps.setInt   (8,  c.HP);
        ps.setString(9,  c.HitDice);
        ps.setInt   (10, c.AC);
        ps.setString(11, c.AcNotes);
        ps.setInt   (12, c.Speed);
        ps.setInt   (13, c.FlySpeed);
        ps.setInt   (14, c.SwimSpeed);
        ps.setInt   (15, c.ClimbSpeed);
        ps.setInt   (16, c.BurrowSpeed);
        ps.setInt   (17, c.Str);
        ps.setInt   (18, c.Dex);
        ps.setInt   (19, c.Con);
        ps.setInt   (20, c.Intel);
        ps.setInt   (21, c.Wis);
        ps.setInt   (22, c.Cha);
        ps.setInt   (23, c.InitiativeBonus);
        ps.setInt   (24, c.ProficiencyBonus);
        ps.setString(25, c.SavingThrows);
        ps.setString(26, c.Skills);
        ps.setString(27, c.DamageVulnerabilities);
        ps.setString(28, c.DamageResistances);
        ps.setString(29, c.DamageImmunities);
        ps.setString(30, c.ConditionImmunities);
        ps.setString(31, c.Senses);
        ps.setInt   (32, c.PassivePerception);
        ps.setString(33, c.Languages);
        ps.setInt   (34, c.LegendaryActionCount);
        ps.setString(35, c.Role);
    }

    private static void saveBiomes(Connection conn, Creature c) throws SQLException {
        saveJunctionValues(conn, "creature_biomes", "biome", c.Id, c.Biomes);
    }

    private static void saveSubtypes(Connection conn, Creature c) throws SQLException {
        saveJunctionValues(conn, "creature_subtypes", "subtype", c.Id, c.Subtypes);
    }

    private static final Set<String> ALLOWED_JUNCTIONS =
            Set.of("creature_biomes:biome", "creature_subtypes:subtype");

    // Internal method: table and column MUST always be literal strings, never user input.
    // The ALLOWED_JUNCTIONS whitelist is a defense-in-depth check; the SQL safety guarantee
    // depends on all callers respecting this invariant.
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

    public static Creature getCreature(long id) {
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
                    c.relationsLoaded = true;
                    return c;
                }
            }
        } catch (SQLException e) {
            System.err.println("CreatureRepository.getCreature(id=" + id + "): " + e.getMessage());
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
            bindParams(ps, params);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) creatures.add(mapCreatureFields(rs));
            }
            loadBiomes(conn, creatures);
            loadSubtypes(conn, creatures);
        } catch (SQLException e) {
            System.err.println("CreatureRepository.getCreaturesByFilters(): " + e.getMessage());
        }
        return creatures;
    }

    /**
     * Returns creatures with base stats only — {@code Biomes}, {@code Actions}, {@code Subtypes},
     * and {@code Traits} are empty lists (not null, but not loaded). Suitable for autocomplete
     * and name-only lookups. Use {@link #searchByName(String, int, boolean)} with
     * {@code loadRelations=true} for any display use case.
     */
    public static List<Creature> searchByName(String query, int limit) {
        return searchByName(query, limit, false);
    }

    /**
     * @param loadRelations if {@code false}, skips loading actions/biomes/subtypes —
     *                      useful for autocomplete or name-only lookups where full
     *                      creature data is not needed (avoids N+1 relation queries).
     *                      Pass {@code true} for any display use case.
     */
    public static List<Creature> searchByName(String query, int limit, boolean loadRelations) {
        List<Creature> creatures = new ArrayList<>();
        String sql = "SELECT * FROM creatures WHERE LOWER(name) LIKE LOWER(?) LIMIT ?";
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
                creatures.forEach(c -> c.relationsLoaded = true);
            }
        } catch (SQLException e) {
            System.err.println("CreatureRepository.searchByName(): " + e.getMessage());
        }
        return creatures;
    }

    // -------------------------------------------------------------------------
    // Filtered search (for encounter builder)
    // -------------------------------------------------------------------------

    public static int countAll() {
        try (Connection conn = DatabaseManager.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM creatures")) {
            return rs.next() ? rs.getInt(1) : 0;
        } catch (SQLException e) {
            System.err.println("CreatureRepository.countAll(): " + e.getMessage());
            return 0;
        }
    }

    public record SearchResult(int totalCount, List<Creature> creatures) {}

    public static SearchResult searchWithFiltersAndCount(
            String nameQuery,
            Integer xpMin, Integer xpMax,
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments,
            String sortColumn, String sortDirection,
            int limit, int offset) {

        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> params = new ArrayList<>();

        appendNameClause(where, params, nameQuery);
        appendXpRangeClause(where, params, xpMin, xpMax);
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

        int totalCount = 0;
        List<Creature> creatures = new ArrayList<>();

        // Single query: COUNT(*) OVER() gives total matches before LIMIT (SQLite 3.25+)
        String sql = "SELECT *, COUNT(*) OVER() AS total_count FROM creatures" + where
                + " ORDER BY " + col + " " + dir + " LIMIT ? OFFSET ?";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            int idx = bindParams(ps, params);
            ps.setInt(idx++, limit);
            ps.setInt(idx, offset);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    if (creatures.isEmpty()) totalCount = rs.getInt("total_count");
                    creatures.add(mapCreatureFields(rs));
                }
            }
        } catch (SQLException e) {
            System.err.println("CreatureRepository.searchWithFiltersAndCount(): " + e.getMessage());
        }
        return new SearchResult(totalCount, creatures);
    }

    private static int bindParams(PreparedStatement ps, List<Object> params) throws SQLException {
        int idx = 1;
        for (Object p : params) {
            if (p instanceof String s) ps.setString(idx++, s);
            else if (p instanceof Integer i) ps.setInt(idx++, i);
            else throw new IllegalArgumentException("bindParams: unsupported param type: " + p.getClass().getName());
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

    private static final Set<String> ALLOWED_DISTINCT_TABLES =
            Set.of("creature_subtypes:subtype", "creature_biomes:biome");

    private static List<String> getDistinctFromTable(String table, String column, String errorLabel) {
        if (!ALLOWED_DISTINCT_TABLES.contains(table + ":" + column))
            throw new IllegalArgumentException("Invalid table/column for distinct query: " + table + "." + column);
        List<String> values = new ArrayList<>();
        String sql = "SELECT DISTINCT " + column + " FROM " + table + " ORDER BY " + column;
        try (Connection conn = DatabaseManager.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) values.add(rs.getString(1));
        } catch (SQLException e) {
            System.err.println("CreatureRepository.getDistinctFromTable(" + errorLabel + "): " + e.getMessage());
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
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) values.add(rs.getString(1));
        } catch (SQLException e) {
            System.err.println("CreatureRepository.getDistinctColumn(" + column + "): " + e.getMessage());
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

    private static void appendXpRangeClause(StringBuilder sql, List<Object> params,
                                             Integer xpMin, Integer xpMax) {
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
        sql.append(" AND id IN (SELECT creature_id FROM creature_biomes WHERE LOWER(biome) IN (");
        sql.append(String.join(", ", Collections.nCopies(biomes.size(), "LOWER(?)")));
        sql.append("))");
        params.addAll(biomes);
    }
}
