type Evidence = {
  type: string;
  id: string;
  text: string;
};

export async function answerWithEvidence(question: string, evidence: Evidence[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
  const context = evidence.slice(0, 20).map((e, i) => `[${i + 1}] ${e.type}/${e.id}: ${e.text}`).join("\n");

  if (!apiKey) {
    return {
      answer: buildDeterministicAnswer(question, evidence),
      provider: "local-evidence",
      citations: evidence.slice(0, 10).map((_, i) => i + 1),
    };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: "You are a workshop business-memory assistant. Answer only from the supplied evidence. If evidence is insufficient, say so. Cite evidence using [1], [2], etc. Never invent vehicle history, payments, repairs, or customer facts.",
        },
        { role: "user", content: `Question: ${question}\n\nEvidence:\n${context}` },
      ],
    }),
  });

  if (!response.ok) throw new Error(`AI provider failed: ${response.status}`);
  const data = await response.json() as { output_text?: string };
  return {
    answer: data.output_text ?? "The AI provider returned no text.",
    provider: model,
    citations: evidence.slice(0, 20).map((_, i) => i + 1),
  };
}

function buildDeterministicAnswer(question: string, evidence: Evidence[]) {
  if (!evidence.length) return "I could not find supporting workshop records for that question.";
  return `I found ${evidence.length} supporting records. Review the cited records before making a business decision.\n\n${evidence.slice(0, 5).map((e, i) => `[${i + 1}] ${e.text}`).join("\n")}`;
}
