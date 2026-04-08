package buildlogic.conventions.heuristic.owner

import com.sun.source.tree.BlockTree
import com.sun.source.tree.NewClassTree
import com.sun.source.tree.Tree
import com.sun.source.tree.VariableTree
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
    return support.analyzeInputShape(sourceFile, snapshot)
}

internal fun inputMemberReasons(
    path: String,
    primaryType: OwnerConventionParsedJavaType
): List<String> {
    return inputValueTypeReasons(
        path = path,
        parsedType = primaryType,
        allowNestedTypes = true,
        locationLabel = "input files"
    )
}

private fun inputValueTypeReasons(
    path: String,
    parsedType: OwnerConventionParsedJavaType,
    allowNestedTypes: Boolean,
    locationLabel: String
): List<String> {
    val reasons = mutableListOf<String>()
    val classTree = parsedType.tree

    if (parsedType.methods.isNotEmpty()) {
        reasons += "$path :: $locationLabel must not declare methods"
    }
    if (classTree.members.any { member -> member is BlockTree }) {
        reasons += "$path :: $locationLabel must not declare initializer blocks"
    }

    when (parsedType.kind) {
        OwnerConventionParsedJavaTypeKind.RECORD -> Unit

        OwnerConventionParsedJavaTypeKind.INTERFACE -> {
            if (parsedType.fields.isNotEmpty()) {
                reasons += "$path :: sealed interface inputs must stay as tag carriers without fields"
            }
            if (parsedType.constructors.isNotEmpty()) {
                reasons += "$path :: sealed interface inputs must not declare constructors"
            }
        }

        OwnerConventionParsedJavaTypeKind.ENUM -> {
            if (parsedType.constructors.isNotEmpty()) {
                reasons += "$path :: enum inputs must not declare constructors"
            }
            val enumFields = parsedType.fields
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

    if (!allowNestedTypes && parsedType.nestedTypes.isNotEmpty()) {
        reasons += "$path :: request-local input value types must not declare nested types"
    }
    if (allowNestedTypes) {
        parsedType.nestedTypes.forEach { nestedType ->
            reasons += inputValueTypeReasons(
                path = path,
                parsedType = nestedType,
                allowNestedTypes = false,
                locationLabel = "request-local input value types"
            )
        }
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
