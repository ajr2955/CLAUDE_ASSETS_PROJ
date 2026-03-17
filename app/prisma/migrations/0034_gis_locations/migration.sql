-- US-034: GIS Location schema and migration

CREATE TYPE geometry_type AS ENUM ('point', 'polygon', 'line');

CREATE TABLE gis_locations (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id            UUID        NOT NULL UNIQUE REFERENCES assets(id),
  latitude            DECIMAL(10, 8),
  longitude           DECIMAL(11, 8),
  geometry_type       geometry_type NOT NULL DEFAULT 'point',
  geojson             JSONB,
  address_formatted   VARCHAR(500),
  neighborhood        VARCHAR(200),
  district            VARCHAR(200),
  parcel_number       VARCHAR(100),
  map_layer_reference VARCHAR(200),
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Resolve the FK stub from the assets table (assets.location_id -> gis_locations.id)
ALTER TABLE assets
  ADD CONSTRAINT fk_assets_location
  FOREIGN KEY (location_id) REFERENCES gis_locations(id);

CREATE INDEX idx_gis_locations_lat_lng ON gis_locations (latitude, longitude);
CREATE INDEX idx_gis_locations_district ON gis_locations (district);
CREATE INDEX idx_gis_locations_neighborhood ON gis_locations (neighborhood);
