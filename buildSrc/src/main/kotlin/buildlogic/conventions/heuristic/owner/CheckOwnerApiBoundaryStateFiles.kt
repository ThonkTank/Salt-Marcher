package buildlogic.conventions.heuristic.owner

import com.sun.source.tree.BlockTree
import com.sun.source.tree.MethodInvocationTree
import com.sun.source.tree.NewClassTree
import com.sun.source.util.TreePath
import com.sun.source.util.TreePathScanner
import javax.lang.model.element.Modifier
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckOwnerApiBoundaryStateFilesTask(
    support: OwnerConventionSupport
): TaskProvider<Task> = support.registerCheck(
    taskName = "checkOwnerApiBoundaryStateFiles",
    taskDescription = "Fail when touched owner state files drift away from the canonical state-layer rules.",
    failureHeader = "Owner state drift detected.",
    failureSummary = "Touched state files must keep owner-local factory/transition boundaries and expose only owner state types.",
    applicableRoles = setOf(support.stateRole)
) { sourceFile, snapshot ->
    analyzeStateFile(sourceFile, snapshot, support).reasons
}

internal fun analyzeStateFile(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): OwnerConventionAnalysis<OwnerConventionStaticApi> {
    val context = sourceFile.context
    val reasons = mutableListOf<String>()
    val className = context.className.removeSuffix(".java")
    val primaryType = support.parsedPrimaryType(sourceFile)
    if (primaryType == null) {
        reasons += "${context.path} :: state files must declare a top-level type named $className"
        return OwnerConventionAnalysis(
            reasons = reasons,
            model = null
        )
    }
    if (sourceFile.parsedSource.topLevelTypes.size != 1) {
        reasons += "${context.path} :: state files must contain exactly one top-level type"
    }
    val validKind = primaryType.kind == OwnerConventionParsedJavaTypeKind.RECORD ||
        primaryType.kind == OwnerConventionParsedJavaTypeKind.ENUM ||
        (primaryType.kind == OwnerConventionParsedJavaTypeKind.CLASS && Modifier.FINAL in primaryType.modifiers)
    if (!validKind) {
        reasons += "${context.path} :: state files must declare a final class, record, or enum"
    }
    if (
        primaryType.kind == OwnerConventionParsedJavaTypeKind.CLASS &&
        primaryType.constructors.any { Modifier.PUBLIC in it.modifiers }
    ) {
        reasons += "${context.path} :: state classes must use factory or transition methods instead of public constructors"
    }
    context.typeImports.importedPackages.forEach { importedPackage ->
        val importedRole = support.roleForDirectoryName(importedPackage.substringAfterLast('.'))
        val allowed = support.sameOwner(context.ownerPackage, importedPackage) &&
            importedRole in setOf(support.inputRole, support.stateRole)
        if (!allowed) {
            reasons += "${context.path} -> $importedPackage :: state files may import only own input and own state packages"
        }
    }
    val publicMethods = primaryType.methods.filter { Modifier.PUBLIC in it.modifiers }
    if (publicMethods.any { Modifier.STATIC !in it.modifiers }) {
        reasons += "${context.path} :: state files must not expose public instance methods"
    }
    publicMethods
        .filter { Modifier.STATIC in it.modifiers }
        .forEach { method ->
            val parameterPackages = method.parameters.flatMap { parameter ->
                support.projectTypePackages(parameter.tree.type, sourceFile.parsedSource, snapshot)
            }.distinct()
            val returnPackages = support.projectTypePackages(method.tree.returnType, sourceFile.parsedSource, snapshot)
            if (parameterPackages.any { projectPackage ->
                    !support.sameOwner(context.ownerPackage, projectPackage) ||
                        support.roleForDirectoryName(projectPackage.substringAfterLast('.')) !in setOf(support.inputRole, support.stateRole)
                }
            ) {
                reasons += "${context.path} :: state factories may accept only own input and own state types"
            }
            if (returnPackages.any { projectPackage ->
                    !support.sameOwner(context.ownerPackage, projectPackage) ||
                        support.roleForDirectoryName(projectPackage.substringAfterLast('.')) != support.stateRole
                }
            ) {
                reasons += "${context.path} :: state factories may return only own state types"
            }
        }
    reasons += stateBodyReasons(
        sourceFile = sourceFile,
        snapshot = snapshot,
        support = support,
        primaryType = primaryType
    )
    val canonicalApi = support.stateApiShape(sourceFile, snapshot)
    return OwnerConventionAnalysis(
        reasons = reasons.distinct(),
        model = canonicalApi
    )
}

private fun stateBodyReasons(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    primaryType: OwnerConventionParsedJavaType
): List<String> {
    val currentTypeName = "${sourceFile.context.packageName}.${primaryType.name}"
    val reasons = mutableListOf<String>()
    primaryType.constructors.forEach { constructor ->
        reasons += scanStateBody(
            body = constructor.body,
            memberName = "<init>",
            currentTypeName = currentTypeName,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support
        )
    }
    primaryType.methods.forEach { method ->
        reasons += scanStateBody(
            body = method.body,
            memberName = method.name,
            currentTypeName = currentTypeName,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support
        )
    }
    return reasons.distinct()
}

