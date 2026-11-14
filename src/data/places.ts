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
  { id: 'tibet', name: 'Tibetan Plateau, China', type: 'Mountains', lat: 32.0, lon: 90.0, hint: 'The "roof of the world": snow and frost.' },
  { id: 'alps', name: 'Swiss Alps', type: 'Mountains', lat: 46.5, lon: 8.0, hint: 'Snow depth and frost days.' },
  { id: 'sahel', name: 'Sahel near Niamey, Niger', type: 'Dry grassland', lat: 13.5, lon: 2.1, hint: 'The edge of the Sahara: rain came back after the 1980s droughts.' },
  { id: 'natl', name: 'North Atlantic south of Greenland', type: 'Ocean', lat: 55.0, lon: -35.0, hint: 'Open ocean: try the surface temperature.' },
  { id: 'aral', name: 'Aral Sea, Kazakhstan/Uzbekistan', type: 'Drying lake', lat: 45.0, lon: 59.5, hint: 'A lake that mostly disappeared.' },
];
