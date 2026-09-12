import fs from 'node:fs';

const PATH = 'src/components/MotoboyApp.tsx';
let s = fs.readFileSync(PATH, 'utf8');

if (!s.includes('const lastGpsCloudSyncAt = useRef(0);')) {
  const anchor = '  const wake = useRef<any>(null);\n';
  if (!s.includes(anchor)) throw new Error('[gps-throttle] ref anchor missing');
  s = s.replace(anchor, anchor + '  const lastGpsCloudSyncAt = useRef(0);\n  const lastGpsDriverId = useRef<string | null>(null);\n');
}

const oldBlock = `  useEffect(() => {\n    if (!driver || !navigator.geolocation) return;\n    const success = (position: GeolocationPosition) => {\n      const lat = +position.coords.latitude.toFixed(6);\n      const lng = +position.coords.longitude.toFixed(6);\n      setGps({ lat, lng });\n      saveMotoboyLocationToCloud(driver.id, lat, lng);\n    };\n    navigator.geolocation.getCurrentPosition(success, () => {}, { enableHighAccuracy: true });\n    const id = navigator.geolocation.watchPosition(success, () => {}, {\n      enableHighAccuracy: true,\n      maximumAge: 4000,\n    });\n    return () => navigator.geolocation.clearWatch(id);\n  }, [driver?.id]);`;

const newBlock = `  useEffect(() => {\n    if (!driver || !navigator.geolocation) return;\n    if (lastGpsDriverId.current !== driver.id) {\n      lastGpsDriverId.current = driver.id;\n      lastGpsCloudSyncAt.current = 0;\n    }\n\n    const activeTracking = driver.status === 'delivering' || driver.status === 'returning_to_store';\n    const success = (position: GeolocationPosition) => {\n      const lat = +position.coords.latitude.toFixed(6);\n      const lng = +position.coords.longitude.toFixed(6);\n      setGps({ lat, lng });\n\n      const now = Date.now();\n      // Keep local GPS fluid, but cap Firestore writes. Five open motoboy tabs previously\n      // could write on every browser geolocation callback and fan out reads to every listener.\n      if (now - lastGpsCloudSyncAt.current < 45000) return;\n      lastGpsCloudSyncAt.current = now;\n      void saveMotoboyLocationToCloud(driver.id, lat, lng);\n    };\n\n    navigator.geolocation.getCurrentPosition(success, () => {}, { enableHighAccuracy: true, maximumAge: 10000 });\n    if (!activeTracking) return;\n\n    const id = navigator.geolocation.watchPosition(success, () => {}, {\n      enableHighAccuracy: true,\n      maximumAge: 15000,\n      timeout: 20000,\n    });\n    return () => navigator.geolocation.clearWatch(id);\n  }, [driver?.id, driver?.status]);`;

if (s.includes(oldBlock)) s = s.replace(oldBlock, newBlock);
if (!s.includes('lastGpsCloudSyncAt.current < 45000')) throw new Error('[gps-throttle] throttle not applied');

fs.writeFileSync(PATH, s);
console.log('[gps-throttle] motoboy cloud GPS writes capped and active-route only');
