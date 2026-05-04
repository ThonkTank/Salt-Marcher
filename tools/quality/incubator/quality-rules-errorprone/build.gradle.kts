import java.io.File
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.jvm.tasks.Jar
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.the
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension
import saltmarcher.buildlogic.tasks.MergeBugCheckerServicesTask
import saltmarcher.buildlogic.tasks.ValidateBugCheckerRegistriesTask

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
    successMarker.set(
        layout.buildDirectory.file(
            "verification-markers/validateQualityRulesErrorProneServices/success.marker"
        )
    )
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

tasks.named("check") {
    dependsOn(validateQualityRulesErrorProneServices)
}

tasks.named<Jar>("jar") {
    dependsOn(validateQualityRulesErrorProneServices)
    dependsOn(syncQualityRulesErrorProneServices)
    from(generatedResourcesDir)
    isPreserveFileTimestamps = false
    isReproducibleFileOrder = true
    outputs.cacheIf("quality-rules-errorprone jar is a hot-path compile dependency") { true }
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
