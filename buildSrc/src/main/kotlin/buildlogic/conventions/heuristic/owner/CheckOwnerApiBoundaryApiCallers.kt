package buildlogic.conventions.heuristic.owner

import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckOwnerApiBoundaryApiCallersTask(
    support: OwnerConventionSupport
): TaskProvider<Task> = support.registerRepositoryWideCheck(
    taskName = "checkOwnerApiBoundaryApiCallers",
    taskDescription = "Fail when canonical task/state/repository APIs are called from unauthorized repo-wide caller roles.",
    failureHeader = "Owner API caller drift detected.",
    failureSummary = "Canonical task, state, and repository APIs must be called only from their explicit repo-wide owner-approved caller roles."
) { snapshot ->
    apiCallerReasons(snapshot, support)
}

private fun apiCallerReasons(
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): List<String> {
    val reasons = mutableListOf<String>()
    snapshot.catalog.taskApisByTypeName.values.forEach { api ->
        reasons += snapshot.callIndex.callsTo(api.typeName, api.publicStaticMethodNames).mapNotNull { callSite ->
            if (isAllowedTaskCaller(callSite, api, snapshot, support)) {
                null
            } else {
                formatCallerViolation(
                    callSite = callSite,
                    expectation = "task APIs may be called only from the same owner's canonical <Owner>Object request methods"
                )
            }
        }
    }
    snapshot.catalog.repositoryApisByTypeName.values.forEach { api ->
        reasons += snapshot.callIndex.callsTo(api.typeName, api.publicStaticMethodNames).mapNotNull { callSite ->
            if (isAllowedRepositoryCaller(callSite, api, snapshot, support)) {
                null
            } else {
                formatCallerViolation(
                    callSite = callSite,
                    expectation = "repository APIs may be called only from the same owner's canonical <Owner>Object request methods"
                )
            }
        }
    }
    snapshot.catalog.stateApisByTypeName.values.forEach { api ->
        reasons += snapshot.callIndex.callsTo(api.typeName, api.publicStaticMethodNames).mapNotNull { callSite ->
            if (isAllowedStateCaller(callSite, api, snapshot, support)) {
                null
            } else {
                formatCallerViolation(
                    callSite = callSite,
                    expectation = "state APIs may be called only from the same owner's canonical <Owner>Object request methods or explicit same-owner repository/state collaborators"
                )
            }
        }
    }
    return reasons.distinct()
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
    val canonicalOwnerTypeName = support.canonicalOwnerObjectTypeName(ownerPackage, snapshot) ?: return false
    if (caller.typeName != canonicalOwnerTypeName) {
        return false
    }
    return caller.methodName in support.ownerRequestMethodNames(ownerPackage, snapshot)
}

private fun formatCallerViolation(
    callSite: OwnerConventionApiCallSite,
    expectation: String
): String {
    return "${callSite.caller.path} :: ${callSite.caller.typeName}.${callSite.caller.methodName} -> ${callSite.calleeTypeName}.${callSite.calleeMethodName} :: $expectation"
}
