import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFonts } from 'expo-font';
import { Orbitron_900Black } from '@expo-google-fonts/orbitron';
import { ShareTechMono_400Regular } from '@expo-google-fonts/share-tech-mono';
import { useRef, useState, useEffect } from 'react';
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';

const COLORS = {
  bg: '#100e1c',
  surface: '#131120',
  surface2: '#1a1730',
  border: '#231f3d',
  accent: '#7c4dff',
  accent2: '#00e5ff',
  textPrimary: '#eae8ff',
  textSecondary: '#9d99cc',
  textDim: '#5a5580',
  safe: '#00e5ff',
  suspicious: '#ffab40',
  malicious: '#ff4081',
};

export default function Scanner() {
  const [fontsLoaded] = useFonts({
    Orbitron_900Black,
    ShareTechMono_400Regular,
  });

  const [permission, requestPermission] = useCameraPermissions();
  const [scannedUrl, setScannedUrl] = useState<string | null>(null);
  const qrLock = useRef(false);
  const appState = useRef(AppState.currentState);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Scan line animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Unlock scanner when returning to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        qrLock.current = false;
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, []);

  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 180],
  });

  const handleScan = ({ data }: { data: string }) => {
    if (data && !qrLock.current) {
      qrLock.current = true;
      setScannedUrl(data);
      // TODO: send to Cloudflare Worker for scoring
    }
  };

  if (!fontsLoaded) return <View style={styles.container} />;

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <Text style={styles.navLogo}>SAFESCAN</Text>
        <Text style={[styles.textSecondary, { textAlign: 'center', marginVertical: 20 }]}>
          Camera access is required to scan QR codes.
        </Text>
        <Pressable style={styles.btnPrimary} onPress={requestPermission}>
          <Text style={styles.btnPrimaryText}>ENABLE CAMERA</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Status Bar
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>9:41</Text>
        <Text style={styles.statusText}>●●●●○ WiFi ▮▮▮</Text>
      </View> */}

      {/* Navbar */}
      <View style={styles.navbar}>
        <View style={{ width: 32 }} />
        <Text style={styles.navLogo}>SAFESCAN</Text>
        <View style={styles.navIconBox}>
          <Text style={{ color: COLORS.accent, fontSize: 14 }}>⚙</Text>
        </View>
      </View>

      {/* Scanner */}
      <View style={styles.scannerSection}>
        <View style={styles.scannerFrame}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={handleScan}
          />
          {/* Corners */}
          <View style={styles.scannerInner} pointerEvents="none">
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            {/* Animated scan line */}
            <Animated.View
              style={[
                styles.scanLine,
                { transform: [{ translateY: scanLineTranslateY }] },
              ]}
            />
          </View>
          <Text style={styles.scanLabel}>POINT CAMERA AT QR CODE</Text>
        </View>
      </View>

      {/* Result Card */}
      <View style={styles.resultCard}>
        <View style={styles.resultHeader}>
          <Text style={styles.resultUrl} numberOfLines={1}>
            {scannedUrl ?? 'No QR scanned yet'}
          </Text>
          <Text style={styles.resultTime}>0.0s</Text>
        </View>
        <View style={styles.resultBody}>
          <View style={styles.verdictRow}>
            <Text style={styles.verdictScore}>—</Text>
            <View style={styles.verdictInfo}>
              <Text style={styles.verdictLabel}>
                {scannedUrl ? 'ANALYZING...' : 'IDLE'}
              </Text>
              <Text style={styles.verdictSub}>THREAT SCORE / 100</Text>
            </View>
          </View>

          {/* Score bar */}
          <View style={styles.scoreBar}>
            <View style={[styles.scoreFill, { width: '0%' }]} />
          </View>

          {/* Signal rows */}
          {[
            { label: 'DOMAIN AGE', val: '—', level: 'low' },
            { label: 'BRAND IMPERSONATION', val: '—', level: 'low' },
            { label: 'REDIRECT CHAIN', val: '—', level: 'low' },
            { label: 'DATABASE MATCH', val: '—', level: 'low' },
          ].map((signal) => (
            <View key={signal.label} style={[styles.signal, styles.signalLow]}>
              <Text style={styles.signalName}>{signal.label}</Text>
              <View style={styles.signalValLow}>
                <Text style={styles.signalValTextLow}>{signal.val}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.btnRow}>
        <Pressable style={styles.btnPrimary}>
          <Text style={styles.btnPrimaryText}>BLOCK + REPORT</Text>
        </Pressable>
        <Pressable style={styles.btnSecondary}>
          <Text style={styles.btnSecondaryText}>DETAILS</Text>
        </Pressable>
      </View>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        {[
          { icon: '⬡', label: 'SCAN', active: true },
          { icon: '◈', label: 'HISTORY', active: false },
          { icon: '◎', label: 'DATABASE', active: false },
          { icon: '◇', label: 'SETTINGS', active: false },
        ].map((item) => (
          <View key={item.label} style={styles.navItem}>
            <Text style={[styles.navItemIcon, item.active ? styles.navItemActive : styles.navItemInactive]}>
              {item.icon}
            </Text>
            <Text style={[styles.navItemLabel, item.active ? styles.navItemActive : styles.navItemInactive]}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 20 },

  // Status bar
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  statusText: {
    fontFamily: 'ShareTechMono_400Regular',
    fontSize: 11,
    color: COLORS.textDim,
    letterSpacing: 0.5,
  },

  // Navbar
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  navLogo: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 16,
    color: COLORS.accent2,
    letterSpacing: 2,
  },
  navIconBox: {
    width: 32,
    height: 32,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scanner
  scannerSection: { padding: 20 },
  scannerFrame: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  scannerInner: {
    width: 200,
    height: 200,
    position: 'relative',
  },
  corner: { position: 'absolute', width: 24, height: 24 },
  tl: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2, borderColor: COLORS.accent },
  tr: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2, borderColor: COLORS.accent2 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: COLORS.accent2 },
  br: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2, borderColor: COLORS.accent },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: COLORS.accent2,
  },
  scanLabel: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: 'ShareTechMono_400Regular',
    fontSize: 10,
    letterSpacing: 2,
    color: COLORS.textDim,
  },

  // Result card
  resultCard: {
    marginHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  resultHeader: {
    padding: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultUrl: {
    fontFamily: 'ShareTechMono_400Regular',
    fontSize: 10,
    color: COLORS.textSecondary,
    flex: 1,
    marginRight: 10,
  },
  resultTime: {
    fontFamily: 'ShareTechMono_400Regular',
    fontSize: 9,
    color: COLORS.textDim,
    letterSpacing: 1,
  },
  resultBody: { padding: 16 },
  verdictRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
    marginBottom: 14,
  },
  verdictScore: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 52,
    color: COLORS.malicious,
    lineHeight: 56,
  },
  verdictInfo: { paddingBottom: 4 },
  verdictLabel: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 13,
    color: COLORS.malicious,
    letterSpacing: 1,
  },
  verdictSub: {
    fontFamily: 'ShareTechMono_400Regular',
    fontSize: 9,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    marginTop: 2,
  },

  // Score bar
  scoreBar: {
    height: 2,
    backgroundColor: COLORS.border,
    borderRadius: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    backgroundColor: COLORS.malicious,
    borderRadius: 1,
  },

  // Signals
  signal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 7,
    paddingHorizontal: 10,
    backgroundColor: COLORS.surface2,
    borderRadius: 4,
    borderLeftWidth: 2,
    marginBottom: 5,
  },
  signalLow: { borderLeftColor: COLORS.border },
  signalName: {
    fontFamily: 'ShareTechMono_400Regular',
    fontSize: 9,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  signalValLow: {
    backgroundColor: COLORS.surface2,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  signalValTextLow: {
    fontFamily: 'ShareTechMono_400Regular',
    fontSize: 9,
    color: COLORS.textDim,
    letterSpacing: 1,
  },

  // Buttons
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 14,
  },
  btnPrimary: {
    flex: 1,
    padding: 13,
    backgroundColor: COLORS.accent,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontFamily: 'ShareTechMono_400Regular',
    fontSize: 11,
    color: '#fff',
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  btnSecondary: {
    flex: 1,
    padding: 13,
    backgroundColor: 'transparent',
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontFamily: 'ShareTechMono_400Regular',
    fontSize: 11,
    color: COLORS.accent2,
    letterSpacing: 1.2,
  },

  // Bottom nav
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 14,
    paddingBottom: 28,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    marginTop: 20,
  },
  navItem: { alignItems: 'center', gap: 4 },
  navItemIcon: { fontSize: 14 },
  navItemLabel: {
    fontFamily: 'ShareTechMono_400Regular',
    fontSize: 8,
    letterSpacing: 1.2,
  },
  navItemActive: { color: COLORS.accent },
  navItemInactive: { color: '#3a3560' },

  // Text helpers
  textSecondary: {
    fontFamily: 'ShareTechMono_400Regular',
    fontSize: 11,
    color: COLORS.textSecondary,
  },
});