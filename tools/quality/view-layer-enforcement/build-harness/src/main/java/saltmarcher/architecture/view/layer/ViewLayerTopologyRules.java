package saltmarcher.architecture.view.layer;

import java.util.List;
import java.util.Map;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.view.ViewRole;
import saltmarcher.architecture.view.ViewSourceDescriptor;
import saltmarcher.architecture.view.ViewTopologyCatalog;
import saltmarcher.architecture.view.ViewUnitDescriptor;
import saltmarcher.architecture.view.ViewUnitKind;

public final class ViewLayerTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Map<ViewUnitDescriptor, List<ViewSourceDescriptor>> units =
                ViewTopologyCatalog.groupRecognizedUnits(context.sourceFiles(violations));
        for (Map.Entry<ViewUnitDescriptor, List<ViewSourceDescriptor>> entry : units.entrySet()) {
            ViewUnitDescriptor unit = entry.getKey();
            List<ViewSourceDescriptor> files = entry.getValue();
            for (ViewSourceDescriptor source : files) {
                if (unit.kind() == ViewUnitKind.ACTIVE_ROOT && !source.role().isAllowedIn(ViewUnitKind.ACTIVE_ROOT)) {
                    violations.add(source.source(), "view-layer-active-root-file-role",
                            "Active contribution roots may contain only *Contribution.java, *Binder.java, *ContributionModel.java, optional *IntentHandler.java, passive *View.java, optional *ViewInputEvent.java files, and optional write-side *PublishedEvent.java files. Move projection, formatting, or selection preparation into the owning *ContributionModel or into nested/private helper types inside an allowed role file instead of adding standalone helper files.");
                } else if (unit.kind() == ViewUnitKind.REUSABLE_SLOTCONTENT
                        && !source.role().isAllowedIn(ViewUnitKind.REUSABLE_SLOTCONTENT)) {
                    violations.add(source.source(), "view-layer-slotcontent-file-role",
                            "Reusable slotcontent units may contain only exactly one passive *View.java file, exactly one same-stem *ViewInputEvent.java file, and exactly one *ContentModel.java file. Top-level *IntentHandler.java, *PublishedEvent.java, *InspectorEntry.java, *Scene.java, *PointerEvent.java, *Signal.java, *Support.java, and standalone helper files are illegal reusable slotcontent roles.");
                }
            }
            validateUnitShape(unit, files, violations);
        }
    }

    private static void validateUnitShape(
            ViewUnitDescriptor unit,
            List<ViewSourceDescriptor> files,
            ViolationSink violations) {
        long contributionCount = count(files, ViewRole.CONTRIBUTION);
        long binderCount = count(files, ViewRole.BINDER);
        long contributionModelCount = count(files, ViewRole.CONTRIBUTION_MODEL);
        long contentModelCount = count(files, ViewRole.CONTENT_MODEL);
        long intentHandlerCount = count(files, ViewRole.INTENT_HANDLER);
        long viewInputEventCount = count(files, ViewRole.VIEW_INPUT_EVENT);
        long publishedEventCount = count(files, ViewRole.PUBLISHED_EVENT);
        long inspectorEntryCount = count(files, ViewRole.INSPECTOR_ENTRY);
        long viewCount = count(files, ViewRole.VIEW);

        if (unit.kind() == ViewUnitKind.ACTIVE_ROOT) {
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

    private static long count(List<ViewSourceDescriptor> files, ViewRole role) {
        return files.stream().filter(source -> source.role() == role).count();
    }
}
