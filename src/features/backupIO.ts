import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { exportData } from '../db/backup';
import type { DB } from '../db/types';
import { todayKey } from '../lib/dates';

/** Writes a JSON backup and opens the share sheet (save to Files/Drive, send, etc.). */
export async function shareBackup(db: DB): Promise<string> {
  const backup = await exportData(db);
  const json = JSON.stringify(backup, null, 2);
  const name = `daily-tracker-backup-${todayKey()}.json`;

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return name;
  }

  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(json);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your Daily Tracker backup', UTI: 'public.json' });
  return name;
}

/** Lets the user pick a backup file and returns its parsed JSON, or null if cancelled. */
export async function pickBackupFile(): Promise<unknown | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  const text = Platform.OS === 'web' ? await (await fetch(asset.uri)).text() : await new File(asset.uri).text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('The selected file is not valid JSON');
  }
}
