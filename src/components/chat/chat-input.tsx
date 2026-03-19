"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  CalendarSearch,
  Briefcase,
  TrendingUp,
  Mic,
  MicOff,
  X,
  CalendarDays,
} from "lucide-react";
import { usePanel, type AttachedEvent } from "@/context/panel-context";

const ACTION_CHIPS = [
  { label: "Find free time", icon: CalendarSearch, message: "Find free time this week for a 30-minute meeting" },
  { label: "Prep for next meeting", icon: Briefcase, message: "Prep me for my next meeting" },
  { label: "How's my week?", icon: TrendingUp, message: "How does my week look? Give me a quick summary." },
];

type VoiceState = "idle" | "listening" | "error";

function useSpeechRecognition(onResult: (transcript: string) => void) {
  const [state, setState] = useState<VoiceState>("idle");
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const autoSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;
    setSupported(!!SpeechRecognition);

    return () => {
      recognitionRef.current?.stop();
      if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
    };
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let finalTranscript = "";

    recognition.onstart = () => setState("listening");

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      finalTranscript = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      const display = finalTranscript || interim;
      if (display) {
        window.dispatchEvent(
          new CustomEvent("voice-interim", { detail: display })
        );
      }

      if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
    };

    recognition.onend = () => {
      setState("idle");
      recognitionRef.current = null;

      if (finalTranscript.trim()) {
        autoSendTimerRef.current = setTimeout(() => {
          onResult(finalTranscript.trim());
          // Clear the textarea via custom event
          window.dispatchEvent(new CustomEvent("voice-sent"));
        }, 400);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech" || event.error === "aborted") {
        setState("idle");
      } else {
        setState("error");
        setTimeout(() => setState("idle"), 2000);
      }
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const toggle = useCallback(() => {
    if (state === "listening") {
      stop();
    } else {
      start();
    }
  }, [state, start, stop]);

  return { state, supported, toggle };
}

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { attachedEvents, removeAttachedEvent, clearAttachedEvents, attachEvent } = usePanel();

  const handleVoiceResult = useCallback(
    (transcript: string) => {
      if (!isLoading && transcript.trim()) {
        onSend(transcript.trim());
      }
    },
    [isLoading, onSend]
  );

  const { state: voiceState, supported: voiceSupported, toggle: toggleVoice } =
    useSpeechRecognition(handleVoiceResult);

  // Listen for interim voice results to show in textarea
  useEffect(() => {
    const interimHandler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setInput(detail);
    };
    const sentHandler = () => {
      setInput("");
    };
    window.addEventListener("voice-interim", interimHandler);
    window.addEventListener("voice-sent", sentHandler);
    return () => {
      window.removeEventListener("voice-interim", interimHandler);
      window.removeEventListener("voice-sent", sentHandler);
    };
  }, []);

  const handleSend = useCallback(() => {
    const eventContext = attachedEvents.length > 0
      ? attachedEvents.map((e) => `[Referencing event: "${e.summary}" (${e.start})]`).join(" ") + "\n"
      : "";
    const fullMessage = eventContext + input.trim();

    if (!fullMessage.trim() || isLoading) return;
    onSend(fullMessage);
    setInput("");
    clearAttachedEvents();
    textareaRef.current?.focus();
  }, [input, isLoading, onSend, attachedEvents, clearAttachedEvents]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChipClick = (message: string) => {
    if (isLoading) return;
    onSend(message);
  };

  // Drag-and-drop handlers for calendar events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const eventData = e.dataTransfer.getData("application/calendar-event");
    if (!eventData) return;

    try {
      const event: AttachedEvent = JSON.parse(eventData);
      attachEvent(event);
      textareaRef.current?.focus();
    } catch {
      // Invalid data
    }
  };

  return (
    <div
      className="flex flex-col gap-2"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Action Chips */}
      <div className="flex flex-wrap gap-1.5">
        {ACTION_CHIPS.map((chip) => (
          <Button
            key={chip.label}
            variant="outline"
            size="xs"
            className="gap-1"
            onClick={() => handleChipClick(chip.message)}
            disabled={isLoading}
          >
            <chip.icon className="h-3 w-3" />
            {chip.label}
          </Button>
        ))}
      </div>

      {/* Attached Event Chips */}
      {attachedEvents.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachedEvents.map((event) => (
            <span
              key={event.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              <CalendarDays className="h-3 w-3" />
              {event.summary}
              <button
                onClick={() => removeAttachedEvent(event.id)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Drop zone overlay */}
      {isDragOver && (
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 py-4 text-sm text-primary">
          <CalendarDays className="mr-2 h-4 w-4" />
          Drop event to reference in chat
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            voiceState === "listening"
              ? "Listening..."
              : "Ask me anything about your calendar..."
          }
          className={`min-h-[40px] max-h-[120px] resize-none ${
            voiceState === "listening"
              ? "ring-2 ring-red-500/50 placeholder:text-red-400"
              : ""
          }`}
          rows={1}
          disabled={isLoading}
        />

        {/* Voice Input Button */}
        {voiceSupported && (
          <Button
            size="icon"
            variant={voiceState === "listening" ? "destructive" : "outline"}
            onClick={toggleVoice}
            disabled={isLoading}
            title={
              voiceState === "listening"
                ? "Stop listening"
                : voiceState === "error"
                ? "Mic access denied"
                : "Voice input"
            }
            className={`relative shrink-0 ${
              voiceState === "listening" ? "animate-pulse" : ""
            }`}
          >
            {voiceState === "listening" ? (
              <MicOff className="h-4 w-4" />
            ) : voiceState === "error" ? (
              <Mic className="h-4 w-4 text-red-500" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            {voiceState === "listening" && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
            )}
          </Button>
        )}

        <Button
          size="icon"
          onClick={handleSend}
          disabled={(!input.trim() && attachedEvents.length === 0) || isLoading}
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
