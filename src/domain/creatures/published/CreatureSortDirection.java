package src.domain.creatures.published;

public final class CreatureSortDirection {

    public static final CreatureSortDirection ASCENDING = new CreatureSortDirection("ASCENDING");
    public static final CreatureSortDirection DESCENDING = new CreatureSortDirection("DESCENDING");

    private final String name;

    private CreatureSortDirection(String name) {
        this.name = name;
    }

    public String name() {
        return name;
    }

    public static CreatureSortDirection valueOf(String value) {
        return "DESCENDING".equals(value) ? DESCENDING : ASCENDING;
    }

    @Override
    public String toString() {
        return name;
    }
}
