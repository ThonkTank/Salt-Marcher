package buildlogic.conventions.heuristic.owner

import javax.lang.model.element.Modifier
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckOwnerApiBoundaryTaskFilesTask(
    support: OwnerConventionSupport
): TaskProvider<Task> = support.registerCheck(
    taskName = "checkOwnerApiBoundaryTaskFiles",
    taskDescription = "Fail when touched owner task files drift away from the canonical <Request>Task rules.",
    failureHeader = "Owner task drift detected.",
    failureSummary = "Touched task files must remain static input-to-input pipelines that align with a real owner public request.",
    applicableRoles = setOf(support.taskRole)
) { sourceFile, snapshot ->
    taskFileReasons(sourceFile, snapshot, support)
}

private fun taskFileReasons(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): List<String> {
    val context = sourceFile.context
    val reasons = mutableListOf<String>()
    val className = context.className.removeSuffix(".java")
    val requestStem = support.requestStemForFile(context.className, "Task")
    if (requestStem == null) {
        reasons += "${context.path} :: task files must be named <Request>Task with a direct request stem"
    } else if (requestStem !in snapshot.requestStemsByOwner[context.ownerPackage].orEmpty()) {
        reasons += "${context.path} :: task files must match a real public request on ${context.ownerPackage}.${support.ownerObjectName(context.ownerPackage)}"
    }
    val primaryType = support.parsedPrimaryType(sourceFile)
    if (primaryType == null) {
        reasons += "${context.path} :: task files must declare a top-level type named $className"
        return reasons
    }
    if (sourceFile.parsedSource.topLevelTypes.size != 1) {
        reasons += "${context.path} :: task files must contain exactly one top-level type"
    }
    if (primaryType.kind != OwnerConventionParsedJavaTypeKind.CLASS || Modifier.FINAL !in primaryType.modifiers) {
        reasons += "${context.path} :: task files must declare a final class"
    }
    val constructors = primaryType.constructors
    if (constructors.none { Modifier.PRIVATE in it.modifiers } || constructors.any { Modifier.PUBLIC in it.modifiers }) {
        reasons += "${context.path} :: task files must hide construction behind a private constructor"
    }
    context.typeImports.importedPackages.forEach { importedPackage ->
        if (support.roleForDirectoryName(importedPackage.substringAfterLast('.')) != support.inputRole) {
            reasons += "${context.path} -> $importedPackage :: task files may import only input packages from project code"
        }
    }
    val publicStaticMethods = primaryType.methods.filter {
        Modifier.PUBLIC in it.modifiers && Modifier.STATIC in it.modifiers
    }
    val publicInstanceMethods = primaryType.methods.filter {
        Modifier.PUBLIC in it.modifiers && Modifier.STATIC !in it.modifiers
    }
    if (publicStaticMethods.size != 1) {
        reasons += "${context.path} :: task files must expose exactly one public static method"
    }
    if (publicInstanceMethods.isNotEmpty()) {
        reasons += "${context.path} :: task files must not expose public instance methods"
    }
    publicStaticMethods.singleOrNull()?.let { method ->
        if (method.parameters.size != 1) {
            reasons += "${context.path} :: task files must model exactly one input parameter"
        }
        val parameterTypes = method.parameters.flatMap { parameter ->
            support.projectTypeNames(
                parameter.typeRef,
                context.packageName,
                context.typeImports,
                snapshot.knownTypeNames
            )
        }.distinct()
        val returnTypes = support.projectTypeNames(
            method.returnTypeRef ?: "void",
            context.packageName,
            context.typeImports,
            snapshot.knownTypeNames
        )
        if (parameterTypes.size != 1 || parameterTypes.any { typeName ->
                support.roleForDirectoryName(typeName.substringBeforeLast('.').substringAfterLast('.')) != support.inputRole
            }
        ) {
            reasons += "${context.path} :: task methods must accept exactly one project input type"
        }
        if (requestStem != null) {
            val expectedInputType = "${context.ownerPackage}.${support.inputRole}.${requestStem}Input"
            if (parameterTypes != listOf(expectedInputType)) {
                reasons += "${context.path} :: task methods must accept exactly ${requestStem}Input from the same owner"
            }
        }
        if (returnTypes.size != 1 || returnTypes.any { typeName ->
                support.roleForDirectoryName(typeName.substringBeforeLast('.').substringAfterLast('.')) != support.inputRole
            }
        ) {
            reasons += "${context.path} :: task methods must return exactly one project input type"
        }
    }
    return reasons
}
