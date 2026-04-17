package shell.host;

public interface PersistenceContribution {

    void register(PersistenceRegistry.Builder builder);
}
