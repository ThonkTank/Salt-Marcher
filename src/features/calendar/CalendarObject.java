package features.calendar;

import features.calendar.input.AdvanceDayInput;
import features.calendar.input.AdvancePhaseInput;
import features.calendar.input.LoadCalendarInput;
import features.calendar.input.LoadCurrentDayInput;
import features.calendar.input.LoadDefaultCalendarInput;
import features.calendar.model.CalendarConfig;
import features.calendar.model.CalendarDay;
import features.calendar.repository.ConfigRepository;
import features.calendar.repository.PhaseRepository;
import features.calendar.service.CalendarService;
import features.calendar.state.CalendarConfigState;
import features.campaignstate.CampaignstateObject;
import features.campaignstate.input.LoadSessionInput;
import features.campaignstate.input.UpsertSessionInput;

import java.sql.Connection;
import java.sql.SQLException;

/**
 * Canonical root seam for calendar definition loading and session time
 * progression.
 */
@SuppressWarnings("unused")
public final class CalendarObject {

    public LoadDefaultCalendarInput.LoadedDefaultCalendarInput loadDefaultCalendar(LoadDefaultCalendarInput input)
            throws SQLException {
        return ConfigRepository.loadDefaultCalendar(input.connection())
                .map(state -> new LoadDefaultCalendarInput.LoadedDefaultCalendarInput(
                        true,
                        state.calendarId(),
                        state.name(),
                        state.daysPerMonth(),
                        state.monthNames(),
                        state.specialDays(),
                        state.yearBase()))
                .orElse(new LoadDefaultCalendarInput.LoadedDefaultCalendarInput(
                        false,
                        null,
                        null,
                        null,
                        null,
                        null,
                        0));
    }

    public LoadCalendarInput.LoadedCalendarInput loadCalendar(LoadCalendarInput input) throws SQLException {
        return ConfigRepository.loadCalendar(input.connection(), input.calendarId())
                .map(state -> new LoadCalendarInput.LoadedCalendarInput(
                        true,
                        state.calendarId(),
                        state.name(),
                        state.daysPerMonth(),
                        state.monthNames(),
                        state.specialDays(),
                        state.yearBase()))
                .orElse(new LoadCalendarInput.LoadedCalendarInput(
                        false,
                        null,
                        null,
                        null,
                        null,
                        null,
                        0));
    }

    public LoadCurrentDayInput.LoadedCurrentDayInput loadCurrentDay(LoadCurrentDayInput input) throws SQLException {
        LoadSessionInput.LoadedSessionInput session =
                new CampaignstateObject().loadSession(new LoadSessionInput(input.connection()));
        if (!session.present()) {
            return new LoadCurrentDayInput.LoadedCurrentDayInput(
                    false, null, 0L, null, 0, 0, 0, null, null, null, false, null);
        }
        CalendarConfigState calendar = session.calendarId() != null
                ? ConfigRepository.loadCalendar(input.connection(), session.calendarId()).orElse(null)
                : ConfigRepository.loadDefaultCalendar(input.connection()).orElse(null);
        if (calendar == null) {
            return new LoadCurrentDayInput.LoadedCurrentDayInput(
                    false, null, 0L, null, 0, 0, 0, null, null, null, false, null);
        }
        CalendarConfig config = new CalendarConfig();
        config.CalendarId = calendar.calendarId();
        config.Name = calendar.name();
        config.DaysPerMonth = calendar.daysPerMonth();
        config.MonthNames = calendar.monthNames();
        config.SpecialDays = calendar.specialDays();
        config.YearBase = calendar.yearBase();
        CalendarDay day = CalendarService.fromEpochDay(CalendarService.ParsedCalendar.from(config), session.currentEpochDay());
        return new LoadCurrentDayInput.LoadedCurrentDayInput(
                true,
                calendar.calendarId(),
                session.currentEpochDay(),
                session.currentPhaseId(),
                day.Year,
                day.Month,
                day.DayOfMonth,
                day.MonthName,
                day.Season,
                day.SpecialDayName,
                day.IsSpecialDay,
                day.format());
    }

    public void advanceDay(AdvanceDayInput input) throws SQLException {
        if (input.days() <= 0) {
            throw new IllegalArgumentException("days");
        }
        LoadSessionInput.LoadedSessionInput session =
                new CampaignstateObject().loadSession(new LoadSessionInput(input.connection()));
        if (!session.present()) {
            return;
        }
        new CampaignstateObject().upsertSession(new UpsertSessionInput(
                input.connection(),
                session.campaignId(),
                session.mapId(),
                session.partyTileId(),
                session.calendarId(),
                session.currentEpochDay() + input.days(),
                session.currentPhaseId(),
                session.currentWeather(),
                session.notes(),
                session.dungeonMapId(),
                session.dungeonLevelZ(),
                session.dungeonCellX(),
                session.dungeonCellY(),
                session.dungeonHeading()));
    }

    public void advancePhase(AdvancePhaseInput input) throws SQLException {
        LoadSessionInput.LoadedSessionInput session =
                new CampaignstateObject().loadSession(new LoadSessionInput(input.connection()));
        if (!session.present()) {
            return;
        }
        features.calendar.state.PhaseAdvanceState phaseAdvance =
                PhaseRepository.loadPhaseAdvance(input.connection(), session.currentPhaseId()).orElse(null);
        if (phaseAdvance == null) {
            return;
        }
        new CampaignstateObject().upsertSession(new UpsertSessionInput(
                input.connection(),
                session.campaignId(),
                session.mapId(),
                session.partyTileId(),
                session.calendarId(),
                session.currentEpochDay() + (phaseAdvance.wrapsDay() ? 1 : 0),
                phaseAdvance.nextPhaseId(),
                session.currentWeather(),
                session.notes(),
                session.dungeonMapId(),
                session.dungeonLevelZ(),
                session.dungeonCellX(),
                session.dungeonCellY(),
                session.dungeonHeading()));
    }
}
