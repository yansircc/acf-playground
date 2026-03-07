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

  // Sync store → xyflow edges
  $effect(() => {
    edges = store.edges.map((e) => ({
      id: e.id,
      source: e.source,
      sourceHandle: e.sourceHandle,
      target: e.target,
      animated: true,
      style: 'stroke: #0073aa; stroke-width: 2px;',
    }));
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
      const name = prompt('Entity name:', 'New Entity');
      if (name) store.addEntity(name, position);
    } else if (payload.action === 'add-field' && payload.fieldType) {
      if (hitNodeId) {
        store.addField(hitNodeId, payload.fieldType as FieldType);
        store.setSelected(hitNodeId);
      } else {
        const name = prompt('Create new entity with this field.\nEntity name:', 'New Entity');
        if (name) {
          const entity = store.addEntity(name, position);
          store.addField(entity.id, payload.fieldType as FieldType);
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
    deleteKey={null}
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
