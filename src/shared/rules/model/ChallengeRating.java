package shared.rules.model;

/**
 * Canonical shared Challenge Rating (CR) value.
 *
 * <p>CR stays stored and displayed in its original string form for DB round-trip fidelity, while the
 * numeric equivalent is computed once so shared rules and feature-owned workflows can reuse it.
 */
@SuppressWarnings("unused")
public final class ChallengeRating {
    public final String display;
    public final double numeric;

    private ChallengeRating(String raw) {
        this.display = raw;
        this.numeric = parseNumeric(raw);
    }

    public static ChallengeRating of(String raw) {
        if (raw == null) {
            throw new IllegalArgumentException("CR string cannot be null");
        }
        if (raw.isBlank()) {
            throw new IllegalArgumentException("CR string cannot be blank");
        }
        return new ChallengeRating(raw);
    }

    private static double parseNumeric(String raw) {
        if (raw.contains("/")) {
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
        }
        try {
            return Double.parseDouble(raw.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid CR: " + raw, e);
        }
    }

    @Override
    public String toString() {
        return display;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ChallengeRating that)) return false;
        return Double.compare(numeric, that.numeric) == 0;
    }

    @Override
    public int hashCode() {
        return Double.hashCode(numeric);
    }
}
