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
            if (!descriptor.role().isAllowedIn(descriptor.unit().kind())) {
                String rule = descriptor.isActiveRootSource()
                        ? "view-topology-active-root-role"
                        : "view-topology-slotcontent-role";
                String details = descriptor.isActiveRootSource()
                        ? "Active view roots may contain only *Contribution.java, *Binder.java, *ContributionModel.java, optional *IntentHandler.java, passive *View.java, optional *ViewInputEvent.java, and optional *PublishedEvent.java files."
                        : "Reusable slotcontent units may contain only exactly one passive *View.java file, exactly one same-stem *ViewInputEvent.java file, and exactly one *ContentModel.java file. Every other top-level role file in slotcontent/** is illegal.";
                violations.add(descriptor.source(), rule, details);
                continue;
            }
            if (descriptor.isActiveRootSource() && descriptor.role() == ViewRole.UNKNOWN) {
                violations.add(descriptor.source(), "view-topology-active-root-role",
                        "Active view roots may contain only *Contribution.java, *Binder.java, *ContributionModel.java, optional *IntentHandler.java, passive *View.java, optional *ViewInputEvent.java, and optional *PublishedEvent.java files.");
                continue;
            }
            if (descriptor.isSlotcontentSource() && descriptor.role() == ViewRole.UNKNOWN) {
                violations.add(descriptor.source(), "view-topology-slotcontent-role",
                        "Reusable slotcontent units may contain only exactly one passive *View.java file, exactly one same-stem *ViewInputEvent.java file, and exactly one *ContentModel.java file. Every other top-level role file in slotcontent/** is illegal.");
            }
        }
    }
}
