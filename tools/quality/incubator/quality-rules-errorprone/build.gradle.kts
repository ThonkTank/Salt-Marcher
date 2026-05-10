import java.io.File
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.the
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension

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
val repoRootDir = enforcementBundles.repoRootDir

fun repoVerificationFiles(relativeSuffix: String): List<File> {
    val qualityDir = repoRootDir.resolve("tools/quality")
    if (!qualityDir.isDirectory) {
        return emptyList()
    }
    return qualityDir.walkTopDown()
        .filter { file ->
            val relativePath = file.relativeTo(repoRootDir).path.replace(File.separatorChar, '/')
            relativePath.endsWith(relativeSuffix)
        }
        .toList()
}

val effectiveErrorProneSourceDirs = repoVerificationFiles("/errorprone/src/main/java")

val sourceSets = the<SourceSetContainer>()
sourceSets.named("main") {
    java.setSrcDirs(
        listOf(layout.projectDirectory.dir("src/main/java").asFile.absolutePath)
            + effectiveErrorProneSourceDirs.map(File::getAbsolutePath)
    )
    resources.setSrcDirs(listOf(layout.projectDirectory.dir("src/main/resources").asFile.absolutePath))
}
sourceSets.named("test") {
    java.setSrcDirs(listOf(layout.projectDirectory.dir("src/test/java").asFile.absolutePath))
    resources.setSrcDirs(emptyList<String>())
}

dependencies {
    compileOnly("com.google.errorprone:error_prone_check_api:2.48.0")
    compileOnly("org.checkerframework:dataflow-nullaway:3.53.0")
    testImplementation("org.checkerframework:dataflow-nullaway:3.53.0")
    testImplementation("com.google.errorprone:error_prone_test_helpers:2.48.0")
    testImplementation("junit:junit:4.13.2")
}

tasks.withType<JavaCompile>().configureEach {
    val javacExports = listOf(
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
    )
    options.compilerArgs.addAll(javacExports)
}

tasks.withType<Test>().configureEach {
    jvmArgs(
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
    )
}
