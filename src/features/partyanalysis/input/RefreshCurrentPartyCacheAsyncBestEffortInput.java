package features.partyanalysis.input;

@SuppressWarnings("unused")
public record RefreshCurrentPartyCacheAsyncBestEffortInput() {

    public record RefreshedCurrentPartyCacheAsyncBestEffortInput(boolean triggered) {
    }
}
