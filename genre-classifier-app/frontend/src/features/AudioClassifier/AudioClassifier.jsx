import React, { useState, useRef, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { FaMusic } from "react-icons/fa";

export default function AudioClassifier() {
  const [audioFile, setAudioFile] = useState(null);
  const [audioURL, setAudioURL] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [regionTimes, setRegionTimes] = useState({ start: 0, end: 0 });

  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const regionRef = useRef(null);
  const currentTimeLabelRef = useRef(null);
  const currentTimeLineRef = useRef(null);

  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleFile = (file) => {
    if (file && file.type.startsWith("audio")) {
      setAudioFile(file);
      setResult(null);
      const url = URL.createObjectURL(file);
      setAudioURL(url);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    handleFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFile(file);
      e.dataTransfer.clearData();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClear = () => {
    setAudioFile(null);
    setAudioURL(null);
    setResult(null);
    setIsPlaying(false);
    wavesurferRef.current?.destroy();
    wavesurferRef.current = null;
    regionRef.current = null;
    setRegionTimes({ start: 0, end: 0 });
  };

  const handlePredict = async () => {
    if (!audioFile || !regionRef.current) return;

    const start = regionRef.current.start;
    const end = regionRef.current.end;
    regionRef.current.setOptions({ drag: false });

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", audioFile);
    formData.append("start", start);
    formData.append("end", end);

    try {
      const response = await fetch("http://localhost:5000/predict", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          type: "success",
          data: data.data,
        });
      } else {
        setResult({
          type: "error",
          message: data.error || "Terjadi kesalahan saat memproses file.",
        });
      }
    } catch (error) {
      setResult({
        type: "error",
        message: "Terjadi kesalahan saat melakukan request ke server.",
      });
    } finally {
      setLoading(false);
      regionRef.current.setOptions({ drag: true });
    }
  };

  const togglePlay = () => {
    if (!wavesurferRef.current || !regionRef.current) return;

    if (isPlaying) {
      wavesurferRef.current.pause();
      setIsPlaying(false);
    } else {
      wavesurferRef.current.play(regionRef.current.start);
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    if (audioURL && waveformRef.current) {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }

      const regionsPlugin = RegionsPlugin.create();
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "#ccc",
        progressColor: "#4A30E9",
        height: 100,
        barWidth: 2,
        responsive: true,
        plugins: [regionsPlugin],
      });

      wavesurferRef.current.load(audioURL);

      wavesurferRef.current.on("ready", () => {
        const duration = wavesurferRef.current.getDuration();
        const regionEnd = Math.min(duration, 30);

        const region = regionsPlugin.addRegion({
          start: 0,
          end: regionEnd,
          color: "rgba(199, 21, 133, 0.25)",
          drag: true,
          resize: false,
        });

        regionRef.current = region;
        setRegionTimes({ start: 0, end: regionEnd });

        region.on("region-update", (updatedRegion) => {
          setRegionTimes({
            start: updatedRegion.start,
            end: updatedRegion.end,
          });
        });

        region.on("region-updated", (updatedRegion) => {
          regionRef.current = updatedRegion;
        });

        region.on("update-end", () => {
          wavesurferRef.current.pause();
          region.play();
          setIsPlaying(true);

          setRegionTimes({
            start: region.start,
            end: region.end,
          });
        });

        wavesurferRef.current.on("audioprocess", () => {
          const currentTime = wavesurferRef.current.getCurrentTime();
          const container = waveformRef.current;
          const duration = wavesurferRef.current.getDuration();

          if (currentTime > region.end) {
            wavesurferRef.current.pause();
            setIsPlaying(false);
          }

          if (
            container &&
            currentTimeLineRef.current &&
            currentTimeLabelRef.current
          ) {
            const progressRatio = currentTime / duration;
            const containerWidth = container.clientWidth;
            const x = progressRatio * containerWidth;

            currentTimeLineRef.current.style.left = `${x}px`;
            currentTimeLabelRef.current.style.left = `${x}px`;
            currentTimeLabelRef.current.textContent = formatTime(currentTime);
          }
        });

        setIsPlaying(true);
        region.play();
      });

      return () => {
        wavesurferRef.current?.destroy();
        wavesurferRef.current = null;
        regionRef.current = null;
      };
    }
  }, [audioURL]);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#070A21]">
      <main className="px-6 md:px-12 lg:px-24 py-8 font-sans text-[#FFFFFE] grow">
        <h2 className="text-xl font-bold text-left mb-6 text-[#FFFFFE]">
          Gelang
        </h2>

        <div className="py-6">
          <h3 className="text-3xl font-bold text-left mb-6 text-[#FFFFFE]">
            Upload audio to know the music genre!
          </h3>
          <p className="text-md font-normal text-left mb-6 text-[#FFFFFE]">
            This model is trained with augmentation such as pitch positive,
            pitch negative, and reverb. Try it now!
          </p>
        </div>

        {/* DRAG AND DROP */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative w-full h-36 flex items-center justify-center border-2 border-dashed rounded-lg transition-colors mb-6 ${
            isDragging
              ? "border-[#4A30E9] bg-[#101831]"
              : "border-[#4A30E9]/40 bg-[#101831]"
          }`}
        >
          <div className="flex flex-col items-center text-[#FFFFFE] text-center px-2">
            <FaMusic className="text-2xl mb-4 text-[#FFFFFE]/60" />
            <p className="text-sm">
              {audioFile
                ? audioFile.name
                : "Tarik dan jatuhkan file audio di sini atau klik untuk memilih"}
            </p>
          </div>
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            disabled={loading}
            className="absolute w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* WAVEFORM */}
        {audioURL && (
          <div className="relative mb-6 mt-8">
            <div
              ref={waveformRef}
              className="w-full rounded overflow-hidden bg-[#101831] h-[100px]"
            />
            <div
              ref={currentTimeLineRef}
              className="absolute top-0 h-[100px] w-[2px] bg-[#4A30E9] pointer-events-none"
            ></div>
            <div
              ref={currentTimeLabelRef}
              className="absolute -top-6 text-xs text-[#4A30E9] font-semibold transform -translate-x-1/2"
            ></div>

            {/* Kontrol Play + Penanda waktu */}
            {regionRef.current && (
              <div className="flex items-center justify-between mt-4 px-2 text-sm text-[#FFFFFE]">
                {/* Tombol Play */}
                <button
                  onClick={togglePlay}
                  className="px-4 py-1 bg-[#4A30E9] text-white rounded hover:bg-[#3A25c5] transition"
                >
                  {isPlaying ? "⏸️ Pause" : "▶️ Play"}
                </button>

                {/* Waktu Start dan End */}
                <div className="flex items-center space-x-4">
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-[#FFFFFE]/60">Start</span>
                    <span className="font-mono font-semibold">
                      {formatTime(regionTimes.start)}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-[#FFFFFE]/60">End</span>
                    <span className="font-mono font-semibold">
                      {formatTime(regionTimes.end)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BUTTONS */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6">
          <button
            onClick={handleClear}
            disabled={!audioFile || loading}
            className="flex-1 px-4 py-2 rounded bg-[#101831] text-[#FFFFFE] font-semibold disabled:opacity-50 hover:bg-[#1a203a] transition"
          >
            Clear
          </button>
          <button
            onClick={handlePredict}
            disabled={!audioFile || loading}
            className="flex-1 px-4 py-2 rounded bg-[#4A30E9] text-white font-semibold disabled:opacity-50 hover:bg-[#3A25c5] transition"
          >
            {loading ? "Memproses..." : "Klasifikasi"}
          </button>
        </div>

        {/* LOADING */}
        {loading && (
          <div className="flex justify-center mb-6">
            <div className="border-4 border-[#4A30E9]/30 border-t-[#4A30E9] rounded-full w-8 h-8 animate-spin"></div>
          </div>
        )}

        {/* RESULT */}
        {result && (
          <div className="bg-[#101831] p-4 rounded-lg overflow-auto max-h-80 shadow-inner text-sm text-[#FFFFFE]">
            {result.type === "error" ? (
              <p className="text-red-400 font-semibold text-center">
                {result.message}
              </p>
            ) : (
              <div>
                <p className="text-[#4A30E9] font-bold text-center mb-4 text-lg">
                  🎧 Genre Teratas:{" "}
                  <span className="text-white underline">
                    {result.data.top_prediction.genre}
                  </span>{" "}
                  ({result.data.top_prediction.confidence}%)
                </p>
                <div className="space-y-3">
                  {result.data.results.map((r, index) => (
                    <div key={index}>
                      <div className="flex justify-between text-sm font-medium text-[#FFFFFE] mb-1">
                        <span>{r.genre}</span>
                        <span>{r.percentage}%</span>
                      </div>
                      <div className="w-full bg-[#070A21] rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${
                            r.genre === result.data.top_prediction.genre
                              ? "bg-[#4A30E9]"
                              : "bg-[#4A30E9]/50"
                          }`}
                          style={{ width: `${r.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-center text-[#FFFFFE]/60 mt-4">
                  🔍 Berdasarkan {result.data.segment_count} segmen audio.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="text-center text-[#FFFFFE]/60 py-4">
        © 2025 Gelang, Created For Final Project
      </footer>
    </div>
  );
}
