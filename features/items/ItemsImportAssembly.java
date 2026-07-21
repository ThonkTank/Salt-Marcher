package features.items;

import features.items.adapter.http.Dnd5e2014HttpItemSource;
import features.items.adapter.sqlite.SqliteItemImportStore;
import features.items.api.ItemsImportApi;
import features.items.application.ItemsImportService;
import features.items.domain.importing.ItemImportStore;
import features.items.domain.importing.PublicItemSource;

import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import platform.persistence.FeatureStoreMaintenance;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Objects;

/** Operator-only composition root; never used by desktop startup. */
public final class ItemsImportAssembly {

    private ItemsImportAssembly() {}

    public static ItemsImportApi create(
            FeatureStoreMaintenance maintenance,
            ExecutionLane executionLane,
            Diagnostics diagnostics
    ) {
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        return create(maintenance, executionLane, diagnostics, client);
    }

    public static ItemsImportApi create(
            FeatureStoreMaintenance maintenance,
            ExecutionLane executionLane,
            Diagnostics diagnostics,
            HttpClient httpClient
    ) {
        return create(
                new Dnd5e2014HttpItemSource(Objects.requireNonNull(httpClient, "httpClient")),
                new SqliteItemImportStore(maintenance),
                executionLane,
                diagnostics);
    }

    public static ItemsImportApi create(
            PublicItemSource publicSource,
            ItemImportStore importStore,
            ExecutionLane executionLane,
            Diagnostics diagnostics
    ) {
        return new ItemsImportService(publicSource, importStore, executionLane, diagnostics);
    }
}
