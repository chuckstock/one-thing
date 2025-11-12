"use client";

import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";
import { useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const USER_ID_KEY = "pomodoro_user_id";

export default function ReflectPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const sessionId = searchParams.get("sessionId") as Id<"sessions"> | null;
	const [userId, setUserId] = useState<Id<"users"> | null>(null);
	const [userIdLoaded, setUserIdLoaded] = useState(false);
	const [reflection, setReflection] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showCompletion, setShowCompletion] = useState(false);
	const completeSession = useMutation(api.myFunctions.completeSession);
	const allSessions = useQuery(
		api.myFunctions.getSessions,
		userId ? { userId } : "skip",
	);

	useEffect(() => {
		const storedUserId = localStorage.getItem(USER_ID_KEY);
		if (!storedUserId) {
			router.push("/signin");
			return;
		}
		setUserId(storedUserId as Id<"users">);
		setUserIdLoaded(true);
	}, [router]);

	useEffect(() => {
		// Only check redirect after userId has been loaded
		if (!userIdLoaded) return;

		if (!sessionId) {
			router.push("/");
			return;
		}

		if (!userId) {
			router.push("/signin");
			return;
		}
	}, [sessionId, userId, userIdLoaded, router]);

	const getTodayFocusTime = (): number => {
		if (!allSessions) return 0;
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const todayStart = today.getTime();
		const todayEnd = todayStart + 24 * 60 * 60 * 1000;

		const todaySessions = allSessions.filter(
			(s) => s.startTime >= todayStart && s.startTime < todayEnd && s.duration,
		);
		const totalMinutes = todaySessions.reduce(
			(sum, s) => sum + (s.duration ? Math.round(s.duration / 60000) : 0),
			0,
		);
		return totalMinutes;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!sessionId || !userId || !reflection.trim()) return;

		setIsSubmitting(true);
		try {
			// Complete session with reflection if not already completed
			await completeSession({ sessionId, userId, reflection });
			setShowCompletion(true);
			// Redirect to home after 3 seconds
			setTimeout(() => {
				router.push("/");
			}, 3000);
		} catch (error) {
			console.error("Error submitting reflection:", error);
			setIsSubmitting(false);
		}
	};

	const todayFocusMinutes = getTodayFocusTime();

	// Trigger confetti when completion screen is shown
	useEffect(() => {
		if (showCompletion) {
			// Shoot confetti from left side
			confetti({
				particleCount: 50,
				angle: 60,
				spread: 55,
				origin: { x: 0 },
				colors: ["#ffffff", "#94a3b8"],
			});

			// Shoot confetti from right side
			confetti({
				particleCount: 50,
				angle: 120,
				spread: 55,
				origin: { x: 1 },
				colors: ["#ffffff", "#94a3b8"],
			});
		}
	}, [showCompletion]);

	if (showCompletion) {
		return (
			<div className="min-h-screen bg-black text-white flex items-center justify-center relative overflow-hidden">
				<div className="text-center z-10">
					<div className="text-slate-400 text-sm mb-2">Focused today</div>
					<div className="text-6xl font-bold mb-8">{todayFocusMinutes}m</div>
					<Button
						onClick={() => router.push("/")}
						size="lg"
						className="flex items-center gap-2 mx-auto"
					>
						Done <span className="text-muted-foreground">⏎</span>
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-black text-white flex items-center justify-center">
			<div className="max-w-2xl w-full p-8">
				<h1 className="text-3xl font-bold mb-6">How did this session go?</h1>
				<form onSubmit={handleSubmit} className="space-y-6">
					<textarea
						value={reflection}
						onChange={(e) => setReflection(e.target.value)}
						placeholder="Write your reflection here..."
						className="w-full h-64 bg-slate-900 border border-slate-700 rounded-lg p-4 text-white placeholder-slate-500 resize-none outline-none focus:border-slate-600"
						required
					/>
					<div className="flex gap-4">
						<Button
							type="submit"
							disabled={isSubmitting || !reflection.trim()}
							size="lg"
						>
							{isSubmitting ? "Saving..." : "Save Reflection"}
						</Button>
						<Button
							type="button"
							onClick={() => router.push("/")}
							variant="secondary"
							size="lg"
						>
							Skip
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}
