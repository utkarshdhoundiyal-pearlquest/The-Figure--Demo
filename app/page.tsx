"use client";

import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronRight,
  CircleStop,
  Download,
  Images,
  LoaderCircle,
  LockKeyhole,
  Maximize2,
  Printer,
  Sparkles,
  WandSparkles,
  X,
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
    accent: "#4e67ff",
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
    accent: "#ff825c",
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
    accent: "#e6c7ff",
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
    accent: "#7bd8a7",
  },
];

const MODEL_NAME = "lucy-vton-3.6";

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
  const [message, setMessage] = useState("Choose 2–3 looks to begin");
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [printReady, setPrintReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const outputVideoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<RealTimeClient | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedOutfits = useMemo(
    () => selectedIds.map((id) => OUTFITS.find((look) => look.id === id)!),
    [selectedIds],
  );
  const activeOutfit = selectedOutfits[activeIndex] ?? selectedOutfits[0];

  const showToast = useCallback((text: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(text);
    toastTimerRef.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const stopSession = useCallback(() => {
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (outputVideoRef.current) outputVideoRef.current.srcObject = null;
    setStatus("idle");
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      sessionRef.current?.disconnect();
      cameraStream?.getTracks().forEach((track) => track.stop());
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [cameraStream]);

  const toggleOutfit = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length === 3) {
        showToast("Three looks is the maximum for this demo");
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
        const payload = (await response.json()) as {
          apiKey?: string;
          error?: string;
        };
        if (!response.ok || !payload.apiKey) {
          throw new Error(payload.error ?? "Decart token unavailable");
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
          setMessage("Lucy AI is styling you live");
        }
        if (nextStatus === "reconnecting") {
          setMessage("Reconnecting the AI fitting room…");
        }
      },
      onRemoteStream: (transformedStream) => {
        if (outputVideoRef.current) {
          outputVideoRef.current.srcObject = transformedStream;
          void outputVideoRef.current.play();
        }
        setStatus("live");
        setMessage("Lucy AI is styling you live");
      },
    });

    session.on("error", (error) => {
      console.error("Decart realtime error", error);
      setMessage("AI stream paused — your camera preview is still available");
    });
    sessionRef.current = session;
  };

  const startTryOn = async () => {
    if (selectedOutfits.length < 2) {
      showToast("Choose at least two outfits first");
      return;
    }

    setStage("studio");
    setStatus("camera");
    setMessage("Waiting for camera permission…");
    setActiveIndex(0);

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

      setStatus("connecting");
      setMessage("Connecting to Lucy Virtual Try-On…");
      try {
        await connectLucy(stream, selectedOutfits[0]);
      } catch (error) {
        console.info("Starting camera-only preview", error);
        setStatus("preview");
        setMessage("Demo preview — add DECART_API_KEY to enable live AI");
        showToast("Camera is on. Live AI needs a Decart API key.");
      }
    } catch (error) {
      console.info("Camera unavailable", error);
      setStatus("error");
      setMessage("Camera access was blocked or is unavailable");
      showToast("Please allow camera access and try again");
    }
  };

  const changeOutfit = async (index: number) => {
    const nextOutfit = selectedOutfits[index];
    if (!nextOutfit) return;
    setActiveIndex(index);
    setMessage(`Loading ${nextOutfit.name}…`);
    if (sessionRef.current) {
      try {
        await sessionRef.current.set({
          prompt: nextOutfit.prompt,
          image: nextOutfit.image,
          enhance: true,
        });
        setMessage(`Now wearing ${nextOutfit.name}`);
      } catch (error) {
        console.error("Outfit switch failed", error);
        setMessage("That look could not load — try again");
      }
    } else {
      setMessage(`Previewing ${nextOutfit.name}`);
    }
  };

  const cycleOutfit = (direction: 1 | -1) => {
    const next =
      (activeIndex + direction + selectedOutfits.length) % selectedOutfits.length;
    void changeOutfit(next);
  };

  const capturePhoto = () => {
    const output = outputVideoRef.current;
    const local = localVideoRef.current;
    const source = output?.srcObject ? output : local;
    if (!source || !source.videoWidth || !source.videoHeight) {
      showToast("The camera is still warming up");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = source.videoWidth;
    canvas.height = source.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    if (source === local) {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.94);
    setCaptures((current) => [
      ...current,
      { dataUrl, outfitName: activeOutfit?.name ?? "The Figure look" },
    ]);
    setPrintReady(true);
    showToast("Shot saved — your print is ready");
  };

  const downloadLatest = () => {
    const capture = captures.at(-1);
    if (!capture) return;
    const link = document.createElement("a");
    link.href = capture.dataUrl;
    link.download = `the-figure-${capture.outfitName.toLowerCase().replaceAll(" ", "-")}.jpg`;
    link.click();
  };

  const printShots = () => {
    if (!captures.length) {
      showToast("Take a photo first");
      return;
    }
    setPrintReady(true);
    showToast("Print layout ready");
    setTimeout(() => window.print(), 180);
  };

  const resetExperience = () => {
    stopSession();
    setStage("select");
    setCaptures([]);
    setPrintReady(false);
    setMessage("Choose 2–3 looks to begin");
  };

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="The Figure home">
          THE FIGURE<span>®</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#collection">Looks</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <div className="header-status">
          <span className="live-dot" /> AI fitting room
        </div>
      </header>

      <section id="top" className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={14} /> Lucy AI × Decart</div>
          <h1>
            Your body.
            <br />
            <em>Every</em> possibility.
          </h1>
          <p>
            Build a three-look capsule, step in front of your camera, and watch
            each outfit move with you in real time.
          </p>
          <a className="hero-cta" href="#collection">
            Try new outfits <ArrowRight size={18} />
          </a>
        </div>
        <div className="hero-visual" aria-label="The Figure virtual styling preview">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-silhouette">
            <span className="silhouette-head" />
            <span className="silhouette-body" />
            <span className="scan-line" />
          </div>
          <div className="look-label look-label-one">
            <span>LOOK 02</span>
            City Blue
          </div>
          <div className="look-label look-label-two">
            <span>LIVE FIT</span>
            MOVES WITH YOU
          </div>
          <div className="hero-index">TF / 001</div>
        </div>
      </section>

      <section id="collection" className="collection-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">01 / CURATE</span>
            <h2>Choose your lineup.</h2>
          </div>
          <p>
            Pick <strong>2–3 outfits</strong>. You can switch between them live
            once your camera starts.
          </p>
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
                aria-pressed={isSelected}
              >
                <span className="outfit-number">{outfit.number}</span>
                <span className="outfit-check">
                  {isSelected ? <Check size={18} /> : <span>+</span>}
                </span>
                <span className="outfit-image-wrap" style={{ background: outfit.accent }}>
                  <img src={outfit.image} alt={outfit.category} loading="lazy" />
                </span>
                <span className="outfit-meta">
                  <span>
                    <strong>{outfit.name}</strong>
                    <small>{outfit.category}</small>
                  </span>
                  <ChevronRight size={18} />
                </span>
              </button>
            );
          })}
        </div>

        <div className={`selection-dock ${selectedIds.length ? "visible" : ""}`}>
          <div className="selection-copy">
            <span>{selectedIds.length}/3 selected</span>
            <strong>
              {selectedIds.length < 2
                ? `Choose ${2 - selectedIds.length} more`
                : "Your fitting room is ready"}
            </strong>
          </div>
          <div className="selected-thumbs" aria-label="Selected outfits">
            {[0, 1, 2].map((slot) => {
              const outfit = selectedOutfits[slot];
              return outfit ? (
                <button
                  key={outfit.id}
                  type="button"
                  onClick={() => toggleOutfit(outfit.id)}
                  aria-label={`Remove ${outfit.name}`}
                >
                  <img src={outfit.image} alt="" />
                  <X size={12} />
                </button>
              ) : (
                <span key={slot} className="empty-slot">{slot + 1}</span>
              );
            })}
          </div>
          <button
            className="start-button"
            type="button"
            disabled={selectedIds.length < 2}
            onClick={startTryOn}
          >
            Start try-on <Camera size={18} />
          </button>
        </div>
      </section>

      <section
        className={`studio-section ${stage === "studio" ? "is-open" : ""}`}
        aria-hidden={stage !== "studio"}
      >
        <div className="studio-topbar">
          <button type="button" onClick={resetExperience}>
            <ArrowLeft size={17} /> Back to looks
          </button>
          <div className="studio-status">
            <span className={`status-light ${status}`} /> {message}
          </div>
          <span>Session 01</span>
        </div>

        <div className="studio-layout">
          <aside className="studio-rail">
            <span className="rail-label">YOUR LOOKS</span>
            {selectedOutfits.map((outfit, index) => (
              <button
                type="button"
                key={outfit.id}
                className={index === activeIndex ? "active" : ""}
                onClick={() => void changeOutfit(index)}
              >
                <img src={outfit.image} alt="" />
                <span>{String(index + 1).padStart(2, "0")}</span>
              </button>
            ))}
          </aside>

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
            {(status === "camera" || status === "connecting") && (
              <div className="camera-loading">
                <LoaderCircle className="spin" size={36} />
                <strong>{status === "camera" ? "Opening camera" : "Styling your first look"}</strong>
                <span>This normally takes a few seconds.</span>
              </div>
            )}
            {status === "error" && (
              <div className="camera-loading error-state">
                <Camera size={34} />
                <strong>We can’t see you yet</strong>
                <span>Allow camera access in your browser, then try again.</span>
                <button type="button" onClick={startTryOn}>Try camera again</button>
              </div>
            )}
            <div className="camera-chrome">
              <div className="ai-badge">
                <WandSparkles size={14} />
                {status === "live" ? "LUCY AI · LIVE" : "CAMERA PREVIEW"}
              </div>
              <button type="button" aria-label="Full screen" onClick={() => document.documentElement.requestFullscreen?.()}>
                <Maximize2 size={17} />
              </button>
            </div>
            <div className="active-look-label">
              <span>NOW TRYING</span>
              <strong>{activeOutfit?.name}</strong>
            </div>
            <div className="camera-arrows">
              <button type="button" onClick={() => cycleOutfit(-1)} aria-label="Previous outfit">
                <ArrowLeft size={19} />
              </button>
              <button type="button" onClick={() => cycleOutfit(1)} aria-label="Next outfit">
                <ArrowRight size={19} />
              </button>
            </div>
          </div>

          <aside className="studio-actions">
            <div className="action-heading">
              <span>CAPTURE</span>
              <strong>Make it yours.</strong>
            </div>
            <button className="capture-button" type="button" onClick={capturePhoto}>
              <span><Camera size={26} /></span>
              Take photo
            </button>
            <button type="button" onClick={downloadLatest} disabled={!captures.length}>
              <Download size={18} /> Save latest
            </button>
            <button type="button" onClick={printShots} disabled={!captures.length}>
              <Printer size={18} /> Print stickers
            </button>
            <div className="capture-count">
              <Images size={16} /> {captures.length} shot{captures.length === 1 ? "" : "s"} saved
            </div>
            <div className="privacy-note">
              <LockKeyhole size={16} />
              <p><strong>Private by design.</strong> Camera frames are used for your live session and aren’t stored by this demo.</p>
            </div>
            <button className="end-session" type="button" onClick={resetExperience}>
              <CircleStop size={17} /> End session
            </button>
          </aside>
        </div>
      </section>

      <section id="how-it-works" className="how-section">
        <div className="section-heading inverse">
          <div>
            <span className="section-kicker">02 / THE MAGIC</span>
            <h2>From camera to keepsake.</h2>
          </div>
          <p>One playful flow, designed for a retail kiosk or any personal device.</p>
        </div>
        <div className="steps-grid">
          <article><span>01</span><Camera size={30} /><h3>Step into frame</h3><p>Works with the browser camera on phones, tablets, laptops, and desktops.</p></article>
          <article><span>02</span><WandSparkles size={30} /><h3>Lucy styles live</h3><p>Decart’s virtual try-on model transforms the video stream while you move.</p></article>
          <article><span>03</span><Printer size={30} /><h3>Take it with you</h3><p>Capture a favorite look, save the photo, or print a branded sticker sheet.</p></article>
        </div>
      </section>

      <footer>
        <a className="wordmark" href="#top">THE FIGURE<span>®</span></a>
        <p>AN EXPERIMENT IN SEEING YOURSELF DIFFERENTLY.</p>
        <span>Powered by Lucy Virtual Try-On</span>
      </footer>

      {toast && <div className="toast" role="status"><Check size={16} /> {toast}</div>}

      <div className={`print-sheet ${printReady ? "ready" : ""}`} aria-hidden="true">
        <div className="print-brand">THE FIGURE®</div>
        <div className="print-grid">
          {(captures.length ? captures.slice(-3) : []).map((capture, index) => (
            <figure key={`${capture.outfitName}-${index}`}>
              <img src={capture.dataUrl} alt="" />
              <figcaption>{capture.outfitName}<span>THE FIGURE / LOOK {String(index + 1).padStart(2, "0")}</span></figcaption>
            </figure>
          ))}
        </div>
        <p>Cut along the dotted line · Made with Lucy AI × Decart</p>
      </div>
    </main>
  );
}
