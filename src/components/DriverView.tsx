import React, { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Bell,
  Bookmark,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Fuel,
  Heart,
  History,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  User as UserIcon,
  XCircle,
} from 'lucide-react';
import {
  BLUEPRINT_CONSTRAINTS,
  Booking,
  CONGESTION_META,
  DriverTab,
  FUEL_LABELS,
  FuelGradeKey,
  NotificationItem,
  Station,
  UserProfile,
} from '../types';
import { KirkukMap } from './KirkukMap';
import { QueueRingGauge } from './QueueRingGauge';
import { StationImage } from './StationImage';

interface DriverViewProps {
  stations: Station[];
  user: User | null;
  isAdmin: boolean;
  profile: UserProfile | null;
  bookings: Booking[];
  favoriteIds: Set<string>;
  notifications: NotificationItem[];
  activeTab: DriverTab;
  onTabChange: (tab: DriverTab) => void;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onOpenStaffPortal: () => void;
  onToggleFavorite: (station: Station) => Promise<void>;
  onCreateBooking: (params: {
    station: Station;
    fuelType: FuelGradeKey;
    slotDate: string;
    slotTime: string;
  }) => Promise<Booking | null>;
  onUpdateBookingStatus: (
    bookingId: string,
    status: 'completed' | 'cancelled'
  ) => Promise<void>;
  onMarkNotificationRead: (notifId: string) => Promise<void>;
  onSaveProfile: (updates: {
    displayName: string;
    phone: string;
    vehiclePlate: string;
    preferredFuel: FuelGradeKey;
  }) => Promise<void>;
}

type StationFilter = 'all' | 'government' | 'private' | 'light';

const TIME_SLOTS = ['الآن (طابور فوري)', '09:00', '10:00', '11:00', '13:00', '16:00', '19:00'];

