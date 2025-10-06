  async getEventsInRange(calendarId, schema, start, end) {
    const allEvents = await this.listEvents(calendarId, schema);
    const rangeStart = compareTimestampsWithSchema(schema, start, end) <= 0 ? start : end;
    const rangeEnd = rangeStart === start ? end : start;
    return allEvents.filter((event) => {
      const afterStart = compareTimestampsWithSchema(schema, event.date, rangeStart) > 0;
      const beforeOrEqualEnd = compareTimestampsWithSchema(schema, event.date, rangeEnd) <= 0;
      return afterStart && beforeOrEqualEnd;
    });
  }
    const triggeredEvents = await this.eventRepo.getEventsInRange(
      activeCalendarId,
      calendar,
      currentTimestamp,
      result.timestamp
    );
    return { timestamp: result.timestamp, triggeredEvents };
    this.recentlyTriggeredEvents = [];
    this.renderDashboard(
      snapshot.activeCalendar,
      snapshot.currentTimestamp,
      snapshot.upcomingEvents,
      this.recentlyTriggeredEvents
    );
  renderDashboard(calendar, currentTimestamp, upcomingEvents, triggeredEvents) {
    this.renderTriggeredEvents(calendar, triggeredEvents);
    this.renderEventList(section, calendar, events);
  }
  renderTriggeredEvents(calendar, events) {
    if (!this.containerEl || events.length === 0) return;
    const section = this.containerEl.createDiv({ cls: "almanac-section" });
    section.createEl("h2", { text: "Recently Triggered" });
    this.renderEventList(section, calendar, events);
  }
  renderEventList(section, calendar, events) {
      const result = await this.gateway.advanceTimeBy(amount, unit);
      this.recentlyTriggeredEvents = result.triggeredEvents;
