package repositories;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

import database.DatabaseManager;
import entities.Item;

public class ItemRepository {

    // -------------------------------------------------------------------------
    // SQL constants (shared with ItemImporter for PreparedStatement reuse)
    // -------------------------------------------------------------------------

    public static final String ITEM_INSERT_SQL = "INSERT OR REPLACE INTO items("
            + "id, name, slug, category, subcategory, is_magic,"
            + "rarity, requires_attunement, attunement_condition,"
            + "cost, cost_cp, weight, damage, properties, armor_class,"
            + "description, source, tags"
            + ") VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

    // -------------------------------------------------------------------------
    // Mapping
    // -------------------------------------------------------------------------

    private static Item mapItemFields(ResultSet rs) throws SQLException {
        Item i = new Item();
        i.Id                  = rs.getLong("id");
        i.Name                = rs.getString("name");
        i.Slug                = rs.getString("slug");
        i.Category            = rs.getString("category");
        i.Subcategory         = rs.getString("subcategory");
        i.IsMagic             = rs.getInt("is_magic") != 0;
        i.Rarity              = rs.getString("rarity");
        i.RequiresAttunement  = rs.getInt("requires_attunement") != 0;
        i.AttunementCondition = rs.getString("attunement_condition");
        i.Cost                = rs.getString("cost");
        i.CostCp              = rs.getInt("cost_cp");
        i.Weight              = rs.getDouble("weight");
        i.Damage              = rs.getString("damage");
        i.Properties          = rs.getString("properties");
        i.ArmorClass          = rs.getString("armor_class");
        i.Description         = rs.getString("description");
        i.Source              = rs.getString("source");
        i.Tags                = rs.getString("tags");
        return i;
    }

    // -------------------------------------------------------------------------
    // Save
    // -------------------------------------------------------------------------

    public static void saveItemBatch(Item item, PreparedStatement ps) throws SQLException {
        bindItemParams(ps, item);
        ps.executeUpdate();
    }

    private static void bindItemParams(PreparedStatement ps, Item i) throws SQLException {
        ps.clearParameters();
        ps.setLong   (1,  i.Id);
        ps.setString (2,  i.Name);
        ps.setString (3,  i.Slug);
        ps.setString (4,  i.Category);
        ps.setString (5,  i.Subcategory);
        ps.setInt    (6,  i.IsMagic ? 1 : 0);
        ps.setString (7,  i.Rarity);
        ps.setInt    (8,  i.RequiresAttunement ? 1 : 0);
        ps.setString (9,  i.AttunementCondition);
        ps.setString (10, i.Cost);
        ps.setInt    (11, i.CostCp);
        ps.setDouble (12, i.Weight);
        ps.setString (13, i.Damage);
        ps.setString (14, i.Properties);
        ps.setString (15, i.ArmorClass);
        ps.setString (16, i.Description);
        ps.setString (17, i.Source);
        ps.setString (18, i.Tags);
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    public static Item getItem(Long id) {
        String sql = "SELECT * FROM items WHERE id = ?";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return mapItemFields(rs);
            }
        } catch (SQLException e) {
            System.err.println("ItemRepository.getItem(id=" + id + "): " + e.getMessage());
        }
        return null;
    }

    public static List<Item> searchByName(String query, int limit) {
        List<Item> items = new ArrayList<>();
        String sql = "SELECT * FROM items WHERE LOWER(name) LIKE LOWER(?) LIMIT ?";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, "%" + query + "%");
            ps.setInt(2, limit);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) items.add(mapItemFields(rs));
            }
        } catch (SQLException e) {
            System.err.println("Fehler bei Itemsuche: " + e.getMessage());
        }
        return items;
    }

    public static List<Item> getItemsByCategory(String category) {
        List<Item> items = new ArrayList<>();
        String sql = "SELECT * FROM items WHERE LOWER(category) = LOWER(?) ORDER BY name";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, category);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) items.add(mapItemFields(rs));
            }
        } catch (SQLException e) {
            System.err.println("ItemRepository.getItemsByCategory('" + category + "'): " + e.getMessage());
        }
        return items;
    }

    public static List<Item> getMagicItemsByRarity(String rarity) {
        List<Item> items = new ArrayList<>();
        String sql = "SELECT * FROM items WHERE is_magic = 1 AND LOWER(rarity) = LOWER(?) ORDER BY name";
        try (Connection conn = DatabaseManager.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, rarity);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) items.add(mapItemFields(rs));
            }
        } catch (SQLException e) {
            System.err.println("ItemRepository.getMagicItemsByRarity('" + rarity + "'): " + e.getMessage());
        }
        return items;
    }
}
