// London postcode districts ("outward codes"), grouped by area.
// Source: Royal Mail / Wikipedia list of London postal districts.
// We use district-level (not sector-level) granularity — one row per
// outward code — which maps naturally to how Outscraper queries are run
// (e.g. "restaurants in N1 London").

export interface LondonPostcodeDistrict {
  district: string; // "E1", "SW1A", etc.
  area: string; // "E", "EC", "N", "NW", "SE", "SW", "W", "WC"
  name: string; // Rough locality for quick recognition
}

// Only the London postal town. Excludes suburban outer-M25 districts
// (BR/CR/DA/EN/HA/IG/KT/RM/SM/TW/UB) — can be added later if needed.
export const LONDON_POSTCODE_DISTRICTS: LondonPostcodeDistrict[] = [
  // East London
  { district: "E1", area: "E", name: "Whitechapel / Stepney" },
  { district: "E1W", area: "E", name: "Wapping" },
  { district: "E2", area: "E", name: "Bethnal Green" },
  { district: "E3", area: "E", name: "Bow / Bromley-by-Bow" },
  { district: "E4", area: "E", name: "Chingford" },
  { district: "E5", area: "E", name: "Clapton" },
  { district: "E6", area: "E", name: "East Ham / Beckton" },
  { district: "E7", area: "E", name: "Forest Gate" },
  { district: "E8", area: "E", name: "Hackney / Dalston" },
  { district: "E9", area: "E", name: "Homerton / South Hackney" },
  { district: "E10", area: "E", name: "Leyton" },
  { district: "E11", area: "E", name: "Leytonstone" },
  { district: "E12", area: "E", name: "Manor Park" },
  { district: "E13", area: "E", name: "Plaistow" },
  { district: "E14", area: "E", name: "Poplar / Isle of Dogs" },
  { district: "E15", area: "E", name: "Stratford / West Ham" },
  { district: "E16", area: "E", name: "Canning Town / Royal Docks" },
  { district: "E17", area: "E", name: "Walthamstow" },
  { district: "E18", area: "E", name: "South Woodford" },
  { district: "E20", area: "E", name: "Olympic Park / Stratford" },

  // East Central
  { district: "EC1", area: "EC", name: "Clerkenwell / Barbican" },
  { district: "EC2", area: "EC", name: "Moorgate / Liverpool St" },
  { district: "EC3", area: "EC", name: "Aldgate / Tower" },
  { district: "EC4", area: "EC", name: "Fleet Street / Blackfriars" },

  // North
  { district: "N1", area: "N", name: "Islington" },
  { district: "N1C", area: "N", name: "Kings Cross" },
  { district: "N2", area: "N", name: "East Finchley" },
  { district: "N3", area: "N", name: "Finchley Central" },
  { district: "N4", area: "N", name: "Finsbury Park" },
  { district: "N5", area: "N", name: "Highbury" },
  { district: "N6", area: "N", name: "Highgate" },
  { district: "N7", area: "N", name: "Holloway" },
  { district: "N8", area: "N", name: "Hornsey / Crouch End" },
  { district: "N9", area: "N", name: "Lower Edmonton" },
  { district: "N10", area: "N", name: "Muswell Hill" },
  { district: "N11", area: "N", name: "Friern Barnet" },
  { district: "N12", area: "N", name: "North Finchley" },
  { district: "N13", area: "N", name: "Palmers Green" },
  { district: "N14", area: "N", name: "Southgate" },
  { district: "N15", area: "N", name: "South Tottenham" },
  { district: "N16", area: "N", name: "Stoke Newington" },
  { district: "N17", area: "N", name: "Tottenham" },
  { district: "N18", area: "N", name: "Upper Edmonton" },
  { district: "N19", area: "N", name: "Upper Holloway / Archway" },
  { district: "N20", area: "N", name: "Whetstone / Totteridge" },
  { district: "N21", area: "N", name: "Winchmore Hill" },
  { district: "N22", area: "N", name: "Wood Green" },

  // North West
  { district: "NW1", area: "NW", name: "Camden / Regent's Park" },
  { district: "NW2", area: "NW", name: "Cricklewood" },
  { district: "NW3", area: "NW", name: "Hampstead" },
  { district: "NW4", area: "NW", name: "Hendon" },
  { district: "NW5", area: "NW", name: "Kentish Town" },
  { district: "NW6", area: "NW", name: "Kilburn / West Hampstead" },
  { district: "NW7", area: "NW", name: "Mill Hill" },
  { district: "NW8", area: "NW", name: "St John's Wood" },
  { district: "NW9", area: "NW", name: "The Hyde / Colindale" },
  { district: "NW10", area: "NW", name: "Willesden / Harlesden" },
  { district: "NW11", area: "NW", name: "Golders Green" },

  // South East
  { district: "SE1", area: "SE", name: "Southwark / Waterloo / Borough" },
  { district: "SE2", area: "SE", name: "Abbey Wood" },
  { district: "SE3", area: "SE", name: "Blackheath" },
  { district: "SE4", area: "SE", name: "Brockley" },
  { district: "SE5", area: "SE", name: "Camberwell" },
  { district: "SE6", area: "SE", name: "Catford / Bellingham" },
  { district: "SE7", area: "SE", name: "Charlton" },
  { district: "SE8", area: "SE", name: "Deptford" },
  { district: "SE9", area: "SE", name: "Eltham / Mottingham" },
  { district: "SE10", area: "SE", name: "Greenwich" },
  { district: "SE11", area: "SE", name: "Lambeth / Kennington" },
  { district: "SE12", area: "SE", name: "Lee / Grove Park" },
  { district: "SE13", area: "SE", name: "Lewisham / Hither Green" },
  { district: "SE14", area: "SE", name: "New Cross" },
  { district: "SE15", area: "SE", name: "Peckham / Nunhead" },
  { district: "SE16", area: "SE", name: "Rotherhithe / Bermondsey" },
  { district: "SE17", area: "SE", name: "Walworth / Elephant & Castle" },
  { district: "SE18", area: "SE", name: "Woolwich / Plumstead" },
  { district: "SE19", area: "SE", name: "Upper Norwood / Crystal Palace" },
  { district: "SE20", area: "SE", name: "Penge / Anerley" },
  { district: "SE21", area: "SE", name: "Dulwich" },
  { district: "SE22", area: "SE", name: "East Dulwich" },
  { district: "SE23", area: "SE", name: "Forest Hill" },
  { district: "SE24", area: "SE", name: "Herne Hill" },
  { district: "SE25", area: "SE", name: "South Norwood" },
  { district: "SE26", area: "SE", name: "Sydenham" },
  { district: "SE27", area: "SE", name: "West Norwood" },
  { district: "SE28", area: "SE", name: "Thamesmead" },

  // South West
  { district: "SW1", area: "SW", name: "Westminster / Belgravia / Pimlico" },
  { district: "SW2", area: "SW", name: "Brixton / Streatham Hill" },
  { district: "SW3", area: "SW", name: "Chelsea" },
  { district: "SW4", area: "SW", name: "Clapham" },
  { district: "SW5", area: "SW", name: "Earl's Court" },
  { district: "SW6", area: "SW", name: "Fulham / Parsons Green" },
  { district: "SW7", area: "SW", name: "South Kensington" },
  { district: "SW8", area: "SW", name: "South Lambeth / Nine Elms" },
  { district: "SW9", area: "SW", name: "Stockwell / Brixton" },
  { district: "SW10", area: "SW", name: "West Brompton / World's End" },
  { district: "SW11", area: "SW", name: "Battersea / Clapham Junction" },
  { district: "SW12", area: "SW", name: "Balham" },
  { district: "SW13", area: "SW", name: "Barnes / Castelnau" },
  { district: "SW14", area: "SW", name: "Mortlake / East Sheen" },
  { district: "SW15", area: "SW", name: "Putney / Roehampton" },
  { district: "SW16", area: "SW", name: "Streatham / Norbury" },
  { district: "SW17", area: "SW", name: "Tooting" },
  { district: "SW18", area: "SW", name: "Wandsworth / Earlsfield" },
  { district: "SW19", area: "SW", name: "Wimbledon / Colliers Wood" },
  { district: "SW20", area: "SW", name: "Raynes Park / South Wimbledon" },

  // West
  { district: "W1", area: "W", name: "West End / Mayfair / Soho / Marylebone" },
  { district: "W2", area: "W", name: "Paddington / Bayswater" },
  { district: "W3", area: "W", name: "Acton" },
  { district: "W4", area: "W", name: "Chiswick" },
  { district: "W5", area: "W", name: "Ealing" },
  { district: "W6", area: "W", name: "Hammersmith" },
  { district: "W7", area: "W", name: "Hanwell" },
  { district: "W8", area: "W", name: "Kensington" },
  { district: "W9", area: "W", name: "Maida Vale" },
  { district: "W10", area: "W", name: "North Kensington / Ladbroke Grove" },
  { district: "W11", area: "W", name: "Notting Hill / Holland Park" },
  { district: "W12", area: "W", name: "Shepherd's Bush" },
  { district: "W13", area: "W", name: "West Ealing" },
  { district: "W14", area: "W", name: "West Kensington / Olympia" },

  // West Central
  { district: "WC1", area: "WC", name: "Bloomsbury / Holborn" },
  { district: "WC2", area: "WC", name: "Covent Garden / Strand" },
];

/**
 * Get the postal district ("outward code") for a postcode.
 * "SW1A 1AA" → "SW1A", "E1 6AN" → "E1".
 * Returns null if the input is empty or not parseable.
 */
export function outwardCode(postcode: string | null | undefined): string | null {
  if (!postcode) return null;
  const trimmed = postcode.trim().toUpperCase();
  if (!trimmed) return null;
  const spaceIdx = trimmed.indexOf(" ");
  const outward = spaceIdx >= 0 ? trimmed.slice(0, spaceIdx) : trimmed;
  return outward || null;
}

/**
 * Check whether a string mentions a given London district as a
 * whole-token match (so "N1" doesn't match inside "N10"). Matches both
 * "N1" and "N1 London" / "London N1" etc. Case-insensitive.
 */
export function mentionsDistrict(haystack: string, district: string): boolean {
  if (!haystack) return false;
  // \b doesn't work between adjacent digits/letters, so build our own
  // token boundary: the district must be preceded/followed by a non-
  // alphanumeric character (or start/end of string).
  const escaped = district.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^A-Z0-9])${escaped}($|[^A-Z0-9])`, "i");
  return re.test(haystack);
}
