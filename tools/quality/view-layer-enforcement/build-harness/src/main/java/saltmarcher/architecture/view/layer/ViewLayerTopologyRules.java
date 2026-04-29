package saltmarcher.architecture.view.layer;

import java.util.List;
import java.util.Map;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.view.ViewRoleSupport;

public final class ViewLayerTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Map<ViewRoleSupport.ViewUnit, List<SourceFile>> units =
                ViewRoleSupport.groupByUnit(context.sourceFiles(violations));
        for (Map.Entry<ViewRoleSupport.ViewUnit, List<SourceFile>> entry : units.entrySet()) {
            ViewRoleSupport.ViewUnit unit = entry.getKey();
            List<SourceFile> files = entry.getValue();
            for (SourceFile sourceFile : files) {
                if (ViewRoleSupport.isInspectorEntryFile(sourceFile)) {
                    continue;
                }
                if (ViewRoleSupport.isActiveRoot(unit) && !isAllowedActiveRootFile(sourceFile)) {
                    violations.add(sourceFile.relativePath(), "view-layer-active-root-file-role",
                            "Active contribution roots may contain only *Contribution.java, *Binder.java, *ContributionModel.java, optional *IntentHandler.java, passive *View.java, optional *ViewInputEvent.java files, and optional write-side *PublishedEvent.java files.");
                } else if (ViewRoleSupport.isSlotcontent(unit) && !isAllowedSlotcontentFile(sourceFile)) {
                    violations.add(sourceFile.relativePath(), "view-layer-slotcontent-file-role",
                            "Reusable slotcontent units may contain only passive *View.java files, optional *ContentModel.java files, optional *IntentHandler.java files, optional *ViewInputEvent.java files, optional write-side *PublishedEvent.java files, *InspectorEntry.java adapters, and the allowed mapcanvas support carriers.");
                }
            }
            validateUnitShape(unit, files, violations);
        }
    }

    private static void validateUnitShape(
            ViewRoleSupport.ViewUnit unit,
            List<SourceFile> files,
            ViolationSink violations) {
        long contributionCount = files.stream().filter(ViewRoleSupport::isContributionFile).count();
        long binderCount = files.stream().filter(ViewRoleSupport::isBinderFile).count();
        long contributionModelCount = files.stream().filter(ViewRoleSupport::isContributionModelFile).count();
        long contentModelCount = files.stream().filter(ViewRoleSupport::isContentModelFile).count();
        long viewCount = files.stream().filter(ViewRoleSupport::isPassiveViewFile).count();

        if (ViewRoleSupport.isActiveRoot(unit)) {
            if (contributionCount != 1) {
                violations.add(unit.source(), "view-layer-contribution-count",
                        "Each active contribution root must define exactly one shell-discovered *Contribution.java file.");
            }
            if (binderCount != 1) {
                violations.add(unit.source(), "view-layer-binder-count",
                        "Each active contribution root must define exactly one *Binder.java lifecycle and wiring owner.");
            }
            if (contributionModelCount != 1) {
                violations.add(unit.source(), "view-layer-contributionmodel-count",
                        "Each active contribution root must define exactly one aggregate *ContributionModel.java file.");
            }
            if (contentModelCount > 0) {
                violations.add(unit.source(), "view-layer-contentmodel-forbidden",
                        "Active contribution roots must not define reusable *ContentModel.java files.");
            }
            if (viewCount < 1) {
                violations.add(unit.source(), "view-layer-view-required",
                        "Each active contribution root must define at least one passive *View.java surface.");
            }
        } else {
            if (contributionCount > 0) {
                violations.add(unit.source(), "view-layer-slotcontent-no-contribution",
                        "Reusable slotcontent units must not define *Contribution.java shell entrypoints.");
            }
            if (binderCount > 0) {
                violations.add(unit.source(), "view-layer-slotcontent-no-binder",
                        "Reusable slotcontent units must not define *Binder.java lifecycle owners.");
            }
            if (contributionModelCount > 0) {
                violations.add(unit.source(), "view-layer-slotcontent-no-contributionmodel",
                        "Reusable slotcontent units must not define active-root *ContributionModel.java files.");
            }
            if (contentModelCount > 1) {
                violations.add(unit.source(), "view-layer-slotcontent-contentmodel-count",
                        "Each reusable slotcontent unit may define at most one *ContentModel.java file.");
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
                || ViewRoleSupport.isIntentHandlerFile(sourceFile)
                || ViewRoleSupport.isPassiveViewFile(sourceFile)
                || ViewRoleSupport.isViewInputEventFile(sourceFile)
                || ViewRoleSupport.isPublishedEventFile(sourceFile)
                || ViewRoleSupport.isSharedMapCanvasCarrierFile(sourceFile);
    }
}