private fun scanStateBody(
    body: BlockTree?,
    memberName: String,
    currentTypeName: String,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): List<String> {
    if (body == null) {
        return emptyList()
    }
    val reasons = mutableListOf<String>()
    object : TreePathScanner<Unit, Nothing?>() {
        override fun visitMethodInvocation(node: MethodInvocationTree, p: Nothing?) {
            reasons += stateInvocationReasons(
                invocation = node,
                memberName = memberName,
                currentTypeName = currentTypeName,
                sourceFile = sourceFile,
                snapshot = snapshot,
                support = support
            )
            super.visitMethodInvocation(node, p)
        }

        override fun visitNewClass(node: NewClassTree, p: Nothing?) {
            reasons += stateNewClassReasons(
                expression = node,
                memberName = memberName,
                currentTypeName = currentTypeName,
                sourceFile = sourceFile,
                snapshot = snapshot,
                support = support
            )
            super.visitNewClass(node, p)
        }
    }.scan(TreePath.getPath(sourceFile.parsedSource.compilationUnit, body), null)
    return reasons
}

private fun stateInvocationReasons(
    invocation: MethodInvocationTree,
    memberName: String,
    currentTypeName: String,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): List<String> {
    val context = sourceFile.context
    val calleeTypeName = support.topLevelTypeNameForTree(invocation, sourceFile.parsedSource, snapshot) ?: return emptyList()
    if (calleeTypeName == currentTypeName) {
        return emptyList()
    }
    forbiddenStateExternalTypeReason(calleeTypeName)?.let { reason ->
        return listOf("${context.path} :: $reason ($memberName -> $calleeTypeName)")
    }
    if (calleeTypeName !in snapshot.knownTypeNames) {
        return emptyList()
    }
    val calleePackage = calleeTypeName.substringBeforeLast('.')
    val calleeRole = support.roleForDirectoryName(calleePackage.substringAfterLast('.'))
    val calleeOwnerPackage = support.ownerPackageFor(calleePackage, calleeRole)
    return when {
        calleeOwnerPackage == context.ownerPackage && calleeRole == support.stateRole -> emptyList()
        calleeOwnerPackage == context.ownerPackage &&
            calleeRole == support.inputRole &&
            support.isCanonicalInputAccessorInvocation(calleeTypeName, invocation, sourceFile.parsedSource, snapshot) -> emptyList()
        calleeOwnerPackage == context.ownerPackage && calleeRole == support.inputRole ->
            listOf("${context.path} :: state bodies may read own input values only through canonical input accessors ($memberName -> $calleeTypeName)")
        calleeRole == support.repositoryRole ->
            listOf("${context.path} :: state bodies must not call repository APIs ($memberName -> $calleeTypeName)")
        calleeRole == support.ownerRole ->
            listOf("${context.path} :: state bodies must not orchestrate owner seams ($memberName -> $calleeTypeName)")
        calleeRole == support.taskRole ->
            listOf("${context.path} :: state bodies must not call task pipelines ($memberName -> $calleeTypeName)")
        else ->
            listOf("${context.path} :: state bodies may depend only on own input/state project types ($memberName -> $calleeTypeName)")
    }
}

private fun stateNewClassReasons(
    expression: NewClassTree,
    memberName: String,
    currentTypeName: String,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): List<String> {
    val context = sourceFile.context
    if (expression.classBody != null) {
        return listOf("${context.path} :: state bodies must not allocate anonymous classes ($memberName)")
    }
    val typeName = support.resolveTypeName(expression.identifier, sourceFile.parsedSource, snapshot)
        ?: return emptyList()
    if (typeName == currentTypeName) {
        return emptyList()
    }
    forbiddenStateExternalTypeReason(typeName)?.let { reason ->
        return listOf("${context.path} :: $reason ($memberName -> $typeName)")
    }
    if (typeName !in snapshot.knownTypeNames) {
        return emptyList()
    }
    val typePackage = typeName.substringBeforeLast('.')
    val typeRole = support.roleForDirectoryName(typePackage.substringAfterLast('.'))
    val targetOwnerPackage = support.ownerPackageFor(typePackage, typeRole)
    return if (targetOwnerPackage == context.ownerPackage && typeRole == support.stateRole) {
        emptyList()
    } else {
        listOf("${context.path} :: state bodies may construct only own state project types ($memberName -> $typeName)")
    }
}

private fun forbiddenStateExternalTypeReason(typeName: String): String? {
    return when {
        typeName == "database.DatabaseManager" || typeName.startsWith("database.") ->
            "state bodies must not touch database infrastructure"
        typeName == "java.lang.Thread" ||
            typeName.startsWith("java.util.concurrent.") ||
            typeName.startsWith("javafx.concurrent.") ->
            "state bodies must not coordinate threads"
        typeName.startsWith("java.sql.") ->
            "state bodies must not call SQL APIs"
        typeName.startsWith("java.io.") ||
            typeName.startsWith("java.net.") ||
            typeName.startsWith("java.nio.file.") ->
            "state bodies must not perform I/O"
        typeName == "ui" || typeName.startsWith("ui.") ->
            "state bodies must not touch UI types"
        else -> null
    }
}
