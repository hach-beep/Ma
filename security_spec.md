# Security Specification — Mahattati (محطتي)

## 1. Data Invariants
1. **Master Gate & Catch-All**: All unspecified Firestore paths default to `allow read, write: if false`.
2. **Station Telemetry Integrity**: `stations/{stationId}` contains non-PII public station status, queue length (`0..500`), active pumps (`1..24`), and fuel prices. Only verified admins (`isAdmin()`) may create, update, or delete station records.
3. **PII Isolation**: `users/{userId}` holds driver PII (`email`, `phone`, `vehiclePlate`). Only the owning authenticated user (`request.auth.uid == userId`) or an admin can read/write it. Users are strictly forbidden from setting `role` to anything other than `'driver'` or creating `/admins/{userId}` entries.
4. **Booking Ownership & State Machine**:
   - A booking can only be created for an existing station (`exists(/databases/$(database)/documents/stations/$(incoming().stationId))`).
   - `userId` on create must match `request.auth.uid`, initial `status` must be `'waiting'`, and `pumpNumber` must be `0`.
   - Drivers can only list/get their own bookings (`resource.data.userId == request.auth.uid`), while admins can manage all station bookings.
   - Terminal states (`completed`, `cancelled`) cannot be modified by drivers once reached.
5. **Strict Server Timestamps & Immortal Fields**: `createdAt` and `updatedAt` are validated against `request.time`. `createdAt`, `userId`, `uid`, and `stationId` on bookings/favorites are immutable after creation.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Write to Station**: Unauthenticated user attempts `create` or `update` on `/stations/kirkuk-central`.
2. **Shadow Field Injection on Booking**: Driver creates booking with extra ghost field `isPriorityVip: true`.
3. **Spoofed Booking UserId**: Driver A creates booking with `userId: "driverB"`.
4. **Orphaned Booking**: Driver creates booking referencing non-existent `stationId: "fake-station-999"`.
5. **Client Timestamp Forgery**: Driver creates booking with forged `createdAt` != `request.time`.
6. **Self-Elevation to Admin**: Driver creates `/admins/{uid}` or sets `role: "admin"` in `/users/{uid}`.
7. **PII Blanket Read**: Driver A attempts `get` or `list` on `/users` or `/users/driverB`.
8. **Query Scraping Bookings**: Driver A attempts `list` on `/bookings` without filtering to `userId == request.auth.uid`.
9. **Terminal State Bypass**: Driver attempts to revert a `completed` booking back to `waiting`.
10. **ID Poisoning**: Attacker attempts to create `/bookings/` with a 500-char invalid ID containing spaces/symbols.
11. **Unverified Email Spoof**: User with `email: "haiyamkhalid@gmail.com"` and `email_verified: false` attempts admin write on `/stations/kirkuk-central`.
12. **Out-of-Range Fuel/Queue Poisoning**: Attacker injects `queueCount: -99` or 2KB string in `ticketNumber`.
