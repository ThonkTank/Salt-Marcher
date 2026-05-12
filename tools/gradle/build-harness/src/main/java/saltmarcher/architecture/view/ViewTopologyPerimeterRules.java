package saltmarcher.architecture.view;

import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;

public final class ViewTopologyPerimeterRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        for (ViewSourceDescriptor descriptor : ViewTopologyCatalog.describeViewSources(context.sourceFiles(violations))) {
            if (!descriptor.isRecognizedViewSource()) {
                violations.add(descriptor.source(), "view-topology-directory",
                        "View Java sources may live only under src/view/leftbartabs/<entry>/, src/view/statetabs/<entry>/, src/view/dropdowns/<entry>/, or src/view/slotcontent/<controls|main|state|details|topbar|primitives>/<entry>/ as direct files.");
                continue;
            }
            if (descriptor.role() == ViewRole.UNKNOWN || !descriptor.role().isAllowedIn(descriptor.unit().kind())) {
                violations.add(
                        descriptor.source(),
                        roleRule(descriptor.unit().kind()),
                        roleDetails(descriptor.unit().kind()));
            }
        }
    }

    private static String roleRule(ViewUnitKind unitKind) {
        return unitKind == ViewUnitKind.ACTIVE_ROOT
                ? "view-topology-active-root-role"
                : "view-topology-slotcontent-role";
    }

    private static String roleDetails(ViewUnitKind unitKind) {
        return unitKind == ViewUnitKind.ACTIVE_ROOT
                ? "Active view roots may contain only *Contribution.java, *Binder.java, exactly one aggregate *ContributionModel.java, optional *IntentHandler.java, passive *View.java, same-stem *ContentModel.java, and optional same-stem *ViewInputEvent.java files."
                : "Reusable slotcontent units may contain only exactly one passive *View.java file, exactly one *ContentModel.java file, and a same-stem *ViewInputEvent.java file only when that View is interactive. Every other top-level role file in slotcontent/** is illegal.";
    }
}
