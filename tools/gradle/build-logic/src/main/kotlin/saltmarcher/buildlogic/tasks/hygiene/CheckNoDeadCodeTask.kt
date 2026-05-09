package saltmarcher.buildlogic.tasks.hygiene

import java.io.BufferedInputStream
import java.io.DataInputStream
import java.io.File
import java.nio.file.Files
import java.nio.file.Path
import javax.inject.Inject
import javax.xml.XMLConstants
import javax.xml.stream.XMLInputFactory
import javax.xml.stream.XMLStreamConstants
import org.gradle.api.Action
import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.CacheableTask
import org.gradle.api.tasks.Classpath
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.Optional
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.api.tasks.VerificationException
import org.gradle.process.ExecOperations
import org.gradle.process.JavaExecSpec

@CacheableTask
abstract class CheckNoDeadCodeTask @Inject constructor(
    private val execOperations: ExecOperations
) : DefaultTask() {

    @get:Classpath
    abstract val toolClasspath: ConfigurableFileCollection

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val compiledClassesDirectory: DirectoryProperty

    @get:Classpath
    abstract val runtimeClasspath: ConfigurableFileCollection

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val javaHomeJmodsDirectory: DirectoryProperty

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val resourceRoots: ConfigurableFileCollection

    @get:Optional
    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val keepRulesFiles: ConfigurableFileCollection

    @get:Input
    abstract val mainClassName: Property<String>

    @get:Input
    abstract val preloaderClassName: Property<String>

    @get:OutputDirectory
    abstract val workingDirectory: DirectoryProperty

    @get:OutputFile
    abstract val reportFile: RegularFileProperty

    @get:OutputFile
    abstract val successMarker: RegularFileProperty

    @TaskAction
    fun check() {
        val compiledRoot = compiledClassesDirectory.get().asFile
        val classEntries = loadClassEntries(compiledRoot)
        val workDir = workingDirectory.get().asFile.toPath()
        val generatedKeepRulesFile = workDir.resolve("generated-keep-rules.pro")
        val configFile = workDir.resolve("proguard-deadcode.pro")
        val usageFile = workDir.resolve("usage.txt")
        val outputJar = workDir.resolve("deadcode-out.jar")

        resetDirectory(workDir)
        Files.createDirectories(workDir)
        writeGeneratedKeepRules(generatedKeepRulesFile, classEntries)
        writeProguardConfig(
            configFile = configFile,
            usageFile = usageFile,
            outputJar = outputJar,
            generatedKeepRulesFile = generatedKeepRulesFile
        )
        Files.deleteIfExists(successMarker.get().asFile.toPath())

        execOperations.javaexec(object : Action<JavaExecSpec> {
            override fun execute(spec: JavaExecSpec) {
                spec.classpath = toolClasspath
                spec.mainClass.set("proguard.ProGuard")
                spec.args(configFile.toString())
            }
        })

        val findings = parseFindings(classEntries, usageFile)
        writeReport(findings)
        if (findings.hasFailures()) {
            throw VerificationException(
                "Dead code remains in production sources. See ${reportFile.get().asFile.invariantPath()}."
            )
        }
        Files.writeString(successMarker.get().asFile.toPath(), "passed\n")
    }

    private fun writeGeneratedKeepRules(outputFile: Path, classEntries: List<ClassEntry>) {
        val resourceRootDirs = resourceRoots.files.filter(File::isDirectory).sortedBy(File::invariantPath)
        val fxmlRoots = loadFxmlRoots(resourceRootDirs)
        val serviceLoaderRoots = loadServiceLoaderRoots(resourceRootDirs)
        val shellContributionRoots = loadShellContributionRoots(classEntries)
        val serviceContributionRoots = loadServiceContributionRoots(classEntries)
        val explicitKeepFiles = keepRulesFiles.files.filter(File::isFile).sortedBy(File::invariantPath)
        val lines = buildList {
            add("# Generated structural dead-code roots.")
            add("-keep class ${mainClassName.get()} {")
            add("    public <init>();")
            add("    public static void main(java.lang.String[]);")
            add("    public void init();")
            add("    public void start(...);")
            add("    public void stop();")
            add("}")
            add("-keep class ${preloaderClassName.get()} {")
            add("    public <init>();")
            add("    public void init();")
            add("    public void start(...);")
            add("    public void stop();")
            add("    public void handleApplicationNotification(...);")
            add("    public void handleStateChangeNotification(...);")
            add("}")
            shellContributionRoots.forEach { binaryName ->
                add("-keep class $binaryName {")
                add("    public <init>();")
                add("    *** registrationSpec(...);")
                add("    *** bind(...);")
                add("}")
            }
            serviceContributionRoots.forEach { binaryName ->
                add("-keep class $binaryName {")
                add("    public <init>();")
                add("    *** register(...);")
                add("}")
            }
            fxmlRoots.forEach { root ->
                add("-keep class ${root.binaryName} {")
                add("    public <init>();")
                add("    *** initialize(...);")
                root.methods.sorted().forEach { methodName ->
                    add("    *** $methodName(...);")
                }
                root.fields.sorted().forEach { fieldName ->
                    add("    *** $fieldName;")
                }
                add("}")
            }
            serviceLoaderRoots.sorted().forEach { binaryName ->
                add("-keep class $binaryName {")
                add("    public <init>();")
                add("}")
            }
            if (explicitKeepFiles.isNotEmpty()) {
                add("# Repo-owned fallback keep rules are included from the main config.")
            }
        }
        Files.writeString(outputFile, lines.joinToString(separator = "\n", postfix = "\n"))
    }

    private fun writeProguardConfig(
        configFile: Path,
        usageFile: Path,
        outputJar: Path,
        generatedKeepRulesFile: Path
    ) {
        val keepFiles = keepRulesFiles.files.filter(File::isFile).sortedBy(File::invariantPath)
        val runtimeJars = runtimeClasspath.files
            .asSequence()
            .filter(File::isFile)
            .sortedBy(File::invariantPath)
            .toList()
        val jmods = javaHomeJmodsDirectory.get().asFile.listFiles()
            ?.filter { file -> file.isFile && file.extension == "jmod" }
            ?.sortedBy(File::invariantPath)
            .orEmpty()

        val lines = buildList {
            add("-injars ${compiledClassesDirectory.get().asFile.invariantPath()}")
            add("-outjars ${outputJar.toFile().invariantPath()}")
            add("-printusage ${usageFile.toFile().invariantPath()}")
            add("-dontobfuscate")
            add("-dontoptimize")
            add("-dontpreverify")
            add("-dontnote")
            add("-dontwarn **")
            add("-ignorewarnings")
            add("-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod")
            jmods.forEach { file ->
                add("-libraryjars ${file.invariantPath()}")
            }
            runtimeJars.forEach { file ->
                add("-libraryjars ${file.invariantPath()}")
            }
            add("-include ${generatedKeepRulesFile.toFile().invariantPath()}")
            keepFiles.forEach { file ->
                add("-include ${file.invariantPath()}")
            }
        }
        Files.writeString(configFile, lines.joinToString(separator = "\n", postfix = "\n"))
    }

    private fun parseFindings(classEntries: List<ClassEntry>, usageFile: Path): DeadCodeFindings {
        val lines = if (Files.isRegularFile(usageFile)) {
            Files.readAllLines(usageFile)
                .map(String::trim)
                .filter(String::isNotEmpty)
                .sorted()
        } else {
            emptyList()
        }
        val classesByBinaryName = classEntries.associateBy(ClassEntry::binaryName)
        val deadTypes = mutableListOf<DeadType>()
        val deadConstructors = mutableListOf<DeadMember>()
        val deadMethods = mutableListOf<DeadMember>()
        val deadFields = mutableListOf<DeadMember>()

        lines.forEach { line ->
            if (':' !in line) {
                val entry = classesByBinaryName[line] ?: return@forEach
                deadTypes += DeadType(entry.sourceRelativePath, entry.binaryName)
                return@forEach
            }
            val owner = line.substringBefore(':').trim()
            val member = line.substringAfter(':').trim()
            val entry = classesByBinaryName[owner] ?: return@forEach
            if ('(' in member) {
                when {
                    member.startsWith("<init>(") -> deadConstructors += DeadMember(entry.sourceRelativePath, "$owner#$member")
                    member.startsWith("<clinit>(") -> Unit
                    else -> deadMethods += DeadMember(entry.sourceRelativePath, "$owner#$member")
                }
            } else {
                deadFields += DeadMember(entry.sourceRelativePath, "$owner#$member")
            }
        }

        val deadTypeNames = deadTypes.map(DeadType::name).toSet()
        val deadFiles = classEntries
            .groupBy(ClassEntry::sourceRelativePath)
            .values
            .filter { sourceEntries -> sourceEntries.all { entry -> entry.binaryName in deadTypeNames } }
            .map { sourceEntries -> sourceEntries.first().sourceRelativePath }
            .distinct()
            .sorted()

        return DeadCodeFindings(
            deadFiles = deadFiles,
            deadTypes = deadTypes.sortedWith(compareBy(DeadType::sourceRelativePath, DeadType::name)),
            deadConstructors = deadConstructors.sortedWith(compareBy(DeadMember::sourceRelativePath, DeadMember::name)),
            deadMethods = deadMethods.sortedWith(compareBy(DeadMember::sourceRelativePath, DeadMember::name)),
            deadFields = deadFields.sortedWith(compareBy(DeadMember::sourceRelativePath, DeadMember::name))
        )
    }

    private fun writeReport(findings: DeadCodeFindings) {
        val reportPath = reportFile.get().asFile.toPath()
        Files.createDirectories(reportPath.parent)
        Files.writeString(reportPath, findings.render())
    }

    private fun loadClassEntries(compiledRoot: File): List<ClassEntry> {
        if (!compiledRoot.isDirectory) {
            return emptyList()
        }
        val rootPath = compiledRoot.toPath()
        return compiledRoot.walkTopDown()
            .filter { file -> file.isFile && file.extension == "class" }
            .sortedBy(File::invariantPath)
            .mapNotNull { classFile ->
                val relativePath = rootPath.relativize(classFile.toPath()).invariantPath()
                val internalName = relativePath.removeSuffix(".class")
                val simpleName = internalName.substringAfterLast('$')
                val sourceRelativePath = loadSourceRelativePath(classFile.toPath(), internalName)
                when {
                    simpleName.isBlank() -> null
                    simpleName == "package-info" -> null
                    simpleName == "module-info" -> null
                    simpleName.firstOrNull()?.isDigit() == true -> null
                    "$$" in simpleName -> null
                    else -> {
                        val binaryName = internalName.replace('/', '.')
                        val topLevelBinaryName = internalName.substringBefore('$').replace('/', '.')
                        ClassEntry(
                            binaryName = binaryName,
                            topLevelBinaryName = topLevelBinaryName,
                            sourceRelativePath = sourceRelativePath
                        )
                    }
                }
            }
            .toList()
    }

    private fun loadFxmlRoots(resourceRoots: List<File>): List<FxmlRoot> {
        val xmlFactory = XMLInputFactory.newFactory().apply {
            setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false)
            setProperty(XMLInputFactory.SUPPORT_DTD, false)
            setProperty(XMLConstants.ACCESS_EXTERNAL_DTD, "")
            setProperty(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "")
        }
        return resourceRoots
            .asSequence()
            .flatMap { root ->
                root.walkTopDown()
                    .asSequence()
                    .filter { file -> file.isFile && file.extension == "fxml" }
                    .sortedBy(File::invariantPath)
                    .mapNotNull { file ->
                        val methods = linkedSetOf<String>()
                        val fields = linkedSetOf<String>()
                        var controllerBinaryName: String? = null
                        file.inputStream().use { input ->
                            val reader = xmlFactory.createXMLStreamReader(input)
                            while (reader.hasNext()) {
                                if (reader.next() != XMLStreamConstants.START_ELEMENT) {
                                    continue
                                }
                                for (index in 0 until reader.attributeCount) {
                                    val value = reader.getAttributeValue(index) ?: continue
                                    val localName = reader.getAttributeLocalName(index)
                                    if (reader.getAttributePrefix(index) == "fx" && localName == "controller") {
                                        controllerBinaryName = value
                                    }
                                    if (value.startsWith("#")) {
                                        methods += value.removePrefix("#")
                                    }
                                    if (reader.getAttributePrefix(index) == "fx" && localName == "id") {
                                        fields += value
                                    }
                                }
                            }
                            reader.close()
                        }
                        controllerBinaryName?.let { binaryName ->
                            FxmlRoot(
                                binaryName = binaryName,
                                methods = methods,
                                fields = fields
                            )
                        }
                    }
            }
            .groupBy(FxmlRoot::binaryName)
            .values
            .map { roots ->
                FxmlRoot(
                    binaryName = roots.first().binaryName,
                    methods = roots.asSequence().flatMap { root -> root.methods.asSequence() }.toSortedSet(),
                    fields = roots.asSequence().flatMap { root -> root.fields.asSequence() }.toSortedSet()
                )
            }
            .sortedBy(FxmlRoot::binaryName)
            .toList()
    }

    private fun loadServiceLoaderRoots(resourceRoots: List<File>): Set<String> {
        return resourceRoots
            .asSequence()
            .map { root -> root.resolve("META-INF/services") }
            .filter(File::isDirectory)
            .flatMap { servicesDir ->
                servicesDir.walkTopDown()
                    .asSequence()
                    .filter(File::isFile)
                    .sortedBy(File::invariantPath)
                    .flatMap { file ->
                        file.readLines()
                            .asSequence()
                            .map(String::trim)
                            .filter { line -> line.isNotEmpty() && !line.startsWith("#") }
                    }
            }
            .toSortedSet()
    }

    private fun loadShellContributionRoots(classEntries: List<ClassEntry>): List<String> {
        return classEntries
            .asSequence()
            .filter(ClassEntry::isTopLevelClass)
            .map(ClassEntry::binaryName)
            .filter(::isShellContributionRoot)
            .distinct()
            .sorted()
            .toList()
    }

    private fun loadServiceContributionRoots(classEntries: List<ClassEntry>): List<String> {
        return classEntries
            .asSequence()
            .filter(ClassEntry::isTopLevelClass)
            .map(ClassEntry::binaryName)
            .filter(::isServiceContributionRoot)
            .distinct()
            .sorted()
            .toList()
    }

    private fun isShellContributionRoot(binaryName: String): Boolean {
        return isRootOwnedFeatureClass(binaryName, "src.view.leftbartabs", "Contribution")
                || isRootOwnedFeatureClass(binaryName, "src.view.statetabs", "Contribution")
                || isRootOwnedFeatureClass(binaryName, "src.view.dropdowns", "Contribution")
    }

    private fun isServiceContributionRoot(binaryName: String): Boolean =
        isRootOwnedFeatureClass(binaryName, "src.data", "ServiceContribution")

    private fun isRootOwnedFeatureClass(binaryName: String, rootPackage: String, classSuffix: String): Boolean {
        val prefix = "$rootPackage."
        if (!binaryName.startsWith(prefix)) {
            return false
        }
        val remainder = binaryName.removePrefix(prefix)
        val firstDot = remainder.indexOf('.')
        if (firstDot <= 0 || firstDot != remainder.lastIndexOf('.')) {
            return false
        }
        return remainder.substringAfterLast('.').endsWith(classSuffix)
    }

    private fun loadSourceRelativePath(classFile: Path, internalName: String): String {
        val packagePath = internalName.substringBeforeLast('/', missingDelimiterValue = "")
        val sourceFileName = loadSourceFileName(classFile)
            ?: "${internalName.substringBefore('$').substringAfterLast('/')}.java"
        return if (packagePath.isBlank()) {
            sourceFileName
        } else {
            "$packagePath/$sourceFileName"
        }
    }

    private fun loadSourceFileName(classFile: Path): String? {
        return try {
            DataInputStream(BufferedInputStream(Files.newInputStream(classFile))).use { input ->
                val magic = input.readInt()
                if (magic != 0xCAFEBABE.toInt()) {
                    throw IllegalStateException("Unexpected classfile header in ${classFile.invariantPath()}.")
                }
                input.readUnsignedShort()
                input.readUnsignedShort()
                val utf8Entries = readUtf8ConstantPool(input)
                input.readUnsignedShort()
                input.readUnsignedShort()
                input.readUnsignedShort()
                repeat(input.readUnsignedShort()) {
                    input.skipNBytes(2)
                }
                skipMembers(input)
                skipMembers(input)
                repeat(input.readUnsignedShort()) {
                    val attributeNameIndex = input.readUnsignedShort()
                    val attributeLength = input.readInt().toLong() and 0xffffffffL
                    val attributeName = utf8Entries.getOrNull(attributeNameIndex)
                    if (attributeName == "SourceFile" && attributeLength == 2L) {
                        val sourceFileIndex = input.readUnsignedShort()
                        return utf8Entries.getOrNull(sourceFileIndex)
                    }
                    input.skipNBytes(attributeLength)
                }
                null
            }
        } catch (exception: Exception) {
            throw IllegalStateException("Could not read source mapping from ${classFile.invariantPath()}.", exception)
        }
    }

    private fun readUtf8ConstantPool(input: DataInputStream): Array<String?> {
        val constantPoolCount = input.readUnsignedShort()
        val utf8Entries = arrayOfNulls<String>(constantPoolCount)
        var index = 1
        while (index < constantPoolCount) {
            when (val tag = input.readUnsignedByte()) {
                1 -> utf8Entries[index] = input.readUTF()
                3, 4 -> input.skipNBytes(4)
                5, 6 -> {
                    input.skipNBytes(8)
                    index += 1
                }
                7, 8, 16, 19, 20 -> input.skipNBytes(2)
                9, 10, 11, 12, 17, 18 -> input.skipNBytes(4)
                15 -> input.skipNBytes(3)
                else -> throw IllegalStateException("Unsupported classfile constant-pool tag $tag.")
            }
            index += 1
        }
        return utf8Entries
    }

    private fun skipMembers(input: DataInputStream) {
        repeat(input.readUnsignedShort()) {
            input.readUnsignedShort()
            input.readUnsignedShort()
            input.readUnsignedShort()
            repeat(input.readUnsignedShort()) {
                input.readUnsignedShort()
                input.skipNBytes(input.readInt().toLong() and 0xffffffffL)
            }
        }
    }

    private fun resetDirectory(directory: Path) {
        if (!Files.exists(directory)) {
            return
        }
        Files.walk(directory)
            .sorted(Comparator.reverseOrder())
            .forEach(Files::deleteIfExists)
    }
}

