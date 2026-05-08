package saltmarcher.architecture.view.inspectorentry;

import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.view.ViewRole;
import saltmarcher.architecture.view.ViewSourceDescriptor;
import saltmarcher.architecture.view.ViewTopologyCatalog;

public final class ViewInspectorEntryTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        for (ViewSourceDescriptor descriptor : ViewTopologyCatalog.describeViewSources(context.sourceFiles(violations))) {
            if (descriptor.role() != ViewRole.INSPECTOR_ENTRY) {
                continue;
            }
            violations.add(descriptor.source(), "view-inspectorentry-forbidden",
                    "*InspectorEntry.java is no longer a legal top-level view-layer role. Reusable slotcontent units must stay closed to *View.java, same-stem *ViewInputEvent.java, and *ContentModel.java only.");
        }
    }
}
