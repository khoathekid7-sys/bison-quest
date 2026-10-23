"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { LatLng } from "@/config/hunt";
import type { GeoFix, SearchZone } from "@/lib/geo";
import { asset } from "@/lib/site";

export type MapGem = {
  id: string;
  label: string;
  color: string;
  state: "active" | "collected";
  /** Exact marker position (only when the player may see it). */
  exact: LatLng | null;
  zone: SearchZone | null;
};

type Props = {
  center: LatLng;
  player: GeoFix | null;
  gems: MapGem[];
  /** Increment to fly the map to the player. */
  recenterKey: number;
  /** Where to look when there's no player fix (e.g. the active search zone). */
  focus: LatLng | null;
  /** Radius of the focus area in metres. */
  focusRadius: number;
  /** Changes when the focus target changes (e.g. a new gem becomes active). */
  focusKey: string;
  /** Pixels hidden by the bottom sheet; framing keeps targets above it. */
  bottomInset: number;
  onMapTap?: (p: LatLng) => void;
  playerLabel: string;
};

const CAMPUS_BOUNDS: [[number, number], [number, number]] = [
  [40.9465, -76.8985],
  [40.9665, -76.868],
];

const STYLE: Record<string, Leaflet.PathOptions> = {
  green: { color: "#8fca72", weight: 1, fillColor: "#a8db8b", fillOpacity: 1 },
  pitch: { color: "#6fb352", weight: 2, fillColor: "#93d274", fillOpacity: 1 },
  water: { color: "#5fb3d8", weight: 1, fillColor: "#8fd0ec", fillOpacity: 1 },
  parking: { color: "#c9ccbd", weight: 1, fillColor: "#dfe2d3", fillOpacity: 1 },
  plaza: { color: "#e2cfa4", weight: 1, fillColor: "#f6ecd2", fillOpacity: 1 },
  road: { color: "#fdf6e3", weight: 9, lineCap: "round", lineJoin: "round" },
  path: { color: "#fff8e6", weight: 4, lineCap: "round", lineJoin: "round", opacity: 0.95 },
  building: { color: "#b9976a", weight: 1.5, fillColor: "#f4e6c8", fillOpacity: 1 },
};

