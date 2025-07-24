import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions";

export default function WaveformTrimmer({ file, onRegionChange }) {
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [region, setRegion] = useState(null);

  useEffect(() => {
    if (!file) return;

    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "#90cdf4",
      progressColor: "#2b6cb0",
      height: 100,
      responsive: true,
      plugins: [
        RegionsPlugin.create({
          dragSelection: true,
        }),
      ],
    });

    wavesurfer.loadBlob(file);
    wavesurferRef.current = wavesurfer;

    wavesurfer.on("ready", () => {
      const duration = wavesurfer.getDuration();
      const start = 0;
      const end = Math.min(duration, 30);
      const newRegion = wavesurfer.addRegion({
        start,
        end,
        color: "rgba(66, 153, 225, 0.3)",
        drag: true,
        resize: true,
      });
      setRegion(newRegion);
      onRegionChange({ start, end });
    });

    wavesurfer.on("region-updated", (region) => {
      onRegionChange({ start: region.start, end: region.end });
    });

    return () => {
      wavesurfer.destroy();
    };
  }, [file]);

  const playRegion = () => {
    if (region && wavesurferRef.current) {
      wavesurferRef.current.play(region.start, region.end);
    }
  };

  return (
    <div>
      <div ref={waveformRef} className="w-full mb-4" />
      <button
        onClick={playRegion}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        ▶️ Play Trimmed
      </button>
    </div>
  );
}
