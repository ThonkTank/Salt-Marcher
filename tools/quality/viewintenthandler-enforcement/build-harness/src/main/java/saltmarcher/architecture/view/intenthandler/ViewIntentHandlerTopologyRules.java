package saltmarcher.architecture.view.intenthandler;

import java.util.List;
import java.util.Map;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.view.ViewRole;
import saltmarcher.architecture.view.ViewSourceDescriptor;
import saltmarcher.architecture.view.ViewTopologyCatalog;
import saltmarcher.architecture.view.ViewUnitDescriptor;
import saltmarcher.architecture.view.ViewUnitKind;

public final class ViewIntentHandlerTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Map<ViewUnitDescriptor, List<ViewSourceDescriptor>> units =
                ViewTopologyCatalog.groupRecognizedUnits(context.sourceFiles(violations));
        for (Map.Entry<ViewUnitDescriptor, List<ViewSourceDescriptor>> entry : units.entrySet()) {
            ViewUnitDescriptor unit = entry.getKey();
            long intentHandlerCount = entry.getValue().stream()
                    .filter(source -> source.role() == ViewRole.INTENT_HANDLER)
                    .count();
            if (unit.kind() == ViewUnitKind.ACTIVE_ROOT && intentHandlerCount > 1) {
                violations.add(unit.source(), "view-intenthandler-count",
                        "Each active view root may define at most one *IntentHandler.java file.");
            }
            if (unit.kind() == ViewUnitKind.REUSABLE_SLOTCONTENT && intentHandlerCount > 0) {
                violations.add(unit.source(), "view-slotcontent-intenthandler-count",
                        "Reusable slotcontent units must not define *IntentHandler.java files.");
            }
        }
    }
}
