// Example app: a small *test bench* for the optical channel. Send different
// media types (text, JSON, image, URL, contact) and stress payloads (large /
// incompressible), tune the transport (compression, block size, fps), and watch
// the receiver reconstruct and render whatever it gets — screen → camera.
//
// The core transport carries only raw bytes; the mime/filename envelope
// (see payload.ts) is an app-level concern layered on top.

import React, { useMemo, useState } from "react";
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  OpticalSenderView,
  OpticalReceiverView,
  bytesToBase64,
  base64ToBytes,
  gzipCodec,
  DEFAULT_CODECS,
} from "@optical-transfer/react-native";
import { launchImageLibrary } from "react-native-image-picker";
import { SAMPLES, type Sample, type SampleGroup } from "./samples";
import { encodeEnvelope, decodeEnvelope, type Envelope } from "./payload";
import { utf8Decode } from "./util";

type Role = "menu" | "send" | "receive";

interface Settings {
  compress: boolean;
  blockLen: number;
  fps: number;
}

const DEFAULT_SETTINGS: Settings = { compress: true, blockLen: 128, fps: 10 };
const GROUPS: SampleGroup[] = ["Media", "Stress"];

export default function App() {
  const [role, setRole] = useState<Role>("menu");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [active, setActive] = useState<{ sample: Sample; bytes: Uint8Array } | null>(null);
  const [received, setReceived] = useState<Envelope | null>(null);
  const [recvError, setRecvError] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  // Pick a real photo from the library and queue it for sending. We cap the
  // dimensions so a full-res photo doesn't turn into a multi-minute transfer;
  // the resulting byte count is shown on the broadcast screen.
  async function pickPhoto() {
    setPickError(null);
    try {
      const res = await launchImageLibrary({
        mediaType: "photo",
        includeBase64: true,
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.6,
      });
      if (res.didCancel) return;
      if (res.errorCode) {
        setPickError(res.errorMessage ?? res.errorCode);
        return;
      }
      const asset = res.assets?.[0];
      if (!asset?.base64) {
        setPickError("no image data returned");
        return;
      }
      const mime = asset.type ?? "image/jpeg";
      const name = asset.fileName ?? "photo.jpg";
      const data = base64ToBytes(asset.base64);
      const bytes = encodeEnvelope({ mime, name, data });
      setActive({
        sample: { key: "photo", label: name, group: "Media", hint: mime, build: () => bytes },
        bytes,
      });
    } catch (e) {
      setPickError(e instanceof Error ? e.message : String(e));
    }
  }

  // ---- SEND -----------------------------------------------------------------
  if (role === "send") {
    if (active) {
      return (
        <SendView
          label={active.sample.label}
          bytes={active.bytes}
          settings={settings}
          onBack={() => setActive(null)}
        />
      );
    }
    return (
      <SafeAreaView style={styles.fill}>
        <Header title="Send" onBack={() => setRole("menu")} />
        <ScrollView contentContainerStyle={styles.menuScroll}>
          <SettingsPanel settings={settings} onChange={setSettings} />

          <Text style={styles.groupHeader}>Your device</Text>
          <TouchableOpacity style={styles.row} onPress={pickPhoto}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Pick a photo…</Text>
              <Text style={styles.rowHint}>send a real image from your library</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
          {pickError && <Text style={styles.errorLine}>⚠ {pickError}</Text>}

          {GROUPS.map((group) => (
            <View key={group}>
              <Text style={styles.groupHeader}>{group}</Text>
              {SAMPLES.filter((s) => s.group === group).map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={styles.row}
                  onPress={() => setActive({ sample: s, bytes: s.build() })}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{s.label}</Text>
                    <Text style={styles.rowHint}>{s.hint}</Text>
                  </View>
                  <Text style={styles.chev}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
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
            setActive(null);
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
        <Text style={styles.caption}>text · json · image · url · contact · stress</Text>
      </View>
    </SafeAreaView>
  );
}

// Transport tuning controls, applied to whatever sample you then send.
function SettingsPanel({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelRow}>
        <Text style={styles.panelLabel}>Compression (gzip)</Text>
        <Switch
          value={settings.compress}
          onValueChange={(v) => onChange({ ...settings, compress: v })}
        />
      </View>
      <View style={styles.panelRow}>
        <Text style={styles.panelLabel}>Block size</Text>
        <Segmented
          options={[64, 128, 256]}
          value={settings.blockLen}
          onSelect={(v) => onChange({ ...settings, blockLen: v })}
        />
      </View>
      <View style={styles.panelRow}>
        <Text style={styles.panelLabel}>Frames / sec</Text>
        <Segmented
          options={[5, 10, 15]}
          value={settings.fps}
          onSelect={(v) => onChange({ ...settings, fps: v })}
        />
      </View>
    </View>
  );
}

function Segmented({
  options,
  value,
  onSelect,
}: {
  options: number[];
  value: number;
  onSelect: (v: number) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = o === value;
        return (
          <TouchableOpacity
            key={o}
            style={[styles.segment, on && styles.segmentOn]}
            onPress={() => onSelect(o)}
          >
            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{o}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Broadcasts one payload as an animated QR stream using the chosen settings.
function SendView({
  label,
  bytes,
  settings,
  onBack,
}: {
  label: string;
  bytes: Uint8Array;
  settings: Settings;
  onBack: () => void;
}) {
  return (
    <SafeAreaView style={styles.fill}>
      <Header title={`Sending ${label}`} onBack={onBack} />
      <View style={styles.center}>
        <OpticalSenderView
          data={bytes}
          codec={settings.compress ? gzipCodec : undefined}
          blockLen={settings.blockLen}
          fps={settings.fps}
          size={300}
        />
        <Text style={styles.caption}>
          {bytes.length.toLocaleString()} bytes
          {settings.compress ? " · gzip" : " · raw"} · block {settings.blockLen} · {settings.fps} fps
        </Text>
        <Text style={styles.captionDim}>aim the other phone's camera here</Text>
      </View>
    </SafeAreaView>
  );
}

// Renders a reconstructed envelope by its MIME type.
function ReceivedView({ envelope, onReset }: { envelope: Envelope; onReset: () => void }) {
  const { mime, name, data } = envelope;
  const isImage = mime.startsWith("image/");
  const isText = mime === "application/json" || mime.startsWith("text/");
  return (
    <ScrollView contentContainerStyle={styles.resultBox}>
      <Text style={styles.resultTitle}>✓ Received {data.length.toLocaleString()} bytes</Text>
      <Text style={styles.metaLine}>
        {name} · {mime}
      </Text>

      {isImage ? (
        <Image
          source={{ uri: `data:${mime};base64,${bytesToBase64(data)}` }}
          style={styles.image}
          resizeMode="contain"
        />
      ) : isText ? (
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
  for (let i = 0; i < n; i++) {
    s += data[i]!.toString(16).padStart(2, "0") + (i % 16 === 15 ? "\n" : " ");
  }
  if (data.length > n) s += `\n… (+${(data.length - n).toLocaleString()} more bytes)`;
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
  menuScroll: { padding: 16, paddingBottom: 48 },
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
  caption: { color: "#cbd2dc", fontSize: 13, marginTop: 20, textAlign: "center" },
  captionDim: { color: "#9aa0aa", fontSize: 12, marginTop: 6, textAlign: "center" },
  // send menu
  groupHeader: {
    color: "#9aa0aa",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16161d",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  rowText: { flex: 1 },
  rowLabel: { color: "#fff", fontSize: 16, fontWeight: "600" },
  rowHint: { color: "#9aa0aa", fontSize: 12, marginTop: 2 },
  chev: { color: "#5b6472", fontSize: 22 },
  // settings panel
  panel: { backgroundColor: "#16161d", borderRadius: 12, padding: 8 },
  panelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  panelLabel: { color: "#e5e7eb", fontSize: 15 },
  segmented: { flexDirection: "row", backgroundColor: "#0b0b0f", borderRadius: 8, padding: 2 },
  segment: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 6 },
  segmentOn: { backgroundColor: "#3b82f6" },
  segmentText: { color: "#9aa0aa", fontSize: 14, fontWeight: "600" },
  segmentTextOn: { color: "#fff" },
  // header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  back: { color: "#3b82f6", fontSize: 17 },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700", flex: 1, textAlign: "center" },
  headerSpacer: { width: 48 },
  // received
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
  errorLine: { color: "#f87171", fontSize: 13, textAlign: "center", paddingVertical: 8 },
});
