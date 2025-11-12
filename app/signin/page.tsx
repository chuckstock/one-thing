"use client";

import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";

const USER_ID_KEY = "pomodoro_user_id";

export default function SignIn() {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [isRegistering, setIsRegistering] = useState(false);
	const registerPasskey = useMutation(api.auth.registerPasskey);
	const authenticatePasskey = useMutation(api.auth.authenticatePasskey);
	const getPasskeyChallenge = useQuery(api.auth.getPasskeyChallenge);

	// Check if user is already logged in
	useEffect(() => {
		const userId = localStorage.getItem(USER_ID_KEY);
		if (userId) {
			router.push("/");
		}
	}, [router]);

	const handleRegister = async () => {
		if (!getPasskeyChallenge) return;

		setLoading(true);
		setError(null);

		try {
			// Check if WebAuthn is supported
			if (!window.PublicKeyCredential) {
				throw new Error("WebAuthn is not supported in this browser");
			}

			// Create credential options
			const challenge = Uint8Array.from(
				atob(
					getPasskeyChallenge.challenge.replace(/-/g, "+").replace(/_/g, "/"),
				),
				(c) => c.charCodeAt(0),
			);

			const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions =
				{
					challenge,
					rp: {
						name: "Pomodoro Journal",
						id: window.location.hostname,
					},
					user: {
						id: crypto.getRandomValues(new Uint8Array(16)),
						name: "user",
						displayName: "User",
					},
					pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256
					authenticatorSelection: {
						authenticatorAttachment: "platform",
						userVerification: "required",
					},
					timeout: 60000,
					attestation: "direct",
				};

			// Create passkey
			const credential = (await navigator.credentials.create({
				publicKey: publicKeyCredentialCreationOptions,
			})) as PublicKeyCredential;

			if (!credential) {
				throw new Error("Failed to create passkey");
			}

			const response = credential.response as AuthenticatorAttestationResponse;
			const credentialId = btoa(
				String.fromCharCode(...new Uint8Array(credential.rawId)),
			)
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/=/g, "");

			// Extract public key from attestation
			const publicKey = btoa(
				String.fromCharCode(...new Uint8Array(response.getPublicKey()!)),
			)
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/=/g, "");

			// Extract counter from authenticatorData (bytes 33-36, big-endian uint32)
			const authenticatorData = new Uint8Array(response.getAuthenticatorData());
			let counter = 0;
			if (authenticatorData.length >= 37) {
				// Counter is at offset 33, 4 bytes big-endian
				counter =
					(authenticatorData[33] << 24) |
					(authenticatorData[34] << 16) |
					(authenticatorData[35] << 8) |
					authenticatorData[36];
			}

			// Register passkey on server
			const result = await registerPasskey({
				credentialId,
				publicKey,
				counter,
			});

			// Store user ID
			localStorage.setItem(USER_ID_KEY, result.userId);
			// Also set cookie for middleware
			document.cookie = `${USER_ID_KEY}=${result.userId}; path=/; max-age=31536000`; // 1 year
			router.push("/");
		} catch (err: any) {
			setError(err.message || "Failed to register passkey");
			setLoading(false);
		}
	};

	const handleSignIn = async () => {
		setLoading(true);
		setError(null);

		try {
			// Check if WebAuthn is supported
			if (!window.PublicKeyCredential) {
				throw new Error("WebAuthn is not supported in this browser");
			}

			// Get challenge from server
			const challengeData = await getPasskeyChallenge;
			if (!challengeData) {
				throw new Error("Failed to get challenge");
			}

			const challenge = Uint8Array.from(
				atob(challengeData.challenge.replace(/-/g, "+").replace(/_/g, "/")),
				(c) => c.charCodeAt(0),
			);

			// For sign-in, we need to know the credential ID
			// In a real app, you'd store this or use conditional UI
			// For now, we'll use an empty allowCredentials array to let the browser choose
			const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions =
				{
					challenge,
					rpId: window.location.hostname,
					allowCredentials: [], // Empty means browser will show all available passkeys
					userVerification: "required",
					timeout: 60000,
				};

			// Authenticate with passkey
			const assertion = (await navigator.credentials.get({
				publicKey: publicKeyCredentialRequestOptions,
			})) as PublicKeyCredential;

			if (!assertion) {
				throw new Error("Failed to authenticate");
			}

			const response = assertion.response as AuthenticatorAssertionResponse;
			const credentialId = btoa(
				String.fromCharCode(...new Uint8Array(assertion.rawId)),
			)
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/=/g, "");

			// Extract counter from authenticatorData (bytes 33-36, big-endian uint32)
			const authenticatorData = new Uint8Array(response.authenticatorData);
			let counter = 0;
			if (authenticatorData.length >= 37) {
				// Counter is at offset 33, 4 bytes big-endian
				counter =
					(authenticatorData[33] << 24) |
					(authenticatorData[34] << 16) |
					(authenticatorData[35] << 8) |
					authenticatorData[36];
			}
			// If authenticatorData is too short, counter remains 0 (some authenticators don't support counters)

			// Authenticate on server
			const result = await authenticatePasskey({
				credentialId,
				counter,
			});

			// Store user ID
			localStorage.setItem(USER_ID_KEY, result.userId);
			// Also set cookie for middleware
			document.cookie = `${USER_ID_KEY}=${result.userId}; path=/; max-age=31536000`; // 1 year
			router.push("/");
		} catch (err: any) {
			setError(err.message || "Failed to sign in");
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-black text-white flex items-center justify-center">
			<div className="max-w-md w-full p-8">
				<div className="text-center mb-8">
					<h1 className="text-3xl font-bold mb-2">Pomodoro Journal</h1>
					<p className="text-slate-400">Sign in with your passkey</p>
				</div>

				<div className="bg-card rounded-lg p-6 space-y-4 border">
					{!isRegistering ? (
						<>
							<Button
								type="button"
								onClick={handleSignIn}
								disabled={loading || !getPasskeyChallenge}
								className="w-full"
								size="lg"
							>
								{loading ? "Signing in..." : "Sign in with Passkey"}
							</Button>
							<div className="text-center text-sm text-muted-foreground">
								Don't have an account?{" "}
								<Button
									type="button"
									onClick={() => setIsRegistering(true)}
									variant="link"
									className="p-0 h-auto"
								>
									Create one
								</Button>
							</div>
						</>
					) : (
						<>
							<Button
								type="button"
								onClick={handleRegister}
								disabled={loading || !getPasskeyChallenge}
								className="w-full"
								size="lg"
							>
								{loading ? "Creating..." : "Create Passkey"}
							</Button>
							<div className="text-center text-sm text-muted-foreground">
								Already have an account?{" "}
								<Button
									type="button"
									onClick={() => setIsRegistering(false)}
									variant="link"
									className="p-0 h-auto"
								>
									Sign in
								</Button>
							</div>
						</>
					)}

					{error && (
						<div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4 mt-4">
							<p className="text-rose-300 text-sm">{error}</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
