import type { RequestHandler } from './$types';
import type { Entity, Field, FieldType } from '$lib/types';
import { allFields } from '$lib/types';
import { env } from '$env/dynamic/private';

/** 从 Field 构建 JSON Schema property（递归处理 repeat） */
function fieldToSchemaProperty(field: Field): Record<string, unknown> | null {
	const ft = field.type;

	if (ft.kind === 'atom') {
		return atomToSchema(field, ft);
	}

	if (ft.kind === 'repeat') {
		const subProps: Record<string, unknown> = {};
		const required: string[] = [];
		for (const sf of ft.fields) {
			const sp = fieldToSchemaProperty(sf);
			if (sp) {
				subProps[sf.id] = sp;
				required.push(sf.id);
			}
		}
		if (Object.keys(subProps).length === 0) return null;
		return {
			type: 'array',
			description: `${field.name} (repeater, generate 2-3 rows)`,
			items: { type: 'object', properties: subProps, required }
		};
	}

	// ref → 跳过，前端本地补充
	return null;
}

function atomToSchema(
	field: Field,
	ft: Extract<FieldType, { kind: 'atom' }>
): Record<string, unknown> {
	const sub = ft.subtype;
	const fieldName = field.name;

	if (sub === 'number' || sub === 'range') {
		return { type: 'number', description: `${fieldName} (${sub})` };
	}
	if (sub === 'true_false') {
		return { type: 'boolean', description: `${fieldName} (true/false)` };
	}
	if (sub === 'image' || sub === 'file') {
		return {
			type: 'string',
			description: `${fieldName} (${sub}) — use https://picsum.photos/seed/{random-word}/400/300`
		};
	}
	if (sub === 'gallery') {
		return {
			type: 'string',
			description: `${fieldName} (gallery) — 3 image URLs, one per line, use https://picsum.photos/seed/{random-word}/400/300`
		};
	}
	if (sub === 'select' || sub === 'radio') {
		const choices = field.config?.choices as string[] ?? [];
		if (choices.length > 0) {
			return { type: 'string', enum: choices, description: `${fieldName} (pick from choices)` };
		}
		return { type: 'string', description: `${fieldName} (${sub})` };
	}
	if (sub === 'checkbox') {
		const choices = field.config?.choices as string[] ?? [];
		if (choices.length > 0) {
			return {
				type: 'array',
				items: { type: 'string', enum: choices },
				description: `${fieldName} (multi-select, pick 1-2 from choices)`
			};
		}
		return { type: 'array', items: { type: 'string' }, description: `${fieldName} (multi-select)` };
	}

	// 其余 atom 一律 string
	return { type: 'string', description: `${fieldName} (${sub})` };
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { entity, count } = (await request.json()) as {
			entity: Entity;
			allEntities: Entity[];
			count: number;
		};

		const safeCount = Math.max(1, Math.min(10, count || 3));

		// 构建 tool schema properties
		const properties: Record<string, unknown> = {};
		const required: string[] = [];
		const fields = allFields(entity);

		for (const field of fields) {
			const prop = fieldToSchemaProperty(field);
			if (prop) {
				properties[field.id] = prop;
				required.push(field.id);
			}
		}

		if (Object.keys(properties).length === 0) {
			return Response.json({ rows: Array.from({ length: safeCount }, () => ({})) });
		}

		const tool = {
			name: 'mock_data',
			description: 'Generate mock data rows',
			input_schema: {
				type: 'object',
				properties: {
					rows: {
						type: 'array',
						items: { type: 'object', properties, required },
						minItems: safeCount,
						maxItems: safeCount
					}
				},
				required: ['rows']
			}
		};

		// 构建字段描述供 system prompt
		const fieldSummary = fields
			.filter((f) => f.type.kind !== 'ref')
			.map((f) => `- ${f.name}`)
			.join('\n');

		const baseUrl = env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
		const apiKey = env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN || '';

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01'
		};
		if (env.ANTHROPIC_AUTH_TOKEN && !env.ANTHROPIC_API_KEY) {
			headers['Authorization'] = `Bearer ${env.ANTHROPIC_AUTH_TOKEN}`;
		}

		const response = await fetch(`${baseUrl}/v1/messages`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				model: 'claude-haiku-4-5-20251001',
				max_tokens: 4096,
				tool_choice: { type: 'tool', name: 'mock_data' },
				tools: [tool],
				system: `You are a mock data generator for B2B foreign trade scenarios. Generate ${safeCount} realistic English mock data entries for entity "${entity.name}". Data should be diverse and resemble real business scenarios.`,
				messages: [
					{
						role: 'user',
						content: `Generate ${safeCount} mock data entries for:\n\nEntity: ${entity.name}\nFields:\n${fieldSummary}`
					}
				]
			})
		});

		if (!response.ok) {
			const errText = await response.text();
			console.error('Haiku API error:', response.status, errText);
			return Response.json({ error: `API 错误: ${response.status}` }, { status: 502 });
		}

		const result = await response.json();

		// 从 tool_use content block 提取 rows
		const toolUseBlock = result.content?.find(
			(b: { type: string }) => b.type === 'tool_use'
		);

		if (!toolUseBlock?.input?.rows) {
			console.error('Unexpected Haiku response:', JSON.stringify(result));
			return Response.json({ error: '未获取到有效数据' }, { status: 502 });
		}

		return Response.json({ rows: toolUseBlock.input.rows });
	} catch (err) {
		console.error('Mock API error:', err);
		return Response.json({ error: String(err) }, { status: 500 });
	}
};
