import java.io.File
import java.util.Properties

data class EnforcementBundleDescriptor(
    val bundleId: String,
    val order: Int,
    val taskNames: List<String>,
    val rootHostScript: String?,
    val buildHarnessHostScript: String?,
    val errorProneHostScript: String?,
    val errorProneSourceDir: String?,
    val errorProneServiceFile: String?,
    val pmdHostScript: String?
)

fun Properties.requiredTrimmed(name: String): String = getProperty(name)
    ?.trim()
    ?.takeIf(String::isNotEmpty)
    ?: error("Missing required enforcement bundle property '$name'.")

fun Properties.optionalTrimmed(name: String): String? = getProperty(name)
    ?.trim()
    ?.takeIf(String::isNotEmpty)

fun Properties.list(name: String): List<String> = getProperty(name)
    ?.split(',')
    ?.map(String::trim)
    ?.filter(String::isNotEmpty)
    ?: emptyList()

fun Properties.boolean(name: String): Boolean = getProperty(name)
    ?.trim()
    ?.equals("true", ignoreCase = true)
    ?: false

fun resolveDescriptorPath(repoRootDir: File, descriptorFile: File, rawPath: String): String {
    val trimmedPath = rawPath.trim()
    if (trimmedPath.isEmpty()) {
        error("Encountered an empty descriptor path in ${descriptorFile.path}.")
    }
    val rawFile = File(trimmedPath)
    val strippedLegacyPrefix = trimmedPath.removePrefix("../../")
    val candidatePaths = buildList {
        if (rawFile.isAbsolute) {
            add(rawFile)
        }
        add(repoRootDir.resolve(trimmedPath))
        add(descriptorFile.parentFile.resolve(trimmedPath))
        if (trimmedPath.startsWith("../../")) {
            add(repoRootDir.resolve("tools/$strippedLegacyPrefix"))
            add(repoRootDir.resolve("tools/quality/$strippedLegacyPrefix"))
        }
    }.distinctBy { file -> file.path }
    return candidatePaths.firstOrNull(File::exists)?.canonicalPath
        ?: error(
            "Could not resolve descriptor path '$trimmedPath' from ${descriptorFile.path}. "
                + "Tried: ${candidatePaths.joinToString { it.path }}"
        )
}

fun loadEnforcementBundleDescriptors(repoRootDir: File): Map<String, EnforcementBundleDescriptor> {
    val qualityDir = File(repoRootDir, "tools/quality")
    if (!qualityDir.isDirectory) {
        return emptyMap()
    }
    return qualityDir.walkTopDown()
        .filter { file -> file.isFile && file.name == "bundle.properties" }
        .map { descriptorFile ->
            val properties = Properties()
            descriptorFile.inputStream().use(properties::load)
            if (!properties.boolean("descriptorOwned")) {
                null
            } else {
                EnforcementBundleDescriptor(
                    bundleId = properties.requiredTrimmed("bundleId"),
                    order = properties.requiredTrimmed("order").toInt(),
                    taskNames = properties.list("taskNames"),
                    rootHostScript = properties.optionalTrimmed("rootHostScript")
                        ?.let { rawPath -> resolveDescriptorPath(repoRootDir, descriptorFile, rawPath) },
                    buildHarnessHostScript = properties.optionalTrimmed("buildHarnessHostScript")
                        ?.let { rawPath -> resolveDescriptorPath(repoRootDir, descriptorFile, rawPath) },
                    errorProneHostScript = properties.optionalTrimmed("errorProneHostScript")
                        ?.let { rawPath -> resolveDescriptorPath(repoRootDir, descriptorFile, rawPath) },
                    errorProneSourceDir = properties.optionalTrimmed("errorProneSourceDir")
                        ?.let { rawPath -> resolveDescriptorPath(repoRootDir, descriptorFile, rawPath) },
                    errorProneServiceFile = properties.optionalTrimmed("errorProneServiceFile")
                        ?.let { rawPath -> resolveDescriptorPath(repoRootDir, descriptorFile, rawPath) },
                    pmdHostScript = properties.optionalTrimmed("pmdHostScript")
                        ?.let { rawPath -> resolveDescriptorPath(repoRootDir, descriptorFile, rawPath) }
                )
            }
        }
        .filterNotNull()
        .associateBy(EnforcementBundleDescriptor::bundleId)
}

val repoRootDir = System.getProperty("saltmarcher.repoRootDir")
    ?.trim()
    ?.takeIf(String::isNotEmpty)
    ?.let(::File)
    ?: rootDir

val enforcementBundleDescriptorsById = loadEnforcementBundleDescriptors(repoRootDir)

val enforcementBundleIdsInOrder = enforcementBundleDescriptorsById.values
    .sortedBy(EnforcementBundleDescriptor::order)
    .map(EnforcementBundleDescriptor::bundleId)

