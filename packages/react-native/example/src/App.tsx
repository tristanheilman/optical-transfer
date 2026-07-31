// Example app: the smallest thing that shows the library working.
//
// Two roles on two devices:
//   • SEND    — turns a sample payload into an animated QR stream.
//   • RECEIVE — points the camera at another phone's screen and rebuilds it.
//
// Put one phone in SEND and another in RECEIVE, aim the camera at the screen,
// and watch the progress climb to 100%.

import React, { useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  OpticalSenderView,
  OpticalReceiverView,
} from "@optical-transfer/react-native";

type Role = "menu" | "send" | "receive";

// A recognizable, verifiable sample payload (~2 KB of UTF-8 text).
function makeSamplePayload(): { bytes: Uint8Array; text: string } {
  const lines: string[] = [
    "optical-transfer demo payload",
    "-----------------------------",
  ];
  for (let i = 0; i < 40; i++) {
    lines.push(`line ${i.toString().padStart(3, "0")}: the quick brown fox jumps over the lazy dog`);
  }
  const text = lines.join("\n");
  const bytes = utf8Encode(text);
  return { bytes, text };
}

function utf8Encode(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return new Uint8Array(out);
}

function utf8Decode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i]!;
    if (b < 0x80) {
      s += String.fromCharCode(b);
      i += 1;
    } else if (b < 0xe0) {
      s += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1]! & 0x3f));
      i += 2;
    } else {
      s += String.fromCharCode(
        ((b & 0x0f) << 12) | ((bytes[i + 1]! & 0x3f) << 6) | (bytes[i + 2]! & 0x3f),
      );
      i += 3;
    }
  }
  return s;
}

export default function App() {
  const [role, setRole] = useState<Role>("menu");
  const { bytes, text } = useMemo(makeSamplePayload, []);
  const [received, setReceived] = useState<string | null>(null);

  if (role === "send") {
    return (
      <SafeAreaView style={styles.fill}>
        <Header title="Sending" onBack={() => setRole("menu")} />
        <View style={styles.center}>
          <OpticalSenderView data={bytes} blockLen={128} fps={10} size={300} />
          <Text style={styles.caption}>
            {bytes.length} bytes · aim the other phone's camera here
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (role === "receive") {
    return (
      <SafeAreaView style={styles.fill}>
        <Header title="Receiving" onBack={() => setRole("menu")} />
        {received == null ? (
          <OpticalReceiverView
            style={styles.fill}
            onComplete={(data) => setReceived(utf8Decode(data))}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.resultBox}>
            <Text style={styles.resultTitle}>✓ Received {received.length} chars</Text>
            <Text style={styles.mono}>{received}</Text>
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.fill}>
      <View style={styles.center}>
        <Text style={styles.title}>optical-transfer</Text>
        <Text style={styles.subtitle}>air-gapped file transfer · screen → camera</Text>
        <TouchableOpacity style={styles.button} onPress={() => setRole("send")}>
          <Text style={styles.buttonText}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonAlt]}
          onPress={() => {
            setReceived(null);
            setRole("receive");
          }}
        >
          <Text style={styles.buttonText}>Receive</Text>
        </TouchableOpacity>
        <Text style={styles.caption} numberOfLines={1}>
          sample: “{text.slice(0, 28)}…”
        </Text>
      </View>
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0b0b0f" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { color: "#fff", fontSize: 28, fontWeight: "800" },
  subtitle: { color: "#9aa0aa", fontSize: 14, marginTop: 6, marginBottom: 40 },
  button: {
    backgroundColor: "#3b82f6",
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    marginTop: 16,
    minWidth: 220,
    alignItems: "center",
  },
  buttonAlt: { backgroundColor: "#10b981" },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  caption: { color: "#9aa0aa", fontSize: 13, marginTop: 20, textAlign: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  back: { color: "#3b82f6", fontSize: 17 },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700", flex: 1, textAlign: "center" },
  headerSpacer: { width: 48 },
  resultBox: { padding: 20 },
  resultTitle: { color: "#10b981", fontSize: 18, fontWeight: "700", marginBottom: 12 },
  mono: { color: "#e5e7eb", fontFamily: "Courier", fontSize: 12 },
});
