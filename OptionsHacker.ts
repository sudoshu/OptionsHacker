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

declare lower;
def version = 0.2;

#-----------------------------------------------------------------------------------------------------------------#
# Settings

# Colors
DefineGlobalColor("Call", Color.GREEN);
DefineGlobalColor("Put", Color.RED);
DefineGlobalColor("CallCloud",Color.DARK_GREEN);
DefineGlobalColor("PutCloud",Color.DARK_RED);
DefineGlobalColor("GEX",Color.CYAN);

#hint Mode: The mode to select an option symbol. \n AUTO will try to find the option symbol based on the Series and StrikeDepth inputs. \n MANUAL allow an override of the AUTO behavior by using the ManualCenterStrike and ManualStrikeSpacing inputs to determine the option symbol.
input Mode = {default AUTO, MANUAL};

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

#hint DataType: The type of option data to show.
input DataType = {default OpenInterest, Volume, GammaExposure};

#hint StrikeDepth: The level of depth to search a series. (+/- this far from ATM)
input StrikeDepth = 10;

#hint CenterStrikeOffset: The offset to use when calculating the center strike based on close price. \n Examples: \n   1 = nearest $1 interval \n   10 = nearest $10 interval. 
input CenterStrikeOffset = 1.0;

#hint MaxStrikeSpacing: The maximum dollar amount between two adjacent contracts.
input MaxStrikeSpacing = 25;

#hint ManualCenterStrike: The starting price to use when in MANUAL mode.
input ManualCenterStrike = 440;

#hint ManualStrikeSpacing: The dollar amount between two adjacent contracts to use when in MANUAL mode.
input ManualStrikeSpacing = 1.0;

#hint GEXCalculationMethod: The method to use for calculating gamma exposure. \n The total gamma exposure is then the sum of all call gex + put gex. \n <li>ContributionShares: gamma * OI * 100 (* -1 for puts)</li><li>Contribution: gamma * OI * 100 * Spot Price (* -1 for puts)</li><li>ContributionPercent: gamma * OI * 100 * Spot Price ^2 * 0.01 (* -1 for puts)</li>
input GEXCalculationMethod = {default ContributionShares, Contribution, ContributionPercent};

#hint ShowStrikeInfo: Show the strike info labels.
input ShowStrikeInfo = yes;

#hint ShowLabels: Show the open interest labels.
input ShowLabels = yes;

#hint ShowClouds: Show the open interest clouds.
input ShowClouds = yes;

#hint ShowLines: Show the open interest lines.
input ShowLines = yes;

#hint ShowAverages: Show the moving average lines.
input ShowAverages = yes;

#hint ShowGreeks: Show the estimated Greek calculation labels for the latest bar.
input ShowGreeks = yes;


#-----------------------------------------------------------------------------------------------------------------#
# Date, Symbol, and Strike

# OptionSeries is the expiry starting at 1 and raising by one for each next expiry.
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
    else if FourthUpcomingFriday > CurrentDayOfMonth then CurrentMonth + OptionSeries - 2
    else CurrentMonth + OptionSeries - 1
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
    if CurrentDayOfMonth < ExpFirstFridayDOM -1 then FirstUpcomingFriday
    else if between(CurrentDayOfMonth, ExpFirstFridayDOM, SecondUpcomingFriday - 1) then SecondUpcomingFriday
    else if between(CurrentDayOfMonth, SecondUpcomingFriday, ThirdUpcomingFriday - 1) then ThirdUpcomingFriday
    else if between(CurrentDayOfMonth, ThirdUpcomingFriday, FourthUpcomingFriday - 1) then FourthUpcomingFriday
    else ExpFirstFridayDOM
;

# Option Expiration Date - This is still some voodoo to me ... use like AsPrice(OptionExpiryDate - 20000001) to get string value
def OptionExpiryDate = 
    if Series == Series.Opex then ExpYear * 10000 + ExpMonth * 100 + ExpThirdFridayDOM + 1
    else ExpYear * 10000 + ExpMonth * 100 + ExpDOM + 1
;

# Option Days to Expiration
def DTE = AbsValue(CountTradingDays(CurrentDate, OptionExpiryDate) - 1);

# Centerstrike
def CenterStrike = 
    if (Mode == Mode.AUTO and !IsNaN(close)) then Round(close / CenterStrikeOffset, 0) * CenterStrikeOffset
    else if (Mode == Mode.MANUAL and !IsNaN(close)) then ManualCenterStrike 
    else CenterStrike[1]
