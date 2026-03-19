"use client";

import { useState, useEffect } from "react";
import { usePreferences } from "@/context/preferences-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Save, Check } from "lucide-react";
import type { UserPreferences } from "@/types";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { preferences, updatePreferences } = usePreferences();
  const [form, setForm] = useState<UserPreferences>(preferences);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(preferences);
      setSaved(false);
    }
  }, [open, preferences]);

  const handleChange = (field: keyof UserPreferences, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    updatePreferences(form);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onOpenChange(false);
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Customize your calendar preferences
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-2">
          {/* Work Hours */}
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-medium">Work Hours</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Start Time
                </label>
                <Input
                  type="time"
                  value={form.workHoursStart}
                  onChange={(e) => handleChange("workHoursStart", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  End Time
                </label>
                <Input
                  type="time"
                  value={form.workHoursEnd}
                  onChange={(e) => handleChange("workHoursEnd", e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Morning Protection Until
              </label>
              <Input
                type="time"
                value={form.morningProtection}
                onChange={(e) => handleChange("morningProtection", e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                No meetings will be scheduled before this time
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Timezone
              </label>
              <Input
                value={form.timezone}
                onChange={(e) => handleChange("timezone", e.target.value)}
                placeholder="America/New_York"
              />
            </div>
          </div>

          <Separator />

          {/* Meeting Preferences */}
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-medium">Meeting Preferences</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Buffer Between Meetings (min)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={60}
                  value={form.bufferMinutes}
                  onChange={(e) =>
                    handleChange("bufferMinutes", parseInt(e.target.value) || 0)
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Max Meeting Hours/Day
                </label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={form.maxMeetingHoursPerDay}
                  onChange={(e) =>
                    handleChange("maxMeetingHoursPerDay", parseInt(e.target.value) || 6)
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Default Duration (min)
                </label>
                <Input
                  type="number"
                  min={15}
                  max={180}
                  step={15}
                  value={form.defaultMeetingDuration}
                  onChange={(e) =>
                    handleChange("defaultMeetingDuration", parseInt(e.target.value) || 30)
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Focus Block Duration (min)
                </label>
                <Input
                  type="number"
                  min={30}
                  max={480}
                  step={30}
                  value={form.focusBlockDuration}
                  onChange={(e) =>
                    handleChange("focusBlockDuration", parseInt(e.target.value) || 120)
                  }
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Save */}
          <div className="flex justify-end">
            <Button onClick={handleSave} className="gap-2">
              {saved ? (
                <>
                  <Check className="h-4 w-4" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Preferences
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
