#hint: Options Hacker \n This study lets you scan and perform calculations on the options chain for a series and given depth. \n<b>Warning: Setting the StrikeDepth to large values requires significant processing power, and will result in slow loading times.</b>
#
# sudoshu - I would not have been able to make this work without the help, and kindness to share code from those listed below. Thank you!
#
# Credits:
#     mobius
#     ziongotoptions
#     Angrybear
#     halcyonguy
#     MerryDay
#     MountainKing333
#     BenTen
#     DeusMecanicus
#     Zardoz0609
#     NPTrading
#

declare once_per_bar;
declare hide_on_intraday;
declare lower;
def version = 0.4;

#-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------#
# Settings

# Colors
DefineGlobalColor("Call", Color.GREEN);
DefineGlobalColor("Put", Color.RED);
DefineGlobalColor("CallCloud",Color.DARK_GREEN);
DefineGlobalColor("PutCloud",Color.DARK_RED);
DefineGlobalColor("CallAverage",Color.LIGHT_GREEN);
DefineGlobalColor("PutAverage",Color.ORANGE);
DefineGlobalColor("GEX",Color.CYAN);


#hint Series: The option expiration series to search. \n This value is used to determine the option symbol.
input Series = {
    default Weekly,
    Opex,
    Month1,
    Month2,
    Month3,
    Month4,
    Month5,
    Month6,
    Month7,
    Month8,
    Month9
};

# Todo: Maybe can add something like this to get more than just fridays ...
#hint OpexDay:
#input OpexDay = {
#    Monday,
#    Tuesday,
#    Wednesday,
#    Thursday,
#    default Friday
#};

#hint DataType: The type of option data to show.
input DataType = {default OpenInterest, Volume, GammaExposure};

#hint StrikeDepth: The level of depth to search a series. (+/- this far from ATM)
input StrikeDepth = 10;

#hint CenterStrikeOffset: The offset to use when calculating the center strike based on close price. \n Examples: \n   1 = nearest $1 interval \n   10 = nearest $10 interval.
input CenterStrikeOffset = 1.0;

#hint MaxStrikeSpacing: The maximum dollar amount between two adjacent contracts.
input MaxStrikeSpacing = 25;

#hint GEXCalculationMethod: The method to use for calculating gamma exposure. \n The total gamma exposure is then the sum of all call gex + put gex. \n <li>ContributionShares: \n gamma * OI * 100 (* -1 for puts)</li><li>Contribution: \n gamma * OI * 100 * Spot Price (* -1 for puts)</li><li>ContributionPercent: \n gamma * OI * 100 * Spot Price ^2 * 0.01 (* -1 for puts)</li>
input GEXCalculationMethod = {default ContributionShares, Contribution, ContributionPercent};

#hint ShowStrikeInfo: Show the strike info labels.
input ShowStrikeInfo = yes;

#hint ShowLabels: Show labels for the current data type.
input ShowLabels = yes;

#hint ShowClouds: Show clouds for volume and/or open interest.
input ShowClouds = yes;

#hint ShowLines: Show lines for values.
input ShowLines = yes;

#hint ShowAverages: Show the moving average lines.
input ShowAverages = yes;

#hint ShowGreeks: Show the estimated Greek calculation labels for the latest bar.
input ShowGreeks = yes;

#hint FlipPuts: Flip the puts underneath the axis
input FlipPuts = yes;

#hint StrikeMode: The mode to select an option symbol. \n AUTO will try to find the option symbol based on the Series and StrikeDepth inputs. \n MANUAL allows an override of the AUTO behavior by using the ManualCenterStrike and ManualStrikeSpacing inputs to determine the option symbol.
input StrikeMode = {default AUTO, MANUAL};

#hint ManualCenterStrike: The starting price to use when in MANUAL mode.
input ManualCenterStrike = 440;

#hint ManualStrikeSpacing: The dollar amount between two adjacent contracts to use when in MANUAL mode.
input ManualStrikeSpacing = 1.0;

