package saltmarcher.architecture.view.intenthandler;

import java.util.List;
import java.util.Map;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.view.ViewRoleSupport;

public final class ViewIntentHandlerTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Map<ViewRoleSupport.ViewUnit, List<SourceFile>> units =
                ViewRoleSupport.groupByUnit(context.sourceFiles(violations));
        for (Map.Entry<ViewRoleSupport.ViewUnit, List<SourceFile>> entry : units.entrySet()) {
            ViewRoleSupport.ViewUnit unit = entry.getKey();
            long intentHandlerCount = entry.getValue().stream().filter(ViewRoleSupport::isIntentHandlerFile).count();
            if (ViewRoleSupport.isActiveRoot(unit) && intentHandlerCount > 1) {
                violations.add(unit.source(), "view-intenthandler-count",
                        "Each active view root may define at most one *IntentHandler.java file.");
            }
            if (ViewRoleSupport.isSlotcontent(unit) && intentHandlerCount > 1) {
                violations.add(unit.source(), "view-slotcontent-intenthandler-count",
                        "Each reusable slotcontent unit may define at most one *IntentHandler.java file.");
            }
        }
    }
}
