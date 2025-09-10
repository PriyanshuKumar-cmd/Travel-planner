import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";


// Fix summary:
// This file replaces the previous Mapbox / react-map-gl implementation (which failed
// when the environment tried to fetch `react-map-gl` from a CDN). The new version uses
// react-leaflet + OpenStreetMap tiles (no API key required) and Nominatim for optional
// geocoding fallback. This avoids CDN ESM resolution issues and should run locally in
// Vite / CRA / Next projects after installing the dependencies below.

// Installation (run in your project):
// npm install react-leaflet leaflet
// or
// yarn add react-leaflet leaflet
// Then run your dev server: npm run dev

// NOTE about marker icons: many bundlers need explicit image imports for Leaflet's
// default markers. We import the images and merge them into L.Icon.Default so markers
// render correctly.
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";


L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});


// Sample destinations (coords are in [latitude, longitude] order for Leaflet)
const SAMPLE_DESTINATIONS = [
  {
    id: 1,
    name: "Paris, France",
    coords: [48.8566, 2.3522],
    summary: "Romantic city, rich museums, Eiffel Tower.",
  },
  {
    id: 2,
    name: "Tokyo, Japan",
    coords: [35.6895, 139.6917],
    summary: "Ultra-modern city with unique culture and food.",
  },
  {
    id: 3,
    name: "New York, USA",
    coords: [40.7128, -74.006],
    summary: "City that never sleeps — culture, finance, and food.",
  },
  {
    id: 4,
    name: "Goa, India",
    coords: [15.2993, 73.7898],
    summary: "Beaches, nightlife, and relaxed vibe.",
  },
];


