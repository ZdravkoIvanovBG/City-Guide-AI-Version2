import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { feature, mesh } from "topojson-client";
import type { Topology } from "topojson-specification";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const RADIUS = 2;
const ROTATION_SPEED = 0.0008;

const COUNTRY_ISO: Record<string, number> = {
  "Afghanistan": 4, "Albania": 8, "Algeria": 12, "Angola": 24, "Argentina": 32,
  "Australia": 36, "Austria": 40, "Azerbaijan": 31, "Bahrain": 48, "Bangladesh": 50,
  "Belgium": 56, "Bolivia": 68, "Brazil": 76, "Bulgaria": 100, "Cambodia": 116,
  "Canada": 124, "Chile": 152, "China": 156, "Colombia": 170, "Costa Rica": 188,
  "Croatia": 191, "Cuba": 192, "Czech Republic": 203, "Denmark": 208, "Ecuador": 218,
  "Egypt": 818, "Ethiopia": 231, "Finland": 246, "France": 250, "Georgia": 268,
  "Germany": 276, "Ghana": 288, "Greece": 300, "Hungary": 348, "India": 356,
  "Indonesia": 360, "Iran": 364, "Iraq": 368, "Ireland": 372, "Israel": 376,
  "Italy": 380, "Japan": 392, "Jordan": 400, "Kazakhstan": 398, "Kenya": 404,
  "Kuwait": 414, "Laos": 418, "Lebanon": 422, "Libya": 434, "Malaysia": 458,
  "Mexico": 484, "Mongolia": 496, "Morocco": 504, "Mozambique": 508, "Myanmar": 104,
  "Nepal": 524, "Netherlands": 528, "New Zealand": 554, "Nigeria": 566, "Norway": 578,
  "Oman": 512, "Pakistan": 586, "Panama": 591, "Peru": 604, "Philippines": 608,
  "Poland": 616, "Portugal": 620, "Qatar": 634, "Romania": 642, "Russia": 643,
  "Saudi Arabia": 682, "Senegal": 686, "Serbia": 688, "Singapore": 702,
  "Slovakia": 703, "South Africa": 710, "South Korea": 410, "Spain": 724,
  "Sri Lanka": 144, "Sweden": 752, "Switzerland": 756, "Syria": 760, "Taiwan": 158,
  "Tanzania": 834, "Thailand": 764, "Tunisia": 788, "Turkey": 792, "UAE": 784,
  "Ukraine": 804, "United Kingdom": 826, "United States": 840, "Uruguay": 858,
  "Venezuela": 862, "Vietnam": 704, "Yemen": 887, "Zimbabwe": 716,
};

function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function coordsToLine(
  coords: number[][],
  r: number,
  color: number,
  opacity: number,
): THREE.Line {
  const pts = coords.map(([lng, lat]) => latLngToVec3(lat, lng, r));
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  return new THREE.Line(geo, mat);
}

