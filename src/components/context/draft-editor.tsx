"use client";

import { useState } from "react";
import { usePanel } from "@/context/panel-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Send, Save, X, Loader2, Sparkles } from "lucide-react";
import type { EmailDraft } from "@/types";

interface DraftEditorProps {
  initialDraft: EmailDraft;
}

export function DraftEditor({ initialDraft }: DraftEditorProps) {
  const { setPanelState } = usePanel();
  const [to, setTo] = useState(initialDraft.to);
  const [subject, setSubject] = useState(initialDraft.subject);
  const [body, setBody] = useState(initialDraft.body);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [improving, setImproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });
      if (res.ok) {
        setPanelState({ mode: "empty" });
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to send email");
      }
    } catch {
      setError("Network error — could not send email");
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });
      if (res.ok) {
        setPanelState({ mode: "empty" });
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to save draft");
      }
    } catch {
      setError("Network error — could not save draft");
    } finally {
      setSaving(false);
    }
  };

  const handleImprove = async () => {
    if (!body.trim()) return;
    setImproving(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, context: `Subject: ${subject}` }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.improved) {
          setBody(data.improved);
        }
      } else {
        setError("Failed to improve email");
      }
    } catch {
      setError("Network error — could not improve email");
    } finally {
      setImproving(false);
    }
  };

  const handleDiscard = () => {
    setPanelState({ mode: "empty" });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Fields */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            To
          </label>
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Subject
          </label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Body
          </label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your email..."
            rows={8}
            className="min-h-[200px]"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Separator />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSend}
          disabled={sending || !to.trim()}
          className="gap-1"
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Send
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSaveDraft}
          disabled={saving}
          className="gap-1"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save Draft
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleImprove}
          disabled={improving || !body.trim()}
          className="gap-1"
        >
          {improving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Improve with AI
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDiscard}
          className="gap-1"
        >
          <X className="h-3.5 w-3.5" />
          Discard
        </Button>
      </div>
    </div>
  );
}
