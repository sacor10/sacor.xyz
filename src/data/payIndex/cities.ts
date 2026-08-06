// The Pay Index fixed city basket — 25 U.S. metros, geographically spread
// across all four Census-style regions used only as a display grouping.
//
// Same rule as jobs.ts: changes only via a dated changelog.ts entry plus a
// BASKET_VERSION bump — see basket.ts.

import type { City } from './types'
import { BASKET_VERSION, BASKET_EFFECTIVE_DATE } from './basket'

function city(id: string, name: string, stateAbbr: string, region: City['region'], adzunaLocation: string): City {
  return {
    id,
    name,
    region,
    stateAbbr,
    adzunaLocation,
    addedAt: BASKET_EFFECTIVE_DATE,
    active: true,
    basketVersion: BASKET_VERSION,
  }
}

export const cities: City[] = [
  city('new-york-ny', 'New York', 'NY', 'Northeast', 'New York'),
  city('los-angeles-ca', 'Los Angeles', 'CA', 'West', 'Los Angeles'),
  city('chicago-il', 'Chicago', 'IL', 'Midwest', 'Chicago'),
  city('houston-tx', 'Houston', 'TX', 'South', 'Houston'),
  city('phoenix-az', 'Phoenix', 'AZ', 'West', 'Phoenix'),
  city('philadelphia-pa', 'Philadelphia', 'PA', 'Northeast', 'Philadelphia'),
  city('san-antonio-tx', 'San Antonio', 'TX', 'South', 'San Antonio'),
  city('san-diego-ca', 'San Diego', 'CA', 'West', 'San Diego'),
  city('dallas-tx', 'Dallas', 'TX', 'South', 'Dallas'),
  city('austin-tx', 'Austin', 'TX', 'South', 'Austin'),
  city('jacksonville-fl', 'Jacksonville', 'FL', 'South', 'Jacksonville'),
  city('san-francisco-ca', 'San Francisco', 'CA', 'West', 'San Francisco'),
  city('columbus-oh', 'Columbus', 'OH', 'Midwest', 'Columbus'),
  city('charlotte-nc', 'Charlotte', 'NC', 'South', 'Charlotte'),
  city('indianapolis-in', 'Indianapolis', 'IN', 'Midwest', 'Indianapolis'),
  city('seattle-wa', 'Seattle', 'WA', 'West', 'Seattle'),
  city('denver-co', 'Denver', 'CO', 'West', 'Denver'),
  city('boston-ma', 'Boston', 'MA', 'Northeast', 'Boston'),
  city('nashville-tn', 'Nashville', 'TN', 'South', 'Nashville'),
  city('detroit-mi', 'Detroit', 'MI', 'Midwest', 'Detroit'),
  city('portland-or', 'Portland', 'OR', 'West', 'Portland'),
  city('atlanta-ga', 'Atlanta', 'GA', 'South', 'Atlanta'),
  city('miami-fl', 'Miami', 'FL', 'South', 'Miami'),
  city('minneapolis-mn', 'Minneapolis', 'MN', 'Midwest', 'Minneapolis'),
  city('pittsburgh-pa', 'Pittsburgh', 'PA', 'Northeast', 'Pittsburgh'),
]
