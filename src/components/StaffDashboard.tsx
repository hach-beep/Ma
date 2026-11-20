import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertCircle,
  BellRing,
  Car,
  CheckCircle2,
  Clock,
  Database,
  Fuel,
  Gauge,
  LogIn,
  Minus,
  Plus,
  Save,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  Booking,
  CONGESTION_META,
  FUEL_LABELS,
  FuelGrade,
  FuelGradeKey,
  Station,
} from '../types';

interface StaffDashboardProps {
  stations: Station[];
  bookings: Booking[];
  user: User | null;
  isAdmin: boolean;
  hasFirestoreStations: boolean;
  onSignIn: () => Promise<void>;
  onSeedStations: () => Promise<void>;
  onAdjustQueue: (station: Station, delta: number) => Promise<void>;
  onAdjustPumps: (station: Station, delta: number) => Promise<void>;
  onToggleStationOpen: (station: Station) => Promise<void>;
  onUpdateFuels: (
    station: Station,
    fuels: Record<FuelGradeKey, FuelGrade>
  ) => Promise<void>;
  onCallBookingToPump: (booking: Booking, pumpNumber: number) => Promise<void>;
  onStaffUpdateBookingStatus: (
    booking: Booking,
    status: 'completed' | 'cancelled'
  ) => Promise<void>;
}

