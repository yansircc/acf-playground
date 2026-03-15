import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

type SlugifyRequest = {
  entities: Array<{
    id: string;
    name: string;
    isTaxonomy: boolean;
    needSlug: boolean;
    fields: Array<{ id: string; name: string }>;
  }>;
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { entities } = (await request.json()) as SlugifyRequest;

    if (!entities || entities.length === 0) {
      return Response.json({ entities: [] });
    }

    const baseUrl = env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
    const apiKey = env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN || '';

    if (!apiKey) {
      return Response.json({ error: 'No API key configured' }, { status: 500 });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };
    if (env.ANTHROPIC_AUTH_TOKEN && !env.ANTHROPIC_API_KEY) {
      headers['Authorization'] = `Bearer ${env.ANTHROPIC_AUTH_TOKEN}`;
    }

    // Build description of what we need
    const entityDescriptions = entities.map((e) => {
      const parts: string[] = [`- "${e.name}" (id: ${e.id}, ${e.isTaxonomy ? 'taxonomy, max 32 chars' : 'post_type, max 20 chars'})`];
      if (e.needSlug) parts.push('  → needs English slug');
      if (e.fields.length > 0) {
        parts.push('  → fields needing English names:');
        for (const f of e.fields) {
          parts.push(`    - "${f.name}" (id: ${f.id})`);
        }
      }
      return parts.join('\n');
    }).join('\n');

    // Tool schema for structured output
    const entityItemProperties: Record<string, unknown> = {
      id: { type: 'string', description: 'The entity id (pass through unchanged)' },
      slug: { type: 'string', description: 'English snake_case slug for the entity (only if needSlug was true, otherwise empty string)' },
      fields: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The field id (pass through unchanged)' },
            name: { type: 'string', description: 'English snake_case field name' },
          },
          required: ['id', 'name'],
        },
      },
    };

    const tool = {
      name: 'slugify_result',
      description: 'Return slugified identifiers for WordPress entities and fields',
      input_schema: {
        type: 'object',
        properties: {
          entities: {
            type: 'array',
            items: {
              type: 'object',
              properties: entityItemProperties,
              required: ['id', 'slug', 'fields'],
            },
          },
        },
        required: ['entities'],
      },
    };

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        tool_choice: { type: 'tool', name: 'slugify_result' },
        tools: [tool],
        system: `You are a WordPress slug generator. Given Chinese or non-ASCII entity/field names, generate concise English snake_case identifiers suitable for WordPress.

Rules:
- Entity slugs (post_type): max 20 chars, snake_case, lowercase, a-z0-9_ only
- Taxonomy slugs: max 32 chars, snake_case, lowercase, a-z0-9_ only
- Field names: snake_case, lowercase, a-z0-9_ only, concise
- Avoid WordPress reserved words: post, page, attachment, revision, nav_menu_item, category, tag, post_tag, nav_menu, link_category, post_format, action, author, order, theme, type
- No duplicates across entities or within fields
- Translate the meaning, don't transliterate (e.g. "产品" → "product", not "chan_pin")`,
        messages: [
          {
            role: 'user',
            content: `Generate English slugs/names for these WordPress entities and fields:\n\n${entityDescriptions}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Slugify API error:', response.status, errText);
      return Response.json({ error: `API error: ${response.status}` }, { status: 502 });
    }

    const result = await response.json();
    const toolUseBlock = result.content?.find(
      (b: { type: string }) => b.type === 'tool_use',
    );

    if (!toolUseBlock?.input?.entities) {
      console.error('Unexpected slugify response:', JSON.stringify(result));
      return Response.json({ error: 'Invalid API response' }, { status: 502 });
    }

    return Response.json({ entities: toolUseBlock.input.entities });
  } catch (err) {
    console.error('Slugify API error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
