// OpticalSenderView — renders the animated QR stream for the broadcast side.
//
// It drives OpticalSender's endless frame stream at a fixed frame rate, base64s
// each frame, and hands it to a byte-mode QR renderer. Point another device's
// camera (OpticalReceiverView) at it and the file peels out the other end.

import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { OpticalSender } from "@optical-transfer/core";
import { bytesToBase64 } from "./base64";

export interface OpticalSenderViewProps {
  /** The file/payload to broadcast. */
  data: Uint8Array;
  /** Payload bytes per frame. Smaller = sparser (easier-to-scan) QR codes. Default 128. */
  blockLen?: number;
  /** Frames displayed per second. Default 10. */
  fps?: number;
  /** QR code side length in px. Default 300. */
  size?: number;
  /** Fixed session id (else random per mount). */
  sessionId?: number;
  /** QR error-correction level. Default "L" — the fountain code handles erasures. */
  ecl?: "L" | "M" | "Q" | "H";
  style?: ViewStyle;
  /** Called once with the sender, e.g. to read `sender.k` / `sender.header`. */
  onReady?: (sender: OpticalSender) => void;
}

export function OpticalSenderView({
  data,
  blockLen = 128,
  fps = 10,
  size = 300,
  sessionId,
  ecl = "L",
  style,
  onReady,
}: OpticalSenderViewProps) {
  const sender = useMemo(
    () => new OpticalSender(data, { blockLen, sessionId }),
    [data, blockLen, sessionId],
  );

  useEffect(() => {
    onReady?.(sender);
  }, [sender, onReady]);

  const [seq, setSeq] = useState(0);
  useEffect(() => {
    setSeq(0);
    const period = Math.max(1, Math.round(1000 / fps));
    const id = setInterval(() => setSeq((s) => (s + 1) >>> 0), period);
    return () => clearInterval(id);
  }, [sender, fps]);

  const value = useMemo(() => bytesToBase64(sender.frame(seq)), [sender, seq]);

  return (
    <View style={[styles.container, style]}>
      <QRCode value={value} size={size} ecl={ecl} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 16,
  },
});
