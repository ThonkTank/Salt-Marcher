package saltmarcher.quality.errorprone.view.projectionmodel;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.tree.Tree;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.element.Modifier;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewRole;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;

public final class ViewProjectionModelBoundaryCheckers {

    private ViewProjectionModelBoundaryCheckers() {
    }

    @BugPattern(
            name = "ViewContributionModelDependencyBoundary",
            summary = "ContributionModels may depend only on read-side published carriers, bindable JavaFX state types, and allowed child model surfaces.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewContributionModelDependencyBoundaryChecker extends BugChecker
            implements BugChecker.CompilationUnitTreeMatcher {

        @Override
        public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) { return projectionModelDependencyViolation(tree, state, ViewRole.CONTRIBUTION_MODEL, "ContributionModel", this); }
    }

    @BugPattern(
            name = "ViewContentModelDependencyBoundary",
            summary = "ContentModels may depend only on read-side published carriers, bindable JavaFX state types, and allowed local support surfaces.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewContentModelDependencyBoundaryChecker extends BugChecker
            implements BugChecker.CompilationUnitTreeMatcher {

        @Override
        public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) { return projectionModelDependencyViolation(tree, state, ViewRole.CONTENT_MODEL, "ContentModel", this); }
    }

    @BugPattern(
            name = "ViewContributionModelFlatSurface",
            summary = "ContributionModels must not declare nested input, request, command, query, operation, or edit carrier types.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewContributionModelFlatSurfaceChecker extends BugChecker
            implements BugChecker.CompilationUnitTreeMatcher {

        @Override
        public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) { return flatSurfaceViolation(tree, ViewRole.CONTRIBUTION_MODEL, this); }
    }

    @BugPattern(
            name = "ViewContentModelFlatSurface",
            summary = "ContentModels must not declare nested input, request, command, query, operation, or edit carrier types.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewContentModelFlatSurfaceChecker extends BugChecker
            implements BugChecker.CompilationUnitTreeMatcher {

        @Override
        public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) { return flatSurfaceViolation(tree, ViewRole.CONTENT_MODEL, this); }
    }

    @BugPattern(
            name = "ViewContributionModelRequestProtocol",
            summary = "ContributionModels must not expose outward request-token or publish-like protocols.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewContributionModelRequestProtocolChecker extends BugChecker
            implements BugChecker.CompilationUnitTreeMatcher {

        @Override
        public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
            ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
            if (!source.isRecognizedViewSource() || source.role() != ViewRole.CONTRIBUTION_MODEL) {
                return Description.NO_MATCH;
            }

            ClassTree topLevelClass = ViewArchitectureSupport.topLevelClass(tree);
            if (topLevelClass == null) {
                return Description.NO_MATCH;
            }

            Set<String> violations = new LinkedHashSet<>();
            for (Tree member : topLevelClass.getMembers()) {
                if (!(member instanceof MethodTree methodTree)) {
                    continue;
                }
                var symbol = (com.sun.tools.javac.code.Symbol.MethodSymbol)
                        com.google.errorprone.util.ASTHelpers.getSymbol(methodTree);
                if (symbol == null || symbol.isConstructor() || symbol.getModifiers().contains(Modifier.PRIVATE)) {
                    continue;
                }
                if (isForbiddenOutwardProtocol(symbol)) {
                    violations.add(symbol.getSimpleName().toString());
                }
            }

            if (violations.isEmpty()) {
                return Description.NO_MATCH;
            }
            return buildDescription(topLevelClass)
                    .setMessage(source.topLevelSimpleName()
                            + " exposes outward request/publish protocol members: "
                            + String.join(", ", violations)
                            + ". Outward write work must leave directly from the same-root IntentHandler through the matching root *ApplicationService, not through ContributionModel request channels.")
                    .build();
        }
    }

