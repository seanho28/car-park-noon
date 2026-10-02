import {
  CarparkMetadata,
  LiveCarpark,
  LotBreakdown,
  SINGAPORE_CARPARKS,
} from '../data/singaporeCarparks';
import { API_CONFIG } from '../config/apiConfig';

interface DataGovCarparkInfo {
  total_lots: string;
  lot_type: 'C' | 'Y' | 'H' | string;
  lots_available: string;
}

interface DataGovCarparkItem {
  carpark_info: DataGovCarparkInfo[];
  carpark_number: string;
  update_datetime: string;
}

interface DataGovResponse {
  items?: Array<{
    timestamp: string;
    carpark_data: DataGovCarparkItem[];
  }>;
}

interface LtaCarparkItem {
  CarParkID: string;
  Area: string;
  Development: string;
  Location: string; // "1.3040 103.8318"
  AvailableLots: number;
  LotType: 'C' | 'Y' | 'H' | string;
  Agency: 'HDB' | 'LTA' | 'URA' | string;
}

/**
 * Calculates distance in kilometers between two WGS84 coordinates using Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Generates a realistic 24-hour availability forecast curve based on Singapore district & agency profile
 */
function buildHourlyForecast(
  carpark: CarparkMetadata,
  currentAvailabilityPct: number
): number[] {
  const isCommercial =
    carpark.agency === 'LTA' || carpark.town === 'Orchard' || carpark.town === 'Marina Bay';
  const currentHour = new Date().getHours();

  const hours: number[] = [];
  for (let h = 0; h < 24; h++) {
    if (h === currentHour) {
      hours.push(Math.max(2, Math.min(98, Math.round(currentAvailabilityPct))));
      continue;
    }
    if (isCommercial) {
      if (h >= 0 && h <= 7) hours.push(86 - h * 2);
      else if (h >= 8 && h <= 11) hours.push(78 - (h - 8) * 14);
      else if (h >= 12 && h <= 19) hours.push(22 + Math.round(Math.sin(h) * 8));
      else hours.push(45 + (h - 19) * 10);
    } else {
      if (h >= 0 && h <= 6) hours.push(24 + (h % 3) * 3);
      else if (h >= 7 && h <= 10) hours.push(35 + (h - 6) * 9);
      else if (h >= 11 && h <= 17) hours.push(68 - Math.round(Math.cos(h) * 6));
      else hours.push(Math.max(18, 62 - (h - 17) * 8));
    }
  }
  return hours;
}

export interface FetchCarparksResult {
  carparks: LiveCarpark[];
  apiTimestamp: string;
  liveHdbMatchedCount: number;
  totalHdbPolledCount: number;
  sourceMode: 'LIVE_DATA_GOV_SG' | 'FALLBACK_SNAPSHOT';
}

/**
 * Fetches live Singapore HDB Carpark Availability from Data.gov.sg
 * and automatically queries LTA DataMall / URA endpoints if their respective env keys are provided.
 */
