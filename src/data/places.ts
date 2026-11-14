/*
 * Slope and Signal - preset places by region type (the challenge suggests
 * deserts, rain forests, tidal estuaries and the air above big cities).
 * Written with Claude (Anthropic) under the team's direction.
 */
export interface Place {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  hint: string;
}

export const PLACES: Place[] = [
  { id: 'sahara', name: 'Central Sahara, Algeria', type: 'Desert', lat: 23.0, lon: 5.5, hint: 'Hot desert: try air temperature and the hottest hour.' },
  { id: 'phoenix', name: 'Phoenix, USA', type: 'Desert city', lat: 33.45, lon: -112.07, hint: 'A desert city that grew fast: heat at night.' },
  { id: 'amazon', name: 'Central Amazon near Manaus, Brazil', type: 'Rain forest', lat: -3.1, lon: -60.0, hint: 'Rain forest: try rain, soil wetness and temperature.' },
  { id: 'congo', name: 'Congo Basin, DR Congo', type: 'Rain forest', lat: 0.5, lon: 23.5, hint: 'The second-largest rain forest.' },
  { id: 'ganges', name: 'Ganges-Brahmaputra delta, Bangladesh', type: 'Tidal estuary', lat: 22.3, lon: 90.0, hint: 'A huge tidal delta: humidity and rain.' },
  { id: 'chesapeake', name: 'Chesapeake Bay, USA', type: 'Tidal estuary', lat: 38.0, lon: -76.3, hint: 'The largest estuary in the USA.' },
  { id: 'seoul', name: 'Seoul, South Korea', type: 'Big city', lat: 37.57, lon: 126.98, hint: 'A megacity: temperature, sunshine and haze.' },
  { id: 'delhi', name: 'Delhi, India', type: 'Big city', lat: 28.61, lon: 77.21, hint: 'Air above a big city: sunshine reaching the ground.' },
  { id: 'lagos', name: 'Lagos, Nigeria', type: 'Big city', lat: 6.52, lon: 3.38, hint: 'A fast-growing coastal megacity.' },
  { id: 'svalbard', name: 'Svalbard, Norway', type: 'Polar', lat: 78.22, lon: 15.65, hint: 'High Arctic: one of the fastest-warming places.' },
  { id: 'antarctic', name: 'Antarctic Peninsula', type: 'Polar', lat: -64.8, lon: -64.0, hint: 'The tip of Antarctica.' },
  { id: 'ross', name: 'Ross Sea, off Antarctica', type: 'Polar', lat: -70.0, lon: -150.0, hint: 'Southern Ocean with winter sea ice, far from the Arctic.' },
  { id: 'tibet', name: 'Tibetan Plateau, China', type: 'Mountains', lat: 32.0, lon: 90.0, hint: 'The "roof of the world": snow and frost.' },
  { id: 'alps', name: 'Swiss Alps', type: 'Mountains', lat: 46.5, lon: 8.0, hint: 'Snow depth and frost days.' },
  { id: 'chile', name: 'Central Chile near Santiago', type: 'Mediterranean climate', lat: -33.5, lon: -71.0, hint: 'Mediterranean climate between the Andes and the Pacific.' },
  { id: 'sahel', name: 'Sahel near Niamey, Niger', type: 'Dry grassland', lat: 13.5, lon: 2.1, hint: 'The edge of the Sahara: rain came back after the 1980s droughts.' },
  { id: 'natl', name: 'North Atlantic south of Greenland', type: 'Ocean', lat: 55.0, lon: -35.0, hint: 'Open ocean: try the surface temperature.' },
  { id: 'aral', name: 'Aral Sea, Kazakhstan/Uzbekistan', type: 'Drying lake', lat: 45.0, lon: 59.5, hint: 'A lake that mostly disappeared.' },
];

export interface Suggestion {
  v: string;
  why: string;
}

/**
 * Rule-based suggestions (no AI model): which variables are worth
 * investigating for a type of place, and why.
 */
