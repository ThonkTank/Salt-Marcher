package saltmarcher.quality.errorprone.data.servicecontribution;

import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreeScanner;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Pattern;
import javax.lang.model.type.TypeMirror;
import saltmarcher.quality.errorprone.TypeMirrorReferenceScanner;

final class DataServiceContributionArchitectureSupport {

    static final Pattern DATA_ROOT_PACKAGE = Pattern.compile("^src\\.data\\.([^.]+)$");

    private DataServiceContributionArchitectureSupport() {
    }

    static String packageName(CompilationUnitTree tree) {
        return tree.getPackageName() == null ? "" : tree.getPackageName().toString();
    }

    static boolean isServiceContributionRoot(CompilationUnitTree tree, String featureName) {
        String simpleName = topLevelSimpleName(tree);
        return simpleName.endsWith("ServiceContribution");
    }

    static boolean isServiceCompositionAssembly(CompilationUnitTree tree, String featureName) {
        String simpleName = topLevelSimpleName(tree);
        return simpleName.endsWith("ServiceAssembly");
    }

    static boolean isServiceCompositionOwner(CompilationUnitTree tree, String featureName) {
        return isServiceContributionRoot(tree, featureName)
                || isServiceCompositionAssembly(tree, featureName);
    }

    static Set<String> collectReferencedTypes(CompilationUnitTree tree) {
        Set<String> referencedTypes = new LinkedHashSet<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void scan(Tree currentTree, Void unused) {
                if (currentTree != null) {
                    collectReferencedTypes(currentTree, referencedTypes);
                }
                return super.scan(currentTree, unused);
            }

            @Override
            public Void visitMemberSelect(MemberSelectTree memberSelectTree, Void unused) {
                collectReferencedTypes(memberSelectTree.getExpression(), referencedTypes);
                return super.visitMemberSelect(memberSelectTree, unused);
            }
        }.scan(tree, null);
        return referencedTypes;
    }

    private static void collectReferencedTypes(Tree tree, Set<String> referencedTypes) {
        Symbol symbol = ASTHelpers.getSymbol(tree);
        if (symbol != null) {
            addReference(getQualifiedTypeName(symbol), referencedTypes);
            addReference(getQualifiedOwnerTypeName(symbol), referencedTypes);
        }
        collectTypeReferences(ASTHelpers.getType(tree), referencedTypes);
    }

    private static void collectTypeReferences(TypeMirror typeMirror, Set<String> referencedTypes) {
        TypeMirrorReferenceScanner.collectTypeReferences(typeMirror, referencedTypes);
    }

    static String topLevelSimpleName(CompilationUnitTree tree) {
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
        return result[0] == null ? "" : result[0].getSimpleName().toString();
    }

    private static void addReference(String qualifiedName, Set<String> referencedTypes) {
        if (qualifiedName != null && !qualifiedName.isBlank()) {
            referencedTypes.add(qualifiedName);
        }
    }

    private static String getQualifiedTypeName(Symbol symbol) {
        if (symbol instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        if (symbol.type != null && symbol.type.tsym instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        return null;
    }

    private static String getQualifiedOwnerTypeName(Symbol symbol) {
        if (symbol.owner instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        return null;
    }
}