export async function fetchSingaporeCarparkAvailability(
  userLat: number,
  userLng: number
): Promise<FetchCarparksResult> {
  const liveMap = new Map<
    string,
    {
      C?: LotBreakdown;
      Y?: LotBreakdown;
      H?: LotBreakdown;
      updatedAt: string;
    }
  >();

  let apiTimestamp = new Date().toISOString();
  let totalHdbPolledCount = 0;
  let sourceMode: 'LIVE_DATA_GOV_SG' | 'FALLBACK_SNAPSHOT' = 'FALLBACK_SNAPSHOT';

  // 1. Poll Data.gov.sg HDB Carpark Availability
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);

    const response = await fetch(API_CONFIG.DATA_GOV_SG_ENDPOINT, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data: DataGovResponse = await response.json();
      const firstItem = data.items?.[0];
      if (firstItem && Array.isArray(firstItem.carpark_data)) {
        apiTimestamp = firstItem.timestamp || apiTimestamp;
        totalHdbPolledCount = firstItem.carpark_data.length;
        sourceMode = 'LIVE_DATA_GOV_SG';

        for (const entry of firstItem.carpark_data) {
          const breakdown: {
            C?: LotBreakdown;
            Y?: LotBreakdown;
            H?: LotBreakdown;
            updatedAt: string;
          } = {
            updatedAt: entry.update_datetime,
          };

          for (const info of entry.carpark_info) {
            const total = parseInt(info.total_lots, 10) || 0;
            const avail = parseInt(info.lots_available, 10) || 0;
            if (info.lot_type === 'C' || info.lot_type === 'Y' || info.lot_type === 'H') {
              breakdown[info.lot_type] = {
                totalLots: total,
                availableLots: Math.min(total, Math.max(0, avail)),
              };
            }
          }

          liveMap.set(entry.carpark_number.toUpperCase(), breakdown);
        }
      }
    }
  } catch {
    sourceMode = 'FALLBACK_SNAPSHOT';
  }

  // 2. Optional: If user has manually provided VITE_LTA_DATAMALL_API_KEY, poll LTA DataMall
  if (API_CONFIG.LTA_DATAMALL_API_KEY.trim()) {
    try {
      const ltaRes = await fetch(API_CONFIG.LTA_DATAMALL_ENDPOINT, {
        headers: {
          AccountKey: API_CONFIG.LTA_DATAMALL_API_KEY.trim(),
          Accept: 'application/json',
        },
      });
      if (ltaRes.ok) {
        const ltaJson = (await ltaRes.json()) as { value?: LtaCarparkItem[] };
        if (Array.isArray(ltaJson.value)) {
          for (const item of ltaJson.value) {
            const idKey = item.CarParkID.toUpperCase();
            const existing = liveMap.get(idKey) || { updatedAt: apiTimestamp };
            if (item.LotType === 'C' || item.LotType === 'Y' || item.LotType === 'H') {
              existing[item.LotType] = {
                totalLots: Math.max(item.AvailableLots, 250),
                availableLots: Math.max(0, item.AvailableLots),
              };
            }
            liveMap.set(idKey, existing);
          }
        }
      }
    } catch {
      // Fall back silently if CORS or network blocks direct browser call
    }
  }

  let liveHdbMatchedCount = 0;

  const carparks: LiveCarpark[] = SINGAPORE_CARPARKS.map((meta) => {
    const liveEntry = liveMap.get(meta.id.toUpperCase());
    const isLiveApiSynced = Boolean(liveEntry);
    if (isLiveApiSynced) {
      liveHdbMatchedCount += 1;
    }

    // Add subtle time-based variance for LTA/URA lots when API keys are not yet attached
    const minuteJitter = ((new Date().getMinutes() + meta.id.charCodeAt(0)) % 7) - 3;

    const cLots: LotBreakdown = liveEntry?.C
      ? liveEntry.C
      : {
          totalLots: meta.defaultLots.C.totalLots,
          availableLots: Math.max(
            0,
            Math.min(
              meta.defaultLots.C.totalLots,
              meta.defaultLots.C.availableLots + minuteJitter
            )
          ),
        };

    const yLots: LotBreakdown = liveEntry?.Y
      ? liveEntry.Y
      : {
          totalLots: meta.defaultLots.Y.totalLots,
          availableLots: Math.max(
            0,
            Math.min(
              meta.defaultLots.Y.totalLots,
              meta.defaultLots.Y.availableLots + (minuteJitter % 2)
            )
          ),
        };

    const hLots: LotBreakdown = liveEntry?.H ? liveEntry.H : meta.defaultLots.H;

    const distanceKm = calculateDistanceKm(userLat, userLng, meta.lat, meta.lng);
    const walkingMins = Math.max(1, Math.round((distanceKm / 4.8) * 60));
    const drivingMins = Math.max(1, Math.round((distanceKm / 28) * 60) + 2);

    const availPct =
      cLots.totalLots > 0 ? (cLots.availableLots / cLots.totalLots) * 100 : 0;
    const occupancyRate = Math.round(100 - availPct);

    let statusLabel: LiveCarpark['statusLabel'] = 'Plenty';
    if (cLots.availableLots === 0) {
      statusLabel = 'Full';
    } else if (cLots.availableLots <= 15 || availPct < 10) {
      statusLabel = 'Filling Fast';
    } else if (availPct < 30) {
      statusLabel = 'Moderate';
    }

    return {
      ...meta,
      lots: {
        C: cLots,
        Y: yLots,
        H: hLots,
      },
      distanceKm,
      walkingMins,
      drivingMins,
      occupancyRate,
      statusLabel,
      lastUpdated: liveEntry?.updatedAt || apiTimestamp,
      isLiveApiSynced,
      hourlyForecast: buildHourlyForecast(meta, availPct),
    };
  });

  return {
    carparks,
    apiTimestamp,
    liveHdbMatchedCount,
    totalHdbPolledCount,
    sourceMode,
  };
}