function gemIconHtml(g: MapGem) {
  const label = g.state === "collected" ? "Collected" : "Active";
  const check =
    g.state === "collected"
      ? `<circle cx="48" cy="48" r="11" fill="#1d7a38" stroke="#fff" stroke-width="3"/><path d="M43 48 l4 4 l7 -8" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<circle cx="23" cy="16" r="2.6" fill="#fff"/>`;
  return `
  <div class="${g.state === "active" ? "gem-float" : ""}" style="width:56px;text-align:center">
    <svg width="52" height="52" viewBox="0 0 64 64" aria-hidden="true">
      ${g.state === "active" ? `<circle cx="32" cy="32" r="30" fill="${g.color}" opacity="0.3"/>` : ""}
      <polygon points="10,24 21,9 43,9 54,24 32,57" fill="${g.color}" stroke="#0b2545" stroke-width="3" stroke-linejoin="round"/>
      <polygon points="21,9 43,9 37,24 27,24" fill="#fff" opacity="0.45"/>
      <polygon points="10,24 27,24 32,57" fill="#fff" opacity="0.2"/>
      <polygon points="37,24 54,24 32,57" fill="#000" opacity="0.18"/>
      ${check}
    </svg>
  </div>
  <div class="gem-shadow"></div>
  <div style="margin-top:2px;white-space:nowrap;transform:translateX(-50%);position:absolute;left:50%;top:66px;background:#fffaf1;color:#10233f;font:700 12px/1.2 var(--font-sans);padding:3px 8px;border-radius:999px;box-shadow:0 2px 6px rgba(0,0,0,.25)">
    ${escapeHtml(g.label)} · ${label}
  </div>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export default function ExploreMap({ center, player, gems, recenterKey, onMapTap, playerLabel, focus, focusRadius, focusKey, bottomInset }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layers = useRef<{ player?: Leaflet.Marker; accuracy?: Leaflet.Circle; gems?: Leaflet.LayerGroup }>({});
  const tapRef = useRef(onMapTap);
  const centeredOnPlayer = useRef(false);
  const [ready, setReady] = useState(false);
  const insetRef = useRef(bottomInset);
  useEffect(() => {
    insetRef.current = bottomInset;
  }, [bottomInset]);

  /** Centre a point in the part of the map that isn't covered by the sheet. */
  const frame = (ll: Leaflet.LatLngExpression, zoom: number, animate: boolean) => {
    const m = map.current;
    if (!m) return;
    const offsetY = Math.min(insetRef.current, m.getSize().y * 0.7) / 2;
    const target = m.project(ll, zoom).add([0, offsetY]);
    const centerLL = m.unproject(target, zoom);
    if (animate) m.flyTo(centerLL, zoom, { duration: 0.6 });
    else m.setView(centerLL, zoom, { animate: false });
  };

  useEffect(() => {
    tapRef.current = onMapTap;
  }, [onMapTap]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leaflet = await import("leaflet");
      if (cancelled || !el.current || map.current) return;
      L.current = leaflet;
      const m = leaflet.map(el.current, {
        center: [center.lat, center.lng],
        zoom: 17,
        minZoom: 15,
        maxZoom: 20,
        zoomControl: false,
        maxBounds: CAMPUS_BOUNDS,
        maxBoundsViscosity: 0.8,
        attributionControl: true,
        zoomSnap: 0.25,
      });
      m.attributionControl.setPrefix(false);
      m.attributionControl.addAttribution('Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors');
      m.createPane("ground").style.zIndex = "200";
      m.createPane("ways").style.zIndex = "300";
      m.createPane("buildings").style.zIndex = "350";
      m.createPane("zones").style.zIndex = "380";
      m.on("click", (e: Leaflet.LeafletMouseEvent) => tapRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
      map.current = m;
      layers.current.gems = leaflet.layerGroup().addTo(m);
      // Keep Leaflet's size in sync with rotation, toolbar changes and window resizes.
      if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(() => m.invalidateSize({ pan: false }));
        ro.observe(el.current);
        m.on("unload", () => ro.disconnect());
      }
      setReady(true);

      try {
        const res = await fetch(asset("map/campus-map.json"));
        const data = (await res.json()) as GeoJSON.FeatureCollection;
        if (cancelled) return;
        const byKind = (kinds: string[]) => ({
          ...data,
          features: data.features.filter((f) => kinds.includes((f.properties as { k: string }).k)),
        });
        const style = (f?: GeoJSON.Feature) => STYLE[(f?.properties as { k: string })?.k] ?? {};
        leaflet.geoJSON(byKind(["green", "pitch", "water", "parking", "plaza"]), { pane: "ground", style, interactive: false }).addTo(m);
        // Road casing first, then fill, for a soft outlined look.
        leaflet.geoJSON(byKind(["road"]), { pane: "ways", interactive: false, style: () => ({ color: "#d8c79f", weight: 12, lineCap: "round", lineJoin: "round" }) }).addTo(m);
        leaflet.geoJSON(byKind(["road", "path"]), { pane: "ways", style, interactive: false }).addTo(m);
        leaflet.geoJSON(byKind(["building"]), { pane: "buildings", style, interactive: false }).addTo(m);
      } catch {
        /* The map still works as a plain field if the base layer fails to load. */
      }
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layers.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Player marker + accuracy circle.
  useEffect(() => {
    const m = map.current;
    const leaflet = L.current;
    if (!m || !leaflet) return;
    if (!player) {
      layers.current.player?.remove();
      layers.current.accuracy?.remove();
      layers.current.player = undefined;
      layers.current.accuracy = undefined;
      return;
    }
    const ll: Leaflet.LatLngExpression = [player.lat, player.lng];
    if (!layers.current.player) {
      layers.current.accuracy = leaflet
        .circle(ll, { radius: player.accuracy, pane: "zones", color: "#1a3f73", weight: 1, fillColor: "#3a65a3", fillOpacity: 0.12, interactive: false })
        .addTo(m);
      layers.current.player = leaflet
        .marker(ll, {
          icon: leaflet.divIcon({
            className: "bq-marker",
            html: `<div style="position:relative;width:60px;height:60px"><div class="player-ring"></div><div class="player-dot"></div></div>`,
            iconSize: [60, 60],
            iconAnchor: [30, 30],
          }),
          keyboard: false,
          title: playerLabel,
          alt: playerLabel,
          zIndexOffset: 1000,
        })
        .addTo(m);
    } else {
      layers.current.player.setLatLng(ll);
      layers.current.accuracy?.setLatLng(ll).setRadius(player.accuracy);
    }
    if (!centeredOnPlayer.current && leaflet.latLngBounds(CAMPUS_BOUNDS).contains(ll)) {
      centeredOnPlayer.current = true;
      frame(ll, Math.max(m.getZoom(), 17), false);
    } else if (centeredOnPlayer.current) {
      // Keep the player in the part of the map not covered by the sheet.
      const pt = m.latLngToContainerPoint(ll);
      const size = m.getSize();
      const visibleBottom = size.y - Math.min(insetRef.current, size.y * 0.7);
      if (pt.x < 30 || pt.x > size.x - 30 || pt.y < 90 || pt.y > visibleBottom - 30) frame(ll, m.getZoom(), true);
    }
  }, [player, playerLabel, ready]);

  // Gems and search zones.
  useEffect(() => {
    const leaflet = L.current;
    const group = layers.current.gems;
    if (!leaflet || !group) return;
    group.clearLayers();
    for (const g of gems) {
      if (g.zone && !g.zone.exact) {
        leaflet
          .circle([g.zone.center.lat, g.zone.center.lng], {
            radius: g.zone.radiusMeters,
            pane: "zones",
            color: g.color,
            weight: 3,
            dashArray: "8 8",
            fillColor: g.color,
            fillOpacity: 0.14,
            interactive: false,
          })
          .addTo(group);
      }
      if (g.exact) {
        leaflet
          .marker([g.exact.lat, g.exact.lng], {
            icon: leaflet.divIcon({ className: "bq-marker", html: gemIconHtml(g), iconSize: [56, 90], iconAnchor: [28, 62] }),
            keyboard: false,
            interactive: false,
            title: `${g.label} (${g.state})`,
          })
          .addTo(group);
      }
    }
  }, [gems, ready]);

  // Recenter on request.
  useEffect(() => {
    if (!recenterKey || !map.current) return;
    const target = player ?? focus ?? center;
    frame([target.lat, target.lng], Math.max(map.current.getZoom(), 17.25), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);

  // When a new gem becomes active, frame its search zone (and the player, if
  // known) in the part of the map above the sheet.
  useEffect(() => {
    const m = map.current;
    const leaflet = L.current;
    if (!ready || !m || !leaflet || !focus) return;
    const bounds = leaflet.latLng(focus.lat, focus.lng).toBounds(focusRadius * 2);
    if (player && leaflet.latLngBounds(CAMPUS_BOUNDS).contains([player.lat, player.lng])) {
      bounds.extend([player.lat, player.lng]);
      centeredOnPlayer.current = true;
    }
    const bottom = Math.min(insetRef.current, m.getSize().y * 0.7) + 24;
    m.fitBounds(bounds, { paddingTopLeft: [24, 120], paddingBottomRight: [24, bottom], maxZoom: 18, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, focusKey]);

  return <div ref={el} className="absolute inset-0" role="application" aria-label="Campus map" />;
}
