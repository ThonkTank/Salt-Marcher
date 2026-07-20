import org.gradle.api.plugins.JavaApplication
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.testing.Test
import org.gradle.jvm.application.tasks.CreateStartScripts
import org.gradle.language.base.plugins.LifecycleBasePlugin
import saltmarcher.buildlogic.tasks.MainClassesSystemPropertyProvider
import saltmarcher.buildlogic.tasks.RequiredCommandLineArgumentsProvider

plugins {
    java
    application
    id("saltmarcher.quality-conventions")
    id("org.openjfx.javafxplugin") version "0.1.0"
}

val launcherName = providers.gradleProperty("saltMarcherLauncherName").orElse("saltmarcher")
val mainClassName = providers.gradleProperty("saltMarcherMainClass").orElse("app.SaltMarcherApp")
val preloaderClassName = providers.gradleProperty("saltMarcherPreloaderClass")
    .orElse("app.SaltMarcherPreloader")
val javafxVersion = "21.0.2"
val verificationMaxParallelForks = 1
val catalogRehearsalDatabase = providers.gradleProperty("catalogRehearsalDatabase")
val catalogSnapshotSource = providers.gradleProperty("catalogSnapshotSource")
val catalogSnapshotTarget = providers.gradleProperty("catalogSnapshotTarget")

val preloaderJvmArg = preloaderClassName.map { "-Djavafx.preloader=$it" }

repositories {
    mavenCentral()
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

javafx {
    version = javafxVersion
    modules = listOf("javafx.controls")
}

sourceSets {
    main {
        java {
            setSrcDirs(listOf("app", "shell", "platform", "features"))
        }
        resources {
            setSrcDirs(listOf("resources"))
        }
    }
    test {
        java {
            setSrcDirs(listOf("test"))
        }
        resources {
            setSrcDirs(listOf("test-resources"))
        }
    }
}

dependencies {
    val monocleDependency = "org.testfx:openjfx-monocle:$javafxVersion"

    implementation("org.jspecify:jspecify:1.0.0")
    implementation("org.xerial:sqlite-jdbc:3.53.2.0")
    testImplementation("org.junit.jupiter:junit-jupiter:6.1.2")
    testImplementation("com.tngtech.archunit:archunit-junit5:1.4.2")
    testRuntimeOnly(monocleDependency)
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:6.1.2")
}

extensions.configure<JavaApplication> {
    mainClass = mainClassName
    applicationDefaultJvmArgs = listOf(preloaderJvmArg.get())
}

tasks.withType<CreateStartScripts>().configureEach {
    applicationName = launcherName.get()
}

tasks.register<JavaExec>("importSrdItems") {
    group = "application"
    description = "Explicitly replace the local Items catalog from the public D&D 5e 2014 SRD API."
    dependsOn(tasks.named("classes"))
    classpath = sourceSets["main"].runtimeClasspath
    mainClass.set("app.ItemsImportCommand")
}

tasks.register<JavaExec>("rehearseCatalogData") {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Migrate and semantically read back an explicitly isolated Catalog data copy."
    dependsOn(tasks.named("testClasses"))
    classpath = sourceSets["test"].runtimeClasspath
    mainClass.set("app.CatalogInstalledDataRehearsal")
    argumentProviders.add(objects.newInstance<RequiredCommandLineArgumentsProvider>().apply {
        arguments.add(catalogRehearsalDatabase.orElse(""))
        propertyNames.add("catalogRehearsalDatabase")
    })
}

tasks.register<JavaExec>("snapshotCatalogData") {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Create a coherent, restore-tested copy for Catalog migration rehearsal."
    dependsOn(tasks.named("testClasses"))
    classpath = sourceSets["test"].runtimeClasspath
    mainClass.set("app.CatalogInstalledDataSnapshot")
    argumentProviders.add(objects.newInstance<RequiredCommandLineArgumentsProvider>().apply {
        arguments.add(catalogSnapshotSource.orElse(""))
        arguments.add(catalogSnapshotTarget.orElse(""))
        propertyNames.add("catalogSnapshotSource")
        propertyNames.add("catalogSnapshotTarget")
    })
}

tasks.test {
    useJUnitPlatform()
    inputs.files(sourceSets["main"].allJava)
        .withPropertyName("mainJavaSources")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    environment("XDG_DATA_HOME", temporaryDir.resolve("xdg-data").absolutePath)
}

tasks.withType<Test>().configureEach {
    maxParallelForks = verificationMaxParallelForks
    systemProperty("glass.platform", "Monocle")
    systemProperty("monocle.platform", "Headless")
    systemProperty("prism.order", "sw")
    systemProperty("java.awt.headless", "true")
    systemProperty("junit.jupiter.extensions.autodetection.enabled", "true")
}

val mainJavaClassesDir = layout.buildDirectory.dir("classes/java/main")

tasks.register<Test>("architectureTest") {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run only architecture-focused test suites."
    dependsOn(tasks.named("classes"))
    inputs.dir(mainJavaClassesDir)
        .withPropertyName("mainClassesDirectory")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.files(sourceSets["main"].allJava)
        .withPropertyName("mainJavaSources")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform()
    filter {
        includeTestsMatching("architecture.*")
    }
    environment("XDG_DATA_HOME", temporaryDir.resolve("xdg-data").absolutePath)
    jvmArgumentProviders += objects.newInstance(MainClassesSystemPropertyProvider::class.java).apply {
        mainClassesDirectory.set(mainJavaClassesDir)
    }
}

tasks.register<Test>("uiTest") {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run headless JavaFX behavior tests."
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform {
        includeTags("ui")
    }
    environment("XDG_DATA_HOME", temporaryDir.resolve("xdg-data").absolutePath)
}
