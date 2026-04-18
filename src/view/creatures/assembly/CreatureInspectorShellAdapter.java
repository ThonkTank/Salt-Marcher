package src.view.creatures.assembly;

import java.util.Objects;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import src.domain.creatures.api.CreatureDetail;
import src.view.creatures.ViewModel.CreatureInspectorPublisher;

public final class CreatureInspectorShellAdapter implements CreatureInspectorPublisher {

    private final InspectorSink inspector;

    public CreatureInspectorShellAdapter(InspectorSink inspector) {
        this.inspector = Objects.requireNonNull(inspector, "inspector");
    }

    @Override
    public boolean isShowing(Object inspectorKey) {
        return inspector.isShowing(inspectorKey);
    }

    @Override
    public void show(CreatureDetail detail, Object inspectorKey) {
        inspector.push(new InspectorEntrySpec(
                detail.name(),
                inspectorKey,
                () -> CreatureInspectorContentFactory.build(detail),
                null
        ));
    }
}
