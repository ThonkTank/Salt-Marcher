#!/usr/bin/env python3
"""Export DB_* worksheets from an OOXML workbook into the session-generation catalog."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree

CATALOG_VERSION = "catalog-2026-07-16"
MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
CELL_REFERENCE = re.compile(r"([A-Z]+)(\d+)")


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export DB_* sheets from an .xlsx/.xlsm file to normalized UTF-8 TSV and a catalog manifest."
    )
    parser.add_argument("workbook", type=Path, help="OOXML workbook (.xlsx or .xlsm)")
    parser.add_argument("output", type=Path, help="target catalog directory")
    parser.add_argument("--catalog-version", default=CATALOG_VERSION)
    parser.add_argument("--source-url", default="local-owner-provided-workbook")
    return parser.parse_args()


def sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def catalog_content_hash(catalog_version: str, tables: list[dict[str, object]]) -> str:
    """Hash the shipped catalog identity, independent of its source workbook."""
    lines = [f"catalogVersion\t{catalog_version}"]
    for table in sorted(tables, key=lambda entry: str(entry["file"])):
        lines.append("\t".join((
            str(table["file"]),
            str(table["name"]),
            str(table["rows"]),
            str(table["columns"]),
            str(table["sha256"]),
        )))
    return sha256(("\n".join(lines) + "\n").encode("utf-8"))


def column_index(reference: str) -> int:
    match = CELL_REFERENCE.fullmatch(reference)
    if not match:
        raise ValueError(f"invalid cell reference: {reference}")
    value = 0
    for character in match.group(1):
        value = value * 26 + ord(character) - ord("A") + 1
    return value - 1


def clean(value: str) -> str:
    return " ".join(value.replace("\t", " ").replace("\r", " ").replace("\n", " ").split())


def shared_strings(archive: zipfile.ZipFile) -> list[str]:
    try:
        root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    namespace = {"m": MAIN_NS}
    return ["".join(node.text or "" for node in item.findall(".//m:t", namespace))
            for item in root.findall("m:si", namespace)]


def sheet_paths(archive: zipfile.ZipFile) -> list[tuple[str, str]]:
    namespace = {"m": MAIN_NS, "r": REL_NS}
    workbook = ElementTree.fromstring(archive.read("xl/workbook.xml"))
    relationships = ElementTree.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {item.attrib["Id"]: item.attrib["Target"]
               for item in relationships.findall(f"{{{PACKAGE_REL_NS}}}Relationship")}
    result: list[tuple[str, str]] = []
    for sheet in workbook.findall("m:sheets/m:sheet", namespace):
        name = sheet.attrib["name"]
        if not name.startswith("DB_"):
            continue
        target = targets[sheet.attrib[f"{{{REL_NS}}}id"]].lstrip("/")
        path = target if target.startswith("xl/") else f"xl/{target}"
        result.append((name, path))
    return result


def cell_text(cell: ElementTree.Element, strings: list[str]) -> str:
    cell_type = cell.attrib.get("t", "")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(f".//{{{MAIN_NS}}}t"))
    value = cell.find(f"{{{MAIN_NS}}}v")
    if value is None or value.text is None:
        return ""
    if cell_type == "s":
        return strings[int(value.text)]
    if cell_type == "b":
        return "true" if value.text == "1" else "false"
    return value.text


def worksheet_rows(archive: zipfile.ZipFile, path: str, strings: list[str]) -> list[list[str]]:
    root = ElementTree.fromstring(archive.read(path))
    rows: list[list[str]] = []
    for row in root.findall(f".//{{{MAIN_NS}}}sheetData/{{{MAIN_NS}}}row"):
        values: dict[int, str] = {}
        for cell in row.findall(f"{{{MAIN_NS}}}c"):
            values[column_index(cell.attrib["r"])] = clean(cell_text(cell, strings))
        if values:
            rows.append([values.get(index, "") for index in range(max(values) + 1)])
    if not rows:
        raise ValueError(f"worksheet {path} is empty")
    columns = max(len(row) for row in rows)
    return [row + [""] * (columns - len(row)) for row in rows]


def tsv(rows: list[list[str]]) -> bytes:
    lines = ["\t".join(row).rstrip("\t") for row in rows]
    return ("\n".join(lines) + "\n").encode("utf-8")


def export(workbook: Path, output: Path, catalog_version: str, source_url: str) -> None:
    workbook_content = workbook.read_bytes()
    output.mkdir(parents=True, exist_ok=True)
    for stale_table in output.glob("DB_*.tsv"):
        stale_table.unlink()
    stale_manifest = output / "manifest.json"
    if stale_manifest.exists():
        stale_manifest.unlink()
    table_entries: list[dict[str, object]] = []
    with zipfile.ZipFile(workbook) as archive:
        strings = shared_strings(archive)
        sheets = sheet_paths(archive)
        if not sheets:
            raise ValueError("workbook contains no DB_* worksheets")
        for name, path in sheets:
            rows = worksheet_rows(archive, path, strings)
            content = tsv(rows)
            file_name = f"{name}.tsv"
            (output / file_name).write_bytes(content)
            table_entries.append({
                "columns": len(rows[0]),
                "file": file_name,
                "name": name,
                "rows": len(rows) - 1,
                "sha256": sha256(content),
            })
    table_entries.sort(key=lambda entry: str(entry["file"]))
    manifest = {
        "catalogVersion": catalog_version,
        "catalogContentHash": catalog_content_hash(catalog_version, table_entries),
        "sourceSha256": sha256(workbook_content),
        "sourceUrl": source_url,
        "tables": table_entries,
    }
    (output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    options = arguments()
    export(options.workbook, options.output, options.catalog_version, options.source_url)


if __name__ == "__main__":
    main()
