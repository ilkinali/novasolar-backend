# NovaSolar AI Backend

Lead capture + installer directory API for the NovaSolar AI app.

## Run locally

```bash
npm install
npm run seed   # one-time: adds demo installers
npm start       # starts on http://localhost:4000
```

## Endpoints

- `GET  /api/health` — health check
- `POST /api/leads` — create a lead (`fullName`, `email`, `phone` required)
- `GET  /api/leads` — list leads, optional `?status=`
- `PATCH /api/leads/:id` — update a lead's status
- `GET  /api/installers?lat=&lng=&systemKWp=` — nearby installers, sorted by distance
- `POST /api/installers` — add a real installer (leave `isDemo` out — it defaults to false)

## Deploying to Render.com

1. Push this folder to a GitHub repo.
2. In Render: **New > Blueprint**, point it at the repo — it reads `render.yaml` and sets everything up (including the persistent disk for the SQLite file).
3. After the first deploy, run the seed once from Render's shell tab: `npm run seed`.
4. Copy the `https://...onrender.com` URL Render gives you.

## Pointing the iOS app at a deployed backend

Edit `BackendClient.swift` in the iOS project:

```swift
var baseURL = "https://your-real-domain.com"   // was http://localhost:4000
```

## Note on the demo installers

`npm run seed` inserts 3 installers with `isDemo: true` and "(Demo)" in their
name so they're never mistaken for real partners. Add real installers via
`POST /api/installers` once you have actual partnerships — those won't be
marked as demo.
