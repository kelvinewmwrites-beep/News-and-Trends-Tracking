import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { SEGMENT_MAP, type SegmentId } from "./segments";
import { listArticles } from "./articles";
import { computeTrends } from "./trends";
import { rowToIdea, type ContentIdea, type ContentIdeaRow } from "./types";
import type { Article } from "./types";

export interface GeneratedIdea {
  title: string;
  format: string;
  angle: string;
  hook: string;
  sourceArticleIds: number[];
}

const CONTENT_IDEA_MODEL = process.env.CONTENT_IDEA_MODEL || "claude-sonnet-5";

const insertIdeaStmt = db.prepare<{
  segment: string;
  title: string;
  format: string;
  angle: string;
  hook: string;
  source_article_ids: string;
  generator: string;
  created_at: string;
}>(`
  INSERT INTO content_ideas (segment, title, format, angle, hook, source_article_ids, generator, created_at)
  VALUES (@segment, @title, @format, @angle, @hook, @source_article_ids, @generator, @created_at)
`);

function saveIdeas(
  segment: SegmentId,
  ideas: GeneratedIdea[],
  generator: "claude" | "template"
): ContentIdea[] {
  const now = new Date().toISOString();
  const inserted: ContentIdea[] = [];
  const tx = db.transaction((items: GeneratedIdea[]) => {
    for (const idea of items) {
      const info = insertIdeaStmt.run({
        segment,
        title: idea.title,
        format: idea.format,
        angle: idea.angle,
        hook: idea.hook,
        source_article_ids: JSON.stringify(idea.sourceArticleIds),
        generator,
        created_at: now,
      });
      const row = db
        .prepare(`SELECT * FROM content_ideas WHERE id = ?`)
        .get(info.lastInsertRowid) as ContentIdeaRow;
      inserted.push(rowToIdea(row));
    }
  });
  tx(ideas);
  return inserted;
}

function stripCodeFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : text.trim();
}

