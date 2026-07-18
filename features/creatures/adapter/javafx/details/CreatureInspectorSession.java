package features.creatures.adapter.javafx.details;

import features.creatures.api.CreatureDetailQueryApi;
import features.creatures.api.CreatureDetailResult;
import java.util.Objects;
import java.util.concurrent.CompletionStage;
import platform.ui.UiDispatcher;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;

/** One isolated Inspector load; it never observes global creature selection. */
public final class CreatureInspectorSession {

    private final long creatureId;
    private final UiDispatcher dispatcher;
    private final CompletionStage<CreatureDetailResult> detail;

    public CreatureInspectorSession(
            CreatureDetailQueryApi queries,
            UiDispatcher dispatcher,
            long creatureId
    ) {
        this.creatureId = creatureId;
        this.dispatcher = Objects.requireNonNull(dispatcher, "dispatcher");
        detail = Objects.requireNonNull(queries, "queries").load(creatureId);
    }

    public void open(InspectorSink inspector) {
        if (creatureId <= 0L) {
            return;
        }
        Objects.requireNonNull(inspector, "inspector").push(new InspectorEntrySpec(
                "Creature",
                "creature:" + creatureId,
                () -> CreatureDetailsView.loading(detail, dispatcher),
                null));
    }
}
