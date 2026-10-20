"use client";

import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  LoaderCircle,
  Maximize2,
  Play,
  Printer,
  RotateCcw,
} from "lucide-react";
import type { RealTimeClient } from "@decartai/sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Outfit = {
  id: string;
  number: string;
  name: string;
  category: string;
  prompt: string;
  image: string;
  accent: string;
};

type Capture = {
  dataUrl: string;
  outfitName: string;
};

const OUTFITS: Outfit[] = [
  {
    id: "midnight",
    number: "01",
    name: "Midnight Formal",
    category: "Tuxedo",
    prompt:
      "Replace the person's clothes with the elegant black tuxedo from the reference image, keeping their face, body, pose, and background unchanged.",
    image: "https://api-onboarding.decart.ai/prompt-gallery/try-ons/tuxedo.webp",
    accent: "#e7ff44",
  },
  {
    id: "city-denim",
    number: "02",
    name: "City Blue",
    category: "Denim jacket",
    prompt:
      "Replace the person's clothes with the blue denim jacket from the reference image, preserving their identity, body shape, pose, and background.",
    image:
      "https://api-onboarding.decart.ai/prompt-gallery/try-ons/denim-jacket.webp",
    accent: "#6f83ff",
  },
  {
    id: "desert-suede",
    number: "03",
    name: "Desert Suede",
    category: "Suede jacket",
    prompt:
      "Replace the person's clothes with the warm suede jacket from the reference image, preserving their identity, body proportions, pose, and background.",
    image:
      "https://api-onboarding.decart.ai/prompt-gallery/try-ons/suede-jacket.webp",
    accent: "#ef9b78",
  },
  {
    id: "soft-signal",
    number: "04",
    name: "Soft Signal",
    category: "Fleece zip",
    prompt:
      "Replace the person's clothes with the fleece zip jacket from the reference image, preserving their face, body, movement, and background.",
    image:
      "https://api-onboarding.decart.ai/prompt-gallery/try-ons/fleece-zip-jacket.webp",
    accent: "#ddc7ee",
  },
  {
    id: "field-note",
    number: "05",
    name: "Field Note",
    category: "Barn jacket",
    prompt:
      "Replace the person's clothes with the classic barn jacket from the reference image, preserving their identity, body shape, pose, and background.",
    image:
      "https://api-onboarding.decart.ai/prompt-gallery/try-ons/bree-barn-jacket.webp",
    accent: "#91cfaa",
  },
  {
    id: "sculpted-noir",
    number: "06",
    name: "Sculpted Noir",
    category: "Lambskin bustier",
    prompt:
      "Replace the person's clothes with the black lambskin bustier outfit from the reference image, preserving their identity, body proportions, pose, and background.",
    image:
      "https://api-onboarding.decart.ai/prompt-gallery/try-ons/lambskin-bustier.webp",
    accent: "#cec8c0",
  },
  {
    id: "atelier-stripe",
    number: "07",
    name: "Atelier Stripe",
    category: "Oversized shirt",
    prompt:
      "Replace the person's clothes with the oversized striped shirt from the reference image, preserving their face, body shape, pose, and background.",
    image:
      "https://api-onboarding.decart.ai/prompt-gallery/try-ons/oversized-striped-shirt.webp",
    accent: "#b8d2e5",
  },
  {
    id: "clean-slate",
    number: "08",
    name: "Clean Slate",
    category: "Sleeveless tee",
    prompt:
      "Replace the person's clothes with the sleeveless t-shirt from the reference image, preserving their identity, body proportions, movement, and background.",
    image:
      "https://api-onboarding.decart.ai/prompt-gallery/try-ons/sleeveless-t-shirt.webp",
    accent: "#e9e4da",
  },
  {
    id: "gallery-green",
    number: "09",
    name: "Gallery Green",
    category: "Green essential",
    prompt:
      "Replace the person's clothes with the green outfit from the reference image, preserving their face, body shape, pose, and background.",
    image:
      "https://api-onboarding.decart.ai/prompt-gallery/try-ons/basic-green.webp",
    accent: "#a7c99f",
  },
  {
    id: "solar-basic",
    number: "10",
    name: "Solar Basic",
    category: "Yellow essential",
    prompt:
      "Replace the person's clothes with the yellow outfit from the reference image, preserving their identity, body proportions, pose, and background.",
    image:
      "https://api-onboarding.decart.ai/prompt-gallery/try-ons/basic-yellow.webp",
    accent: "#e9d261",
  },
];

