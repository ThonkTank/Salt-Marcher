use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    io::{Read, Write},
    path::Path,
};
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Room {
    pub id: String,
    pub name: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Level {
    pub id: String,
    pub name: String,
    pub rooms: Vec<Room>,
    pub cells: HashMap<String, String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Document {
    pub version: u32,
    pub grid_feet: u32,
    pub levels: Vec<Level>,
}
const MAX_BYTES: u64 = 64 * 1024 * 1024;
fn valid_id(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 80
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}
fn valid_name(s: &str) -> bool {
    !s.trim().is_empty() && s.chars().count() <= 120
}
fn valid_cell(c: &str) -> bool {
    let Some((x, y)) = c.split_once(',') else {
        return false;
    };
    let (Ok(x), Ok(y)) = (x.parse::<i64>(), y.parse::<i64>()) else {
        return false;
    };
    (-1000000..=1000000).contains(&x)
        && (-1000000..=1000000).contains(&y)
        && c == format!("{x},{y}")
}
impl Document {
    pub fn validate(&self) -> Result<(), String> {
        if self.version != 3 {
            return Err(
                "Diese Dateiversion wird nicht unterstützt. Benötigt wird Atlas V3.".into(),
            );
        }
        if self.grid_feet != 5 || self.levels.is_empty() || self.levels.len() > 100 {
            return Err("Ungültiges Raster oder Geschossanzahl.".into());
        }
        let mut ids = HashSet::new();
        let mut cell_count = 0;
        let mut room_count = 0;
        for l in &self.levels {
            if !valid_id(&l.id) || !ids.insert(&l.id) || !valid_name(&l.name) {
                return Err("Ungültiges Geschoss.".into());
            }
            let mut rooms = HashSet::new();
            for r in &l.rooms {
                if !valid_id(&r.id) || !ids.insert(&r.id) || !valid_name(&r.name) {
                    return Err("Ungültiger Raum.".into());
                }
                rooms.insert(&r.id);
            }
            let mut used = HashSet::new();
            for (c, id) in &l.cells {
                if !valid_cell(c) || !rooms.contains(id) {
                    return Err("Ungültige Rasterzelle oder Raumzuordnung.".into());
                }
                used.insert(id);
            }
            if used.len() != rooms.len() {
                return Err("Ein Raum benötigt mindestens eine Rasterzelle.".into());
            }
            cell_count += l.cells.len();
            room_count += l.rooms.len();
        }
        if cell_count > 1000000 || room_count > 100000 {
            return Err("Die Karte ist zu groß.".into());
        }
        Ok(())
    }
}
pub fn parse(data: &[u8]) -> Result<Document, String> {
    if data.len() as u64 > MAX_BYTES {
        return Err("Atlas-Dateien dürfen maximal 64 MB groß sein.".into());
    }
    let value: serde_json::Value =
        serde_json::from_slice(data).map_err(|e| format!("Ungültige Atlas-Datei: {e}"))?;
    if value.get("version").and_then(|v| v.as_u64()) != Some(3) {
        return Err("Diese Dateiversion wird nicht unterstützt. Benötigt wird Atlas V3.".into());
    }
    let document: Document =
        serde_json::from_value(value).map_err(|e| format!("Ungültige Atlas-Datei: {e}"))?;
    document.validate()?;
    Ok(document)
}
pub fn read(path: &Path) -> Result<Document, String> {
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    if file.metadata().map_err(|e| e.to_string())?.len() > MAX_BYTES {
        return Err("Atlas-Dateien dürfen maximal 64 MB groß sein.".into());
    }
    let mut bytes = Vec::new();
    file.take(MAX_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    parse(&bytes)
}
pub fn write(path: &Path, document: &Document) -> Result<(), String> {
    document.validate()?;
    let data = serde_json::to_vec_pretty(document).map_err(|e| e.to_string())?;
    if data.len() as u64 > MAX_BYTES {
        return Err("Atlas-Dateien dürfen maximal 64 MB groß sein.".into());
    }
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    temp.write_all(&data)
        .and_then(|_| temp.as_file().sync_all())
        .map_err(|e| e.to_string())?;
    temp.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    fn sample() -> Document {
        parse(include_bytes!("../../tests/fixtures/v3-valid.json")).unwrap()
    }
    #[test]
    fn roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("map.json");
        let a = sample();
        write(&path, &a).unwrap();
        let b = read(&path).unwrap();
        assert_eq!(
            serde_json::to_value(a).unwrap(),
            serde_json::to_value(b).unwrap()
        );
    }
    #[test]
    fn shared_contract() {
        assert!(parse(include_bytes!("../../tests/fixtures/v3-valid.json")).is_ok());
        for bytes in [
            include_bytes!("../../tests/fixtures/v3-invalid-reference.json").as_slice(),
            include_bytes!("../../tests/fixtures/v3-duplicate-id.json").as_slice(),
            include_bytes!("../../tests/fixtures/v3-invalid-cell.json").as_slice(),
        ] {
            assert!(parse(bytes).is_err());
        }
    }
    #[test]
    fn rejects_old_versions() {
        for v in [1, 2, 4] {
            assert!(parse(format!("{{\"version\":{v}}}").as_bytes())
                .unwrap_err()
                .contains("V3"));
        }
    }
    #[test]
    fn rejects_invalid_names_and_limits() {
        let mut d = sample();
        d.levels[0].name = " ".into();
        assert!(d.validate().is_err());
        let mut d = sample();
        d.levels[0].rooms[0].name = "x".repeat(121);
        assert!(d.validate().is_err());
        let mut d = sample();
        d.levels = vec![d.levels[0].clone(); 101];
        assert!(d.validate().is_err());
        assert!(parse(b"not json").is_err());
    }
    #[test]
    fn oversized_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("large.json");
        std::fs::File::create(&path)
            .unwrap()
            .set_len(MAX_BYTES + 1)
            .unwrap();
        assert!(read(&path).unwrap_err().contains("64 MB"));
    }
    #[test]
    fn failure_preserves_original() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("map.json");
        write(&path, &sample()).unwrap();
        let before = std::fs::read(&path).unwrap();
        let mut d = sample();
        d.levels[0].cells.insert("0,0".into(), "missing".into());
        assert!(write(&path, &d).is_err());
        assert_eq!(before, std::fs::read(&path).unwrap());
        assert!(write(&dir.path().join("missing/map.json"), &sample()).is_err());
    }
}
