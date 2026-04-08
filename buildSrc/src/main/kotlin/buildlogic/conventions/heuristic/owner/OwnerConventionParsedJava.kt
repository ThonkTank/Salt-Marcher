package buildlogic.conventions.heuristic.owner

import com.sun.source.tree.BlockTree
import com.sun.source.tree.ClassTree
import com.sun.source.tree.CompilationUnitTree
import com.sun.source.tree.ImportTree
import com.sun.source.tree.MethodTree
import com.sun.source.tree.Tree
import com.sun.source.tree.VariableTree
import com.sun.source.util.JavacTask
import com.sun.source.util.Trees
import java.io.File
import java.nio.charset.StandardCharsets
import java.nio.file.Path
import javax.tools.DiagnosticCollector
import javax.tools.JavaFileObject
import javax.lang.model.element.Modifier
import javax.lang.model.util.Elements
import javax.lang.model.util.Types
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
    val typeRef: String,
    val tree: VariableTree
)

internal data class OwnerConventionParsedJavaField(
    val name: String,
    val typeRef: String,
    val modifiers: Set<Modifier>,
    val tree: VariableTree
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

internal data class OwnerConventionSemanticModel(
    val trees: Trees,
    val elements: Elements,
    val types: Types
)

internal data class OwnerConventionParsedJavaSources(
    val sourcesByPath: Map<String, OwnerConventionParsedJavaSource>,
    val semanticModel: OwnerConventionSemanticModel
)

internal fun parseOwnerConventionJavaSources(
    projectRoot: Path,
    files: Collection<File>,
    classpath: Collection<File>
): OwnerConventionParsedJavaSources {
    if (files.isEmpty()) {
        return OwnerConventionParsedJavaSources(
            sourcesByPath = emptyMap(),
            semanticModel = run {
                val task = (ToolProvider.getSystemJavaCompiler()
                    ?: throw GradleException("JDK compiler is required for owner convention parsing."))
                    .getTask(null, null, null, emptyList(), null, emptyList<JavaFileObject>()) as JavacTask
                OwnerConventionSemanticModel(
                    trees = Trees.instance(task),
                    elements = task.elements,
                    types = task.types
                )
            }
        )
    }
    val compiler = ToolProvider.getSystemJavaCompiler()
        ?: throw GradleException("JDK compiler is required for owner convention parsing.")
    val fileManager = compiler.getStandardFileManager(null, null, StandardCharsets.UTF_8)
    val diagnostics = DiagnosticCollector<JavaFileObject>()
    return try {
        val javaFileObjects = fileManager.getJavaFileObjectsFromFiles(files)
        val options = mutableListOf(
            "-proc:none",
            "--enable-preview",
            "--release",
            "21"
        )
        if (classpath.isNotEmpty()) {
            options += listOf(
                "-classpath",
                classpath.joinToString(File.pathSeparator) { file -> file.absolutePath }
            )
        }
        val task = compiler.getTask(
            null,
            fileManager,
            diagnostics,
            options,
            null,
            javaFileObjects
        ) as JavacTask
        val compilationUnits = task.parse().toList()
        task.analyze()
        val trees = Trees.instance(task)
        OwnerConventionParsedJavaSources(
            sourcesByPath = compilationUnits
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
            .toMap(),
            semanticModel = OwnerConventionSemanticModel(
                trees = trees,
                elements = task.elements,
                types = task.types
            )
        )
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
                modifiers = member.modifiers.flags,
                tree = member
            )

            is MethodTree -> {
                val parsedMethod = OwnerConventionParsedJavaMethod(
                    name = member.name.toString(),
                    returnTypeRef = member.returnType?.toString(),
                    parameters = member.parameters.map { parameter ->
                        OwnerConventionParsedJavaParameter(
                            name = parameter.name.toString(),
                            typeRef = parameter.type.toString(),
                            tree = parameter
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