#hint IVMethod: The method to use for calculating implied volatility. This is mainly used in the GEX calculations. \n ClosedFormIV uses an approximation for implied volatility based on methods from mobius. \n SeriesIV uses the built in SeriesVolatility() function.
input IVMethod = {default ClosedFormIV, SeriesIV};

#hint Debug: Shows plots and data for debugging purposes.
input Debug = no;


#-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------#
# Date, Symbol, and Strike
#

# OptionSeries is the expiry starting at 1 and raising by one for each next expiry. \n This is only used for the SeriesIV method calculation.
def OptionSeries;
switch (Series) {
    case Weekly:
        OptionSeries = 1;
    case Opex:
        OptionSeries = 2;
    case Month1:
        OptionSeries = 3;
    case Month2:
        OptionSeries = 4;
    case Month3:
        OptionSeries = 5;
    case Month4:
        OptionSeries = 6;
    case Month5:
        OptionSeries = 7;
    case Month6:
        OptionSeries = 8;
    case Month7:
        OptionSeries = 9;
    case Month8:
        OptionSeries = 10;
    case Month9:
        OptionSeries = 11;
};

# Open price at Regular Trading Hours
def RTHopen = open(period = AggregationPeriod.DAY);

# Current year, month, day, and date
def CurrentYear = GetYear(); # number of current bar in CST
def CurrentMonth = GetMonth(); # 1 - 12
def CurrentDay = GetDay(); # 1 - 365 (366 for leap year)
def CurrentDate = GetYYYYMMDD(); # date of the current bar in the YYYYMMDD

# Current day of this month
def CurrentDayOfMonth = GetDayOfMonth(CurrentDate);

# Get the first day of this month - 1 (Monday) to 7 (Sunday)
def FirstDayThisMonth = GetDayOfWeek((CurrentYear * 10000) + (CurrentMonth * 100) + 1);

# Get the first upcoming friday
def FirstUpcomingFriday =
    if FirstDayThisMonth < 6 then 6 - FirstDayThisMonth
    else if FirstDayThisMonth == 6 then 7
    else 6
;

# Get the second, third, and fourth upcoming fridays
def SecondUpcomingFriday = FirstUpcomingFriday + 7;
def ThirdUpcomingFriday = FirstUpcomingFriday + 14;
def FourthUpcomingFriday = FirstUpcomingFriday + 21;

# Get the month of expiration for the option, accounting for end of month rollover
def ExpMonth1 =
    if Series == Series.Opex and ThirdUpcomingFriday > CurrentDayOfMonth then CurrentMonth
    else if Series == Series.Opex and ThirdUpcomingFriday < CurrentDayOfMonth then CurrentMonth + 1
    else if FourthUpcomingFriday > CurrentDayOfMonth then CurrentMonth
    else CurrentMonth + 1
;

# Get the month of expiration for the option, accounting for end of year rollover
def ExpMonth = if ExpMonth1 > 12 then ExpMonth1 - 12 else ExpMonth1;

# Get the year of expiration for the option
def ExpYear = if ExpMonth1 > 12 then CurrentYear + 1 else CurrentYear;

# Get the first day at the current expiration year and month
def ExpDay1DOW = GetDayOfWeek(ExpYear * 10000 + ExpMonth * 100 + 1);

# Get the first friday at the current expiration year and month
def ExpFirstFridayDOM =
    if ExpDay1DOW < 6 then 6 - ExpDay1DOW
    else if ExpDay1DOW == 6 then 7
    else 6
;

# Get the second, third, and fourth fridays at the current expiration year and month
def ExpSecondFridayDOM = ExpFirstFridayDOM + 7;
def ExpThirdFridayDOM = ExpFirstFridayDOM + 14;
def ExpFouthFridayDOM = ExpFirstFridayDOM + 21;

