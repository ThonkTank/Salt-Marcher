package saltmarcher.quality.errorprone.view.projectionmodel;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreeScanner;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewRoleDependencySupport;

public final class ViewProjectionModelBoundaryCheckers {

    private ViewProjectionModelBoundaryCheckers() {
    }

    private abstract static class ProjectionModelDependencyBoundaryChecker extends BugChecker
            implements BugChecker.CompilationUnitTreeMatcher {

        abstract String requiredSuffix();

        abstract ViewRoleDependencySupport.SourceRole sourceRole();

        abstract String roleLabel();

        @Override
        public final Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
            return projectionModelDependencyViolation(
                    tree,
                    state,
                    requiredSuffix(),
                    sourceRole(),
                    roleLabel(),
                    this);
        }
    }

    private abstract static class ProjectionModelFlatSurfaceChecker extends BugChecker
            implements BugChecker.CompilationUnitTreeMatcher {

        abstract String requiredSuffix();

        @Override
        public final Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
            return flatSurfaceViolation(tree, requiredSuffix(), this);
        }
    }

    @BugPattern(
            name = "ViewContributionModelDependencyBoundary",
            summary = "ContributionModels may depend only on read-side published carriers, bindable JavaFX state types, and allowed child model surfaces.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewContributionModelDependencyBoundaryChecker
            extends ProjectionModelDependencyBoundaryChecker {

        @Override
        String requiredSuffix() {
            return "ContributionModel";
        }

        @Override
        ViewRoleDependencySupport.SourceRole sourceRole() {
            return ViewRoleDependencySupport.SourceRole.CONTRIBUTION_MODEL;
        }

        @Override
        String roleLabel() {
            return "ContributionModel";
        }
    }

    @BugPattern(
            name = "ViewContentModelDependencyBoundary",
            summary = "ContentModels may depend only on read-side published carriers, bindable JavaFX state types, and allowed local support surfaces.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewContentModelDependencyBoundaryChecker
            extends ProjectionModelDependencyBoundaryChecker {

        @Override
        String requiredSuffix() {
            return "ContentModel";
        }

        @Override
        ViewRoleDependencySupport.SourceRole sourceRole() {
            return ViewRoleDependencySupport.SourceRole.CONTENT_MODEL;
        }

        @Override
        String roleLabel() {
            return "ContentModel";
        }
    }

    @BugPattern(
            name = "ViewContributionModelFlatSurface",
            summary = "ContributionModels must not declare nested input, request, command, query, operation, or edit carrier types.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewContributionModelFlatSurfaceChecker
            extends ProjectionModelFlatSurfaceChecker {

        @Override
        String requiredSuffix() {
            return "ContributionModel";
        }
    }

    @BugPattern(
            name = "ViewContentModelFlatSurface",
            summary = "ContentModels must not declare nested input, request, command, query, operation, or edit carrier types.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewContentModelFlatSurfaceChecker
            extends ProjectionModelFlatSurfaceChecker {

        @Override
        String requiredSuffix() {
            return "ContentModel";
        }
    }

    private static Description projectionModelDependencyViolation(
            CompilationUnitTree tree,
            VisitorState state,
            String requiredSuffix,
            ViewRoleDependencySupport.SourceRole role,
            String roleLabel,
            BugChecker checker
    ) {
        if (!ViewArchitectureSupport.isViewModelSource(tree)
                || !ViewArchitectureSupport.topLevelSimpleName(tree).endsWith(requiredSuffix)) {
            return Description.NO_MATCH;
        }

        String packageName = ViewArchitectureSupport.packageName(tree);
        Set<String> forbiddenReferences = ViewRoleDependencySupport.collectForbiddenReferences(
                tree,
                state,
                role);
        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return checker.buildDescription(tree)
                .setMessage(roleLabel + " package '" + packageName
                        + "' violates " + roleLabel + " dependency boundaries via references: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }

    private static Description flatSurfaceViolation(
            CompilationUnitTree tree,
            String requiredSuffix,
            BugChecker checker
    ) {
        if (!ViewArchitectureSupport.isViewModelSource(tree)) {
            return Description.NO_MATCH;
        }
        String topLevelSimpleName = ViewArchitectureSupport.topLevelSimpleName(tree);
        if (!topLevelSimpleName.endsWith(requiredSuffix)) {
            return Description.NO_MATCH;
        }

        ClassTree topLevelClass = topLevelClass(tree);
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
                .setMessage(topLevelSimpleName
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

    private static ClassTree topLevelClass(CompilationUnitTree tree) {
        ClassTree[] result = {null};
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitClass(ClassTree classTree, Void unused) {
                if (result[0] == null) {
                    result[0] = classTree;
                }
                return null;
            }
        }.scan(tree, null);
        return result[0];
    }
}
