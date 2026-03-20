import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState, useEffect } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedUrl, setScannedUrl] = useState<string | null>(null);
  const qrLock = useRef(false);
  const appState = useRef(AppState.currentState);

  // Unlock scanner when app comes back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        qrLock.current = false;
        appState.current = nextAppState;
      }
    });
    return () => subscription.remove();
  }, []);

  // Handle permission states
  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>
          SafeScan needs camera access to scan QR codes
        </Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  // When a QR code is scanned
  const handleScan = ({ data }: { data: string }) => {
    if (data && !qrLock.current) {
      qrLock.current = true;
      setScannedUrl(data);
      // TODO: send data to Cloudflare Worker for scoring
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={handleScan}
      />
      {scannedUrl && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultLabel}>Scanned URL:</Text>
          <Text style={styles.resultUrl}>{scannedUrl}</Text>
          <Pressable
            style={styles.button}
            onPress={() => {
              setScannedUrl(null);
              qrLock.current = false;
            }}
          >
            <Text style={styles.buttonText}>Scan Again</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  message: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  resultContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 24,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  resultLabel: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 4,
  },
  resultUrl: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});