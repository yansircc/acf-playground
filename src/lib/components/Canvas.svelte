<script lang="ts">
  import { SvelteFlow, Background, Controls } from '@xyflow/svelte';
  import type { Node, Edge, NodeTypes, Viewport } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import EntityNode from './EntityNode.svelte';
  import { store } from '$lib/store.svelte';
  import type { FieldType } from '$lib/types';

  const nodeTypes: NodeTypes = { entity: EntityNode } as NodeTypes;

  let nodes: Node[] = $state.raw([]);
  let edges: Edge[] = $state.raw([]);
  let viewport: Viewport = $state({ x: 0, y: 0, zoom: 1 });
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

  // Sync store → xyflow edges (taxonomy edges get green color)
  $effect(() => {
    edges = store.edges.map((e) => {
      // Find the source field to check if it's taxonomy
      const sourceEntity = store.entities.find((ent) => ent.id === e.source);
      const sourceField = sourceEntity?.fields.find((f) => f.id === e.sourceHandle);
      const isTaxonomy = sourceField?.type.kind === 'ref' && sourceField.type.cardinality === 'taxonomy';

      return {
        id: e.id,
        source: e.source,
        sourceHandle: e.sourceHandle,
        target: e.target,
        animated: true,
        style: isTaxonomy
          ? 'stroke: #46b450; stroke-width: 2px;'
          : 'stroke: #0073aa; stroke-width: 2px;',
      };
    });
  });

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
  function handleDelete(params: { nodes: Node[]; edges: Edge[] }) {
    for (const edge of params.edges) {
      const entity = store.entities.find((e) => e.id === edge.source);
      if (!entity) continue;
      const field = entity.fields.find((f) => f.id === edge.sourceHandle);
      if (field && field.type.kind === 'ref') {
        store.updateRefTarget(entity.id, field.id, '');
      }
    }
    for (const node of params.nodes) {
      store.removeEntity(node.id);
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
        store.addField(hitNodeId, ft);
        store.setSelected(hitNodeId);
      } else {
        const name = prompt('创建新实体并添加此字段。\n实体名称：', '新实体');
        if (name) {
          const entity = store.addEntity(name, position);
          store.addField(entity.id, ft);
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
    bind:edges
    bind:viewport
    {nodeTypes}
    fitView
    onnodeclick={handleNodeClick}
    onnodedragstop={handleNodeDragStop}
    onpaneclick={handlePaneClick}
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
