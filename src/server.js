import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import { seedDemoInstallers } from "./seed.js";

seedDemoInstallers();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// ---------- Health ----------

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "novasolar-backend", time: new Date().toISOString() });
});

// Re-runs the (idempotent) demo-data seed on demand. Needed because the free
// Render plan has no persistent disk and no Shell tab, so if the ephemeral
// SQLite file is ever reset by a restart, this is the only way to repopulate
// demo installers without a full redeploy.
app.post("/api/admin/reseed", (_req, res) => {
  seedDemoInstallers();
  const count = db.prepare("SELECT COUNT(*) AS c FROM installers WHERE isDemo = 1").get().c;
  res.json({ ok: true, demoInstallerCount: count });
});

// ---------- Leads ----------

app.post("/api/leads", (req, res) => {
  const {
    fullName, email, phone, preferredTime, notes, address,
    systemKWp, yearlyKWh, savedPerYear, systemCost, paybackYears, installerId
  } = req.body ?? {};

  if (!fullName || !email || !phone) {
    return res.status(400).json({ error: "fullName, email, and phone are required." });
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO leads (id, fullName, email, phone, preferredTime, notes, address, systemKWp, yearlyKWh, savedPerYear, systemCost, paybackYears, installerId)
    VALUES (@id, @fullName, @email, @phone, @preferredTime, @notes, @address, @systemKWp, @yearlyKWh, @savedPerYear, @systemCost, @paybackYears, @installerId)
  `).run({
    id, fullName, email, phone,
    preferredTime: preferredTime ?? null,
    notes: notes ?? null,
    address: address ?? null,
    systemKWp: systemKWp ?? null,
    yearlyKWh: yearlyKWh ?? null,
    savedPerYear: savedPerYear ?? null,
    systemCost: systemCost ?? null,
    paybackYears: paybackYears ?? null,
    installerId: installerId ?? null
  });

  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(id);
  res.status(201).json(lead);
});

app.get("/api/leads", (req, res) => {
  const status = req.query.status;
  const rows = status
    ? db.prepare("SELECT * FROM leads WHERE status = ? ORDER BY createdAt DESC").all(status)
    : db.prepare("SELECT * FROM leads ORDER BY createdAt DESC").all();
  res.json(rows);
});

app.patch("/api/leads/:id", (req, res) => {
  const { status } = req.body ?? {};
  if (!status) return res.status(400).json({ error: "status is required." });
  const result = db.prepare("UPDATE leads SET status = ? WHERE id = ?").run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Lead not found." });
  res.json(db.prepare("SELECT * FROM leads WHERE id = ?").get(req.params.id));
});

// ---------- Installers ----------

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

app.get("/api/installers", (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const systemKWp = parseFloat(req.query.systemKWp) || 7;

  const all = db.prepare("SELECT * FROM installers ORDER BY rating DESC").all();

  const withDistance = all.map((row) => {
    const distanceKm =
      Number.isFinite(lat) && Number.isFinite(lng) && row.latitude != null && row.longitude != null
        ? haversineKm(lat, lng, row.latitude, row.longitude)
        : null;
    const base = row.pricePerKWp * systemKWp;
    return {
      id: row.id,
      name: row.name,
      rating: row.rating,
      reviewCount: row.reviewCount,
      distanceKm: distanceKm != null ? Math.round(distanceKm) : null,
      priceLow: Math.round(base * 0.94),
      priceHigh: Math.round(base * 1.06),
      note: row.note,
      badges: JSON.parse(row.badges),
      icon: row.icon,
      iconColor: row.iconColor,
      isDemo: !!row.isDemo
    };
  });

  const inRange = withDistance
    .filter((r) => r.distanceKm == null || r.distanceKm <= all.find((a) => a.id === r.id).serviceRadiusKm)
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

  res.json(inRange);
});

app.post("/api/installers", (req, res) => {
  const { name, rating, reviewCount, latitude, longitude, serviceRadiusKm, pricePerKWp, note, badges, icon, iconColor } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "name is required." });

  const id = randomUUID();
  db.prepare(`
    INSERT INTO installers (id, name, rating, reviewCount, latitude, longitude, serviceRadiusKm, pricePerKWp, note, badges, icon, iconColor, isDemo)
    VALUES (@id, @name, @rating, @reviewCount, @latitude, @longitude, @serviceRadiusKm, @pricePerKWp, @note, @badges, @icon, @iconColor, 0)
  `).run({
    id,
    name,
    rating: rating ?? 4.5,
    reviewCount: reviewCount ?? 0,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    serviceRadiusKm: serviceRadiusKm ?? 50,
    pricePerKWp: pricePerKWp ?? 1750,
    note: note ?? null,
    badges: JSON.stringify(badges ?? []),
    icon: icon ?? "sun.max.fill",
    iconColor: iconColor ?? "#F5A623"
  });

  res.status(201).json(db.prepare("SELECT * FROM installers WHERE id = ?").get(id));
});

app.delete("/api/installers/:id", (req, res) => {
  const result = db.prepare("DELETE FROM installers WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Installer not found." });
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`NovaSolar backend listening on http://localhost:${PORT}`);
});
