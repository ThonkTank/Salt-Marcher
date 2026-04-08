package buildlogic.conventions.heuristic.owner

import com.sun.source.tree.MethodInvocationTree
import com.sun.source.util.TreePath
import com.sun.source.util.TreePathScanner
import javax.lang.model.element.Element
import javax.lang.model.element.ExecutableElement
import javax.lang.model.element.TypeElement

internal data class OwnerConventionCallerRef(
    val path: String,
    val typeName: String,
    val ownerPackage: String,
    val role: String,
    val methodName: String
)

internal data class OwnerConventionApiCallSite(
    val caller: OwnerConventionCallerRef,
    val calleeTypeName: String,
    val calleeOwnerPackage: String,
    val calleeRole: String,
    val calleeMethodName: String
)

internal data class OwnerConventionCallIndex(
    val callSites: List<OwnerConventionApiCallSite>
) {
    companion object {
        val EMPTY = OwnerConventionCallIndex(emptyList())
    }

    fun callsTo(typeName: String, methodNames: Set<String>): List<OwnerConventionApiCallSite> {
        if (methodNames.isEmpty()) {
            return emptyList()
        }
        return callSites.filter { callSite ->
            callSite.calleeTypeName == typeName && callSite.calleeMethodName in methodNames
        }
    }
}

internal fun OwnerConventionSupport.buildOwnerConventionCallIndex(
    snapshot: OwnerConventionSnapshot
): OwnerConventionCallIndex {
    val callSites = mutableListOf<OwnerConventionApiCallSite>()
    snapshot.parsedSourcesByPath.values.forEach { parsedSource ->
        val packageName = parsedSource.packageName ?: return@forEach
        val role = roleForDirectoryName(parsedSource.file.parentFile.name)
        val ownerPackage = ownerPackageFor(packageName, role)
        parsedSource.topLevelTypes.forEach { parsedType ->
            val callerTypeName = "$packageName.${parsedType.name}"
            parsedType.constructors.forEach { constructor ->
                constructor.body?.let { body ->
                    OwnerConventionCallScanner(
                        support = this,
                        snapshot = snapshot,
                        caller = OwnerConventionCallerRef(
                            path = parsedSource.path,
                            typeName = callerTypeName,
                            ownerPackage = ownerPackage,
                            role = role,
                            methodName = "<init>"
                        ),
                        callSites = callSites
                    ).scan(TreePath.getPath(parsedSource.compilationUnit, body), null)
                }
            }
            parsedType.methods.forEach { method ->
                method.body?.let { body ->
                    OwnerConventionCallScanner(
                        support = this,
                        snapshot = snapshot,
                        caller = OwnerConventionCallerRef(
                            path = parsedSource.path,
                            typeName = callerTypeName,
                            ownerPackage = ownerPackage,
                            role = role,
                            methodName = method.name
                        ),
                        callSites = callSites
                    ).scan(TreePath.getPath(parsedSource.compilationUnit, body), null)
                }
            }
        }
    }
    return OwnerConventionCallIndex(callSites)
}

private class OwnerConventionCallScanner(
    private val support: OwnerConventionSupport,
    private val snapshot: OwnerConventionSnapshot,
    private val caller: OwnerConventionCallerRef,
    private val callSites: MutableList<OwnerConventionApiCallSite>
) : TreePathScanner<Unit, Nothing?>() {

    override fun visitMethodInvocation(node: MethodInvocationTree, p: Nothing?) {
        val invocationPath = currentPath
        if (invocationPath != null) {
            val methodElement = snapshot.semanticModel.trees.getElement(invocationPath) as? ExecutableElement
            val calleeType = topLevelTypeElement(methodElement)
            val calleeTypeName = calleeType?.qualifiedName?.toString()
            if (methodElement != null && calleeTypeName != null && calleeTypeName in snapshot.knownTypeNames) {
                val calleePackage = calleeTypeName.substringBeforeLast('.')
                val calleeRole = support.roleForDirectoryName(calleePackage.substringAfterLast('.'))
                callSites += OwnerConventionApiCallSite(
                    caller = caller,
                    calleeTypeName = calleeTypeName,
                    calleeOwnerPackage = support.ownerPackageFor(calleePackage, calleeRole),
                    calleeRole = calleeRole,
                    calleeMethodName = methodElement.simpleName.toString()
                )
            }
        }
        super.visitMethodInvocation(node, p)
    }
}

private fun topLevelTypeElement(element: Element?): TypeElement? {
    var current = element
    var topLevelType: TypeElement? = null
    while (current != null) {
        if (current is TypeElement) {
            topLevelType = current
        }
        current = current.enclosingElement
    }
    return topLevelType
}
