import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import type { BaseMessage } from "@langchain/core/messages";

const historyStore = new Map<string, InMemoryChatMessageHistory>();
const MAX_MESSAGES = 6;

export function getHistory(sessionId = "default"): InMemoryChatMessageHistory {
	if (!historyStore.has(sessionId)) {
		historyStore.set(sessionId, new InMemoryChatMessageHistory());
	}
	return historyStore.get(sessionId)!;
}

export async function pushToHistory(sessionId: string, messages: BaseMessage[] = []): Promise<void> {
	const history = getHistory(sessionId);
	for (const msg of messages) {
		await history.addMessage(msg);
	}
}
