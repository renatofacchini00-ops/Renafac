import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { getConfig, saveConfig, clearConfig } from '../services/config-store';
import { testConnection, runDiagnostics } from '../services/sptrans';
import { COLORS } from '../constants/config';

type Status = 'idle' | 'testing' | 'ok' | 'error';

export function SettingsScreen() {
  const [sptransToken, setSptransToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [sptransStatus, setSptransStatus] = useState<Status>('idle');
  const [showSptrans, setShowSptrans] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);

  useEffect(() => {
    getConfig().then((cfg) => {
      setSptransToken(cfg.sptransToken);
      if (cfg.sptransToken) setSptransStatus('ok');
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveConfig({ sptransToken: sptransToken.trim() });
      Alert.alert('Salvo!', 'Configurações salvas com sucesso. Volte ao mapa e toque em ↻ para atualizar.');
    } finally {
      setSaving(false);
    }
  }, [sptransToken]);

  const handleTestSptrans = useCallback(async () => {
    const trimmed = sptransToken.trim();
    if (!trimmed) {
      Alert.alert('Preencha o token SPTrans primeiro');
      return;
    }
    setSptransStatus('testing');
    await saveConfig({ sptransToken: trimmed });
    setSptransToken(trimmed); // atualiza UI sem espaços
    const result = await testConnection();
    setSptransStatus(result.ok ? 'ok' : 'error');
    if (!result.ok) {
      Alert.alert('Falha na autenticação', result.detail);
    }
  }, [sptransToken]);

  const handleDiagnose = useCallback(async () => {
    const trimmed = sptransToken.trim();
    if (!trimmed) {
      Alert.alert('Preencha o token SPTrans primeiro');
      return;
    }
    setDiagnosing(true);
    await saveConfig({ sptransToken: trimmed });
    try {
      const report = await runDiagnostics();
      Alert.alert('Diagnóstico SPTrans', report);
    } finally {
      setDiagnosing(false);
    }
  }, [sptransToken]);

  const handleClear = useCallback(() => {
    Alert.alert('Limpar configurações', 'Deseja apagar o token salvo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await clearConfig();
          setSptransToken('');
          setSptransStatus('idle');
        },
      },
    ]);
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Banner de status geral */}
        {sptransStatus === 'ok' ? (
          <View style={[styles.banner, styles.bannerOk]}>
            <Text style={styles.bannerText}>✅ App configurado e pronto!</Text>
          </View>
        ) : (
          <View style={[styles.banner, styles.bannerWarn]}>
            <Text style={styles.bannerText}>
              ⚠️ Configure o token da SPTrans abaixo para ver os ônibus
            </Text>
          </View>
        )}

        {/* SPTrans */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Token SPTrans (Olho Vivo)</Text>
            <StatusBadge status={sptransStatus} />
          </View>
          <Text style={styles.sectionDesc}>
            Necessário para ver os ônibus em tempo real no mapa e receber alertas.
          </Text>

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => Linking.openURL('https://www.sptrans.com.br/desenvolvedores/')}
          >
            <Text style={styles.linkText}>↗ Obter token gratuito na SPTrans</Text>
          </TouchableOpacity>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Cole seu token aqui"
              placeholderTextColor={COLORS.textSecondary}
              value={sptransToken}
              onChangeText={(t) => { setSptransToken(t); setSptransStatus('idle'); }}
              secureTextEntry={!showSptrans}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowSptrans((v) => !v)}
            >
              <Text style={styles.eyeText}>{showSptrans ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.testBtn, sptransStatus === 'testing' && styles.testBtnDisabled]}
            onPress={handleTestSptrans}
            disabled={sptransStatus === 'testing'}
          >
            {sptransStatus === 'testing' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.testBtnText}>Testar conexão</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.diagBtn, diagnosing && styles.testBtnDisabled]}
            onPress={handleDiagnose}
            disabled={diagnosing}
          >
            {diagnosing ? (
              <ActivityIndicator color={COLORS.primary} size="small" />
            ) : (
              <Text style={styles.diagBtnText}>🔍 Diagnóstico completo</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Salvar */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Salvar configurações</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
          <Text style={styles.clearBtnText}>Apagar token salvo</Text>
        </TouchableOpacity>

        <Text style={styles.securityNote}>
          🔒 O token fica salvo apenas no seu celular, nunca é enviado a terceiros.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === 'idle') return null;
  const config = {
    testing: { bg: COLORS.primary + '22', color: COLORS.primary, label: 'Testando...' },
    ok: { bg: COLORS.success + '22', color: COLORS.success, label: '✓ Válido' },
    error: { bg: COLORS.danger + '22', color: COLORS.danger, label: '✗ Inválido' },
  }[status];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 48 },
  banner: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  bannerOk: { backgroundColor: COLORS.success + '22' },
  bannerWarn: { backgroundColor: COLORS.accent + '22' },
  bannerText: { fontSize: 14, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  section: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  sectionDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 10 },
  linkBtn: { marginBottom: 10 },
  linkText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  helpText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    marginBottom: 10,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.text,
  },
  eyeBtn: { paddingHorizontal: 12 },
  eyeText: { fontSize: 18 },
  testBtn: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  testBtnDisabled: { opacity: 0.6 },
  testBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  diagBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 8,
  },
  diagBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  clearBtn: { alignItems: 'center', paddingVertical: 12, marginBottom: 16 },
  clearBtnText: { fontSize: 14, color: COLORS.danger, fontWeight: '600' },
  securityNote: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
