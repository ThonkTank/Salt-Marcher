package saltmarcher.architecture.view.inspectorentry;

import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.view.ViewRoleSupport;

public final class ViewInspectorEntryTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        for (SourceFile sourceFile : context.sourceFiles(violations)) {
            if (!ViewRoleSupport.isInspectorEntryFile(sourceFile)) {
                continue;
            }
            violations.add(sourceFile.relativePath(), "view-inspectorentry-forbidden",
                    "*InspectorEntry.java is no longer a legal top-level view-layer role. Reusable slotcontent units must stay closed to *View.java, same-stem *ViewInputEvent.java, and *ContentModel.java only.");
        }
    }
}
