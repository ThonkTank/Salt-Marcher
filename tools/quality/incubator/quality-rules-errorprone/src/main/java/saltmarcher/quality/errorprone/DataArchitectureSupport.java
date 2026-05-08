package saltmarcher.quality.errorprone;

import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Pattern;
import javax.lang.model.element.Element;
import javax.lang.model.element.TypeElement;
import javax.lang.model.type.ArrayType;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.ErrorType;
import javax.lang.model.type.ExecutableType;
import javax.lang.model.type.IntersectionType;
import javax.lang.model.type.NoType;
import javax.lang.model.type.NullType;
import javax.lang.model.type.PrimitiveType;
import javax.lang.model.type.TypeMirror;
import javax.lang.model.type.TypeVariable;
import javax.lang.model.type.UnionType;
import javax.lang.model.type.WildcardType;
import javax.lang.model.util.SimpleTypeVisitor14;

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
        if (typeMirror == null) {
            return;
        }
        Set<TypeMirror> visitedTypeMirrors = Collections.newSetFromMap(new IdentityHashMap<>());
        typeMirror.accept(new SimpleTypeVisitor14<Void, Void>() {
            @Override
            public Void visitDeclared(DeclaredType declaredType, Void unused) {
                if (!visitOnce(declaredType)) {
                    return null;
                }
                Element element = declaredType.asElement();
                if (element instanceof TypeElement typeElement) {
                    addReference(typeElement.getQualifiedName().toString(), referencedTypes);
                }
                for (TypeMirror typeArgument : declaredType.getTypeArguments()) {
                    scanType(typeArgument);
                }
                return null;
            }

            @Override
            public Void visitArray(ArrayType arrayType, Void unused) {
                if (!visitOnce(arrayType)) {
                    return null;
                }
                scanType(arrayType.getComponentType());
                return null;
            }

            @Override
            public Void visitTypeVariable(TypeVariable typeVariable, Void unused) {
                if (!visitOnce(typeVariable)) {
                    return null;
                }
                scanType(typeVariable.getUpperBound());
                TypeMirror lowerBound = typeVariable.getLowerBound();
                if (lowerBound != null) {
                    scanType(lowerBound);
                }
                return null;
            }

            @Override
            public Void visitWildcard(WildcardType wildcardType, Void unused) {
                if (!visitOnce(wildcardType)) {
                    return null;
                }
                if (wildcardType.getExtendsBound() != null) {
                    scanType(wildcardType.getExtendsBound());
                }
                if (wildcardType.getSuperBound() != null) {
                    scanType(wildcardType.getSuperBound());
                }
                return null;
            }

            @Override
            public Void visitExecutable(ExecutableType executableType, Void unused) {
                if (!visitOnce(executableType)) {
                    return null;
                }
                scanType(executableType.getReturnType());
                for (TypeMirror parameterType : executableType.getParameterTypes()) {
                    scanType(parameterType);
                }
                for (TypeMirror thrownType : executableType.getThrownTypes()) {
                    scanType(thrownType);
                }
                for (TypeMirror typeVariable : executableType.getTypeVariables()) {
                    scanType(typeVariable);
                }
                return null;
            }

            @Override
            public Void visitIntersection(IntersectionType intersectionType, Void unused) {
                if (!visitOnce(intersectionType)) {
                    return null;
                }
                for (TypeMirror bound : intersectionType.getBounds()) {
                    scanType(bound);
                }
                return null;
            }

            @Override
            public Void visitUnion(UnionType unionType, Void unused) {
                if (!visitOnce(unionType)) {
                    return null;
                }
                for (TypeMirror alternative : unionType.getAlternatives()) {
                    scanType(alternative);
                }
                return null;
            }

            @Override
            public Void visitError(ErrorType errorType, Void unused) {
                if (!visitOnce(errorType)) {
                    return null;
                }
                Element element = errorType.asElement();
                if (element instanceof TypeElement typeElement) {
                    addReference(typeElement.getQualifiedName().toString(), referencedTypes);
                }
                return null;
            }

            private void scanType(TypeMirror candidateTypeMirror) {
                if (candidateTypeMirror != null) {
                    candidateTypeMirror.accept(this, null);
                }
            }

            private boolean visitOnce(TypeMirror candidateTypeMirror) {
                return visitedTypeMirrors.add(candidateTypeMirror);
            }

            @Override
            public Void visitNoType(NoType noType, Void unused) {
                return null;
            }

            @Override
            public Void visitPrimitive(PrimitiveType primitiveType, Void unused) {
                return null;
            }

            @Override
            public Void visitNull(NullType nullType, Void unused) {
                return null;
            }

            @Override
            protected Void defaultAction(TypeMirror ignored, Void unused) {
                return null;
            }
        }, null);
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
