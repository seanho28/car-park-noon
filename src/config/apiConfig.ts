/**
 * Centralized Environment Configuration for Singapore Carpark APIs.
 *
 * IMPORTANT: Do NOT hardcode any API keys in this file or anywhere in the source code.
 * All keys are read strictly from environment variables (`.env` or Secrets panel)
 * which you can populate manually whenever ready.
 */

export const API_CONFIG = {
  // 1. Data.gov.sg HDB Carpark Availability (Public Open API - No key required, optional X-Api-Key header if using v2)
  DATA_GOV_SG_ENDPOINT: 'https://api.data.gov.sg/v1/transport/carpark-availability',

  // 2. LTA DataMall Carpark Availability v2 (Requires AccountKey header)
  // Populate VITE_LTA_DATAMALL_API_KEY in your .env file
  LTA_DATAMALL_ENDPOINT:
    'https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2',
  LTA_DATAMALL_API_KEY: import.meta.env.VITE_LTA_DATAMALL_API_KEY || '',

  // 3. URA Space Car Park Available Lots (Requires AccessKey & Token headers)
  // Populate VITE_URA_ACCESS_KEY and VITE_URA_TOKEN in your .env file
  URA_CARPARK_ENDPOINT:
    'https://www.ura.gov.sg/uraDataService/invokeUraDS?service=Car_Park_Availability',
  URA_ACCESS_KEY: import.meta.env.VITE_URA_ACCESS_KEY || '',
  URA_TOKEN: import.meta.env.VITE_URA_TOKEN || '',
} as const;

export function getConfiguredAdaptersStatus() {
  return {
    dataGovSg: true, // Public endpoint
    ltaDataMall: Boolean(API_CONFIG.LTA_DATAMALL_API_KEY.trim()),
    uraSpace: Boolean(API_CONFIG.URA_ACCESS_KEY.trim()),
  };
}