const MODEL_NAME = "lucy-vton-3.6";
const AI_DEMO_SECONDS = 15;

function requestCamera(constraints: MediaStreamConstraints) {
  return new Promise<MediaStream>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      reject(new Error("Camera permission timed out"));
    }, 15_000);

    navigator.mediaDevices.getUserMedia(constraints).then(
      (stream) => {
        if (settled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        settled = true;
        clearTimeout(timeout);
        resolve(stream);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export default function Home() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [stage, setStage] = useState<"select" | "studio">("select");
  const [activeIndex, setActiveIndex] = useState(0);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<
    "idle" | "camera" | "connecting" | "live" | "preview" | "error"
  >("idle");
  const [message, setMessage] = useState("Choose outfit");
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [printReady, setPrintReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [aiSecondsLeft, setAiSecondsLeft] = useState(AI_DEMO_SECONDS);
  const [aiDemoUsed, setAiDemoUsed] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const outputVideoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<RealTimeClient | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedOutfits = useMemo(
    () => selectedIds.map((id) => OUTFITS.find((look) => look.id === id)!),
    [selectedIds],
  );
  const activeOutfit = selectedOutfits[activeIndex] ?? selectedOutfits[0];
  const latestCapture = captures.at(-1);

  const showToast = useCallback((text: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(text);
    toastTimerRef.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const stopLucy = useCallback((reason = "Ready") => {
    if (aiTimerRef.current) {
      clearInterval(aiTimerRef.current);
      aiTimerRef.current = null;
    }
    const session = sessionRef.current;
    sessionRef.current = null;
    session?.disconnect();
    if (outputVideoRef.current) outputVideoRef.current.srcObject = null;
    setAiSecondsLeft(0);
    setStatus((current) => (current === "idle" || current === "error" ? current : "preview"));
    setMessage(reason);
  }, []);

  const stopSession = useCallback(() => {
    stopLucy();
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setStatus("idle");
  }, [cameraStream, stopLucy]);

  useEffect(() => {
    return () => {
      sessionRef.current?.disconnect();
      cameraStream?.getTracks().forEach((track) => track.stop());
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (aiTimerRef.current) clearInterval(aiTimerRef.current);
    };
  }, [cameraStream]);

  useEffect(() => {
    const pauseHiddenSession = () => {
      if (document.hidden && sessionRef.current) stopLucy("Paused");
    };
    document.addEventListener("visibilitychange", pauseHiddenSession);
    return () => document.removeEventListener("visibilitychange", pauseHiddenSession);
  }, [stopLucy]);

  const toggleOutfit = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length === 3) {
        showToast("Choose up to three");
        return current;
      }
      return [...current, id];
    });
  };

  const connectLucy = async (stream: MediaStream, outfit: Outfit) => {
    const { createDecartClient, models } = await import("@decartai/sdk");
    const client = createDecartClient({
      apiKeyProvider: async () => {
        const response = await fetch("/api/realtime-token", { method: "POST" });
        const payload = (await response.json()) as { apiKey?: string; error?: string };
        if (!response.ok || !payload.apiKey) {
          throw new Error(payload.error ?? "Try-on unavailable");
        }
        return payload.apiKey;
      },
    });

    const model = models.realtime(MODEL_NAME);
    const session = await client.realtime.connect(stream, {
      model,
      mirror: "auto",
      initialState: {
        prompt: { text: outfit.prompt, enhance: true },
        image: outfit.image,
      },
      onConnectionChange: (nextStatus) => {
        if (nextStatus === "connected" || nextStatus === "generating") {
          setStatus("live");
          setMessage("Live");
        }
        if (nextStatus === "reconnecting") setMessage("Starting");
        if (nextStatus === "disconnected" && sessionRef.current) stopLucy("Paused");
      },
      onRemoteStream: (transformedStream) => {
        if (outputVideoRef.current) {
          outputVideoRef.current.srcObject = transformedStream;
          void outputVideoRef.current.play();
        }
        setStatus("live");
        setMessage("Live");
      },
    });

    session.on("error", (error) => {
      console.error("Try-on stream error", error);
      stopLucy("Try again");
    });
    sessionRef.current = session;
  };

  const startCamera = async () => {
    if (!selectedOutfits.length) {
      showToast("Choose an outfit");
      return;
    }

    setStage("studio");
    setStatus("camera");
    setMessage("Opening camera");
    setActiveIndex(0);
    setCaptures([]);
    setPrintReady(false);
    setAiDemoUsed(false);
    setAiSecondsLeft(AI_DEMO_SECONDS);
    setShowInstructions(false);

    try {
      const { models } = await import("@decartai/sdk");
      const model = models.realtime(MODEL_NAME);
      const stream = await requestCamera({
        audio: false,
        video: {
          facingMode: "user",
          frameRate: { ideal: typeof model.fps === "number" ? model.fps : 25 },
          width: { ideal: model.width },
          height: { ideal: model.height },
        },
      });
      setCameraStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play();
      }
      setStatus("preview");
      setMessage("Ready");
      setShowInstructions(true);
    } catch (error) {
      console.info("Camera unavailable", error);
      setStatus("error");
      setMessage("Camera unavailable");
    }
  };

  const startTryOn = async () => {
    if (!cameraStream || !activeOutfit || aiDemoUsed || status === "connecting") return;

    setShowInstructions(false);
    setStatus("connecting");
    setMessage("Starting");
    setAiSecondsLeft(AI_DEMO_SECONDS);

    try {
      await connectLucy(cameraStream, activeOutfit);
      setAiDemoUsed(true);
      setStatus("live");
      setMessage("Live");
      let remaining = AI_DEMO_SECONDS;
      if (aiTimerRef.current) clearInterval(aiTimerRef.current);
      aiTimerRef.current = setInterval(() => {
        remaining -= 1;
        setAiSecondsLeft(Math.max(remaining, 0));
        if (remaining <= 0) {
          stopLucy("Time complete");
          showToast("Session complete");
        }
      }, 1000);
    } catch (error) {
      console.info("Try-on unavailable", error);
      setStatus("preview");
      setMessage("Try again");
      setShowInstructions(true);
      showToast("Please try again");
    }
  };

  const changeOutfit = async (index: number) => {
    const nextOutfit = selectedOutfits[index];
    if (!nextOutfit) return;
    setActiveIndex(index);
    if (sessionRef.current) {
      try {
        await sessionRef.current.set({
          prompt: nextOutfit.prompt,
          image: nextOutfit.image,
          enhance: true,
        });
      } catch (error) {
        console.error("Outfit switch failed", error);
        showToast("Try another outfit");
      }
    }
  };

  const cycleOutfit = (direction: 1 | -1) => {
    const next =
      (activeIndex + direction + selectedOutfits.length) % selectedOutfits.length;
    void changeOutfit(next);
  };

  const capturePhoto = () => {
    const output = outputVideoRef.current;
    if (!output?.srcObject || !output.videoWidth || !output.videoHeight) {
      showToast("Hold still for a moment");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = output.videoWidth;
    canvas.height = output.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(output, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCaptures([{ dataUrl, outfitName: activeOutfit?.name ?? "The Figure" }]);
    setPrintReady(true);
    stopLucy("Ready to print");
    showToast("Photo ready");
  };

  const printPhoto = () => {
    if (!captures.length) {
      showToast("Take a photo first");
      return;
    }
    setPrintReady(true);
    setTimeout(() => window.print(), 120);
  };

  const resetExperience = () => {
    stopSession();
    setStage("select");
    setSelectedIds([]);
    setCaptures([]);
    setPrintReady(false);
    setAiDemoUsed(false);
    setAiSecondsLeft(AI_DEMO_SECONDS);
    setShowInstructions(false);
    setMessage("Choose outfit");
  };

  return (
    <main className="kiosk-app">
      {stage === "select" ? (
        <section className="choose-screen" aria-labelledby="choose-title">
          <div className="choose-heading">
            <div className="figure-logo" aria-label="The Figure">
              THE FIGURE<span>®</span>
            </div>
            <h1 id="choose-title">Choose outfit</h1>
          </div>

          <div className="outfit-grid">
            {OUTFITS.map((outfit) => {
              const isSelected = selectedIds.includes(outfit.id);
              return (
                <button
                  type="button"
                  className={`outfit-card ${isSelected ? "selected" : ""}`}
                  key={outfit.id}
                  onClick={() => toggleOutfit(outfit.id)}
                  aria-label={`${isSelected ? "Remove" : "Choose"} ${outfit.name}`}
                  aria-pressed={isSelected}
                >
                  <span className="outfit-image" style={{ background: outfit.accent }}>
                    <img src={outfit.image} alt={outfit.category} loading="lazy" />
                  </span>
                  <span className="outfit-name">{outfit.name}</span>
                  <span className="outfit-check" aria-hidden="true">
                    {isSelected ? <Check size={20} strokeWidth={3} /> : outfit.number}
                  </span>
                </button>
              );
            })}
          </div>

          <div className={`selection-bar ${selectedIds.length ? "visible" : ""}`}>
            <span>{selectedIds.length} selected</span>
            <button type="button" onClick={startCamera} disabled={!selectedIds.length}>
              Start <Play size={20} fill="currentColor" />
            </button>
          </div>
        </section>
      ) : (
        <section className="studio-screen" aria-label="Photo studio">
          <button className="back-button" type="button" onClick={resetExperience} aria-label="Choose another outfit">
            <ArrowLeft size={24} />
          </button>

          <div className="look-strip" aria-label="Selected outfits">
            {selectedOutfits.map((outfit, index) => (
              <button
                type="button"
                key={outfit.id}
                className={index === activeIndex ? "active" : ""}
                onClick={() => void changeOutfit(index)}
                aria-label={`Try ${outfit.name}`}
              >
                <img src={outfit.image} alt="" />
              </button>
            ))}
          </div>

          <div className="camera-stage">
            <video
              ref={localVideoRef}
              className={`camera-video local-video ${status === "live" ? "underlay" : ""}`}
              autoPlay
              muted
              playsInline
            />
            <video
              ref={outputVideoRef}
              className={`camera-video output-video ${status === "live" ? "visible" : ""}`}
              autoPlay
              muted
              playsInline
            />

            {latestCapture && status === "preview" && (
              <img className="capture-preview" src={latestCapture.dataUrl} alt="Your captured look" />
            )}

            {(status === "camera" || status === "connecting") && (
              <div className="center-overlay loading-overlay" role="status">
                <LoaderCircle className="spin" size={42} />
                <strong>{message}</strong>
              </div>
            )}

            {status === "error" && (
              <div className="center-overlay error-overlay">
                <Camera size={38} />
                <strong>Camera unavailable</strong>
                <button type="button" onClick={startCamera}>Try again</button>
              </div>
            )}

            {showInstructions && status === "preview" && !latestCapture && (
              <div className="center-overlay instruction-overlay">
                <div className="instruction-card">
                  <span>Before your photo</span>
                  <h2>Stand in the frame.<br />Face the camera.<br />Hold still.</h2>
                  <button type="button" onClick={startTryOn}>
                    I&apos;m ready <Play size={20} fill="currentColor" />
                  </button>
                </div>
              </div>
            )}

            {status === "preview" && aiDemoUsed && !latestCapture && !showInstructions && (
              <div className="center-overlay complete-overlay">
                <strong>Try again</strong>
                <button type="button" onClick={resetExperience}>Choose outfit</button>
              </div>
            )}

            <button
              type="button"
              className="fullscreen-button"
              aria-label="Full screen"
              onClick={() => document.documentElement.requestFullscreen?.()}
            >
              <Maximize2 size={21} />
            </button>

            {status === "live" && <div className="session-timer">{aiSecondsLeft}</div>}

            <div className="active-look">{activeOutfit?.name}</div>

            {selectedOutfits.length > 1 && status === "live" && (
              <div className="camera-arrows">
                <button type="button" onClick={() => cycleOutfit(-1)} aria-label="Previous outfit">
                  <ArrowLeft size={22} />
                </button>
                <button type="button" onClick={() => cycleOutfit(1)} aria-label="Next outfit">
                  <ArrowRight size={22} />
                </button>
              </div>
            )}
          </div>

          <aside className="studio-actions">
            <button
              className="photo-button"
              type="button"
              onClick={capturePhoto}
              disabled={status !== "live"}
            >
              <Camera size={28} />
              Photo
            </button>
            <button
              className="print-button"
              type="button"
              onClick={printPhoto}
              disabled={!captures.length}
            >
              <Printer size={28} />
              Print
            </button>
            <button className="restart-button" type="button" onClick={resetExperience}>
              <RotateCcw size={20} />
              Start over
            </button>
          </aside>

          <span className="sr-only" aria-live="polite">{message}</span>
        </section>
      )}

      {toast && <div className="toast" role="status"><Check size={18} /> {toast}</div>}

      <div className={`print-sheet ${printReady ? "ready" : ""}`} aria-hidden="true">
        <div className="print-brand">THE FIGURE®</div>
        <div className="print-grid">
          {captures.map((capture, index) => (
            <figure key={`${capture.outfitName}-${index}`}>
              <img src={capture.dataUrl} alt="" />
              <figcaption>{capture.outfitName}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </main>
  );
}
