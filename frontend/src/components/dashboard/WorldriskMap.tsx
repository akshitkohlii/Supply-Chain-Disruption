"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import maplibregl, { type MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AlertItem } from "@/lib/dashboard-data";

type Props = {
  alerts: AlertItem[];
  selectedAlertId: string | null;
  onSelectAlert: (alert: AlertItem | null) => void;
  panelOpen?: boolean;
};

const DEFAULT_CENTER: [number, number] = [20, 20];
const DEFAULT_ZOOM = 0.7;
const FOCUS_ZOOM = 2;

function getPopupHtml(alert: AlertItem) {
  const levelColor =
    alert.level === "critical"
      ? "#fb7185"
      : alert.level === "warning"
        ? "#fbbf24"
        : "#22d3ee";

  const glow =
    alert.level === "critical"
      ? "rgba(251,113,133,0.18)"
      : alert.level === "warning"
        ? "rgba(251,191,36,0.18)"
        : "rgba(34,211,238,0.18)";

  return `
    <div style="
      min-width: 230px;
      max-width: 280px;
      padding: 0;
      background:
        linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.96));
      color: #e2e8f0;
      border: 1px solid rgba(51,65,85,0.9);
      border-radius: 16px;
      box-shadow:
        0 14px 36px rgba(0,0,0,0.45),
        0 0 24px ${glow},
        inset 0 1px 0 rgba(148,163,184,0.08);
      overflow: hidden;
      backdrop-filter: blur(12px);
    ">
      <div style="
        display:flex;
        align-items:center;
        gap:8px;
        padding:10px 12px;
        border-bottom:1px solid rgba(30,41,59,0.9);
        background:linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.95));
      ">
        <span style="
          width:8px;
          height:8px;
          border-radius:999px;
          background:${levelColor};
          box-shadow:0 0 12px ${levelColor};
          flex:0 0 auto;
        "></span>

        <div style="
          font-size:11px;
          letter-spacing:0.08em;
          text-transform:uppercase;
          color:#94a3b8;
          font-weight:700;
        ">
          ${alert.level}
        </div>
      </div>

      <div style="padding:12px;">
        <div style="
          font-size:14px;
          line-height:1.35;
          font-weight:700;
          color:#f8fafc;
          margin-bottom:8px;
        ">
          ${alert.title}
        </div>

        <div style="
          font-size:12px;
          color:#94a3b8;
          margin-bottom:8px;
        ">
          ${alert.location}, ${alert.country}
        </div>

        <div style="
          font-size:12px;
          line-height:1.5;
          color:#cbd5e1;
        ">
          ${alert.summary}
        </div>
      </div>
    </div>
  `;
}

function isPointFeature(
  feature: MapGeoJSONFeature | undefined
): feature is MapGeoJSONFeature & {
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { id?: string };
} {
  return !!feature && feature.geometry.type === "Point";
}

