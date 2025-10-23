---
smType: calendar
id: "gregorian-standard"
name: "Gregorian Calendar"
description: "Standard Earth calendar with 12 months (24-hour days)"
daysPerWeek: 7
hoursPerDay: 24
minutesPerHour: 60
secondsPerMinute: 60
minuteStep: 15
months:
  - id: "jan"
    name: "January"
    length: 31
  - id: "feb"
    name: "February"
    length: 28
  - id: "mar"
    name: "March"
    length: 31
  - id: "apr"
    name: "April"
    length: 30
  - id: "may"
    name: "May"
    length: 31
  - id: "jun"
    name: "June"
    length: 30
  - id: "jul"
    name: "July"
    length: 31
  - id: "aug"
    name: "August"
    length: 31
  - id: "sep"
    name: "September"
    length: 30
  - id: "oct"
    name: "October"
    length: 31
  - id: "nov"
    name: "November"
    length: 30
  - id: "dec"
    name: "December"
    length: 31
epoch:
  year: 2024
  monthId: "jan"
  day: 1
schemaVersion: "1.0.0"
---

# Gregorian Calendar

The standard Earth calendar system used worldwide. Features 12 months with varying lengths totaling 365 days per year.

## Months

| Month | Days | Season |
|-------|------|--------|
| January | 31 | Winter |
| February | 28 | Winter |
| March | 31 | Spring |
| April | 30 | Spring |
| May | 31 | Spring |
| June | 30 | Summer |
| July | 31 | Summer |
| August | 31 | Summer |
| September | 30 | Autumn |
| October | 31 | Autumn |
| November | 30 | Autumn |
| December | 31 | Winter |

## Time Structure

- **Week**: 7 days (Monday through Sunday)
- **Day**: 24 hours
- **Hour**: 60 minutes
- **Minute**: 60 seconds

## Epoch

The epoch (reference point) for this calendar is set to **January 1, 2024**.

## Notes

This is a simplified version of the Gregorian calendar. Leap years are not currently implemented in this version.
