package saltmarcher.quality.errorprone.view.contribution;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.io.IOException;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.element.Modifier;
import saltmarcher.quality.errorprone.view.ViewRole;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;

@BugPattern(
        name = "ViewContributionEntrypointShape",
        summary = "View contributions keep the documented shell discovery shape and area-matching shell spec family.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewContributionEntrypointShapeChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        if (!source.isActiveRootSource() || source.role() != ViewRole.CONTRIBUTION) {
            return Description.NO_MATCH;
        }

        ClassTree topLevelClass = saltmarcher.quality.errorprone.view.ViewArchitectureSupport.topLevelClass(tree);
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
        if (!hasExplicitPublicNoArgConstructor(topLevelClass)) {
            violations.add("type must declare an explicit public no-arg constructor for shell discovery");
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
        return buildDescription(topLevelClass)
                .setMessage("Contribution '" + source.qualifiedTopLevelTypeName()
                        + "' violates the shell discovery entrypoint shape: "
                        + String.join("; ", violations))
                .build();
    }

    private static boolean hasPublicFinalClassShape(ClassTree classTree) {
        return classTree.getModifiers().getFlags().contains(Modifier.PUBLIC)
                && classTree.getModifiers().getFlags().contains(Modifier.FINAL);
    }

    private static boolean hasExplicitPublicNoArgConstructor(ClassTree classTree) {
        for (var member : classTree.getMembers()) {
            if (!(member instanceof MethodTree methodTree)) {
                continue;
            }
            Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodTree);
            if (symbol != null
                    && symbol.isConstructor()
                    && methodTree.getParameters().isEmpty()
                    && methodTree.getModifiers().getFlags().contains(Modifier.PUBLIC)) {
                return true;
            }
        }
        return false;
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
                Symbol symbol = ASTHelpers.getSymbol(newClassTree.getIdentifier());
                String qualifiedType = symbol instanceof Symbol.ClassSymbol classSymbol
                        ? classSymbol.getQualifiedName().toString()
                        : ASTHelpers.getType(newClassTree) == null ? "" : ASTHelpers.getType(newClassTree).toString();
                ContributionSpecKind specKind = ContributionSpecKind.fromConstructedType(qualifiedType);
                if (specKind != ContributionSpecKind.UNKNOWN) {
                    specKinds.add(specKind);
                }
                return super.visitNewClass(newClassTree, unused);
            }
        }.scan(tree, null);
        return specKinds.size() == 1 ? specKinds.iterator().next() : ContributionSpecKind.UNKNOWN;
    }

    private static ContributionSpecKind expectedContributionSpecKind(ViewSourceDescriptor source) {
        return switch (source.area()) {
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

        private String specTypeName() {
            return specTypeName;
        }

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
