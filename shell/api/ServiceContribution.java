package shell.api;

/**
 * Open shell-owned SPI for contributing feature services without hard-wiring adapters into bootstrap.
 */
public interface ServiceContribution {

    void register(ServiceRegistry.Builder builder);
}