# Get the day of month of expiration for the option
def ExpDOM =
    if Series == Series.Opex then ExpThirdFridayDOM
    else if CurrentDayOfMonth < ExpFirstFridayDOM -1 then FirstUpcomingFriday
    else if between(CurrentDayOfMonth, ExpFirstFridayDOM, SecondUpcomingFriday - 1) then SecondUpcomingFriday
    else if between(CurrentDayOfMonth, SecondUpcomingFriday, ThirdUpcomingFriday - 1) then ThirdUpcomingFriday
    else if between(CurrentDayOfMonth, ThirdUpcomingFriday, FourthUpcomingFriday - 1) then FourthUpcomingFriday
    else ExpFirstFridayDOM
;

# Option Expiration Date - Depending on selected series
def OpexDate_NoHolidays = ExpYear * 10000 + ExpMonth * 100 + ExpDOM;

# Option Expiration Date - Accounting for holidays
def OpexDate =
    if ExpMonth == 4 and ExpDOM == 15 then OpexDate_NoHolidays - 1 else OpexDate_NoHolidays # Exchange holiday on April 15, 2022
;

# The OpexCode is the expiry date in the format of an option symbol.
# Example:
#     The date of expiry is April 15th, 2022.
#     The format of this date from the code we have above, the OptionExpiryDate, would be 20,220,415
#     Options symbols expect the format for this date as 220415 (we need to get rid of the leading 20)
def OpexCode = OpexDate - 20000000;

# Option Days to Expiration
#def DTE = CountTradingDays(CurrentDate, OptionExpiryDate);
def DTE = DaysTillDate(OpexDate);

# Find the center strike - the price closest to ATM option
def CenterStrike =
    if (StrikeMode == StrikeMode.AUTO and !IsNaN(close)) then Round(close / CenterStrikeOffset, 0) * CenterStrikeOffset
    else if (StrikeMode == StrikeMode.MANUAL and !IsNaN(close)) then ManualCenterStrike
    else CenterStrike[1]
;

# Strike Spacing
def StrikeSpacingC =
    fold i = 1 to MaxStrikeSpacing
    with spacing = 1
    do if !IsNaN(
        open_interest(("." + GetSymbolPart()) + AsPrice(OpexCode) + "P" + AsPrice(CenterStrike + (MaxStrikeSpacing - i)))
    )
    then MaxStrikeSpacing - i
    else if !IsNaN(
        volume(("." + GetSymbolPart()) + AsPrice(OpexCode) + "P" + AsPrice(CenterStrike + (MaxStrikeSpacing - i)))
    )
    then MaxStrikeSpacing - i
    else spacing
;
def StrikeSpacing =
    if (StrikeMode == StrikeMode.AUTO and !IsNaN(close)) then StrikeSpacingC
    else if (StrikeMode == StrikeMode.MANUAL and !IsNaN(close)) then ManualStrikeSpacing
    else StrikeSpacing[1]
;


# Date and Strike Debugging
plot DebugCurrentDate = CurrentDate - 20000000;
DebugCurrentDate.SetHiding(!Debug);
plot DebugOptionExpiryDate = OpexCode;
DebugOptionExpiryDate.SetHiding(!Debug);
plot DebugDTE = DTE;
DebugDTE.SetHiding(!Debug);
plot DebugCenterStrike = CenterStrike;
DebugCenterStrike.SetHiding(!Debug);
plot DebugStrikeSpacing = StrikeSpacing;
DebugStrikeSpacing.SetHiding(!Debug);


#-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------#
# Option Chain Data Gathering


# Script to get the total open interest at a spot
script TotalSpotOI {
    input StrikeDepth = 1;
    input OpexCode = 1;
    input CenterStrike = 1;
    input StrikeSpacing = 1;
    input IsCall = yes;
    def total =
        fold index = -(StrikeDepth) to (StrikeDepth + 1)
        with value = 0
        do
            if !IsNaN(
                open_interest(("." + GetSymbolPart()) + AsPrice(OpexCode) + (if IsCall then "C" else "P") + AsPrice(CenterStrike + (StrikeSpacing * index)))
            )
            then value + open_interest(("." + GetSymbolPart()) + AsPrice(OpexCode) + (if IsCall then "C" else "P") + AsPrice(CenterStrike + (StrikeSpacing * index)))
            else value + 0
    ;
    plot TotalSpotOI = total;
}