function buildCountryFillMesh(
  rings: number[][][],
  r: number,
  color: number,
  opacity: number,
): THREE.Mesh | null {
  const vertices: number[] = [];
  for (const ring of rings) {
    if (ring.length < 3) continue;
    const pts = ring.map(([lng, lat]) => latLngToVec3(lat, lng, r * 1.001));
    const centroid = new THREE.Vector3();
    pts.forEach((p) => centroid.add(p));
    centroid.normalize().multiplyScalar(r * 1.001);
    for (let i = 0; i < pts.length - 1; i++) {
      vertices.push(centroid.x, centroid.y, centroid.z);
      vertices.push(pts[i].x, pts[i].y, pts[i].z);
      vertices.push(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
    }
  }
  if (vertices.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}

interface VisitedCity {
  city: string;
  country: string;
  lat: number;
  lng: number;
}

interface Props {
  visitedCities: VisitedCity[];
}

function useMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return mobile;
}

export function TravelGlobe({ visitedCities }: Props) {
  const isMobile = useMobile();
  if (isMobile) return <MobileMap visitedCities={visitedCities} />;
  return <Globe3D visitedCities={visitedCities} />;
}

function Globe3D({ visitedCities }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    globe: THREE.Group;
    frameId: number;
  } | null>(null);
  const interactingRef = useRef(false);
  const rotationRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tooltip, setTooltip] = useState<{ city: string; country: string; x: number; y: number } | null>(null);

  const visitedCountryNames = new Set(visitedCities.map((c) => c.country));

  const init = useCallback(async (container: HTMLDivElement) => {
    const W = container.clientWidth;
    const H = container.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.z = 6;

    const globe = new THREE.Group();
    scene.add(globe);

    // Base sphere
    const sphereGeo = new THREE.SphereGeometry(RADIUS, 64, 64);
    const sphereMat = new THREE.MeshPhongMaterial({ color: 0x0a0f14, shininess: 15 });
    globe.add(new THREE.Mesh(sphereGeo, sphereMat));

    // Atmosphere glow
    const atmGeo = new THREE.SphereGeometry(RADIUS * 1.02, 64, 64);
    const atmMat = new THREE.MeshBasicMaterial({
      color: 0x1a3a6a,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
    });
    globe.add(new THREE.Mesh(atmGeo, atmMat));

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 3, 5);
    scene.add(dirLight);

    // Load topojson
    try {
      const res = await fetch(GEO_URL);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topology = (await res.json()) as Topology<any>;

      const visitedIsoCodes = new Set<number>();
      for (const name of visitedCountryNames) {
        const code = COUNTRY_ISO[name];
        if (code !== undefined) visitedIsoCodes.add(code);
      }

      // All country borders (single merged mesh for performance)
      const allBorders = mesh(topology, topology.objects.countries) as unknown as GeoJSON.MultiLineString;
      if (allBorders.coordinates) {
        for (const line of allBorders.coordinates) {
          globe.add(coordsToLine(line, RADIUS * 1.001, 0xffffff, 0.12));
        }
      }

      // Visited country fills + amber borders
      const countries = (feature(topology, topology.objects.countries) as unknown) as GeoJSON.FeatureCollection;
      for (const feat of countries.features) {
        const id = Number(feat.id);
        if (!visitedIsoCodes.has(id)) continue;

        const geom = feat.geometry;
        if (!geom) continue;

        if (geom.type === "Polygon") {
          const fill = buildCountryFillMesh(geom.coordinates as number[][][], RADIUS, 0xd4a843, 0.15);
          if (fill) globe.add(fill);
          for (const ring of geom.coordinates) {
            globe.add(coordsToLine(ring as number[][], RADIUS * 1.002, 0xd4a843, 0.7));
          }
        } else if (geom.type === "MultiPolygon") {
          for (const polygon of geom.coordinates as number[][][][]) {
            const fill = buildCountryFillMesh(polygon, RADIUS, 0xd4a843, 0.15);
            if (fill) globe.add(fill);
            for (const ring of polygon) {
              globe.add(coordsToLine(ring, RADIUS * 1.002, 0xd4a843, 0.7));
            }
          }
        }
      }
    } catch {
      // silently skip geo loading errors
    }

    // City pins
    const pinGeo = new THREE.SphereGeometry(0.03, 8, 8);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0xd4a843 });
    const glowGeo = new THREE.SphereGeometry(0.055, 8, 8);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xd4a843, transparent: true, opacity: 0.25 });

    for (const { lat, lng } of visitedCities) {
      if (!lat && !lng) continue;
      const pos = latLngToVec3(lat, lng, RADIUS * 1.003);
      const pin = new THREE.Mesh(pinGeo, pinMat);
      const glow = new THREE.Mesh(glowGeo, glowMat);
      pin.position.copy(pos);
      glow.position.copy(pos);
      globe.add(pin);
      globe.add(glow);
    }

    rotationRef.current = { x: 0, y: 0 };

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (!interactingRef.current) {
        globe.rotation.y += ROTATION_SPEED;
      }
      // Pulse glow pins
      const t = Date.now() * 0.002;
      const scale = 1 + 0.3 * Math.sin(t);
      globe.children.forEach((child) => {
        if (child instanceof THREE.Mesh && child.geometry instanceof THREE.SphereGeometry) {
          const params = child.geometry.parameters;
          if (params.radius === 0.055) child.scale.setScalar(scale);
        }
      });
      renderer.render(scene, camera);
    };
    animate();

    sceneRef.current = { renderer, scene, camera, globe, frameId };

    // Resize
    const onResize = () => {
      const W2 = container.clientWidth;
      const H2 = container.clientHeight;
      camera.aspect = W2 / H2;
      camera.updateProjectionMatrix();
      renderer.setSize(W2, H2);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [visitedCities, visitedCountryNames]); // eslint-disable-line

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let cleanupResize: (() => void) | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !sceneRef.current) {
          init(container).then((fn) => { cleanupResize = fn; });
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(container);

    return () => {
      observer.disconnect();
      cleanupResize?.();
      if (sceneRef.current) {
        const { renderer, frameId } = sceneRef.current;
        cancelAnimationFrame(frameId);
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        sceneRef.current = null;
      }
    };
  }, [init]);

  // Drag to rotate
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
    interactingRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active || !sceneRef.current) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    sceneRef.current.globe.rotation.y += dx * 0.005;
    sceneRef.current.globe.rotation.x += dy * 0.005;
    sceneRef.current.globe.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, sceneRef.current.globe.rotation.x));
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
  };
  const onPointerUp = () => {
    dragRef.current.active = false;
    resumeTimerRef.current = setTimeout(() => { interactingRef.current = false; }, 3000);
  };

  // Scroll to zoom
  const onWheel = (e: React.WheelEvent) => {
    if (!sceneRef.current) return;
    e.preventDefault();
    const cam = sceneRef.current.camera;
    cam.position.z = Math.max(3.5, Math.min(10, cam.position.z + e.deltaY * 0.005));
  };

  return (
    <div className="relative w-full h-[420px] select-none">
      <div
        ref={mountRef}
        className="w-full h-full"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
        style={{ touchAction: "none" }}
      />
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-background/90 border border-primary/50 px-3 py-1.5 text-sm font-serif text-foreground backdrop-blur-sm"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <span className="text-primary">{tooltip.city}</span>
          <span className="text-muted-foreground text-xs ml-1">{tooltip.country}</span>
        </div>
      )}
      <div className="absolute bottom-3 right-3 text-xs text-muted-foreground/40 font-mono select-none">
        drag to rotate • scroll to zoom
      </div>
    </div>
  );
}

