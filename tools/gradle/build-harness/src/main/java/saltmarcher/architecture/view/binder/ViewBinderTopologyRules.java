package saltmarcher.architecture.view.binder;

import java.util.List;
import java.util.Map;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.view.ViewRoleSupport;

public final class ViewBinderTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Map<ViewRoleSupport.ViewUnit, List<SourceFile>> units =
                ViewRoleSupport.groupByUnit(context.sourceFiles(violations));
        for (Map.Entry<ViewRoleSupport.ViewUnit, List<SourceFile>> entry : units.entrySet()) {
            ViewRoleSupport.ViewUnit unit = entry.getKey();
            long binderCount = entry.getValue().stream().filter(ViewRoleSupport::isBinderFile).count();
            if (ViewRoleSupport.isSlotcontent(unit)) {
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
