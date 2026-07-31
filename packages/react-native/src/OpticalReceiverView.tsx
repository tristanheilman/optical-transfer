// OpticalReceiverView — camera capture side (react-native-vision-camera v5).
//
// v5 is a nitro rewrite: scanning is composed from camera "outputs" rather than
// a single useCodeScanner hook. We attach a preview output (to show the camera)
// and an object output scanning for "qr", then pipe every decoded value into
// the fountain receiver. On verified completion, onComplete fires with the
// reconstructed bytes.
//
// Note: the code value is error-corrected text; we carry frames as base64 so it
// round-trips exactly. Scanning is iOS-first in v5 (ScannedObject is @platform
// iOS), which matches this example's target.

import React, { useEffect } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import {
  Camera,
  isScannedCode,
  useCameraDevice,
  useCameraPermission,
  useObjectOutput,
  usePreviewOutput,
} from "react-native-vision-camera";
import { useOpticalReceiver } from "./useOpticalReceiver";

export interface OpticalReceiverViewProps {
  /** Fires once, with the reconstructed file, on verified completion. */
  onComplete?: (data: Uint8Array) => void;
  /** Fires on every progress change (0..1). */
  onProgress?: (progress: number, framesReceived: number) => void;
  /** Hide the built-in status overlay. */
  hideOverlay?: boolean;
  style?: ViewStyle;
}

export function OpticalReceiverView({
  onComplete,
  onProgress,
  hideOverlay,
  style,
}: OpticalReceiverViewProps) {
  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();
  const { progress, isComplete, result, framesReceived, ingestBase64 } =
    useOpticalReceiver();

  // Camera outputs: a preview to render, and a QR object scanner.
  const preview = usePreviewOutput();
  const objectOutput = useObjectOutput({
    types: ["qr"],
    onObjectsScanned: (objects) => {
      for (const o of objects) {
        if (isScannedCode(o) && o.value) ingestBase64(o.value);
      }
    },
  });

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    onProgress?.(progress, framesReceived);
  }, [progress, framesReceived, onProgress]);

  useEffect(() => {
    if (isComplete && result) onComplete?.(result);
  }, [isComplete, result, onComplete]);

  if (!hasPermission) {
    return (
      <View style={[styles.center, style]}>
        <Text style={styles.info}>Camera permission required…</Text>
      </View>
    );
  }
  if (device == null) {
    return (
      <View style={[styles.center, style]}>
        <Text style={styles.info}>No back camera available.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!isComplete}
        outputs={[preview, objectOutput]}
      />
      {!hideOverlay && (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.status}>
            {isComplete
              ? "✓ Transfer complete"
              : `Receiving… ${Math.round(progress * 100)}%  (${framesReceived} frames)`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  info: { color: "#fff", fontSize: 16 },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 40,
    alignItems: "center",
  },
  status: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: "hidden",
  },
});
