package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;

final class StylingLayerProgrammaticStylingSupport {

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
            "javafx.scene.text.Font"
    );

    private static final Set<String> FORBIDDEN_STATIC_VALUE_TYPES = Set.of(
            "javafx.scene.layout.Background",
            "javafx.scene.layout.Border",
            "javafx.scene.paint.Color",
            "javafx.scene.paint.Paint",
            "javafx.scene.text.Font"
    );

    private static final Set<String> FORBIDDEN_COLOR_FACTORY_METHODS = Set.of(
            "color",
            "gray",
            "grayRgb",
            "hsb",
            "rgb",
            "web"
    );

    private static final Set<String> FORBIDDEN_PAINT_FACTORY_METHODS = Set.of(
            "valueOf"
    );

    private static final Set<String> FORBIDDEN_FONT_FACTORY_METHODS = Set.of(
            "font",
            "loadFont"
    );

    private StylingLayerProgrammaticStylingSupport() {
    }

    static boolean isTrackedLayerSource(CompilationUnitTree tree) {
        String packageName = packageName(tree);
        return isTrackedSourcePackage(packageName) && !isPanelViewSource(tree);
    }

    static Set<String> collectViolations(CompilationUnitTree tree) {
        Set<String> violations = new LinkedHashSet<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitNewClass(NewClassTree newClassTree, Void unused) {
                Symbol symbol = ASTHelpers.getSymbol(newClassTree);
                if (symbol != null) {
                    String typeName = getQualifiedOwnerTypeName(symbol);
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
                    String owner = getQualifiedOwnerTypeName(symbol);
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

    private static boolean isPanelViewSource(CompilationUnitTree tree) {
        String packageName = packageName(tree);
        String sourceFileName = sourceFileName(tree);
        return (packageName.matches("^src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+$")
                || packageName.matches("^src\\.view\\.slotcontent\\.(controls|main|state|details|topbar|primitives)\\.[^.]+$"))
                && sourceFileName.endsWith("View.java")
                && !sourceFileName.endsWith("ViewModel.java")
                && !sourceFileName.endsWith("PresentationModel.java")
                && !sourceFileName.endsWith("ContributionModel.java")
                && !sourceFileName.endsWith("ContentModel.java");
    }

    private static String packageName(CompilationUnitTree tree) {
        return tree.getPackageName() == null ? "" : tree.getPackageName().toString();
    }

    private static String sourceFileName(CompilationUnitTree tree) {
        if (tree.getSourceFile() == null) {
            return "";
        }
        String name = tree.getSourceFile().getName().replace('\\', '/');
        int separator = name.lastIndexOf('/');
        return separator < 0 ? name : name.substring(separator + 1);
    }

    private static boolean isForbiddenFactory(String owner, String methodName) {
        return ("javafx.scene.paint.Color".equals(owner) && FORBIDDEN_COLOR_FACTORY_METHODS.contains(methodName))
                || ("javafx.scene.paint.Paint".equals(owner) && FORBIDDEN_PAINT_FACTORY_METHODS.contains(methodName))
                || ("javafx.scene.text.Font".equals(owner) && FORBIDDEN_FONT_FACTORY_METHODS.contains(methodName));
    }

    private static String getQualifiedOwnerTypeName(Symbol symbol) {
        if (symbol == null || symbol.owner == null) {
            return null;
        }
        if (symbol.owner instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        return null;
    }

    private static String typeName(Symbol.VarSymbol symbol) {
        return symbol.type == null || symbol.type.tsym == null
                ? ""
                : symbol.type.tsym.getQualifiedName().toString();
    }

    private static boolean isTrackedSourcePackage(String packageName) {
        return packageName.equals("bootstrap")
                || packageName.startsWith("bootstrap.")
                || packageName.equals("shell")
                || packageName.startsWith("shell.")
                || packageName.equals("src")
                || packageName.startsWith("src.");
    }
}