export default function TravelPlannerApp() {
  const [darkMode, setDarkMode] = useState(false);

  
  // viewport uses latitude & longitude (Leaflet expects [lat, lon])
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(SAMPLE_DESTINATIONS);
  const [selected, setSelected] = useState(null);
  const [viewport, setViewport] = useState({
    latitude: 48.8566,
    longitude: 2.3522,
    zoom: 2.5,
  });
  

  const [bookings, setBookings] = useState(() => {
    try {
      const saved = localStorage.getItem("tp_bookings");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [showBooking, setShowBooking] = useState(false);
  const nameRef = useRef();
  const emailRef = useRef();

  useEffect(() => {
    localStorage.setItem("tp_bookings", JSON.stringify(bookings));
  }, [bookings]);

  // MapController synchronizes our React state <-> Leaflet map
  function MapController({ viewport, onViewportChange }) {
    const map = useMap();

    // When viewport state changes (e.g., selecting a place), update the map view
    useEffect(() => {
      if (!map) return;
      map.setView([viewport.latitude, viewport.longitude], viewport.zoom);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewport.latitude, viewport.longitude, viewport.zoom]);

    // When the user moves the map, update React state
    useEffect(() => {
      if (!map) return;
      function handleMoveEnd() {
        const center = map.getCenter();
        onViewportChange({
          latitude: center.lat,
          longitude: center.lng,
          zoom: map.getZoom(),
        });
      }
      map.on("moveend", handleMoveEnd);
      return () => map.off("moveend", handleMoveEnd);
    }, [map, onViewportChange]);

    return null;
  }

  // Search: local sample first; if none found, fallback to Nominatim (OpenStreetMap) geocoding
  async function handleSearch(e) {
    e && e.preventDefault();
    const q = query.trim();
    if (!q) return setResults(SAMPLE_DESTINATIONS);

    const local = SAMPLE_DESTINATIONS.filter((d) => d.name.toLowerCase().includes(q.toLowerCase()));
    if (local.length > 0) {
      setResults(local);
      setSelected(local[0]);
      setViewport({ latitude: local[0].coords[0], longitude: local[0].coords[1], zoom: 6 });
      return;
    }

    // Nominatim geocoding (no API key required). Use responsibly (read usage policy).
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`,
        {
          headers: {
            // identify your app in a real project; this header helps with polite usage
            "User-Agent": "TravelPlannerDemo/1.0 (your-email@example.com)",
          },
        }
      );
      const data = await res.json();
      const places = (data || []).map((p, i) => ({
        id: `osm-${i}`,
        name: p.display_name,
        // Nominatim returns lat/lon strings: convert and store as [lat, lon]
        coords: [parseFloat(p.lat), parseFloat(p.lon)],
        summary: p.display_name,
      }));
      setResults(places);
      if (places[0]) {
        setSelected(places[0]);
        setViewport({ latitude: places[0].coords[0], longitude: places[0].coords[1], zoom: 6 });
      }
    } catch (err) {
      console.error("Geocoding error:", err);
      setResults([]);
    }
  }

  function openBooking(dest) {
    setSelected(dest);
    setShowBooking(true);
    if (nameRef.current) nameRef.current.value = "";
    if (emailRef.current) emailRef.current.value = "";
  }

  function handleConfirmBooking(e) {
    e.preventDefault();
    const name = nameRef.current?.value?.trim();
    const email = emailRef.current?.value?.trim();
    if (!name || !email) return alert("Please enter name and email");

    const newBooking = {
      id: Date.now(),
      dest: selected,
      name,
      email,
      date: new Date().toISOString(),
    };
    setBookings((b) => [newBooking, ...b]);
    setShowBooking(false);
    alert("Booking successful! (mock)");
  }

  function cancelBooking(id) {
    if (!confirm("Cancel this booking?")) return;
    setBookings((b) => b.filter((x) => x.id !== id));
  }

  return (
<div className={`min-h-screen flex flex-col ${darkMode ? "dark" : ""}`}>

      <nav className="bg-blue-600 text-white p-4 flex items-center justify-between">
        <div className="text-xl font-semibold">TravelPlanner (Leaflet)</div>
        <div>
          <button
            className="bg-white text-blue-600 px-3 py-1 rounded-md mr-2"
            onClick={() => {
              const el = document.getElementById("projects");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Projects
  

          </button>
        </div>
      </nav>

      <div className="flex-1 lg:flex">
        <aside className="w-full lg:w-96 p-4 border-r">
          <h2 className="text-2xl font-bold mb-2">Find Destinations</h2>
          <form onSubmit={handleSearch} className="mb-4">
            <input
              className="w-full p-2 border rounded mb-2"
              placeholder="Search city, country or landmark"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex gap-2">
              <button className="flex-1 bg-blue-600 text-white py-2 rounded">Search</button>
              <button
                type="button"
                className="bg-gray-200 px-3 rounded"
                onClick={() => {
                  setQuery("");
                  setResults(SAMPLE_DESTINATIONS);
                  setViewport({ latitude: 48.8566, longitude: 2.3522, zoom: 2.5 });
                }}
              >
                Reset
              </button>
            </div>
          </form>

          <div className="space-y-3 overflow-y-auto" style={{ maxHeight: "60vh" }}>
            {results.length === 0 && <div className="text-gray-500">No results</div>}
            {results.map((d) => (
              <div
                key={d.id}
                className={`p-3 rounded border ${selected?.id === d.id ? "bg-blue-50 border-blue-400" : "bg-white"}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{d.name}</div>
                    <div className="text-sm text-gray-600">{d.summary}</div>
                  </div>
                  <div className="flex flex-col gap-2 ml-2">
                    <button
                      className="text-sm px-2 py-1 bg-blue-600 text-white rounded"
                      onClick={() => {
                        setSelected(d);
                        setViewport({ latitude: d.coords[0], longitude: d.coords[1], zoom: 6 });
                      }}
                    >
                      View
                    </button>
                    <button className="text-sm px-2 py-1 border rounded" onClick={() => openBooking(d)}>
                      Book
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h3 className="font-semibold mb-2">My Bookings</h3>
            {bookings.length === 0 && <div className="text-gray-500">No bookings yet</div>}
            <div className="space-y-2">
              {bookings.map((b) => (
                <div key={b.id} className="p-2 border rounded flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{b.dest.name}</div>
                    <div className="text-xs text-gray-600">{new Date(b.date).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="text-sm px-2 py-1 border rounded"
                      onClick={() => setViewport({ latitude: b.dest.coords[0], longitude: b.dest.coords[1], zoom: 6 })}
                    >
                      Go
                    </button>
                    <button className="text-sm px-2 py-1 bg-red-500 text-white rounded" onClick={() => cancelBooking(b.id)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 relative">
          <MapContainer
            center={[viewport.latitude, viewport.longitude]}
            zoom={viewport.zoom}
            style={{ width: "100%", height: "70vh" }}
            scrollWheelZoom={true}
          >
            <MapController
              viewport={viewport}
              onViewportChange={(v) => setViewport((prev) => ({ ...prev, ...v }))}
            />

            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {results.map((d) => (
              <Marker key={d.id} position={d.coords}>
                <Popup>
                  <div className="max-w-xs">
                    <div className="font-semibold">{d.name}</div>
                    <div className="text-xs text-gray-600 mb-2">{d.summary}</div>
                    <div className="flex gap-2 justify-end">
                      <button
                        className="text-sm px-2 py-1 bg-blue-600 text-white rounded"
                        onClick={() => {
                          openBooking(d);
                        }}
                      >
                        Book
                      </button>
                      <button
                        className="text-sm px-2 py-1 border rounded"
                        onClick={() => setViewport({ latitude: d.coords[0], longitude: d.coords[1], zoom: 10 })}
                      >
                        Zoom
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          <div className="p-4">
            {selected ? (
              <div className="bg-white p-4 rounded shadow max-w-2xl">
                <h3 className="text-xl font-bold">{selected.name}</h3>
                <p className="text-gray-700 mb-2">{selected.summary}</p>
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => openBooking(selected)}>
                    Book Event
                  </button>
                  <button
                    className="px-3 py-1 border rounded"
                    onClick={() => setViewport({ latitude: selected.coords[0], longitude: selected.coords[1], zoom: 10 })}
                  >
                    Zoom
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white p-4 rounded shadow max-w-2xl">Select a destination to see details</div>
            )}
          </div>
        </main>
      </div>

      {/* Booking Modal */}
      {showBooking && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-2">Book: {selected.name}</h3>
            <form onSubmit={handleConfirmBooking} className="space-y-3">
              <input ref={nameRef} placeholder="Full name" className="w-full p-2 border rounded" />
              <input ref={emailRef} placeholder="Email" className="w-full p-2 border rounded" />
              <div className="flex gap-2 justify-end">
                <button type="button" className="px-3 py-1 border rounded" onClick={() => setShowBooking(false)}>
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded">
                  Confirm (Mock)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="p-4 text-center text-sm text-gray-600">Built with ❤️ — TravelPlanner (demo, Leaflet)</footer>
    </div>
  );
}

