package features.dungeon.domain.core.structure.transition;

import org.jspecify.annotations.Nullable;

public record TransitionDestinationTarget(Kind kind, long transitionId) {
    private static final long ABSENT_TRANSITION_ID = 0L;

    public TransitionDestinationTarget {
        kind = kind == null ? Kind.ABSENT : kind;
        transitionId = kind.isPresent() ? Math.max(ABSENT_TRANSITION_ID, transitionId) : ABSENT_TRANSITION_ID;
        if (kind.isPresent() && transitionId <= ABSENT_TRANSITION_ID) {
            kind = Kind.ABSENT;
            transitionId = ABSENT_TRANSITION_ID;
        }
    }

    public static TransitionDestinationTarget absent() {
        return new TransitionDestinationTarget(Kind.ABSENT, ABSENT_TRANSITION_ID);
    }

    public static TransitionDestinationTarget present(long transitionId) {
        return new TransitionDestinationTarget(Kind.PRESENT, transitionId);
    }

    public static TransitionDestinationTarget fromPositiveId(@Nullable Long transitionId) {
        return transitionId == null || transitionId <= ABSENT_TRANSITION_ID
                ? absent()
                : present(transitionId);
    }

    public boolean present() {
        return kind.isPresent();
    }

    public @Nullable Long asNullableLong() {
        return present() ? transitionId : null;
    }

    public enum Kind {
        ABSENT,
        PRESENT;

        private boolean isPresent() {
            return this == PRESENT;
        }
    }
}
