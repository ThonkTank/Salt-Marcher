package shell.api;

@FunctionalInterface
public interface StateTabSink {
    void activate(ContributionKey key);
}
