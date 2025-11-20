```markdown
# Trivia Time (Supabase prototype)

This repository contains a client-side prototype of the Trivia Game using Supabase for realtime sync and storage.

Quick setup
1. In your Supabase project:
   - Run the SQL in `sql/create_tables.sql` (or the SQL below) to create the `sessions` and `buzzers` tables.
   - Create a Storage bucket named `team-photos`.
2. Copy your Supabase URL and ANON KEY and paste them into `scripts/common.js` (replace placeholders).
3. Deploy the static site to GitHub Pages or any static hosting.
4. Open `/host.html` to create a session, share the session link with contestants, open `/display.html` on a big screen.

Notes
- This is a prototype. Add row-level policies and Authentication for production.
- The schema uses JSON columns inside `sessions` to keep questions, teams, current, chase data. You can split into normalized tables later.
```