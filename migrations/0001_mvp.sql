CREATE TABLE IF NOT EXISTS app_state (
  id TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  appointment_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  booking_date TEXT NOT NULL,
  booking_time TEXT NOT NULL,
  barber_id TEXT NOT NULL,
  duration INTEGER NOT NULL,
  status TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS bookings_created_at_idx ON bookings(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_slot_idx
  ON bookings(booking_date, booking_time, barber_id)
  WHERE status IN ('confirmed', 'completed');

CREATE TABLE IF NOT EXISTS booking_rate_limits (
  ip_hash TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS barber_clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('demo', 'active', 'paused')),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_state (
  shop_id TEXT PRIMARY KEY REFERENCES barber_clients(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_bookings (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES barber_clients(id) ON DELETE CASCADE,
  appointment_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  booking_date TEXT NOT NULL,
  booking_time TEXT NOT NULL,
  barber_id TEXT NOT NULL,
  duration INTEGER NOT NULL,
  status TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS tenant_bookings_created_at_idx ON tenant_bookings(shop_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_bookings_slot_idx
  ON tenant_bookings(shop_id, booking_date, booking_time, barber_id)
  WHERE status IN ('confirmed', 'completed');

CREATE TABLE IF NOT EXISTS tenant_booking_rate_limits (
  shop_id TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (shop_id, ip_hash)
);