# Total Call Open Interest for selected chain depth and expiry series
def TotalCallOpenInterest = TotalSpotOI(StrikeDepth, OpexCode, CenterStrike, StrikeSpacing, yes);

# Total Put Open Interest for selected chain depth and expiry series
def TotalPutOpenInterest = TotalSpotOI(StrikeDepth, OpexCode, CenterStrike, StrikeSpacing, no);


# Script to get the total volume at a spot
script TotalSpotVolume {
    input StrikeDepth = 1;
    input OpexCode = 1;
    input CenterStrike = 1;
    input StrikeSpacing = 1;
    input IsCall = yes;
    def total =
        fold index = -(StrikeDepth) to (StrikeDepth + 1)
        with value = 0
        do
            if !IsNaN(
                volume(("." + GetSymbolPart()) + AsPrice(OpexCode) + (if IsCall then "C" else "P") + AsPrice(CenterStrike + (StrikeSpacing * index)))
            )
            then value + volume(("." + GetSymbolPart()) + AsPrice(OpexCode) + (if IsCall then "C" else "P") + AsPrice(CenterStrike + (StrikeSpacing * index)))
            else value + 0
    ;
    plot TotalSpotVolume = total;
}

# Total Call Open Interest for selected chain depth and expiry series
def TotalCallVolume = TotalSpotVolume(StrikeDepth, OpexCode, CenterStrike, StrikeSpacing, yes);

# Total Put Volume for selected chain depth and expiry series
def TotalPutVolume = TotalSpotVolume(StrikeDepth, OpexCode, CenterStrike, StrikeSpacing, no);


# Abramowiz Stegun Approximation for Cumulative Normal Distribution
script CND {
    input data  = 1;
    def a = AbsValue(data);
    def b1 =  .31938153;
    def b2 = -.356563782;
    def b3 = 1.781477937;
    def b4 = -1.821255978;
    def b5 = 1.330274429;
    def b6 =  .2316419;
    def e = 1 / (1 + b6 * a);
    def i = 1 - 1 / Sqrt(2 * Double.Pi) * Exp(-Power(a, 2) / 2) *
           (b1 * e + b2 * e * e + b3 *
            Power(e, 3) + b4 * Power(e, 4) + b5 * Power(e, 5));
    plot CND = if data < 0
               then 1 - i
               else i;
}

# Closed form IV approximation
# IV = sqrt(2*pi / t) * (C / S)
# S = Price of the underlying
# C = Price of the option
# t = time to maturity
script ClosedFormIV {
    input C = 1;
    input S = 1;
    input t = 1; # time to maturity
    #plot IV = (C * Sqrt(2 * Double.Pi)) / (S * Sqrt(t));
    plot IV = (sqrt((2 * Double.Pi)/t)) * (C / S);
}

# Greeks Calculations
#
# K  - Option strike price
# N  - Standard normal cumulative distribution function
# r  - Risk free interest rate
# IV - Volatility of the underlying
# S  - Price of the underlying
# t  - Time to option's expiry
#
# d1    = (ln(S/K) + (r + (sqr(IV)/2))t) / (? (sqrt(t)))
# d2    = e -(sqr(d1) / 2) / sqrt(2*pi)
#
# Delta = N(d1)
# Gamma = (d2) / S(IV(sqrt(t)))
# Theta = ((S d2))IV) / 2 sqrt(t)) - (rK e(rt)N(d4))
#         where phi(d3) = (exp(-(sqr(x)/2))) / (2 * sqrt(t))
#         where d4 = d1 - IV(sqrt(t))
# Vega  = S phi(d1) Sqrt(t)
def K = CenterStrike;
def S = close;
def r = GetInterestRate();
def t = (DTE / 365);

