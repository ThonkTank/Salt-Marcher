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

final class ViewArchitectureSupport {

    static final Pattern ROOT_PACKAGE = Pattern.compile("^src\\.view\\.([^.]+)$");
    static final Pattern ASSEMBLY_PACKAGE = Pattern.compile("^src\\.view\\.([^.]+)\\.assembly(\\..*)?$");
    static final Pattern VIEW_PACKAGE = Pattern.compile("^src\\.view\\.([^.]+)\\.View(\\..*)?$");
    static final Pattern VIEW_MODEL_PACKAGE = Pattern.compile("^src\\.view\\.([^.]+)\\.ViewModel(\\..*)?$");
    static final Pattern API_PACKAGE = Pattern.compile("^src\\.view\\.([^.]+)\\.api(\\..*)?$");
    static final Pattern DATA_ROOT_PACKAGE = Pattern.compile("^src\\.data\\.([^.]+)$");

    private static final Set<String> KNOWN_BUCKETS = Set.of("assembly", "api", "View", "ViewModel", "Model", "Controller", "interactor");
    private static final Set<String> ROOT_ALLOWED_SHELL_TYPES = Set.of(
            "shell.api.ContributionKey",
            "shell.api.NavigationGroupSpec",
            "shell.api.ShellContributionSpec",
            "shell.api.ShellRuntimeContext",
            "shell.api.ShellRuntimeStateSpec",
            "shell.api.ShellScreen",
            "shell.api.ShellTabMode",
            "shell.api.ShellTabSpec",
            "shell.api.ShellTopBarSpec",
            "shell.api.ShellViewContribution");
    private static final Set<String> ASSEMBLY_ALLOWED_SHELL_TYPES = Set.of(
            "shell.api.InspectorEntrySpec",
            "shell.api.InspectorSink",
            "shell.api.NavigationGraphicSupport",
            "shell.api.ServiceRegistry",
            "shell.api.ShellRuntimeContext",
            "shell.api.ShellScreen",
            "shell.api.ShellSlot");
    private static final Set<String> DATA_ROOT_ALLOWED_SHELL_TYPES = Set.of(
            "shell.api.ServiceContribution",
            "shell.api.ServiceRegistry");

    private ViewArchitectureSupport() {
    }

