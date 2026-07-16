package features.items;

import features.items.adapter.http.Dnd5e2014HttpItemSource;
import features.items.adapter.sqlite.SqliteItemCatalogAdapter;
import features.items.api.ItemsCatalogApi;
import features.items.api.ItemsImportApi;
import features.items.application.ItemsApplicationService;
import features.items.domain.catalog.ItemCatalogPort;
import features.items.domain.importing.ItemImportStore;
import features.items.domain.importing.PublicItemSource;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Objects;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import platform.persistence.SqliteDatabase;

public final class ItemsServiceAssembly {

    private ItemsServiceAssembly() {
    }

    public static Component create(
            SqliteDatabase database,
            ExecutionLane executionLane,
            Diagnostics diagnostics
    ) {
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        return create(database, executionLane, diagnostics, client);
    }

    public static Component create(
            SqliteDatabase database,
            ExecutionLane executionLane,
            Diagnostics diagnostics,
            HttpClient httpClient
    ) {
        SqliteItemCatalogAdapter sqlite = new SqliteItemCatalogAdapter(
                Objects.requireNonNull(database, "database"));
        return create(
                sqlite,
                new Dnd5e2014HttpItemSource(Objects.requireNonNull(httpClient, "httpClient")),
                sqlite,
                executionLane,
                diagnostics);
    }

    public static Component create(
            ItemCatalogPort catalog,
            PublicItemSource publicSource,
            ItemImportStore importStore,
            ExecutionLane executionLane,
            Diagnostics diagnostics
    ) {
        ItemsApplicationService service = new ItemsApplicationService(
                catalog,
                publicSource,
                importStore,
                executionLane,
                diagnostics);
        return new Component(service, service);
    }

    public record Component(ItemsCatalogApi catalog, ItemsImportApi importer) {
    }
}
