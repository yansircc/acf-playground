<script lang="ts">
  import { SvelteFlow, Background, Controls } from '@xyflow/svelte';
  import type { Node, Edge, NodeTypes, Viewport, EdgeMarkerType, Connection } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import EntityNode from './EntityNode.svelte';
  import { store } from '$lib/store.svelte';
  import type { FieldType } from '$lib/types';
  import { allFields, findFieldRecursive } from '$lib/types';

  const nodeTypes: NodeTypes = { entity: EntityNode } as NodeTypes;

  let nodes: Node[] = $state.raw([]);
  let edges: Edge[] = $state.raw([]);
  let viewport: Viewport = $state({ x: 0, y: 0, zoom: 0.75 });
  let containerEl: HTMLDivElement | undefined = $state();

  // Sync store → xyflow nodes
  $effect(() => {
    nodes = store.entities.map((e) => ({
      id: e.id,
      type: 'entity',
      position: store.positions[e.id] ?? { x: 0, y: 0 },
      data: {
        entity: e,
        selected: store.selected === e.id,
      },
    }));
  });

  // Sync store → xyflow edges
  // 投射层：数据忠实（store.edges 不变），视觉优化（双向合并为字段对字段单线双箭头）
  $effect(() => {
    const storeEdges = store.edges;

    // 检测双向配对：key = "min:max" of (source, target)，同时记录配对的两条边
    const pairKey = (a: string, b: string) => a < b ? `${a}:${b}` : `${b}:${a}`;
    const pairEdges = new Map<string, typeof storeEdges>();
    for (const e of storeEdges) {
      if (e.source === e.target) continue; // 自引用不算双向
      const k = pairKey(e.source, e.target);
      const arr = pairEdges.get(k) ?? [];
      arr.push(e);
      pairEdges.set(k, arr);
    }

    const rendered = new Set<string>(); // 已渲染的双向配对 key
    const result: Edge[] = [];

    for (const e of storeEdges) {
      const sourceEntity = store.entities.find((ent) => ent.id === e.source);
      const sourceField = sourceEntity ? findFieldRecursive(sourceEntity, e.sourceHandle) : undefined;
      const isTaxonomy = sourceField?.type.kind === 'ref' && sourceField.type.cardinality === 'taxonomy';
      const color = isTaxonomy ? '#46b450' : '#0073aa';

      const k = e.source !== e.target ? pairKey(e.source, e.target) : '';
      const pair = k ? pairEdges.get(k) : undefined;
      const isBidirectional = pair && pair.length >= 2;

      if (isBidirectional) {
        if (rendered.has(k)) continue;
        rendered.add(k);

        // 找到反向边，用其 sourceHandle 作为 targetHandle（加 -target 后缀）
        const reverse = pair.find((r) => r.source === e.target && r.target === e.source);
        const marker: EdgeMarkerType = { type: 'arrowclosed', color };
        result.push({
          id: e.id,
          source: e.source,
          sourceHandle: e.sourceHandle,
          target: e.target,
          targetHandle: reverse ? `${reverse.sourceHandle}-target` : undefined,
          animated: true,
          markerStart: marker,
          markerEnd: marker,
          style: `stroke: ${color}; stroke-width: 2px;`,
          label: '⇄',
        });
      } else {
        // 单向：连到实体头部（不指定 targetHandle，走默认 header handle）
        result.push({
          id: e.id,
          source: e.source,
          sourceHandle: e.sourceHandle,
          target: e.target,
          animated: true,
          markerEnd: { type: 'arrowclosed', color },
          style: `stroke: ${color}; stroke-width: 2px;`,
        });
      }
    }

    edges = result;
  });

  // 画布连线：从 handle 拖到 handle 时自动设置 ref target
  function handleConnect(conn: Connection) {
    const { source, sourceHandle, target, targetHandle } = conn;
    if (!source || !sourceHandle || !target) return;

    // 单向：右点 → 实体头部左点（targetHandle === 'header'）
    // 双向：右点 → 对方 ref 字段右点（targetHandle === '{fieldId}-target'）
    store.updateRefTarget(source, sourceHandle, target);

    if (targetHandle && targetHandle.endsWith('-target')) {
      // 双向：自动填充反向
      const reverseFieldId = targetHandle.replace(/-target$/, '');
      store.updateRefTarget(target, reverseFieldId, source);
    }
  }

  function handleNodeClick(_event: { node: Node }) {
    store.setSelected(_event.node.id);
  }

  function handleNodeDragStop(_event: { targetNode: Node | null; nodes: Node[] }) {
    for (const n of _event.nodes) {
      store.updatePosition(n.id, n.position);
    }
  }

  function handlePaneClick() {
    store.setSelected(null);
  }

  // Delete key: edges → clear ref target, nodes → remove entity
  // 双向合并的 edge 删除时，需要清除双方的 ref target
  function handleDelete(params: { nodes: Node[]; edges: Edge[] }) {
    for (const edge of params.edges) {
      // 清除 source→target 方向
      const entity = store.entities.find((e) => e.id === edge.source);
      if (entity) {
        const field = findFieldRecursive(entity, edge.sourceHandle ?? '');
        if (field && field.type.kind === 'ref') {
          store.updateRefTarget(entity.id, field.id, '');
        }
      }
      // 清除反向 target→source（如果存在双向 ref）
      const reverseEntity = store.entities.find((e) => e.id === edge.target);
      if (reverseEntity) {
        for (const f of allFields(reverseEntity)) {
          if (f.type.kind === 'ref' && f.type.target === edge.source) {
            store.updateRefTarget(reverseEntity.id, f.id, '');
          }
        }
      }
    }
    if (params.nodes.length > 0) {
      const names = params.nodes.map((n) => {
        const e = store.entities.find((ent) => ent.id === n.id);
        return e ? `"${e.name}"` : n.id;
      }).join(', ');
      if (!confirm(`确定删除实体 ${names} 及其所有数据吗？`)) return;
      for (const node of params.nodes) {
        store.removeEntity(node.id);
      }
    }
  }

  // === Drop handling on the outer container ===

  function screenToFlow(clientX: number, clientY: number): { x: number; y: number } {
    const rect = containerEl?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - viewport.x) / viewport.zoom,
      y: (clientY - rect.top - viewport.y) / viewport.zoom,
    };
  }

  function hitTestNode(flowPos: { x: number; y: number }): string | null {
    for (const node of nodes) {
      const w = (node.measured?.width ?? 180);
      const h = (node.measured?.height ?? 100);
      if (
        flowPos.x >= node.position.x &&
        flowPos.x <= node.position.x + w &&
        flowPos.y >= node.position.y &&
        flowPos.y <= node.position.y + h
      ) {
        return node.id;
      }
    }
    return null;
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    if (!event.dataTransfer) return;

    const raw = event.dataTransfer.getData('application/acf-field');
    if (!raw) return;

    const payload = JSON.parse(raw);
    const position = screenToFlow(event.clientX, event.clientY);
    const hitNodeId = hitTestNode(position);

    if (payload.action === 'new-entity') {
      const name = prompt('实体名称：', '新实体');
      if (name) store.addEntity(name, position);
    } else if (payload.action === 'add-field' && payload.fieldType) {
      const ft = payload.fieldType as FieldType;

      // Taxonomy macro: requires dropping on existing node
      if (ft.kind === 'ref' && ft.cardinality === 'taxonomy') {
        if (hitNodeId) {
          const taxName = prompt('分类名称：', '分类');
          if (taxName) {
            const taxPos = { x: position.x + 300, y: position.y };
            store.addTaxonomyField(hitNodeId, taxName, taxPos);
          }
        } else {
          const entityName = prompt('先创建实体，再添加分类。\n实体名称：', '新实体');
          if (entityName) {
            const entity = store.addEntity(entityName, position);
            const taxName = prompt('分类名称：', '分类');
            if (taxName) {
              const taxPos = { x: position.x + 300, y: position.y };
              store.addTaxonomyField(entity.id, taxName, taxPos);
            }
          }
        }
        return;
      }

      if (hitNodeId) {
        store.addField(hitNodeId, ft, undefined, payload.initialConfig as Record<string, unknown> | undefined);
        store.setSelected(hitNodeId);
      } else {
        const name = prompt('创建新实体并添加此字段。\n实体名称：', '新实体');
        if (name) {
          const entity = store.addEntity(name, position);
          store.addField(entity.id, ft, undefined, payload.initialConfig as Record<string, unknown> | undefined);
        }
      }
    }
  }
</script>

<div
  class="canvas-container"
  bind:this={containerEl}
  ondragover={handleDragOver}
  ondrop={handleDrop}
  role="application"
>
  <SvelteFlow
    bind:nodes
    {edges}
    bind:viewport
    {nodeTypes}
    fitView
    fitViewOptions={{ maxZoom: 0.75 }}
    onnodeclick={handleNodeClick}
    onnodedragstop={handleNodeDragStop}
    onpaneclick={handlePaneClick}
    onconnect={handleConnect}
    ondelete={handleDelete}
    deleteKey={['Backspace', 'Delete']}
    proOptions={{ hideAttribution: true }}
  >
    <Background />
    <Controls />
  </SvelteFlow>
</div>

<style lang="scss">
  .canvas-container {
    flex: 1;
    height: 100%;
    position: relative;
  }
</style>
