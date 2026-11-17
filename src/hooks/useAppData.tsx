import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DependencyList,
  type ReactNode,
} from 'react';
import { Alert, AppState } from 'react-native';
import { DEFAULT_SETTINGS, getSettings, setSetting } from '../db/settings';
import type { DB, Settings } from '../db/types';
import { todayKey, type DateKey } from '../lib/dates';

interface AppData {
  db: DB;
  /** Increments after every write so every query on screen refreshes. */
  version: number;
  today: DateKey;
  settings: Settings;
  /** Runs a write, refreshes all queries, and shows a friendly error if it fails. */
  mutate: <T>(fn: (db: DB) => Promise<T>) => Promise<T | undefined>;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<boolean>;
}

const Ctx = createContext<AppData | null>(null);

/** Keeps `today` correct when the app stays open past midnight or resumes later. */
function useToday(): DateKey {
  const [today, setToday] = useState(todayKey());
  useEffect(() => {
    const check = () => setToday((prev) => (prev === todayKey() ? prev : todayKey()));
    const timer = setInterval(check, 30_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return today;
}

export function AppDataProvider({ children }: { children: (settings: Settings) => ReactNode }) {
  const db = useSQLiteContext() as unknown as DB;
  const [version, setVersion] = useState(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const today = useToday();

  useEffect(() => {
    getSettings(db).then((s) => {
      setSettings(s);
      setReady(true);
    });
  }, [db, version]);

  const mutate = useCallback(
    async <T,>(fn: (db: DB) => Promise<T>) => {
      try {
        const result = await fn(db);
        return result;
      } catch (e) {
        Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
        return undefined;
      } finally {
        setVersion((v) => v + 1);
      }
    },
    [db],
  );

  const updateSetting = useCallback(
    async <K extends keyof Settings>(key: K, value: Settings[K]) => {
      try {
        await setSetting(db, key, value);
        setSettings((s) => ({ ...s, [key]: value }));
        setVersion((v) => v + 1);
        return true;
      } catch (e) {
        Alert.alert('Invalid value', e instanceof Error ? e.message : String(e));
        return false;
      }
    },
    [db],
  );

  const value = useMemo(
    () => ({ db, version, today, settings, mutate, updateSetting }),
    [db, version, today, settings, mutate, updateSetting],
  );
  if (!ready) return null;
  return <Ctx.Provider value={value}>{children(settings)}</Ctx.Provider>;
}

export function useAppData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppData must be used inside AppDataProvider');
  return v;
}

/**
 * Runs a read query and re-runs it whenever data changes (any `mutate`), the
 * day rolls over, or `deps` change. Charts and lists built on it are always live.
 */
export function useQuery<T>(fn: (db: DB) => Promise<T>, deps: DependencyList): { data: T | undefined; loading: boolean } {
  const { db, version, today } = useAppData();
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  useEffect(() => {
    const id = ++seq.current;
    setLoading(true);
    fn(db)
      .then((r) => {
        if (id === seq.current) setData(r);
      })
      .catch((e) => console.warn('Query failed', e))
      .finally(() => {
        if (id === seq.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version, today, ...deps]);
  return { data, loading };
}
