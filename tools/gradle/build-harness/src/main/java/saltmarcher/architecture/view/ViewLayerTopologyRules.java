package saltmarcher.architecture.view;

import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.ParameterizedTypeTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.JavacTask;
import com.sun.source.util.TreeScanner;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import javax.lang.model.element.Modifier;
import javax.tools.JavaCompiler;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;

public final class ViewLayerTopologyRules implements ArchitectureRule {

    private static final String SOURCE_PARSE_RULE_ID = "view-viewinputevent-source-parse";

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Map<ViewUnitDescriptor, List<ViewSourceDescriptor>> units =
                ViewTopologyCatalog.groupRecognizedUnits(context.sourceFiles(violations));
        for (Map.Entry<ViewUnitDescriptor, List<ViewSourceDescriptor>> entry : units.entrySet()) {
            UnitFacts facts = analyzeUnit(context, entry.getKey(), entry.getValue(), violations);
            validateFileRoles(facts, violations);
            validateUnitShape(facts, violations);
        }
    }

    private static UnitFacts analyzeUnit(
            ArchitectureContext context,
            ViewUnitDescriptor unit,
            List<ViewSourceDescriptor> files,
            ViolationSink violations
    ) {
        List<InteractivePassiveView> interactiveViews = scanInteractivePassiveViews(context, files, violations);
        return new UnitFacts(
                unit,
                files,
                interactiveViews,
                count(files, ViewRole.CONTRIBUTION),
                count(files, ViewRole.BINDER),
                count(files, ViewRole.CONTRIBUTION_MODEL),
                count(files, ViewRole.CONTENT_MODEL),
                count(files, ViewRole.INTENT_HANDLER),
                count(files, ViewRole.VIEW_INPUT_EVENT),
                count(files, ViewRole.PUBLISHED_EVENT),
                count(files, ViewRole.INSPECTOR_ENTRY),
                count(files, ViewRole.VIEW),
                collectStems(files, ViewRole.VIEW),
                collectStems(files, ViewRole.VIEW_INPUT_EVENT));
    }

    private static List<InteractivePassiveView> scanInteractivePassiveViews(
            ArchitectureContext context,
            List<ViewSourceDescriptor> sources,
            ViolationSink violations
    ) {
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) {
            violations.add("src/view", SOURCE_PARSE_RULE_ID,
                    "The ViewInputEvent topology reverse scan requires the JDK system compiler to parse passive View sources.");
            return List.of();
        }

        List<InteractivePassiveView> interactiveViews = new ArrayList<>();
        try (StandardJavaFileManager fileManager = compiler.getStandardFileManager(null, null, null)) {
            for (ViewSourceDescriptor source : sources) {
                SourceFile sourceFile = source.sourceFile();
                if (source.role() != ViewRole.VIEW || !sourceFile.content().contains("onViewInputEvent")) {
                    continue;
                }
                scanSourceFile(context, compiler, fileManager, source, interactiveViews, violations);
            }
        } catch (IOException exception) {
            violations.add("src/view", SOURCE_PARSE_RULE_ID,
                    "Could not close the passive View input seam scanner: " + exception.getMessage());
        }
        return List.copyOf(interactiveViews);
    }

    private static void scanSourceFile(
            ArchitectureContext context,
            JavaCompiler compiler,
            StandardJavaFileManager fileManager,
            ViewSourceDescriptor source,
            List<InteractivePassiveView> interactiveViews,
            ViolationSink violations
    ) {
        SourceFile sourceFile = source.sourceFile();
        Path absolutePath = context.repoRoot().resolve(sourceFile.relativePath()).normalize().toAbsolutePath();
        JavacTask task = (JavacTask) compiler.getTask(
                null,
                fileManager,
                null,
                List.of("--release", "21", "-proc:none"),
                null,
                fileManager.getJavaFileObjects(absolutePath.toFile()));
        try {
            for (CompilationUnitTree unit : task.parse()) {
                new InteractiveViewCollector(source).scan(unit, interactiveViews);
            }
        } catch (IOException exception) {
            violations.add(sourceFile.relativePath(), SOURCE_PARSE_RULE_ID,
                    "Could not parse passive View source for the input seam scan: " + exception.getMessage());
        }
    }

    private static void validateFileRoles(UnitFacts facts, ViolationSink violations) {
        for (ViewSourceDescriptor source : facts.files()) {
            if (source.role().isAllowedIn(facts.unit().kind())) {
                continue;
            }
            violations.add(
                    source.source(),
                    facts.unit().kind() == ViewUnitKind.ACTIVE_ROOT
                            ? "view-layer-active-root-file-role"
                            : "view-layer-slotcontent-file-role",
                    facts.unit().kind() == ViewUnitKind.ACTIVE_ROOT
                            ? "Active contribution roots may contain only *Contribution.java, *Binder.java, *ContributionModel.java, optional *IntentHandler.java, passive *View.java, and optional *ViewInputEvent.java files. Move projection, formatting, or selection preparation into the owning *ContributionModel or into nested/private helper types inside an allowed role file instead of adding standalone helper files."
                            : "Reusable slotcontent units may contain only exactly one passive *View.java file, exactly one *ContentModel.java file, and a same-stem *ViewInputEvent.java file only when that View is interactive. Top-level *IntentHandler.java, *PublishedEvent.java, *InspectorEntry.java, *Scene.java, *PointerEvent.java, *Signal.java, *Support.java, and standalone helper files are illegal reusable slotcontent roles.");
        }
    }

    private static void validateUnitShape(UnitFacts facts, ViolationSink violations) {
        if (facts.unit().kind() == ViewUnitKind.ACTIVE_ROOT) {
            if (facts.contributionCount() != 1) {
                violations.add(facts.unit().source(), "view-layer-contribution-count",
                        "Each active contribution root must define exactly one shell-discovered *Contribution.java file.");
            }
            if (facts.binderCount() != 1) {
                violations.add(facts.unit().source(), "view-layer-binder-count",
                        "Each active contribution root must define exactly one *Binder.java lifecycle and wiring owner.");
            }
            if (facts.contributionModelCount() != 1) {
                violations.add(facts.unit().source(), "view-layer-contributionmodel-count",
                        "Each active contribution root must define exactly one aggregate *ContributionModel.java file.");
            }
            if (facts.contentModelCount() > 0) {
                violations.add(facts.unit().source(), "view-layer-contentmodel-forbidden",
                        "Active contribution roots must not define reusable *ContentModel.java files.");
            }
            if (facts.viewCount() < 1) {
                violations.add(facts.unit().source(), "view-layer-view-required",
                        "Each active contribution root must define at least one passive *View.java surface.");
            }
            if (facts.publishedEventCount() > 0) {
                violations.add(facts.unit().source(), "view-layer-active-root-no-publishedevent",
                        "Active contribution roots must not define top-level *PublishedEvent.java files; domain writes leave through the root *IntentHandler -> *ApplicationService seam.");
            }
            if (facts.intentHandlerCount() > 1) {
                violations.add(facts.unit().source(), "view-layer-intenthandler-count",
                        "Each active contribution root may define at most one local *IntentHandler.java file.");
            }
            if (!facts.hasIntentHandler() && facts.viewInputEventCount() > 0) {
                violations.add(facts.unit().source(), "view-layer-active-root-viewinputevent-no-intenthandler",
                        "Active contribution roots may define *ViewInputEvent.java files only when the same root also defines a local *IntentHandler.java file.");
            }
        } else {
            if (facts.contributionCount() > 0) {
                violations.add(facts.unit().source(), "view-layer-slotcontent-no-contribution",
                        "Reusable slotcontent units must not define *Contribution.java shell entrypoints.");
            }
            if (facts.binderCount() > 0) {
                violations.add(facts.unit().source(), "view-layer-slotcontent-no-binder",
                        "Reusable slotcontent units must not define *Binder.java lifecycle owners.");
            }
            if (facts.contributionModelCount() > 0) {
                violations.add(facts.unit().source(), "view-layer-slotcontent-no-contributionmodel",
                        "Reusable slotcontent units must not define active-root *ContributionModel.java files.");
            }
            if (facts.contentModelCount() != 1) {
                violations.add(facts.unit().source(), "view-layer-slotcontent-contentmodel-count",
                        "Each reusable slotcontent unit must define exactly one *ContentModel.java file.");
            }
            if (facts.intentHandlerCount() > 0) {
                violations.add(facts.unit().source(), "view-layer-slotcontent-no-intenthandler",
                        "Reusable slotcontent units must not define *IntentHandler.java files.");
            }
            if (facts.interactiveViews().isEmpty()) {
                if (facts.viewInputEventCount() > 0) {
                    violations.add(facts.unit().source(), "view-layer-slotcontent-viewinputevent-count",
                            "Non-interactive reusable slotcontent units must not define *ViewInputEvent.java files.");
                }
            } else if (facts.viewInputEventCount() != 1) {
                violations.add(facts.unit().source(), "view-layer-slotcontent-viewinputevent-count",
                        "Interactive reusable slotcontent units must define exactly one same-stem *ViewInputEvent.java file.");
            }
            if (facts.publishedEventCount() > 0) {
                violations.add(facts.unit().source(), "view-layer-slotcontent-no-publishedevent",
                        "Reusable slotcontent units must not define *PublishedEvent.java files.");
            }
            if (facts.inspectorEntryCount() > 0) {
                violations.add(facts.unit().source(), "view-layer-slotcontent-no-inspectorentry",
                        "Reusable slotcontent units must not define *InspectorEntry.java files.");
            }
            if (facts.viewCount() != 1) {
                violations.add(facts.unit().source(), "view-layer-slotcontent-view-count",
                        "Each reusable slotcontent unit must define exactly one top-level *View.java file.");
            }
        }

        validateProjectionRoleShape(facts, violations);
        validateSameStemViewInputEvents(
                facts,
                violations);
    }

    private static void validateProjectionRoleShape(UnitFacts facts, ViolationSink violations) {
        for (ViewSourceDescriptor source : facts.files()) {
            if (source.role() == ViewRole.LEGACY_VIEW_MODEL || source.role() == ViewRole.PROJECTOR) {
                violations.add(source.source(), "view-layer-legacy-projection-role",
                        "View architecture must use *ContributionModel.java or *ContentModel.java and must not retain *ViewModel.java, *PresentationModel.java, or *Projector.java role files.");
                continue;
            }
            if (!source.role().isProjectionModel()) {
                continue;
            }
            if (facts.unit().kind() == ViewUnitKind.ACTIVE_ROOT && source.role() != ViewRole.CONTRIBUTION_MODEL) {
                violations.add(source.source(), "view-layer-active-root-projection-role",
                        "Active contribution roots must name their aggregate projection role *ContributionModel.java.");
            }
            if (facts.unit().kind() == ViewUnitKind.REUSABLE_SLOTCONTENT && source.role() != ViewRole.CONTENT_MODEL) {
                violations.add(source.source(), "view-layer-slotcontent-projection-role",
                        "Reusable slotcontent units must name their reusable projection role *ContentModel.java.");
            }
        }
    }

    private static void validateSameStemViewInputEvents(UnitFacts facts, ViolationSink violations) {
        if (facts.unit().kind() == ViewUnitKind.ACTIVE_ROOT
                && !facts.interactiveViews().isEmpty()
                && facts.viewInputEventStems().isEmpty()) {
            violations.add(facts.unit().source(), "view-layer-interactive-viewinputevent-required",
                    "Interactive active-root Views must own same-stem *ViewInputEvent.java files in the same view unit.");
        }
        for (String eventStem : facts.viewInputEventStems()) {
            if (!facts.passiveViewStems().contains(eventStem)) {
                violations.add(facts.unit().source(), "view-layer-viewinputevent-same-stem",
                        "*ViewInputEvent files must belong to a same-stem passive *View.java surface in the same view unit.");
            }
        }
        for (InteractivePassiveView interactiveView : facts.interactiveViews()) {
            validateInteractiveView(facts, interactiveView, violations);
        }
    }

    private static void validateInteractiveView(
            UnitFacts facts,
            InteractivePassiveView interactiveView,
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
        if (!facts.viewInputEventStems().contains(interactiveView.viewStem())) {
            violations.add(interactiveView.source(), "view-layer-viewinputevent-same-stem",
                    "Passive *View surfaces that expose onViewInputEvent(...) must own a same-stem *ViewInputEvent.java file in the same view unit. Missing "
                            + expectedEvent + ".");
        }
        if (facts.unit().kind() == ViewUnitKind.ACTIVE_ROOT && !facts.hasIntentHandler()) {
            violations.add(interactiveView.source(), "view-layer-interactive-active-root-intenthandler-required",
                    "Active-root passive *View surfaces that expose onViewInputEvent(...) may exist only when the same view unit also defines a local *IntentHandler.");
        }
    }

    private static long count(List<ViewSourceDescriptor> files, ViewRole role) {
        return files.stream().filter(source -> source.role() == role).count();
    }

    private static Set<String> collectStems(List<ViewSourceDescriptor> files, ViewRole role) {
        return files.stream()
                .filter(source -> source.role() == role)
                .map(ViewSourceDescriptor::stem)
                .filter(stem -> !stem.isBlank())
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
    }

    private static final class InteractiveViewCollector extends TreeScanner<Void, List<InteractivePassiveView>> {

        private final SourceFile sourceFile;
        private final String viewStem;
        private boolean topLevelVisited;

        private InteractiveViewCollector(ViewSourceDescriptor source) {
            this.sourceFile = source.sourceFile();
            this.viewStem = source.stem();
        }

        @Override
        public Void visitClass(ClassTree node, List<InteractivePassiveView> interactiveViews) {
            if (topLevelVisited) {
                return null;
            }
            topLevelVisited = true;
            String viewSimpleName = sourceFile.fileName().replaceFirst("\\.java$", "");
            for (Tree member : node.getMembers()) {
                if (!(member instanceof MethodTree methodTree)) {
                    continue;
                }
                InteractivePassiveView interactiveView = interactiveView(methodTree, sourceFile, viewStem, viewSimpleName);
                if (interactiveView != null) {
                    interactiveViews.add(interactiveView);
                }
            }
            return null;
        }
    }

    private static InteractivePassiveView interactiveView(
            MethodTree methodTree,
            SourceFile sourceFile,
            String viewStem,
            String viewSimpleName
    ) {
        if (!"onViewInputEvent".contentEquals(methodTree.getName())
                || methodTree.getModifiers().getFlags().contains(Modifier.PRIVATE)) {
            return null;
        }
        return new InteractivePassiveView(sourceFile, viewStem, viewSimpleName, declaredEventSimpleName(methodTree));
    }

    private static String declaredEventSimpleName(MethodTree methodTree) {
        if (methodTree.getParameters().size() != 1) {
            return null;
        }
        Tree returnType = methodTree.getReturnType();
        if (returnType == null || !"void".equals(returnType.toString())) {
            return null;
        }
        Tree parameterType = methodTree.getParameters().getFirst().getType();
        if (!(parameterType instanceof ParameterizedTypeTree parameterizedTypeTree)
                || !isConsumerType(parameterizedTypeTree.getType())
                || parameterizedTypeTree.getTypeArguments().size() != 1) {
            return null;
        }
        return simpleTypeName(parameterizedTypeTree.getTypeArguments().getFirst());
    }

    private static boolean isConsumerType(Tree tree) {
        String typeText = tree.toString().trim();
        return "Consumer".equals(typeText) || typeText.endsWith(".Consumer");
    }

    private static String simpleTypeName(Tree tree) {
        String typeText = tree.toString().trim().replaceFirst("<.*$", "");
        int separator = Math.max(typeText.lastIndexOf('.'), typeText.lastIndexOf('$'));
        return separator >= 0 ? typeText.substring(separator + 1) : typeText;
    }

    private record InteractivePassiveView(
            SourceFile sourceFile,
            String viewStem,
            String viewSimpleName,
            String declaredEventSimpleName
    ) {
        private String source() {
            return sourceFile.relativePath();
        }

        private String expectedViewInputEventSimpleName() {
            return viewSimpleName + "InputEvent";
        }
    }

    private record UnitFacts(
            ViewUnitDescriptor unit,
            List<ViewSourceDescriptor> files,
            List<InteractivePassiveView> interactiveViews,
            long contributionCount,
            long binderCount,
            long contributionModelCount,
            long contentModelCount,
            long intentHandlerCount,
            long viewInputEventCount,
            long publishedEventCount,
            long inspectorEntryCount,
            long viewCount,
            Set<String> passiveViewStems,
            Set<String> viewInputEventStems
    ) {
        private boolean hasIntentHandler() {
            return intentHandlerCount > 0;
        }
    }
}
