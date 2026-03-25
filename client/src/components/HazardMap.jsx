import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function makeIcon(status) {
  const color =
    status === "Fixed" ? "#22c55e"
    : status === "In Progress" ? "#f5c518"
    : "#ef4444";
  return L.divIcon({
    className: "",
    html: `<div style="width:13px;height:13px;border-radius:50%;background:${color};border:2px solid rgba(0,0,0,0.35);box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>`,
    iconSize: [13, 13],
    iconAnchor: [6, 6],
    popupAnchor: [0, -10],
  });
}

function HazardMap({ hazards, onMarkerClick }) {
  const defaultCenter = [31.5204, 74.3587];

  const hazardsWithCoords = hazards.filter(
    (h) => h.latitude && h.longitude
  );

  return (
    <div className="map-wrapper">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        scrollWheelZoom={true}
        className="leaflet-map"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {hazardsWithCoords.map((hazard) => (
          <Marker
            key={hazard.id}
            position={[hazard.latitude, hazard.longitude]}
            icon={makeIcon(hazard.status)}
            eventHandlers={onMarkerClick ? { click: () => onMarkerClick(hazard.id) } : {}}
          />
        ))}
      </MapContainer>
    </div>
  );
}

export default HazardMap;