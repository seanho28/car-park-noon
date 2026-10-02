import React, { useState } from 'react';
import { LiveCarpark } from '../data/singaporeCarparks';
import {
  Bookmark,
  Navigation,
  Calculator,
  Clock,
  Zap,
  ArrowUpRight,
  Car,
  Bike,
  Truck,
  X,
} from 'lucide-react';

interface CarparkInspectorDrawerProps {
  carpark: LiveCarpark | null;
  isSaved: boolean;
  onToggleSave: (carparkId: string) => void;
  onCloseMobile?: () => void;
}

export const CarparkInspectorDrawer: React.FC<CarparkInspectorDrawerProps> = ({
  carpark,
  isSaved,
  onToggleSave,
  onCloseMobile,
}) => {
  const [durationHours, setDurationHours] = useState<number>(2);
  const [dayMode, setDayMode] = useState<'weekday' | 'weekend'>('weekday');

  if (!carpark) {
    return (
      <div className="h-full bg-white border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center">
        <Car className="w-8 h-8 text-slate-400 mb-3" />
        <h3 className="text-base font-semibold text-slate-900">
          Select a Carpark to Inspect
        </h3>
        <p className="text-sm text-slate-500 mt-1 max-w-xs">
          Click any carpark row or radar marker to view live lot breakdowns, gantry height clearance, and parking rate estimates.
        </p>
      </div>
    );
  }

  const halfHourBlocks = Math.round(durationHours * 2);
  const ratePerHalfHour =
    dayMode === 'weekday'
      ? carpark.rates.weekdayPerHalfHour
      : carpark.rates.weekendPerHalfHour;
  const estimatedCostSgd = (halfHourBlocks * ratePerHalfHour).toFixed(2);

  const currentHour = new Date().getHours();

  const googleMapsNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${carpark.lat},${carpark.lng}&travelmode=driving`;
  const wazeNavUrl = `https://waze.com/ul?ll=${carpark.lat},${carpark.lng}&navigate=yes`;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-5">
      {/* Header Title & Bookmark */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono font-medium text-slate-700">{carpark.id}</span>
            <span aria-hidden="true">·</span>
            <span>{carpark.agency}</span>
            <span aria-hidden="true">·</span>
            <span>{carpark.town}</span>
            <span aria-hidden="true">·</span>
            <span>
              {carpark.isLiveApiSynced ? 'Data.gov.sg Live' : 'Configured Snapshot'}
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1 leading-snug">
            {carpark.name}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{carpark.address}</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onToggleSave(carpark.id)}
            aria-label={isSaved ? 'Remove from saved carparks' : 'Save carpark'}
            className={`min-h-[40px] px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              isSaved
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Bookmark
              className={`w-3.5 h-3.5 ${
                isSaved ? 'fill-emerald-600 text-emerald-600' : ''
              }`}
            />
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>

          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close inspector"
              className="lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Lot Breakdown by Vehicle Category */}
      <div className="border-t border-b border-slate-100 py-4">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
          <span>Real-Time Lot Inventory</span>
          <span className="font-mono tabular-nums">
            {carpark.distanceKm.toFixed(2)} km away · {carpark.drivingMins} min drive
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Cars (C) */}
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Cars (C)</span>
              <Car className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1 font-mono tabular-nums">
              <span
                className={`text-xl font-semibold ${
                  carpark.lots.C.availableLots === 0
                    ? 'text-red-600'
                    : carpark.lots.C.availableLots <= 15
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {carpark.lots.C.availableLots}
              </span>
              <span className="text-xs text-slate-400">
                / {carpark.lots.C.totalLots}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {carpark.statusLabel}
            </div>
          </div>

          {/* Motorcycles (Y) */}
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Motorcycles (Y)</span>
              <Bike className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1 font-mono tabular-nums">
              <span className="text-xl font-semibold text-slate-900">
                {carpark.lots.Y.availableLots}
              </span>
              <span className="text-xs text-slate-400">
                / {carpark.lots.Y.totalLots}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {carpark.lots.Y.totalLots > 0 ? 'Active EPS' : 'N/A'}
            </div>
          </div>

          {/* Heavy Vehicles (H) */}
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Heavy (H)</span>
              <Truck className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1 font-mono tabular-nums">
              <span className="text-xl font-semibold text-slate-900">
                {carpark.lots.H.availableLots}
              </span>
              <span className="text-xs text-slate-400">
                / {carpark.lots.H.totalLots}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {carpark.lots.H.totalLots > 0 ? 'Authorised' : 'No Heavy Lots'}
            </div>
          </div>
        </div>
      </div>

      {/* Singapore Parking Fee & Grace Period Calculator */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <Calculator className="w-3.5 h-3.5 text-emerald-600" />
            <span>Singapore Parking Rate Calculator</span>
          </div>

          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setDayMode('weekday')}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                dayMode === 'weekday'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Weekday
            </button>
            <button
              type="button"
              onClick={() => setDayMode('weekend')}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                dayMode === 'weekend'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Weekend / PH
            </button>
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor="duration-slider"
              className="text-xs text-slate-600 font-medium"
            >
              Planned Duration:{' '}
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {durationHours.toFixed(1)} hrs
              </span>
            </label>
            <div className="text-right font-mono tabular-nums">
              <span className="text-xs text-slate-500">Est. Fee: </span>
              <span className="text-base font-bold text-emerald-700">
                S${estimatedCostSgd}
              </span>
            </div>
          </div>

          <input
            id="duration-slider"
            type="range"
            min="0.5"
            max="8"
            step="0.5"
            value={durationHours}
            onChange={(e) => setDurationHours(parseFloat(e.target.value))}
            className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-200/70">
            <span>
              Rate: S${ratePerHalfHour.toFixed(2)} / 30 mins
            </span>
            <span>·</span>
            <span>Grace: {carpark.rates.gracePeriodMins} mins</span>
            <span>·</span>
            <span>{carpark.rates.freeParkingInfo}</span>
          </div>
        </div>
      </div>

      {/* Physical Specifications & EV Chargers */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-slate-50 rounded-lg">
          <span className="text-slate-500 block">Gantry Clearance</span>
          <span className="font-mono font-semibold text-slate-900 text-sm mt-0.5 block tabular-nums">
            {carpark.gantryHeightMeters.toFixed(2)} m
          </span>
          <span className="text-[11px] text-slate-500">
            {carpark.carparkType.toLowerCase()}
          </span>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg">
          <span className="text-slate-500 flex items-center gap-1">
            <Zap className="w-3 h-3 text-emerald-600" />
            EV Charging Points
          </span>
          <span className="font-mono font-semibold text-slate-900 text-sm mt-0.5 block tabular-nums">
            {carpark.evChargersCount} lots
          </span>
          <span className="text-[11px] text-slate-500">
            {carpark.parkingSystem === 'ELECTRONIC PARKING'
              ? 'EPS IU / SimplyGo'
              : 'Parking.sg App'}
          </span>
        </div>
      </div>

      {/* 24-Hour Typical Availability Trend */}
      <div>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>24-Hour Availability Trend</span>
          </span>
          <span className="text-slate-500 font-mono text-[11px] tabular-nums">
            Now ({currentHour}:00): {100 - carpark.occupancyRate}% open
          </span>
        </div>

        <div className="h-16 flex items-end gap-1 pt-2 px-2 pb-1 bg-slate-50 rounded-lg">
          {carpark.hourlyForecast.map((pct, hr) => {
            const isCurrent = hr === currentHour;
            return (
              <div
                key={hr}
                className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative"
                title={`${hr}:00 — Approx ${pct}% available`}
              >
                <div
                  className={`w-full rounded-t-xs transition-all ${
                    isCurrent
                      ? 'bg-emerald-600'
                      : pct < 25
                      ? 'bg-amber-400/75'
                      : 'bg-slate-300 group-hover:bg-slate-400'
                  }`}
                  style={{ height: `${Math.max(12, pct)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1 px-1 tabular-nums">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>23:00</span>
        </div>
      </div>

      {/* Direct Turn-by-Turn Navigation Links */}
      <div className="pt-1 flex items-center gap-2.5">
        <a
          href={googleMapsNavUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-h-[42px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Navigate (Google Maps)</span>
          <ArrowUpRight className="w-3.5 h-3.5 opacity-75" />
        </a>
        <a
          href={wazeNavUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[42px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
        >
          <span>Waze</span>
          <ArrowUpRight className="w-3.5 h-3.5 opacity-70" />
        </a>
      </div>
    </div>
  );
};
