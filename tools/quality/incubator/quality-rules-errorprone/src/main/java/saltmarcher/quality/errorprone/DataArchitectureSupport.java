package saltmarcher.quality.errorprone;

import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Pattern;
import javax.lang.model.type.TypeMirror;

final class DataArchitectureSupport {

    static final Pattern GATEWAY_PACKAGE = Pattern.compile("^src\\.data\\.([^.]+)\\.gateway\\.(local|remote)(\\..*)?$");
    static final Pattern DATA_ROOT_PACKAGE = Pattern.compile("^src\\.data\\.([^.]+)$");
    static final Pattern DOMAIN_APPLICATION_SERVICE_TYPE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.[A-Za-z0-9_]+ApplicationService$");
    static final Pattern DOMAIN_PUBLISHED_MODEL_TYPE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.published\\.[A-Za-z0-9_]+Model$");
    static final Pattern MODEL_PACKAGE = Pattern.compile("^src\\.data\\.([^.]+)\\.model(\\..*)?$");
    static final Pattern REPOSITORY_PACKAGE = Pattern.compile("^src\\.data\\.([^.]+)\\.repository(\\..*)?$");
    static final Pattern QUERY_PACKAGE = Pattern.compile("^src\\.data\\.([^.]+)\\.query(\\..*)?$");
    private static final Pattern INTERNAL_DATA_LEAK_PATTERN =
            Pattern.compile("^src\\.data\\.(?:[^.]+\\.(?:model|gateway)(?:\\..+)?|persistencecore\\.(?:model|sqlite)(?:\\..+)?)$");

    private DataArchitectureSupport() {
    }

    static String packageName(CompilationUnitTree tree) {
        return tree.getPackageName() == null ? "" : tree.getPackageName().toString();
    }

    static void collectTypeReferences(TypeMirror typeMirror, Set<String> referencedTypes) {
        TypeMirrorReferenceScanner.collectTypeReferences(typeMirror, referencedTypes);
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

    static Set<String> collectReferencedTypes(Tree tree) {
        Set<String> referencedTypes = new LinkedHashSet<>();
        collectReferencedTypes(tree, referencedTypes);
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

    static boolean isDomainType(String referencedType) {
        return referencedType != null && referencedType.startsWith("src.domain.");
    }

    static boolean isInternalDataLeak(String referencedType) {
        return referencedType != null && INTERNAL_DATA_LEAK_PATTERN.matcher(referencedType).matches();
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