function MobileMap({ visitedCities }: Props) {
  const visitedCountryNames = new Set(visitedCities.map((c) => c.country));
  const visitedIsoCodes = new Set<number>();
  for (const name of visitedCountryNames) {
    const code = COUNTRY_ISO[name];
    if (code !== undefined) visitedIsoCodes.add(code);
  }
  return (
    <div className="w-full h-64 relative">
      <ComposableMap projectionConfig={{ scale: 147 }} style={{ width: "100%", height: "100%" }}>
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: Array<{ rsmKey: string; id: string | number }> }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={visitedIsoCodes.has(Number(geo.id)) ? "#D4A84325" : "#111827"}
                stroke={visitedIsoCodes.has(Number(geo.id)) ? "#D4A843" : "#ffffff10"}
                strokeWidth={visitedIsoCodes.has(Number(geo.id)) ? 0.8 : 0.3}
                style={{ default: { outline: "none" }, hover: { outline: "none" }, pressed: { outline: "none" } }}
              />
            ))
          }
        </Geographies>
        {visitedCities
          .filter((c) => c.lat !== 0 || c.lng !== 0)
          .map(({ city, lat, lng }) => (
            <Marker key={city} coordinates={[lng, lat]}>
              <circle r={3} fill="#D4A843" opacity={0.9} />
              <circle r={5} fill="#D4A843" opacity={0.2} />
            </Marker>
          ))}
      </ComposableMap>
    </div>
  );
}