;

# Strike Spacing
def StrikeSpacingC = 
    fold i = 1 to MaxStrikeSpacing 
    with spacing = 0 
    do if !IsNaN(
        open_interest(("." + GetSymbolPart()) + AsPrice(OptionExpiryDate - 20000001) + "P" + AsPrice(CenterStrike + (MaxStrikeSpacing - i)))
    ) 
    then MaxStrikeSpacing - i 
    else if !IsNaN( 
        volume(("." + GetSymbolPart()) + AsPrice(OptionExpiryDate - 20000001) + "P" + AsPrice(CenterStrike + (MaxStrikeSpacing - i)))
    ) 
    then MaxStrikeSpacing - i 
    else spacing
;
def StrikeSpacing =
    if (Mode == Mode.AUTO and !IsNaN(close)) then StrikeSpacingC 
    else if (Mode == Mode.MANUAL and !IsNaN(close)) then ManualStrikeSpacing 
    else StrikeSpacing[1]
;


#-----------------------------------------------------------------------------------------------------------------#
# Option Chain Data Gathering


# Total Put Open Interest for selected chain depth and expiry series
def TotalPutOpenInterest = 
    fold poiIndex = -(StrikeDepth) to (StrikeDepth + 1) 
    with poi = 0
    do 
        if !IsNaN(
            open_interest(("." + GetSymbolPart()) + AsPrice(OptionExpiryDate - 20000001) + "P" + AsPrice(CenterStrike + (StrikeSpacing * poiIndex)))
        ) 
        then poi + open_interest(("." + GetSymbolPart()) + AsPrice(OptionExpiryDate - 20000001) + "P" + AsPrice(CenterStrike + (StrikeSpacing * poiIndex)))
        else poi + 0
;


# Total Call Open Interest for selected chain depth and expiry series
def TotalCallOpenInterest = 
    fold coiIndex = -(StrikeDepth) to (StrikeDepth + 1) 
    with coi = 0
    do 
        if !IsNaN(
            open_interest(("." + GetSymbolPart()) + AsPrice(OptionExpiryDate - 20000001) + "C" + AsPrice(CenterStrike + (StrikeSpacing * coiIndex)))
        )
        then coi + open_interest(("." + GetSymbolPart()) + AsPrice(OptionExpiryDate - 20000001) + "C" + AsPrice(CenterStrike + (StrikeSpacing * coiIndex)))
        else coi + 0
;


# Total Put Volume for selected chain depth and expiry series
def TotalPutVolume = 
    fold pvIndex = -(StrikeDepth) to (StrikeDepth + 1) 
    with pv = 0
    do 
        if !IsNaN(
            volume(("." + GetSymbolPart()) + AsPrice(OptionExpiryDate - 20000001) + "P" + AsPrice(CenterStrike + StrikeSpacing * pvIndex))
        ) 
        then pv + volume(("." + GetSymbolPart()) + AsPrice(OptionExpiryDate - 20000001) + "P" + AsPrice(CenterStrike + StrikeSpacing * pvIndex))
        else pv + 0
;


# Total Call Open Interest for selected chain depth and expiry series
def TotalCallVolume = 
    fold cvIndex = -(StrikeDepth) to (StrikeDepth + 1) 
    with cv = 0
    do 
        if !IsNaN(
            volume(("." + GetSymbolPart()) + AsPrice(OptionExpiryDate - 20000001) + "C" + AsPrice(CenterStrike + StrikeSpacing * cvIndex))
        )
        then cv + volume(("." + GetSymbolPart()) + AsPrice(OptionExpiryDate - 20000001) + "C" + AsPrice(CenterStrike + StrikeSpacing * cvIndex))
        else cv + 0
;


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


