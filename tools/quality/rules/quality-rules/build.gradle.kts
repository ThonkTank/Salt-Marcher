import java.io.File
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.language.jvm.tasks.ProcessResources
import org.gradle.jvm.tasks.Jar
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

val repoRootDir = System.getProperty("saltmarcher.repoRootDir")
    ?.let(::File)
    ?: projectDir.parentFile.parentFile.parentFile.parentFile

val enforcementBundles = extensions.getByType(EnforcementBundlesExtension::class.java)
val pmdBundleIds = enforcementBundles.catalog.bundleIdsInOrder

val sourceSets = the<SourceSetContainer>()
sourceSets.named("main") {
    java.setSrcDirs(
        listOf(layout.projectDirectory.dir("src/main/java").asFile.absolutePath) +
            // PMD tasks resolve custom rules from one shared jar, so the jar must stay
            // independent from focused bundle selection and always include every PMD rule source.
            pmdBundleIds.mapNotNull { bundleId -> enforcementBundles.descriptor(bundleId).pmdSourceDir }
    )
}

dependencies {
    implementation("net.sourceforge.pmd:pmd-java:7.23.0")
}

// This included build derives active PMD sources from propagated bundle
// selection, so cached outputs can restore an incomplete rule artifact.
tasks.named<JavaCompile>("compileJava") {
    outputs.cacheIf("quality-rules compile output must track dynamic bundle selection live") { false }
}

tasks.named<ProcessResources>("processResources") {
    outputs.cacheIf("quality-rules resources must track dynamic bundle selection live") { false }
}

tasks.named<Jar>("jar") {
    isPreserveFileTimestamps = false
    isReproducibleFileOrder = true
    outputs.cacheIf("quality-rules jar must track dynamic bundle selection live") { false }
}
