// @optical-transfer/react-native — React Native bindings for optical transfer.
//
// A thin platform layer over @optical-transfer/core: it supplies the pixels
// (animated byte-mode QR via react-native-qrcode-svg) and the camera capture
// (react-native-vision-camera). The transport logic itself is all in core.

export { OpticalSenderView } from "./OpticalSenderView";
export type { OpticalSenderViewProps } from "./OpticalSenderView";

export { OpticalReceiverView } from "./OpticalReceiverView";
export type { OpticalReceiverViewProps } from "./OpticalReceiverView";

export { useOpticalReceiver } from "./useOpticalReceiver";
export type { ReceiverState, UseOpticalReceiver } from "./useOpticalReceiver";

export { bytesToBase64, base64ToBytes } from "./base64";

// Re-export the core essentials so app code needs a single import.
export { OpticalSender, OpticalReceiver } from "@optical-transfer/core";
export type { SenderOptions, FrameHeader } from "@optical-transfer/core";
