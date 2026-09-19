import { PauseIcon, PlayIcon, SmilePlusIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useChatStore } from "../../store/useChatStore";
import { withTransform } from "../../lib/imagekit";
import { MessageVideo } from "./MessageVideo";

const IMAGE_TRANSFORM = "q-auto,w-640,f-auto";
const WAVE_SAMPLES = [
  8, 12, 14, 18, 12, 10, 16, 14, 8, 20, 10, 14, 16, 18, 10, 9, 12, 16, 18, 12,
  14, 10, 8, 15, 18, 12, 10, 11, 14, 16, 10, 8,
];
const REACTION_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

function formatAudioDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function MessageBubble({ message }) {
  const isOwnMessage = message.role === "me";
  const hasImage = Boolean(message.imageUrl);
  const hasGif = Boolean(message.gifUrl);
  const hasAudio = Boolean(message.audioUrl);
  const hasVideo = Boolean(message.videoUrl);
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(15);
  const [showReactions, setShowReactions] = useState(false);
  const reactToMessage = useChatStore((state) => state.reactToMessage);
  const reactions = message.reactions || [];

  const handleAudioToggle = async () => {
    if (!audioRef.current) return;

    if (audioRef.current.paused) {
      await audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    audioRef.current.pause();
    setIsPlaying(false);
  };

  const handleAudioMetadata = () => {
    if (!audioRef.current) return;
    const duration = Number(audioRef.current.duration);
    if (Number.isFinite(duration) && duration > 0) {
      setAudioDuration(duration);
    }
  };

  const handleReactionClick = (emoji) => {
    reactToMessage(message.id, emoji);
    setShowReactions(false);
  };

  return (
    <div
      className={`relative flex w-full ${isOwnMessage ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`relative max-w-[min(90%,28rem)] rounded-2xl px-3 py-2 text-[15px] leading-snug sm:max-w-[min(75%,28rem)] sm:px-3.5 ${
          isOwnMessage
            ? "rounded-br-md bg-accent text-accent-foreground"
            : "rounded-bl-md bg-surface"
        }`}
      >
        {showReactions ? (
          <div className="absolute -top-11 left-0 z-20 flex items-center gap-1 rounded-full border border-white/20 bg-white/90 p-1 shadow-lg backdrop-blur-sm">
            {REACTION_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReactionClick(emoji)}
                className="flex size-7 items-center justify-center rounded-full text-base transition-transform hover:scale-110"
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}

        {hasImage ? (
          <img
            src={withTransform(message.imageUrl, IMAGE_TRANSFORM)}
            alt=""
            className="mb-1.5 max-h-40 max-w-full rounded-lg object-cover sm:max-h-52 sm:rounded-xl"
          />
        ) : null}
        {hasGif ? (
          <img
            src={message.gifUrl}
            alt=""
            className="mb-1.5 max-h-40 max-w-full rounded-lg object-cover sm:max-h-52 sm:rounded-xl"
          />
        ) : null}
        {hasAudio ? (
          <div
            className={`mb-1.5 flex w-full max-w-[17rem] items-center gap-3 rounded-[18px] px-2 py-2 ${
              isOwnMessage ? "bg-accent" : "bg-surface"
            }`}
          >
            <button
              type="button"
              onClick={handleAudioToggle}
              className={`flex size-7 items-center justify-center rounded-full text-[10px] ${
                isOwnMessage
                  ? "bg-white/18 text-white"
                  : "bg-[#1f9cff]/10 text-[#1f9cff]"
              }`}
              aria-label={
                isPlaying ? "Pause voice message" : "Play voice message"
              }
            >
              {isPlaying ? (
                <PauseIcon
                  className="size-3.5 fill-current"
                  strokeWidth={2.5}
                />
              ) : (
                <PlayIcon
                  className="ml-0.5 size-3.5 fill-current"
                  strokeWidth={2.5}
                />
              )}
            </button>

            <div className="flex flex-1 items-end justify-center gap-[3px]">
              {WAVE_SAMPLES.map((height, index) => (
                <span
                  key={`${message.id || index}-bar`}
                  className={`inline-block rounded-full ${
                    isOwnMessage ? "bg-white/80" : "bg-[#1f9cff]"
                  }`}
                  style={{
                    height: `${height}px`,
                    width: index % 2 === 0 ? "3px" : "2.5px",
                    opacity: index % 3 === 0 ? 0.8 : 0.65,
                  }}
                />
              ))}
            </div>

            <span
              className={`min-w-8 text-[11px] font-medium tabular-nums ${
                isOwnMessage ? "text-accent-foreground/80" : "text-muted"
              }`}
            >
              {formatAudioDuration(audioDuration)}
            </span>

            <audio
              ref={audioRef}
              src={message.audioUrl}
              onLoadedMetadata={handleAudioMetadata}
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              preload="metadata"
              className="hidden"
            />
          </div>
        ) : null}
        {hasVideo ? <MessageVideo src={message.videoUrl} /> : null}
        {message.text ? (
          <p className="whitespace-pre-wrap wrap-break-word">{message.text}</p>
        ) : null}

        {reactions.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {reactions.map((reaction) => (
              <div
                key={reaction.emoji}
                className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] ${
                  isOwnMessage
                    ? "border-white/15 bg-white/10 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.count || 0}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-1 flex items-center justify-between gap-2">
          <p
            className={`text-[11px] tabular-nums ${
              isOwnMessage ? "text-accent-foreground/75" : "text-muted"
            }`}
          >
            {message.time}
          </p>

          <button
            type="button"
            onClick={() => setShowReactions((value) => !value)}
            className={`flex size-6 items-center justify-center rounded-full border ${
              isOwnMessage
                ? "border-white/15 bg-white/10 text-white"
                : "border-slate-200 bg-white text-slate-700"
            }`}
            aria-label="React to message"
          >
            <SmilePlusIcon className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
