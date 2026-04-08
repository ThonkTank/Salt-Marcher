package buildlogic.conventions.heuristic.owner

import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckOwnerApiBoundaryApiCallersTask(
    support: OwnerConventionSupport
): TaskProvider<Task> = support.registerCheck(
    taskName = "checkOwnerApiBoundaryApiCallers",
    taskDescription = "Fail when touched files call canonical task/state/repository APIs from unauthorized roles.",
    failureHeader = "Touched-file owner API caller drift detected.",
    failureSummary = "Touched files may call canonical task, state, and repository APIs only through their explicit owner-approved roles."
) { sourceFile, snapshot ->
    apiCallerReasons(sourceFile, snapshot, support)
}

private fun apiCallerReasons(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): List<String> {
    return snapshot.callIndex.callSites
        .asSequence()
        .filter { callSite -> callSite.caller.path == sourceFile.context.path }
        .mapNotNull { callSite -> callerViolation(callSite, snapshot, support) }
        .distinct()
        .sorted()
        .toList()
}

private fun callerViolation(
    callSite: OwnerConventionApiCallSite,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): String? {
    val taskApi = support.taskApi(callSite.calleeTypeName, snapshot)
    if (taskApi != null && callSite.calleeMethodName in taskApi.publicStaticMethodNames) {
        return if (isAllowedTaskCaller(callSite, taskApi, snapshot, support)) {
            null
        } else {
            formatCallerViolation(
                callSite = callSite,
                expectation = "task APIs may be called only from the same owner's canonical <Owner>Object request methods"
            )
        }
    }

    val repositoryApi = support.repositoryApi(callSite.calleeTypeName, snapshot)
    if (repositoryApi != null && callSite.calleeMethodName in repositoryApi.publicStaticMethodNames) {
        return if (isAllowedRepositoryCaller(callSite, repositoryApi, snapshot, support)) {
            null
        } else {
            formatCallerViolation(
                callSite = callSite,
                expectation = "repository APIs may be called only from the same owner's canonical <Owner>Object request methods"
            )
        }
    }

    val stateApi = support.stateApi(callSite.calleeTypeName, snapshot)
    if (stateApi != null && callSite.calleeMethodName in stateApi.publicStaticMethodNames) {
        return if (isAllowedStateCaller(callSite, stateApi, snapshot, support)) {
            null
        } else {
            formatCallerViolation(
                callSite = callSite,
                expectation = "state APIs may be called only from the same owner's canonical <Owner>Object request methods or explicit same-owner repository/state collaborators"
            )
        }
    }
    return null
}

private fun isAllowedTaskCaller(
    callSite: OwnerConventionApiCallSite,
    api: OwnerConventionStaticApi,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): Boolean {
    return isCanonicalOwnerRequestCaller(callSite.caller, api.ownerPackage, snapshot, support)
}

private fun isAllowedRepositoryCaller(
    callSite: OwnerConventionApiCallSite,
    api: OwnerConventionStaticApi,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): Boolean {
    return isCanonicalOwnerRequestCaller(callSite.caller, api.ownerPackage, snapshot, support)
}

private fun isAllowedStateCaller(
    callSite: OwnerConventionApiCallSite,
    api: OwnerConventionStaticApi,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): Boolean {
    val caller = callSite.caller
    if (isCanonicalOwnerRequestCaller(caller, api.ownerPackage, snapshot, support)) {
        return true
    }
    if (caller.ownerPackage != api.ownerPackage) {
        return false
    }
    if (caller.role == support.repositoryRole) {
        val repositoryApi = support.repositoryApi(caller.typeName, snapshot) ?: return false
        return repositoryApi.ownerPackage == api.ownerPackage
    }
    if (caller.role == support.stateRole) {
        val stateApi = support.stateApi(caller.typeName, snapshot) ?: return false
        return stateApi.ownerPackage == api.ownerPackage
    }
    return false
}

private fun isCanonicalOwnerRequestCaller(
    caller: OwnerConventionCallerRef,
    ownerPackage: String,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): Boolean {
    if (caller.ownerPackage != ownerPackage || caller.role != support.ownerRole) {
        return false
    }
    val canonicalOwnerCaller = support.canonicalOwnerCaller(ownerPackage, snapshot) ?: return false
    if (caller.typeName != canonicalOwnerCaller.typeName) {
        return false
    }
    return caller.methodName in canonicalOwnerCaller.requestMethodNames
}

private fun formatCallerViolation(
    callSite: OwnerConventionApiCallSite,
    expectation: String
): String {
    return "${callSite.caller.path} :: ${callSite.caller.typeName}.${callSite.caller.methodName} -> ${callSite.calleeTypeName}.${callSite.calleeMethodName} :: $expectation"
}
