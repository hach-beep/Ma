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
import { AuthModal } from './components/AuthModal';
import { DriverView } from './components/DriverView';
import { StaffDashboard } from './components/StaffDashboard';
import { StationDisplay } from './components/StationDisplay';
import { Eye, EyeOff, KeyRound, Lock } from 'lucide-react';

function toMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts) {
    const fn = (ts as { toMillis?: () => number }).toMillis;
    if (typeof fn === 'function') return fn();
  }
  return 0;
}

function checkIsStaffRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.pathname === '/staff' ||
    window.location.pathname.startsWith('/staff/') ||
    window.location.hash === '#staff'
  );
}

export default function App() {
  const [isStaffPortal, setIsStaffPortal] = useState<boolean>(() => checkIsStaffRoute());
  const [mode, setMode] = useState<Exclude<AppMode, 'staff'>>('driver');
  const [driverTab, setDriverTab] = useState<DriverTab>('map');

  useEffect(() => {
    const handleRouteChange = () => {
      setIsStaffPortal(checkIsStaffRoute());
    };
    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('hashchange', handleRouteChange);
    };
  }, []);

  const navigateToStaffPortal = useCallback(() => {
    window.history.pushState({}, '', '/staff');
    setIsStaffPortal(true);
  }, []);

  const navigateToDriverApp = useCallback(() => {
    window.history.pushState({}, '', '/');
    setIsStaffPortal(false);
    setMode('driver');
  }, []);

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [firestoreStations, setFirestoreStations] = useState<Station[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [authError, setAuthError] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalRole, setAuthModalRole] = useState<'driver' | 'staff'>('driver');
  const [staffPageCode, setStaffPageCode] = useState('');
  const [staffPageShowCode, setStaffPageShowCode] = useState(false);
  const [staffPageError, setStaffPageError] = useState<string | null>(null);
  const [staffPageBusy, setStaffPageBusy] = useState(false);
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
        try {
          const adminDoc = await getDoc(doc(db, 'admins', nextUser.uid));
          setIsAdmin(nextUser.emailVerified && adminDoc.exists());
        } catch {
          setIsAdmin(false);
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

  // Auth Actions
  const performGoogleSignIn = async (): Promise<User | null> => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      return cred.user;
    } catch (error: unknown) {
      const errObj = error as { code?: string; message?: string };
      const code = errObj?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError('تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.');
      } else if (code === 'auth/popup-blocked') {
        setAuthError(
          'المتصفح حظر نافذة تسجيل الدخول المنبثقة. يرجى السماح بالنوافذ المنبثقة ثم المحاولة مجدداً.'
        );
      } else if (code === 'auth/unauthorized-domain') {
        setAuthError(
          'نطاق الموقع الحالي غير مصرح به في إعدادات Firebase Auth.'
        );
      } else {
        setAuthError(
          `تعذر إتمام تسجيل الدخول (${code || errObj?.message || 'خطأ غير متوقع'}).`
        );
      }
      return null;
    }
  };

  const openAuthModal = (role: 'driver' | 'staff' = 'driver') => {
    setAuthError(null);
    setAuthModalRole(role);
    setAuthModalOpen(true);
  };

  const handleSignIn = async () => {
    openAuthModal('driver');
  };

  const handleDriverContinue = async () => {
    const activeUser = auth.currentUser || (await performGoogleSignIn());
    if (activeUser) {
      setAuthModalOpen(false);
      navigateToDriverApp();
    }
  };

  const handleStaffContinue = async (staffCode: string): Promise<boolean> => {
    if (staffCode.trim() !== '55555') {
      return false;
    }
    const targetUser = auth.currentUser || (await performGoogleSignIn());
    if (!targetUser) {
      return false;
    }

    const adminPath = `admins/${targetUser.uid}`;
    const adminRef = doc(db, 'admins', targetUser.uid);
    try {
      const existing = await getDoc(adminRef);
      if (!existing.exists()) {
        await setDoc(adminRef, {
          uid: targetUser.uid,
          email: clampStr(
            targetUser.email || 'staff@mahattati.iq',
            BLUEPRINT_CONSTRAINTS.maxEmailLength
          ),
          staffCode: '55555',
          createdAt: serverTimestamp(),
        });
      }
      setIsAdmin(true);
      setAuthModalOpen(false);
      navigateToStaffPortal();
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, adminPath);
    }
  };

  const handleSignOut = async () => {
    setStaffPageCode('');
    setStaffPageError(null);
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

  // Dedicated Staff Portal (/staff or #staff) — completely separated from customer app
  if (isStaffPortal) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#F4F7FC] text-[#0F172A]">
        <header className="sticky top-0 z-30 bg-[#0B1C3E] text-white border-b border-[#1E3A8A]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
            <a
              href="/staff"
              onClick={(e) => {
                e.preventDefault();
                navigateToStaffPortal();
              }}
              className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
            >
              بوابة موظفي محطتي
            </a>

            <nav className="flex items-center gap-6 text-xs sm:text-sm font-semibold text-blue-100">
              <button
                type="button"
                onClick={navigateToDriverApp}
                className="hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                تطبيق السائق
              </button>
            </nav>

            <div className="shrink-0">
              {user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-bold hover:bg-white/20 transition-colors whitespace-nowrap shrink-0"
                >
                  تسجيل الخروج
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openAuthModal('staff')}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-white text-[#0B1C3E] text-xs font-bold hover:bg-blue-50 transition-colors whitespace-nowrap shrink-0"
                >
                  دخول الموظف
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
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

          {!authReady ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
              جاري التحقق من صلاحيات الموظف...
            </div>
          ) : !user || !isAdmin ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setStaffPageError(null);
                setAuthError(null);
                if (staffPageCode.trim() !== '55555') {
                  setStaffPageError(
                    'كود الموظف غير صحيح. لا يمكن فتح لوحة الموظف أو إنشاء حساب موظف.'
                  );
                  return;
                }
                setStaffPageBusy(true);
                try {
                  const ok = await handleStaffContinue(staffPageCode.trim());
                  if (!ok) {
                    setStaffPageError('تعذر إتمام تسجيل الدخول كموظف.');
                  }
                } finally {
                  setStaffPageBusy(false);
                }
              }}
              className="max-w-md mx-auto mt-10 bg-white rounded-2xl border border-slate-200 p-8 space-y-5"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-[#EEF4FF] text-[#132B5E] flex items-center justify-center mx-auto">
                  <Lock className="w-6 h-6" />
                </div>
                <h1 className="text-xl font-bold text-slate-900">
                  بوابة موظفي محطتي
                </h1>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {user
                    ? `الحساب الحالي (${user.email}) مسجل كسائق. أدخل كود الموظف للوصول إلى لوحة التحكم.`
                    : 'أدخل كود الموظف السري وسجّل الدخول بحساب Google للوصول إلى لوحة التحكم.'}
                </p>
              </div>

              {staffPageError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-semibold text-red-700">
                  {staffPageError}
                </div>
              )}

              <div>
                <label
                  htmlFor="staff-portal-code"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  كود الموظف السري
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="staff-portal-code"
                    type={staffPageShowCode ? 'text' : 'password'}
                    inputMode="numeric"
                    autoComplete="off"
                    value={staffPageCode}
                    onChange={(e) => setStaffPageCode(e.target.value)}
                    placeholder="أدخل الكود المطلوب"
                    className="w-full min-h-[46px] pr-10 pl-10 py-2 rounded-xl border border-slate-200 text-sm font-mono-num text-slate-900 focus:outline-none focus:border-[#2563EB]"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setStaffPageShowCode((v) => !v)}
                    aria-label={staffPageShowCode ? 'إخفاء الكود' : 'إظهار الكود'}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700"
                  >
                    {staffPageShowCode ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={staffPageBusy}
                className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-[#132B5E] text-white text-sm font-bold hover:bg-[#1D3E85] disabled:opacity-50 transition-colors"
              >
                {staffPageBusy
                  ? 'جاري التحقق...'
                  : user
                  ? 'تحقق وفتح لوحة الموظف'
                  : 'تحقق وتسجيل دخول الموظف (Google)'}
              </button>

              <button
                type="button"
                onClick={navigateToDriverApp}
                className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                العودة إلى تطبيق السائق
              </button>
            </form>
          ) : (
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
        </main>

        <AuthModal
          isOpen={authModalOpen}
          user={user}
          initialRole={authModalRole}
          authError={authError}
          onClose={() => setAuthModalOpen(false)}
          onDriverContinue={handleDriverContinue}
          onStaffContinue={handleStaffContinue}
          onClearError={() => setAuthError(null)}
        />
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#F4F7FC] text-[#0F172A]">
      {/* Strict 3-Zone Top Bar Contract (Customer-facing only) */}
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

          {/* Zone 2: Clean Single-Line Customer Nav Links */}
          <nav className="flex items-center gap-6 sm:gap-8 text-xs sm:text-sm font-semibold text-slate-600 overflow-x-auto">
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
            isAdmin={isAdmin}
            profile={profile}
            bookings={bookings}
            favoriteIds={favoriteIds}
            notifications={notifications}
            activeTab={driverTab}
            onTabChange={setDriverTab}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onOpenStaffPortal={navigateToStaffPortal}
            onToggleFavorite={handleToggleFavorite}
            onCreateBooking={handleCreateBooking}
            onUpdateBookingStatus={handleDriverUpdateBookingStatus}
            onMarkNotificationRead={handleMarkNotificationRead}
            onSaveProfile={handleSaveProfile}
          />
        )}

        {mode === 'display' && (
          <StationDisplay stations={stations} bookings={bookings} />
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-24 md:pb-8 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-400">
        <span>محطتي — نظام تنظيم طوابير محطات الوقود</span>
        <button
          type="button"
          onClick={navigateToStaffPortal}
          className="text-slate-500 hover:text-[#132B5E] underline underline-offset-4 transition-colors"
        >
          بوابة الموظفين
        </button>
      </footer>

      <AuthModal
        isOpen={authModalOpen}
        user={user}
        initialRole={authModalRole}
        authError={authError}
        onClose={() => setAuthModalOpen(false)}
        onDriverContinue={handleDriverContinue}
        onStaffContinue={handleStaffContinue}
        onClearError={() => setAuthError(null)}
      />
    </div>
  );
}
