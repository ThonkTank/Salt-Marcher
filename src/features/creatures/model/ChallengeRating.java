package features.creatures.model;

/**
 * Encapsulates a creature's Challenge Rating (CR).
 *
 * <p>CR is stored in the database as a string (e.g., "1/4", "1/2", "14") to preserve
 * the original format for round-trip persistence. This class computes the numeric
 * equivalent once at construction, consolidating all CR parsing logic in one place.
 *
 * <p>Game-rule computations derived from CR (proficiency bonus, sort index) live in
 * {@link features.creatures.service.DndMath} to keep this class a pure data container.
 */
public final class ChallengeRating {
    public final String display;   // "1/4", "1/2", "14" — original string, for DB round-trip
    public final double numeric;   // 0.25, 0.5, 14.0 — computed once at construction

    private ChallengeRating(String raw) {
        this.display = raw;
        this.numeric = parseNumeric(raw);
    }

    /**
     * Factory method to create a ChallengeRating from a raw database string.
     * @param raw The CR string from the database (e.g., "1/4", "1/2", "14", etc.)
     * @return A ChallengeRating with numeric value computed
     * @throws IllegalArgumentException if raw is null or cannot be parsed
     */
    public static ChallengeRating of(String raw) {
        if (raw == null) {
            throw new IllegalArgumentException("CR string cannot be null");
        }
        if (raw.isBlank()) {
            throw new IllegalArgumentException("CR string cannot be blank");
        }
        return new ChallengeRating(raw);
    }

    /**
     * Parse the numeric equivalent of a CR string.
     * Handles fractions ("1/4", "1/2", etc.) and whole numbers ("1", "14", etc.).
     */
    private static double parseNumeric(String raw) {
        if (raw.contains("/")) {
            // Fractional CR: "1/4", "1/2", etc.
            String[] parts = raw.split("/");
            if (parts.length != 2) {
                throw new IllegalArgumentException("Invalid fractional CR: " + raw);
            }
            try {
                double numerator = Double.parseDouble(parts[0].trim());
                double denominator = Double.parseDouble(parts[1].trim());
                if (denominator == 0) {
                    throw new IllegalArgumentException("CR denominator cannot be zero: " + raw);
                }
                return numerator / denominator;
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Invalid fractional CR: " + raw, e);
            }
        } else {
            // Whole number CR: "1", "14", etc.
            try {
                return Double.parseDouble(raw.trim());
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Invalid CR: " + raw, e);
            }
        }
    }

    @Override
    public String toString() {
        return display;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ChallengeRating)) return false;
        ChallengeRating that = (ChallengeRating) o;
        return Double.compare(numeric, that.numeric) == 0;
    }

    @Override
    public int hashCode() {
        return Double.hashCode(numeric);
    }
}
