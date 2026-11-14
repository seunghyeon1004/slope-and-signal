/*
 * Slope and Signal - catalogue of NASA POWER variables.
 * Written with Claude (Anthropic) under the team's direction.
 *
 * Every parameter, unit and first year below was checked against the live
 * POWER monthly API (v2.10.0) and its parameter dictionary on 2026-11-14:
 * https://power.larc.nasa.gov/api/system/manager/parameters?community=AG&temporal=monthly
 * Sources: POWER meteorology comes from the MERRA-2 reanalysis (NASA GMAO);
 * surface radiation and cloud amount come from GEWEX SRB (1984-2000) and
 * CERES SYN1deg (2001 onward), processed by NASA LaRC POWER.
 */
import type { Agg } from './series';

export type Group = 'Temperature' | 'Water' | 'Snow and ice' | 'Air and sky' | 'Sunlight';

export interface Variable {
  id: string;
  name: string;
  group: Group;
  units: string;
  /** plain one-sentence definition for a high-school student */
  plain: string;
  /** official POWER definition */
  official: string;
  source: string;
  firstYear: number;
  /** suggested first year (radiation: 2001, the start of CERES, to avoid the SRB/CERES splice) */
  defaultStart?: number;
  /** how 12 months combine into a season/year value */
  agg: Agg;
  /** label for the yearly value */
  yearlyLabel: string;
  /** "up" means an increase is drawn warm (red); otherwise blue */
  upIsWarm: boolean;
  /** decimals to show */
  dp: number;
  /** only meaningful over land */
  landOnly?: boolean;
  /** why a detective might care: processes that drive it */
  clue: string;
}

const MERRA2 = 'MERRA-2 reanalysis (NASA GMAO), via NASA POWER';
const RAD = 'GEWEX SRB (1984-2000) and CERES SYN1deg (2001 on), via NASA POWER';