# At the money call price used for ClosedFormIV calcuation
def ATMCallPrice = if isNaN(close(symbol = ("." + GetSymbolPart()) + AsPrice(OpexCode) + "C" + AsPrice(CenterStrike), period = aggregationPeriod.DAY))
    then ATMCallPrice[1]
    else close(symbol = ("." + GetSymbolPart()) + AsPrice(OpexCode) + "C" + AsPrice(CenterStrike), period = aggregationPeriod.DAY)
;

# ClosedFormIV is an approximation of implied volatility based on scripts/methods from mobius
def IV1 = ClosedFormIV(ATMCallPrice, RTHopen, t);
plot MobiusIV = if IV1 > 0 and !IsInfinite(IV1) then IV1 else IV1[1];
MobiusIV.SetHiding(!Debug);

# SeriesVolatility is the expiry starting at 1 and raising by 1 for each next expiry
def IV2 = SeriesVolatility(series = OptionSeries);
plot SeriesIV = if IV2 > 0 and !IsInfinite(IV2) then IV2 else IV2[1];
SeriesIV.SetHiding(!Debug);

# Implied Volatily method
def IV;
switch (IVMethod) {
    case ClosedFormIV:
        IV = IV1;
    case SeriesIV:
        IV = IV2;
}

# Start greek calculations
def d1 = (Log(S / K) + ((r + (Sqr(IV) / 2)) * t)) / (IV * Sqrt(t));
def d2 = Exp(-(Sqr(d1) / 2)) / Sqrt(2 * Double.Pi);

# Delta
def Delta = CND(d1);

# Gamma
def Gamma = d2 / (S * (IV * Sqrt(t)));

# Theta
def Theta = -(-(S*d2*IV*(.5000)/
             (2*sqrt(t)))-
             (r*(exp(-r*t)*K))*CND(d2)+(S*CND(d1)*(.5000)))/365;
# (.5000) variant less than .5 e(X/t)

# Vega
def Vega = (S*d2*sqrt(t))/100;


# GEX Calculation Methods:
#
# ContributionShares:
#     Call GEX = gamma * OI * 100
#     Put GEX  = gamma * OI * 100 * -1
#
# Contribution:
#     Call GEX = gamma * OI * 100 * Spot Price
#     Put GEX  = gamma * OI * 100 * Spot Price * -1
#
# ContributionPercent:
#     Call GEX = gamma * OI * 100 * Spot Price ^2 * 0.01
#     Put GEX  = gamma * OI * 100 * Spot Price ^2 * 0.01 * -1
#


# Script to get the total gamma exposure at a spot
script TotalSpotGEX {
    input StrikeDepth = 1;
    input OpexCode = 1;
    input CenterStrike = 1;
    input StrikeSpacing = 1;
    input IsCall = yes;
    input GEXCalculationMethod = {default ContributionShares, Contribution, ContributionPercent};
    input DTE = 1;
    input IV = 1;
    input r = 1;
    input t = 1;
    def total =
        fold index = -(StrikeDepth) to (StrikeDepth + 1)
        with value = 0
        do
            if !IsNaN(
                open_interest(("." + GetSymbolPart()) + AsPrice(OpexCode) + (if IsCall then "C" else "P") + AsPrice(CenterStrike + (StrikeSpacing * index)))
            )
            then value +
                (Exp(-(Sqr((Log(close / (CenterStrike + (StrikeSpacing * index))) + ((r + (Sqr(IV) / 2)) * t)) / (IV * Sqrt(t))) / 2)) / Sqrt(2 * Double.Pi) / (close * (IV * Sqrt(t)))) *
                open_interest(("." + GetSymbolPart()) + AsPrice(OpexCode) + (if IsCall then "C" else "P") + AsPrice(CenterStrike + (StrikeSpacing * index))) *
                100 *
                if GEXCalculationMethod == GEXCalculationMethod.ContributionShares then
                    1
                else if GEXCalculationMethod == GEXCalculationMethod.Contribution then
                    close
                else
                    Sqr(close) * 0.01 *
                if IsCall then 1 else -1
            else value + 0
    ;
    plot TotalSpotGEX = total;
}

