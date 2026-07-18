package features.catalog.application;

public enum MonsterCatalogSort {
    NAME_ASC("name-asc", "Name (A-Z)", "NAME", "ASCENDING"),
    NAME_DESC("name-desc", "Name (Z-A)", "NAME", "DESCENDING"),
    CHALLENGE_RATING_ASC("cr-asc", "CR (aufst.)", "CHALLENGE_RATING", "ASCENDING"),
    CHALLENGE_RATING_DESC("cr-desc", "CR (abst.)", "CHALLENGE_RATING", "DESCENDING"),
    XP_ASC("xp-asc", "XP (aufst.)", "XP", "ASCENDING"),
    XP_DESC("xp-desc", "XP (abst.)", "XP", "DESCENDING");

    private final String key;
    private final String label;
    private final String providerField;
    private final String providerDirection;

    MonsterCatalogSort(String key, String label, String providerField, String providerDirection) {
        this.key = key;
        this.label = label;
        this.providerField = providerField;
        this.providerDirection = providerDirection;
    }

    public String key() {
        return key;
    }

    public String label() {
        return label;
    }

    String providerField() {
        return providerField;
    }

    String providerDirection() {
        return providerDirection;
    }

    @Override
    public String toString() {
        return label;
    }
}