val enforcementBundleTaskToId = enforcementBundleDescriptorsById.values
    .flatMap { descriptor -> descriptor.taskNames.map { taskName -> taskName to descriptor.bundleId } }
    .toMap()

val enforcementBundleAwareTasks = enforcementBundleTaskToId.keys

val fullBuildTaskNames = setOf(
    "build",
    "check",
    "productionBuild",
    "checkQualityHygiene",
    "assemble",
    "classes",
    "compileJava",
    "jar",
    "test",
    "installDesktopApp",
    "installDist",
    "run",
    "checkArchitecture",
    "checkViewArchitecture",
    "architectureTest",
    "pmdArchitectureMain",
    "jqassistantEffectiveRules"
)

val rootHostScriptsByBundleId = enforcementBundleDescriptorsById.values
    .mapNotNull { descriptor -> descriptor.rootHostScript?.let { scriptPath -> descriptor.bundleId to scriptPath } }
    .toMap()

val buildHarnessHostScriptsByBundleId = enforcementBundleDescriptorsById.values
    .mapNotNull { descriptor -> descriptor.buildHarnessHostScript?.let { scriptPath -> descriptor.bundleId to scriptPath } }
    .toMap()

val errorProneHostScriptsByBundleId = enforcementBundleDescriptorsById.values
    .mapNotNull { descriptor -> descriptor.errorProneHostScript?.let { scriptPath -> descriptor.bundleId to scriptPath } }
    .toMap()

val errorProneSourceDirsByBundleId = enforcementBundleDescriptorsById.values
    .mapNotNull { descriptor -> descriptor.errorProneSourceDir?.let { sourceDir -> descriptor.bundleId to sourceDir } }
    .toMap()

val errorProneServiceFilesByBundleId = enforcementBundleDescriptorsById.values
    .mapNotNull { descriptor -> descriptor.errorProneServiceFile?.let { serviceFile -> descriptor.bundleId to serviceFile } }
    .toMap()

val pmdHostScriptsByBundleId = enforcementBundleDescriptorsById.values
    .mapNotNull { descriptor -> descriptor.pmdHostScript?.let { scriptPath -> descriptor.bundleId to scriptPath } }
    .toMap()

val requestedTaskNames = gradle.startParameter.taskNames
    .map { taskName -> taskName.substringAfterLast(":") }
    .toSet()

val requestedBundleIds = requestedTaskNames
    .mapNotNull(enforcementBundleTaskToId::get)
    .distinct()

val locallyFocusedEnforcementBundleMode = requestedTaskNames.isNotEmpty()
    && requestedBundleIds.isNotEmpty()
    && requestedTaskNames.none { taskName -> taskName in fullBuildTaskNames }
    && requestedTaskNames.all { taskName -> taskName in enforcementBundleAwareTasks }

val propagatedFocusedEnforcementBundleMode = System.getProperty("saltmarcher.focusedEnforcementBundleMode")
    ?.trim()
    ?.takeIf(String::isNotEmpty)
    ?.toBoolean()

val propagatedActiveEnforcementBundleIds = System.getProperty("saltmarcher.activeEnforcementBundleIds")
    ?.split(',')
    ?.map(String::trim)
    ?.filter(String::isNotEmpty)
    ?.takeIf(List<String>::isNotEmpty)

val focusedEnforcementBundleMode = propagatedFocusedEnforcementBundleMode ?: locallyFocusedEnforcementBundleMode

val activeEnforcementBundleIds = if (propagatedActiveEnforcementBundleIds != null) {
    enforcementBundleIdsInOrder.filter { bundleId -> bundleId in propagatedActiveEnforcementBundleIds }
} else if (locallyFocusedEnforcementBundleMode) {
    enforcementBundleIdsInOrder.filter { bundleId -> bundleId in requestedBundleIds }
} else {
    enforcementBundleIdsInOrder
}

System.setProperty("saltmarcher.repoRootDir", repoRootDir.absolutePath)
System.setProperty("saltmarcher.focusedEnforcementBundleMode", focusedEnforcementBundleMode.toString())
System.setProperty("saltmarcher.activeEnforcementBundleIds", activeEnforcementBundleIds.joinToString(","))

extra["saltmarcherFocusedEnforcementBundleMode"] = focusedEnforcementBundleMode
extra["saltmarcherActiveEnforcementBundleIds"] = activeEnforcementBundleIds
extra["saltmarcherRootHostScriptsByBundleId"] = rootHostScriptsByBundleId
extra["saltmarcherBuildHarnessHostScriptsByBundleId"] = buildHarnessHostScriptsByBundleId
extra["saltmarcherErrorProneHostScriptsByBundleId"] = errorProneHostScriptsByBundleId
extra["saltmarcherErrorProneSourceDirsByBundleId"] = errorProneSourceDirsByBundleId
extra["saltmarcherErrorProneServiceFilesByBundleId"] = errorProneServiceFilesByBundleId
extra["saltmarcherPmdHostScriptsByBundleId"] = pmdHostScriptsByBundleId
