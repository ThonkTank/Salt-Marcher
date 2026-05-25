package saltmarcher.quality.errorprone.view.contribution;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.io.IOException;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.element.Modifier;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.architecture.policy.view.ViewRole;
import saltmarcher.architecture.policy.view.ViewSourceDescriptor;

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

            Set<String> forbiddenReferences = collectForbiddenDependencyReferences(tree, state, source);
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

    @BugPattern(
            name = "ViewContributionEntrypointShape",
            summary = "View contributions keep the documented shell discovery shape and area-matching shell spec family.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewContributionEntrypointShapeChecker extends ContributionBoundaryChecker {

        @Override
        Description contributionViolation(
                CompilationUnitTree tree,
                VisitorState state,
                ViewSourceDescriptor source,
                BugChecker checker
        ) {
            ClassTree topLevelClass = ViewArchitectureSupport.topLevelClass(tree);
            if (topLevelClass == null) {
                return Description.NO_MATCH;
            }

            Set<String> violations = new LinkedHashSet<>();
            if (!source.topLevelSimpleName().endsWith("Contribution")) {
                violations.add("type must be named *Contribution");
            }
            if (!hasPublicFinalClassShape(topLevelClass)) {
                violations.add("type must be declared public final");
            }
            if (!hasPublicNoArgConstructor(topLevelClass)) {
                violations.add("type must expose a public no-arg constructor for shell discovery");
            }
            if (!implementsShellContribution(topLevelClass)) {
                violations.add("type must implement shell.api.ShellContribution");
            }
            if (!hasRegistrationSpecMethod(topLevelClass)) {
                violations.add("type must declare ShellContributionSpec registrationSpec()");
            }
            if (!hasBindMethod(topLevelClass)) {
                violations.add("type must declare ShellBinding bind(ShellRuntimeContext)");
            }

            ContributionSpecKind actualSpecKind = detectContributionSpecKind(tree);
            if (actualSpecKind == ContributionSpecKind.UNKNOWN) {
                violations.add("type must construct exactly one allowed shell contribution spec");
            } else {
                ContributionSpecKind expectedSpecKind = expectedContributionSpecKind(source);
                if (expectedSpecKind != ContributionSpecKind.UNKNOWN && actualSpecKind != expectedSpecKind) {
                    violations.add("type must construct " + expectedSpecKind.specTypeName() + " in " + source.packageName());
                }
            }

            if (mentionsDefaultLanding(tree) && actualSpecKind != ContributionSpecKind.LEFT_BAR_TAB) {
                violations.add("defaultLanding only applies to ShellLeftBarTabSpec contributions");
            }

            if (violations.isEmpty()) {
                return Description.NO_MATCH;
            }
            return checker.buildDescription(topLevelClass)
                    .setMessage("Contribution '" + source.qualifiedTopLevelTypeName()
                            + "' violates the shell discovery entrypoint shape: "
                            + String.join("; ", violations))
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
                    && !ViewArchitectureSupport.isAllowedContributionShellType(referencedType)) {
                forbiddenReferences.add(referencedType);
            }
        }
        return forbiddenReferences;
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
            return true;
        }
        if (referencedType.startsWith("shell.")) {
            return !ViewArchitectureSupport.isAllowedContributionShellType(referencedType);
        }
        if (referencedType.startsWith("src.domain.") || referencedType.startsWith("src.data.")) {
            return true;
        }
        ViewSourceDescriptor referencedSource = ViewSourceDescriptor.describeReferencedType(referencedType);
        if (!referencedSource.isRecognizedViewSource()) {
            return false;
        }
        if (referencedSource.hasRole(ViewRole.CONTRIBUTION) && source.isSameViewUnitAs(referencedSource)) {
            return false;
        }
        return !referencedSource.hasRole(ViewRole.BINDER) || !source.isSameViewUnitAs(referencedSource);
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

    private static boolean hasPublicFinalClassShape(ClassTree classTree) {
        return classTree.getModifiers().getFlags().contains(Modifier.PUBLIC)
                && classTree.getModifiers().getFlags().contains(Modifier.FINAL);
    }

    private static boolean hasPublicNoArgConstructor(ClassTree classTree) {
        boolean hasConstructor = false;
        for (var member : classTree.getMembers()) {
            if (!(member instanceof MethodTree methodTree)) {
                continue;
            }
            Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodTree);
            if (symbol != null
                    && symbol.isConstructor()) {
                hasConstructor = true;
                if (methodTree.getParameters().isEmpty()
                        && methodTree.getModifiers().getFlags().contains(Modifier.PUBLIC)) {
                    return true;
                }
            }
        }
        return !hasConstructor;
    }

    private static boolean implementsShellContribution(ClassTree classTree) {
        Symbol.ClassSymbol symbol = ASTHelpers.getSymbol(classTree);
        if (symbol == null) {
            return false;
        }
        return symbol.getInterfaces().stream()
                .map(type -> type.tsym)
                .filter(Symbol.ClassSymbol.class::isInstance)
                .map(Symbol.ClassSymbol.class::cast)
                .anyMatch(type -> "shell.api.ShellContribution".contentEquals(type.getQualifiedName()));
    }

    private static boolean hasRegistrationSpecMethod(ClassTree classTree) {
        return hasMethod(classTree, "registrationSpec", "shell.api.ShellContributionSpec", 0, null);
    }

    private static boolean hasBindMethod(ClassTree classTree) {
        return hasMethod(classTree, "bind", "shell.api.ShellBinding", 1, "shell.api.ShellRuntimeContext");
    }

    private static boolean hasMethod(
            ClassTree classTree,
            String methodName,
            String returnType,
            int parameterCount,
            String firstParameterType
    ) {
        for (var member : classTree.getMembers()) {
            if (!(member instanceof MethodTree methodTree)) {
                continue;
            }
            Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodTree);
            if (symbol == null || symbol.isConstructor()) {
                continue;
            }
            if (!methodName.contentEquals(symbol.getSimpleName())
                    || methodTree.getParameters().size() != parameterCount
                    || !returnType.equals(symbol.getReturnType().toString())) {
                continue;
            }
            if (firstParameterType == null) {
                return true;
            }
            if (!methodTree.getParameters().isEmpty()
                    && firstParameterType.equals(ASTHelpers.getType(methodTree.getParameters().get(0)).toString())) {
                return true;
            }
        }
        return false;
    }

    private static ContributionSpecKind detectContributionSpecKind(CompilationUnitTree tree) {
        Set<ContributionSpecKind> specKinds = new LinkedHashSet<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitNewClass(NewClassTree newClassTree, Void unused) {
                ContributionSpecKind specKind = ContributionSpecKind.fromConstructedType(
                        ViewArchitectureSupport.qualifiedTypeNameOf(newClassTree));
                if (specKind != ContributionSpecKind.UNKNOWN) {
                    specKinds.add(specKind);
                }
                return super.visitNewClass(newClassTree, unused);
            }
        }.scan(tree, null);
        return specKinds.size() == 1 ? specKinds.iterator().next() : ContributionSpecKind.UNKNOWN;
    }

    private static ContributionSpecKind expectedContributionSpecKind(ViewSourceDescriptor source) {
        return switch (source.group()) {
            case "leftbartabs" -> ContributionSpecKind.LEFT_BAR_TAB;
            case "dropdowns" -> ContributionSpecKind.TOP_BAR;
            case "statetabs" -> ContributionSpecKind.STATE_TAB;
            default -> ContributionSpecKind.UNKNOWN;
        };
    }

    private static boolean mentionsDefaultLanding(CompilationUnitTree tree) {
        try {
            return tree.getSourceFile() != null
                    && tree.getSourceFile().getCharContent(true).toString().contains("defaultLanding");
        } catch (IOException ignored) {
            return false;
        }
    }

    private static Tree boundaryAnchor(CompilationUnitTree tree) {
        Tree anchor = ViewArchitectureSupport.topLevelClass(tree);
        return anchor == null ? tree : anchor;
    }

    private enum ContributionSpecKind {
        LEFT_BAR_TAB("shell.api.ShellLeftBarTabSpec", "ShellLeftBarTabSpec"),
        TOP_BAR("shell.api.ShellTopBarSpec", "ShellTopBarSpec"),
        STATE_TAB("shell.api.ShellStateTabSpec", "ShellStateTabSpec"),
        UNKNOWN("", "one allowed shell contribution spec");

        private final String constructedType;
        private final String specTypeName;

        ContributionSpecKind(String constructedType, String specTypeName) {
            this.constructedType = constructedType;
            this.specTypeName = specTypeName;
        }

        private String specTypeName() { return specTypeName; }

        private static ContributionSpecKind fromConstructedType(String constructedType) {
            for (ContributionSpecKind kind : values()) {
                if (kind.constructedType.equals(constructedType)) {
                    return kind;
                }
            }
            return UNKNOWN;
        }
    }
}