function WorldRiskMap({
  alerts,
  selectedAlertId,
  onSelectAlert,
  panelOpen = false,
}: Props) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const pulseFrameRef = useRef<number | null>(null);
  const pulsePhaseRef = useRef(0);

  const alertsRef = useRef<AlertItem[]>(alerts);
  const onSelectAlertRef = useRef(onSelectAlert);

  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  useEffect(() => {
    onSelectAlertRef.current = onSelectAlert;
  }, [onSelectAlert]);

  const geoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: alerts.map((a) => ({
        type: "Feature" as const,
        properties: {
          id: a.id,
          level: a.level,
        },
        geometry: {
          type: "Point" as const,
          coordinates: a.coordinates as [number, number],
        },
      })),
    }),
    [alerts]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "/map-styles/dark-minimal.json",
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 0.5,
      maxZoom: 4,
      attributionControl: false,
      renderWorldCopies: false,
    });

    mapRef.current = map;

    popupRef.current = new maplibregl.Popup({
      offset: 14,
      closeButton: false,
      closeOnClick: false,
      className: "risk-map-popup",
      maxWidth: "280px",
    });

    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
        showZoom: true,
        visualizePitch: false,
      }),
      "top-right"
    );

    map.on("load", () => {
      map.addSource("points", {
        type: "geojson",
        data: geoJson,
      });

      map.addLayer({
        id: "points-glow",
        type: "circle",
        source: "points",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "id"], selectedAlertId ?? ""],
            22,
            16,
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
          "circle-opacity": [
            "case",
            ["==", ["get", "id"], selectedAlertId ?? ""],
            0.5,
            0.35,
          ],
          "circle-blur": 1.4,
        },
      });

      map.addLayer({
        id: "points-pulse",
        type: "circle",
        source: "points",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "id"], selectedAlertId ?? ""],
            16,
            ["==", ["get", "level"], "critical"],
            13,
            ["==", ["get", "level"], "warning"],
            11,
            0,
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
          "circle-opacity": [
            "case",
            ["==", ["get", "id"], selectedAlertId ?? ""],
            0.26,
            ["==", ["get", "level"], "critical"],
            0.2,
            ["==", ["get", "level"], "warning"],
            0.12,
            0,
          ],
          "circle-blur": 0.9,
        },
      });

      map.addLayer({
        id: "points",
        type: "circle",
        source: "points",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "id"], selectedAlertId ?? ""],
            8,
            6,
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
            "rgba(15,23,42,0.95)",
          ],
          "circle-stroke-width": [
            "case",
            ["==", ["get", "id"], selectedAlertId ?? ""],
            2.5,
            1.5,
          ],
        },
      });

      map.on("mouseenter", "points", (e) => {
        map.getCanvas().style.cursor = "pointer";

        const feature = e.features?.[0];
        if (!isPointFeature(feature)) return;

        const id = feature.properties?.id;
        const alert = alertsRef.current.find((a) => a.id === id);
        if (!alert) return;

        popupRef.current
          ?.setLngLat(feature.geometry.coordinates)
          .setHTML(getPopupHtml(alert))
          .addTo(map);
      });

      map.on("mouseleave", "points", () => {
        map.getCanvas().style.cursor = "";
        popupRef.current?.remove();
      });

      map.on("click", "points", (e) => {
        const feature = e.features?.[0];
        if (!isPointFeature(feature)) return;

        const id = feature.properties?.id;
        const alert = alertsRef.current.find((a) => a.id === id);
        if (!alert) return;

        onSelectAlertRef.current(alert);
      });

      map.on("click", (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["points"],
        });

        if (!features.length) {
          popupRef.current?.remove();
        }
      });
    });

    return () => {
      popupRef.current?.remove();

      if (pulseFrameRef.current !== null) {
        cancelAnimationFrame(pulseFrameRef.current);
        pulseFrameRef.current = null;
      }

      map.remove();
      popupRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource("points") as
      | maplibregl.GeoJSONSource
      | undefined;

    source?.setData(geoJson);

    if (map.getLayer("points-glow")) {
      map.setPaintProperty("points-glow", "circle-radius", [
        "case",
        ["==", ["get", "id"], selectedAlertId ?? ""],
        22,
        16,
      ]);

      map.setPaintProperty("points-glow", "circle-opacity", [
        "case",
        ["==", ["get", "id"], selectedAlertId ?? ""],
        0.5,
        0.35,
      ]);
    }

    if (map.getLayer("points-pulse")) {
      map.setPaintProperty("points-pulse", "circle-radius", [
        "case",
        ["==", ["get", "id"], selectedAlertId ?? ""],
        16,
        ["==", ["get", "level"], "critical"],
        13,
        ["==", ["get", "level"], "warning"],
        11,
        0,
      ]);

      map.setPaintProperty("points-pulse", "circle-opacity", [
        "case",
        ["==", ["get", "id"], selectedAlertId ?? ""],
        0.26,
        ["==", ["get", "level"], "critical"],
        0.2,
        ["==", ["get", "level"], "warning"],
        0.12,
        0,
      ]);
    }

    if (map.getLayer("points")) {
      map.setPaintProperty("points", "circle-radius", [
        "case",
        ["==", ["get", "id"], selectedAlertId ?? ""],
        8,
        6,
      ]);

      map.setPaintProperty("points", "circle-stroke-color", [
        "case",
        ["==", ["get", "id"], selectedAlertId ?? ""],
        "#ffffff",
        "rgba(15,23,42,0.95)",
      ]);

      map.setPaintProperty("points", "circle-stroke-width", [
        "case",
        ["==", ["get", "id"], selectedAlertId ?? ""],
        2.5,
        1.5,
      ]);
    }
  }, [geoJson, selectedAlertId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.stop();

    if (!selectedAlertId) {
      popupRef.current?.remove();

      map.easeTo({
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        duration: 900,
        essential: true,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });

      return;
    }

    const alert = alerts.find((a) => a.id === selectedAlertId);
    if (!alert) {
      popupRef.current?.remove();
      return;
    }

    popupRef.current?.remove();

    map.easeTo({
      center: alert.coordinates as [number, number],
      zoom: FOCUS_ZOOM,
      duration: 900,
      essential: true,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    });
  }, [selectedAlertId, alerts]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const animatePulse = () => {
      pulsePhaseRef.current += 0.045;

      const wave = (Math.sin(pulsePhaseRef.current) + 1) / 2;

      if (map.getLayer("points-pulse")) {
        map.setPaintProperty("points-pulse", "circle-radius", [
          "case",
          ["==", ["get", "id"], selectedAlertId ?? ""],
          16 + wave * 8,
          ["==", ["get", "level"], "critical"],
          13 + wave * 7,
          ["==", ["get", "level"], "warning"],
          11 + wave * 4,
          0,
        ]);

        map.setPaintProperty("points-pulse", "circle-opacity", [
          "case",
          ["==", ["get", "id"], selectedAlertId ?? ""],
          0.24 + wave * 0.22,
          ["==", ["get", "level"], "critical"],
          0.18 + wave * 0.18,
          ["==", ["get", "level"], "warning"],
          0.1 + wave * 0.1,
          0,
        ]);
      }

      pulseFrameRef.current = requestAnimationFrame(animatePulse);
    };

    if (pulseFrameRef.current !== null) {
      cancelAnimationFrame(pulseFrameRef.current);
    }

    pulseFrameRef.current = requestAnimationFrame(animatePulse);

    return () => {
      if (pulseFrameRef.current !== null) {
        cancelAnimationFrame(pulseFrameRef.current);
        pulseFrameRef.current = null;
      }
    };
  }, [selectedAlertId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const resize = () => {
      map.resize();
    };

    const t1 = setTimeout(resize, 24);
    const t2 = setTimeout(resize, 180);
    const t3 = setTimeout(resize, 360);
    const t4 = setTimeout(resize, 520);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [panelOpen]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden rounded-2xl bg-slate-950"
    />
  );
}

export default memo(WorldRiskMap);