"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2 } from "lucide-react";
import type { EmailDraft } from "@/types";

interface DraftPreviewProps {
  draft: EmailDraft;
}

export function DraftPreview({ draft }: DraftPreviewProps) {
  const { data: session } = useSession();
  const userEmail = session?.user?.email;

  // Filter out the current user's email from the "To" field
  const filteredTo = draft.to
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e && e !== userEmail)
    .join(", ");

  const [to, setTo] = useState(filteredTo || draft.to);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
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
        setSent(true);
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

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          Email Draft
          {sent && (
            <Badge variant="secondary" className="text-xs">
              Sent
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground">To</label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="h-8 text-xs"
              disabled={sent}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="h-8 text-xs"
              disabled={sent}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-muted-foreground">Body</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email..."
              rows={5}
              className="min-h-[100px] text-xs"
              disabled={sent}
            />
          </div>
        </div>
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            onClick={handleSend}
            disabled={sending || sent || !to.trim()}
          >
            {sending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Send className="mr-1 h-3 w-3" />
            )}
            {sent ? "Sent" : "Send"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