export const CATALOGUE: Variable[] = [
  {
    id: 'T2M', name: 'Air temperature', group: 'Temperature', units: '°C', agg: 'mean', yearlyLabel: 'average', upIsWarm: true, dp: 2,
    plain: 'How warm the air is, 2 metres above the ground (about head height), averaged over day and night.',
    official: 'The average air (dry bulb) temperature at 2 meters above the surface of the earth.',
    source: MERRA2, firstYear: 1981,
    clue: 'Rises with more greenhouse gases; can fall locally with more cloud, irrigation or air pollution haze.',
  },
  {
    id: 'T2M_MAX', name: 'Hottest hour', group: 'Temperature', units: '°C', agg: 'max', yearlyLabel: 'highest of the period', upIsWarm: true, dp: 2,
    plain: 'The highest hourly air temperature reached in the month. For a season or year we take the highest month.',
    official: 'The maximum hourly air (dry bulb) temperature at 2 meters above the surface of the earth in the period of interest.',
    source: MERRA2, firstYear: 1981,
    clue: 'Heat extremes; often rises faster than the average where soils dry out.',
  },
  {
    id: 'T2M_MIN', name: 'Coldest hour', group: 'Temperature', units: '°C', agg: 'min', yearlyLabel: 'lowest of the period', upIsWarm: true, dp: 2,
    plain: 'The lowest hourly air temperature reached in the month. For a season or year we take the lowest month.',
    official: 'The minimum hourly air (dry bulb) temperature at 2 meters above the surface of the earth in the period of interest.',
    source: MERRA2, firstYear: 1981,
    clue: 'Cold extremes; nights and winters often warm faster than days and summers.',
  },
  {
    id: 'TS', name: 'Ground (skin) temperature', group: 'Temperature', units: '°C', agg: 'mean', yearlyLabel: 'average', upIsWarm: true, dp: 2,
    plain: 'The temperature of the very surface of the Earth: the ground, the sea surface or the top of the snow.',
    official: "The average temperature at the earth's surface.",
    source: MERRA2, firstYear: 1981,
    clue: 'Over the ocean this follows sea surface temperature; over cities it shows the urban heat island.',
  },
  {
    id: 'FROST_DAYS', name: 'Frost days', group: 'Temperature', units: 'days', agg: 'sum', yearlyLabel: 'total', upIsWarm: false, dp: 1,
    plain: 'Number of days with frost: the air at 2 m is below 0 °C and has cooled to its dew point.',
    official: 'A frost day occurs when the 2m temperature cools to the dew point temperature and both are less than 0 C or 32 F.',
    source: 'Derived by NASA POWER from MERRA-2', firstYear: 1981,
    clue: 'Fewer frost days is one of the clearest signs of warming in cold climates.',
  },
  {
    id: 'PRECTOTCORR', name: 'Rain and snowfall', group: 'Water', units: 'mm/day', agg: 'mean', yearlyLabel: 'average', upIsWarm: false, dp: 2,
    plain: 'How much water falls from the sky as rain or snow, as millimetres per day. 1 mm/day is about 365 mm per year.',
    official: 'The average MERRA-2 bias corrected total precipitation at the surface of the earth.',
    source: 'MERRA-2 bias-corrected precipitation, via NASA POWER', firstYear: 1981,
    clue: 'A warmer world can make wet places wetter and dry places drier: opposite trends from the same cause.',
  },
  {
    id: 'EVLAND', name: 'Evaporation from land', group: 'Water', units: 'mm/day', agg: 'mean', yearlyLabel: 'average', upIsWarm: false, dp: 2, landOnly: true,
    plain: 'Water going back to the air from soil, lakes and plants, as millimetres per day.',
    official: 'The evaporation over land at the surface of the earth.',
    source: MERRA2, firstYear: 1981,
    clue: 'Needs both energy (sunshine, heat) and water; drops when soils dry out.',
  },
  {
    id: 'GWETTOP', name: 'Topsoil wetness', group: 'Water', units: '0 to 1', agg: 'mean', yearlyLabel: 'average', upIsWarm: false, dp: 3, landOnly: true,
    plain: 'How wet the top 5 cm of soil is: 0 is completely dry, 1 is completely soaked.',
    official: 'The amount of water and water vapor present in the soil. Top indicates the upper 5 cm of soil. Values range from 0 for completely dry conditions to 1 for completely saturated soil.',
    source: MERRA2, firstYear: 1981,
    clue: 'Reacts within days to rain and heat; drying here hints at drought risk.',
  },
  {
    id: 'GWETROOT', name: 'Root-zone soil wetness', group: 'Water', units: '0 to 1', agg: 'mean', yearlyLabel: 'average', upIsWarm: false, dp: 3, landOnly: true,
    plain: 'How wet the soil is where plant roots live (about the top 1 m): 0 is dry, 1 is soaked.',
    official: 'The amount of water and water vapor available to plants in the root zone, generally considered to be the upper 1 m of soil, expressed as the proportion of water present in a given amount of soil.',
    source: MERRA2, firstYear: 1981,
    clue: 'Slow memory of the water balance: rain minus evaporation over months.',
  },
  {
    id: 'RH2M', name: 'Relative humidity', group: 'Water', units: '%', agg: 'mean', yearlyLabel: 'average', upIsWarm: false, dp: 1,
    plain: 'How close the air is to being saturated with water vapour, in percent. 100% means the air cannot hold more.',
    official: 'The ratio of vapor pressure to the saturation vapor pressure with respect to a plane surface of pure water, expressed in percent.',
    source: MERRA2, firstYear: 1981,
    clue: 'Over land it often falls as temperature rises faster than moisture supply.',
  },
  {
    id: 'QV2M', name: 'Water vapour in the air', group: 'Water', units: 'g/kg', agg: 'mean', yearlyLabel: 'average', upIsWarm: false, dp: 2,
    plain: 'Grams of water vapour in each kilogram of air near the ground.',
    official: 'The ratio of the mass of water vapor to the total mass of air at 2 meters.',
    source: MERRA2, firstYear: 1981,
    clue: 'Warm air can hold about 7% more water vapour per °C, so this tends to rise with warming.',
  },
  {
    id: 'SNODP', name: 'Snow depth', group: 'Snow and ice', units: 'cm', agg: 'mean', yearlyLabel: 'average', upIsWarm: false, dp: 1, landOnly: true,
    plain: 'How deep the snow on the ground is, in centimetres.',
    official: 'The snow depth on land at surface of the earth.',
    source: MERRA2, firstYear: 1981,
    clue: 'Shrinks with warming, but can grow where snowfall increases.',
  },
  {
    id: 'CLOUD_AMT', name: 'Cloud cover', group: 'Air and sky', units: '%', agg: 'mean', yearlyLabel: 'average', upIsWarm: false, dp: 1,
    plain: 'The share of the sky covered by cloud, in percent.',
    official: 'The average percent of cloud amount during the temporal period.',
    source: RAD, firstYear: 1984, defaultStart: 2001,
    clue: 'Clouds shade the ground by day and keep it warm at night.',
  },
  {
    id: 'WS10M', name: 'Wind speed', group: 'Air and sky', units: 'm/s', agg: 'mean', yearlyLabel: 'average', upIsWarm: true, dp: 2,
    plain: 'How fast the wind blows 10 metres above the ground, in metres per second.',
    official: 'The average of wind speed at 10 meters above the surface of the earth.',
    source: MERRA2, firstYear: 1981,
    clue: 'Shifts in storm tracks and monsoons change wind; matters for wind power.',
  },
  {
    id: 'PS', name: 'Surface air pressure', group: 'Air and sky', units: 'kPa', agg: 'mean', yearlyLabel: 'average', upIsWarm: true, dp: 3,
    plain: 'The weight of the air above a place, in kilopascals. High pressure usually means calm, dry weather.',
    official: 'The atmospheric pressure at the surface of the earth.',
    source: MERRA2, firstYear: 1981,
    clue: 'Mostly steady; small trends show shifts in where high and low pressure systems sit.',
  },
  {
    id: 'ALLSKY_SFC_SW_DWN', name: 'Sunshine reaching the ground', group: 'Sunlight', units: 'MJ/m²/day', agg: 'mean', yearlyLabel: 'average', upIsWarm: true, dp: 2,
    plain: 'Solar energy arriving on flat ground per day, after clouds and haze have taken their share.',
    official: 'The total solar irradiance incident (direct plus diffuse) on a horizontal plane at the surface of the earth under all sky conditions.',
    source: RAD, firstYear: 1984, defaultStart: 2001,
    clue: 'Rises when skies clear (less cloud or cleaner air: "brightening"), falls with more cloud or smog ("dimming").',
  },
  {
    id: 'ALLSKY_SFC_LW_DWN', name: 'Heat radiation from the sky', group: 'Sunlight', units: 'MJ/m²/day', agg: 'mean', yearlyLabel: 'average', upIsWarm: true, dp: 2,
    plain: 'Invisible infrared (heat) energy sent down to the ground by the air, water vapour and clouds above.',
    official: 'The downward thermal infrared irradiance under all sky conditions reaching a horizontal plane at the surface of the earth.',
    source: RAD, firstYear: 1984, defaultStart: 2001,
    clue: 'This is the greenhouse effect you can measure: more vapour and greenhouse gas, more heat from the sky.',
  },
  {
    id: 'T2MDEW', name: 'Dew point', group: 'Water', units: '°C', agg: 'mean', yearlyLabel: 'average', upIsWarm: false, dp: 2,
    plain: 'The temperature at which the air would become saturated and dew would form. Higher means muggier air.',
    official: 'The dew/frost point temperature at 2 meters above the surface of the earth.',
    source: MERRA2, firstYear: 1981,
    clue: 'A direct measure of moisture; together with temperature it sets heat stress.',
  },
];

export const LAST_YEAR = 2025;
export const POWER_FIRST_YEAR = 1981;

export function variable(id: string): Variable {
  const v = CATALOGUE.find((x) => x.id === id);
  if (!v) throw new Error(`unknown variable ${id}`);
  return v;
}

export const ALL_IDS = CATALOGUE.map((v) => v.id);
