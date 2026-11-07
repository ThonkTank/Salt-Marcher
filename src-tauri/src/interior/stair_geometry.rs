//! Canonical physical stair geometry, independent of persistence and room ownership.
use super::{InteriorError, Result};
use serde::{Deserialize, Serialize};

pub const DEFAULT_STAIR_LENGTH: u8 = 3;

#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum StairDirection {
    North,
    East,
    South,
    West,
}

/// The origin is the lower-floor entry; direction points toward the upper entry.
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StairGeometry {
    pub floor: i64,
    pub x: i64,
    pub y: i64,
    pub direction: StairDirection,
    pub length: u8,
}

impl StairGeometry {
    /// Returns the footprint on both floors in lower-to-upper travel order.
    pub fn footprint(self) -> Result<Vec<(i64, i64, i64)>> {
        if !(2..=64).contains(&self.length) || i32::try_from(self.floor).is_err() {
            return Err("Invalid stair geometry".into());
        }
        let upper = self.floor.checked_add(1).ok_or("Invalid stair floor")?;
        if i32::try_from(upper).is_err() {
            return Err("Invalid stair floor".into());
        }
        let (dx, dy) = match self.direction {
            StairDirection::North => (0, -1),
            StairDirection::East => (1, 0),
            StairDirection::South => (0, 1),
            StairDirection::West => (-1, 0),
        };
        let mut result = Vec::with_capacity(usize::from(self.length) * 2);
        for floor in [self.floor, upper] {
            for step in 0..i64::from(self.length) {
                let x = self
                    .x
                    .checked_add(dx * step)
                    .ok_or("Invalid stair coordinates")?;
                let y = self
                    .y
                    .checked_add(dy * step)
                    .ok_or("Invalid stair coordinates")?;
                if x.abs_diff(0) > 1_000_000 || y.abs_diff(0) > 1_000_000 {
                    return Err("Invalid stair coordinates".into());
                }
                result.push((floor, x, y));
            }
        }
        Ok(result)
    }

    /// Resolve one room per floor and reject overlaps with existing footprints.
    /// Callers provide the current geometry overlay when validating an edit.
    pub fn resolve_rooms<E: From<InteriorError>>(
        self,
        mut room_at: impl FnMut(i64, i64, i64) -> std::result::Result<Option<String>, E>,
        mut occupied_by_stair: impl FnMut(i64, i64, i64) -> std::result::Result<bool, E>,
    ) -> std::result::Result<(String, String), E> {
        let mut rooms: [Option<String>; 2] = [None, None];
        for (index, (floor, x, y)) in self.footprint()?.into_iter().enumerate() {
            if occupied_by_stair(floor, x, y)? {
                return Err(InteriorError::from("Stair footprints overlap").into());
            }
            let room = room_at(floor, x, y)?
                .ok_or_else(|| InteriorError::from("Stairs require occupied footprints"))?;
            let slot = &mut rooms[index / usize::from(self.length)];
            if let Some(existing) = slot {
                if *existing != room {
                    return Err(InteriorError::from(
                        "Stair footprint must lie in one room per floor",
                    )
                    .into());
                }
            } else {
                *slot = Some(room);
            }
        }
        Ok((rooms[0].take().unwrap(), rooms[1].take().unwrap()))
    }

    pub fn upper_entry(self) -> Result<(i64, i64, i64)> {
        self.footprint()?
            .last()
            .copied()
            .ok_or_else(|| "Invalid stair geometry".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ownership_and_overlap_cover_every_cell() {
        let stair = StairGeometry {
            floor: 0,
            x: 0,
            y: 0,
            direction: StairDirection::East,
            length: 3,
        };
        let rooms = stair
            .resolve_rooms::<InteriorError>(
                |floor, _, _| Ok(Some(format!("room-{floor}"))),
                |_, _, _| Ok(false),
            )
            .unwrap();
        assert_eq!(rooms, ("room-0".into(), "room-1".into()));
        assert!(stair
            .resolve_rooms::<InteriorError>(
                |floor, x, _| Ok(Some(format!("{floor}-{x}"))),
                |_, _, _| Ok(false)
            )
            .is_err());
        assert!(stair
            .resolve_rooms::<InteriorError>(
                |_, x, _| Ok((x != 1).then(|| "room".into())),
                |_, _, _| Ok(false)
            )
            .is_err());
        assert!(stair
            .resolve_rooms::<InteriorError>(
                |_, _, _| Ok(Some("room".into())),
                |floor, x, _| Ok(floor == 1 && x == 1)
            )
            .is_err());
    }

    #[test]
    fn directions_and_bounds() {
        for (direction, end) in [
            (StairDirection::North, (1, 10, 18)),
            (StairDirection::East, (1, 12, 20)),
            (StairDirection::South, (1, 10, 22)),
            (StairDirection::West, (1, 8, 20)),
        ] {
            let stair = StairGeometry {
                floor: 0,
                x: 10,
                y: 20,
                direction,
                length: 3,
            };
            assert_eq!(stair.footprint().unwrap().len(), 6);
            assert_eq!(stair.upper_entry().unwrap(), end);
        }
        let mut stair = StairGeometry {
            floor: i64::from(i32::MAX),
            x: 0,
            y: 0,
            direction: StairDirection::East,
            length: 3,
        };
        assert!(stair.footprint().is_err());
        stair.floor = 0;
        stair.x = 1_000_000;
        assert!(stair.footprint().is_err());
        stair.x = 0;
        stair.length = 1;
        assert!(stair.footprint().is_err());
        stair.length = 64;
        assert_eq!(stair.footprint().unwrap().len(), 128);
        stair.length = 65;
        assert!(stair.footprint().is_err());
    }
}
