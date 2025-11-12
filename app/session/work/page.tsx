"use client";

import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const POMODORO_DURATION = 25 * 60 * 1000; // 25 minutes

const USER_ID_KEY = "pomodoro_user_id";

export default function WorkPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const sessionId = searchParams.get("sessionId") as Id<"sessions"> | null;
	const [userId, setUserId] = useState<Id<"users"> | null>(null);
	const [userIdLoaded, setUserIdLoaded] = useState(false);
	const [timeRemaining, setTimeRemaining] = useState(POMODORO_DURATION);
	const [notes, setNotes] = useState("");
	const [isComplete, setIsComplete] = useState(false);
	const updateSession = useMutation(api.myFunctions.updateSession);
	const completeSession = useMutation(api.myFunctions.completeSession);
	const session = useQuery(
		api.myFunctions.getSession,
		sessionId && userId ? { sessionId, userId } : "skip",
	);
	const allSessions = useQuery(
		api.myFunctions.getSessions,
		userId ? { userId } : "skip",
	);
	const notesTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

		if (session?.notes) {
			setNotes(session.notes);
		}

		if (session?.startTime && userId) {
			const elapsed = Date.now() - session.startTime;
			const remaining = Math.max(0, POMODORO_DURATION - elapsed);
			setTimeRemaining(remaining);
			if (remaining === 0) {
				setIsComplete(true);
			}
		}
	}, [sessionId, userId, userIdLoaded, router, session]);

	useEffect(() => {
		if (!sessionId || !session?.startTime) return;

		const interval = setInterval(() => {
			const elapsed = Date.now() - session.startTime;
			const remaining = Math.max(0, POMODORO_DURATION - elapsed);
			setTimeRemaining(remaining);
			if (remaining === 0 && !isComplete) {
				setIsComplete(true);
			}
		}, 1000);

		return () => clearInterval(interval);
	}, [sessionId, session?.startTime, isComplete]);

	useEffect(() => {
		if (isComplete && sessionId && userId) {
			completeSession({ sessionId, userId });
			const timer = setTimeout(() => {
				router.push(`/session/reflect?sessionId=${sessionId}`);
			}, 2000);
			return () => clearTimeout(timer);
		}
	}, [isComplete, sessionId, userId, router, completeSession]);

	const handleNotesChange = (newNotes: string) => {
		setNotes(newNotes);
		if (notesTimeoutRef.current) {
			clearTimeout(notesTimeoutRef.current);
		}
		notesTimeoutRef.current = setTimeout(() => {
			if (sessionId && userId) {
				updateSession({ sessionId, userId, notes: newNotes });
			}
		}, 500);
	};

	const handleDone = async () => {
		if (!sessionId || !userId) {
			console.error("Missing sessionId or userId", { sessionId, userId });
			return;
		}
		try {
			await completeSession({ sessionId, userId });
			router.push(`/session/reflect?sessionId=${sessionId}`);
		} catch (error) {
			console.error("Error completing session:", error);
			// Still navigate to reflect page even if completion fails
			router.push(`/session/reflect?sessionId=${sessionId}`);
		}
	};

	const formatTime = (ms: number): string => {
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	};

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

	const todayFocusMinutes = getTodayFocusTime();

	return (
		<div className="min-h-screen bg-black text-white flex">
			{/* Left side - Notes */}
			<div className="w-1/2 border-r border-slate-800 flex flex-col">
				<div className="p-6 border-b border-slate-800">
					<h2 className="text-xl font-semibold">Notes</h2>
				</div>
				<div className="flex-1 p-6">
					<textarea
						value={notes}
						onChange={(e) => handleNotesChange(e.target.value)}
						placeholder="Write your notes here in markdown..."
						className="w-full h-full bg-transparent text-white placeholder-slate-500 resize-none outline-none font-mono text-sm"
					/>
				</div>
			</div>

			{/* Right side - Timer */}
			<div className="w-1/2 flex flex-col items-center justify-center">
				{isComplete ? (
					<div className="text-center">
						<Confetti />
						<div className="text-6xl font-bold mb-4">🎉</div>
						<div className="text-2xl mb-2">Session Complete!</div>
						<div className="text-slate-400">Redirecting to reflection...</div>
					</div>
				) : (
					<>
						<div className="text-center mb-8">
							<div className="text-slate-400 text-sm mb-2">Focused today</div>
							<div className="text-6xl font-bold">{todayFocusMinutes}m</div>
							<div className="text-slate-500 text-sm mt-4">Time remaining</div>
							<div className="text-4xl font-semibold mt-2">
								{formatTime(timeRemaining)}
							</div>
						</div>
						<Button
							onClick={handleDone}
							size="lg"
							className="flex items-center gap-2"
						>
							Done <span className="text-muted-foreground">⏎</span>
						</Button>
					</>
				)}
			</div>
		</div>
	);
}

function Confetti() {
	const particles = useRef(
		Array.from({ length: 50 }).map((_, i) => ({
			id: i,
			left: Math.random() * 100,
			delay: Math.random() * 2,
			duration: 2 + Math.random() * 2,
			color: Math.random() > 0.5 ? "bg-blue-400" : "bg-slate-300",
		})),
	);

	return (
		<div className="fixed inset-0 pointer-events-none overflow-hidden">
			{particles.current.map((particle) => (
				<div
					key={particle.id}
					className="absolute animate-confetti"
					style={{
						left: `${particle.left}%`,
						animationDelay: `${particle.delay}s`,
						animationDuration: `${particle.duration}s`,
					}}
				>
					<div className={`w-2 h-2 rounded ${particle.color}`} />
				</div>
			))}
		</div>
	);
}