export const DriverView: React.FC<DriverViewProps> = ({
  stations,
  user,
  isAdmin,
  profile,
  bookings,
  favoriteIds,
  notifications,
  activeTab,
  onTabChange,
  onSignIn,
  onSignOut,
  onOpenStaffPortal,
  onToggleFavorite,
  onCreateBooking,
  onUpdateBookingStatus,
  onMarkNotificationRead,
  onSaveProfile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<StationFilter>('all');
  const [selectedStationId, setSelectedStationId] = useState<string>(
    stations[0]?.id || 'kirkuk-central'
  );
  const [fuelChoice, setFuelChoice] = useState<FuelGradeKey>(
    profile?.preferredFuel || 'b95'
  );
  const [slotDate, setSlotDate] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  });
  const [slotTime, setSlotTime] = useState<string>(TIME_SLOTS[0]);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [bookingFeedback, setBookingFeedback] = useState<string | null>(null);
  const [justCompletedBooking, setJustCompletedBooking] = useState<Booking | null>(null);

  // Profile form state
  const [editName, setEditName] = useState(profile?.displayName || user?.displayName || '');
  const [editPhone, setEditPhone] = useState(profile?.phone || '');
  const [editPlate, setEditPlate] = useState(profile?.vehiclePlate || '');
  const [editFuel, setEditFuel] = useState<FuelGradeKey>(profile?.preferredFuel || 'b95');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState<string | null>(null);

  // Sync profile inputs when profile loads
  React.useEffect(() => {
    if (profile) {
      setEditName(profile.displayName);
      setEditPhone(profile.phone);
      setEditPlate(profile.vehiclePlate);
      setEditFuel(profile.preferredFuel);
      setFuelChoice(profile.preferredFuel);
    } else if (user) {
      setEditName(user.displayName || 'سائق محطتي');
    }
  }, [profile, user]);

  const filteredStations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return stations.filter((s) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'government' && s.type === 'government') ||
        (filter === 'private' && s.type === 'private') ||
        (filter === 'light' && s.congestion === 'light');
      const matchesSearch =
        !q ||
        s.nameAr.toLowerCase().includes(q) ||
        s.nameEn.toLowerCase().includes(q) ||
        s.districtAr.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [stations, filter, searchQuery]);

  const selectedStation = useMemo(
    () =>
      stations.find((s) => s.id === selectedStationId) ||
      filteredStations[0] ||
      stations[0],
    [stations, filteredStations, selectedStationId]
  );

  const activeBooking = useMemo(
    () => bookings.find((b) => b.status === 'called' || b.status === 'waiting') || null,
    [bookings]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const favoriteStations = useMemo(
    () => stations.filter((s) => favoriteIds.has(s.id)),
    [stations, favoriteIds]
  );

  const handleBookNow = async () => {
    if (!selectedStation) return;
    if (!user) {
      await onSignIn();
      return;
    }
    setSubmittingBooking(true);
    setBookingFeedback(null);
    try {
      const created = await onCreateBooking({
        station: selectedStation,
        fuelType: fuelChoice,
        slotDate,
        slotTime,
      });
      if (created) {
        setJustCompletedBooking(null);
        setBookingFeedback(`تم تأكيد حجزك بنجاح برقم التذكرة ${created.ticketNumber}`);
        onTabChange('booking');
      }
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleCompleteBooking = async (booking: Booking) => {
    if (!booking.id) return;
    await onUpdateBookingStatus(booking.id, 'completed');
    setJustCompletedBooking({ ...booking, status: 'completed' });
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      await onSignIn();
      return;
    }
    setSavingProfile(true);
    setProfileSavedMsg(null);
    try {
      await onSaveProfile({
        displayName: editName || user.displayName || 'سائق محطتي',
        phone: editPhone,
        vehiclePlate: editPlate,
        preferredFuel: editFuel,
      });
      setProfileSavedMsg('تم حفظ بيانات السائق بنجاح');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="pb-24 md:pb-10">
      {/* Compact Welcome Hero Strip when guest or on Map tab */}
      {!user && activeTab === 'map' && (
        <section className="mb-6 rounded-2xl bg-gradient-to-l from-[#0B1C3E] via-[#132B5E] to-[#1D4ED8] text-white p-6 sm:p-7 border border-[#1E3A8A]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-blue-200 mb-2">
                معك في كل محطة · رحلتك أسهل ووقتك أغلى
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug mb-2">
                تطبيق ذكي لتنظيم محطات الوقود ومعرفة وقت الانتظار بدقة
              </h1>
              <p className="text-sm text-blue-100/90 leading-relaxed">
                تصفح محطات كركوك مباشرة، تابع عدد السيارات ووقت الانتظار الفعلي، واحجز دورك إلكترونياً قبل الوصول.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onSignIn}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[#0B1C3E] text-sm font-bold hover:bg-blue-50 transition-colors whitespace-nowrap shrink-0"
              >
                <LogIn className="w-4 h-4" />
                <span>تسجيل الدخول بحساب Google</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Desktop Sub-Navigation Bar for Driver Journey */}
      <div className="hidden md:flex items-center justify-between gap-4 mb-6 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2 p-1 bg-slate-200/70 rounded-xl">
          {(
            [
              { id: 'map', label: 'الخريطة والمحطات', icon: MapPin },
              {
                id: 'booking',
                label: activeBooking ? `دوري (${activeBooking.ticketNumber})` : 'حجوزاتي',
                icon: Ticket,
              },
              { id: 'favorites', label: `المفضلة (${favoriteStations.length})`, icon: Heart },
              {
                id: 'notifications',
                label: unreadCount > 0 ? `الإشعارات (${unreadCount})` : 'الإشعارات',
                icon: Bell,
              },
              { id: 'profile', label: 'حسابي', icon: UserIcon },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white text-[#132B5E] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {activeBooking && (
          <button
            type="button"
            onClick={() => onTabChange('booking')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EEF4FF] border border-[#BFDBFE] text-[#132B5E] text-xs font-bold hover:bg-[#DBEAFE] transition-colors whitespace-nowrap shrink-0"
          >
            <Clock className="w-4 h-4 text-[#2563EB]" />
            <span>
              حجز نشط {activeBooking.ticketNumber} — {activeBooking.stationNameAr}
            </span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* TAB 1: MAP + STATION LIST + STATION INSPECTOR & BOOKING */}
      {activeTab === 'map' && (
        <div className="space-y-6">
          {/* Search & Filter Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن محطة وقود في كركوك..."
                className="w-full min-h-[44px] pr-10 pl-4 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'الكل' },
                  { id: 'government', label: 'حكومية' },
                  { id: 'private', label: 'أهلية' },
                  { id: 'light', label: 'طابور خفيف' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    filter === tab.id
                      ? 'bg-white text-[#132B5E] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main 2-Column Workspace: Map + Station Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Map + Nearby List Column */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              <KirkukMap
                stations={filteredStations.length > 0 ? filteredStations : stations}
                selectedStationId={selectedStation?.id || ''}
                onSelectStation={(id) => setSelectedStationId(id)}
              />

              {/* Nearby Stations Cards */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-slate-900">
                    المحطات القريبة منك ({filteredStations.length})
                  </h2>
                  <span className="text-xs text-slate-500">تحديث مباشر عبر Firestore</span>
                </div>

                {filteredStations.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-500">
                    لا توجد محطات مطابقة لبحثك. جرّب إزالة التصفية.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredStations.map((station) => {
                      const isSelected = station.id === selectedStation?.id;
                      const meta = CONGESTION_META[station.congestion];
                      const isFav = favoriteIds.has(station.id);

                      return (
                        <div
                          key={station.id}
                          onClick={() => setSelectedStationId(station.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedStationId(station.id);
                            }
                          }}
                          className={`py-3.5 px-3 -mx-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#EEF4FF]' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <StationImage
                              imageKey={station.imageKey}
                              alt={station.nameAr}
                              className="w-16 h-14 rounded-xl shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-slate-900 truncate">
                                  {station.nameAr}
                                </h3>
                                {!station.isOpen && (
                                  <span className="text-xs font-semibold text-red-600">
                                    مغلقة
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span>{station.type === 'government' ? 'حكومية' : 'أهلية'}</span>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">{station.distanceKm.toFixed(1)} كم</span>
                                <span aria-hidden="true">·</span>
                                <span className={`font-semibold ${meta.badgeTextClass}`}>
                                  {meta.labelAr}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-left">
                              <div className="font-mono-num text-sm font-bold text-slate-900">
                                {station.waitMinutes} د
                              </div>
                              <div className="text-[11px] text-slate-500 tabular-nums">
                                {station.queueCount} سيارة
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite(station);
                              }}
                              aria-label={isFav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
                              className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center hover:bg-white transition-colors"
                            >
                              <Heart
                                className={`w-4 h-4 ${
                                  isFav ? 'fill-red-500 text-red-500' : 'text-slate-400'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Station Details, Queue Gauge & Electronic Booking Column */}
            {selectedStation && (
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="relative h-48 w-full">
                  <StationImage
                    imageKey={selectedStation.imageKey}
                    alt={selectedStation.nameAr}
                    className="w-full h-full"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-transparent" />
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(selectedStation)}
                    aria-label="حفظ في المفضلة"
                    className="absolute top-3 left-3 min-w-[44px] min-h-[44px] rounded-xl bg-white/90 backdrop-blur-sm flex items-center justify-center text-slate-800 hover:bg-white transition-colors"
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        favoriteIds.has(selectedStation.id)
                          ? 'fill-red-500 text-red-500'
                          : 'text-slate-700'
                      }`}
                    />
                  </button>
                  <div className="absolute bottom-3 right-4 left-4 text-white">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-xl font-bold truncate">{selectedStation.nameAr}</h2>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-black/40 px-2.5 py-1 rounded-lg">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="tabular-nums">{selectedStation.rating.toFixed(1)}</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 mt-0.5">
                      {selectedStation.districtAr} · {selectedStation.type === 'government' ? 'محطة حكومية' : 'محطة أهلية'}
                    </p>
                  </div>
                </div>

                <div className="p-5 sm:p-6 flex-1 flex flex-col gap-6">
                  {/* Live Queue Gauge */}
                  <div className="py-4 px-3 rounded-2xl bg-[#F8FAFC] border border-slate-100">
                    <QueueRingGauge
                      queueCount={selectedStation.queueCount}
                      waitMinutes={selectedStation.waitMinutes}
                      congestion={selectedStation.congestion}
                      activePumps={selectedStation.activePumps}
                    />
                  </div>

                  {/* Station Info & Fuel Prices */}
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-500 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#2563EB]" />
                        ساعات العمل
                      </span>
                      <span className="font-medium text-slate-900">{selectedStation.hoursAr}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-500 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-[#2563EB]" />
                        رقم المحطة
                      </span>
                      <span className="font-mono-num font-medium text-slate-900" dir="ltr">
                        {selectedStation.contactPhone}
                      </span>
                    </div>

                    <div className="pt-1">
                      <span className="block text-xs font-semibold text-slate-500 mb-2">
                        اختر نوع الوقود المتوفر للحجز:
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {(['b91', 'b95', 'b98'] as FuelGradeKey[]).map((grade) => {
                          const info = selectedStation.fuels[grade];
                          const selected = fuelChoice === grade;
                          return (
                            <button
                              key={grade}
                              type="button"
                              disabled={!info.available}
                              onClick={() => setFuelChoice(grade)}
                              className={`min-h-[56px] p-2.5 rounded-xl border text-center transition-colors ${
                                !info.available
                                  ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                                  : selected
                                  ? 'bg-[#EEF4FF] border-[#2563EB] text-[#132B5E]'
                                  : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                              }`}
                            >
                              <div className="text-xs font-bold">{FUEL_LABELS[grade].ar}</div>
                              <div className="font-mono-num text-[11px] mt-0.5">
                                {info.available ? `${info.priceIqd} د.ع` : 'غير متوفر'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Electronic Queue Booking Controls */}
                  <div className="space-y-3 pt-2 border-t border-slate-100 mt-auto">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          تاريخ الحجز
                        </label>
                        <input
                          type="date"
                          value={slotDate}
                          onChange={(e) => setSlotDate(e.target.value)}
                          className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono-num text-slate-800 bg-white focus:outline-none focus:border-[#2563EB]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          الموعد المناسب
                        </label>
                        <select
                          value={slotTime}
                          onChange={(e) => setSlotTime(e.target.value)}
                          className="w-full min-h-[42px] px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:border-[#2563EB]"
                        >
                          {TIME_SLOTS.map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {bookingFeedback && (
                      <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                        {bookingFeedback}
                      </p>
                    )}

                    <button
                      type="button"
                      disabled={
                        submittingBooking ||
                        !selectedStation.isOpen ||
                        !selectedStation.fuels[fuelChoice]?.available
                      }
                      onClick={handleBookNow}
                      className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#132B5E] text-white text-sm font-bold hover:bg-[#1D3E85] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Ticket className="w-4 h-4" />
                      <span>
                        {!user
                          ? 'سجّل دخولك لحجز الدور'
                          : submittingBooking
                          ? 'جاري تأكيد الحجز...'
                          : 'احجز دورك إلكترونياً'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE QUEUE TRACKER, COMPLETION SCREEN & MY BOOKINGS */}
      {activeTab === 'booking' && (
        <div className="space-y-6">
          {!user ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center max-w-lg mx-auto">
              <Ticket className="w-10 h-10 text-[#2563EB] mx-auto mb-3" />
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                سجّل دخولك لمتابعة حجوزاتك ودورك المباشر
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                يتم حفظ تذاكر الحجز وإشعارات المضخات في حسابك عبر Firebase Firestore.
              </p>
              <button
                type="button"
                onClick={onSignIn}
                className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#132B5E] text-white text-sm font-bold hover:bg-[#1D3E85] transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>تسجيل الدخول بحساب Google</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Active Turn or Completion Screen */}
              <div className="lg:col-span-6">
                {justCompletedBooking ? (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="h-52 relative">
                      <StationImage
                        imageKey="complete"
                        alt="تم التزود بالوقود بنجاح"
                        className="w-full h-full"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
                      <div className="absolute bottom-4 right-5 text-white flex items-center gap-2">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                        <span className="font-bold text-lg">تمت العملية بنجاح</span>
                      </div>
                    </div>
                    <div className="p-6 text-center space-y-4">
                      <h2 className="text-2xl font-bold text-slate-900">
                        تم التزود بالوقود بنجاح
                      </h2>
                      <p className="text-sm text-slate-600">
                        شكراً لاستخدامك تطبيق محطتي في {justCompletedBooking.stationNameAr}. نتمنى لك رحلة آمنة!
                      </p>
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm flex items-center justify-between">
                        <span className="text-slate-500">رقم التذكرة المكتملة</span>
                        <span className="font-mono-num font-bold text-slate-900">
                          {justCompletedBooking.ticketNumber}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setJustCompletedBooking(null);
                          onTabChange('map');
                        }}
                        className="w-full min-h-[46px] rounded-xl bg-[#132B5E] text-white text-sm font-bold hover:bg-[#1D3E85] transition-colors"
                      >
                        العودة إلى الخريطة
                      </button>
                    </div>
                  </div>
                ) : activeBooking ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-1">
                          متابعة الدور المباشر
                        </p>
                        <h2 className="text-xl font-bold text-slate-900">
                          {activeBooking.stationNameAr}
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                          {FUEL_LABELS[activeBooking.fuelType].ar} · {activeBooking.slotDate} ·{' '}
                          {activeBooking.slotTime}
                        </p>
                      </div>
                      <div className="px-3.5 py-2 rounded-xl bg-[#EEF4FF] border border-[#BFDBFE] text-center">
                        <div className="text-[11px] text-[#1D4ED8] font-semibold">رقم الحجز</div>
                        <div className="font-mono-num text-lg font-bold text-[#132B5E]">
                          {activeBooking.ticketNumber}
                        </div>
                      </div>
                    </div>

                    {/* Pump Called Banner */}
                    {activeBooking.status === 'called' && activeBooking.pumpNumber > 0 ? (
                      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Bell className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-emerald-950">
                            دورك الآن! يرجى التوجه إلى المضخة رقم ({activeBooking.pumpNumber})
                          </h3>
                          <p className="text-xs text-emerald-800 mt-0.5">
                            بإمكانك تأكيد إتمام التزود بالوقود فور الانتهاء.
                          </p>
                        </div>
                      </div>
                    ) : (
                      (() => {
                        const liveStation = stations.find(
                          (s) => s.id === activeBooking.stationId
                        );
                        return (
                          <div className="py-4 px-3 rounded-2xl bg-[#F8FAFC] border border-slate-100">
                            <QueueRingGauge
                              size="lg"
                              queueCount={liveStation?.queueCount ?? 4}
                              waitMinutes={
                                liveStation?.waitMinutes ?? activeBooking.estimatedWaitMinutes
                              }
                              congestion={liveStation?.congestion ?? 'light'}
                              activePumps={liveStation?.activePumps ?? 4}
                            />
                          </div>
                        );
                      })()
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => handleCompleteBooking(activeBooking)}
                        className="min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تأكيد إتمام التزود</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          activeBooking.id &&
                          onUpdateBookingStatus(activeBooking.id, 'cancelled')
                        }
                        className="min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
                      >
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span>إلغاء الحجز</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                    <Sparkles className="w-9 h-9 text-[#2563EB] mx-auto mb-3" />
                    <h2 className="text-lg font-bold text-slate-900 mb-1">
                      لا يوجد حجز نشط حالياً
                    </h2>
                    <p className="text-sm text-slate-500 mb-5">
                      اختر أقرب محطة وقود من الخريطة واحجز دورك في ثوانٍ لتجنب الانتظار.
                    </p>
                    <button
                      type="button"
                      onClick={() => onTabChange('map')}
                      className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#132B5E] text-white text-sm font-bold hover:bg-[#1D3E85] transition-colors"
                    >
                      <Navigation className="w-4 h-4" />
                      <span>استعراض المحطات</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Booking History List */}
              <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <History className="w-4 h-4 text-[#2563EB]" />
                    <span>سجل حجوزاتي ({bookings.length})</span>
                  </h3>
                </div>

                {bookings.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">
                    لم تقم بأي حجوزات بعد.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {bookings.map((b) => {
                      const statusLabel =
                        b.status === 'called'
                          ? `تم الاستدعاء — مضخة ${b.pumpNumber}`
                          : b.status === 'waiting'
                          ? 'في الطابور'
                          : b.status === 'completed'
                          ? 'مكتمل'
                          : 'ملغي';
                      const statusColor =
                        b.status === 'completed'
                          ? 'text-emerald-700'
                          : b.status === 'called'
                          ? 'text-[#2563EB]'
                          : b.status === 'waiting'
                          ? 'text-amber-700'
                          : 'text-slate-400';

                      return (
                        <div key={b.id} className="py-3.5 flex items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono-num text-sm font-bold text-slate-900">
                                {b.ticketNumber}
                              </span>
                              <span className="text-sm font-semibold text-slate-800">
                                {b.stationNameAr}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500 flex items-center gap-2">
                              <span>{FUEL_LABELS[b.fuelType].ar}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-num">{b.slotDate}</span>
                              <span aria-hidden="true">·</span>
                              <span>{b.slotTime}</span>
                            </div>
                          </div>
                          <span className={`text-xs font-bold whitespace-nowrap ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FAVORITE STATIONS */}
      {activeTab === 'favorites' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-[#2563EB]" />
              <span>المحطات المفضلة</span>
            </h2>
          </div>

          {!user ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-500 mb-4">
                سجّل دخولك لحفظ محطاتك المفضلة ومزامنتها عبر أجهزتك.
              </p>
              <button
                type="button"
                onClick={onSignIn}
                className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#132B5E] text-white text-sm font-bold"
              >
                <LogIn className="w-4 h-4" />
                <span>تسجيل الدخول بحساب Google</span>
              </button>
            </div>
          ) : favoriteStations.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-slate-500">
                لا توجد محطات في المفضلة بعد. اضغط على أيقونة القلب بجانب أي محطة لحفظها هنا.
              </p>
              <button
                type="button"
                onClick={() => onTabChange('map')}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#EEF4FF] text-[#132B5E] text-sm font-semibold"
              >
                استكشاف المحطات
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {favoriteStations.map((station) => (
                <div
                  key={station.id}
                  className="rounded-2xl border border-slate-200 overflow-hidden flex flex-col"
                >
                  <StationImage
                    imageKey={station.imageKey}
                    alt={station.nameAr}
                    className="h-36 w-full"
                  />
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{station.nameAr}</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {station.districtAr} · {station.queueCount} سيارة · ~{station.waitMinutes} دقيقة
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStationId(station.id);
                          onTabChange('map');
                        }}
                        className="flex-1 min-h-[40px] rounded-xl bg-[#132B5E] text-white text-xs font-bold hover:bg-[#1D3E85]"
                      >
                        عرض وحجز
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(station)}
                        aria-label="إزالة من المفضلة"
                        className="min-w-[40px] min-h-[40px] rounded-xl border border-slate-200 flex items-center justify-center text-red-500 hover:bg-red-50"
                      >
                        <Heart className="w-4 h-4 fill-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#2563EB]" />
              <span>الإشعارات والتنبيهات الفورية</span>
            </h2>
          </div>

          {!user ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-500 mb-4">
                سجّل دخولك لاستلام تنبيهات استدعاء المضخة وتحديثات الطوابير.
              </p>
              <button
                type="button"
                onClick={onSignIn}
                className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#132B5E] text-white text-sm font-bold"
              >
                <LogIn className="w-4 h-4" />
                <span>تسجيل الدخول</span>
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              لا توجد إشعارات حالياً. ستصلك التنبيهات تلقائياً عند الحجز أو اقتراب دورك.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`py-4 px-3 -mx-3 rounded-xl flex items-start justify-between gap-4 ${
                    notif.isRead ? 'opacity-75' : 'bg-[#EEF4FF]/60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        notif.kind === 'queue_called'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-blue-100 text-[#2563EB]'
                      }`}
                    >
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{notif.titleAr}</h3>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {notif.messageAr}
                      </p>
                    </div>
                  </div>
                  {!notif.isRead && notif.id && (
                    <button
                      type="button"
                      onClick={() => notif.id && onMarkNotificationRead(notif.id)}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-[#132B5E] hover:bg-slate-50 shrink-0"
                    >
                      موافق
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: DRIVER PROFILE */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl mx-auto">
          {!user ? (
            <div className="py-10 text-center">
              <UserIcon className="w-10 h-10 text-[#2563EB] mx-auto mb-3" />
              <h2 className="text-lg font-bold text-slate-900 mb-2">حساب السائق</h2>
              <p className="text-sm text-slate-500 mb-6">
                سجّل الدخول بحساب Google لإدارة بيانات سيارتك ونوع الوقود المفضل.
              </p>
              <button
                type="button"
                onClick={onSignIn}
                className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#132B5E] text-white text-sm font-bold"
              >
                <LogIn className="w-4 h-4" />
                <span>تسجيل الدخول بحساب Google</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleProfileSubmit} className="space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#132B5E] text-white flex items-center justify-center font-bold text-lg">
                    {(editName || user.email || 'م').slice(0, 1)}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {editName || user.displayName || 'سائق محطتي'}
                    </h2>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onSignOut}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span>تسجيل الخروج</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    الاسم الكامل
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={BLUEPRINT_CONSTRAINTS.maxNameLength}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    رقم الهاتف
                  </label>
                  <input
                    type="tel"
                    maxLength={BLUEPRINT_CONSTRAINTS.maxPhoneLength}
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="0770 000 0000"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-mono-num focus:outline-none focus:border-[#2563EB]"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    رقم لوحة المركبة
                  </label>
                  <input
                    type="text"
                    maxLength={BLUEPRINT_CONSTRAINTS.maxPlateLength}
                    value={editPlate}
                    onChange={(e) => setEditPlate(e.target.value)}
                    placeholder="كركوك 14258 أ"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    الوقود المفضل
                  </label>
                  <select
                    value={editFuel}
                    onChange={(e) => setEditFuel(e.target.value as FuelGradeKey)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#2563EB]"
                  >
                    <option value="b91">بنزين 91</option>
                    <option value="b95">بنزين 95</option>
                    <option value="b98">بنزين 98 محسن</option>
                  </select>
                </div>
              </div>

              {profileSavedMsg && (
                <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                  {profileSavedMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={savingProfile}
                className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#132B5E] text-white text-sm font-bold hover:bg-[#1D3E85] disabled:opacity-50 transition-colors"
              >
                {savingProfile ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>

              {isAdmin && (
                <div className="pt-5 mt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
                    <span>حسابك يملك صلاحية إدارة المحطة</span>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenStaffPortal}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#EEF4FF] text-[#132B5E] text-xs font-bold hover:bg-[#DBEAFE] transition-colors"
                  >
                    الانتقال إلى بوابة موظف المحطة (/staff)
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      )}

      {/* Mobile Fixed Bottom Thumb Navigation Bar (<= 15% height) */}
      <nav
        aria-label="التنقل السريع للسائق"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200"
      >
        <div className="grid grid-cols-5 h-16 items-center">
          {(
            [
              { id: 'map', label: 'الخريطة', icon: MapPin },
              { id: 'booking', label: 'دوري', icon: Calendar },
              { id: 'favorites', label: 'المفضلة', icon: Heart },
              { id: 'notifications', label: 'الإشعارات', icon: Bell },
              { id: 'profile', label: 'حسابي', icon: Fuel },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? 'text-[#2563EB]' : 'text-slate-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