    static String packageName(CompilationUnitTree tree) {
        return tree.getPackageName() == null ? "" : tree.getPackageName().toString();
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

    static void collectReferencedTypes(Tree tree, Set<String> referencedTypes) {
        Symbol symbol = ASTHelpers.getSymbol(tree);
        if (symbol != null) {
            addReference(getQualifiedTypeName(symbol), referencedTypes);
            addReference(getQualifiedOwnerTypeName(symbol), referencedTypes);
        }
        collectTypeReferences(ASTHelpers.getType(tree), referencedTypes);
    }

    static void addReference(String qualifiedName, Set<String> referencedTypes) {
        if (qualifiedName != null && !qualifiedName.isBlank()) {
            referencedTypes.add(qualifiedName);
        }
    }

    static String getQualifiedTypeName(Symbol symbol) {
        if (symbol instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        if (symbol != null && symbol.type != null && symbol.type.tsym instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        return null;
    }

    static String getQualifiedOwnerTypeName(Symbol symbol) {
        if (symbol == null || symbol.owner == null) {
            return null;
        }
        if (symbol.owner instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        return null;
    }

    static boolean isAllowedDomainBoundary(String referencedType) {
        return referencedType.matches("^src\\.domain\\.[^.]+\\.[^.]+ApplicationService((\\$|\\.).*)?$")
                || referencedType.matches("^src\\.domain\\.[^.]+\\.api\\..+");
    }

    static ViewTypeInfo parseViewType(String referencedType) {
        if (referencedType == null || !referencedType.startsWith("src.view.")) {
            return null;
        }
        String remainder = referencedType.substring("src.view.".length());
        String[] segments = remainder.split("\\.");
        if (segments.length < 2) {
            return null;
        }
        String component = segments[0];
        String bucket = KNOWN_BUCKETS.contains(segments[1]) ? segments[1] : "ROOT";
        return new ViewTypeInfo(component, bucket);
    }

    static boolean isPrivateViewLeak(String referencedType, String ownComponent) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        if (viewType == null) {
            return false;
        }
        if (viewType.component().equals(ownComponent)) {
            return !"api".equals(viewType.bucket());
        }
        return !"api".equals(viewType.bucket());
    }

    static boolean isAllowedRootShellType(String referencedType) {
        return isAllowedShellType(referencedType, ROOT_ALLOWED_SHELL_TYPES);
    }

    static boolean isAllowedAssemblyShellType(String referencedType) {
        return isAllowedShellType(referencedType, ASSEMBLY_ALLOWED_SHELL_TYPES);
    }

    static boolean isAllowedDataRootShellType(String referencedType) {
        return isAllowedShellType(referencedType, DATA_ROOT_ALLOWED_SHELL_TYPES);
    }

    private static boolean isAllowedShellType(String referencedType, Set<String> allowedTypes) {
        if (referencedType == null || !referencedType.startsWith("shell.")) {
            return true;
        }
        for (String allowedType : allowedTypes) {
            if (referencedType.equals(allowedType)
                    || referencedType.startsWith(allowedType + "$")
                    || referencedType.startsWith(allowedType + ".")) {
                return true;
            }
        }
        return false;
    }

    private static void collectTypeReferences(TypeMirror typeMirror, Set<String> referencedTypes) {
        if (typeMirror == null) {
            return;
        }
        typeMirror.accept(new SimpleTypeVisitor14<Void, Void>() {
            @Override
            public Void visitDeclared(DeclaredType declaredType, Void unused) {
                Element element = declaredType.asElement();
                if (element instanceof TypeElement typeElement) {
                    addReference(typeElement.getQualifiedName().toString(), referencedTypes);
                }
                for (TypeMirror typeArgument : declaredType.getTypeArguments()) {
                    typeArgument.accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitArray(ArrayType arrayType, Void unused) {
                arrayType.getComponentType().accept(this, null);
                return null;
            }

            @Override
            public Void visitTypeVariable(TypeVariable typeVariable, Void unused) {
                typeVariable.getUpperBound().accept(this, null);
                TypeMirror lowerBound = typeVariable.getLowerBound();
                if (lowerBound != null) {
                    lowerBound.accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitWildcard(WildcardType wildcardType, Void unused) {
                if (wildcardType.getExtendsBound() != null) {
                    wildcardType.getExtendsBound().accept(this, null);
                }
                if (wildcardType.getSuperBound() != null) {
                    wildcardType.getSuperBound().accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitExecutable(ExecutableType executableType, Void unused) {
                executableType.getReturnType().accept(this, null);
                for (TypeMirror parameterType : executableType.getParameterTypes()) {
                    parameterType.accept(this, null);
                }
                for (TypeMirror thrownType : executableType.getThrownTypes()) {
                    thrownType.accept(this, null);
                }
                for (TypeMirror typeVariable : executableType.getTypeVariables()) {
                    typeVariable.accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitIntersection(IntersectionType intersectionType, Void unused) {
                for (TypeMirror bound : intersectionType.getBounds()) {
                    bound.accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitUnion(UnionType unionType, Void unused) {
                for (TypeMirror alternative : unionType.getAlternatives()) {
                    alternative.accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitError(ErrorType errorType, Void unused) {
                Element element = errorType.asElement();
                if (element instanceof TypeElement typeElement) {
                    addReference(typeElement.getQualifiedName().toString(), referencedTypes);
                }
                return null;
            }

            @Override
            protected Void defaultAction(TypeMirror ignored, Void unused) {
                return null;
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
        }, null);
    }

    record ViewTypeInfo(String component, String bucket) {
    }
}
