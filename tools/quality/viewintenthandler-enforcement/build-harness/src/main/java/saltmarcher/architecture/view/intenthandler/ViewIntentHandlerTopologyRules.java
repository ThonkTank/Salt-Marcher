package saltmarcher.architecture.view.intenthandler;

import java.util.List;
import java.util.Map;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;

public final class ViewIntentHandlerTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Map<ViewIntentHandlerTopologySupport.ViewUnit, List<SourceFile>> units =
                ViewIntentHandlerTopologySupport.groupByUnit(context.sourceFiles(violations));
        for (Map.Entry<ViewIntentHandlerTopologySupport.ViewUnit, List<SourceFile>> entry : units.entrySet()) {
            ViewIntentHandlerTopologySupport.ViewUnit unit = entry.getKey();
            long intentHandlerCount = entry.getValue().stream()
                    .filter(ViewIntentHandlerTopologySupport::isIntentHandlerFile)
                    .count();
            if (ViewIntentHandlerTopologySupport.isActiveRoot(unit) && intentHandlerCount > 1) {
                violations.add(unit.source(), "view-intenthandler-count",
                        "Each active view root may define at most one *IntentHandler.java file.");
            }
            if (ViewIntentHandlerTopologySupport.isSlotcontent(unit) && intentHandlerCount > 0) {
                violations.add(unit.source(), "view-slotcontent-intenthandler-count",
                        "Reusable slotcontent units must not define *IntentHandler.java files.");
            }
        }
    }
}
