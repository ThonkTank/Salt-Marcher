package saltmarcher.architecture.view.layer;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.view.PassiveViewInputEventSeamSupport;
import saltmarcher.architecture.view.PassiveViewInputEventSeamSupport.InteractivePassiveView;
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
                            "Active contribution roots may contain only *Contribution.java, *Binder.java, *ContributionModel.java, optional *IntentHandler.java, passive *View.java, and optional *ViewInputEvent.java files. Move projection, formatting, or selection preparation into the owning *ContributionModel or into nested/private helper types inside an allowed role file instead of adding standalone helper files.");
                } else if (unit.kind() == ViewUnitKind.REUSABLE_SLOTCONTENT
                        && !source.role().isAllowedIn(ViewUnitKind.REUSABLE_SLOTCONTENT)) {
                    violations.add(source.source(), "view-layer-slotcontent-file-role",
                            "Reusable slotcontent units may contain only exactly one passive *View.java file, exactly one *ContentModel.java file, and a same-stem *ViewInputEvent.java file only when that View is interactive. Top-level *IntentHandler.java, *PublishedEvent.java, *InspectorEntry.java, *Scene.java, *PointerEvent.java, *Signal.java, *Support.java, and standalone helper files are illegal reusable slotcontent roles.");
                }
            }
            List<InteractivePassiveView> interactiveViews =
                    PassiveViewInputEventSeamSupport.scan(context, files, violations);
            validateUnitShape(unit, files, interactiveViews, violations);
        }
    }

    private static void validateUnitShape(
            ViewUnitDescriptor unit,
            List<ViewSourceDescriptor> files,
            List<InteractivePassiveView> interactiveViews,
            ViolationSink violations) {
        long contributionCount = count(files, ViewRole.CONTRIBUTION);
        long binderCount = count(files, ViewRole.BINDER);
        long contributionModelCount = count(files, ViewRole.CONTRIBUTION_MODEL);
        long contentModelCount = count(files, ViewRole.CONTENT_MODEL);
        long intentHandlerCount = count(files, ViewRole.INTENT_HANDLER);
        long viewInputEventCount = count(files, ViewRole.VIEW_INPUT_EVENT);
        long inspectorEntryCount = count(files, ViewRole.INSPECTOR_ENTRY);
        long viewCount = count(files, ViewRole.VIEW);
        Set<String> passiveViewStems = files.stream()
                .filter(source -> source.role() == ViewRole.VIEW)
                .map(ViewSourceDescriptor::stem)
                .filter(stem -> !stem.isBlank())
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
        Set<String> viewInputEventStems = files.stream()
                .filter(source -> source.role() == ViewRole.VIEW_INPUT_EVENT)
                .map(ViewSourceDescriptor::stem)
                .filter(stem -> !stem.isBlank())
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));

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
            if (count(files, ViewRole.PUBLISHED_EVENT) > 0) {
                violations.add(unit.source(), "view-layer-active-root-no-publishedevent",
                        "Active contribution roots must not define top-level *PublishedEvent.java files; domain writes leave through the root *IntentHandler -> *ApplicationService seam.");
            }
            if (intentHandlerCount > 1) {
                violations.add(unit.source(), "view-layer-intenthandler-count",
                        "Each active contribution root may define at most one local *IntentHandler.java file.");
            }
            if (intentHandlerCount == 0 && viewInputEventCount > 0) {
                violations.add(unit.source(), "view-layer-active-root-viewinputevent-no-intenthandler",
                        "Active contribution roots may define *ViewInputEvent.java files only when the same root also defines a local *IntentHandler.java file.");
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
            if (interactiveViews.isEmpty()) {
                if (viewInputEventCount > 0) {
                    violations.add(unit.source(), "view-layer-slotcontent-viewinputevent-count",
                            "Non-interactive reusable slotcontent units must not define *ViewInputEvent.java files.");
                }
            } else if (viewInputEventCount != 1) {
                violations.add(unit.source(), "view-layer-slotcontent-viewinputevent-count",
                        "Interactive reusable slotcontent units must define exactly one same-stem *ViewInputEvent.java file.");
            }
            if (count(files, ViewRole.PUBLISHED_EVENT) > 0) {
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

        validateProjectionRoleShape(unit, files, violations);
        validateSameStemViewInputEvents(
                unit,
                interactiveViews,
                passiveViewStems,
                viewInputEventStems,
                intentHandlerCount > 0,
                violations);
    }

    private static void validateProjectionRoleShape(
            ViewUnitDescriptor unit,
            List<ViewSourceDescriptor> files,
            ViolationSink violations
    ) {
        for (ViewSourceDescriptor source : files) {
            if (source.role() == ViewRole.LEGACY_VIEW_MODEL || source.role() == ViewRole.PROJECTOR) {
                violations.add(source.source(), "view-layer-legacy-projection-role",
                        "View architecture must use *ContributionModel.java or *ContentModel.java and must not retain *ViewModel.java, *PresentationModel.java, or *Projector.java role files.");
                continue;
            }
            if (!source.role().isProjectionModel()) {
                continue;
            }
            if (unit.kind() == ViewUnitKind.ACTIVE_ROOT && source.role() != ViewRole.CONTRIBUTION_MODEL) {
                violations.add(source.source(), "view-layer-active-root-projection-role",
                        "Active contribution roots must name their aggregate projection role *ContributionModel.java.");
            }
            if (unit.kind() == ViewUnitKind.REUSABLE_SLOTCONTENT && source.role() != ViewRole.CONTENT_MODEL) {
                violations.add(source.source(), "view-layer-slotcontent-projection-role",
                        "Reusable slotcontent units must name their reusable projection role *ContentModel.java.");
            }
        }
    }

    private static void validateSameStemViewInputEvents(
            ViewUnitDescriptor unit,
            List<InteractivePassiveView> interactiveViews,
            Set<String> passiveViewStems,
            Set<String> viewInputEventStems,
            boolean hasIntentHandler,
            ViolationSink violations
    ) {
        if (unit.kind() == ViewUnitKind.ACTIVE_ROOT && !interactiveViews.isEmpty() && viewInputEventStems.isEmpty()) {
            violations.add(unit.source(), "view-layer-interactive-viewinputevent-required",
                    "Interactive active-root Views must own same-stem *ViewInputEvent.java files in the same view unit.");
        }
        for (String eventStem : viewInputEventStems) {
            if (!passiveViewStems.contains(eventStem)) {
                violations.add(unit.source(), "view-layer-viewinputevent-same-stem",
                        "*ViewInputEvent files must belong to a same-stem passive *View.java surface in the same view unit.");
            }
        }
        for (InteractivePassiveView interactiveView : interactiveViews) {
            validateInteractiveView(unit, interactiveView, viewInputEventStems, hasIntentHandler, violations);
        }
    }

    private static void validateInteractiveView(
            ViewUnitDescriptor unit,
            InteractivePassiveView interactiveView,
            Set<String> viewInputEventStems,
            boolean hasIntentHandler,
            ViolationSink violations
    ) {
        String expectedEvent = interactiveView.expectedViewInputEventSimpleName();
        String declaredEvent = interactiveView.declaredEventSimpleName();
        if (declaredEvent == null) {
            violations.add(interactiveView.source(), "view-layer-viewinputevent-same-stem",
                    "Passive *View surfaces that expose onViewInputEvent(...) must use Consumer<SameStemViewInputEvent> and own a same-stem *ViewInputEvent.java file in the same view unit.");
            return;
        }
        if (!expectedEvent.equals(declaredEvent)) {
            violations.add(interactiveView.source(), "view-layer-viewinputevent-same-stem",
                    "Passive *View surfaces that expose onViewInputEvent(...) must use their own same-stem carrier. Expected "
                            + expectedEvent + " but found " + declaredEvent + ".");
            return;
        }
        if (!viewInputEventStems.contains(interactiveView.viewStem())) {
            violations.add(interactiveView.source(), "view-layer-viewinputevent-same-stem",
                    "Passive *View surfaces that expose onViewInputEvent(...) must own a same-stem *ViewInputEvent.java file in the same view unit. Missing "
                            + expectedEvent + ".");
        }
        if (unit.kind() == ViewUnitKind.ACTIVE_ROOT && !hasIntentHandler) {
            violations.add(interactiveView.source(), "view-layer-interactive-active-root-intenthandler-required",
                    "Active-root passive *View surfaces that expose onViewInputEvent(...) may exist only when the same view unit also defines a local *IntentHandler.");
        }
    }

    private static long count(List<ViewSourceDescriptor> files, ViewRole role) {
        return files.stream().filter(source -> source.role() == role).count();
    }
}
