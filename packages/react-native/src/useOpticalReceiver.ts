// useOpticalReceiver — React state wrapper around the core OpticalReceiver.
//
// Feed it the base64 strings a QR scanner produces; it decodes them to frame
// bytes, peels the fountain, and re-renders as progress advances. The heavy
// lifting (dedup, peeling, checksum) lives in @optical-transfer/core.

import { useCallback, useMemo, useState } from "react";
import { OpticalReceiver } from "@optical-transfer/core";
import { base64ToBytes } from "./base64";

export interface ReceiverState {
  /** 0..1, frames-collected (stable) not blocks-solved (back-loaded). */
  progress: number;
  isComplete: boolean;
  result: Uint8Array | null;
  framesReceived: number;
}

const EMPTY: ReceiverState = {
  progress: 0,
  isComplete: false,
  result: null,
  framesReceived: 0,
};

export interface UseOpticalReceiver extends ReceiverState {
  /** Feed one decoded QR value (base64 text). Malformed input is ignored. */
  ingestBase64: (value: string) => void;
  /** Drop all state and wait for a fresh stream. */
  reset: () => void;
  /** The underlying core receiver, for advanced use. */
  receiver: OpticalReceiver;
}

export function useOpticalReceiver(): UseOpticalReceiver {
  const receiver = useMemo(() => new OpticalReceiver(), []);
  const [state, setState] = useState<ReceiverState>(EMPTY);

  const ingestBase64 = useCallback(
    (value: string) => {
      let bytes: Uint8Array;
      try {
        bytes = base64ToBytes(value);
      } catch {
        return; // not one of our frames
      }
      receiver.ingest(bytes);
      setState({
        progress: receiver.progress,
        isComplete: receiver.isComplete,
        result: receiver.result,
        framesReceived: receiver.framesReceived,
      });
    },
    [receiver],
  );

  const reset = useCallback(() => {
    receiver.reset();
    setState(EMPTY);
  }, [receiver]);

  return { ...state, ingestBase64, reset, receiver };
}
