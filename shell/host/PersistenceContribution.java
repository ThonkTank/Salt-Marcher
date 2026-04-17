package shell.host;

/**
 * Open shell-owned SPI for contributing feature persistence capabilities without hard-wiring adapters into bootstrap.
 */
public interface PersistenceContribution {

    void register(PersistenceRegistry.Builder builder);
}
