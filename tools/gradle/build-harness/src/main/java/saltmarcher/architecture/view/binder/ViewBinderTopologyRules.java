package saltmarcher.architecture.view.binder;

import java.util.List;
import java.util.Map;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.view.ViewRole;
import saltmarcher.architecture.view.ViewTopologyCatalog;
import saltmarcher.architecture.view.ViewUnitDescriptor;
import saltmarcher.architecture.view.ViewUnitKind;

public final class ViewBinderTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Map<ViewUnitDescriptor, List<saltmarcher.architecture.view.ViewSourceDescriptor>> units =
                ViewTopologyCatalog.groupRecognizedUnits(context.sourceFiles(violations));
        for (Map.Entry<ViewUnitDescriptor, List<saltmarcher.architecture.view.ViewSourceDescriptor>> entry : units.entrySet()) {
            ViewUnitDescriptor unit = entry.getKey();
            long binderCount = entry.getValue().stream().filter(source -> source.role() == ViewRole.BINDER).count();
            if (unit.kind() == ViewUnitKind.REUSABLE_SLOTCONTENT) {
                if (binderCount > 0) {
                    violations.add(unit.source(), "view-slotcontent-no-binder",
                            "Reusable slotcontent units must not define *Binder.java lifecycle owners.");
                }
                continue;
            }
            if (binderCount != 1) {
                violations.add(unit.source(), "view-binder-count",
                        "Each active view root must define exactly one *Binder.java lifecycle and wiring owner.");
            }
        }
    }
}
