package features.spells.repository;

import features.spells.model.Spell;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class SpellRepository {
    public record SearchResult(List<Spell> spells, int totalCount) {}

    @FunctionalInterface
    private interface SqlBinder {
        void bind(PreparedStatement ps, int index) throws SQLException;
    }

    private SpellRepository() {
        throw new AssertionError("No instances");
    }

    private static final String SPELL_INSERT_SQL = "INSERT INTO spells("
            + "id, name, slug, source, level, school, casting_time, range_text, duration_text,"
            + "ritual, concentration, components_text, material_component_text, classes_text,"
            + "attack_or_save_text, damage_effect_text, description, higher_levels_text,"
            + "casting_channel, target_profile, delivery_type, is_offensive,"
            + "expected_damage_single, expected_damage_small_aoe, expected_damage_large_aoe"
            + ") VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
            + " ON CONFLICT(id) DO UPDATE SET "
            + "name=excluded.name, slug=excluded.slug, source=excluded.source, level=excluded.level,"
            + "school=excluded.school, casting_time=excluded.casting_time, range_text=excluded.range_text,"
            + "duration_text=excluded.duration_text, ritual=excluded.ritual, concentration=excluded.concentration,"
            + "components_text=excluded.components_text, material_component_text=excluded.material_component_text,"
            + "classes_text=excluded.classes_text, attack_or_save_text=excluded.attack_or_save_text,"
            + "damage_effect_text=excluded.damage_effect_text, description=excluded.description,"
            + "higher_levels_text=excluded.higher_levels_text, casting_channel=excluded.casting_channel,"
            + "target_profile=excluded.target_profile, delivery_type=excluded.delivery_type,"
            + "is_offensive=excluded.is_offensive, expected_damage_single=excluded.expected_damage_single,"
            + "expected_damage_small_aoe=excluded.expected_damage_small_aoe,"
            + "expected_damage_large_aoe=excluded.expected_damage_large_aoe";

    private static final String SPELL_CLASS_INSERT_SQL =
            "INSERT OR IGNORE INTO spell_classes(spell_id, class_name) VALUES(?, ?)";
    private static final String SPELL_DAMAGE_TYPE_INSERT_SQL =
            "INSERT OR IGNORE INTO spell_damage_types(spell_id, damage_type) VALUES(?, ?)";
    private static final String SPELL_TAG_INSERT_SQL =
            "INSERT OR IGNORE INTO spell_tags(spell_id, tag) VALUES(?, ?)";

    public static void save(Spell spell, Connection conn) throws SQLException {
        try (PreparedStatement spellPs = conn.prepareStatement(SPELL_INSERT_SQL)) {
            bindSpellParams(spellPs, spell);
            spellPs.executeUpdate();
        }

        replaceJunctionValues(conn, "spell_classes", "class_name", spell.Id, normalizeValues(spell.Classes));
        replaceJunctionValues(conn, "spell_damage_types", "damage_type", spell.Id, normalizeValues(spell.DamageTypes));
        replaceJunctionValues(conn, "spell_tags", "tag", spell.Id, normalizeValues(spell.Tags));
    }

    public static Spell getSpell(Connection conn, Long id) throws SQLException {
        String sql = "SELECT * FROM spells WHERE id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                Spell spell = mapRow(rs);
                loadCollections(conn, List.of(spell));
                return spell;
            }
        }
    }

    public static Spell getSpellBySlug(Connection conn, String slug) throws SQLException {
        String sql = "SELECT * FROM spells WHERE slug = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, slug);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                Spell spell = mapRow(rs);
                loadCollections(conn, List.of(spell));
                return spell;
            }
        }
    }

    public static List<Spell> searchByName(Connection conn, String query, int limit) throws SQLException {
        List<Spell> spells = new ArrayList<>();
        String sql = "SELECT * FROM spells WHERE LOWER(name) LIKE LOWER(?) ORDER BY level, name LIMIT ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, "%" + query + "%");
            ps.setInt(2, limit);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    spells.add(mapRow(rs));
                }
            }
        }
        loadCollections(conn, spells);
        return spells;
    }

    public static Spell findByExactName(Connection conn, String spellName) throws SQLException {
        if (spellName == null || spellName.isBlank()) {
            return null;
        }
        String sql = "SELECT * FROM spells WHERE lower(trim(name)) = lower(trim(?)) LIMIT 1";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, spellName);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                Spell spell = mapRow(rs);
                loadCollections(conn, List.of(spell));
                return spell;
            }
        }
    }

    public static SearchResult searchWithFiltersAndCount(
            Connection conn,
            String nameQuery,
            boolean ritualOnly,
            boolean concentrationOnly,
            List<String> levels,
            List<String> schools,
            List<String> classes,
            List<String> tags,
            List<String> sources,
            String sortColumn,
            String sortDirection,
            int limit,
            int offset) throws SQLException {
        List<SqlBinder> binders = new ArrayList<>();
        String whereClause = buildSearchWhereClause(
                binders,
                nameQuery,
                ritualOnly,
                concentrationOnly,
                levels,
                schools,
                classes,
                tags,
                sources);

        String pageSql = "SELECT * FROM spells" + whereClause + resolveOrderBy(sortColumn, sortDirection) + " LIMIT ? OFFSET ?";
        List<Spell> spells = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(pageSql)) {
            bindParams(ps, binders);
            int nextIndex = binders.size() + 1;
            ps.setInt(nextIndex++, Math.max(1, limit));
            ps.setInt(nextIndex, Math.max(0, offset));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    spells.add(mapRow(rs));
                }
            }
        }

        String countSql = "SELECT COUNT(*) FROM spells" + whereClause;
        int totalCount = 0;
        try (PreparedStatement ps = conn.prepareStatement(countSql)) {
            bindParams(ps, binders);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) totalCount = rs.getInt(1);
            }
        }
        return new SearchResult(spells, totalCount);
    }

    public static List<String> getDistinctLevels(Connection conn) throws SQLException {
        List<String> values = new ArrayList<>();
        String sql = "SELECT DISTINCT level FROM spells ORDER BY level";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                int level = rs.getInt(1);
                values.add(level == 0 ? "Zaubertrick" : Integer.toString(level));
            }
        }
        return values;
    }

    public static List<String> getDistinctSchools(Connection conn) throws SQLException {
        return getDistinctColumnValues(conn, "spells", "school");
    }

    public static List<String> getDistinctSources(Connection conn) throws SQLException {
        return getDistinctColumnValues(conn, "spells", "source");
    }

    public static List<String> getDistinctClasses(Connection conn) throws SQLException {
        return getDistinctJunctionValues(conn, "spell_classes", "class_name");
    }

    public static List<String> getDistinctTags(Connection conn) throws SQLException {
        return getDistinctJunctionValues(conn, "spell_tags", "tag");
    }

    private static void bindSpellParams(PreparedStatement ps, Spell spell) throws SQLException {
        ps.clearParameters();
        ps.setLong(1, spell.Id);
        ps.setString(2, spell.Name);
        ps.setString(3, spell.Slug);
        ps.setString(4, spell.Source);
        ps.setInt(5, spell.Level);
        ps.setString(6, spell.School);
        ps.setString(7, spell.CastingTime);
        ps.setString(8, spell.RangeText);
        ps.setString(9, spell.DurationText);
        ps.setInt(10, spell.Ritual ? 1 : 0);
        ps.setInt(11, spell.Concentration ? 1 : 0);
        ps.setString(12, spell.ComponentsText);
        ps.setString(13, spell.MaterialComponentText);
        ps.setString(14, spell.ClassesText);
        ps.setString(15, spell.AttackOrSaveText);
        ps.setString(16, spell.DamageEffectText);
        ps.setString(17, spell.Description);
        ps.setString(18, spell.HigherLevelsText);
        ps.setString(19, spell.CastingChannel);
        ps.setString(20, spell.TargetProfile);
        ps.setString(21, spell.DeliveryType);
        ps.setInt(22, spell.IsOffensive ? 1 : 0);
        ps.setDouble(23, spell.ExpectedDamageSingle);
        ps.setDouble(24, spell.ExpectedDamageSmallAoe);
        ps.setDouble(25, spell.ExpectedDamageLargeAoe);
    }

    private static Spell mapRow(ResultSet rs) throws SQLException {
        Spell spell = new Spell();
        spell.Id = rs.getLong("id");
        spell.Name = rs.getString("name");
        spell.Slug = rs.getString("slug");
        spell.Source = rs.getString("source");
        spell.Level = rs.getInt("level");
        spell.School = rs.getString("school");
        spell.CastingTime = rs.getString("casting_time");
        spell.RangeText = rs.getString("range_text");
        spell.DurationText = rs.getString("duration_text");
        spell.Ritual = rs.getInt("ritual") != 0;
        spell.Concentration = rs.getInt("concentration") != 0;
        spell.ComponentsText = rs.getString("components_text");
        spell.MaterialComponentText = rs.getString("material_component_text");
        spell.ClassesText = rs.getString("classes_text");
        spell.AttackOrSaveText = rs.getString("attack_or_save_text");
        spell.DamageEffectText = rs.getString("damage_effect_text");
        spell.Description = rs.getString("description");
        spell.HigherLevelsText = rs.getString("higher_levels_text");
        spell.CastingChannel = rs.getString("casting_channel");
        spell.TargetProfile = rs.getString("target_profile");
        spell.DeliveryType = rs.getString("delivery_type");
        spell.IsOffensive = rs.getInt("is_offensive") != 0;
        spell.ExpectedDamageSingle = rs.getDouble("expected_damage_single");
        spell.ExpectedDamageSmallAoe = rs.getDouble("expected_damage_small_aoe");
        spell.ExpectedDamageLargeAoe = rs.getDouble("expected_damage_large_aoe");
        spell.Classes = new ArrayList<>();
        spell.DamageTypes = new ArrayList<>();
        spell.Tags = new ArrayList<>();
        return spell;
    }

    private static void loadCollections(Connection conn, List<Spell> spells) throws SQLException {
        if (spells.isEmpty()) {
            return;
        }
        Map<Long, Spell> byId = new HashMap<>(spells.size() * 2);
        for (Spell spell : spells) {
            byId.put(spell.Id, spell);
        }
        loadCollection(conn, byId, "spell_classes", "class_name", CollectionType.CLASSES);
        loadCollection(conn, byId, "spell_damage_types", "damage_type", CollectionType.DAMAGE_TYPES);
        loadCollection(conn, byId, "spell_tags", "tag", CollectionType.TAGS);
    }

    private static void loadCollection(
            Connection conn,
            Map<Long, Spell> byId,
            String table,
            String column,
            CollectionType type) throws SQLException {
        String sql = "SELECT spell_id, " + column + " FROM " + table + " WHERE spell_id IN ("
                + String.join(",", Collections.nCopies(byId.size(), "?")) + ")";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            int idx = 1;
            for (Long id : byId.keySet()) {
                ps.setLong(idx++, id);
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Spell spell = byId.get(rs.getLong("spell_id"));
                    if (spell == null) {
                        continue;
                    }
                    String value = rs.getString(column);
                    if (value == null || value.isBlank()) {
                        continue;
                    }
                    switch (type) {
                        case CLASSES -> addUnique(spell.Classes, value);
                        case DAMAGE_TYPES -> addUnique(spell.DamageTypes, value);
                        case TAGS -> addUnique(spell.Tags, value);
                    }
                }
            }
        }
    }

    private static void replaceJunctionValues(
            Connection conn,
            String table,
            String column,
            Long spellId,
            List<String> values) throws SQLException {
        try (PreparedStatement del = conn.prepareStatement("DELETE FROM " + table + " WHERE spell_id = ?")) {
            del.setLong(1, spellId);
            del.executeUpdate();
        }
        if (values.isEmpty()) {
            return;
        }
        String insertSql = switch (table) {
            case "spell_classes" -> SPELL_CLASS_INSERT_SQL;
            case "spell_damage_types" -> SPELL_DAMAGE_TYPE_INSERT_SQL;
            case "spell_tags" -> SPELL_TAG_INSERT_SQL;
            default -> throw new IllegalArgumentException("Unsupported spell junction table: " + table);
        };
        try (PreparedStatement ps = conn.prepareStatement(insertSql)) {
            for (String value : values) {
                ps.setLong(1, spellId);
                ps.setString(2, value);
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    private static String buildSearchWhereClause(
            List<SqlBinder> binders,
            String nameQuery,
            boolean ritualOnly,
            boolean concentrationOnly,
            List<String> levels,
            List<String> schools,
            List<String> classes,
            List<String> tags,
            List<String> sources) {
        List<String> clauses = new ArrayList<>();
        if (nameQuery != null && !nameQuery.isBlank()) {
            clauses.add("LOWER(name) LIKE LOWER(?)");
            binders.add((ps, index) -> ps.setString(index, "%" + nameQuery.trim() + "%"));
        }
        if (ritualOnly) clauses.add("ritual = 1");
        if (concentrationOnly) clauses.add("concentration = 1");
        addLevelClause(clauses, binders, levels);
        addCaseInsensitiveInClause(clauses, binders, "school", schools);
        addCaseInsensitiveInClause(clauses, binders, "source", sources);
        addJunctionFilterClause(clauses, binders, "spell_classes", "class_name", classes);
        addJunctionFilterClause(clauses, binders, "spell_tags", "tag", tags);
        return clauses.isEmpty() ? "" : " WHERE " + String.join(" AND ", clauses);
    }

    private static void addLevelClause(List<String> clauses, List<SqlBinder> binders, List<String> levels) {
        if (levels == null || levels.isEmpty()) return;
        List<Integer> numericLevels = new ArrayList<>();
        for (String level : levels) {
            Integer parsed = parseLevel(level);
            if (parsed != null) numericLevels.add(parsed);
        }
        if (numericLevels.isEmpty()) return;
        clauses.add("level IN (" + String.join(",", Collections.nCopies(numericLevels.size(), "?")) + ")");
        for (Integer level : numericLevels) {
            binders.add((ps, index) -> ps.setInt(index, level));
        }
    }

    private static Integer parseLevel(String level) {
        if (level == null || level.isBlank()) return null;
        String normalized = level.trim().toLowerCase(Locale.ROOT);
        if ("cantrip".equals(normalized) || "zaubertrick".equals(normalized)) return 0;
        try {
            return Integer.parseInt(level.trim());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static void addJunctionFilterClause(
            List<String> clauses,
            List<SqlBinder> binders,
            String table,
            String column,
            List<String> values) {
        if (values == null || values.isEmpty()) return;
        List<String> normalized = values.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .toList();
        if (normalized.isEmpty()) return;
        clauses.add("EXISTS (SELECT 1 FROM " + table + " filter WHERE filter.spell_id = spells.id AND LOWER(filter."
                + column + ") IN (" + String.join(",", Collections.nCopies(normalized.size(), "?")) + "))");
        for (String value : normalized) {
            binders.add((ps, index) -> ps.setString(index, value.toLowerCase(Locale.ROOT)));
        }
    }

    private static void addCaseInsensitiveInClause(
            List<String> clauses,
            List<SqlBinder> binders,
            String column,
            List<String> values) {
        if (values == null || values.isEmpty()) return;
        List<String> normalized = values.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .toList();
        if (normalized.isEmpty()) return;
        clauses.add("LOWER(" + column + ") IN (" + String.join(",", Collections.nCopies(normalized.size(), "?")) + ")");
        for (String value : normalized) {
            binders.add((ps, index) -> ps.setString(index, value.toLowerCase(Locale.ROOT)));
        }
    }

    private static String resolveOrderBy(String sortColumn, String sortDirection) {
        String direction = "DESC".equalsIgnoreCase(sortDirection) ? "DESC" : "ASC";
        String column = switch (sortColumn == null ? "" : sortColumn) {
            case "level" -> "level";
            case "name" -> "name";
            default -> "name";
        };
        return " ORDER BY " + column + " " + direction + ", name ASC";
    }

    private static void bindParams(PreparedStatement ps, List<SqlBinder> binders) throws SQLException {
        for (int i = 0; i < binders.size(); i++) {
            binders.get(i).bind(ps, i + 1);
        }
    }

    private static List<String> getDistinctColumnValues(Connection conn, String table, String column) throws SQLException {
        List<String> values = new ArrayList<>();
        String sql = "SELECT DISTINCT " + column + " FROM " + table + " WHERE " + column
                + " IS NOT NULL AND TRIM(" + column + ") <> '' ORDER BY LOWER(" + column + "), " + column;
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) values.add(rs.getString(1));
        }
        return values;
    }

    private static List<String> getDistinctJunctionValues(Connection conn, String table, String column) throws SQLException {
        List<String> values = new ArrayList<>();
        String sql = "SELECT DISTINCT " + column + " FROM " + table + " WHERE " + column
                + " IS NOT NULL AND TRIM(" + column + ") <> '' ORDER BY LOWER(" + column + "), " + column;
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) values.add(rs.getString(1));
        }
        return values;
    }

    private static List<String> normalizeValues(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String raw : values) {
            if (raw == null) {
                continue;
            }
            String trimmed = raw.trim();
            if (!trimmed.isEmpty()) {
                normalized.add(trimmed);
            }
        }
        return new ArrayList<>(normalized);
    }

    private static void addUnique(List<String> values, String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty() || values.contains(normalized)) {
            return;
        }
        values.add(normalized);
    }

    private enum CollectionType {
        CLASSES,
        DAMAGE_TYPES,
        TAGS
    }
}
