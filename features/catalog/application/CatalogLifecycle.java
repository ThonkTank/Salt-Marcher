package features.catalog.application;

public interface CatalogLifecycle extends AutoCloseable {
    void activate();
    void deactivate();
    @Override
    void close();
}
