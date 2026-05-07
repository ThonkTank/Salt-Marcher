package src.domain.creatures.published;

public final class CreatureCatalogSortField {

    public static final CreatureCatalogSortField NAME = new CreatureCatalogSortField("NAME");
    public static final CreatureCatalogSortField CHALLENGE_RATING = new CreatureCatalogSortField("CHALLENGE_RATING");
    public static final CreatureCatalogSortField XP = new CreatureCatalogSortField("XP");
    public static final CreatureCatalogSortField TYPE = new CreatureCatalogSortField("TYPE");
    public static final CreatureCatalogSortField SIZE = new CreatureCatalogSortField("SIZE");

    private final String name;

    private CreatureCatalogSortField(String name) {
        this.name = name;
    }

    public String name() {
        return name;
    }

    public static CreatureCatalogSortField valueOf(String value) {
        return switch (value) {
            case "CHALLENGE_RATING" -> CHALLENGE_RATING;
            case "XP" -> XP;
            case "TYPE" -> TYPE;
            case "SIZE" -> SIZE;
            case "NAME" -> NAME;
            default -> throw new IllegalArgumentException("Unknown CreatureCatalogSortField: " + value);
        };
    }

    @Override
    public String toString() {
        return name;
    }
}
