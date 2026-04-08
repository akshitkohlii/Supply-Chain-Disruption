"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import maplibregl, { type MapGeoJSONFeature } from "maplibre-gl";
import type { AlertItem } from "@/lib/mappers";

type Props = {
  alerts: AlertItem[];
  selectedAlertId: string | null;
  onSelectAlert: (alert: AlertItem | null) => void;
  panelOpen?: boolean;
};

const DEFAULT_CENTER: [number, number] = [20, 20];
const DEFAULT_ZOOM = 0.7;
const FOCUS_ZOOM = 2.5;

const PANEL_TRANSITION_MS = 360;
const CAMERA_DELAY_ON_LAYOUT_MS = 220;

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
      min-width:230px;
      max-width:280px;
      padding:0;
      background:linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.96));
      color:#e2e8f0;
      border:1px solid rgba(51,65,85,0.9);
      border-radius:16px;
      box-shadow:
        0 14px 36px rgba(0,0,0,0.45),
        0 0 24px ${glow},
        inset 0 1px 0 rgba(148,163,184,0.08);
      overflow:hidden;
      backdrop-filter:blur(12px);
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

function isValidCoordinatePair(
  coordinates: unknown
): coordinates is [number, number] {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return false;

  const [lng, lat] = coordinates;

  return (
    typeof lng === "number" &&
    typeof lat === "number" &&
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

function WorldRiskMap({
  alerts,
  selectedAlertId,
  onSelectAlert,
  panelOpen = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const hasLoadedRef = useRef(false);
  const hoveredIdRef = useRef<string | null>(null);
  const isCameraMovingRef = useRef(false);

  const pulseFrameRef = useRef<number | null>(null);
  const resizeLoopFrameRef = useRef<number | null>(null);
  const cameraTimerRef = useRef<number | null>(null);

  const alertsRef = useRef<AlertItem[]>(alerts);
  const selectedAlertIdRef = useRef<string | null>(selectedAlertId);
  const onSelectAlertRef = useRef(onSelectAlert);

  const lastCameraKeyRef = useRef<string>("__initial__");
  const previousPanelOpenRef = useRef<boolean>(panelOpen);

  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  useEffect(() => {
    selectedAlertIdRef.current = selectedAlertId;
  }, [selectedAlertId]);

  useEffect(() => {
    onSelectAlertRef.current = onSelectAlert;
  }, [onSelectAlert]);

  const validAlerts = useMemo(() => {
    return alerts.filter((alert) => isValidCoordinatePair(alert.coordinates));
  }, [alerts]);

  const geoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: validAlerts.map((alert) => ({
        type: "Feature" as const,
        properties: {
          id: alert.id,
          level: alert.level,
        },
        geometry: {
          type: "Point" as const,
          coordinates: alert.coordinates,
        },
      })),
    }),
    [validAlerts]
  );

  const syncSourceData = () => {
    const map = mapRef.current;
    if (!map || !hasLoadedRef.current) return;

    const source = map.getSource("alerts-source") as
      | maplibregl.GeoJSONSource
      | undefined;

    source?.setData(geoJson);
  };

  const applySelectionStyles = () => {
    const map = mapRef.current;
    if (!map || !hasLoadedRef.current) return;

    const activeId = selectedAlertIdRef.current ?? "";

    if (map.getLayer("alerts-glow")) {
      map.setPaintProperty("alerts-glow", "circle-radius", [
        "case",
        ["==", ["get", "id"], activeId],
        20,
        16,
      ]);

      map.setPaintProperty("alerts-glow", "circle-opacity", [
        "case",
        ["==", ["get", "id"], activeId],
        0.5,
        0.35,
      ]);
    }

    if (map.getLayer("alerts-points")) {
      map.setPaintProperty("alerts-points", "circle-radius", [
        "case",
        ["==", ["get", "id"], activeId],
        7.5,
        6,
      ]);

      map.setPaintProperty("alerts-points", "circle-stroke-color", [
        "case",
        ["==", ["get", "id"], activeId],
        "#ffffff",
        "rgba(15,23,42,0.95)",
      ]);

      map.setPaintProperty("alerts-points", "circle-stroke-width", [
        "case",
        ["==", ["get", "id"], activeId],
        2.2,
        1.5,
      ]);
    }
  };

  const runResizeLoop = (duration = PANEL_TRANSITION_MS) => {
    const map = mapRef.current;
    if (!map) return;

    if (resizeLoopFrameRef.current !== null) {
      cancelAnimationFrame(resizeLoopFrameRef.current);
      resizeLoopFrameRef.current = null;
    }

    const startedAt = performance.now();

    const tick = (now: number) => {
      map.resize();

      if (now - startedAt < duration) {
        resizeLoopFrameRef.current = requestAnimationFrame(tick);
      } else {
        resizeLoopFrameRef.current = null;
        map.resize();
      }
    };

    resizeLoopFrameRef.current = requestAnimationFrame(tick);
  };

  const runCameraNow = () => {
    const map = mapRef.current;
    if (!map || !hasLoadedRef.current) return;

    const activeId = selectedAlertIdRef.current;
    const cameraKey = `${activeId ?? "none"}|${panelOpen ? "open" : "closed"}`;

    if (lastCameraKeyRef.current === cameraKey) return;
    lastCameraKeyRef.current = cameraKey;

    if (!activeId) {
      map.stop();
      isCameraMovingRef.current = true;
      map.easeTo({
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        duration: 650,
        essential: true,
        easing: (t) => 1 - Math.pow(1 - t, 2.15),
      });
      return;
    }

    const selectedAlert = alertsRef.current.find((a) => a.id === activeId);
    if (!selectedAlert || !isValidCoordinatePair(selectedAlert.coordinates)) {
      return;
    }

    const [targetLng, targetLat] = selectedAlert.coordinates;
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();

    const alreadyNearTarget =
      Math.abs(currentCenter.lng - targetLng) < 0.08 &&
      Math.abs(currentCenter.lat - targetLat) < 0.08 &&
      Math.abs(currentZoom - FOCUS_ZOOM) < 0.08;

    if (alreadyNearTarget) return;

    map.stop();
    isCameraMovingRef.current = true;
    map.easeTo({
      center: selectedAlert.coordinates,
      zoom: FOCUS_ZOOM,
      duration: 520,
      essential: true,
      easing: (t) => 1 - Math.pow(1 - t, 2.35),
    });
  };

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
      hasLoadedRef.current = true;

      map.addSource("alerts-source", {
        type: "geojson",
        data: geoJson,
      });

      map.addLayer({
        id: "alerts-glow",
        type: "circle",
        source: "alerts-source",
        paint: {
          "circle-radius": 16,
          "circle-color": [
            "match",
            ["get", "level"],
            "critical",
            "#fb7185",
            "warning",
            "#fbbf24",
            "#22d3ee",
          ],
          "circle-opacity": 0.35,
          "circle-blur": 1.4,
        },
      });

      map.addLayer({
        id: "alerts-pulse",
        type: "circle",
        source: "alerts-source",
        paint: {
          "circle-radius": [
            "case",
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
        id: "alerts-points",
        type: "circle",
        source: "alerts-source",
        paint: {
          "circle-radius": 6,
          "circle-color": [
            "match",
            ["get", "level"],
            "critical",
            "#fb7185",
            "warning",
            "#fbbf24",
            "#22d3ee",
          ],
          "circle-stroke-color": "rgba(15,23,42,0.95)",
          "circle-stroke-width": 1.5,
        },
      });

      const showPopupFromFeature = (feature: MapGeoJSONFeature | undefined) => {
        if (isCameraMovingRef.current) return;
        if (!isPointFeature(feature)) return;

        const id = feature.properties?.id;
        if (!id) return;

        const alert = alertsRef.current.find((a) => a.id === id);
        if (!alert || !isValidCoordinatePair(alert.coordinates)) return;

        hoveredIdRef.current = id;

        popupRef.current
          ?.setLngLat(feature.geometry.coordinates)
          .setHTML(getPopupHtml(alert))
          .addTo(map);
      };

      map.on("mouseenter", "alerts-points", (e) => {
        map.getCanvas().style.cursor = "pointer";
        showPopupFromFeature(e.features?.[0]);
      });

      map.on("mousemove", "alerts-points", (e) => {
        showPopupFromFeature(e.features?.[0]);
      });

      map.on("mouseleave", "alerts-points", () => {
        map.getCanvas().style.cursor = "";
        hoveredIdRef.current = null;
        popupRef.current?.remove();
      });

      map.on("click", "alerts-points", (e) => {
        const feature = e.features?.[0];
        if (!isPointFeature(feature)) return;

        const id = feature.properties?.id;
        const alert = alertsRef.current.find((a) => a.id === id);
        if (!alert) return;

        onSelectAlertRef.current(alert);
      });

      map.on("click", (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["alerts-points"],
        });

        if (!features.length) {
          popupRef.current?.remove();
          hoveredIdRef.current = null;
        }
      });

      map.on("movestart", () => {
        isCameraMovingRef.current = true;
      });

      map.on("moveend", () => {
        isCameraMovingRef.current = false;
      });

      syncSourceData();
      applySelectionStyles();
      runCameraNow();
    });

    return () => {
      hasLoadedRef.current = false;

      popupRef.current?.remove();
      popupRef.current = null;

      if (pulseFrameRef.current !== null) {
        cancelAnimationFrame(pulseFrameRef.current);
        pulseFrameRef.current = null;
      }

      if (resizeLoopFrameRef.current !== null) {
        cancelAnimationFrame(resizeLoopFrameRef.current);
        resizeLoopFrameRef.current = null;
      }

      if (cameraTimerRef.current !== null) {
        window.clearTimeout(cameraTimerRef.current);
        cameraTimerRef.current = null;
      }

      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    syncSourceData();
  }, [geoJson]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    applySelectionStyles();
  }, [selectedAlertId]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;

    const panelChanged = previousPanelOpenRef.current !== panelOpen;
    previousPanelOpenRef.current = panelOpen;

    if (cameraTimerRef.current !== null) {
      window.clearTimeout(cameraTimerRef.current);
      cameraTimerRef.current = null;
    }

    if (panelChanged) {
      runResizeLoop(PANEL_TRANSITION_MS);

      cameraTimerRef.current = window.setTimeout(() => {
        runCameraNow();
      }, CAMERA_DELAY_ON_LAYOUT_MS);

      return;
    }

    runCameraNow();
  }, [selectedAlertId, panelOpen]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let pulsePhase = 0;

    const animatePulse = () => {
      pulsePhase += 0.045;
      const wave = (Math.sin(pulsePhase) + 1) / 2;
      const activeId = selectedAlertIdRef.current ?? "";

      if (map.getLayer("alerts-pulse")) {
        map.setPaintProperty("alerts-pulse", "circle-radius", [
          "case",
          ["==", ["get", "id"], activeId],
          15 + wave * 6,
          ["==", ["get", "level"], "critical"],
          13 + wave * 5,
          ["==", ["get", "level"], "warning"],
          11 + wave * 3,
          0,
        ]);

        map.setPaintProperty("alerts-pulse", "circle-opacity", [
          "case",
          ["==", ["get", "id"], activeId],
          0.22 + wave * 0.14,
          ["==", ["get", "level"], "critical"],
          0.16 + wave * 0.12,
          ["==", ["get", "level"], "warning"],
          0.09 + wave * 0.08,
          0,
        ]);
      }

      pulseFrameRef.current = requestAnimationFrame(animatePulse);
    };

    pulseFrameRef.current = requestAnimationFrame(animatePulse);

    return () => {
      if (pulseFrameRef.current !== null) {
        cancelAnimationFrame(pulseFrameRef.current);
        pulseFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasLoadedRef.current) return;
    if (isCameraMovingRef.current) return;
    if (!hoveredIdRef.current) return;

    const hoveredAlert = alertsRef.current.find(
      (a) => a.id === hoveredIdRef.current
    );

    if (!hoveredAlert || !isValidCoordinatePair(hoveredAlert.coordinates)) {
      hoveredIdRef.current = null;
      popupRef.current?.remove();
      return;
    }

    popupRef.current
      ?.setLngLat(hoveredAlert.coordinates)
      .setHTML(getPopupHtml(hoveredAlert))
      .addTo(map);
  }, [alerts]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden rounded-2xl bg-slate-950"
    />
  );
}

export default memo(WorldRiskMap);