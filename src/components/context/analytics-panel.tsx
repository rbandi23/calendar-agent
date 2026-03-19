"use client";

import { useState, useEffect } from "react";
import { startOfWeek, endOfWeek } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AnalyticsChart } from "@/components/chat/structured-responses/analytics-chart";
import { Lightbulb } from "lucide-react";
import type { AnalyticsData } from "@/types";

export function AnalyticsPanel() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      try {
        const params = new URLSearchParams({
          timeMin: weekStart.toISOString(),
          timeMax: weekEnd.toISOString(),
        });

        const res = await fetch(`/api/analytics?${params}`);
        if (res.ok) {
          const result = await res.json();
          setData(result.analytics ?? result);
        }
      } catch {
        // Handle error silently
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-1/2" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        Unable to load analytics data.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">This Week</h3>
        <p className="text-xs text-muted-foreground">
          Your calendar analytics at a glance
        </p>
      </div>

      <AnalyticsChart data={data} />

      {data.recommendations.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1 text-xs font-semibold">
              <Lightbulb className="h-3.5 w-3.5" />
              Recommendations
            </p>
            {data.recommendations.map((rec, i) => (
              <Badge key={i} variant="outline" className="justify-start whitespace-normal text-xs leading-relaxed">
                {rec}
              </Badge>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
