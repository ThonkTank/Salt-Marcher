package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.ExpressionTree;
import com.sun.source.tree.LiteralTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.architecture.policy.view.ViewSourceDescriptor;

public final class ViewStylingCheckers {

    private static final Set<String> FORBIDDEN_CONSTRUCTED_TYPES = Set.of(
            "javafx.scene.layout.Background",
            "javafx.scene.layout.BackgroundFill",
            "javafx.scene.layout.BackgroundImage",
            "javafx.scene.layout.BackgroundPosition",
            "javafx.scene.layout.BackgroundRepeat",
            "javafx.scene.layout.BackgroundSize",
            "javafx.scene.layout.Border",
            "javafx.scene.layout.BorderImage",
            "javafx.scene.layout.BorderStroke",
            "javafx.scene.layout.BorderStrokeStyle",
            "javafx.scene.layout.BorderWidths",
            "javafx.scene.paint.LinearGradient",
            "javafx.scene.paint.RadialGradient",
            "javafx.scene.paint.Stop",
            "javafx.scene.text.Font");
    private static final Set<String> FORBIDDEN_NODE_LAYOUT_TYPES = Set.of(
            "javafx.geometry.Insets");
    private static final Set<String> FORBIDDEN_STATIC_VALUE_TYPES = Set.of(
            "javafx.scene.layout.Background",
            "javafx.scene.layout.Border",
            "javafx.scene.paint.Color",
            "javafx.scene.paint.Paint",
            "javafx.scene.text.Font");
    private static final Set<String> FORBIDDEN_COLOR_FACTORY_METHODS = Set.of("color", "gray", "grayRgb", "hsb", "rgb", "web");
    private static final Set<String> FORBIDDEN_PAINT_FACTORY_METHODS = Set.of("valueOf");
    private static final Set<String> FORBIDDEN_FONT_FACTORY_METHODS = Set.of("font", "loadFont");
    private static final Set<String> FORBIDDEN_MANUAL_STYLE_METHODS = Set.of("setStyle");
    private static final Set<String> FORBIDDEN_PASSIVE_VIEW_LAYOUT_METHODS = Set.of(
            "setPadding",
            "setSpacing",
            "setHgap",
            "setVgap");
    private static final Set<String> FORBIDDEN_PASSIVE_VIEW_SIZE_METHODS = Set.of(
            "setMinWidth",
            "setPrefWidth",
            "setMaxWidth",
            "setMinHeight",
            "setPrefHeight",
            "setMaxHeight");
    private static final Set<String> ALLOWED_LAYOUT_SENTINELS = Set.of(
            "Double.MAX_VALUE",
            "java.lang.Double.MAX_VALUE",
            "Region.USE_PREF_SIZE",
            "Region.USE_COMPUTED_SIZE",
            "javafx.scene.layout.Region.USE_PREF_SIZE",
            "javafx.scene.layout.Region.USE_COMPUTED_SIZE",
            "USE_PREF_SIZE",
            "USE_COMPUTED_SIZE");
    private static final Set<String> DIRECT_RENDER_EXCEPTION_TYPES = Set.of(
            "src.view.slotcontent.main.dungeonmap.DungeonMapView");

    private ViewStylingCheckers() {}

    @BugPattern(
            name = "ViewProgrammaticStyling",
            summary = "Visual style values must come from centralized stylesheets outside the documented passive-View direct-render exception.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewProgrammaticStylingChecker extends BugChecker
            implements BugChecker.CompilationUnitTreeMatcher {

        @Override
        public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
            ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
            if (!isTrackedSourcePackage(source.packageName()) || source.isPassiveViewSource()) {
                return Description.NO_MATCH;
            }

            Set<String> violations = collectViolations(tree);
            if (violations.isEmpty()) {
                return Description.NO_MATCH;
            }
            return buildDescription(tree)
                    .setMessage("Package '" + source.packageName()
                            + "' defines visual style values outside centralized resources/salt-marcher.css and outside the dedicated passive-View direct-render exception. Violations: "
                            + String.join(", ", violations))
                    .build();
        }
    }

    @BugPattern(
            name = "ViewDirectRenderStylingPlacement",
            summary = "Passive views may host local JavaFX style values only inside the documented direct-render exception.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewDirectRenderStylingPlacementChecker extends BugChecker
            implements BugChecker.CompilationUnitTreeMatcher {

        @Override
        public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
            ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
            if (!source.isPassiveViewSource()) {
                return Description.NO_MATCH;
            }

            Set<String> violations = collectViolations(tree);
            if (violations.isEmpty()) {
                return Description.NO_MATCH;
            }
            if (DIRECT_RENDER_EXCEPTION_TYPES.contains(source.qualifiedTopLevelTypeName())) {
                return Description.NO_MATCH;
            }

            return buildDescription(tree)
                    .setMessage("Passive View '" + source.qualifiedTopLevelTypeName()
                            + "' defines local JavaFX style values outside the documented direct-render exception. Only "
                            + String.join(", ", DIRECT_RENDER_EXCEPTION_TYPES)
                            + " may currently host direct-render styling code. Violations: "
                            + String.join(", ", violations))
                    .build();
        }
    }