# Get the implied volatility for calculations
# Series is the expiry starting at 1 and raising by 1 for each next expiry
def IV = SeriesVolatility(series = OptionSeries);
def K = CenterStrike;
def S = close;
def r = GetInterestRate();
def t = (DTE / 365);
def d1 = (Log(S / K) + ((r + (Sqr(IV) / 2)) * t)) / (IV * Sqrt(t));
def d2 = Exp(-(Sqr(d1) / 2)) / Sqrt(2 * Double.Pi);
script N {
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

# Delta
def Delta = N(d1);

# Gamma
def Gamma = d2 / (S * (IV * Sqrt(t)));

# Theta
def Theta = -(-(S*d2*IV*(.5000)/
             (2*sqrt(t)))-
             (r*(exp(-r*t)*K))*N(d2)+(S*N(d1)*(.5000)))/365;
# (.5000) variant less than .5 e(X/t)

# Vega
def Vega = (S*d2*sqrt(t))/100;

# What method to use for calculating GEX
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

def GEXMethod;
switch (GEXCalculationMethod) {
    case Contribution:
        GEXMethod = 1;
    case ContributionPercent:
        GEXMethod = 2;
    case ContributionShares:
        GEXMethod = 3;
}

# Total Put Gamma Exposure for selected chain depth and expiry series
def TotalPutGammaExposure = 
    fold pgexIndex = -(StrikeDepth) to (StrikeDepth + 1) 
    with pgex = 0
    do 
        if !IsNaN(
            open_interest(("." + GetSymbolPart()) + AsPrice(OptionExpiryDate - 20000001) + "P" + AsPrice(CenterStrike + (StrikeSpacing * pgexIndex)))
        ) 
        then pgex + 
            open_interest(("." + GetSymbolPart()) + AsPrice(OptionExpiryDate - 20000001) + "P" + AsPrice(CenterStrike + (StrikeSpacing * pgexIndex))) *
            if GEXMethod == 1 then 
                OptionPrice((CenterStrike + (StrikeSpacing * pgexIndex)), yes, DTE, close, IV, no, 0.0, r) 
            else if GEXMethod == 2 then
                Sqr(OptionPrice((CenterStrike + (StrikeSpacing * pgexIndex)), yes, DTE, close, IV, no, 0.0, r)) * 0.01
            else
                1
            * (Exp(-(Sqr((Log(close / (CenterStrike + (StrikeSpacing * pgexIndex))) + ((r + (Sqr(IV) / 2)) * t)) / (IV * Sqrt(t))) / 2)) / Sqrt(2 * Double.Pi) / (close * (IV * Sqrt(t)))) *
            100 *
            -1
        else pgex + 0
;

# Total Call Gamma Exposure for selected chain depth and expiry series
def TotalCallGammaExposure = 
    fold cgexIndex = -(StrikeDepth) to (StrikeDepth + 1) 
    with cgex = 0
    do 
        if !IsNaN(
            open_interest(("." + GetSymbolPart()) + AsPrice(OptionExpiryDate - 20000001) + "C" + AsPrice(CenterStrike + (StrikeSpacing * cgexIndex)))
        )
        then cgex + 
            open_interest(("." + GetSymbolPart()) + AsPrice(OptionExpiryDate - 20000001) + "C" + AsPrice(CenterStrike + (StrikeSpacing * cgexIndex))) *
            if GEXMethod == 1 then 
                OptionPrice((CenterStrike + (StrikeSpacing * cgexIndex)), no, DTE, close, IV, no, 0.0, r) 
            else if GEXMethod == 2 then
                Sqr(OptionPrice((CenterStrike + (StrikeSpacing * cgexIndex)), no, DTE, close, IV, no, 0.0, r)) * 0.01
            else
                1
            * (Exp(-(Sqr((Log(close / (CenterStrike + (StrikeSpacing * cgexIndex))) + ((r + (Sqr(IV) / 2)) * t)) / (IV * Sqrt(t))) / 2)) / Sqrt(2 * Double.Pi) / (close * (IV * Sqrt(t)))) *
            100
        else cgex + 0
;


#-----------------------------------------------------------------------------------------------------------------#
# Visuals

# Version Label
AddLabel(yes, "OptionsHacker v" + version, Color.LIGHT_GRAY);

# Selected DataType
AddLabel(yes, DataType, Color.LIGHT_GRAY);

# Selected Series
AddLabel(yes, Series, Color.LIGHT_GRAY);

# Center Strike Label
AddLabel(ShowStrikeInfo, "Center Strike: " + AsDollars(CenterStrike), Color.LIGHT_GRAY);

# Chain Depth Label
AddLabel(ShowStrikeInfo, "Strike Depth: +/-" + StrikeDepth, Color.LIGHT_GRAY);

# Strike Spacing Label
AddLabel(ShowStrikeInfo, "Strike Spacing: " + AsDollars(StrikeSpacing), Color.LIGHT_GRAY);

# Current ATM Options Labels
Addlabel(ShowStrikeInfo, "ATM Put: " + ("." + GetSymbol()) + AsPrice(OptionExpiryDate - 20000001) + "P" + AsPrice(CenterStrike), Color.LIGHT_RED);
Addlabel(ShowStrikeInfo, "ATM Call: " + ("." + GetSymbol()) + AsPrice(OptionExpiryDate - 20000001) + "C" + AsPrice(CenterStrike), Color.LIGHT_GREEN);

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
plot PutOpenInterest = -(TotalPutOpenInterest); # Make negative to flip under axis
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
    GlobalColor("PutCloud"), GlobalColor("CallCloud")
);

