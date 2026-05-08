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
                if (ViewRoleSupport.isActiveRoot(unit) && !isAllowedActiveRootFile(sourceFile)) {
                    violations.add(sourceFile.relativePath(), "view-layer-active-root-file-role",
                            "Active contribution roots may contain only *Contribution.java, *Binder.java, *ContributionModel.java, optional *IntentHandler.java, passive *View.java, optional *ViewInputEvent.java files, and optional write-side *PublishedEvent.java files. Move projection, formatting, or selection preparation into the owning *ContributionModel or into nested/private helper types inside an allowed role file instead of adding standalone helper files.");
                } else if (ViewRoleSupport.isSlotcontent(unit) && !isAllowedSlotcontentFile(sourceFile)) {
                    violations.add(sourceFile.relativePath(), "view-layer-slotcontent-file-role",
                            "Reusable slotcontent units may contain only exactly one passive *View.java file, exactly one same-stem *ViewInputEvent.java file, and exactly one *ContentModel.java file. Top-level *IntentHandler.java, *PublishedEvent.java, *InspectorEntry.java, *Scene.java, *PointerEvent.java, *Signal.java, *Support.java, and standalone helper files are illegal reusable slotcontent roles.");
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
        long intentHandlerCount = files.stream().filter(ViewRoleSupport::isIntentHandlerFile).count();
        long viewInputEventCount = files.stream().filter(ViewRoleSupport::isViewInputEventFile).count();
        long publishedEventCount = files.stream().filter(ViewRoleSupport::isPublishedEventFile).count();
        long inspectorEntryCount = files.stream().filter(ViewRoleSupport::isInspectorEntryFile).count();
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
            if (contentModelCount != 1) {
                violations.add(unit.source(), "view-layer-slotcontent-contentmodel-count",
                        "Each reusable slotcontent unit must define exactly one *ContentModel.java file.");
            }
            if (intentHandlerCount > 0) {
                violations.add(unit.source(), "view-layer-slotcontent-no-intenthandler",
                        "Reusable slotcontent units must not define *IntentHandler.java files.");
            }
            if (viewInputEventCount != 1) {
                violations.add(unit.source(), "view-layer-slotcontent-viewinputevent-count",
                        "Each reusable slotcontent unit must define exactly one same-stem *ViewInputEvent.java file.");
            }
            if (publishedEventCount > 0) {
                violations.add(unit.source(), "view-layer-slotcontent-no-publishedevent",
                        "Reusable slotcontent units must not define *PublishedEvent.java files.");
            }
            if (inspectorEntryCount > 0) {
                violations.add(unit.source(), "view-layer-slotcontent-no-inspectorentry",
                        "Reusable slotcontent units must not define *InspectorEntry.java files.");
            }
            if (viewCount != 1) {
                violations.add(unit.source(), "view-layer-slotcontent-view-count",
                        "Each reusable slotcontent unit must define exactly one top-level *View.java file.");
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
