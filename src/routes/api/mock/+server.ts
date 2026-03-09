import type { RequestHandler } from './$types';
import type { Entity, Field, FieldType } from '$lib/types';
import { env } from '$env/dynamic/private';

/** 从 Field 构建 JSON Schema property（递归处理 repeat） */
function fieldToSchemaProperty(field: Field): Record<string, unknown> | null {
	const ft = field.type;

	if (ft.kind === 'atom') {
		return atomToSchema(field.name, ft);
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
			description: `${field.name} (重复器，生成 2-3 行)`,
			items: { type: 'object', properties: subProps, required }
		};
	}

	// ref → 跳过，前端本地补充
	return null;
}

function atomToSchema(
	fieldName: string,
	ft: Extract<FieldType, { kind: 'atom' }>
): Record<string, unknown> {
	const sub = ft.subtype;

	if (sub === 'number' || sub === 'range') {
		return { type: 'number', description: `${fieldName} (${sub})` };
	}
	if (sub === 'true_false') {
		return { type: 'boolean', description: `${fieldName} (是/否)` };
	}
	if (sub === 'image' || sub === 'file') {
		return {
			type: 'string',
			description: `${fieldName} (${sub}) — 用 https://picsum.photos/seed/{随机英文单词}/400/300`
		};
	}
	if (sub === 'gallery') {
		return {
			type: 'string',
			description: `${fieldName} (图库) — 3 个图片 URL，每行一个，用 https://picsum.photos/seed/{随机词}/400/300`
		};
	}
	if (sub === 'select' || sub === 'radio') {
		const choices = ft.choices ?? [];
		if (choices.length > 0) {
			return { type: 'string', enum: choices, description: `${fieldName} (从选项中选择)` };
		}
		return { type: 'string', description: `${fieldName} (${sub})` };
	}
	if (sub === 'checkbox') {
		const choices = ft.choices ?? [];
		if (choices.length > 0) {
			return {
				type: 'array',
				items: { type: 'string', enum: choices },
				description: `${fieldName} (多选，从选项中选 1-2 个)`
			};
		}
		return { type: 'array', items: { type: 'string' }, description: `${fieldName} (多选)` };
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

		for (const field of entity.fields) {
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
			description: '生成模拟数据行',
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
		const fieldSummary = entity.fields
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
				system: `你是 B2B 外贸场景的模拟数据生成器。为实体「${entity.name}」生成 ${safeCount} 条逼真的中文模拟数据。数据要多样化、贴近真实商业场景。`,
				messages: [
					{
						role: 'user',
						content: `请为以下实体生成 ${safeCount} 条模拟数据：\n\n实体名：${entity.name}\n字段：\n${fieldSummary}`
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
