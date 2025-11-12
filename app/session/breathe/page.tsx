"use client";

import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const BREATHE_DURATION = 10000; // 10 seconds

export default function BreathePage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const sessionId = searchParams.get("sessionId");
	const [timeRemaining, setTimeRemaining] = useState(BREATHE_DURATION);
	const [isBreathingIn, setIsBreathingIn] = useState(true);
	const [scale, setScale] = useState(0.1); // Start very small
	const animationStartTime = useRef(Date.now());

	useEffect(() => {
		if (!sessionId) {
			router.push("/");
			return;
		}

		const interval = setInterval(() => {
			setTimeRemaining((prev) => {
				if (prev <= 100) {
					return 0;
				}
				return prev - 100;
			});
		}, 100);

		// Breathing animation: start small -> grow large -> shrink to small
		const breatheCycle = () => {
			animationStartTime.current = Date.now();
			setIsBreathingIn(true);
		};

		const breatheInterval = setInterval(() => {
			breatheCycle();
		}, 10000); // Full cycle every 10 seconds

		// Start the first cycle
		breatheCycle();

		const scaleInterval = setInterval(() => {
			const elapsed = Date.now() - animationStartTime.current;
			const cycleDuration = 10000; // 10 seconds for full cycle
			const progress = (elapsed % cycleDuration) / cycleDuration;

			// Animation curve: start small (0.1) -> peak large (1.5) -> end small (0.1)
			// Using a sine wave for smooth animation
			const normalizedProgress = Math.sin(progress * Math.PI);
			const newScale = 0.1 + normalizedProgress * 1.4; // Range from 0.1 to 1.5
			setScale(newScale);

			// Update breathing text
			setIsBreathingIn(progress < 0.5);
		}, 16); // ~60fps

		return () => {
			clearInterval(interval);
			clearInterval(breatheInterval);
			clearInterval(scaleInterval);
		};
	}, [sessionId, router]);

	// Navigate when timer completes
	useEffect(() => {
		if (timeRemaining === 0 && sessionId) {
			router.push(`/session/work?sessionId=${sessionId}`);
		}
	}, [timeRemaining, sessionId, router]);

	return (
		<div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground">
			<div className="text-center mb-12">
				<h1 className="text-4xl font-semibold mb-4">
					{isBreathingIn ? "Breathe in" : "Breathe out"}
				</h1>
			</div>

			<div className="relative mb-12">
				<div
					className="w-64 h-64 rounded-full bg-foreground/20 transition-transform duration-75 ease-in-out"
					style={{
						transform: `scale(${scale})`,
					}}
				/>
			</div>

			<div className="flex flex-col gap-4">
				<Button
					onClick={() => router.push(`/session/work?sessionId=${sessionId}`)}
					variant="secondary"
					size="lg"
				>
					SKIP BREATHE
				</Button>
				<Button onClick={() => router.push("/")} variant="outline" size="lg">
					CANCEL SESSION
				</Button>
			</div>

			<div className="mt-8 text-sm text-muted-foreground">
				Prepare for working on: {sessionId ? "your session" : ""}
			</div>
		</div>
	);
}
