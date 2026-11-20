import React, { useEffect, useMemo, useState } from 'react';
import { BellRing, Car, Clock, Fuel, Maximize2, Minimize2 } from 'lucide-react';
import { Booking, CONGESTION_META, FUEL_LABELS, FuelGradeKey, Station } from '../types';
import { StationImage } from './StationImage';

interface StationDisplayProps {
  stations: Station[];
  bookings: Booking[];
}

export const StationDisplay: React.FC<StationDisplayProps> = ({
  stations,
  bookings,
}) => {
  const [selectedId, setSelectedId] = useState<string>(
    stations[0]?.id || 'kirkuk-central'
  );
  const [now, setNow] = useState<Date>(() => new Date());
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const station = useMemo(
    () => stations.find((s) => s.id === selectedId) || stations[0],
    [stations, selectedId]
  );

  const calledTickets = useMemo(() => {
    if (!station) return [];
    return bookings.filter(
      (b) => b.stationId === station.id && b.status === 'called' && b.pumpNumber > 0
    );
  }, [bookings, station]);

  if (!station) return null;

  const meta = CONGESTION_META[station.congestion];
  const timeStr = now.toLocaleTimeString('ar-IQ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      className={`${
        isExpanded
          ? 'fixed inset-0 z-50 p-4 sm:p-8 bg-[#050E21] overflow-y-auto'
          : 'pb-12'
      }`}
    >
      {/* Display Controls Strip */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label
            htmlFor="display-station-select"
            className={`text-sm font-bold ${isExpanded ? 'text-white' : 'text-slate-800'}`}
          >
            شاشة العرض داخل:
          </label>
          <select
            id="display-station-select"
            value={station.id}
            onChange={(e) => setSelectedId(e.target.value)}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900"
          >
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameAr}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#132B5E] text-white text-xs font-bold hover:bg-[#1D3E85] transition-colors"
        >
          {isExpanded ? (
            <>
              <Minimize2 className="w-4 h-4" />
              <span>تصغير الشاشة</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-4 h-4" />
              <span>ملء الشاشة (وضع التلفاز)</span>
            </>
          )}
        </button>
      </div>

      {/* Main Digital Kiosk Board */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#07142E] via-[#0E2452] to-[#173A80] text-white border border-[#244B9A] shadow-xl">
        {/* Subtle Station Backdrop Header */}
        <div className="relative px-6 sm:px-10 py-6 border-b border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <Fuel className="w-7 h-7 text-blue-300" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {station.nameAr}
              </h2>
              <p className="text-sm text-blue-200 mt-0.5">
                {station.districtAr} · {station.isOpen ? 'المحطة مفتوحة الآن' : 'المحطة مغلقة'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-left">
              <div className="text-xs text-blue-200">الوقت الحالي</div>
              <div className="font-mono-num text-xl font-bold text-white" dir="ltr">
                {timeStr}
              </div>
            </div>
            <div className="px-4 py-2 rounded-xl bg-white/10 border border-white/15 text-sm font-bold">
              {meta.labelAr}
            </div>
          </div>
        </div>

        {/* 3 Giant Telemetry Panels */}
        <div className="p-6 sm:p-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Panel 1: Cars in Queue */}
          <div className="rounded-2xl bg-white/8 border border-white/15 p-6 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#2563EB]/30 border border-blue-400/30 flex items-center justify-center mb-4">
              <Car className="w-8 h-8 text-blue-200" />
            </div>
            <div className="font-mono-num text-6xl font-extrabold text-white tracking-tight">
              {station.queueCount}
            </div>
            <div className="text-base font-bold text-blue-100 mt-2">
              سيارة في الطابور
            </div>
            <div className="text-xs text-blue-200/80 mt-1">
              معدل الخدمة: {station.activePumps} مضخات عاملة
            </div>
          </div>

          {/* Panel 2: Estimated Wait */}
          <div className="rounded-2xl bg-white/8 border border-white/15 p-6 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-amber-300" />
            </div>
            <div className="font-mono-num text-6xl font-extrabold text-white tracking-tight">
              {station.waitMinutes}
            </div>
            <div className="text-base font-bold text-blue-100 mt-2">
              دقيقة وقت الانتظار
            </div>
            <div className="text-xs text-blue-200/80 mt-1">
              تم التزود اليوم: {station.servedToday} مركبة
            </div>
          </div>

          {/* Panel 3: Available Fuel & Prices */}
          <div className="rounded-2xl bg-white/8 border border-white/15 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-base font-bold text-white">الوقود المتوفر الآن</span>
              <span className="text-xs text-blue-200">السعر / لتر</span>
            </div>

            <div className="space-y-3">
              {(['b91', 'b95', 'b98'] as FuelGradeKey[]).map((grade) => {
                const info = station.fuels[grade];
                return (
                  <div
                    key={grade}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10"
                  >
                    <span className="text-sm font-bold text-white">
                      {FUEL_LABELS[grade].ar}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono-num text-sm font-bold text-blue-100">
                        {info.priceIqd} د.ع
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          info.available ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {info.available ? 'متوفر' : 'نفذ'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Called Tickets & Station Banner Footer */}
        <div className="px-6 sm:px-10 pb-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-8 rounded-2xl bg-white/10 border border-white/15 px-5 py-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm shrink-0">
              <BellRing className="w-5 h-5" />
              <span>التذاكر المستدعاة للمضخات:</span>
            </div>
            {calledTickets.length === 0 ? (
              <span className="text-sm text-blue-100/80">
                مرحباً بكم في {station.nameAr} — التزموا بالمسار المخصص للمضخات
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                {calledTickets.map((t) => (
                  <div
                    key={t.id}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-sm font-bold text-white flex items-center gap-2"
                  >
                    <span className="font-mono-num">{t.ticketNumber}</span>
                    <span aria-hidden="true">←</span>
                    <span>المضخة {t.pumpNumber}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-4 rounded-2xl overflow-hidden border border-white/15 h-20 relative">
            <StationImage
              imageKey={station.imageKey}
              alt={station.nameAr}
              className="w-full h-full"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#07142E]/90 via-[#07142E]/40 to-transparent flex items-center px-4">
              <span className="text-xs font-bold text-white">
                محطتي ... لخدمتكم دائماً
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
