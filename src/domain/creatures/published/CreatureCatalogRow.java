package src.domain.creatures.published;

import src.domain.creatures.catalog.port.CreatureCatalogLookup;

public final class CreatureCatalogRow {

    private final CreatureCatalogLookup.CatalogRow row;

    public CreatureCatalogRow(
            long id,
            String name,
            String size,
            String creatureType,
            String alignment,
            String challengeRating,
            int xp,
            int hitPoints,
            int armorClass
    ) {
        this(new CreatureCatalogLookup.CatalogRow(
                id,
                name,
                size,
                creatureType,
                alignment,
                challengeRating,
                xp,
                hitPoints,
                armorClass));
    }

    public CreatureCatalogRow(CreatureCatalogLookup.CatalogRow row) {
        this.row = row == null ? new CreatureCatalogLookup.CatalogRow(0L, "", "", "", "", "", 0, 0, 0) : row;
    }

    public static CreatureCatalogRow fromRow(CreatureCatalogLookup.CatalogRow row) {
        return new CreatureCatalogRow(row);
    }

    public long id() {
        return row.id();
    }

    public String name() {
        return row.name();
    }

    public String size() {
        return row.size();
    }

    public String creatureType() {
        return row.creatureType();
    }

    public String alignment() {
        return row.alignment();
    }

    public String challengeRating() {
        return row.challengeRating();
    }

    public int xp() {
        return row.xp();
    }

    public int hitPoints() {
        return row.hitPoints();
    }

    public int armorClass() {
        return row.armorClass();
    }
}
