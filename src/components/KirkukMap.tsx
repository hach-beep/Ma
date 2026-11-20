import React from 'react';
import { Compass, Fuel, Navigation } from 'lucide-react';
import { CONGESTION_META, Station } from '../types';

interface KirkukMapProps {
  stations: Station[];
  selectedStationId: string;
  onSelectStation: (stationId: string) => void;
}

export const KirkukMap: React.FC<KirkukMapProps> = ({
  stations,
  selectedStationId,
  onSelectStation,
}) => {
  const selected = stations.find((s) => s.id === selectedStationId) || stations[0];

  return (
    <div className="relative w-full h-[380px] sm:h-[430px] rounded-2xl border border-slate-200 bg-[#EEF3FA] overflow-hidden select-none">
      {/* Subtle city grid & Kirkuk river / arterial road geometry */}
      <svg
        viewBox="0 0 800 480"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <pattern id="kirkuk-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="#DCE5F2"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="800" height="480" fill="#EDF2FA" />
        <rect width="800" height="480" fill="url(#kirkuk-grid)" />

        {/* Urban green districts */}
        <path
          d="M 40 40 Q 130 20 190 95 T 140 190 Q 70 180 40 110 Z"
          fill="#DDEBD8"
          opacity="0.7"
        />
        <path
          d="M 590 280 Q 710 260 755 360 T 660 440 Q 560 420 590 280 Z"
          fill="#DDEBD8"
          opacity="0.65"
        />

        {/* Khasa Su Riverbed */}
        <path
          d="M 465 -10 C 445 120, 485 220, 440 330 C 415 390, 430 445, 420 490"
          fill="none"
          stroke="#C7DDF6"
          strokeWidth="24"
          strokeLinecap="round"
        />
        <path
          d="M 465 -10 C 445 120, 485 220, 440 330 C 415 390, 430 445, 420 490"
          fill="none"
          stroke="#9CC2EE"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Major Kirkuk Arterial Roads */}
        <path
          d="M 0 230 C 210 215, 380 235, 800 205"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="14"
        />
        <path
          d="M 0 230 C 210 215, 380 235, 800 205"
          fill="none"
          stroke="#CBD8EC"
          strokeWidth="2"
          strokeDasharray="8 6"
        />
        <path
          d="M 410 0 L 420 480"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="14"
        />
        <path
          d="M 120 460 L 660 40"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="10"
        />
        <path
          d="M 160 85 L 670 390"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="9"
        />

        {/* City District Labels */}
        <text x="415" y="255" textAnchor="middle" fill="#64748B" fontSize="13" fontWeight="600">
          مركز مدينة كركوك
        </text>
        <text x="595" y="105" textAnchor="middle" fill="#64748B" fontSize="12">
          طريق السليمانية
        </text>
        <text x="200" y="340" textAnchor="middle" fill="#64748B" fontSize="12">
          طريق الجامعة
        </text>
        <text x="615" y="375" textAnchor="middle" fill="#64748B" fontSize="12">
          الحي الصناعي
        </text>
        <text x="175" y="135" textAnchor="middle" fill="#64748B" fontSize="12">
          الشورجة
        </text>
      </svg>

      {/* Top Map Legend & Location Header */}
      <div className="relative z-10 flex items-center justify-between gap-3 p-3 pointer-events-none">
        <div className="pointer-events-auto inline-flex items-center gap-2 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm text-xs font-medium text-slate-700">
          <Compass className="w-4 h-4 text-[#2563EB]" />
          <span>خريطة محطات كركوك المباشرة</span>
        </div>

        <div className="pointer-events-auto hidden sm:flex items-center gap-3 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
            <span>خفيف</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
            <span>متوسط</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
            <span>مزدحم</span>
          </span>
        </div>
      </div>

      {/* Driver current position pin */}
      <div
        className="absolute z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ left: '46%', top: '54%' }}
        title="موقعك الحالي"
      >
        <div className="relative flex flex-col items-center">
          <div className="w-9 h-9 rounded-full bg-[#2563EB]/15 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-[#2563EB] border-2 border-white shadow-md" />
          </div>
          <span className="mt-1 px-2 py-0.5 rounded bg-[#0F172A]/85 text-white text-[10px] font-medium whitespace-nowrap">
            موقعك الحالي
          </span>
        </div>
      </div>

      {/* Interactive Fuel Station Pins */}
      {stations.map((station) => {
        const isSelected = station.id === selected?.id;
        const meta = CONGESTION_META[station.congestion];

        return (
          <button
            key={station.id}
            type="button"
            onClick={() => onSelectStation(station.id)}
            style={{
              left: `${station.mapX}%`,
              top: `${station.mapY}%`,
            }}
            className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 group flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] rounded-xl transition-transform duration-150 ${
              isSelected ? 'scale-110 z-30' : 'hover:scale-105'
            }`}
            aria-label={`${station.nameAr} - ${meta.labelAr} - ${station.waitMinutes} دقيقة`}
          >
            <div
              className={`min-w-[44px] min-h-[44px] px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md border transition-colors ${
                isSelected
                  ? 'bg-[#132B5E] text-white border-[#132B5E]'
                  : 'bg-white text-slate-900 border-slate-200 hover:border-[#2563EB]'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: meta.dotColor }}
              />
              <Fuel className="w-4 h-4 shrink-0" />
              <span className="font-mono-num text-xs font-semibold whitespace-nowrap">
                {station.waitMinutes} د
              </span>
            </div>
            <span
              className={`mt-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap shadow-sm ${
                isSelected
                  ? 'bg-[#132B5E] text-white'
                  : 'bg-white/95 text-slate-800 border border-slate-200'
              }`}
            >
              {station.nameAr}
            </span>
          </button>
        );
      })}

      {/* Floating Bottom Map Station Preview Bar */}
      {selected && (
        <div className="absolute bottom-3 left-3 right-3 z-20 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 truncate">
                {selected.nameAr}
              </h3>
              <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                · {selected.distanceKm.toFixed(1)} كم
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className={`font-semibold ${CONGESTION_META[selected.congestion].badgeTextClass}`}>
                {CONGESTION_META[selected.congestion].labelAr}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">{selected.queueCount} سيارة</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">~{selected.waitMinutes} دقيقة</span>
            </div>
          </div>

          <a
            href={`https://maps.google.com/?q=Kirkuk+${encodeURIComponent(selected.nameEn)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#EEF4FF] text-[#132B5E] text-xs font-semibold hover:bg-[#DCE7FE] transition-colors whitespace-nowrap shrink-0"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>الاتجاهات</span>
          </a>
        </div>
      )}
    </div>
  );
};
