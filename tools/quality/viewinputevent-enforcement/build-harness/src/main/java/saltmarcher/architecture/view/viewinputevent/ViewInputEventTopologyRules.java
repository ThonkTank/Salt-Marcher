package saltmarcher.architecture.view.viewinputevent;

import java.util.List;
import java.util.Map;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.view.ViewRoleSupport;

public final class ViewInputEventTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Map<ViewRoleSupport.ViewUnit, List<SourceFile>> units =
                ViewRoleSupport.groupByUnit(context.sourceFiles(violations));
        for (Map.Entry<ViewRoleSupport.ViewUnit, List<SourceFile>> entry : units.entrySet()) {
            ViewRoleSupport.ViewUnit unit = entry.getKey();
            List<SourceFile> files = entry.getValue();
            long viewCount = files.stream().filter(ViewRoleSupport::isPassiveViewFile).count();
            long intentHandlerCount = files.stream().filter(ViewRoleSupport::isIntentHandlerFile).count();
            long viewInputEventCount = files.stream().filter(ViewRoleSupport::isViewInputEventFile).count();
            if (intentHandlerCount == 0) {
                if (viewInputEventCount > 0) {
                    violations.add(unit.source(), "view-viewinputevent-no-intenthandler",
                            "*ViewInputEvent files may exist only when the view unit also defines a local *IntentHandler.");
                }
                continue;
            }
            if (viewCount == 0) {
                violations.add(unit.source(), "view-viewinputevent-view-required",
                        "Interactive view units with an *IntentHandler must also define at least one passive *View.java surface.");
            }
        }
    }
}
