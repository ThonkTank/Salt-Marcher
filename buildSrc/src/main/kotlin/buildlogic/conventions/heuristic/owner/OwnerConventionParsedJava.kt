package buildlogic.conventions.heuristic.owner

import com.sun.source.tree.BlockTree
import com.sun.source.tree.ClassTree
import com.sun.source.tree.CompilationUnitTree
import com.sun.source.tree.ImportTree
import com.sun.source.tree.MethodTree
import com.sun.source.tree.Tree
import com.sun.source.tree.VariableTree
import com.sun.source.util.JavacTask
import java.io.File
import java.nio.charset.StandardCharsets
import java.nio.file.Path
import javax.lang.model.element.Modifier
import javax.tools.ToolProvider
import org.gradle.api.GradleException

internal enum class OwnerConventionParsedJavaTypeKind {
    CLASS,
    RECORD,
    ENUM,
    INTERFACE
}

internal data class OwnerConventionParsedJavaParameter(
    val name: String,
    val typeRef: String
)

internal data class OwnerConventionParsedJavaField(
    val name: String,
    val typeRef: String,
    val modifiers: Set<Modifier>
)

internal data class OwnerConventionParsedJavaMethod(
    val name: String,
    val returnTypeRef: String?,
    val parameters: List<OwnerConventionParsedJavaParameter>,
    val modifiers: Set<Modifier>,
    val body: BlockTree?,
    val tree: MethodTree
)

internal data class OwnerConventionParsedJavaType(
    val name: String,
    val kind: OwnerConventionParsedJavaTypeKind,
    val modifiers: Set<Modifier>,
    val fields: List<OwnerConventionParsedJavaField>,
    val constructors: List<OwnerConventionParsedJavaMethod>,
    val methods: List<OwnerConventionParsedJavaMethod>,
    val tree: ClassTree
)

internal data class OwnerConventionParsedJavaSource(
    val path: String,
    val file: File,
    val packageName: String?,
    val importDeclarations: List<String>,
    val topLevelTypes: List<OwnerConventionParsedJavaType>,
    val compilationUnit: CompilationUnitTree
)

internal fun parseOwnerConventionJavaSources(
    projectRoot: Path,
    files: Collection<File>
): Map<String, OwnerConventionParsedJavaSource> {
    if (files.isEmpty()) {
        return emptyMap()
    }
    val compiler = ToolProvider.getSystemJavaCompiler()
        ?: throw GradleException("JDK compiler is required for owner convention parsing.")
    val fileManager = compiler.getStandardFileManager(null, null, StandardCharsets.UTF_8)
    return try {
        val javaFileObjects = fileManager.getJavaFileObjectsFromFiles(files)
        val task = compiler.getTask(
            null,
            fileManager,
            null,
            listOf("-proc:none"),
            null,
            javaFileObjects
        ) as JavacTask
        task.parse()
            .map { compilationUnit ->
                val file = File(compilationUnit.sourceFile.toUri())
                val path = projectRoot.relativize(file.toPath()).toString().replace('\\', '/')
                path to OwnerConventionParsedJavaSource(
                    path = path,
                    file = file,
                    packageName = compilationUnit.packageName?.toString(),
                    importDeclarations = compilationUnit.imports.map(ImportTree::getQualifiedIdentifier).map(Tree::toString),
                    topLevelTypes = compilationUnit.typeDecls
                        .mapNotNull { declaration -> declaration as? ClassTree }
                        .map(::parseJavaType),
                    compilationUnit = compilationUnit
                )
            }
            .toMap()
    } finally {
        fileManager.close()
    }
}

private fun parseJavaType(classTree: ClassTree): OwnerConventionParsedJavaType {
    val fields = mutableListOf<OwnerConventionParsedJavaField>()
    val constructors = mutableListOf<OwnerConventionParsedJavaMethod>()
    val methods = mutableListOf<OwnerConventionParsedJavaMethod>()
    classTree.members.forEach { member ->
        when (member) {
            is VariableTree -> fields += OwnerConventionParsedJavaField(
                name = member.name.toString(),
                typeRef = member.type.toString(),
                modifiers = member.modifiers.flags
            )

            is MethodTree -> {
                val parsedMethod = OwnerConventionParsedJavaMethod(
                    name = member.name.toString(),
                    returnTypeRef = member.returnType?.toString(),
                    parameters = member.parameters.map { parameter ->
                        OwnerConventionParsedJavaParameter(
                            name = parameter.name.toString(),
                            typeRef = parameter.type.toString()
                        )
                    },
                    modifiers = member.modifiers.flags,
                    body = member.body,
                    tree = member
                )
                if (member.name.contentEquals("<init>")) {
                    constructors += parsedMethod
                } else {
                    methods += parsedMethod
                }
            }
        }
    }
    return OwnerConventionParsedJavaType(
        name = classTree.simpleName.toString(),
        kind = when (classTree.kind) {
            Tree.Kind.CLASS -> OwnerConventionParsedJavaTypeKind.CLASS
            Tree.Kind.RECORD -> OwnerConventionParsedJavaTypeKind.RECORD
            Tree.Kind.ENUM -> OwnerConventionParsedJavaTypeKind.ENUM
            Tree.Kind.INTERFACE -> OwnerConventionParsedJavaTypeKind.INTERFACE
            else -> OwnerConventionParsedJavaTypeKind.CLASS
        },
        modifiers = classTree.modifiers.flags,
        fields = fields,
        constructors = constructors,
        methods = methods,
        tree = classTree
    )
}
