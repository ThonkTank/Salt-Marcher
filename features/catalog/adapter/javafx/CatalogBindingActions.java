package features.catalog.adapter.javafx;

import java.util.function.LongConsumer;
import shell.api.InspectorSink;

public record CatalogBindingActions(
        InspectorSink inspector,
        LongConsumer openCreatureInspector,
        LongConsumer openNpcInspector,
        LongConsumer openFactionInspector,
        LongConsumer openLocationInspector,
        Runnable createNpc,
        Runnable createFaction,
        Runnable createLocation
) {
}
