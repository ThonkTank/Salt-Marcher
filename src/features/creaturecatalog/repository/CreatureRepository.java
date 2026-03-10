package features.creaturecatalog.repository;

import features.creaturecatalog.model.Creature;
import features.encounter.service.analysis.CreatureStaticAnalysisService;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class CreatureRepository {
    private static final int IN_CLAUSE_BATCH_SIZE = 400;

    private CreatureRepository() {
        throw new AssertionError("No instances");
    }

    public record RoleValue(Long id, String role) {}

    private static String placeholders(int count) {
        return String.join(",", Collections.nCopies(count, "?"));
    }

    private static Map<Long, Creature> indexById(List<Creature> creatures) {
        Map<Long, Creature> byId = new HashMap<>(creatures.size() * 2);
        for (Creature c : creatures) byId.put(c.Id, c);
        return byId;
    }

    static void loadActions(Connection conn, List<Creature> creatures) throws SQLException {
        if (creatures.isEmpty()) return;

        Map<Long, Creature> byId = indexById(creatures);

        for (int start = 0; start < creatures.size(); start += IN_CLAUSE_BATCH_SIZE) {
            int end = Math.min(start + IN_CLAUSE_BATCH_SIZE, creatures.size());
            List<Creature> batch = creatures.subList(start, end);
            String sql = "SELECT creature_id, action_type, name, description, to_hit_bonus FROM creature_actions WHERE creature_id IN ("
                    + placeholders(batch.size()) + ")";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                int idx = 1;
                for (Creature c : batch) ps.setLong(idx++, c.Id);
                try (ResultSet ar = ps.executeQuery()) {
                    while (ar.next()) {
                        Creature c = byId.get(ar.getLong("creature_id"));
                        if (c == null) continue;
                        Number toHitRaw = (Number) ar.getObject("to_hit_bonus");
                        Integer toHitBonus = toHitRaw != null ? toHitRaw.intValue() : null;
                        Creature.Action action = new Creature.Action(
                                ar.getString("name"),
                                ar.getString("description"),
                                toHitBonus);
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
    }

    // -------------------------------------------------------------------------
    // SQL constants (shared with MonsterImporter for PreparedStatement reuse)
    // -------------------------------------------------------------------------

    // Parameter positions for bindCreatureParams / MonsterImporter:
    // 1=id, 2=name, 3=size, 4=creature_type, 5=alignment,
    // 6=cr, 7=xp, 8=hp, 9=hit_dice, 10=hit_dice_count, 11=hit_dice_sides, 12=hit_dice_modifier,
    // 13=ac, 14=ac_notes, 15=speed, 16=fly_speed, 17=swim_speed, 18=climb_speed, 19=burrow_speed,
    // 20=str, 21=dex, 22=con, 23=intel, 24=wis, 25=cha,
    // 26=initiative_bonus, 27=proficiency_bonus, 28=saving_throws, 29=skills,
    // 30=damage_vulnerabilities, 31=damage_resistances, 32=damage_immunities, 33=condition_immunities,
    // 34=senses, 35=passive_perception, 36=languages, 37=legendary_action_count,
    // 38=role, 39=source_slug, 40=slug_key
    public static final String CREATURE_INSERT_SQL = "INSERT INTO creatures("
            + "id, name, size, creature_type, alignment,"
            + "cr, xp, hp, hit_dice, hit_dice_count, hit_dice_sides, hit_dice_modifier, ac, ac_notes,"
            + "speed, fly_speed, swim_speed, climb_speed, burrow_speed,"
            + "str, dex, con, intel, wis, cha,"
            + "initiative_bonus, proficiency_bonus,"
            + "saving_throws, skills,"
            + "damage_vulnerabilities, damage_resistances, damage_immunities, condition_immunities,"
            + "senses, passive_perception, languages, legendary_action_count, role, source_slug, slug_key"
            + ") VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
            + " ON CONFLICT(id) DO UPDATE SET "
            + "name=excluded.name, size=excluded.size, creature_type=excluded.creature_type, alignment=excluded.alignment,"
            + "cr=excluded.cr, xp=excluded.xp, hp=excluded.hp, hit_dice=excluded.hit_dice,"
            + "hit_dice_count=excluded.hit_dice_count, hit_dice_sides=excluded.hit_dice_sides,"
            + "hit_dice_modifier=excluded.hit_dice_modifier, ac=excluded.ac, ac_notes=excluded.ac_notes,"
            + "speed=excluded.speed, fly_speed=excluded.fly_speed, swim_speed=excluded.swim_speed, climb_speed=excluded.climb_speed,"
            + "burrow_speed=excluded.burrow_speed, str=excluded.str, dex=excluded.dex, con=excluded.con, intel=excluded.intel,"
            + "wis=excluded.wis, cha=excluded.cha, initiative_bonus=excluded.initiative_bonus,"
            + "proficiency_bonus=excluded.proficiency_bonus, saving_throws=excluded.saving_throws, skills=excluded.skills,"
            + "damage_vulnerabilities=excluded.damage_vulnerabilities, damage_resistances=excluded.damage_resistances,"
            + "damage_immunities=excluded.damage_immunities, condition_immunities=excluded.condition_immunities,"
            + "senses=excluded.senses, passive_perception=excluded.passive_perception, languages=excluded.languages,"
            + "legendary_action_count=excluded.legendary_action_count, role=excluded.role,"
            + "source_slug=excluded.source_slug, slug_key=excluded.slug_key";

    public static final String ACTION_INSERT_SQL =
            "INSERT INTO creature_actions(creature_id, action_type, name, description, to_hit_bonus) VALUES(?,?,?,?,?)";

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

        clearActions(conn, c.Id);
        insertAllActions(actionPs, c);
        actionPs.executeBatch();
        CreatureStaticAnalysisService.refreshForCreature(conn, c.Id);

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
        ps.setObject(10, c.HitDiceCount);
        ps.setObject(11, c.HitDiceSides);
        ps.setObject(12, c.HitDiceModifier);
        ps.setInt   (13, c.AC);
        ps.setString(14, c.AcNotes);
        ps.setInt   (15, c.Speed);
        ps.setInt   (16, c.FlySpeed);
        ps.setInt   (17, c.SwimSpeed);
        ps.setInt   (18, c.ClimbSpeed);
        ps.setInt   (19, c.BurrowSpeed);
        ps.setInt   (20, c.Str);
        ps.setInt   (21, c.Dex);
        ps.setInt   (22, c.Con);
        ps.setInt   (23, c.Intel);
        ps.setInt   (24, c.Wis);
        ps.setInt   (25, c.Cha);
        ps.setInt   (26, c.InitiativeBonus);
        ps.setInt   (27, c.ProficiencyBonus);
        ps.setString(28, c.SavingThrows);
        ps.setString(29, c.Skills);
        ps.setString(30, c.DamageVulnerabilities);
        ps.setString(31, c.DamageResistances);
        ps.setString(32, c.DamageImmunities);
        ps.setString(33, c.ConditionImmunities);
        ps.setString(34, c.Senses);
        ps.setInt   (35, c.PassivePerception);
        ps.setString(36, c.Languages);
        ps.setInt   (37, c.LegendaryActionCount);
        ps.setString(38, c.Role);
        ps.setString(39, c.SourceSlug);
        ps.setString(40, c.SlugKey);
    }

    private static void clearActions(Connection conn, Long creatureId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM creature_actions WHERE creature_id = ?")) {
            ps.setLong(1, creatureId);
            ps.executeUpdate();
        }
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
            ps.setObject(5, a.ToHitBonus);
            ps.addBatch();
        }
    }

    public static Creature getCreature(Connection conn, Long id) throws SQLException {
        String sql = "SELECT * FROM creatures WHERE id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    Creature c = CreatureHydrator.mapRow(rs);
                    List<Creature> single = List.of(c);
                    loadActions(conn, single);
                    CreatureHydrator.loadBiomes(conn, single);
                    CreatureHydrator.loadSubtypes(conn, single);
                    c.relationLoadState = Creature.RelationLoadState.FULL;
                    return c;
                }
            }
        }
        return null;
    }

    /**
     * Loads creatures by IDs with biomes/subtypes hydrated.
     * Actions are intentionally skipped for lightweight list/selection use-cases.
     */
    public static List<Creature> getCreaturesByIds(Connection conn, List<Long> ids) throws SQLException {
        if (ids == null || ids.isEmpty()) return List.of();
        String sql = "SELECT * FROM creatures WHERE id IN (" + placeholders(ids.size()) + ")";
        List<Creature> creatures = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            int idx = 1;
            for (Long id : ids) ps.setLong(idx++, id);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) creatures.add(CreatureHydrator.mapRow(rs));
            }
        }
        CreatureHydrator.loadBiomes(conn, creatures);
        CreatureHydrator.loadSubtypes(conn, creatures);
        creatures.forEach(c -> c.relationLoadState = Creature.RelationLoadState.PARTIAL);
        return creatures;
    }

    public static List<RoleValue> getRoleValues(Connection conn) throws SQLException {
        List<RoleValue> out = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement("SELECT id, role FROM creatures");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) out.add(new RoleValue(rs.getLong("id"), rs.getString("role")));
        }
        return out;
    }

    public static void updateRole(Connection conn, Long creatureId, String role) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("UPDATE creatures SET role = ? WHERE id = ?")) {
            ps.setString(1, role);
            ps.setLong(2, creatureId);
            ps.executeUpdate();
        }
    }
}