async function generateWithClaude(
  segment: SegmentId,
  articles: Article[],
  count: number
): Promise<GeneratedIdea[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const segmentDef = SEGMENT_MAP[segment];
  const client = new Anthropic({ apiKey });

  const articleList = articles
    .slice(0, 12)
    .map((a, i) => `${i + 1}. [id:${a.id}] "${a.title}" — ${a.source ?? "unknown source"}${a.snippet ? `\n   ${a.snippet}` : ""}`)
    .join("\n");

  const prompt = `You are a content strategist for a Singapore corporate services firm. Your task is to turn recent Singapore business news into ${count} concrete, publish-ready content ideas for the "${segmentDef.label}" service line (${segmentDef.description}).

Recent tracked news for this segment:
${articleList || "(no recent articles tracked yet — generate general evergreen ideas for this service line instead)"}

For each idea, ground it in a specific article when possible (reference its [id:N]) and explain why it matters right now for Singapore SMEs and business owners. Vary the formats across: LinkedIn post, blog article, client email/newsletter, short video/reel script, infographic/carousel, webinar or FAQ explainer.

Respond with ONLY a JSON array (no prose, no markdown fence) of exactly ${count} objects, each with this shape:
{"title": string, "format": string, "angle": string, "hook": string, "sourceArticleIds": number[]}

- "title": a punchy, specific content title
- "format": the content format
- "angle": 1-2 sentences on the unique angle/why-now
- "hook": a ready-to-use opening line/hook for the piece
- "sourceArticleIds": the [id:N] values of articles this idea draws on (empty array if none)`;

  const response = await client.messages.create({
    model: CONTENT_IDEA_MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  try {
    const json = JSON.parse(stripCodeFence(textBlock.text));
    if (!Array.isArray(json)) return null;
    return json
      .filter((item) => item && typeof item.title === "string")
      .map((item) => ({
        title: String(item.title),
        format: String(item.format ?? "Blog article"),
        angle: String(item.angle ?? ""),
        hook: String(item.hook ?? ""),
        sourceArticleIds: Array.isArray(item.sourceArticleIds)
          ? item.sourceArticleIds.filter((n: unknown) => typeof n === "number")
          : [],
      }));
  } catch {
    return null;
  }
}

const TEMPLATES = [
  (title: string) => ({
    format: "Blog article",
    make: () => `Explainer: What "${title}" means for Singapore SMEs`,
    angle: "Translate a news development into a plain-English breakdown of practical implications and next steps for business owners.",
    hook: `You may have seen the headline — here's what it actually means for your business.`,
  }),
  (title: string) => ({
    format: "LinkedIn post",
    make: () => `3 takeaways from: ${title}`,
    angle: "A punchy, scannable list post that positions the firm as a timely, credible commentator on the news.",
    hook: `Quick take on today's news that affects Singapore business owners:`,
  }),
  (title: string) => ({
    format: "Client email / newsletter",
    make: () => `Client alert: ${title}`,
    angle: "A proactive heads-up to existing clients so they don't get caught off guard, with a soft call-to-action to book a review.",
    hook: `We're flagging this for your attention — here's what's changed and what you may need to do.`,
  }),
  (title: string) => ({
    format: "Short video / Reel script",
    make: () => `60 seconds on: ${title}`,
    angle: "A fast, camera-friendly script turning a dense news item into an accessible short-form video.",
    hook: `If you run a business in Singapore, this news just became your problem too.`,
  }),
  (title: string) => ({
    format: "FAQ explainer",
    make: () => `FAQ: Your questions about "${title}" answered`,
    angle: "Anticipate the top 5 questions clients will ask about this development and answer them in one shareable resource.",
    hook: `Here's what clients keep asking us about this.`,
  }),
];

function generateWithTemplates(
  segment: SegmentId,
  articles: Article[],
  count: number
): GeneratedIdea[] {
  const segmentDef = SEGMENT_MAP[segment];
  const trends = computeTrends(segment, 14, 5);
  const ideas: GeneratedIdea[] = [];

  const pool = articles.length > 0 ? articles : [];

  for (let i = 0; i < count; i++) {
    const template = TEMPLATES[i % TEMPLATES.length];
    if (pool[i % Math.max(pool.length, 1)]) {
      const article = pool[i % pool.length];
      const t = template(article.title);
      ideas.push({
        title: t.make(),
        format: t.format,
        angle: t.angle,
        hook: t.hook,
        sourceArticleIds: [article.id],
      });
    } else {
      const keyword = trends.keywords[i % Math.max(trends.keywords.length, 1)]?.term ?? segmentDef.shortLabel;
      ideas.push({
        title: `Guide: How Singapore SMEs can stay ahead on ${keyword}`,
        format: "Blog article",
        angle: `An evergreen resource on ${segmentDef.label.toLowerCase()} while we wait for fresh news to track.`,
        hook: `Here's what every Singapore business owner should know about ${keyword}.`,
        sourceArticleIds: [],
      });
    }
  }

  return ideas;
}

export async function generateContentIdeas(
  segment: SegmentId,
  count = 5
): Promise<{ ideas: ContentIdea[]; generator: "claude" | "template" }> {
  const { articles } = listArticles({ segment, days: 21, limit: 20 });

  const claudeIdeas = await generateWithClaude(segment, articles, count).catch(() => null);
  if (claudeIdeas && claudeIdeas.length > 0) {
    return { ideas: saveIdeas(segment, claudeIdeas, "claude"), generator: "claude" };
  }

  const templateIdeas = generateWithTemplates(segment, articles, count);
  return { ideas: saveIdeas(segment, templateIdeas, "template"), generator: "template" };
}

export function listContentIdeas(segment?: SegmentId, limit = 50): ContentIdea[] {
  const rows = segment
    ? (db
        .prepare(`SELECT * FROM content_ideas WHERE segment = ? ORDER BY id DESC LIMIT ?`)
        .all(segment, limit) as ContentIdeaRow[])
    : (db
        .prepare(`SELECT * FROM content_ideas ORDER BY id DESC LIMIT ?`)
        .all(limit) as ContentIdeaRow[]);
  return rows.map(rowToIdea);
}
