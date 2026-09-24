// Seeds a handful of clearly-marked DEMO installers so the app has something
// to show before any real installer partners are onboarded. Real installers
// should be added via POST /api/installers with isDemo left false/omitted.

import { randomUUID } from "node:crypto";
import { db } from "./db.js";

const demoInstallers = [
  {
    name: "SolarWest Energy (Demo)",
    rating: 4.8,
    reviewCount: 124,
    latitude: 52.52,
    longitude: 13.405,
    serviceRadiusKm: 40,
    pricePerKWp: 1780,
    note: "Installation in 2-3 weeks",
    badges: JSON.stringify(["Verified", "Premium Panels"]),
    icon: "sun.max.fill",
    iconColor: "#F5A623"
  },
  {
    name: "GreenRoof Solar (Demo)",
    rating: 4.7,
    reviewCount: 89,
    latitude: 52.5, longitude: 13.42,
    serviceRadiusKm: 60,
    pricePerKWp: 1650,
    note: "Battery option available",
    badges: JSON.stringify(["Verified", "Financing"]),
    icon: "leaf.fill",
    iconColor: "#3A9D5D"
  },
  {
    name: "SunGrid Installers (Demo)",
    rating: 4.9,
    reviewCount: 156,
    latitude: 52.53, longitude: 13.38,
    serviceRadiusKm: 80,
    pricePerKWp: 1820,
    note: "Fast inspection visit",
    badges: JSON.stringify(["Top Rated", "Certified"]),
    icon: "square.grid.3x3.fill",
    iconColor: "#3E6FE0"
  }
];

const insert = db.prepare(`
  INSERT INTO installers (id, name, rating, reviewCount, latitude, longitude, serviceRadiusKm, pricePerKWp, note, badges, icon, iconColor, isDemo)
  VALUES (@id, @name, @rating, @reviewCount, @latitude, @longitude, @serviceRadiusKm, @pricePerKWp, @note, @badges, @icon, @iconColor, 1)
`);

const existing = db.prepare("SELECT COUNT(*) AS c FROM installers WHERE isDemo = 1").get();
if (existing.c === 0) {
  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run({ id: randomUUID(), ...row });
  });
  insertMany(demoInstallers);
  console.log(`Seeded ${demoInstallers.length} demo installers.`);
} else {
  console.log("Demo installers already present, skipping seed.");
}
