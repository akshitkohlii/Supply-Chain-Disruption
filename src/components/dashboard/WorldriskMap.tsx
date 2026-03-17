"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AlertItem } from "@/lib/dashboard-data";

type WorldRiskMapProps = {
  alerts: AlertItem[];
  selectedAlertId: string | null;
  onSelectAlert: (alert: AlertItem) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function WorldRiskMap({
  alerts,
  selectedAlertId,
  onSelectAlert,
}: WorldRiskMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const geoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: alerts.map((alert) => ({
        type: "Feature" as const,
        properties: {
          id: alert.id,
          name: alert.title,
          level: alert.level,
          location: alert.location,
          country: alert.country,
          summary: alert.summary,
        },
        geometry: {
          type: "Point" as const,
          coordinates: alert.coordinates,
        },
      })),
    }),
    [alerts]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style:
        "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json",
      center: [20, 20],
      zoom: 0.7,
      minZoom: 0.5,
      maxZoom: 4,
      attributionControl: false,
      renderWorldCopies: false,
    });

    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: false,
        showCompass: false,
      }),
      "top-right"
    );

    const keepInsideWorld = () => {
      const center = map.getCenter();
      const clampedLng = clamp(center.lng, -180, 180);
      const clampedLat = clamp(center.lat, -75, 85);

      if (clampedLng !== center.lng || clampedLat !== center.lat) {
        map.easeTo({
          center: [clampedLng, clampedLat],
          duration: 250,
        });
      }
    };

    map.on("load", () => {
      map.addSource("risk-points", {
        type: "geojson",
        data: geoJson,
      });

      map.addLayer({
        id: "risk-glow",
        type: "circle",
        source: "risk-points",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "id"], selectedAlertId ?? ""],
            20,
            ["match", ["get", "level"], "critical", 16, "warning", 14, 13],
          ],
          "circle-color": [
            "match",
            ["get", "level"],
            "critical",
            "rgba(244,63,94,0.24)",
            "warning",
            "rgba(251,191,36,0.24)",
            "rgba(34,211,238,0.24)",
          ],
          "circle-blur": 0.6,
        },
      });

      map.addLayer({
        id: "risk-core",
        type: "circle",
        source: "risk-points",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "id"], selectedAlertId ?? ""],
            7,
            5,
          ],
          "circle-color": [
            "match",
            ["get", "level"],
            "critical",
            "#fb7185",
            "warning",
            "#fbbf24",
            "#22d3ee",
          ],
          "circle-stroke-color": [
            "case",
            ["==", ["get", "id"], selectedAlertId ?? ""],
            "#ffffff",
            "rgba(15,23,42,0.9)",
          ],
          "circle-stroke-width": [
            "case",
            ["==", ["get", "id"], selectedAlertId ?? ""],
            2.5,
            1.5,
          ],
        },
      });

      map.on("click", "risk-core", (e) => {
        const feature = e.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;

        const id = String(feature.properties?.id ?? "");
        const alert = alerts.find((a) => a.id === id);
        if (!alert) return;

        onSelectAlert(alert);

        const coords = feature.geometry.coordinates as [number, number];

        new maplibregl.Popup({ offset: 10 })
          .setLngLat(coords)
          .setHTML(`
            <div style="padding:6px 8px; color:#0f172a;">
              <div style="font-weight:600;">${alert.title}</div>
              <div style="font-size:12px; margin-top:4px;">
                ${alert.location}, ${alert.country}
              </div>
              <div style="font-size:12px; margin-top:4px;">
                ${alert.summary}
              </div>
            </div>
          `)
          .addTo(map);
      });

      map.on("mouseenter", "risk-core", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "risk-core", () => {
        map.getCanvas().style.cursor = "";
      });

      map.resize();
    });

    map.on("dragend", keepInsideWorld);
    map.on("zoomend", keepInsideWorld);

    const handleResize = () => map.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      map.off("dragend", keepInsideWorld);
      map.off("zoomend", keepInsideWorld);
      map.remove();
      mapRef.current = null;
    };
  }, [alerts, geoJson, onSelectAlert, selectedAlertId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource("risk-points") as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(geoJson);
    }

    if (map.getLayer("risk-glow")) {
      map.setPaintProperty("risk-glow", "circle-radius", [
        "case",
        ["==", ["get", "id"], selectedAlertId ?? ""],
        20,
        ["match", ["get", "level"], "critical", 16, "warning", 14, 13],
      ]);
    }

    if (map.getLayer("risk-core")) {
      map.setPaintProperty("risk-core", "circle-radius", [
        "case",
        ["==", ["get", "id"], selectedAlertId ?? ""],
        7,
        5,
      ]);

      map.setPaintProperty("risk-core", "circle-stroke-color", [
        "case",
        ["==", ["get", "id"], selectedAlertId ?? ""],
        "#ffffff",
        "rgba(15,23,42,0.9)",
      ]);

      map.setPaintProperty("risk-core", "circle-stroke-width", [
        "case",
        ["==", ["get", "id"], selectedAlertId ?? ""],
        2.5,
        1.5,
      ]);
    }
  }, [geoJson, selectedAlertId]);

  return (
    <div className="relative h-full w-full rounded-2xl overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 z-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl border border-dashed border-slate-700/80" />

      <style jsx global>{`
  .maplibregl-map,
  .maplibregl-canvas-container,
  .maplibregl-canvas {
    width: 100%;
    height: 100%;
  }

  .maplibregl-ctrl-top-right {
    top: 12px;
    right: 12px;
    z-index: 20;
  }

  .maplibregl-ctrl-group {
    background: rgba(15, 23, 42, 0.96) !important;
    border: 1px solid rgba(51, 65, 85, 0.95) !important;
    border-radius: 14px !important;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }

  .maplibregl-ctrl-group button {
    width: 36px !important;
    height: 36px !important;
    background: transparent !important;
  }

  .maplibregl-ctrl-group button:hover {
    background: rgba(56, 189, 248, 0.12) !important;
  }

  /* THIS is the actual visible icon */
  .maplibregl-ctrl-group button .maplibregl-ctrl-icon {
    opacity: 1 !important;
    filter: brightness(0) saturate(100%) invert(88%) sepia(9%) saturate(414%)
      hue-rotate(182deg) brightness(94%) contrast(89%) !important;
  }

  /* zoom in = cyan */
  .maplibregl-ctrl-group .maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon {
    filter: brightness(0) saturate(100%) invert(80%) sepia(32%) saturate(1089%)
      hue-rotate(154deg) brightness(99%) contrast(92%) !important;
  }

  /* zoom out = amber */
  .maplibregl-ctrl-group .maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon {
    filter: brightness(0) saturate(100%) invert(83%) sepia(36%) saturate(1544%)
      hue-rotate(344deg) brightness(101%) contrast(96%) !important;
  }

  .maplibregl-ctrl-group button:hover .maplibregl-ctrl-icon {
    transform: scale(1.04);
  }

  .maplibregl-popup-content {
    border-radius: 12px;
    padding: 0;
    overflow: hidden;
  }
`}</style>
    </div>
  );
}