export async function conversationContext(store, runtime, lectureId, query, model, signal) {
  const summary = store.summary(lectureId);
  const unsummarized = store.messages(lectureId).filter(message => message.status === 'completed' && message.id > (summary?.through_id ?? 0));
  if (unsummarized.length > 24 || unsummarized.reduce((total, message) => total + message.content.length, 0) > 60_000) {
    const older = unsummarized.slice(0, -8);
    if (older.length) {
      const result = await runtime.streamResponse({ model, signal,
        instructions: 'Summarize this private lecture conversation for continuity. Preserve all owner decisions, preferences, definitions, corrections, unresolved questions and source/statement IDs. Distinguish guesses from decisions. Retain important Hebrew and mathematical terms. Be compact but do not invent. Output only the summary.',
        input: [{ role: 'user', content: JSON.stringify({ previousSummary: summary?.content ?? '', messages: older.map(({ role, content }) => ({ role, content })) }) }],
      });
      if (!result.text.trim()) throw Object.assign(new Error('summary_failed'), { code: 'summary_failed' });
      store.saveSummary(lectureId, older.at(-1).id, result.text);
    }
  }
  return store.context(lectureId, query);
}