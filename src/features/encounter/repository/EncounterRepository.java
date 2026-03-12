package features.encounter.repository;

import features.creatures.model.EncounterFunctionRole;
import features.creatures.model.HitDice;
import features.encounter.model.Encounter;
import features.encounter.model.EncounterCreatureSnapshot;
import features.encounter.model.EncounterSlot;
import features.partyanalysis.model.EncounterWeightClass;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class EncounterRepository {

    public record EncounterSummaryRow(
            long encounterId,
            String name,
            String difficulty,
            String shapeLabel,
            int slotCount
    ) {}

    public record StoredEncounterRow(
            long encounterId,
            String name,
            Encounter encounter
    ) {}

    private EncounterRepository() {
        throw new AssertionError("No instances");
    }

    public static long insertEncounter(Connection conn, String name, Encounter encounter) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO encounters(name, difficulty, average_level, party_size, xp_budget, shape_label) "
                        + "VALUES(?,?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, name);
            ps.setString(2, encounter.difficulty());
            ps.setInt(3, encounter.averageLevel());
            ps.setInt(4, encounter.partySize());
            ps.setInt(5, encounter.xpBudget());
            ps.setString(6, encounter.shapeLabel());
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (!keys.next()) {
                    throw new SQLException("No generated key returned for encounters insert");
                }
                long encounterId = keys.getLong(1);
                insertSlots(conn, encounterId, encounter.slots());
                return encounterId;
            }
        }
    }

    public static List<EncounterSummaryRow> getAllSummaries(Connection conn) throws SQLException {
        List<EncounterSummaryRow> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT e.encounter_id, e.name, e.difficulty, e.shape_label, COUNT(s.encounter_slot_id) AS slot_count "
                        + "FROM encounters e "
                        + "LEFT JOIN encounter_slots s ON s.encounter_id = e.encounter_id "
                        + "GROUP BY e.encounter_id, e.name, e.difficulty, e.shape_label "
                        + "ORDER BY e.created_at DESC, e.encounter_id DESC");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                result.add(new EncounterSummaryRow(
                        rs.getLong("encounter_id"),
                        rs.getString("name"),
                        rs.getString("difficulty"),
                        rs.getString("shape_label"),
                        rs.getInt("slot_count")));
            }
        }
        return result;
    }

    public static Optional<StoredEncounterRow> findEncounter(Connection conn, long encounterId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT e.encounter_id, e.name, e.difficulty, e.average_level, e.party_size, e.xp_budget, e.shape_label, "
                        + "s.display_order, s.creature_id, s.creature_name, s.creature_xp, s.creature_hp, "
                        + "s.hit_dice_count, s.hit_dice_sides, s.hit_dice_modifier, s.creature_ac, s.initiative_bonus, "
                        + "s.cr_display, s.creature_type, s.count, s.weight_class, s.primary_function_role "
                        + "FROM encounters e "
                        + "LEFT JOIN encounter_slots s ON s.encounter_id = e.encounter_id "
                        + "WHERE e.encounter_id = ? "
                        + "ORDER BY s.display_order ASC, s.encounter_slot_id ASC")) {
            ps.setLong(1, encounterId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                long id = rs.getLong("encounter_id");
                String name = rs.getString("name");
                String difficulty = rs.getString("difficulty");
                int averageLevel = rs.getInt("average_level");
                int partySize = rs.getInt("party_size");
                int xpBudget = rs.getInt("xp_budget");
                String shapeLabel = rs.getString("shape_label");
                Map<Integer, EncounterSlot> slotsByOrder = new LinkedHashMap<>();
                do {
                    Integer displayOrder = getNullableInt(rs, "display_order");
                    if (displayOrder != null) {
                        slotsByOrder.put(displayOrder, mapSlot(rs));
                    }
                } while (rs.next());
                Encounter encounter = new Encounter(
                        new ArrayList<>(slotsByOrder.values()),
                        difficulty,
                        averageLevel,
                        partySize,
                        xpBudget,
                        shapeLabel);
                return Optional.of(new StoredEncounterRow(id, name, encounter));
            }
        }
    }

    private static void insertSlots(Connection conn, long encounterId, List<EncounterSlot> slots) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO encounter_slots("
                        + "encounter_id, display_order, creature_id, creature_name, creature_xp, creature_hp, "
                        + "hit_dice_count, hit_dice_sides, hit_dice_modifier, creature_ac, initiative_bonus, "
                        + "cr_display, creature_type, count, weight_class, primary_function_role"
                        + ") VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")) {
            int index = 0;
            for (EncounterSlot slot : slots) {
                if (slot == null || slot.getCreature() == null) {
                    continue;
                }
                EncounterCreatureSnapshot creature = slot.getCreature();
                HitDice hitDice = creature.getHitDice();
                ps.setLong(1, encounterId);
                ps.setInt(2, index++);
                ps.setLong(3, creature.getId());
                ps.setString(4, creature.getName());
                ps.setInt(5, creature.getXp());
                ps.setInt(6, creature.getHp());
                if (hitDice != null) {
                    ps.setInt(7, hitDice.count());
                    ps.setInt(8, hitDice.sides());
                    ps.setInt(9, hitDice.modifier());
                } else {
                    ps.setNull(7, java.sql.Types.INTEGER);
                    ps.setNull(8, java.sql.Types.INTEGER);
                    ps.setNull(9, java.sql.Types.INTEGER);
                }
                ps.setInt(10, creature.getAc());
                ps.setInt(11, creature.getInitiativeBonus());
                ps.setString(12, creature.getCrDisplay());
                ps.setString(13, creature.getCreatureType());
                ps.setInt(14, slot.getCount());
                ps.setString(15, slot.getWeightClass() == null ? null : slot.getWeightClass().name());
                ps.setString(16, slot.getPrimaryFunctionRole() == null ? null : slot.getPrimaryFunctionRole().name());
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    private static EncounterSlot mapSlot(ResultSet rs) throws SQLException {
        EncounterCreatureSnapshot creature = new EncounterCreatureSnapshot(
                rs.getLong("creature_id"),
                rs.getString("creature_name"),
                rs.getInt("creature_xp"),
                rs.getInt("creature_hp"),
                HitDice.fromParts(
                        getNullableInt(rs, "hit_dice_count"),
                        getNullableInt(rs, "hit_dice_sides"),
                        getNullableInt(rs, "hit_dice_modifier")).orElse(null),
                rs.getInt("creature_ac"),
                rs.getInt("initiative_bonus"),
                rs.getString("cr_display"),
                rs.getString("creature_type"));
        return new EncounterSlot(
                creature,
                rs.getInt("count"),
                parseWeightClass(rs.getString("weight_class")),
                parseFunctionRole(rs.getString("primary_function_role")));
    }

    private static EncounterWeightClass parseWeightClass(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return EncounterWeightClass.valueOf(value);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static EncounterFunctionRole parseFunctionRole(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return EncounterFunctionRole.valueOf(value);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static Integer getNullableInt(ResultSet rs, String column) throws SQLException {
        int value = rs.getInt(column);
        return rs.wasNull() ? null : value;
    }
}
