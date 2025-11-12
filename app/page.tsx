"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useMemo, useEffect, useState } from "react";
import type { Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

const POMODORO_DURATION = 25 * 60 * 1000; // 25 minutes in milliseconds
const USER_ID_KEY = "pomodoro_user_id";

export default function Home() {
  const router = useRouter();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);

  useEffect(() => {
    const storedUserId = localStorage.getItem(USER_ID_KEY);
    if (!storedUserId) {
      router.push("/signin");
      return;
    }
    setUserId(storedUserId as Id<"users">);
  }, [router]);

  if (!userId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <CalendarView userId={userId} />
    </div>
  );
}

function CalendarView({ userId }: { userId: Id<"users"> }) {
  const router = useRouter();
  const sessions = useQuery(api.myFunctions.getSessions, { userId }) ?? [];
  const createSession = useMutation(api.myFunctions.createSession);
  const [taskTitle, setTaskTitle] = useState("");

  const activityData = useMemo(() => {
    const data: Record<string, number> = {};
    const now = Date.now();
    const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;

    sessions.forEach((session) => {
      if (session.startTime < oneYearAgo) return;
      const date = new Date(session.startTime);
      // Use ISO date string for consistent key
      const dateKey = date.toISOString().split("T")[0];
      data[dateKey] = (data[dateKey] || 0) + 1;
    });

    return data;
  }, [sessions]);

  const handleStartSession = async () => {
    const sessionId = await createSession({ 
      userId, 
      taskTitle: taskTitle.trim() || undefined 
    });
    setTaskTitle(""); // Clear input after starting session
    router.push(`/session/breathe?sessionId=${sessionId}`);
  };

  const weeks = useMemo(() => {
    const weeks: Date[][] = [];
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 365); // Go back 1 year

    // Find the Monday of the week containing startDate
    const dayOfWeek = startDate.getDay();
    const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(startDate.setDate(diff));

    let currentDate = new Date(monday);
    const endDate = new Date(today);

    while (currentDate <= endDate) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
    }

    return weeks;
  }, []);

  const getActivityLevel = (date: Date): number => {
    const dateKey = date.toISOString().split("T")[0];
    const count = activityData[dateKey] || 0;
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count <= 3) return 2;
    return 3;
  };

  const getActivityColor = (level: number): string => {
    switch (level) {
      case 0:
        return "bg-slate-800";
      case 1:
        return "bg-green-500";
      case 2:
        return "bg-green-400";
      case 3:
        return "bg-green-300";
      default:
        return "bg-slate-800";
    }
  };

  const monthLabels = useMemo(() => {
    const labels: Array<{ month: string; weekIndex: number }> = [];
    const seenMonths = new Map<string, number>();
    
    weeks.forEach((week, weekIndex) => {
      // Check the first day of the week (Monday)
      const firstDay = week[0];
      const monthKey = firstDay.toLocaleDateString("en-US", { month: "short" });
      
      // Only add if this is the first week of this month we've seen
      if (!seenMonths.has(monthKey)) {
        seenMonths.set(monthKey, weekIndex);
        labels.push({ month: monthKey, weekIndex });
      }
    });
    
    return labels;
  }, [weeks]);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Pomodoro Journal</h1>
        <p className="text-slate-400">Track your focus sessions</p>
      </div>

      <div className="mb-8 space-y-4">
        <div className="flex gap-4 items-end max-w-md">
          <div className="flex-1">
            <label htmlFor="task-title" className="text-sm text-muted-foreground mb-2 block">
              What will you focus on?
            </label>
            <Input
              id="task-title"
              type="text"
              placeholder="Enter your focus for this session..."
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && taskTitle.trim()) {
                  handleStartSession();
                }
              }}
              className="bg-background border-border text-foreground"
            />
          </div>
          <Button 
            onClick={handleStartSession} 
            size="lg"
            disabled={!taskTitle.trim()}
          >
            Start Session
          </Button>
        </div>
      </div>

      <Card className="mb-8">
        <CardContent className="p-6">
        <div className="flex gap-1 mb-4">
          <div className="w-8"></div>
          {weeks.map((week, weekIdx) => {
            const monthLabel = monthLabels.find((m) => m.weekIndex === weekIdx);
            return (
              <div key={weekIdx} className="w-3 text-center relative">
                {monthLabel && (
                  <div className="text-xs text-slate-400 absolute left-0 whitespace-nowrap">
                    {monthLabel.month}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-1">
          <div className="flex flex-col gap-1 mr-2">
            <div className="text-xs text-slate-400 h-3"></div>
            <div className="text-xs text-slate-400 h-3">Mon</div>
            <div className="text-xs text-slate-400 h-3"></div>
            <div className="text-xs text-slate-400 h-3">Wed</div>
            <div className="text-xs text-slate-400 h-3"></div>
            <div className="text-xs text-slate-400 h-3">Fri</div>
            <div className="text-xs text-slate-400 h-3"></div>
          </div>
          <div className="flex-1 flex gap-1">
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-1">
                {week.map((date, dayIdx) => {
                  const level = getActivityLevel(date);
                  const isToday =
                    date.toDateString() === new Date().toDateString();
                  return (
                    <div
                      key={`${weekIdx}-${dayIdx}`}
                      className={`w-3 h-3 rounded ${getActivityColor(
                        level
                      )} ${isToday ? "ring-2 ring-white" : ""}`}
                      title={date.toLocaleDateString()}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        </CardContent>
      </Card>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Recent Sessions</h2>
        <div className="space-y-4">
          {sessions.slice(0, 10).map((session) => {
            const startDate = new Date(session.startTime);
            const duration = session.duration
              ? Math.round(session.duration / 60000)
              : null;
            return (
              <Card key={session._id} className="hover:bg-accent transition-colors">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">
                        {session.taskTitle || "Untitled Session"}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {startDate.toLocaleDateString()} at{" "}
                        {startDate.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </CardDescription>
                      {duration !== null && duration > 0 && (
                        <CardDescription className="mt-1">
                          Duration: {duration} minutes
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
