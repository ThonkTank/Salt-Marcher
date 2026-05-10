package saltmarcher.quality.errorprone.view.projectionmodel;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.Tree;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewRole;
import saltmarcher.quality.errorprone.view.ViewRoleDependencySupport;
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
        public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
            return projectionModelDependencyViolation(tree, state, ViewRole.CONTRIBUTION_MODEL, "ContributionModel", this);
        }
    }

    @BugPattern(
            name = "ViewContentModelDependencyBoundary",
            summary = "ContentModels may depend only on read-side published carriers, bindable JavaFX state types, and allowed local support surfaces.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewContentModelDependencyBoundaryChecker extends BugChecker
            implements BugChecker.CompilationUnitTreeMatcher {

        @Override
        public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
            return projectionModelDependencyViolation(tree, state, ViewRole.CONTENT_MODEL, "ContentModel", this);
        }
    }

    @BugPattern(
            name = "ViewContributionModelFlatSurface",
            summary = "ContributionModels must not declare nested input, request, command, query, operation, or edit carrier types.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewContributionModelFlatSurfaceChecker extends BugChecker
            implements BugChecker.CompilationUnitTreeMatcher {

        @Override
        public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
            return flatSurfaceViolation(tree, ViewRole.CONTRIBUTION_MODEL, this);
        }
    }

    @BugPattern(
            name = "ViewContentModelFlatSurface",
            summary = "ContentModels must not declare nested input, request, command, query, operation, or edit carrier types.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewContentModelFlatSurfaceChecker extends BugChecker
            implements BugChecker.CompilationUnitTreeMatcher {

        @Override
        public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
            return flatSurfaceViolation(tree, ViewRole.CONTENT_MODEL, this);
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
        Set<String> forbiddenReferences = ViewRoleDependencySupport.collectForbiddenReferences(tree, state, source);
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
}