# Hull Moving Average of Put Open Interest
plot PutOpenInterestAverage = hullmovingavg(PutOpenInterest);
PutOpenInterestAverage.SetHiding(!ShowAverages or DataType != DataType.OpenInterest);
PutOpenInterestAverage.SetDefaultColor(Color.ORANGE);
PutOpenInterestAverage.SetStyle(Curve.MEDIUM_DASH);

# Hull Moving Average of Call Open Interest
plot CallOpenInterestAverage = hullmovingavg(CallOpenInterest);
CallOpenInterestAverage.SetHiding(!ShowAverages or DataType != DataType.OpenInterest);
CallOpenInterestAverage.SetDefaultColor(Color.LIGHT_GREEN);
CallOpenInterestAverage.SetStyle(Curve.MEDIUM_DASH);

# Call Volume
plot CallVolume = TotalCallVolume;
CallVolume.SetHiding(!ShowLines or DataType != DataType.Volume);
CallVolume.SetPaintingStrategy(PaintingStrategy.LINE);
CallVolume.SetDefaultColor(GlobalColor("Call"));
AddLabel(ShowLabels and DataType == DataType.Volume, "CallVol: " + CallVolume, GlobalColor("Call"));

# Put Volume
plot PutVolume = -(TotalPutVolume); # Make negative to flip under axis
PutVolume.SetHiding(!ShowLines or DataType != DataType.Volume);
PutVolume.SetPaintingStrategy(PaintingStrategy.LINE);
PutVolume.SetDefaultColor(GlobalColor("Put"));
AddLabel(ShowLabels and DataType == DataType.Volume, "PutVol: " + AbsValue(PutVolume), GlobalColor("Put"));

# Create Clouds for Volume
AddCloud(
    if ShowClouds and DataType == DataType.Volume then CallVolume else Double.NaN, 
    if ShowClouds and DataType == DataType.Volume then Zeroline else Double.NaN, 
    GlobalColor("CallCloud"), GlobalColor("PutCloud")
);
AddCloud(
    if ShowClouds and DataType == DataType.Volume then Zeroline else Double.NaN, 
    if ShowClouds and DataType == DataType.Volume then PutVolume else Double.NaN, 
    GlobalColor("PutCloud"), GlobalColor("CallCloud")
);

# Hull Moving Average of Put Volume
plot PutVolumeAverage = hullmovingavg(PutVolume);
PutVolumeAverage.SetHiding(!ShowAverages or DataType != DataType.Volume);
PutVolumeAverage.SetDefaultColor(Color.ORANGE);
PutVolumeAverage.SetStyle(Curve.MEDIUM_DASH);

# Hull Moving Average of Call Volume
plot CallVolumeAverage = hullmovingavg(CallVolume);
CallVolumeAverage.SetHiding(!ShowAverages or DataType != DataType.Volume);
CallVolumeAverage.SetDefaultColor(Color.LIGHT_GREEN);
CallVolumeAverage.SetStyle(Curve.MEDIUM_DASH);

# Greeks Labels
AddLabel(ShowGreeks, "Delta: " + Delta, Color.WHITE);
AddLabel(ShowGreeks, "Gamma: " + Gamma, Color.WHITE);
AddLabel(ShowGreeks, "Theta: " + Theta, Color.WHITE);
AddLabel(ShowGreeks, "Vega: " + Vega, Color.WHITE);

# Gamma Exposure
plot GammaExposure = TotalPutGammaExposure + TotalCallGammaExposure;
GammaExposure.SetHiding(DataType != DataType.GammaExposure);
GammaExposure.SetPaintingStrategy(PaintingStrategy.LINE);
GammaExposure.SetDefaultColor(GlobalColor("GEX"));