    @BugPattern(
            name = "ViewContentModelPublishedTranslationBoundary",
            summary = "ContentModels must not construct domain published carriers; published-to-published translation belongs upstream.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewContentModelPublishedTranslationBoundaryChecker extends BugChecker
            implements BugChecker.NewClassTreeMatcher {

        @Override
        public Description matchNewClass(NewClassTree tree, VisitorState state) {
            ViewSourceDescriptor source = ViewSourceDescriptor.describe(state.getPath().getCompilationUnit());
            if (!source.isRecognizedViewSource() || source.role() != ViewRole.CONTENT_MODEL) {
                return Description.NO_MATCH;
            }

            String constructedType = ViewArchitectureSupport.qualifiedTypeNameOf(tree);
            if (!isPublishedCarrier(constructedType)) {
                return Description.NO_MATCH;
            }
            return buildDescription(tree)
                    .setMessage("ContentModels must not construct domain published carriers such as '"
                            + constructedType
                            + "'. Move published-to-published translation into the owning application-service or"
                            + " runtime projection boundary.")
                    .build();
        }
    }

    private static Description projectionModelDependencyViolation(
            CompilationUnitTree tree,
            VisitorState state,
            ViewRole role,
            String roleLabel,
            BugChecker checker
    ) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        if (!source.isRecognizedViewSource() || source.role() != role) {
            return Description.NO_MATCH;
        }
        Set<String> forbiddenReferences = collectForbiddenDependencyReferences(tree, state, source);
        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        ClassTree topLevelClass = ViewArchitectureSupport.topLevelClass(tree);
        return checker.buildDescription(topLevelClass == null ? tree : topLevelClass)
                .setMessage(roleLabel + " package '" + source.packageName()
                        + "' violates " + roleLabel + " dependency boundaries via references: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }

    private static Description flatSurfaceViolation(
            CompilationUnitTree tree,
            ViewRole role,
            BugChecker checker
    ) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        if (!source.isRecognizedViewSource() || source.role() != role) {
            return Description.NO_MATCH;
        }

        ClassTree topLevelClass = ViewArchitectureSupport.topLevelClass(tree);
        if (topLevelClass == null) {
            return Description.NO_MATCH;
        }

        Set<String> violations = new LinkedHashSet<>();
        for (Tree member : topLevelClass.getMembers()) {
            if (member instanceof ClassTree nestedClass && isForbiddenNestedCarrier(nestedClass)) {
                violations.add(nestedClass.getSimpleName().toString());
            }
        }
        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return checker.buildDescription(topLevelClass)
                .setMessage(source.topLevelSimpleName()
                        + " must expose a flat published-value surface and must not declare nested carrier types: "
                        + String.join(", ", violations))
                .build();
    }

    private static Set<String> collectForbiddenDependencyReferences(
            CompilationUnitTree tree,
            VisitorState state,
            ViewSourceDescriptor source
    ) {
        String sourceText = sourceText(tree, state);
        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (isForbiddenDependencyReference(referencedType, source, sourceText)) {
                forbiddenReferences.add(referencedType);
            }
        }
        return forbiddenReferences;
    }

    private static boolean isForbiddenDependencyReference(
            String referencedType,
            ViewSourceDescriptor source,
            String sourceText
    ) {
        if (referencedType == null || referencedType.isBlank()) {
            return false;
        }
        if ("java.util.concurrent.Callable".equals(referencedType)
                && !sourceText.contains("Callable")
                && !sourceText.contains("java.util.concurrent")) {
            return false;
        }
        if (ViewArchitectureSupport.isForbiddenViewInfrastructureJdkType(referencedType)) {
            return true;
        }
        if (referencedType.startsWith("javafx.")) {
            return !ViewArchitectureSupport.isAllowedViewModelJavafxType(referencedType);
        }
        if (referencedType.startsWith("shell.") || referencedType.startsWith("src.data.")) {
            return true;
        }
        if (referencedType.startsWith("src.domain.")) {
            return !ViewArchitectureSupport.isAllowedPresentationModelDomainBoundary(referencedType);
        }
        ViewSourceDescriptor referencedSource = ViewSourceDescriptor.describeReferencedType(referencedType);
        if (!referencedSource.isRecognizedViewSource()) {
            return false;
        }
        if (!referencedSource.isProjectionModelSource()) {
            return true;
        }
        if (source.isSameViewUnitAs(referencedSource)) {
            return false;
        }
        return source.isSlotcontentSource() || !referencedSource.isReusableProjectionModelSource();
    }

    private static boolean isForbiddenNestedCarrier(ClassTree nestedClass) {
        if (nestedClass.getSimpleName().isEmpty()) {
            return false;
        }
        String simpleName = nestedClass.getSimpleName().toString();
        return simpleName.endsWith("Intent")
                || simpleName.endsWith("Input")
                || simpleName.endsWith("Request")
                || simpleName.endsWith("Command")
                || simpleName.endsWith("Query")
                || simpleName.endsWith("Operation")
                || simpleName.endsWith("Edit");
    }

    private static boolean isForbiddenOutwardProtocol(com.sun.tools.javac.code.Symbol.MethodSymbol symbol) {
        String simpleName = symbol.getSimpleName().toString();
        return simpleName.endsWith("TokenProperty")
                || (simpleName.contains("Request") && simpleName.endsWith("Property"))
                || simpleName.startsWith("publish");
    }

    private static boolean isPublishedCarrier(String constructedType) {
        return constructedType != null
                && constructedType.matches("^src\\.domain\\.[^.]+\\.published\\.[^.]+(?:\\$.*)?$");
    }

    private static String sourceText(CompilationUnitTree tree, VisitorState state) {
        if (tree.getSourceFile() == null) {
            return "";
        }
        try {
            String sourceText = state.getSourceForNode(tree);
            return sourceText == null ? "" : sourceText;
        } catch (IllegalArgumentException ignored) {
            return "";
        }
    }
}