export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  stations,
  bookings,
  user,
  isAdmin,
  hasFirestoreStations,
  onSignIn,
  onSeedStations,
  onAdjustQueue,
  onAdjustPumps,
  onToggleStationOpen,
  onUpdateFuels,
  onCallBookingToPump,
  onStaffUpdateBookingStatus,
}) => {
  const [selectedId, setSelectedId] = useState<string>(
    stations[0]?.id || 'kirkuk-central'
  );
  const station = useMemo(
    () => stations.find((s) => s.id === selectedId) || stations[0],
    [stations, selectedId]
  );

  const [fuelDraft, setFuelDraft] = useState<Record<FuelGradeKey, FuelGrade>>(
    station?.fuels || {
      b91: { available: true, priceIqd: 450 },
      b95: { available: true, priceIqd: 850 },
      b98: { available: true, priceIqd: 1250 },
    }
  );
  const [pumpChoiceMap, setPumpChoiceMap] = useState<Record<string, number>>({});
  const [savingFuels, setSavingFuels] = useState(false);
  const [fuelSavedNotice, setFuelSavedNotice] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (station) {
      setFuelDraft(station.fuels);
    }
  }, [station]);

  const stationBookings = useMemo(() => {
    if (!station) return [];
    return bookings.filter((b) => b.stationId === station.id);
  }, [bookings, station]);

  const activeBookingsCount = useMemo(
    () =>
      stationBookings.filter((b) => b.status === 'waiting' || b.status === 'called')
        .length,
    [stationBookings]
  );

  const handleSaveFuels = async () => {
    if (!station) return;
    setSavingFuels(true);
    setFuelSavedNotice(null);
    try {
      await onUpdateFuels(station, fuelDraft);
      setFuelSavedNotice('تم تحديث أسعار وتوفر الوقود في Firestore بنجاح');
    } finally {
      setSavingFuels(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await onSeedStations();
    } finally {
      setSeeding(false);
    }
  };

  if (!station) return null;

  const meta = CONGESTION_META[station.congestion];

  return (
    <div className="space-y-6 pb-12">
      {/* Auth / Admin Permission Gate Banner */}
      {!user ? (
        <div className="rounded-2xl bg-[#0F244E] text-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-blue-300 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-bold">لوحة تحكم موظف المحطة</h2>
              <p className="text-xs text-blue-100 mt-1">
                سجّل الدخول بحساب مسؤول المحطة لإدارة العدادات (+1 / -1) وتحديث الأسعار واستدعاء التذاكر عبر Firebase.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignIn}
            className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[#0F244E] text-sm font-bold hover:bg-blue-50 whitespace-nowrap shrink-0"
          >
            <LogIn className="w-4 h-4" />
            <span>تسجيل دخول الموظف</span>
          </button>
        </div>
      ) : !isAdmin ? (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 flex items-start gap-3 text-amber-950">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-bold">عرض للقراءة فقط — صلاحية موظف مطلوبة للتعديل</h2>
            <p className="text-xs text-amber-800 mt-1">
              الحساب الحالي ({user.email}) مسجل بصفة سائق. لتفعيل التعديلات المباشرة على المحطات في Firestore، سجّل الدخول بحساب الإدارة المعتمد.
            </p>
          </div>
        </div>
      ) : null}

      {/* Top Toolbar: Station Selector + Sync/Seed Action */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="staff-station-select" className="text-sm font-bold text-slate-900">
            المحطة المُدارة:
          </label>
          <select
            id="staff-station-select"
            value={station.id}
            onChange={(e) => setSelectedId(e.target.value)}
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#2563EB]"
          >
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameAr} — {s.districtAr}
              </option>
            ))}
          </select>
          <span className={`text-xs font-bold ${meta.badgeTextClass}`}>{meta.labelAr}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && !hasFirestoreStations && (
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeed}
              className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EEF4FF] text-[#132B5E] text-xs font-bold hover:bg-[#DBEAFE] transition-colors"
            >
              <Database className="w-4 h-4" />
              <span>{seeding ? 'جاري التهيئة...' : 'حفظ بيانات المحطات في Firestore'}</span>
            </button>
          )}
          <button
            type="button"
            disabled={!isAdmin}
            onClick={() => onToggleStationOpen(station)}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-50 ${
              station.isOpen
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                : 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100'
            }`}
          >
            {station.isOpen ? 'المحطة مفتوحة للعمل' : 'المحطة مغلقة مؤقتاً'}
          </button>
        </div>
      </div>

      {/* 4 KPI Strip (Tabular Numerals) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
            <span>في الطابور الآن</span>
            <Car className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="font-mono-num text-3xl font-bold text-slate-900">
            {station.queueCount}
          </div>
          <p className="text-xs text-slate-500 mt-1">سيارة منتظرة</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
            <span>الانتظار التقريبي</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="font-mono-num text-3xl font-bold text-slate-900">
            {station.waitMinutes}
          </div>
          <p className="text-xs text-slate-500 mt-1">دقيقة متوقعة</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
            <span>تم التزود اليوم</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-mono-num text-3xl font-bold text-slate-900">
            {station.servedToday}
          </div>
          <p className="text-xs text-slate-500 mt-1">مركبة منجزة</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
            <span>الحجوزات النشطة</span>
            <Gauge className="w-4 h-4 text-[#132B5E]" />
          </div>
          <div className="font-mono-num text-3xl font-bold text-slate-900">
            {activeBookingsCount}
          </div>
          <p className="text-xs text-slate-500 mt-1">{station.activePumps} مضخات عاملة</p>
        </div>
      </div>

      {/* Queue Controls & Fuel Price Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Queue & Pump Controls */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              إدارة الطابور المباشر والعدادات
            </h3>
            <p className="text-xs text-slate-500">
              يتم تحديث شاشة المحطة وتطبيقات السائقين فورياً عند كل تغيير.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => onAdjustQueue(station, 1)}
              className="min-h-[68px] rounded-2xl bg-[#132B5E] text-white font-bold text-sm flex flex-col items-center justify-center gap-1 hover:bg-[#1D3E85] disabled:opacity-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>+1 دخول سيارة</span>
            </button>
            <button
              type="button"
              disabled={!isAdmin || station.queueCount <= 0}
              onClick={() => onAdjustQueue(station, -1)}
              className="min-h-[68px] rounded-2xl bg-emerald-600 text-white font-bold text-sm flex flex-col items-center justify-center gap-1 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <Minus className="w-5 h-5" />
              <span>-1 خروج سيارة</span>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">عدد المضخات العاملة</h4>
              <p className="text-xs text-slate-500">يؤثر مباشرة على وقت الانتظار المحسوب</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!isAdmin || station.activePumps <= 1}
                onClick={() => onAdjustPumps(station, -1)}
                aria-label="إنقاص مضخة"
                className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-800 hover:bg-slate-50 disabled:opacity-40"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="font-mono-num text-lg font-bold text-slate-900 w-8 text-center">
                {station.activePumps}
              </span>
              <button
                type="button"
                disabled={!isAdmin || station.activePumps >= 12}
                onClick={() => onAdjustPumps(station, 1)}
                aria-label="زيادة مضخة"
                className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-800 hover:bg-slate-50 disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Fuel Availability & Pricing */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Fuel className="w-4 h-4 text-[#2563EB]" />
              <span>تحديث توفر الوقود والأسعار (د.ع / لتر)</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              فعّل أو عطّل أصناف الوقود وحدد السعر المعتمد في المحطة.
            </p>

            <div className="divide-y divide-slate-100">
              {(['b91', 'b95', 'b98'] as FuelGradeKey[]).map((grade) => {
                const entry = fuelDraft[grade];
                return (
                  <div
                    key={grade}
                    className="py-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-900 min-w-[110px]">
                        {FUEL_LABELS[grade].ar}
                      </span>
                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() =>
                          setFuelDraft((prev) => ({
                            ...prev,
                            [grade]: { ...prev[grade], available: !prev[grade].available },
                          }))
                        }
                        className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold border transition-colors disabled:opacity-50 ${
                          entry.available
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-red-50 border-red-200 text-red-700'
                        }`}
                      >
                        {entry.available ? 'متوفر' : 'نفذ'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={50000}
                        step={25}
                        disabled={!isAdmin}
                        value={entry.priceIqd}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(50000, Number(e.target.value) || 0));
                          setFuelDraft((prev) => ({
                            ...prev,
                            [grade]: { ...prev[grade], priceIqd: val },
                          }));
                        }}
                        className="w-28 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 font-mono-num text-sm text-slate-900 text-left focus:outline-none focus:border-[#2563EB] disabled:bg-slate-50"
                        dir="ltr"
                      />
                      <span className="text-xs text-slate-500">د.ع</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {fuelSavedNotice ? (
              <span className="text-xs font-semibold text-emerald-700">
                {fuelSavedNotice}
              </span>
            ) : (
              <span className="text-xs text-slate-400">
                يُحفظ مباشرة في سجل المحطة
              </span>
            )}
            <button
              type="button"
              disabled={!isAdmin || savingFuels}
              onClick={handleSaveFuels}
              className="min-h-[42px] inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#132B5E] text-white text-xs font-bold hover:bg-[#1D3E85] disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{savingFuels ? 'جاري الحفظ...' : 'حفظ الوقود والأسعار'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bookings Table for Selected Station */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              سجل الحجوزات الإلكترونية — {station.nameAr}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              استدعِ السائق للمضخة المحددة لإرسال إشعار فوري إلى تطبيقه.
            </p>
          </div>
        </div>

        {stationBookings.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            لا توجد حجوزات مسجلة لهذه المحطة بعد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">التذكرة</th>
                  <th className="py-3 px-4">السائق</th>
                  <th className="py-3 px-4">الوقود</th>
                  <th className="py-3 px-4">الموعد</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4">إجراءات الموظف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {stationBookings.map((b) => {
                  const chosenPump = pumpChoiceMap[b.id || ''] || 1;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono-num font-bold text-[#132B5E]">
                        {b.ticketNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{b.driverName}</div>
                        {b.driverPhone && (
                          <div className="text-xs text-slate-500 font-mono-num" dir="ltr">
                            {b.driverPhone}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-slate-700">
                        {FUEL_LABELS[b.fuelType].ar}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 font-mono-num">
                        {b.slotDate} · {b.slotTime}
                      </td>
                      <td className="py-3 px-4 text-xs font-bold">
                        {b.status === 'waiting' && (
                          <span className="text-amber-700">قيد الانتظار</span>
                        )}
                        {b.status === 'called' && (
                          <span className="text-[#2563EB]">
                            مستدعى — مضخة {b.pumpNumber}
                          </span>
                        )}
                        {b.status === 'completed' && (
                          <span className="text-emerald-700">مكتمل</span>
                        )}
                        {b.status === 'cancelled' && (
                          <span className="text-slate-400">ملغي</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {(b.status === 'waiting' || b.status === 'called') && (
                            <>
                              <select
                                disabled={!isAdmin}
                                value={chosenPump}
                                onChange={(e) =>
                                  b.id &&
                                  setPumpChoiceMap((prev) => ({
                                    ...prev,
                                    [b.id!]: Number(e.target.value),
                                  }))
                                }
                                className="min-h-[34px] px-2 rounded-lg border border-slate-200 text-xs bg-white"
                              >
                                {Array.from(
                                  { length: station.activePumps },
                                  (_, idx) => idx + 1
                                ).map((p) => (
                                  <option key={p} value={p}>
                                    مضخة {p}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={!isAdmin}
                                onClick={() => onCallBookingToPump(b, chosenPump)}
                                className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-[#1D4ED8] disabled:opacity-40"
                              >
                                <BellRing className="w-3.5 h-3.5" />
                                <span>استدعاء</span>
                              </button>
                              <button
                                type="button"
                                disabled={!isAdmin}
                                onClick={() =>
                                  onStaffUpdateBookingStatus(b, 'completed')
                                }
                                className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>إتمام</span>
                              </button>
                              <button
                                type="button"
                                disabled={!isAdmin}
                                onClick={() =>
                                  onStaffUpdateBookingStatus(b, 'cancelled')
                                }
                                aria-label="إلغاء الحجز"
                                className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
