package saltmarcher.quality.errorprone.view.contribution;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewRole;
import saltmarcher.quality.errorprone.view.ViewRoleDependencySupport;
import saltmarcher.quality.errorprone.view.ViewRolePolicy;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;

public final class ViewContributionBoundaryCheckers {

    private ViewContributionBoundaryCheckers() {
    }

    private abstract static class ContributionBoundaryChecker extends BugChecker
            implements BugChecker.CompilationUnitTreeMatcher {

        @Override
        public final Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
            ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
            if (!source.isRecognizedViewSource() || source.role() != ViewRole.CONTRIBUTION) {
                return Description.NO_MATCH;
            }
            return contributionViolation(tree, state, source, this);
        }

        abstract Description contributionViolation(
                CompilationUnitTree tree,
                VisitorState state,
                ViewSourceDescriptor source,
                BugChecker checker);
    }

    @BugPattern(
            name = "ViewContributionDependencyBoundary",
            summary = "View contributions stay thin shell entrypoints and may depend only on their co-located Binder and allowed shell APIs.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewContributionDependencyBoundaryChecker
            extends ContributionBoundaryChecker {

        @Override
        Description contributionViolation(
                CompilationUnitTree tree,
                VisitorState state,
                ViewSourceDescriptor source,
                BugChecker checker
        ) {
            if (!source.isActiveRootSource()) {
                return Description.NO_MATCH;
            }

            Set<String> forbiddenReferences = ViewRoleDependencySupport.collectForbiddenReferences(
                    tree,
                    state,
                    ViewRoleDependencySupport.SourceRole.CONTRIBUTION);
            if (forbiddenReferences.isEmpty()) {
                return Description.NO_MATCH;
            }
            return checker.buildDescription(boundaryAnchor(tree))
                    .setMessage("Contribution package '" + source.packageName()
                            + "' violates thin shell entrypoint dependency boundaries via references: "
                            + String.join(", ", forbiddenReferences))
                    .build();
        }
    }

    @BugPattern(
            name = "ViewContributionShellApiAllowlist",
            summary = "View contributions may use only their documented shell registration subset and may not perform runtime service lookup.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewContributionShellApiAllowlistChecker
            extends ContributionBoundaryChecker {

        @Override
        Description contributionViolation(
                CompilationUnitTree tree,
                VisitorState state,
                ViewSourceDescriptor source,
                BugChecker checker
        ) {
            Set<String> forbiddenReferences = collectForbiddenShellReferences(tree);
            collectContributionServiceLookupViolations(tree, forbiddenReferences);
            if (forbiddenReferences.isEmpty()) {
                return Description.NO_MATCH;
            }
            return checker.buildDescription(boundaryAnchor(tree))
                    .setMessage("Contribution package '" + source.packageName()
                            + "' references shell types outside its allowed shell contract subset: "
                            + String.join(", ", forbiddenReferences))
                    .build();
        }
    }

    private static Set<String> collectForbiddenShellReferences(CompilationUnitTree tree) {
        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (referencedType.startsWith("shell.host.")) {
                forbiddenReferences.add(referencedType);
                continue;
            }
            if (referencedType.startsWith("shell.api.")
                    && !ViewRolePolicy.isAllowedContributionShellType(referencedType)) {
                forbiddenReferences.add(referencedType);
            }
        }
        return forbiddenReferences;
    }

    private static void collectContributionServiceLookupViolations(
            CompilationUnitTree tree,
            Set<String> forbiddenReferences
    ) {
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol != null
                        && "services".equals(symbol.getSimpleName().toString())
                        && "shell.api.ShellRuntimeContext".equals(
                        ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol))) {
                    forbiddenReferences.add("shell.api.ShellRuntimeContext.services()");
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);
    }

    private static Tree boundaryAnchor(CompilationUnitTree tree) {
        Tree anchor = ViewArchitectureSupport.topLevelClass(tree);
        return anchor == null ? tree : anchor;
    }
}
