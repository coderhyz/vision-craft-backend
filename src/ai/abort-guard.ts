/** 定时检测 abort 的间隔（ms） */
const ABORT_POLL_INTERVAL = 500;

/**
 * 创建统一的 abort 守卫。
 *
 * 用法：将整个 pipeline 体传给 guard.run()，abort 时自动打断当前 await，
 * 无需在每个异步调用处手动 race 或检查。
 *
 * ```ts
 * const guard = createAbortGuard(signal);
 * try {
 *   await guard.run(async () => {
 *     await step1();
 *     await step2();
 *     for await (const chunk of stream) { ... }
 *   });
 * } catch (err) { ... } finally { guard.dispose(); }
 * ```
 */
export function createAbortGuard(signal?: AbortSignal) {
	let rejectFn: ((err: Error) => void) | null = null;
	let timer: ReturnType<typeof setInterval> | null = null;

	const abortError = () => {
		const err = new Error("请求已被用户取消");
		err.name = "AbortError";
		return err;
	};

	const check = () => {
		if (signal?.aborted) {
			rejectFn?.(abortError());
		}
	};

	// AbortSignal 事件监听：即时响应
	const onAbort = () => check();
	signal?.addEventListener("abort", onAbort, { once: true });

	// 定时轮询兜底
	timer = setInterval(check, ABORT_POLL_INTERVAL);

	const racePromise = new Promise<never>((_, rej) => {
		rejectFn = rej;
		if (signal?.aborted) rej(abortError());
	});

	/**
	 * 包裹整个异步流程，abort 时自动 reject，无需在内部逐个 race。
	 * 内部任何 await 让出控制权的瞬间，若 signal 已 abort，race 立即 reject。
	 */
	const run = <T>(fn: () => Promise<T>): Promise<T> => {
		return Promise.race([fn(), racePromise]);
	};

	/**
	 * 同步检查：若已 abort 则立即抛出 AbortError。
	 * 用于在发起不可取消的重操作（如数据库查询）前主动拦截，
	 * 避免 run() 的内部函数在 abort 后仍继续执行到下一个昂贵调用。
	 */
	const throwIfAborted = () => {
		if (signal?.aborted) throw abortError();
	};

	const dispose = () => {
		signal?.removeEventListener("abort", onAbort);
		if (timer) clearInterval(timer);
		timer = null;
		rejectFn = null;
	};

	return { run, throwIfAborted, dispose };
}
