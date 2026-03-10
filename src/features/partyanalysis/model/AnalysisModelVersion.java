package features.partyanalysis.model;

public final class AnalysisModelVersion {
    private static final int CURRENT = 4;

    private AnalysisModelVersion() {
        throw new AssertionError("No instances");
    }

    public static int current() {
        return CURRENT;
    }
}
