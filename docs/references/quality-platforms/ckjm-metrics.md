# ckjm dds

Original URL: https://www.spinellis.gr/sw/ckjm/
Local Source: `docs/references/.tools/html/quality-platforms/ckjm-metrics.html`
Source Kind: `downloaded_html`
Accessed: 2026-04-21

# ckjm dds

## ckjm — Chidamber and Kemerer Java Metrics

![Picture of the Java book, the metrics paper, and a measure tape](smallpic.jpg)
The program *ckjm* calculates Chidamber and Kemerer object-oriented
metrics by processing the bytecode of compiled Java files.
The program calculates for each class the following six metrics proposed
by Chidamber and Kemerer.

- WMC: Weighted methods per class
- DIT: Depth of Inheritance Tree
- NOC: Number of Children
- CBO: Coupling between object classes
- RFC: Response for a Class
- LCOM: Lack of cohesion in methods

In addition it also calculates for each class

- Ca: Afferent couplings
- NPM: Number of public methods

### Citation and Background

If you use this tool in your research, please cite it as follows.

Diomidis Spinellis.
[Tool writing: A forgotten art?](http://www.spinellis.gr/pubs/jrnl/2005-IEEESW-TotT/html/v22n4.html)
IEEE Software, 22(4):9–11, July/August 2005.
([doi:10.1109/MS.2005.111](http://dx.doi.org/10.1109/MS.2005.111)).

I wrote this program out of frustration over the
[lack](http://www.spinellis.gr/blog/20050211/)
of reliable programs to calculate the
Chidamber and Kemerer object-oriented metrics I needed
to illustrate some concepts in my book
[Code Quality: The Open Source Perspective](http://www.spinellis.gr/codequality).
The programs I found on the web were either
incomplete (they calculated only some of the metrics),
or unreliable (they calculated results that were obviously wrong),
or extremely inefficient (they required GB of RAM and hours of processing).
*Ckjm* is mean and lean, following the Unix tradition of doing
one thing well.
It will not automatically recurse directories looking for the files
you want measured and it does not offer a GUI.
However, it does this job thoroughly, and efficiently:
on a 1.6GHz Pentium-M machine it will process the 33MB of the Eclipse 3.0
jar files (19717 classes) in 95 seconds.

### Getting Started

To run the program you simply specify the class files
(or pairs of jar/class files)
on its command line or standard input.
The program will produce on its standard output a line for each class
containing the complete name of the class and the values of its metrics.
This operation model allows the tool to be easilly extended using textual
pre- and post-processors.

From version 1.2 and onward *ckjm* can be used as an
ant task, and can also directly generate XML output.
You can post-process the XML output with XSLT to generate nice-looking
reports.
Here is a report example using
[simple report style](output_simple.html)
and here is an example using the
[fancy report style](output_extra.html).
XSL files for both report styles are part of the distribution.

### Download and Links

Ckjm is hereby made freely available as Open Source Software.
The current version of ckjm is 1.9.
You can download ckjm and its documentation from the following links:

- [ckjm package - .tar.gz](ckjm-1.9.tar.gz)
(compressed tar file containing the source code, the compiled jar file,
and the complete documentation in HTML format).
- [GitHub page](https://github.com/dspinellis/ckjm)
(use it to obtain the latest version,
track progress,
report issues,
and contribute improvements).
- [ckjm package - .zip](ckjm-1.9.zip)
(zip file containing the source code, the compiled doclet,
and the complete documentation in HTML format).
- [User documentation](doc/index.html)
(table of contents - suitable for web browsing).
- [Printable user documentation](doc/indexw.html)
(the above as a single printable page).
- [Technical documentation](javadoc/index.html)
(javadoc) and
[UML class diagram](javadoc/gr/spinellis/ckjm/ckjm.gif)
(by [UMLGraph](../umlgraph)).
- [Version history](doc/ver.html)

### Projects Using ckjm

*ckjm* is now also available through the following projects.

- As part of the
[Isotrol MetricAnalytics plugin](http://docs.codehaus.org/display/SONAR/Isotrol+MetricsAnalytics)
for the [Sonar](http://sonar.codehaus.org/)
open source quality management platform.
- As a [Maven plugin](http://mojo.codehaus.org/ckjm-maven-plugin/).
- As a [forked Maven plugin](http://bitbucket.org/mfriedenhagen/ckjm-maven-plugin) with [improved output](http://s312195779.online.de/hudson/job/ckjm-maven-plugin/).

Diomidis Spinellis home page

---

| Column 1 | Column 2 |
| --- | --- |
|  | (C) Copyright 2005-2010 D. Spinellis.<br>May be freely uploaded by WWW viewers and similar programs.<br>All other rights reserved. Last modified: $Date: 2010/05/22 10:27:16 $ |
