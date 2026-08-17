* [x] Move from Bun to Deno (keep the @ system, )
* [x] Try and find any bugs that would accure whilst running the code, optimsation tweaks
* [x] DONT ADD COMMENTS, KEEP EXISTING
* [x] Add searching of teachers, classrooms and class box, some existing code does exist, but doesnt function. MAKE SURE THE CSS IS SIMILAR TO THE DESIGN OF THE PAGE, SIMPLE
* [x] Change git hash url to https://git.smilt.dev/smil/edu
* [x] Change authentication to session, not JWT

---

not done, needs a decision:

* nothing on the frontend connects to /v1/ws, so the scraper's "new"/"update" messages
  and the admin test notification button have no listener. the server side works
* `class` and `group` are declared as arrays on the Lesson schema but the upsert in
  Schedule.ts writes them as plain strings (mongoose casts them back to arrays on read).
  it works, but writing real arrays breaks inserts - mongo can't index parallel arrays
* public/js/admin.js is unfinished and calls /v2/admin/users/list, which doesn't exist.
  it isn't loaded by any view
