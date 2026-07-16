package features.party.adapter.javafx.adventuringday;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellTopBarSpec;
import features.party.api.PartyApi;
import features.party.api.AdventuringDayCalculationModel;
import features.party.api.AdventuringDaySummaryModel;

public final class AdventuringDayTopBarContribution implements ShellContribution {

    private final AdventuringDaySummaryModel summaryModel;
    private final AdventuringDayCalculationModel calculationModel;
    private final PartyApi party;

    public AdventuringDayTopBarContribution(
            AdventuringDaySummaryModel summaryModel,
            AdventuringDayCalculationModel calculationModel,
            PartyApi party
    ) {
        this.summaryModel = Objects.requireNonNull(summaryModel, "summaryModel");
        this.calculationModel = Objects.requireNonNull(calculationModel, "calculationModel");
        this.party = Objects.requireNonNull(party, "party");
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTopBarSpec(new ContributionKey("adventuring-day"), 10);
    }

    @Override
    public ShellBinding bind() {
        return new AdventuringDayTopBarBinder(summaryModel, calculationModel, party).bind();
    }
}
