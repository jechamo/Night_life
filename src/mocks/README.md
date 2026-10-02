# Mocks (Blocks 1-4)

PRD 11.1 point 6: Blocks 1-4 run on mocks that live **only** in this folder.
From Block 5 they are replaced by Supabase-backed services in `src/app/services`
and real/test data (`is_test`). Nothing outside `src/app` should import from here.