    @BugPattern(
            name = "ViewManualNodeStyling",
            summary = "Ordinary JavaFX node styling must use centralized stylesheet selectors, not manual View-local style values.",
            severity = BugPattern.SeverityLevel.ERROR)
    public static final class ViewManualNodeStylingChecker extends BugChecker
            implements BugChecker.CompilationUnitTreeMatcher {

        @Override
        public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
            ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
            if (!isTrackedSourcePackage(source.packageName())) {
                return Description.NO_MATCH;
            }

            Set<String> violations = collectManualNodeStylingViolations(tree, source);
            if (violations.isEmpty()) {
                return Description.NO_MATCH;
            }
            return buildDescription(tree)
                    .setMessage("Source '" + source.qualifiedTopLevelTypeName()
                            + "' defines ordinary node styling outside centralized resources/salt-marcher.css. Violations: "
                            + String.join(", ", violations))
                    .build();
        }
    }

    private static Set<String> collectManualNodeStylingViolations(
            CompilationUnitTree tree,
            ViewSourceDescriptor source
    ) {
        Set<String> violations = new LinkedHashSet<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitNewClass(NewClassTree newClassTree, Void unused) {
                if (source.isPassiveViewSource()) {
                    Symbol symbol = ASTHelpers.getSymbol(newClassTree);
                    if (symbol != null) {
                        String typeName = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                        if (FORBIDDEN_NODE_LAYOUT_TYPES.contains(typeName)) {
                            violations.add("manual layout value -> " + typeName);
                        }
                    }
                }
                return super.visitNewClass(newClassTree, unused);
            }

            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol != null) {
                    String methodName = symbol.getSimpleName().toString();
                    if (FORBIDDEN_MANUAL_STYLE_METHODS.contains(methodName)) {
                        violations.add("inline style backchannel -> " + methodName + "()");
                    } else if (source.isPassiveViewSource()
                            && FORBIDDEN_PASSIVE_VIEW_LAYOUT_METHODS.contains(methodName)) {
                        violations.add("manual layout setter -> " + methodName + "()");
                    } else if (source.isPassiveViewSource()
                            && FORBIDDEN_PASSIVE_VIEW_SIZE_METHODS.contains(methodName)
                            && !isTableColumnSizing(symbol)
                            && !usesAllowedLayoutSentinel(methodInvocationTree)) {
                        violations.add("manual size setter -> " + methodName + "()");
                    }
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);
        return violations;
    }

    private static boolean isTableColumnSizing(Symbol.MethodSymbol symbol) {
        Symbol owner = symbol.owner;
        while (owner != null) {
            String ownerName = owner.getQualifiedName().toString();
            if (ownerName.startsWith("javafx.scene.control.TableColumn")) {
                return true;
            }
            owner = owner.owner;
        }
        return false;
    }

    private static boolean usesAllowedLayoutSentinel(MethodInvocationTree methodInvocationTree) {
        if (methodInvocationTree.getArguments().isEmpty()) {
            return false;
        }
        ExpressionTree firstArgument = methodInvocationTree.getArguments().get(0);
        if (firstArgument instanceof LiteralTree literalTree && literalTree.getValue() instanceof Number number) {
            return number.doubleValue() == 0.0d;
        }
        String argumentText = firstArgument.toString();
        return ALLOWED_LAYOUT_SENTINELS.contains(argumentText);
    }

    private static Set<String> collectViolations(CompilationUnitTree tree) {
        Set<String> violations = new LinkedHashSet<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitNewClass(NewClassTree newClassTree, Void unused) {
                Symbol symbol = ASTHelpers.getSymbol(newClassTree);
                if (symbol != null) {
                    String typeName = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                    if (FORBIDDEN_CONSTRUCTED_TYPES.contains(typeName)) {
                        violations.add("new style value -> " + typeName);
                    }
                }
                return super.visitNewClass(newClassTree, unused);
            }

            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol != null) {
                    String owner = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                    String methodName = symbol.getSimpleName().toString();
                    if (isForbiddenFactory(owner, methodName)) {
                        violations.add("local style factory -> " + owner + "." + methodName + "()");
                    }
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }

            @Override
            public Void visitVariable(VariableTree variableTree, Void unused) {
                Symbol symbol = ASTHelpers.getSymbol(variableTree);
                if (symbol instanceof Symbol.VarSymbol varSymbol
                        && varSymbol.isStatic()
                        && FORBIDDEN_STATIC_VALUE_TYPES.contains(typeName(varSymbol))) {
                    violations.add("static style value -> " + typeName(varSymbol));
                }
                return super.visitVariable(variableTree, unused);
            }
        }.scan(tree, null);
        return violations;
    }

    private static boolean isForbiddenFactory(String owner, String methodName) {
        return ("javafx.scene.paint.Color".equals(owner) && FORBIDDEN_COLOR_FACTORY_METHODS.contains(methodName))
                || ("javafx.scene.paint.Paint".equals(owner) && FORBIDDEN_PAINT_FACTORY_METHODS.contains(methodName))
                || ("javafx.scene.text.Font".equals(owner) && FORBIDDEN_FONT_FACTORY_METHODS.contains(methodName));
    }

    private static String typeName(Symbol.VarSymbol symbol) { return symbol.type == null || symbol.type.tsym == null ? "" : symbol.type.tsym.getQualifiedName().toString(); }

    private static boolean isTrackedSourcePackage(String packageName) {
        return packageName.equals("bootstrap") || packageName.startsWith("bootstrap.")
                || packageName.equals("shell") || packageName.startsWith("shell.")
                || packageName.equals("src") || packageName.startsWith("src.");
    }
}
