import java.io.File
import java.nio.file.Files
import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.ListProperty
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.TaskAction
import org.gradle.kotlin.dsl.register
import org.gradle.language.jvm.tasks.ProcessResources
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.the
import org.gradle.work.DisableCachingByDefault
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension

@DisableCachingByDefault(because = "Verification task with no stable outputs.")
abstract class ValidateBugCheckerRegistriesTask : DefaultTask() {

    @get:Input
    abstract val registrySpecs: ListProperty<String>

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val registryInputFiles: ConfigurableFileCollection

    @TaskAction
    fun validate() {
        val failures = buildList {
            registrySpecs.get().forEach { spec ->
                val owner = spec.substringBefore('\t')
                val servicePath = File(spec.substringAfter('\t').substringBefore('\t'))
                val sourceDir = File(spec.substringAfterLast('\t'))

                val checkerFiles = sourceDir.walkTopDown()
                    .filter { file -> file.isFile && file.name.endsWith("Checker.java") }
                    .toList()
                if (checkerFiles.isEmpty()) {
                    return@forEach
                }

                val discoveredCheckers = checkerFiles
                    .map { checkerFile -> checkerClassName(sourceDir, checkerFile) }
                    .toSortedSet()
                val declaredCheckers = declaredCheckerClasses(servicePath).toSortedSet()

                val missingEntries = discoveredCheckers - declaredCheckers
                val staleEntries = declaredCheckers - discoveredCheckers
                if (missingEntries.isEmpty() && staleEntries.isEmpty()) {
                    return@forEach
                }

                val details = buildList {
                    if (missingEntries.isNotEmpty()) {
                        add("missing service entries: ${missingEntries.joinToString()}")
                    }
                    if (staleEntries.isNotEmpty()) {
                        add("stale service entries: ${staleEntries.joinToString()}")
                    }
                }.joinToString("; ")
                add("$owner BugChecker registry drift in $servicePath: $details")
            }
        }

        if (failures.isNotEmpty()) {
            error(
                failures.joinToString(
                    prefix = "Error Prone service registries must stay aligned with checker sources.\n",
                    separator = "\n"
                )
            )
        }
    }

    private fun checkerClassName(sourceDir: File, checkerFile: File): String = sourceDir.toPath()
        .relativize(checkerFile.toPath())
        .joinToString(".") { segment -> segment.toString() }
        .removeSuffix(".java")

    private fun declaredCheckerClasses(serviceFile: File): Set<String> = serviceFile.readLines()
        .map(String::trim)
        .filter(String::isNotEmpty)
        .toSet()
}

abstract class MergeBugCheckerServicesTask : DefaultTask() {

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val serviceFiles: ConfigurableFileCollection

    @get:OutputFile
    abstract val mergedServiceFile: RegularFileProperty

    @TaskAction
    fun merge() {
        val mergedLines = linkedSetOf<String>()
        serviceFiles.files
            .sortedBy { it.invariantSeparatorsPath }
            .forEach { serviceFile ->
                serviceFile.readLines()
                    .map(String::trim)
                    .filter(String::isNotEmpty)
                    .forEach(mergedLines::add)
            }

        val target = mergedServiceFile.get().asFile.toPath()
        Files.createDirectories(target.parent)
        Files.writeString(
            target,
            mergedLines.joinToString(System.lineSeparator()) + System.lineSeparator()
        )
    }
}

plugins {
    `java-library`
    id("saltmarcher.enforcement-bundles")
}

group = "saltmarcher.quality"
version = "1.0-SNAPSHOT"

repositories {
    mavenCentral()
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

val repoRootDir = System.getProperty("saltmarcher.repoRootDir")
    ?.let(::File)
    ?: projectDir.parentFile.parentFile.parentFile.parentFile

val enforcementBundles = extensions.getByType(EnforcementBundlesExtension::class.java)
val focusedEnforcementBundleMode = enforcementBundles.focusedEnforcementBundleMode
val activeEnforcementBundleIds = enforcementBundles.activeEnforcementBundleIds

val sourceSets = the<SourceSetContainer>()
sourceSets.named("main") {
    java.setSrcDirs(
        listOf(layout.projectDirectory.dir("src/main/java").asFile.absolutePath)
            + activeEnforcementBundleIds.mapNotNull { bundleId -> enforcementBundles.descriptor(bundleId).errorProneSourceDir }
    )
    resources.setSrcDirs(emptyList<String>())
}

val bugCheckerServicePath = "META-INF/services/com.google.errorprone.bugpatterns.BugChecker"
val hostBugCheckerService = layout.projectDirectory.file("src/main/resources/$bugCheckerServicePath").asFile
val bundleBugCheckerServices = activeEnforcementBundleIds
    .mapNotNull { bundleId -> enforcementBundles.descriptor(bundleId).errorProneServiceFile }
    .map(::File)
val activeBugCheckerServices = if (focusedEnforcementBundleMode) {
    bundleBugCheckerServices
} else {
    listOf(hostBugCheckerService) + bundleBugCheckerServices
}
val generatedResourcesDir = layout.buildDirectory.dir("generated/quality-rules-errorprone/resources")
val generatedBugCheckerService = generatedResourcesDir.map { dir -> dir.file(bugCheckerServicePath) }
val bugCheckerRegistrySpecs = buildList {
    if (!focusedEnforcementBundleMode) {
        add("host\t${hostBugCheckerService.absolutePath}\t${layout.projectDirectory.dir("src/main/java").asFile.absolutePath}")
    }
    activeEnforcementBundleIds.forEach { bundleId ->
        val descriptor = enforcementBundles.descriptor(bundleId)
        val serviceFile = descriptor.errorProneServiceFile ?: return@forEach
        val sourceDir = descriptor.errorProneSourceDir ?: return@forEach
        add("$bundleId\t${File(serviceFile).absolutePath}\t${File(sourceDir).absolutePath}")
    }
}

val validateQualityRulesErrorProneServices = tasks.register<ValidateBugCheckerRegistriesTask>(
    "validateQualityRulesErrorProneServices"
) {
    registrySpecs.set(bugCheckerRegistrySpecs)
    registryInputFiles.from(
        layout.projectDirectory.dir("src/main/java"),
        bundleBugCheckerServices
    )
    if (!focusedEnforcementBundleMode) {
        registryInputFiles.from(hostBugCheckerService)
    }
    activeEnforcementBundleIds.forEach { bundleId ->
        enforcementBundles.descriptor(bundleId).errorProneSourceDir?.let { sourceDir ->
            registryInputFiles.from(project.files(sourceDir))
        }
    }
}

val syncQualityRulesErrorProneServices = tasks.register<MergeBugCheckerServicesTask>(
    "syncQualityRulesErrorProneServices"
) {
    serviceFiles.from(activeBugCheckerServices)
    mergedServiceFile.set(generatedBugCheckerService)
}

tasks.named<ProcessResources>("processResources") {
    dependsOn(validateQualityRulesErrorProneServices)
    dependsOn(syncQualityRulesErrorProneServices)
    from(generatedResourcesDir)
}

dependencies {
    compileOnly("com.google.errorprone:error_prone_check_api:2.48.0")
}

tasks.withType<JavaCompile>().configureEach {
    options.compilerArgs.addAll(listOf(
        "--add-exports=jdk.compiler/com.sun.tools.javac.api=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.code=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.comp=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.file=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.main=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.model=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.parser=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.processing=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.tree=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.util=ALL-UNNAMED"
    ))
}
