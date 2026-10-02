# Mocks (Blocks 1-4)

PRD 11.1 point 6: Blocks 1-4 run on mocks that live **only** in this folder.
Features may read mock _catalog_ data (sample venue, cities, OTP test code) during these
blocks; services are always injected through `AppServices`. From Block 5 they are replaced by Supabase-backed services in `src/app/services`
and real/test data (`is_test`). Nothing outside `src/app` should import from here.

The simulated backend (`mock-store.ts`) persists only non-personal flags so testers keep their
progress (see ADR 0006).
