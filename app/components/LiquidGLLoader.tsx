"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    html2canvas?: (...args: unknown[]) => unknown;
    liquidGL?: (options?: Record<string, unknown>) => unknown;
    __liquidGLInitialized__?: boolean;
  }
}

const HTML2CANVAS_CDN =
  "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";

export default function LiquidGLLoader() {
  useEffect(() => {
    let isUnmounted = false;

    const loadScript = (src: string) =>
      new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(
          `script[src=\"${src}\"]`,
        );

        if (existing?.dataset.loaded === "true") {
          resolve();
          return;
        }

        const script = existing || document.createElement("script");
        script.src = src;
        script.async = true;

        script.onload = () => {
          script.dataset.loaded = "true";
          resolve();
        };

        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));

        if (!existing) {
          document.head.appendChild(script);
        }
      });

    const boot = async () => {
      try {
        await loadScript(HTML2CANVAS_CDN);

        if (isUnmounted) {
          return;
        }

        await import("../scripts/liquidGL.bootstrap");

        if (isUnmounted || window.__liquidGLInitialized__ || !window.liquidGL) {
          return;
        }

        window.liquidGL({
          target: ".liquidGL",
          snapshot: "body",
          resolution: 1.3,
          frost: 0.06,
          refraction: 0.01,
          specular: true,
          shadow: true,
        });

        window.__liquidGLInitialized__ = true;
      } catch (error) {
        console.error("LiquidGL failed to initialize", error);
      }
    };

    boot();

    return () => {
      isUnmounted = true;
    };
  }, []);

  return null;
}
