package features.partyanalysis.input;

@SuppressWarnings("unused")
public record RebuildCurrentPartyCacheAsyncBestEffortInput() {

    public record RebuiltCurrentPartyCacheAsyncBestEffortInput(boolean triggered) {
    }
}
