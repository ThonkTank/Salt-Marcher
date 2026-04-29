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

            ViewRoleSupport.ViewUnit unit = ViewRoleSupport.viewUnit(sourceFile);
            if (unit == null || !ViewRoleSupport.isSlotcontent(unit)) {
                violations.add(sourceFile.relativePath(), "view-inspectorentry-slotcontent-only",
                        "*InspectorEntry.java files may exist only inside reusable slotcontent units.");
            }
        }
    }
}
