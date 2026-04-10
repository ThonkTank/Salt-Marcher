package features.creatures.model;

/**
 * Creature-package compatibility wrapper around the shared CR value.
 *
 * <p>`shared.rules.model.ChallengeRating` is the canonical cross-feature home. This wrapper keeps the
 * existing creature-owned callers stable while the remaining consumers migrate slice by slice.
 */
@SuppressWarnings("unused")
public final class ChallengeRating {
    public final String display;
    public final double numeric;

    private final shared.rules.model.ChallengeRating model;

    private ChallengeRating(shared.rules.model.ChallengeRating model) {
        this.model = model;
        this.display = model.display;
        this.numeric = model.numeric;
    }

    public static ChallengeRating of(String raw) {
        return new ChallengeRating(shared.rules.model.ChallengeRating.of(raw));
    }

    public shared.rules.model.ChallengeRating model() {
        return model;
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
