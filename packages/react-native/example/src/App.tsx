// Example app: demonstrates transferring different *media types* over the
// optical channel — plain text, JSON, and an image — screen → camera.
//
// Two roles on two devices:
//   • SEND    — pick a media type; it's wrapped in a self-describing envelope
//               (mime + filename + bytes) and broadcast as an animated QR stream.
//   • RECEIVE — points the camera at another phone's screen, rebuilds the bytes,
//               reads the envelope, and renders text / JSON / image accordingly.
//
// The core transport carries only raw bytes; the mime/filename envelope
// (see payload.ts) is an app-level concern layered on top.

import React, { useMemo, useState } from "react";
import {
  Image,
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
  bytesToBase64,
  gzipCodec,
  DEFAULT_CODECS,
} from "@optical-transfer/react-native";
import { SAMPLES, type Sample } from "./samples";
import { decodeEnvelope, type Envelope } from "./payload";
import { utf8Decode } from "./util";

type Role = "menu" | "send" | "receive";

export default function App() {
  const [role, setRole] = useState<Role>("menu");
  const [sample, setSample] = useState<Sample | null>(null);
  const [received, setReceived] = useState<Envelope | null>(null);
  const [recvError, setRecvError] = useState<string | null>(null);

  // ---- SEND -----------------------------------------------------------------
  if (role === "send") {
    if (!sample) {
      return (
        <SafeAreaView style={styles.fill}>
          <Header title="Send — pick a type" onBack={() => setRole("menu")} />
          <View style={styles.center}>
            {SAMPLES.map((s) => (
              <TouchableOpacity key={s.key} style={styles.button} onPress={() => setSample(s)}>
                <Text style={styles.buttonText}>{s.label}</Text>
                <Text style={styles.buttonHint}>{s.hint}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      );
    }
    return <SendView sample={sample} onBack={() => setSample(null)} />;
  }

  // ---- RECEIVE --------------------------------------------------------------
  if (role === "receive") {
    return (
      <SafeAreaView style={styles.fill}>
        <Header
          title="Receiving"
          onBack={() => {
            setReceived(null);
            setRecvError(null);
            setRole("menu");
          }}
        />
        {received == null ? (
          <OpticalReceiverView
            style={styles.fill}
            codecs={DEFAULT_CODECS}
            onComplete={(bytes) => {
              try {
                setReceived(decodeEnvelope(bytes));
              } catch (e) {
                setRecvError(e instanceof Error ? e.message : String(e));
              }
            }}
          />
        ) : (
          <ReceivedView
            envelope={received}
            onReset={() => {
              setReceived(null);
              setRecvError(null);
            }}
          />
        )}
        {recvError && <Text style={styles.errorLine}>⚠ {recvError}</Text>}
      </SafeAreaView>
    );
  }

  // ---- MENU -----------------------------------------------------------------
  return (
    <SafeAreaView style={styles.fill}>
      <View style={styles.center}>
        <Text style={styles.title}>optical-transfer</Text>
        <Text style={styles.subtitle}>air-gapped file transfer · screen → camera</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setSample(null);
            setRole("send");
          }}
        >
          <Text style={styles.buttonText}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonAlt]}
          onPress={() => {
            setReceived(null);
            setRecvError(null);
            setRole("receive");
          }}
        >
          <Text style={styles.buttonText}>Receive</Text>
        </TouchableOpacity>
        <Text style={styles.caption}>text · json · image</Text>
      </View>
    </SafeAreaView>
  );
}

// Sends one sample as an animated, gzip-compressed QR stream.
function SendView({ sample, onBack }: { sample: Sample; onBack: () => void }) {
  const bytes = useMemo(() => sample.build(), [sample]);
  return (
    <SafeAreaView style={styles.fill}>
      <Header title={`Sending ${sample.label}`} onBack={onBack} />
      <View style={styles.center}>
        <OpticalSenderView data={bytes} codec={gzipCodec} blockLen={128} fps={10} size={300} />
        <Text style={styles.caption}>
          {sample.label} · {bytes.length} bytes (gzip'd) · aim the other phone's camera here
        </Text>
      </View>
    </SafeAreaView>
  );
}

// Renders a reconstructed envelope by its MIME type.
function ReceivedView({ envelope, onReset }: { envelope: Envelope; onReset: () => void }) {
  const { mime, name, data } = envelope;
  return (
    <ScrollView contentContainerStyle={styles.resultBox}>
      <Text style={styles.resultTitle}>✓ Received {data.length} bytes</Text>
      <Text style={styles.metaLine}>
        {name} · {mime}
      </Text>

      {mime.startsWith("image/") ? (
        <Image
          source={{ uri: `data:${mime};base64,${bytesToBase64(data)}` }}
          style={styles.image}
          resizeMode="contain"
        />
      ) : mime === "application/json" || mime.startsWith("text/") ? (
        <Text style={styles.mono}>{utf8Decode(data)}</Text>
      ) : (
        <Text style={styles.mono}>{hexPreview(data)}</Text>
      )}

      <TouchableOpacity style={[styles.button, styles.buttonAlt]} onPress={onReset}>
        <Text style={styles.buttonText}>Receive another</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function hexPreview(data: Uint8Array): string {
  const n = Math.min(data.length, 256);
  let s = "";
  for (let i = 0; i < n; i++) s += data[i]!.toString(16).padStart(2, "0") + (i % 16 === 15 ? "\n" : " ");
  if (data.length > n) s += `\n… (+${data.length - n} more bytes)`;
  return s;
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
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    marginTop: 16,
    minWidth: 240,
    alignItems: "center",
  },
  buttonAlt: { backgroundColor: "#10b981" },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  buttonHint: { color: "#dbeafe", fontSize: 12, marginTop: 4 },
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
  resultBox: { padding: 20, alignItems: "center" },
  resultTitle: { color: "#10b981", fontSize: 18, fontWeight: "700", marginBottom: 4 },
  metaLine: { color: "#9aa0aa", fontSize: 13, marginBottom: 16 },
  mono: { color: "#e5e7eb", fontFamily: "Courier", fontSize: 12, alignSelf: "stretch" },
  image: {
    width: 240,
    height: 240,
    borderRadius: 12,
    backgroundColor: "#000",
    marginVertical: 8,
  },
  errorLine: {
    color: "#f87171",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 8,
  },
});
