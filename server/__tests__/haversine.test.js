const { haversineKm } = require("../utils/haversine");

test("same point returns 0 km", () => {
  expect(haversineKm(31.5204, 74.3587, 31.5204, 74.3587)).toBe(0);
});

test("Lahore to Islamabad is approximately 270 km", () => {
  const dist = haversineKm(31.5204, 74.3587, 33.6844, 73.0479);
  expect(dist).toBeGreaterThan(250);
  expect(dist).toBeLessThan(300);
});

test("points 150m apart are below the 200m duplicate threshold", () => {
  // ~0.00135 degrees latitude ≈ 150m
  const dist = haversineKm(31.5204, 74.3587, 31.5204 + 0.00135, 74.3587);
  expect(dist).toBeLessThan(0.2);
});
