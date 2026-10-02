/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  CarparkAgency,
  LiveCarpark,
  PRESET_LOCATIONS,
  SingaporeRegion,
} from './data/singaporeCarparks';
import {
  calculateDistanceKm,
  fetchSingaporeCarparkAvailability,
} from './services/carparkApi';
import { SpatialRadarMap } from './components/SpatialRadarMap';
import { CarparkInspectorDrawer } from './components/CarparkInspectorDrawer';
import { ApiStatusModal } from './components/ApiStatusModal';
import {
  Bookmark,
  Car,
  Bike,
  Truck,
  LocateFixed,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Zap,
  MapPin,
} from 'lucide-react';

type ActiveSection = 'nearby' | 'regions' | 'calculator' | 'saved';
type SortOption = 'distance' | 'lots_desc' | 'rate_asc';

export default function App() {
  // User Location State (Defaults to Bugis / Bras Basah Central Singapore)
  const [userLat, setUserLat] = useState<number>(1.3008);
  const [userLng, setUserLng] = useState<number>(103.8554);
  const [userLocationLabel, setUserLocationLabel] = useState<string>(
    'Bugis / Bras Basah (188021)'
  );
  const [isLocatingGps, setIsLocatingGps] = useState<boolean>(false);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);

  // Live Carpark Data State
  const [rawCarparks, setRawCarparks] = useState<LiveCarpark[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [apiTimestamp, setApiTimestamp] = useState<string>(new Date().toISOString());
  const [sourceMode, setSourceMode] = useState<
    'LIVE_DATA_GOV_SG' | 'FALLBACK_SNAPSHOT'
  >('LIVE_DATA_GOV_SG');
  const [liveHdbMatchedCount, setLiveHdbMatchedCount] = useState<number>(0);
  const [totalHdbPolledCount, setTotalHdbPolledCount] = useState<number>(0);

  // Navigation & Filters
  const [activeSection, setActiveSection] = useState<ActiveSection>('nearby');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [agencyFilter, setAgencyFilter] = useState<'ALL' | CarparkAgency>('ALL');
  const [regionFilter, setRegionFilter] = useState<'ALL' | SingaporeRegion>('ALL');
  const [lotTypeFilter, setLotTypeFilter] = useState<'C' | 'Y' | 'H'>('C');
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [onlyEvChargers, setOnlyEvChargers] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortOption>('distance');

  // Selected Carpark & Saved Bookmarks
  const [selectedCarparkId, setSelectedCarparkId] = useState<string | null>('ACB');
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('lotradar_sg_saved');
      return saved ? JSON.parse(saved) : ['ACB', 'LTA-ORCHARD-ION', 'T55'];
    } catch {
      return ['ACB', 'LTA-ORCHARD-ION'];
    }
  });
  const [isApiModalOpen, setIsApiModalOpen] = useState<boolean>(false);

  const loadCarparks = useCallback(
    async (lat: number, lng: number, showSpinner = false) => {
      if (showSpinner) setIsRefreshing(true);
      const result = await fetchSingaporeCarparkAvailability(lat, lng);
      setRawCarparks(result.carparks);
      setApiTimestamp(result.apiTimestamp);
      setSourceMode(result.sourceMode);
      setLiveHdbMatchedCount(result.liveHdbMatchedCount);
      setTotalHdbPolledCount(result.totalHdbPolledCount);
      setIsLoading(false);
      setIsRefreshing(false);
    },
    []
  );

  useEffect(() => {
    loadCarparks(userLat, userLng, false);
    const interval = setInterval(() => {
      loadCarparks(userLat, userLng, false);
    }, 60000);
    return () => clearInterval(interval);
  }, [loadCarparks, userLat, userLng]);

  // Recalculate distances immediately when user changes coordinates
  const carparksWithLiveDistance = useMemo(() => {
    return rawCarparks.map((cp) => {
      const distanceKm = calculateDistanceKm(userLat, userLng, cp.lat, cp.lng);
      const walkingMins = Math.max(1, Math.round((distanceKm / 4.8) * 60));
      const drivingMins = Math.max(1, Math.round((distanceKm / 28) * 60) + 2);
      return {
        ...cp,
        distanceKm,
        walkingMins,
        drivingMins,
      };
    });
  }, [rawCarparks, userLat, userLng]);

  // Handle Browser GPS Geolocation
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGpsNotice('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocatingGps(true);
    setGpsNotice(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setIsLocatingGps(false);
        // Check if within Singapore bounding box (approx 1.15N..1.48N, 103.6E..104.1E)
        const isInSingapore =
          latitude >= 1.15 &&
          latitude <= 1.48 &&
          longitude >= 103.6 &&
          longitude <= 104.1;

        if (isInSingapore) {
          setUserLat(latitude);
          setUserLng(longitude);
          setUserLocationLabel(
            `Current GPS (${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E)`
          );
          setRadiusKm(3);
        } else {
          // User is testing outside SG; snap to Orchard Road SG while informing them cleanly
          setUserLat(1.3018);
          setUserLng(103.8378);
          setUserLocationLabel('Orchard Road (Simulated SG Center)');
          setGpsNotice(
            'GPS detected outside Singapore — centered at Orchard Road (238858) so you can test nearby SG carparks.'
          );
        }
      },
      () => {
        setIsLocatingGps(false);
        setGpsNotice(
          'Location permission unavailable — using Singapore Central preset. Choose any MRT hub below.'
        );
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const handleToggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];
      try {
        localStorage.setItem('lotradar_sg_saved', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const handleSelectPreset = (presetId: string) => {
    const found = PRESET_LOCATIONS.find((p) => p.id === presetId);
    if (!found) return;
    setUserLat(found.lat);
    setUserLng(found.lng);
    setUserLocationLabel(`${found.name} (${found.postalOrArea.split(' ')[0]})`);
    setGpsNotice(null);
    if (radiusKm > 5) setRadiusKm(5);
  };

  // Filtered & Sorted Carparks
  const filteredCarparks = useMemo(() => {
    return carparksWithLiveDistance
      .filter((cp) => {
        if (activeSection === 'saved' && !savedIds.includes(cp.id)) {
          return false;
        }
        if (agencyFilter !== 'ALL' && cp.agency !== agencyFilter) {
          return false;
        }
        if (regionFilter !== 'ALL' && cp.region !== regionFilter) {
          return false;
        }
        if (onlyEvChargers && cp.evChargersCount === 0) {
          return false;
        }
        // Only apply radius filter when not searching by specific keyword or viewing saved
        if (
          activeSection !== 'saved' &&
          !searchQuery.trim() &&
          cp.distanceKm > radiusKm
        ) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = cp.name.toLowerCase().includes(q);
          const matchAddress = cp.address.toLowerCase().includes(q);
          const matchId = cp.id.toLowerCase().includes(q);
          const matchTown = cp.town.toLowerCase().includes(q);
          if (!matchName && !matchAddress && !matchId && !matchTown) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'distance') return a.distanceKm - b.distanceKm;
        if (sortBy === 'lots_desc') {
          return (
            b.lots[lotTypeFilter].availableLots -
            a.lots[lotTypeFilter].availableLots
          );
        }
        if (sortBy === 'rate_asc') {
          return a.rates.weekdayPerHalfHour - b.rates.weekdayPerHalfHour;
        }
        return 0;
      });
  }, [
    carparksWithLiveDistance,
    activeSection,
    savedIds,
    agencyFilter,
    regionFilter,
    onlyEvChargers,
    radiusKm,
    searchQuery,
    sortBy,
    lotTypeFilter,
  ]);

  const selectedCarpark = useMemo(() => {
    return (
      carparksWithLiveDistance.find((c) => c.id === selectedCarparkId) ||
      filteredCarparks[0] ||
      null
    );
  }, [carparksWithLiveDistance, selectedCarparkId, filteredCarparks]);

  // Summary Metrics for Current Radius / Filter
  const summaryStats = useMemo(() => {
    const totalAvailableCars = filteredCarparks.reduce(
      (acc, cp) => acc + cp.lots[lotTypeFilter].availableLots,
      0
    );
    const totalCapacityCars = filteredCarparks.reduce(
      (acc, cp) => acc + cp.lots[lotTypeFilter].totalLots,
      0
    );
    const nearestCarpark =
      filteredCarparks.length > 0
        ? [...filteredCarparks].sort((a, b) => a.distanceKm - b.distanceKm)[0]
        : null;

    return {
      stationCount: filteredCarparks.length,
      totalAvailableCars,
      totalCapacityCars,
      nearestCarpark,
    };
  }, [filteredCarparks, lotTypeFilter]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('nearby');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap"
        >
          LotRadar SG
        </a>

        {/* Zone 2: 4–5 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => {
              setActiveSection('nearby');
              setRegionFilter('ALL');
            }}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap py-1 border-b-2 ${
              activeSection === 'nearby'
                ? 'border-emerald-600 text-slate-900 font-semibold'
                : 'border-transparent'
            }`}
          >
            Nearby Radar
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSection('regions');
              setRadiusKm(15);
            }}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap py-1 border-b-2 ${
              activeSection === 'regions'
                ? 'border-emerald-600 text-slate-900 font-semibold'
                : 'border-transparent'
            }`}
          >
            SG Regions
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('saved')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap py-1 border-b-2 ${
              activeSection === 'saved'
                ? 'border-emerald-600 text-slate-900 font-semibold'
                : 'border-transparent'
            }`}
          >
            Saved Lots ({savedIds.length})
          </button>
          <button
            type="button"
            onClick={() => setIsApiModalOpen(true)}
            className="hover:text-slate-900 transition-colors whitespace-nowrap py-1 border-b-2 border-transparent"
          >
            API Data Feeds
          </button>
        </nav>

        {/* Zone 3: 1–2 primary actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadCarparks(userLat, userLng, true)}
            disabled={isRefreshing}
            className="min-h-[40px] px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">Sync Live Lots</span>
          </button>

          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocatingGps}
            className="min-h-[40px] px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-xs"
          >
            <LocateFixed
              className={`w-3.5 h-3.5 ${isLocatingGps ? 'animate-pulse' : ''}`}
            />
            <span>{isLocatingGps ? 'Locating...' : 'Near Me'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Container (1440px max-width desktop baseline) */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Top Location Bar & Quick Singapore MRT/Hub Presets */}
        <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>Singapore Electronic Parking System (EPS)</span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => setIsApiModalOpen(true)}
                  className="text-emerald-700 hover:underline font-medium"
                >
                  {sourceMode === 'LIVE_DATA_GOV_SG'
                    ? `Data.gov.sg Live (${totalHdbPolledCount.toLocaleString()} HDB Carparks Polled)`
                    : 'Snapshot Mode'}
                </button>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Updated {new Date(apiTimestamp).toLocaleTimeString('en-SG')}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Available Carpark Lots Near{' '}
                <span className="text-emerald-700">{userLocationLabel}</span>
              </h1>
            </div>

            {/* Search Input & Vehicle Lot Type Selector */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search road, mall, blk, or carpark code..."
                  className="w-full min-h-[40px] pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                />
              </div>

              {/* Vehicle Lot Category Segmented Control */}
              <div
                className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
                role="group"
                aria-label="Vehicle lot type"
              >
                <button
                  type="button"
                  onClick={() => setLotTypeFilter('C')}
                  className={`min-h-[32px] px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                    lotTypeFilter === 'C'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>Cars (C)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLotTypeFilter('Y')}
                  className={`min-h-[32px] px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                    lotTypeFilter === 'Y'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Bike className="w-3.5 h-3.5" />
                  <span>Bikes (Y)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLotTypeFilter('H')}
                  className={`min-h-[32px] px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                    lotTypeFilter === 'H'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Heavy (H)</span>
                </button>
              </div>
            </div>
          </div>

          {gpsNotice && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg flex items-center justify-between">
              <span>{gpsNotice}</span>
              <button
                type="button"
                onClick={() => setGpsNotice(null)}
                className="text-amber-900 font-medium underline ml-3 whitespace-nowrap"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Quick Jump Singapore Town / MRT Hub Selector */}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-medium text-slate-500 flex items-center gap-1 shrink-0">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>Jump to Hub:</span>
            </span>
            <div className="flex items-center gap-1.5">
              {PRESET_LOCATIONS.map((preset) => {
                const isActive = userLocationLabel.startsWith(preset.name);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* SG Region Filter Bar (Shown prominently when SG Regions tab is active, or compactly in all views) */}
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Agency Filter Segmented Controls */}
            <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg">
              {(['ALL', 'HDB', 'LTA', 'URA'] as const).map((agency) => (
                <button
                  key={agency}
                  type="button"
                  onClick={() => setAgencyFilter(agency)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    agencyFilter === agency
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {agency === 'ALL' ? 'All Agencies' : agency}
                </button>
              ))}
            </div>

            {/* Region Filter Segmented Controls */}
            <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg overflow-x-auto">
              {(
                ['ALL', 'Central', 'East', 'West', 'North', 'North-East'] as const
              ).map((reg) => (
                <button
                  key={reg}
                  type="button"
                  onClick={() => {
                    setRegionFilter(reg);
                    if (reg !== 'ALL') setRadiusKm(15);
                  }}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    regionFilter === reg
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {reg === 'ALL' ? 'All SG Regions' : reg}
                </button>
              ))}
            </div>

            {/* EV Charger Toggle */}
            <button
              type="button"
              onClick={() => setOnlyEvChargers((v) => !v)}
              className={`px-3 py-2 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                onlyEvChargers
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span>EV Lots Only</span>
            </button>
          </div>

          {/* Sort Order Control */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sort:</span>
            </span>
            <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg">
              <button
                type="button"
                onClick={() => setSortBy('distance')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  sortBy === 'distance'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Nearest
              </button>
              <button
                type="button"
                onClick={() => setSortBy('lots_desc')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  sortBy === 'lots_desc'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Most Lots
              </button>
              <button
                type="button"
                onClick={() => setSortBy('rate_asc')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  sortBy === 'rate_asc'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Lowest Rate
              </button>
            </div>
          </div>
        </section>

        {/* Main Split Workspace: Left Carpark Directory & Right Spatial Radar + Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT COLUMN (5 cols): High-Density Carpark Feed */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            {/* List Header Summary Bar */}
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-900 tabular-nums">
                  {summaryStats.stationCount} Carparks
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-emerald-700 font-medium">
                  {summaryStats.totalAvailableCars.toLocaleString()} free lots
                </span>
              </div>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                Radius: {radiusKm === 15 ? 'Islandwide' : `≤ ${radiusKm} km`}
              </span>
            </div>

            {/* Loading State */}
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div
                    key={n}
                    className="h-20 bg-slate-100 animate-pulse rounded-lg"
                  />
                ))}
              </div>
            ) : filteredCarparks.length === 0 ? (
              /* Empty State */
              <div className="p-8 text-center space-y-3">
                <SlidersHorizontal className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-900">
                    No Carparks Match Current Filters
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Try expanding the search radius to Islandwide (15 km) or resetting agency filters.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRadiusKm(15);
                    setAgencyFilter('ALL');
                    setRegionFilter('ALL');
                    setOnlyEvChargers(false);
                    setSearchQuery('');
                    setActiveSection('nearby');
                  }}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              /* Scrollable Carpark List Rows (Zero-Pill Metadata Discipline) */
              <div className="divide-y divide-slate-100 max-h-[680px] overflow-y-auto">
                {filteredCarparks.map((cp) => {
                  const isSelected = selectedCarpark?.id === cp.id;
                  const activeLot = cp.lots[lotTypeFilter];
                  const avail = activeLot.availableLots;
                  const total = activeLot.totalLots;
                  const availRatio =
                    total > 0 ? Math.min(100, Math.round((avail / total) * 100)) : 0;
                  const isBookmarked = savedIds.includes(cp.id);

                  return (
                    <div
                      key={cp.id}
                      onClick={() => setSelectedCarparkId(cp.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedCarparkId(cp.id);
                        }
                      }}
                      className={`p-4 transition-colors cursor-pointer flex items-start justify-between gap-4 ${
                        isSelected
                          ? 'bg-emerald-50/60 border-l-4 border-l-emerald-600'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        {/* Clean unboxed metadata line with typographic separators */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                          <span className="font-mono font-semibold text-slate-700">
                            {cp.id}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{cp.agency}</span>
                          <span aria-hidden="true">·</span>
                          <span>{cp.town}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums text-slate-700 font-medium">
                            {cp.distanceKm.toFixed(2)} km
                          </span>
                          {isBookmarked && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-emerald-700 font-medium">
                                Saved
                              </span>
                            </>
                          )}
                        </div>

                        <h3 className="text-sm font-semibold text-slate-900 truncate">
                          {cp.name}
                        </h3>

                        <p className="text-xs text-slate-500 truncate">
                          {cp.address}
                        </p>

                        {/* Rate & Clearance unboxed inline metadata */}
                        <div className="pt-1 flex items-center gap-2 text-[11px] text-slate-500 font-mono tabular-nums">
                          <span>
                            S${cp.rates.weekdayPerHalfHour.toFixed(2)}/30m
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{cp.gantryHeightMeters.toFixed(2)}m gantry</span>
                          {cp.evChargersCount > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-emerald-700">
                                {cp.evChargersCount} EV
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right Column: Tabular Lot Count & Semantic Status Text */}
                      <div className="text-right shrink-0 flex flex-col items-end justify-between">
                        <div className="font-mono tabular-nums">
                          <span
                            className={`text-2xl font-bold tracking-tight ${
                              avail === 0
                                ? 'text-red-600'
                                : avail <= 15
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {avail}
                          </span>
                          <span className="text-xs text-slate-400 ml-1">
                            / {total}
                          </span>
                        </div>

                        <span
                          className={`text-[11px] font-medium mt-0.5 ${
                            avail === 0
                              ? 'text-red-700'
                              : avail <= 15
                              ? 'text-amber-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {cp.statusLabel} ({availRatio}%)
                        </span>

                        {/* Subtle Occupancy Progress Bar */}
                        <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-2">
                          <div
                            className={`h-full rounded-full ${
                              avail === 0
                                ? 'bg-red-500'
                                : avail <= 15
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${availRatio}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN (7 cols): Interactive Spatial Radar Map + Carpark Inspector */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Spatial Radar Viewport */}
            <div className="h-[430px]">
              <SpatialRadarMap
                userLat={userLat}
                userLng={userLng}
                userLocationLabel={userLocationLabel}
                carparks={filteredCarparks}
                selectedCarparkId={selectedCarpark?.id || null}
                onSelectCarpark={(cp) => setSelectedCarparkId(cp.id)}
                onRecenter={(lat, lng, label) => {
                  setUserLat(lat);
                  setUserLng(lng);
                  if (label) setUserLocationLabel(label);
                }}
                radiusKm={radiusKm}
                onRadiusChange={setRadiusKm}
                lotTypeFilter={lotTypeFilter}
              />
            </div>

            {/* Selected Carpark Inspector & Rate Calculator */}
            <CarparkInspectorDrawer
              carpark={selectedCarpark}
              isSaved={
                selectedCarpark ? savedIds.includes(selectedCarpark.id) : false
              }
              onToggleSave={handleToggleSave}
            />
          </div>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white mt-8 py-4 px-4 sm:px-6">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            LotRadar SG · Real-time HDB EPS telemetry powered by Data.gov.sg Open API · Ready for LTA DataMall &amp; URA Space API keys
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsApiModalOpen(true)}
              className="hover:text-slate-900 underline"
            >
              Configure LTA / URA Keys
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={handleLocateMe}
              className="hover:text-slate-900 underline"
            >
              Recenter GPS
            </button>
          </div>
        </div>
      </footer>

      {/* API Data Feeds & Key Readiness Modal */}
      <ApiStatusModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        sourceMode={sourceMode}
        totalHdbPolledCount={totalHdbPolledCount}
        liveHdbMatchedCount={liveHdbMatchedCount}
        apiTimestamp={apiTimestamp}
        onManualRefresh={() => loadCarparks(userLat, userLng, true)}
        isRefreshing={isRefreshing}
      />
    </div>
  );
}
