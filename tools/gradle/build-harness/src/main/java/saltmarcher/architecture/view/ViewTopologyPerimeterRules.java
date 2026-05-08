package saltmarcher.architecture.view;

import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;

public final class ViewTopologyPerimeterRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        for (SourceFile sourceFile : context.sourceFiles(violations)) {
            if (!ViewRoleSupport.isViewSource(sourceFile)) {
                continue;
            }
            if (!ViewRoleSupport.isRecognizedViewSource(sourceFile)) {
                violations.add(sourceFile.relativePath(), "view-topology-directory",
                        "View Java sources may live only under src/view/leftbartabs/<entry>/, src/view/statetabs/<entry>/, src/view/dropdowns/<entry>/, or src/view/slotcontent/<controls|main|state|details|topbar|primitives>/<entry>/ as direct files.");
                continue;
            }
            if (ViewRoleSupport.isRecognizedActiveRootSource(sourceFile)
                    && !isAllowedActiveRootFile(sourceFile)) {
                violations.add(sourceFile.relativePath(), "view-topology-active-root-role",
                        "Active view roots may contain only *Contribution.java, *Binder.java, *ContributionModel.java, optional *IntentHandler.java, passive *View.java, optional *ViewInputEvent.java, and optional *PublishedEvent.java files.");
                continue;
            }
            if (ViewRoleSupport.isRecognizedSlotcontentSource(sourceFile)
                    && !isAllowedSlotcontentFile(sourceFile)) {
                violations.add(sourceFile.relativePath(), "view-topology-slotcontent-role",
                        "Reusable slotcontent units may contain only exactly one passive *View.java file, exactly one same-stem *ViewInputEvent.java file, and exactly one *ContentModel.java file. Every other top-level role file in slotcontent/** is illegal.");
            }
        }
    }

    private static boolean isAllowedActiveRootFile(SourceFile sourceFile) {
        return ViewRoleSupport.isContributionFile(sourceFile)
                || ViewRoleSupport.isBinderFile(sourceFile)
                || ViewRoleSupport.isContributionModelFile(sourceFile)
                || ViewRoleSupport.isIntentHandlerFile(sourceFile)
                || ViewRoleSupport.isPassiveViewFile(sourceFile)
                || ViewRoleSupport.isViewInputEventFile(sourceFile)
                || ViewRoleSupport.isPublishedEventFile(sourceFile);
    }

    private static boolean isAllowedSlotcontentFile(SourceFile sourceFile) {
        return ViewRoleSupport.isContentModelFile(sourceFile)
                || ViewRoleSupport.isPassiveViewFile(sourceFile)
                || ViewRoleSupport.isViewInputEventFile(sourceFile);
    }
}
