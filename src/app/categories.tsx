import { categoryLabel, t } from '../i18n/translate';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Divider, Field, haptic, IconButton, Row, Sheet, type IconName } from '../components/ui';
import { addCategory, deleteCategory, listCategories, renameCategory } from '../db/expenses';
import type { Category } from '../db/types';
import { useAppData, useQuery } from '../hooks/useAppData';
import { font, spacing, useTheme } from '../theme';

export default function CategoriesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { mutate } = useAppData();
  const { data: categories = [] } = useQuery((db) => listCategories(db), []);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<Category | null>(null);
  const [rename, setRename] = useState('');

  const add = async () => {
    const id = await mutate((db) => addCategory(db, newName));
    if (id) {
      haptic('success');
      setNewName('');
    }
  };

  const remove = (c: Category) =>
    Alert.alert(t('Delete category?'), t('"{name}" will no longer be offered. Past expenses keep this category in history.', { name: categoryLabel(c.name) }), [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Delete'), style: 'destructive', onPress: () => mutate((db) => deleteCategory(db, c.id)) },
    ]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}
      keyboardShouldPersistTaps="handled"
    >
      <Card style={{ gap: spacing.md }}>
        <Text style={[font.heading, { color: colors.text }]}>{t('Add a category')}</Text>
        <Row style={{ alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field placeholder={t('e.g. Pets, Books, Rent')} value={newName} onChangeText={setNewName} maxLength={40} returnKeyType="done" onSubmitEditing={add} />
          </View>
          <Button label={t('Add')} icon="add" compact onPress={add} disabled={!newName.trim()} color={colors.expenses} style={{ minHeight: 50 }} />
        </Row>
      </Card>

      <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
        {categories.map((c, i) => (
          <View key={c.id}>
            {i > 0 && <Divider />}
            <Row style={{ paddingVertical: spacing.sm }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.color + '22' }}>
                <Ionicons name={c.icon as IconName} size={18} color={c.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[font.body, { color: colors.text }]}>{categoryLabel(c.name)}</Text>
                {c.is_other ? <Text style={[font.caption, { color: colors.textMuted }]}>{t('Asks for a description · required')}</Text> : null}
              </View>
              <IconButton
                icon="create-outline"
                label={t('Rename {name}', { name: categoryLabel(c.name) })}
                onPress={() => {
                  setEditing(c);
                  setRename(c.name);
                }}
              />
              {!c.is_other && <IconButton icon="trash-outline" label={t('Delete {name}', { name: categoryLabel(c.name) })} color={colors.danger} onPress={() => remove(c)} />}
            </Row>
          </View>
        ))}
      </Card>

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={t('Rename category')}>
        <Field value={rename} onChangeText={setRename} autoFocus maxLength={40} />
        <Button
          label={t('Save')}
          icon="checkmark"
          color={colors.expenses}
          disabled={!rename.trim()}
          onPress={async () => {
            if (!editing) return;
            const ok = await mutate(async (db) => {
              await renameCategory(db, editing.id, rename);
              return true;
            });
            if (ok) setEditing(null);
          }}
        />
      </Sheet>
    </ScrollView>
  );
}