private data class ClassEntry(
    val binaryName: String,
    val topLevelBinaryName: String,
    val sourceRelativePath: String
) {
    val isTopLevelClass: Boolean
        get() = binaryName == topLevelBinaryName
}

private data class FxmlRoot(
    val binaryName: String,
    val methods: Set<String>,
    val fields: Set<String>
)

private data class DeadType(
    val sourceRelativePath: String,
    val name: String
)

private data class DeadMember(
    val sourceRelativePath: String,
    val name: String
)

private data class DeadCodeFindings(
    val deadFiles: List<String>,
    val deadTypes: List<DeadType>,
    val deadConstructors: List<DeadMember>,
    val deadMethods: List<DeadMember>,
    val deadFields: List<DeadMember>
) {
    fun hasFailures(): Boolean =
        deadFiles.isNotEmpty()
                || deadTypes.isNotEmpty()
                || deadConstructors.isNotEmpty()
                || deadMethods.isNotEmpty()
                || deadFields.isNotEmpty()

    fun render(): String = buildString {
        appendLine("# Dead Code Report")
        appendLine()
        appendLine("Files: ${deadFiles.size}")
        appendLine("Types: ${deadTypes.size}")
        appendLine("Constructors: ${deadConstructors.size}")
        appendLine("Methods: ${deadMethods.size}")
        appendLine("Fields: ${deadFields.size}")
        appendLine()
        appendSection("Dead Files", deadFiles)
        appendSection("Dead Types", deadTypes.map { "${it.sourceRelativePath} :: ${it.name}" })
        appendSection("Dead Constructors", deadConstructors.map { "${it.sourceRelativePath} :: ${it.name}" })
        appendSection("Dead Methods", deadMethods.map { "${it.sourceRelativePath} :: ${it.name}" })
        appendSection("Dead Fields", deadFields.map { "${it.sourceRelativePath} :: ${it.name}" })
    }

    private fun StringBuilder.appendSection(title: String, items: List<String>) {
        appendLine("## $title")
        if (items.isEmpty()) {
            appendLine("none")
        } else {
            items.forEach { item -> appendLine(item) }
        }
        appendLine()
    }
}

private fun Path.invariantPath(): String = toString().replace(File.separatorChar, '/')

private fun File.invariantPath(): String = path.replace(File.separatorChar, '/')
