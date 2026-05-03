import java.io.File
import java.util.LinkedHashSet
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.language.jvm.tasks.ProcessResources
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.the

plugins {
    `java-library`
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

apply(from = repoRootDir.resolve("tools/quality/enforcement-bundles.gradle.kts"))

@Suppress("UNCHECKED_CAST")
val activeEnforcementBundleIds = extra["saltmarcherActiveEnforcementBundleIds"] as List<String>
@Suppress("UNCHECKED_CAST")
val errorProneHostScriptsByBundleId = extra["saltmarcherErrorProneHostScriptsByBundleId"] as Map<String, String>
@Suppress("UNCHECKED_CAST")
val errorProneSourceDirsByBundleId = extra["saltmarcherErrorProneSourceDirsByBundleId"] as Map<String, String>
@Suppress("UNCHECKED_CAST")
val errorProneServiceFilesByBundleId = extra["saltmarcherErrorProneServiceFilesByBundleId"] as Map<String, String>

activeEnforcementBundleIds
    .mapNotNull(errorProneHostScriptsByBundleId::get)
    .distinct()
    .forEach { scriptPath ->
        apply(from = File(scriptPath))
    }

val sourceSets = the<SourceSetContainer>()
sourceSets.named("main") {
    java.setSrcDirs(
        listOf(layout.projectDirectory.dir("src/main/java").asFile.absolutePath)
            + activeEnforcementBundleIds.mapNotNull(errorProneSourceDirsByBundleId::get)
    )
    resources.setSrcDirs(emptyList<String>())
}

val bugCheckerServicePath = "META-INF/services/com.google.errorprone.bugpatterns.BugChecker"
val hostBugCheckerService = layout.projectDirectory.file("src/main/resources/$bugCheckerServicePath").asFile
val bundleBugCheckerServices = activeEnforcementBundleIds
    .mapNotNull(errorProneServiceFilesByBundleId::get)
    .map(::File)
val generatedResourcesDir = layout.buildDirectory.dir("generated/quality-rules-errorprone/resources")
val generatedBugCheckerService = generatedResourcesDir.map { dir -> dir.file(bugCheckerServicePath) }

val syncQualityRulesErrorProneServices = tasks.register("syncQualityRulesErrorProneServices") {
    inputs.files(listOf(hostBugCheckerService) + bundleBugCheckerServices)
    outputs.file(generatedBugCheckerService)
    doLast {
        val mergedLines = LinkedHashSet<String>()
        listOf(hostBugCheckerService)
            .plus(bundleBugCheckerServices)
            .forEach { serviceFile ->
                serviceFile.readLines()
                    .map(String::trim)
                    .filter(String::isNotEmpty)
                    .forEach(mergedLines::add)
            }

        val target = generatedBugCheckerService.get().asFile
        target.parentFile.mkdirs()
        target.writeText(mergedLines.joinToString(System.lineSeparator()) + System.lineSeparator())
    }
}

tasks.named<ProcessResources>("processResources") {
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
