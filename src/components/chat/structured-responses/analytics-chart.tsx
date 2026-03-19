"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Coffee, Lightbulb } from "lucide-react";
import type { AnalyticsData } from "@/types";

interface AnalyticsChartProps {
  data: AnalyticsData;
}

export function AnalyticsChart({ data }: AnalyticsChartProps) {
  const metrics = [
    {
      label: "Total Hours",
      value: `${data.totalHours}h`,
      icon: Clock,
    },
    {
      label: "Meetings",
      value: data.meetingCount.toString(),
      icon: Users,
    },
    {
      label: "Focus Time",
      value: `${data.focusTimeAvailable}h`,
      icon: Coffee,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-muted-foreground">
        Calendar Analytics
      </p>

      {/* Metric Cards */}
      <div className="grid grid-cols-3 gap-2">
        {metrics.map((metric) => (
          <Card key={metric.label} size="sm">
            <CardContent className="flex flex-col items-center gap-1 py-2 text-center">
              <metric.icon className="h-4 w-4 text-muted-foreground" />
              <p className="text-lg font-semibold">{metric.value}</p>
              <p className="text-[10px] text-muted-foreground">
                {metric.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bar Chart */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-xs">Hours by Day</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byDay}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={25}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                  }}
                />
                <Bar
                  dataKey="hours"
                  fill="hsl(var(--chart-1))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1 text-xs font-medium">
            <Lightbulb className="h-3 w-3" />
            Recommendations
          </p>
          {data.recommendations.map((rec, i) => (
            <Badge key={i} variant="outline" className="justify-start text-xs">
              {rec}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
