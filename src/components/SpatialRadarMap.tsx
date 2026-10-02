import React from 'react';
import { LiveCarpark } from '../data/singaporeCarparks';
import { Compass, LocateFixed, Plus, Minus, Navigation } from 'lucide-react';

interface SpatialRadarMapProps {
  userLat: number;
  userLng: number;
  userLocationLabel: string;
  carparks: LiveCarpark[];
  selectedCarparkId: string | null;
  onSelectCarpark: (carpark: LiveCarpark) => void;
  onRecenter: (lat: number, lng: number, label?: string) => void;
  radiusKm: number;
  onRadiusChange: (km: number) => void;
  lotTypeFilter: 'C' | 'Y' | 'H';
}

export const SpatialRadarMap: React.FC<SpatialRadarMapProps> = ({
  userLat,
  userLng,
  userLocationLabel,
  carparks,
  selectedCarparkId,
  onSelectCarpark,
  onRecenter,
  radiusKm,
  onRadiusChange,
  lotTypeFilter,
}) => {
  // Convert lat/lng delta around userLat/userLng into SVG coordinates (0..800, 0..560)
  const width = 800;
  const height = 560;
  const centerX = width / 2;
  const centerY = height / 2;

  // 1 degree lat/lng in Singapore (~1.3N) is approx 111.32 km
  // Scale so that radiusKm fits comfortably at ~210px radius
  const maxVisualRadiusPx = 215;
  const kmPerPixel = (radiusKm * 1.18) / maxVisualRadiusPx;

  const projectPoint = (lat: number, lng: number) => {
    const dLatKm = (lat - userLat) * 110.574;
    const dLngKm = (lng - userLng) * 111.32 * Math.cos((userLat * Math.PI) / 180);
    const x = centerX + dLngKm / kmPerPixel;
    const y = centerY - dLatKm / kmPerPixel;
    return { x, y };
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    // Only trigger if clicking directly on the background map surface
    if ((e.target as SVGElement).dataset.surface !== 'true') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * width;
    const clickY = ((e.clientY - rect.top) / rect.height) * height;

    const dLngKm = (clickX - centerX) * kmPerPixel;
    const dLatKm = (centerY - clickY) * kmPerPixel;

    const newLat = Number((userLat + dLatKm / 110.574).toFixed(4));
    const newLng = Number(
      (userLng + dLngKm / (111.32 * Math.cos((userLat * Math.PI) / 180))).toFixed(4)
    );

    onRecenter(newLat, newLng, `Custom Pin (${newLat.toFixed(3)}°N, ${newLng.toFixed(3)}°E)`);
  };

  const visibleCarparks = carparks.filter((cp) => cp.distanceKm <= radiusKm * 1.35);

  const zoomIn = () => {
    const steps = [1, 2, 3, 5, 10, 15];
    const currentIdx = steps.indexOf(radiusKm);
    if (currentIdx > 0) onRadiusChange(steps[currentIdx - 1]);
    else if (radiusKm > 1) onRadiusChange(1);
  };

  const zoomOut = () => {
    const steps = [1, 2, 3, 5, 10, 15];
    const currentIdx = steps.indexOf(radiusKm);
    if (currentIdx >= 0 && currentIdx < steps.length - 1) {
      onRadiusChange(steps[currentIdx + 1]);
    } else if (radiusKm < 15) {
      onRadiusChange(15);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[420px] bg-slate-900 rounded-xl overflow-hidden border border-slate-200 select-none flex flex-col justify-between">
      {/* Top Map Overlay Header */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 p-4 pointer-events-none">
        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800 px-3.5 py-2 rounded-lg pointer-events-auto">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Compass className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-slate-200 font-medium truncate max-w-[220px]">
              {userLocationLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-400">
              {userLat.toFixed(4)}°N, {userLng.toFixed(4)}°E
            </span>
          </div>
        </div>

        {/* Radius Filter Segmented Control */}
        <div className="flex items-center gap-1 p-1 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-lg pointer-events-auto">
          {[1, 2, 5, 15].map((km) => (
            <button
              key={km}
              type="button"
              onClick={() => onRadiusChange(km)}
              className={`px-2.5 py-1 text-xs font-mono tabular-nums rounded transition-colors whitespace-nowrap ${
                radiusKm === km
                  ? 'bg-emerald-600 text-white font-medium'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {km === 15 ? 'Islandwide' : `${km} km`}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive SVG Radar Canvas */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        onClick={handleSvgClick}
        className="absolute inset-0 w-full h-full cursor-crosshair"
        aria-label="Singapore Carpark Spatial Radar Map"
      >
        <defs>
          <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(16, 185, 129, 0.14)" />
            <stop offset="55%" stopColor="rgba(15, 23, 42, 0.05)" />
            <stop offset="100%" stopColor="rgba(2, 6, 23, 0)" />
          </radialGradient>
          <pattern id="sgGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(148, 163, 184, 0.07)"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        {/* Clickable Surface */}
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill="url(#sgGrid)"
          data-surface="true"
        />
        <circle
          cx={centerX}
          cy={centerY}
          r={maxVisualRadiusPx}
          fill="url(#radarGlow)"
          pointerEvents="none"
        />

        {/* Subtle Singapore Expressway / Coastline Vector Context */}
        <g stroke="rgba(148, 163, 184, 0.12)" strokeWidth="1.5" fill="none" pointerEvents="none">
          {/* Stylised PIE / ECP / CTE arterial corridors relative to current viewport */}
          <path
            d={`M 0 ${centerY + 45} Q ${centerX - 80} ${centerY - 10}, ${width} ${centerY - 35}`}
            strokeDasharray="6 6"
          />
          <path
            d={`M ${centerX - 30} 0 Q ${centerX + 15} ${centerY}, ${centerX - 10} ${height}`}
            strokeDasharray="4 6"
          />
        </g>

        {/* Concentric Distance Rings */}
        {[0.33, 0.66, 1].map((ratio, idx) => {
          const r = Math.round(maxVisualRadiusPx * ratio);
          const ringKm = (radiusKm * ratio).toFixed(1);
          return (
            <g key={idx} pointerEvents="none">
              <circle
                cx={centerX}
                cy={centerY}
                r={r}
                fill="none"
                stroke="rgba(148, 163, 184, 0.18)"
                strokeWidth="1"
                strokeDasharray={idx === 2 ? 'none' : '4 4'}
              />
              <text
                x={centerX + 6}
                y={centerY - r + 13}
                fill="rgba(148, 163, 184, 0.55)"
                fontSize="10"
                fontFamily="IBM Plex Mono, monospace"
              >
                {ringKm} km
              </text>
            </g>
          );
        })}

        {/* Crosshair Axes */}
        <line
          x1={centerX}
          y1={centerY - maxVisualRadiusPx - 20}
          x2={centerX}
          y2={centerY + maxVisualRadiusPx + 20}
          stroke="rgba(148, 163, 184, 0.12)"
          strokeWidth="1"
          pointerEvents="none"
        />
        <line
          x1={centerX - maxVisualRadiusPx - 20}
          y1={centerY}
          x2={centerX + maxVisualRadiusPx + 20}
          y2={centerY}
          stroke="rgba(148, 163, 184, 0.12)"
          strokeWidth="1"
          pointerEvents="none"
        />

        {/* Connection line to selected carpark */}
        { visibleCarparks.map((cp) => {
          if (cp.id !== selectedCarparkId) return null;
          const pt = projectPoint(cp.lat, cp.lng);
          return (
            <g key={`line-${cp.id}`} pointerEvents="none">
              <line
                x1={centerX}
                y1={centerY}
                x2={pt.x}
                y2={pt.y}
                stroke="#10b981"
                strokeWidth="1.75"
                strokeDasharray="5 4"
              />
            </g>
          );
        })}

        {/* Carpark Nodes */}
        {visibleCarparks.map((cp) => {
          const { x, y } = projectPoint(cp.lat, cp.lng);
          // Clamp within SVG bounds with padding
          if (x < 32 || x > width - 32 || y < 36 || y > height - 36) return null;

          const activeLot = cp.lots[lotTypeFilter];
          const avail = activeLot.availableLots;
          const isSelected = cp.id === selectedCarparkId;

          // Semantic color coding with explicit numeric lot label inside node
          let fillHex = '#10b981'; // Emerald (Plenty)
          let strokeHex = '#059669';
          if (avail === 0) {
            fillHex = '#ef4444'; // Crimson (Full)
            strokeHex = '#b91c1c';
          } else if (avail <= 15 || cp.statusLabel === 'Filling Fast') {
            fillHex = '#f59e0b'; // Amber (Filling fast)
            strokeHex = '#d97706';
          }

          return (
            <g
              key={cp.id}
              transform={`translate(${x}, ${y})`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectCarpark(cp);
              }}
              className="cursor-pointer group"
            >
              {isSelected && (
                <circle
                  r="26"
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="2"
                  opacity="0.75"
                />
              )}
              <rect
                x="-24"
                y="-14"
                width="48"
                height="28"
                rx="6"
                fill={isSelected ? '#ffffff' : '#0f172a'}
                stroke={isSelected ? '#10b981' : strokeHex}
                strokeWidth={isSelected ? '2.5' : '1.5'}
              />
              {/* Status bar indicator at left of marker */}
              <rect
                x="-20"
                y="-9"
                width="4"
                height="18"
                rx="1.5"
                fill={fillHex}
              />
              <text
                x="3"
                y="4"
                textAnchor="middle"
                fill={isSelected ? '#0f172a' : '#f8fafc'}
                fontSize="11"
                fontWeight="600"
                fontFamily="IBM Plex Mono, monospace"
              >
                {avail}
              </text>

              {/* Town/Carpark Code label below marker */}
              <text
                x="0"
                y="26"
                textAnchor="middle"
                fill={isSelected ? '#34d399' : '#94a3b8'}
                fontSize="10"
                fontWeight={isSelected ? '600' : '400'}
                fontFamily="Plus Jakarta Sans, sans-serif"
              >
                {cp.id.replace('LTA-', '').replace('URA-', '')}
              </text>
            </g>
          );
        })}

        {/* User Current Position Beacon */}
        <g transform={`translate(${centerX}, ${centerY})`} pointerEvents="none">
          <circle r="16" fill="rgba(59, 130, 246, 0.22)" />
          <circle r="7" fill="#3b82f6" stroke="#ffffff" strokeWidth="2.5" />
          <text
            x="0"
            y="-14"
            textAnchor="middle"
            fill="#93c5fd"
            fontSize="10"
            fontWeight="600"
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            YOU
          </text>
        </g>
      </svg>

      {/* Bottom Map Legend & Controls */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 p-4 pointer-events-none">
        <div className="flex items-center gap-4 bg-slate-950/85 backdrop-blur-md border border-slate-800 px-3.5 py-2 rounded-lg text-xs text-slate-300 pointer-events-auto">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
            <span>Plenty (&gt;30%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
            <span>Filling Fast (&le;15 lots)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-red-500 inline-block" />
            <span>Full (0 lots)</span>
          </span>
          <span className="hidden sm:inline text-slate-400">
            · Click anywhere on radar to reposition pin
          </span>
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={zoomIn}
            title="Narrow radar radius"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-950/85 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={zoomOut}
            title="Expand radar radius"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-950/85 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
