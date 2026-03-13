package features.world.dungeonmap.repository.feature;

import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonAreaEncounterTableLink;

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

public final class DungeonAreaRepository {

    private DungeonAreaRepository() {
        throw new AssertionError("No instances");
    }

    public static long upsertArea(Connection conn, DungeonArea area) throws SQLException {
        long areaId;
        if (area.areaId() == null) {
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO dungeon_areas(map_id, name, encounter_every_hours) VALUES(?,?,?)",
                    Statement.RETURN_GENERATED_KEYS)) {
                ps.setLong(1, area.mapId());
                ps.setString(2, area.name());
                ps.setInt(3, Math.max(1, area.encounterEveryHours()));
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    if (!keys.next()) {
                        throw new SQLException("No generated key returned for dungeon_areas insert");
                    }
                    areaId = keys.getLong(1);
                }
            }
        } else {
            try (PreparedStatement ps = conn.prepareStatement(
                    "UPDATE dungeon_areas "
                            + "SET name=?, encounter_every_hours=?, encounter_table_id=NULL "
                            + "WHERE area_id=?")) {
                ps.setString(1, area.name());
                ps.setInt(2, Math.max(1, area.encounterEveryHours()));
                ps.setLong(3, area.areaId());
                ps.executeUpdate();
                areaId = area.areaId();
            }
        }
        replaceEncounterTableLinks(conn, areaId, area.encounterTableLinks());
        return areaId;
    }

    public static List<DungeonArea> getAreas(Connection conn, long mapId) throws SQLException {
        List<DungeonArea> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT area_id, map_id, name, encounter_every_hours "
                        + "FROM dungeon_areas WHERE map_id=? ORDER BY area_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(mapAreaRow(rs, List.of()));
                }
            }
        }
        return attachEncounterTableLinks(conn, result);
    }

    public static Optional<DungeonArea> findArea(Connection conn, long areaId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT area_id, map_id, name, encounter_every_hours "
                        + "FROM dungeon_areas WHERE area_id=?")) {
            ps.setLong(1, areaId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                List<DungeonArea> areas = attachEncounterTableLinks(conn, List.of(mapAreaRow(rs, List.of())));
                return areas.isEmpty() ? Optional.empty() : Optional.of(areas.get(0));
            }
        }
    }

    public static void deleteArea(Connection conn, long areaId) throws SQLException {
        // Callers must normalize area assignments in the same transaction before commit.
        try (PreparedStatement clearRooms = conn.prepareStatement(
                "UPDATE dungeon_rooms SET area_id=NULL WHERE area_id=?");
             PreparedStatement deleteArea = conn.prepareStatement(
                     "DELETE FROM dungeon_areas WHERE area_id=?")) {
            clearRooms.setLong(1, areaId);
            clearRooms.executeUpdate();
            deleteArea.setLong(1, areaId);
            deleteArea.executeUpdate();
        }
    }

    private static void replaceEncounterTableLinks(
            Connection conn,
            long areaId,
            List<DungeonAreaEncounterTableLink> links
    ) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_area_encounter_tables WHERE area_id=?")) {
            delete.setLong(1, areaId);
            delete.executeUpdate();
        }
        if (links == null || links.isEmpty()) {
            return;
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_area_encounter_tables(area_id, table_id, weight, sort_order) VALUES(?,?,?,?)")) {
            for (DungeonAreaEncounterTableLink link : links) {
                if (link == null || link.tableId() == null) {
                    continue;
                }
                insert.setLong(1, areaId);
                insert.setLong(2, link.tableId());
                insert.setInt(3, Math.max(1, link.weight()));
                insert.setInt(4, Math.max(0, link.sortOrder()));
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static List<DungeonArea> attachEncounterTableLinks(Connection conn, List<DungeonArea> areas) throws SQLException {
        if (areas == null || areas.isEmpty()) {
            return List.of();
        }
        Map<Long, List<DungeonAreaEncounterTableLink>> linksByAreaId = loadEncounterTableLinks(conn, areas);
        List<DungeonArea> hydratedAreas = new ArrayList<>(areas.size());
        for (DungeonArea area : areas) {
            List<DungeonAreaEncounterTableLink> links = area == null || area.areaId() == null
                    ? List.of()
                    : linksByAreaId.getOrDefault(area.areaId(), List.of());
            hydratedAreas.add(copyAreaWithLinks(area, links));
        }
        return List.copyOf(hydratedAreas);
    }

    private static Map<Long, List<DungeonAreaEncounterTableLink>> loadEncounterTableLinks(
            Connection conn,
            List<DungeonArea> areas
    ) throws SQLException {
        List<Long> areaIds = new ArrayList<>();
        for (DungeonArea area : areas) {
            if (area != null && area.areaId() != null) {
                areaIds.add(area.areaId());
            }
        }
        if (areaIds.isEmpty()) {
            return Map.of();
        }
        String placeholders = String.join(",", java.util.Collections.nCopies(areaIds.size(), "?"));
        Map<Long, List<DungeonAreaEncounterTableLink>> linksByAreaId = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT area_id, table_id, weight, sort_order "
                        + "FROM dungeon_area_encounter_tables "
                        + "WHERE area_id IN (" + placeholders + ") "
                        + "ORDER BY area_id, sort_order, table_id")) {
            for (int i = 0; i < areaIds.size(); i++) {
                ps.setLong(i + 1, areaIds.get(i));
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long areaId = rs.getLong("area_id");
                    linksByAreaId.computeIfAbsent(areaId, ignored -> new ArrayList<>())
                            .add(new DungeonAreaEncounterTableLink(
                                    rs.getLong("table_id"),
                                    rs.getInt("weight"),
                                    rs.getInt("sort_order")));
                }
            }
        }
        return linksByAreaId;
    }

    private static DungeonArea mapAreaRow(ResultSet rs, List<DungeonAreaEncounterTableLink> links) throws SQLException {
        return new DungeonArea(
                rs.getLong("area_id"),
                rs.getLong("map_id"),
                rs.getString("name"),
                rs.getInt("encounter_every_hours"),
                links);
    }

    private static DungeonArea copyAreaWithLinks(DungeonArea area, List<DungeonAreaEncounterTableLink> links) {
        return new DungeonArea(
                area.areaId(),
                area.mapId(),
                area.name(),
                area.encounterEveryHours(),
                links);
    }
}
