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
    return support.analyzeInputShape(sourceFile, snapshot)
}

internal fun inputMemberReasons(
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
