package shell.host;

/**
 * Open shell-owned SPI for contributing runtime services without hard-wiring feature adapters into bootstrap.
 */
public interface RuntimeServiceProvider {

    void register(RuntimeServiceRegistry.Builder builder);
}