# Total Call Gamma Exposure for selected chain depth and expiry series
def TotalCallGammaExposure = TotalSpotGEX(StrikeDepth, OpexCode, CenterStrike, StrikeSpacing, yes, GEXCalculationMethod, DTE, IV, r, t);

# Total Put Gamma Exposure for selected chain depth and expiry series
def TotalPutGammaExposure = TotalSpotGEX(StrikeDepth, OpexCode, CenterStrike, StrikeSpacing, no, GEXCalculationMethod, DTE, IV, r, t);


#-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------#
# Visuals

# Version Label
AddLabel(yes, "OptionsHacker v" + version, Color.LIGHT_GRAY);

# Selected DataType
AddLabel(yes, DataType, Color.LIGHT_GRAY);

# Selected Series
AddLabel(yes, Series, Color.LIGHT_GRAY);

# Center Strike Label
AddLabel(ShowStrikeInfo, "Center Strike: " + AsDollars(CenterStrike), if StrikeMode == StrikeMode.AUTO then Color.LIGHT_GRAY else Color.RED);

# Strike Spacing Label
AddLabel(ShowStrikeInfo, "Strike Spacing: " + AsDollars(StrikeSpacing), if StrikeMode == StrikeMode.AUTO then Color.LIGHT_GRAY else Color.RED);

# Chain Depth Label
AddLabel(ShowStrikeInfo, "Strike Depth: +/-" + StrikeDepth, Color.LIGHT_GRAY);

# Current ATM Options Labels
Addlabel(ShowStrikeInfo, "ATM Put: " + ("." + GetSymbol()) + AsPrice(OpexCode) + "P" + AsPrice(CenterStrike), GlobalColor("Call"));
Addlabel(ShowStrikeInfo, "ATM Call: " + ("." + GetSymbol()) + AsPrice(OpexCode) + "C" + AsPrice(CenterStrike), GlobalColor("Put"));

# Create a center line
plot ZeroLine = 0;
ZeroLine.SetDefaultColor(Color.WHITE);

# Call Open Interest
plot CallOpenInterest = TotalCallOpenInterest;
CallOpenInterest.SetHiding(!ShowLines or DataType != DataType.OpenInterest);
CallOpenInterest.SetPaintingStrategy(PaintingStrategy.LINE);
CallOpenInterest.SetDefaultColor(GlobalColor("Call"));
AddLabel(ShowLabels and DataType == DataType.OpenInterest, "CallOI: " + CallOpenInterest, GlobalColor("Call"));

# Put Open Interest
plot PutOpenInterest = if FlipPuts then -(TotalPutOpenInterest) else TotalPutOpenInterest;
PutOpenInterest.SetHiding(!ShowLines or DataType != DataType.OpenInterest);
PutOpenInterest.SetPaintingStrategy(PaintingStrategy.LINE);
PutOpenInterest.SetDefaultColor(GlobalColor("Put"));
AddLabel(ShowLabels and DataType == DataType.OpenInterest, "PutOI: " + AbsValue(PutOpenInterest), GlobalColor("Put"));

# Create Clouds for Open Interest
AddCloud(
    if ShowClouds and DataType == DataType.OpenInterest then CallOpenInterest else Double.NaN,
    if ShowClouds and DataType == DataType.OpenInterest then Zeroline else Double.NaN,
    GlobalColor("CallCloud"), GlobalColor("PutCloud")
);
AddCloud(
    if ShowClouds and DataType == DataType.OpenInterest then Zeroline else Double.NaN,
    if ShowClouds and DataType == DataType.OpenInterest then PutOpenInterest else Double.NaN,
    GlobalColor("PutCloud"), GlobalColor("PutCloud")
);

# Hull Moving Average of Put Open Interest
plot PutOpenInterestAverage = hullmovingavg(PutOpenInterest);
PutOpenInterestAverage.SetHiding(!ShowAverages or DataType != DataType.OpenInterest);
PutOpenInterestAverage.SetDefaultColor(GlobalColor("PutAverage"));
PutOpenInterestAverage.SetStyle(Curve.MEDIUM_DASH);

