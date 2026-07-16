package features.encounter.domain.session;

public final class Mode {

    public static final int BUILDER = 0;
    public static final int INITIATIVE = 1;
    public static final int COMBAT = 2;
    public static final int RESULTS = 3;

    private Mode() {
    }

    public static boolean isCombatMode(int mode) {
        return mode == COMBAT;
    }

    public static boolean isNotCombatMode(int mode) {
        return !isCombatMode(mode);
    }
}