export const SUGGEST: Record<string, Suggestion[]> = {
  Desert: [
    { v: 'T2M_MAX', why: 'deserts are where heat extremes are most intense' },
    { v: 'PRECTOTCORR', why: 'rare rain: small changes matter a lot' },
    { v: 'ALLSKY_SFC_SW_DWN', why: 'dust and cloud change how much sunshine arrives' },
  ],
  'Desert city': [
    { v: 'T2M_MIN', why: 'cities keep heat at night (urban heat island)' },
    { v: 'T2M_MAX', why: 'daytime heat extremes' },
    { v: 'RH2M', why: 'irrigation and growth can change humidity' },
  ],
  'Rain forest': [
    { v: 'PRECTOTCORR', why: 'the forest depends on steady rain' },
    { v: 'GWETROOT', why: 'drought shows up first in the root zone' },
    { v: 'T2M', why: 'forest loss and warming both heat the air' },
  ],
  'Tidal estuary': [
    { v: 'TS', why: 'the surface temperature of the water and mud flats' },
    { v: 'PRECTOTCORR', why: 'river and rain water feed the estuary' },
    { v: 'QV2M', why: 'warm, wet air: humidity and heat stress' },
  ],
  'Big city': [
    { v: 'T2M_MIN', why: 'cities keep heat at night (urban heat island)' },
    { v: 'ALLSKY_SFC_SW_DWN', why: 'haze and smog above a big city dim the sunshine' },
    { v: 'RH2M', why: 'paved surfaces evaporate less water' },
  ],
  Polar: [
    { v: 'T2M', why: 'polar regions are warming fastest in many places' },
    { v: 'SNODP', why: 'snow responds directly to warming and snowfall' },
    { v: 'FROST_DAYS', why: 'a simple count that tracks the cold season' },
  ],
  Mountains: [
    { v: 'SNODP', why: 'mountain snow is a water store for the valleys below' },
    { v: 'FROST_DAYS', why: 'fewer frost days mean a shorter cold season' },
    { v: 'T2M', why: 'high places can warm faster than lowlands' },
  ],
  'Dry grassland': [
    { v: 'PRECTOTCORR', why: 'droughts and their recovery' },
    { v: 'GWETROOT', why: 'how much water plants can reach' },
    { v: 'EVLAND', why: 'more water and more plants mean more evaporation' },
  ],
  'Mediterranean climate': [
    { v: 'PRECTOTCORR', why: 'winter rain is the whole water supply: droughts matter' },
    { v: 'GWETROOT', why: 'how dry the soil gets in long droughts' },
    { v: 'T2M_MAX', why: 'hot, dry summers and heat waves' },
  ],
  Ocean: [
    { v: 'TS', why: 'over the ocean this is the sea surface temperature' },
    { v: 'T2M', why: 'air temperature just above the sea' },
    { v: 'WS10M', why: 'changes in storm tracks show up in the wind' },
  ],
  'Drying lake': [
    { v: 'T2M_MAX', why: 'without the lake, summers get hotter' },
    { v: 'RH2M', why: 'less water surface, drier air' },
    { v: 'EVLAND', why: 'less water left to evaporate' },
  ],
};

/** Suggestions for any point, by rule: a preset's type, or latitude band. */
export function suggestFor(lat: number, type?: string): { label: string; list: Suggestion[] } {
  if (type && SUGGEST[type]) return { label: type.toLowerCase(), list: SUGGEST[type] };
  const a = Math.abs(lat);
  if (a >= 60) return { label: 'high-latitude place', list: SUGGEST.Polar };
  if (a <= 15) return { label: 'tropical place', list: [SUGGEST['Rain forest'][0], SUGGEST['Rain forest'][2], { v: 'QV2M', why: 'tropical air holds a lot of water vapour' }] };
  return {
    label: 'mid-latitude place',
    list: [
      { v: 'T2M', why: 'the most common first clue of change' },
      { v: 'FROST_DAYS', why: 'a simple count that tracks the cold season' },
      { v: 'PRECTOTCORR', why: 'some regions get wetter, others drier' },
    ],
  };
}
