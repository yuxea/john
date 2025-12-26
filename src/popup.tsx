/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { ExtensionSettings } from "./types.ts";
import { DEFAULT_SETTINGS } from "./constants.ts";
import { render } from "preact";

const POPULAR_NITTER_INSTANCES = [
	"https://nitter.stay.rip",
	"https://nitter.privacyredirect.com",
];

const TWITTER_USERNAME_PATTERN = /^[a-zA-Z0-9_]{1,15}$/;
const URL_PATTERN =
	/^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/;

interface MessageState {
	text: string;
	isError: boolean;
}

function useExtensionSettings() {
	const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [hasChanges, setHasChanges] = useState(false);
	const original = useRef<ExtensionSettings>(DEFAULT_SETTINGS);

	const loadSettings = useCallback(async () => {
		try {
			const response = await browser.runtime.sendMessage({
				type: "GET_SETTINGS",
			});
			const settings = response as ExtensionSettings;
			setSettings(settings), original.current = settings;
		} catch (error) {
			console.error("failed to load settings", error);
			throw error;
		} finally {
			setIsLoading(false);
		}
	}, []);

	const saveSettings = useCallback(async (settings: ExtensionSettings) => {
		setIsSaving(true);
		try {
			await browser.runtime.sendMessage({
				type: "UPDATE_SETTINGS",
				settings: settings,
			});
			original.current = settings;
			return setSettings(settings), true;
		} catch (error) {
			return console.error("failed to save settings", error), false;
		} finally {
			setIsSaving(false);
		}
	}, []);

	useEffect(() => {
		const hasChanged =
			JSON.stringify(settings) !== JSON.stringify(original.current);
		setHasChanges(hasChanged);
	}, [settings]);

	useEffect(() => {
		loadSettings();
	}, [loadSettings]);

	return {
		settings,
		isLoading,
		isSaving,
		setSettings,
		saveSettings,
		hasChanges,
	};
}

function useMessage() {
	const [message, setMessage] = useState<MessageState>({
		text: "",
		isError: false,
	});
	const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	const communicate = useCallback((text: string, isError = false) => {
		if (timeout.current) {
			clearTimeout(timeout.current);
		}

		setMessage({ text, isError });
		timeout.current = setTimeout(() => {
			setMessage({ text: "", isError: false });
		}, 3000);
	}, []);

	useEffect(() => () => {
		timeout.current && clearTimeout(timeout.current);
	}, []);

	return { message, communicate };
}

function useUserManagement(
	settings: ExtensionSettings,
	setSettings: (settings: ExtensionSettings) => void,
	communicate: (text: string, isError?: boolean) => void,
) {
	const [newUsername, setNewUsername] = useState("");

	const addUser = useCallback(() => {
		const username = newUsername.trim().replace(/^@/, "");
		if (!username) {
			return communicate("Please enter a username", true), false;
		}

		if (!TWITTER_USERNAME_PATTERN.test(username)) {
			return communicate("Invalid username format", true), false;
		}

		if (settings.twitterUsers.includes(username)) {
			communicate("User already tracked", true);
			return setNewUsername(""), true;
		}

		setSettings({
			...settings,
			twitterUsers: [...settings.twitterUsers, username],
		});
		communicate(`Added @${username} to tracked users`, false);
		return setNewUsername(""), true;
	}, [newUsername, settings, setSettings]);

	const removeUser = useCallback((username: string) => {
		setSettings({
			...settings,
			twitterUsers: settings.twitterUsers.filter((u) => u !== username),
		});
		communicate(`Removed @${username} from tracked users`, false);
	}, [settings, setSettings]);

	return { newUsername, setNewUsername, addUser, removeUser };
}

function useInstanceManagement(
	settings: ExtensionSettings,
	setSettings: (settings: ExtensionSettings) => void,
	communicate: (text: string, isError?: boolean) => void,
) {
	const [isCustomMode, setIsCustomMode] = useState(false);
	const [customInstance, setCustomInstance] = useState("");

	useEffect(() => {
		const isCustom = !POPULAR_NITTER_INSTANCES.includes(
			settings.nitterInstance,
		);
		setIsCustomMode(isCustom);
		if (isCustom) {
			setCustomInstance(settings.nitterInstance);
		}
	}, [settings.nitterInstance]);

	const handleInstanceChange = useCallback((value: string) => {
		if (value === "custom") {
			setIsCustomMode(true);
			if (!customInstance) {
				setCustomInstance(DEFAULT_SETTINGS.nitterInstance);
				setSettings({
					...settings,
					nitterInstance: DEFAULT_SETTINGS.nitterInstance,
				});
			}
		} else {
			setIsCustomMode(false);
			setSettings({
				...settings,
				nitterInstance: value,
			});
		}
	}, [customInstance, settings, setSettings]);

	const handleCustomInstanceChange = useCallback((value: string) => {
		setCustomInstance(value);
		setSettings({
			...settings,
			nitterInstance: value,
		});
	}, [settings, setSettings]);

	const validateCustomInstance = useCallback((url: string) => {
		if (!URL_PATTERN.test(url)) {
			communicate(
				"Please enter a valid URL",
				true,
			);
			return false;
		}
		return true;
	}, [communicate]);

	const selectValue = isCustomMode ? "custom" : settings.nitterInstance;

	return {
		customInstance,
		setCustomInstance,
		selectValue,
		handleInstanceChange,
		handleCustomInstanceChange,
		validateCustomInstance,
		isCustomMode,
	};
}