# Hull Moving Average of Call Open Interest
plot CallOpenInterestAverage = hullmovingavg(CallOpenInterest);
CallOpenInterestAverage.SetHiding(!ShowAverages or DataType != DataType.OpenInterest);
CallOpenInterestAverage.SetDefaultColor(GlobalColor("CallAverage"));
CallOpenInterestAverage.SetStyle(Curve.MEDIUM_DASH);

# Call Volume
plot CallVolume = TotalCallVolume;
CallVolume.SetHiding(!ShowLines or DataType != DataType.Volume);
CallVolume.SetPaintingStrategy(PaintingStrategy.LINE);
CallVolume.SetDefaultColor(GlobalColor("Call"));
AddLabel(ShowLabels and DataType == DataType.Volume, "CallVol: " + CallVolume, GlobalColor("Call"));

# Put Volume
plot PutVolume = if FlipPuts then -(TotalPutVolume) else TotalPutVolume;
PutVolume.SetHiding(!ShowLines or DataType != DataType.Volume);
PutVolume.SetPaintingStrategy(PaintingStrategy.LINE);
PutVolume.SetDefaultColor(GlobalColor("Put"));
AddLabel(ShowLabels and DataType == DataType.Volume, "PutVol: " + AbsValue(PutVolume), GlobalColor("Put"));

# Create Clouds for Volume
AddCloud(
    if ShowClouds and DataType == DataType.Volume then CallVolume else Double.NaN,
    if ShowClouds and DataType == DataType.Volume then Zeroline else Double.NaN,
    GlobalColor("CallCloud"), GlobalColor("CallCloud")
);
AddCloud(
    if ShowClouds and DataType == DataType.Volume then Zeroline else Double.NaN,
    if ShowClouds and DataType == DataType.Volume then PutVolume else Double.NaN,
    GlobalColor("PutCloud"), GlobalColor("CallCloud")
);

# Hull Moving Average of Put Volume
plot PutVolumeAverage = hullmovingavg(PutVolume);
PutVolumeAverage.SetHiding(!ShowAverages or DataType != DataType.Volume);
PutVolumeAverage.SetDefaultColor(GlobalColor("PutAverage"));
PutVolumeAverage.SetStyle(Curve.MEDIUM_DASH);

# Hull Moving Average of Call Volume
plot CallVolumeAverage = hullmovingavg(CallVolume);
CallVolumeAverage.SetHiding(!ShowAverages or DataType != DataType.Volume);
CallVolumeAverage.SetDefaultColor(GlobalColor("CallAverage"));
CallVolumeAverage.SetStyle(Curve.MEDIUM_DASH);

# Gamma Exposure
plot GammaExposure = (TotalCallGammaExposure + TotalPutGammaExposure);
GammaExposure.SetHiding(DataType != DataType.GammaExposure);
GammaExposure.SetPaintingStrategy(PaintingStrategy.HISTOGRAM);
GammaExposure.SetDefaultColor(GlobalColor("GEX"));
AddLabel(
    DataType == DataType.GammaExposure,
    if GEXCalculationMethod == GEXCalculationMethod.ContributionShares then
        "GEX: " + GammaExposure + " Shares"
    else if GEXCalculationMethod == GEXCalculationMethod.Contribution then
        "GEX: " + GammaExposure + "$ Per 1$ Move"
    else
        "GEX: " + GammaExposure + "$ Per 1% Move"
    ,
    GlobalColor("GEX")
);

# Greeks Labels
AddLabel(ShowGreeks, "Delta: " + Delta, Color.WHITE);
AddLabel(ShowGreeks, "Gamma: " + Gamma, Color.WHITE);
AddLabel(ShowGreeks, "Theta: " + Theta, Color.WHITE);
AddLabel(ShowGreeks, "Vega: " + Vega, Color.WHITE);
