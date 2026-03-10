package features.creatures.repository;

import features.creatures.model.ChallengeRating;
import features.creatures.model.Creature;

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
import java.util.function.BiConsumer;
import java.util.logging.Level;
import java.util.logging.Logger;

final class CreatureHydrator {
    private static final Logger LOGGER = Logger.getLogger(CreatureHydrator.class.getName());
    private static final int IN_CLAUSE_BATCH_SIZE = 400;

    private static final Set<String> ALLOWED_LOAD_TABLES =
            Set.of("creature_biomes:biome", "creature_subtypes:subtype");

    private CreatureHydrator() {
        throw new AssertionError("No instances");
    }

    static Creature mapRow(ResultSet rs) throws SQLException {
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
            LOGGER.log(Level.WARNING, "CreatureHydrator.mapRow(): invalid CR value, defaulting to 0", e);
            c.CR = ChallengeRating.of("0");
        }
        c.XP               = rs.getInt("xp");
        c.HP               = rs.getInt("hp");
        c.HitDice          = rs.getString("hit_dice");
        c.HitDiceCount     = nullableInt(rs, "hit_dice_count");
        c.HitDiceSides     = nullableInt(rs, "hit_dice_sides");
        c.HitDiceModifier  = nullableInt(rs, "hit_dice_modifier");
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
        c.SourceSlug = rs.getString("source_slug");
        c.SlugKey = rs.getString("slug_key");

        c.Biomes = new ArrayList<>(); // populated by loadBiomes()

        c.Traits           = new ArrayList<>(); // populated by loadActions()
        c.Actions          = new ArrayList<>(); // populated by loadActions()
        c.BonusActions     = new ArrayList<>(); // populated by loadActions()
        c.Reactions        = new ArrayList<>(); // populated by loadActions()
        c.LegendaryActions = new ArrayList<>(); // populated by loadActions()
        return c;
    }

    private static Integer nullableInt(ResultSet rs, String column) throws SQLException {
        Number value = (Number) rs.getObject(column);
        return value != null ? value.intValue() : null;
    }

    static void loadBiomes(Connection conn, List<Creature> creatures) throws SQLException {
        loadStringList(conn, creatures, "creature_biomes", "biome", (c, v) -> c.Biomes.add(v));
    }

    static void loadSubtypes(Connection conn, List<Creature> creatures) throws SQLException {
        loadStringList(conn, creatures, "creature_subtypes", "subtype", (c, v) -> c.Subtypes.add(v));
    }

    private static void loadStringList(Connection conn, List<Creature> creatures,
                                       String table, String valueColumn,
                                       BiConsumer<Creature, String> adder) throws SQLException {
        if (!ALLOWED_LOAD_TABLES.contains(table + ":" + valueColumn)) {
            throw new IllegalArgumentException(
                    "Invalid table/column for loadStringList: " + table + "." + valueColumn);
        }
        if (creatures.isEmpty()) return;
        Map<Long, Creature> byId = indexById(creatures);
        for (int start = 0; start < creatures.size(); start += IN_CLAUSE_BATCH_SIZE) {
            int end = Math.min(start + IN_CLAUSE_BATCH_SIZE, creatures.size());
            List<Creature> batch = creatures.subList(start, end);
            String sql = "SELECT creature_id, " + valueColumn + " FROM " + table
                    + " WHERE creature_id IN (" + placeholders(batch.size()) + ")";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                int idx = 1;
                for (Creature c : batch) ps.setLong(idx++, c.Id);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        Creature c = byId.get(rs.getLong("creature_id"));
                        if (c != null) adder.accept(c, rs.getString(valueColumn));
                    }
                }
            }
        }
    }

    private static String placeholders(int count) {
        return String.join(",", Collections.nCopies(count, "?"));
    }

    private static Map<Long, Creature> indexById(List<Creature> creatures) {
        Map<Long, Creature> byId = new HashMap<>(creatures.size() * 2);
        for (Creature c : creatures) byId.put(c.Id, c);
        return byId;
    }
}
