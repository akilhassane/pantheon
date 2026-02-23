'use client';

import React, { useCallback } from 'react';
import { Network } from 'lucide-react';
import BlockContainer from '../blocks/BlockContainer';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface NetworkDiagramBlockData {
  nodes: {
    id: string;
    label: string;
    group?: string;
  }[];
  edges: {
    from: string;
    to: string;
    label?: string;
    weight?: number;
  }[];
  layout?: 'force' | 'hierarchical' | 'tree';
}

interface NetworkDiagramBlockProps {
  data: NetworkDiagramBlockData;
  focused?: boolean;
  onClick?: () => void;
}

export default function NetworkDiagramBlock({ data, focused, onClick }: NetworkDiagramBlockProps) {
  // Convert data to React Flow format
  const initialNodes: Node[] = data.nodes.map((node, index) => ({
    id: node.id,
    data: { label: node.label },
    position: { x: (index % 3) * 200, y: Math.floor(index / 3) * 100 },
    style: {
      background: '#0a0a0a',
      color: '#d1d5db',
      border: '1px solid #00d9ff',
      borderRadius: '8px',
      padding: '8px 12px',
      fontSize: '11px',
    },
  }));

  const initialEdges: Edge[] = data.edges.map((edge, index) => ({
    id: `edge-${index}`,
    source: edge.from,
    target: edge.to,
    label: edge.label,
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#00d9ff', strokeWidth: 1.5 },
    labelStyle: { fill: '#9ca3af', fontSize: '10px' },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#00d9ff',
    },
  }));

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const header = (
    <div className="flex items-center gap-2 w-full">
      <Network className="w-3.5 h-3.5 text-[#00d9ff]" />
      <span className="text-[11px] text-gray-400">Network Diagram</span>
      <span className="text-[10px] text-gray-600">
        {data.nodes.length} nodes, {data.edges.length} edges
      </span>
    </div>
  );

  return (
    <BlockContainer
      type="mermaid"
      header={header}
      focused={focused}
      onClick={onClick}
    >
      <div className="h-96 bg-[#000000]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          style={{ background: '#000000' }}
        >
          <Controls
            style={{
              background: '#0a0a0a',
              border: '1px solid #101218',
              borderRadius: '4px',
            }}
            className="[&_button]:bg-[#0a0a0a] [&_button]:border-[#101218] [&_button]:text-gray-400 [&_button:hover]:text-[#00d9ff]"
          />
          <Background color="#101218" gap={16} />
        </ReactFlow>
      </div>
    </BlockContainer>
  );
}
