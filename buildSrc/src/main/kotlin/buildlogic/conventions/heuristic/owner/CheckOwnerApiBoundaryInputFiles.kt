package buildlogic.conventions.heuristic.owner

import com.sun.source.tree.BlockTree
import com.sun.source.tree.ClassTree
import com.sun.source.tree.NewClassTree
import com.sun.source.tree.Tree
import com.sun.source.tree.VariableTree
import javax.lang.model.element.Modifier
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckOwnerApiBoundaryInputFilesTask(
    support: OwnerConventionSupport
): TaskProvider<Task> = support.registerCheck(
    taskName = "checkOwnerApiBoundaryInputFiles",
    taskDescription = "Fail when touched owner input files drift away from the canonical <Request>Input rules.",
    failureHeader = "Owner input drift detected.",
    failureSummary = "Touched input files must remain owner-local request carriers that match a real owner public request.",
    applicableRoles = setOf(support.inputRole)
) { sourceFile, snapshot ->
    analyzeInputFile(sourceFile, snapshot, support).reasons
}

internal fun analyzeInputFile(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): OwnerConventionAnalysis<OwnerConventionInputApi> {
    val context = sourceFile.context
    val reasons = mutableListOf<String>()
    val className = context.className.removeSuffix(".java")
    val requestStem = support.requestStemForFile(context.className, "Input")
    if (requestStem == null) {
        reasons += "${context.path} :: input files must be named <Request>Input with a direct request stem"
    } else if (requestStem !in snapshot.requestStemsByOwner[context.ownerPackage].orEmpty()) {
        reasons += "${context.path} :: input files must match a real public request on ${context.ownerPackage}.${support.ownerObjectName(context.ownerPackage)} that accepts exactly ${requestStem}Input"
    }
    val primaryType = support.parsedPrimaryType(sourceFile)
    if (primaryType == null) {
        reasons += "${context.path} :: input files must declare a top-level type named $className"
        return OwnerConventionAnalysis(
            reasons = reasons,
            model = null
        )
    }
    val validKind = primaryType.kind == OwnerConventionParsedJavaTypeKind.RECORD ||
        primaryType.kind == OwnerConventionParsedJavaTypeKind.ENUM ||
        (primaryType.kind == OwnerConventionParsedJavaTypeKind.INTERFACE && Modifier.SEALED in primaryType.modifiers)
    if (!validKind) {
        reasons += "${context.path} :: input files must declare a record, enum, or sealed interface"
    }
    if (sourceFile.parsedSource.topLevelTypes.size != 1) {
        reasons += "${context.path} :: input files must contain exactly one top-level type"
    }
    reasons += inputMemberReasons(context.path, primaryType)
    context.typeImports.importedPackages.forEach { importedPackage ->
        if (support.roleForDirectoryName(importedPackage.substringAfterLast('.')) != support.inputRole) {
            reasons += "${context.path} -> $importedPackage :: input files may import only other input packages from project code"
        }
    }
    val canonicalApi = support.inputApiShape(sourceFile, snapshot)
    return OwnerConventionAnalysis(
        reasons = reasons.distinct(),
        model = canonicalApi
    )
}

private fun inputMemberReasons(
    path: String,
    primaryType: OwnerConventionParsedJavaType
): List<String> {
    val reasons = mutableListOf<String>()
    val classTree = primaryType.tree

    if (primaryType.constructors.isNotEmpty()) {
        reasons += "$path :: input files must not declare constructors"
    }
    if (primaryType.methods.isNotEmpty()) {
        reasons += "$path :: input files must not declare methods"
    }
    if (classTree.members.any { member -> member is BlockTree }) {
        reasons += "$path :: input files must not declare initializer blocks"
    }
    if (classTree.members.any { member -> member is ClassTree }) {
        reasons += "$path :: input files must not declare nested types"
    }

    when (primaryType.kind) {
        OwnerConventionParsedJavaTypeKind.RECORD -> {
            if (primaryType.fields.isNotEmpty()) {
                reasons += "$path :: record inputs may expose only record components"
            }
        }

        OwnerConventionParsedJavaTypeKind.INTERFACE -> {
            if (primaryType.fields.isNotEmpty()) {
                reasons += "$path :: sealed interface inputs must stay as tag carriers without fields"
            }
        }

        OwnerConventionParsedJavaTypeKind.ENUM -> {
            val enumFields = primaryType.fields
            val enumConstants = enumFields.filter(::isEnumConstant)
            val extraFields = enumFields.filterNot(::isEnumConstant)
            if (extraFields.isNotEmpty()) {
                reasons += "$path :: enum inputs must not declare fields beyond enum constants"
            }
            if (enumConstants.any(::hasEnumConstantBody)) {
                reasons += "$path :: enum inputs may use only enum constants without per-constant bodies"
            }
        }

        else -> Unit
    }

    return reasons
}

private fun isEnumConstant(field: OwnerConventionParsedJavaField): Boolean {
    return field.tree.type == null
}

private fun hasEnumConstantBody(field: OwnerConventionParsedJavaField): Boolean {
    val initializer = field.tree.initializer as? NewClassTree ?: return false
    return initializer.classBody != null
}
