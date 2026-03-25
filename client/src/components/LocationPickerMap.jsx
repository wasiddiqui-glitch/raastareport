import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function LocationMarker({ selectedPosition, onLocationSelect, onLocationResolve }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onLocationSelect(lat, lng);
      if (onLocationResolve) {
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
          .then((r) => r.json())
          .then((data) => {
            const a = data.address || {};
            const city = a.city || a.town || a.village || a.county || "";
            const area = a.suburb || a.neighbourhood || a.quarter || a.village || "";
            onLocationResolve({ city, area });
          })
          .catch(() => {});
      }
    },
  });

  return selectedPosition ? <Marker position={selectedPosition} /> : null;
}

function LocationPickerMap({ selectedPosition, onLocationSelect, onLocationResolve }) {
  const defaultCenter = [31.5204, 74.3587]; // Lahore

  return (
    <div className="map-wrapper">
      <MapContainer
        center={selectedPosition || defaultCenter}
        zoom={13}
        scrollWheelZoom={true}
        className="leaflet-map"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker
          selectedPosition={selectedPosition}
          onLocationSelect={onLocationSelect}
          onLocationResolve={onLocationResolve}
        />
      </MapContainer>
    </div>
  );
}

export default LocationPickerMap;