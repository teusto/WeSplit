"use client";

import { useEffect, useRef, useState } from "react";
import { usePrivyWalletOwner } from "./privy-provider";

export type BillPayer = {
  id: string;
  name?: string;
  phone?: string;
};

export type Bill = {
  value: number;
  currency: string;
  owner: string;
  payers: BillPayer[];
};

type CameraVisionProps = {
  endpoint?: string;
  owner?: string;
  onBillReady?: (bill: Bill) => void;
};

export const CameraVision = ({
  endpoint = "/api/bill-extract",
  owner = "me",
  onBillReady,
}: CameraVisionProps) => {
  const walletOwner = usePrivyWalletOwner();
  const billOwner = walletOwner || owner;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string>("");
  const [imageBase64, setImageBase64] = useState<string>("");
  const [previewTotal, setPreviewTotal] = useState<string>("");
  const [previewCurrency, setPreviewCurrency] = useState<string>("");

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const openCamera = async () => {
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" }, // mobile back camera when possible
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCameraOpen(true);
    } catch (err) {
      setError("Could not access camera. Check browser permissions and HTTPS.");
      console.error(err);
    }
  };

  const captureImage = async (): Promise<Blob | null> => {
    setError("");

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      setError("Camera not ready.");
      return null;
    }

    const sourceWidth = video.videoWidth || 1280;
    const sourceHeight = video.videoHeight || 720;
    const maxEdge = 1280;
    const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Could not create image context.");
      return null;
    }

    ctx.drawImage(video, 0, 0, width, height);

    // Keep base64 in state in case your API needs it
    const base64 = canvas.toDataURL("image/jpeg", 0.78);
    setImageBase64(base64);

    // Prefer Blob upload (usually smaller and better for APIs)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.78),
    );

    if (!blob) {
      setError("Could not capture image.");
      return null;
    }

    return blob;
  };

  const sendToExtractor = async () => {
    setError("");

    const blob = await captureImage();
    if (!blob) return;

    stopCamera();

    try {
      setIsSending(true);

      const formData = new FormData();
      formData.append("file", blob, "receipt.jpg");

      // If your API expects base64, uncomment:
      // formData.append("imageBase64", imageBase64);

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Extraction failed: ${response.status}`);
      }

      // Keep generic since we don't know provider shape yet
      const data = await response.json().catch(async () => ({
        raw: await response.text(),
      }));

      const extracted = (data ?? {}) as Record<string, unknown>;
      const maybeValue = extracted.value ?? extracted.total ?? extracted.amount;
      const numericValue =
        typeof maybeValue === "number"
          ? maybeValue
          : Number(String(maybeValue ?? "").replace(/[^\d.-]/g, ""));

      const currency =
        typeof extracted.currency === "string" && extracted.currency.trim()
          ? extracted.currency.trim().toUpperCase()
          : "USD";

      const newBill: Bill = {
        value: Number.isFinite(numericValue) ? numericValue : 0,
        currency,
        owner: billOwner,
        payers: [],
      };

      setPreviewTotal(Number.isFinite(numericValue) ? String(numericValue) : "");
      setPreviewCurrency(currency);
      onBillReady?.(newBill);
    } catch (err) {
      setError("Failed to send image to extraction service.");
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 rounded-2xl border border-[var(--foreground)]/15 bg-white/45 p-5 text-center">
      <div className="grid items-stretch gap-4 md:grid-cols-[0.95fr_1.45fr]">
        <div className="flex flex-col justify-center gap-4 rounded-xl border border-[var(--foreground)]/15 bg-white/50 p-4 text-left">
          <p className="text-sm text-[var(--foreground)]/70">Scan your receipt to auto-fill the next step.</p>

          {!isCameraOpen ? (
            <button
              type="button"
              onClick={openCamera}
              className="w-fit rounded-full border border-[var(--foreground)]/30 px-4 py-2 text-sm text-[var(--foreground)] transition hover:border-[var(--highlight)] hover:text-[var(--highlight)]"
            >
              Open camera
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={sendToExtractor}
                disabled={isSending}
                className="rounded-full bg-[var(--highlight)] px-5 py-2 text-sm text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending ? "Sending..." : "Capture & Send"}
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="rounded-full border border-[var(--foreground)]/30 px-4 py-2 text-sm text-[var(--foreground)] transition hover:border-[var(--highlight)] hover:text-[var(--highlight)]"
              >
                Close camera
              </button>
            </div>
          )}

          <p className="text-xs text-[var(--foreground)]/60">Tip: keep the total amount visible before capturing.</p>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-[var(--foreground)]/20 bg-black/80">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`h-full min-h-64 w-full object-cover ${isCameraOpen ? "block" : "hidden"}`}
          />

          {!isCameraOpen && imageBase64 ? (
            <img
              src={imageBase64}
              alt="Captured receipt preview"
              className="h-full min-h-64 w-full object-cover"
            />
          ) : null}

          {!isCameraOpen && !imageBase64 ? (
            <div className="flex min-h-64 items-center justify-center px-6 text-sm text-white/70">
              Camera preview appears here
            </div>
          ) : null}

          {isSending ? (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="shader-refract-overlay absolute inset-0" />
              <div className="shader-scan-line absolute left-0 right-0 h-12" />
              <div className="absolute inset-x-0 top-3 text-center text-xs tracking-[0.25em] text-white/80">
                SCANNING RECEIPT
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-[var(--foreground)]/15 bg-white/50 p-4 md:grid-cols-2">
        <label className="grid gap-1 text-left text-sm">
          <span className="text-[var(--foreground)]/70">Detected total</span>
          <input
            readOnly
            value={previewTotal}
            placeholder="Waiting for extraction"
            className="rounded-lg border border-[var(--foreground)]/20 bg-white/60 px-3 py-2 text-[var(--foreground)] placeholder:text-[var(--foreground)]/45"
          />
        </label>

        <label className="grid gap-1 text-left text-sm">
          <span className="text-[var(--foreground)]/70">Detected currency</span>
          <input
            readOnly
            value={previewCurrency}
            placeholder="USD"
            className="rounded-lg border border-[var(--foreground)]/20 bg-white/60 px-3 py-2 text-[var(--foreground)] placeholder:text-[var(--foreground)]/45"
          />
        </label>
      </div>

      {!isCameraOpen ? <p className="text-xs text-[var(--foreground)]/60">Open camera to capture and send to extraction API.</p> : null}

      {error ? <p className="text-sm text-[var(--highlight)]">{error}</p> : null}

      {/* hidden canvas used for frame capture */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
};