function UserItem(
	{ username, onRemove }: {
		username: string;
		onRemove: (username: string) => void;
	},
) {
	return (
		<div className="user-item">
			<span>@{username}</span>
			<button
				type="button"
				className="remove-button"
				onClick={() => onRemove(username)}
				aria-label={`Remove ${username} from tracked users`}
			>
				Remove
			</button>
		</div>
	);
}

function SettingGroup(
	{ children, title }: { children: preact.ComponentChildren; title: string },
) {
	return (
		<div className="setting-group">
			<h3>{title}</h3>
			{children}
		</div>
	);
}

function Popup() {
	const { settings, isLoading, isSaving, setSettings, saveSettings } =
		useExtensionSettings();
	const { message, communicate } = useMessage();
	const { newUsername, setNewUsername, addUser, removeUser } =
		useUserManagement(settings, setSettings, communicate);
	const {
		selectValue: instance,
		handleInstanceChange,
		handleCustomInstanceChange,
		isCustomMode,
		validateCustomInstance,
	} = useInstanceManagement(settings, setSettings, communicate);

	const handleSaveSettings = useCallback(async () => {
		if (isCustomMode && !validateCustomInstance(settings.nitterInstance)) {
			return;
		}
		const success = await saveSettings(settings);
		communicate(
			success ? "Settings saved successfully :3" : "Failed to save settings",
			!success,
		);
	}, [settings, saveSettings, communicate]);

	const handleAddUser = useCallback(() => addUser(), [addUser]);

	const handleKeyPress = useCallback((e: KeyboardEvent) => {
		if (e.key === "Enter") {
			handleAddUser();
		}
	}, [handleAddUser]);

	if (isLoading) {
		return (
			<div className="popup-container">
				<div className="loading" aria-live="polite">
					Loading...
				</div>
			</div>
		);
	}

	return (
		<div className="popup-container">
			<header className="popup-header">
				<h1>john</h1>
				<p>bridge your twitter content to bluesky</p>
			</header>

			<main className="popup-main">
				<SettingGroup title="General Settings">
					<label className="checkbox-label">
						<input
							type="checkbox"
							checked={settings.enabled}
							onChange={(e) =>
								setSettings({
									...settings,
									enabled: e.currentTarget.checked,
								})}
						/>
						<span className="checkmark"></span>
						Enable john
					</label>
				</SettingGroup>

				<SettingGroup title="Nitter Instance">
					<label htmlFor="nitter-instance">Select instance:</label>
					<select
						id="nitter-instance"
						value={instance}
						onChange={(e) => handleInstanceChange(e.currentTarget.value)}
					>
						{POPULAR_NITTER_INSTANCES.map((instance) => (
							<option key={instance} value={instance}>{instance}</option>
						))}
						<option value="custom">Custom instance...</option>
					</select>

					{isCustomMode && (
						<div className="custom-instance">
							<input
								type="url"
								placeholder="https://nitter.example.com"
								value={settings.nitterInstance}
								onChange={(e) =>
									handleCustomInstanceChange(e.currentTarget.value)}
								aria-label="Custom Nitter instance URL"
							/>
						</div>
					)}
				</SettingGroup>

				<SettingGroup title="Refresh Settings">
					<label htmlFor="refresh-interval">
						Refresh interval (minutes):
					</label>
					<div className="number-input-wrapper">
						<input
							id="refresh-interval"
							type="number"
							min="5"
							max="1440"
							value={settings.refreshInterval}
							onChange={(e) =>
								setSettings({
									...settings,
									refreshInterval: parseInt(e.currentTarget.value, 10) || 5,
								})}
						/>
						<div className="number-controls">
							<button
								type="button"
								onClick={() =>
									setSettings({
										...settings,
										refreshInterval: Math.min(
											1440,
											settings.refreshInterval + 1,
										),
									})}
							>
								+
							</button>
							<button
								type="button"
								onClick={() =>
									setSettings({
										...settings,
										refreshInterval: Math.max(1, settings.refreshInterval - 1),
									})}
							>
								-
							</button>
						</div>
					</div>
				</SettingGroup>

				<SettingGroup title="Tracked Users">
					<div className="user-input">
						<input
							type="text"
							placeholder="Username (1-15 chars, letters/numbers/underscores)"
							value={newUsername}
							onInput={(e) => setNewUsername(e.currentTarget.value)}
							onKeyDown={handleKeyPress}
							aria-label="New username to track"
							pattern="[a-zA-Z0-9_]{1,15}"
							title="Twitter usernames can only contain letters, numbers, and underscores, and must be 1-15 characters long"
						/>
						<button type="button" onClick={handleAddUser}>+</button>
					</div>

					<div className="user-list" role="list">
						{!settings.twitterUsers.length
							? <span className="no-users">No users tracked yet :P</span>
							: (
								settings.twitterUsers.map((username) => (
									<UserItem
										key={username}
										username={username}
										onRemove={removeUser}
									/>
								))
							)}
					</div>
				</SettingGroup>

				{message.text && (
					<div
						className={`message ${message.isError ? "error" : "success"}`}
						aria-live="polite"
					>
						{message.text}
					</div>
				)}

				<div className="setting-actions">
					<button
						type="button"
						className="save-button"
						disabled={isSaving}
						onClick={handleSaveSettings}
					>
						{isSaving ? "Saving..." : "Save settings"}
					</button>
				</div>
			</main>
		</div>
	);
}

function init() {
	const app = document.getElementById("app");
	if (app) {
		render(<Popup />, app);
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init();
}
