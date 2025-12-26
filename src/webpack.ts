/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export interface WebpackModuleInfo {
	id: number;
	loaded: boolean;
	exports: any;
}

export interface WebpackRequire {
	m: Record<number, WebpackFactory>;
	c: Record<number, WebpackModuleInfo>;
	(id: number): WebpackModuleInfo;
}

export type WebpackFactory =
	& ((module: WebpackModuleInfo, exports: any, require: typeof wreq) => void)
	& {
		src?: string;
		__patched?: boolean;
	};

export type WebpackJsonp =
	& [
		number[],
		{ [id: string]: WebpackFactory },
		(require: typeof wreq) => any,
	]
	& {
		push: {
			__patched?: boolean;
		};
	};

export interface WebpackModuleSystem {
	factories: Record<number, WebpackFactory>;
	cache: Record<number, WebpackModuleInfo>;
	require: (id: number) => WebpackModuleInfo;
}

export let wreq: WebpackRequire;

function extractPrivateCache(wreq: (_: symbol) => void) {
	const sym = Symbol("john.extract");
	let cache: any;

	Object.defineProperty(Object.prototype, sym, {
		get() {
			cache = this;
			return { exports: {} };
		},
		set() {},
		configurable: true,
	});

	wreq(sym);

	// @ts-expect-error read if cute
	delete Object.prototype[sym];
	if (cache) delete cache[sym];

	return cache;
}

export function interceptWebpackModuleSystem(
	{ ready, chunkLoad }: {
		ready: (value: WebpackRequire["m"]) => void;
		chunkLoad: (
			factories: Record<number, WebpackFactory>,
		) => void;
	},
) {
	if (wreq) {
		ready(wreq.m);
		return wreq;
	}
	let chunk: WebpackJsonp | undefined;

	if ("webpackChunkweb" in window) {
		chunk = window.webpackChunkweb as typeof chunk;
		hookChunkPush(chunk!);
	}

	Object.defineProperty(window, "webpackChunkweb", {
		configurable: true,
		set(jsonp: WebpackJsonp) {
			chunk = jsonp;
			hookChunkPush(jsonp);
		},
		get: () => chunk,
	});

	Object.defineProperty(Function.prototype, "m", {
		configurable: true,
		set(value) {
			console.trace("[john] hi webpack");

			// @ts-expect-error meow
			delete Function.prototype.m;
			this.m = value;
			this.c = extractPrivateCache(this);

			wreq = this;
			ready(value);
		},
	});

	function hookChunkPush(jsonp: WebpackJsonp) {
		const push = jsonp.push;

		if (jsonp?.push && jsonp.push.__patched !== true) {
			jsonp.push = (items) => {
				try {
					const res = push.apply(chunk, [items]);
					if (!push.__patched) {
						console.trace(
							"[john] injecting webpack modules",
							(items as any)[1],
						);
						(items as any)[1] && chunkLoad((items as any)[1]);
					}
					return res;
				} catch (err) {
					console.error("[john] failed to inject webpack modules", err);
					return 0;
				}
			};

			jsonp.push.bind = (thisArg: any, ...args: any[]) =>
				push.bind(thisArg, ...args);

			jsonp.push.__patched = true;
		}
	}
}

export function findModule(...props: string[]): any {
	if (!webpack.cache) return null;

	for (const id in webpack.cache) {
		const module = webpack.cache[id];
		if (
			!module?.loaded || !module.exports || typeof module.exports !== "object"
		) {
			continue;
		}

		if (props.every((prop) => prop in module.exports)) {
			return module.exports;
		}

		if (
			!module.exports.default ||
			(typeof module.exports.default !== "object" &&
				typeof module.exports.default !== "function")
		) {
			continue;
		}

		if (props.every((prop) => prop in module.exports.default)) {
			return module.exports.default;
		}
	}
}

export function search(
	...query: string[]
): WebpackModuleInfo | WebpackModuleInfo[] | null {
	if (!webpack.factories) return null;

	const results: WebpackModuleInfo[] = [];

	for (const id in webpack.factories) {
		let code: string;
		try {
			code = Function.prototype.toString.call(webpack.factories[id]);
		} catch {
			continue;
		}

		if (query.every((q) => code.includes(q))) {
			results.push(webpack.cache[id]);
		}
	}

	if (results.length > 1) {
		console.warn("[john] multiple results for query:", query);
		return results;
	}
	if (results.length === 1) {
		return results[0];
	}
	return console.warn("[john] no match for query:", query), null;
}

const webpack = {
	get factories() {
		return wreq?.m;
	},
	get cache() {
		return wreq?.c;
	},
	get require() {
		return wreq;
	},
};

export default webpack;
