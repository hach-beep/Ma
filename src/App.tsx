import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  ADMIN_EMAIL,
  auth,
  clampInt,
  clampStr,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  sanitizeId,
  testConnection,
} from './firebase';
import {
  computeCongestion,
  computeWaitMinutes,
  INITIAL_KIRKUK_STATIONS,
} from './data/initialStations';
import {
  AppMode,
  BLUEPRINT_CONSTRAINTS,
  Booking,
  DriverTab,
  FuelGrade,
  FuelGradeKey,
  NotificationItem,
  Station,
  UserProfile,
} from './types';
import { DriverView } from './components/DriverView';
import { StaffDashboard } from './components/StaffDashboard';
import { StationDisplay } from './components/StationDisplay';

function toMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts) {
    const fn = (ts as { toMillis?: () => number }).toMillis;
    if (typeof fn === 'function') return fn();
  }
  return 0;
}

export default function App() {
  const [mode, setMode] = useState<AppMode>('driver');
  const [driverTab, setDriverTab] = useState<DriverTab>('map');

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [firestoreStations, setFirestoreStations] = useState<Station[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [authError, setAuthError] = useState<string | null>(null);
  const [seededOnce, setSeededOnce] = useState(false);

  // Check Firestore connectivity on boot
  useEffect(() => {
    void testConnection();
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        const verifiedEmail =
          nextUser.emailVerified && nextUser.email === ADMIN_EMAIL;
        if (verifiedEmail) {
          setIsAdmin(true);
        } else {
          try {
            const adminDoc = await getDoc(doc(db, 'admins', nextUser.uid));
            setIsAdmin(nextUser.emailVerified && adminDoc.exists());
          } catch {
            setIsAdmin(false);
          }
        }
      } else {
        setIsAdmin(false);
        setProfile(null);
        setBookings([]);
        setFavoriteIds(new Set());
        setNotifications([]);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Live Stations listener (public non-PII infrastructure telemetry)
  useEffect(() => {
    const stationsPath = 'stations';
    const q = query(
      collection(db, stationsPath),
      where('isOpen', 'in', [true, false])
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: Station[] = snapshot.docs.map((d) => d.data() as Station);
        list.sort((a, b) => a.distanceKm - b.distanceKm);
        setFirestoreStations(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, stationsPath);
      }
    );
    return () => unsub();
  }, []);

  // Auto-create UserProfile on first verified sign-in
  useEffect(() => {
    if (!authReady || !user) return;
    const userPath = `users/${user.uid}`;
    const userRef = doc(db, 'users', user.uid);

    const unsub = onSnapshot(
      userRef,
      async (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        } else if (user.emailVerified) {
          const initialProfile: UserProfile = {
            uid: user.uid,
            displayName: clampStr(
              user.displayName || 'سائق محطتي',
              BLUEPRINT_CONSTRAINTS.maxNameLength
            ),
            email: clampStr(
              user.email || 'driver@mahattati.iq',
              BLUEPRINT_CONSTRAINTS.maxEmailLength
            ),
            phone: '',
            vehiclePlate: '',
            preferredFuel: 'b95',
            role: 'driver',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          try {
            await setDoc(userRef, initialProfile);
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, userPath);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, userPath);
      }
    );

    return () => unsub();
  }, [authReady, user]);

  // Favorites listener
  useEffect(() => {
    if (!authReady || !user) return;
    const favPath = `users/${user.uid}/favorites`;
    const q = query(
      collection(db, 'users', user.uid, 'favorites'),
      where('userId', '==', user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const ids = new Set<string>();
        snap.docs.forEach((d) => ids.add(d.id));
        setFavoriteIds(ids);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, favPath);
      }
    );
    return () => unsub();
  }, [authReady, user]);

  // Notifications listener
  useEffect(() => {
    if (!authReady || !user) return;
    const notifPath = `users/${user.uid}/notifications`;
    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      where('userId', '==', user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: NotificationItem[] = snap.docs.map((d) => ({
          ...(d.data() as NotificationItem),
          id: d.id,
        }));
        items.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setNotifications(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, notifPath);
      }
    );
    return () => unsub();
  }, [authReady, user]);

  // Bookings listener (Admin sees all bookings; Driver sees own bookings)
  useEffect(() => {
    if (!authReady || !user) return;
    const bookingsPath = 'bookings';
    const q = isAdmin
      ? collection(db, bookingsPath)
      : query(collection(db, bookingsPath), where('userId', '==', user.uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Booking[] = snap.docs.map((d) => ({
          ...(d.data() as Booking),
          id: d.id,
        }));
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setBookings(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, bookingsPath);
      }
    );
    return () => unsub();
  }, [authReady, user, isAdmin]);

  // Seed Kirkuk stations into Firestore automatically if admin signs in and collection is empty
  const seedStationsToFirestore = useCallback(async () => {
    if (!user || !isAdmin) return;
    try {
      const batch = writeBatch(db);
      INITIAL_KIRKUK_STATIONS.forEach((st) => {
        const ref = doc(db, 'stations', st.id);
        batch.set(ref, {
          ...st,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      setSeededOnce(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'stations');
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (
      authReady &&
      user &&
      isAdmin &&
      !seededOnce &&
      firestoreStations.length === 0
    ) {
      setSeededOnce(true);
      void seedStationsToFirestore();
    }
  }, [authReady, user, isAdmin, seededOnce, firestoreStations.length, seedStationsToFirestore]);

  // Displayed stations (live Firestore when populated, otherwise initial Kirkuk catalog)
  const stations = useMemo(
    () =>
      firestoreStations.length > 0 ? firestoreStations : INITIAL_KIRKUK_STATIONS,
    [firestoreStations]
  );

  // Actions
  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError('تعذر إتمام تسجيل الدخول عبر Google. يرجى المحاولة مرة أخرى.');
      }
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const ensureStationExistsInFirestore = async (station: Station) => {
    if (firestoreStations.some((s) => s.id === station.id)) return true;
    if (!isAdmin) return false;
    await seedStationsToFirestore();
    return true;
  };

  const handleToggleFavorite = async (station: Station) => {
    if (!user) {
      await handleSignIn();
      return;
    }
    const favId = sanitizeId(station.id);
    const favPath = `users/${user.uid}/favorites/${favId}`;
    const favRef = doc(db, 'users', user.uid, 'favorites', favId);

    try {
      if (favoriteIds.has(station.id)) {
        await deleteDoc(favRef);
      } else {
        await ensureStationExistsInFirestore(station);
        await setDoc(favRef, {
          userId: user.uid,
          stationId: favId,
          stationNameAr: clampStr(station.nameAr, BLUEPRINT_CONSTRAINTS.maxNameLength),
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, favPath);
    }
  };

  const handleCreateBooking = async (params: {
    station: Station;
    fuelType: FuelGradeKey;
    slotDate: string;
    slotTime: string;
  }): Promise<Booking | null> => {
    if (!user) return null;
    await ensureStationExistsInFirestore(params.station);

    const bookingId = sanitizeId(`bk_${Date.now()}_${Math.floor(Math.random() * 900 + 100)}`);
    const ticketNum = `#${Math.floor(1000 + Math.random() * 8999)}`;
    const bookingPath = `bookings/${bookingId}`;

    const payload: Booking = {
      userId: user.uid,
      driverName: clampStr(
        profile?.displayName || user.displayName || 'سائق محطتي',
        BLUEPRINT_CONSTRAINTS.maxNameLength
      ),
      driverPhone: clampStr(profile?.phone || '', BLUEPRINT_CONSTRAINTS.maxPhoneLength),
      stationId: sanitizeId(params.station.id),
      stationNameAr: clampStr(
        params.station.nameAr,
        BLUEPRINT_CONSTRAINTS.maxNameLength
      ),
      ticketNumber: ticketNum,
      fuelType: params.fuelType,
      slotDate: clampStr(params.slotDate, 20),
      slotTime: clampStr(params.slotTime, 20),
      status: 'waiting',
      pumpNumber: 0,
      estimatedWaitMinutes: clampInt(
        params.station.waitMinutes,
        0,
        BLUEPRINT_CONSTRAINTS.maxWaitMinutes
      ),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'bookings', bookingId), payload);

      // Also deliver confirmation notification to driver
      const notifId = sanitizeId(`nt_${Date.now()}`);
      await setDoc(doc(db, 'users', user.uid, 'notifications', notifId), {
        userId: user.uid,
        stationId: sanitizeId(params.station.id),
        titleAr: `تم تأكيد الحجز ${ticketNum}`,
        messageAr: `تم تسجيل دورك في ${params.station.nameAr} (${params.slotTime}). وقت الانتظار المتوقع ~${params.station.waitMinutes} دقيقة.`,
        kind: 'booking_confirmed',
        pumpNumber: 0,
        isRead: false,
        createdAt: serverTimestamp(),
      });

      return { ...payload, id: bookingId };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, bookingPath);
    }
  };

  const handleDriverUpdateBookingStatus = async (
    bookingId: string,
    status: 'completed' | 'cancelled'
  ) => {
    const path = `bookings/${bookingId}`;
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleMarkNotificationRead = async (notifId: string) => {
    if (!user) return;
    const path = `users/${user.uid}/notifications/${notifId}`;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'notifications', notifId), {
        isRead: true,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleSaveProfile = async (updates: {
    displayName: string;
    phone: string;
    vehiclePlate: string;
    preferredFuel: FuelGradeKey;
  }) => {
    if (!user) return;
    const path = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: clampStr(updates.displayName, BLUEPRINT_CONSTRAINTS.maxNameLength),
        phone: clampStr(updates.phone, BLUEPRINT_CONSTRAINTS.maxPhoneLength),
        vehiclePlate: clampStr(updates.vehiclePlate, BLUEPRINT_CONSTRAINTS.maxPlateLength),
        preferredFuel: updates.preferredFuel,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  // Staff actions
  const handleAdjustQueue = async (station: Station, delta: number) => {
    if (!isAdmin) return;
    await ensureStationExistsInFirestore(station);
    const nextQueue = clampInt(
      station.queueCount + delta,
      0,
      BLUEPRINT_CONSTRAINTS.maxQueueCount
    );
    const nextServed =
      delta < 0 && station.queueCount > 0 ? station.servedToday + 1 : station.servedToday;
    const nextWait = computeWaitMinutes(nextQueue, station.activePumps);
    const nextCongestion = computeCongestion(nextQueue, station.activePumps);
    const path = `stations/${station.id}`;

    try {
      await updateDoc(doc(db, 'stations', station.id), {
        queueCount: nextQueue,
        servedToday: clampInt(nextServed, 0, 10000),
        waitMinutes: nextWait,
        congestion: nextCongestion,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleAdjustPumps = async (station: Station, delta: number) => {
    if (!isAdmin) return;
    await ensureStationExistsInFirestore(station);
    const nextPumps = clampInt(
      station.activePumps + delta,
      BLUEPRINT_CONSTRAINTS.minPumps,
      12
    );
    const nextWait = computeWaitMinutes(station.queueCount, nextPumps);
    const nextCongestion = computeCongestion(station.queueCount, nextPumps);
    const path = `stations/${station.id}`;

    try {
      await updateDoc(doc(db, 'stations', station.id), {
        activePumps: nextPumps,
        waitMinutes: nextWait,
        congestion: nextCongestion,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleToggleStationOpen = async (station: Station) => {
    if (!isAdmin) return;
    await ensureStationExistsInFirestore(station);
    const path = `stations/${station.id}`;
    try {
      await updateDoc(doc(db, 'stations', station.id), {
        isOpen: !station.isOpen,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleUpdateFuels = async (
    station: Station,
    fuels: Record<FuelGradeKey, FuelGrade>
  ) => {
    if (!isAdmin) return;
    await ensureStationExistsInFirestore(station);
    const sanitizedFuels: Record<FuelGradeKey, FuelGrade> = {
      b91: {
        available: Boolean(fuels.b91.available),
        priceIqd: clampInt(fuels.b91.priceIqd, 0, BLUEPRINT_CONSTRAINTS.maxPriceIqd),
      },
      b95: {
        available: Boolean(fuels.b95.available),
        priceIqd: clampInt(fuels.b95.priceIqd, 0, BLUEPRINT_CONSTRAINTS.maxPriceIqd),
      },
      b98: {
        available: Boolean(fuels.b98.available),
        priceIqd: clampInt(fuels.b98.priceIqd, 0, BLUEPRINT_CONSTRAINTS.maxPriceIqd),
      },
    };
    const path = `stations/${station.id}`;
    try {
      await updateDoc(doc(db, 'stations', station.id), {
        fuels: sanitizedFuels,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleCallBookingToPump = async (booking: Booking, pumpNumber: number) => {
    if (!isAdmin || !booking.id) return;
    const bookingPath = `bookings/${booking.id}`;
    const safePump = clampInt(pumpNumber, 1, BLUEPRINT_CONSTRAINTS.maxPumps);
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'called',
        pumpNumber: safePump,
        estimatedWaitMinutes: 0,
        updatedAt: serverTimestamp(),
      });

      const notifId = sanitizeId(`nt_${Date.now()}`);
      await setDoc(doc(db, 'users', booking.userId, 'notifications', notifId), {
        userId: booking.userId,
        stationId: sanitizeId(booking.stationId),
        titleAr: `دورك الآن! تذكرة ${booking.ticketNumber}`,
        messageAr: `يرجى التوجه فوراً إلى المضخة رقم (${safePump}) في ${booking.stationNameAr}.`,
        kind: 'queue_called',
        pumpNumber: safePump,
        isRead: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, bookingPath);
    }
  };

  const handleStaffUpdateBookingStatus = async (
    booking: Booking,
    status: 'completed' | 'cancelled'
  ) => {
    if (!isAdmin || !booking.id) return;
    const bookingPath = `bookings/${booking.id}`;
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status,
        pumpNumber: booking.pumpNumber,
        estimatedWaitMinutes: booking.estimatedWaitMinutes,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, bookingPath);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#F4F7FC] text-[#0F172A]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setMode('driver');
              setDriverTab('map');
            }}
            className="font-display text-xl font-extrabold tracking-tight text-[#132B5E] whitespace-nowrap shrink-0"
          >
            محطتي
          </a>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav className="flex items-center gap-4 sm:gap-7 text-xs sm:text-sm font-semibold text-slate-600 overflow-x-auto">
            <button
              type="button"
              onClick={() => setMode('driver')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                mode === 'driver'
                  ? 'border-[#2563EB] text-[#132B5E]'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              تطبيق السائق
            </button>
            <button
              type="button"
              onClick={() => setMode('staff')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                mode === 'staff'
                  ? 'border-[#2563EB] text-[#132B5E]'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              لوحة الموظف
            </button>
            <button
              type="button"
              onClick={() => setMode('display')}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                mode === 'display'
                  ? 'border-[#2563EB] text-[#132B5E]'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              شاشة المحطة
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => {
                  setMode('driver');
                  setDriverTab('profile');
                }}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#EEF4FF] text-[#132B5E] text-xs font-bold hover:bg-[#DBEAFE] transition-colors whitespace-nowrap shrink-0"
              >
                {clampStr(profile?.displayName || user.displayName || 'حسابي', 18)}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSignIn}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#132B5E] text-white text-xs font-bold hover:bg-[#1D3E85] transition-colors whitespace-nowrap shrink-0"
              >
                تسجيل الدخول
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main id="top" className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {authError && (
          <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-700 flex items-center justify-between">
            <span>{authError}</span>
            <button
              type="button"
              onClick={() => setAuthError(null)}
              className="text-red-900 underline"
            >
              إغلاق
            </button>
          </div>
        )}

        {mode === 'driver' && (
          <DriverView
            stations={stations}
            user={user}
            profile={profile}
            bookings={bookings}
            favoriteIds={favoriteIds}
            notifications={notifications}
            activeTab={driverTab}
            onTabChange={setDriverTab}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onToggleFavorite={handleToggleFavorite}
            onCreateBooking={handleCreateBooking}
            onUpdateBookingStatus={handleDriverUpdateBookingStatus}
            onMarkNotificationRead={handleMarkNotificationRead}
            onSaveProfile={handleSaveProfile}
          />
        )}

        {mode === 'staff' && (
          <StaffDashboard
            stations={stations}
            bookings={bookings}
            user={user}
            isAdmin={isAdmin}
            hasFirestoreStations={firestoreStations.length > 0}
            onSignIn={handleSignIn}
            onSeedStations={seedStationsToFirestore}
            onAdjustQueue={handleAdjustQueue}
            onAdjustPumps={handleAdjustPumps}
            onToggleStationOpen={handleToggleStationOpen}
            onUpdateFuels={handleUpdateFuels}
            onCallBookingToPump={handleCallBookingToPump}
            onStaffUpdateBookingStatus={handleStaffUpdateBookingStatus}
          />
        )}

        {mode === 'display' && (
          <StationDisplay stations={stations} bookings={bookings} />
        )}
      </main>
    </div>
  );
}
