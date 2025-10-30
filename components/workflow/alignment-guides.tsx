'use client';

import { useEffect, useState } from 'react';
import { useReactFlow, type Node } from '@xyflow/react';

interface AlignmentGuide {
  position: number;
  orientation: 'horizontal' | 'vertical';
}

interface AlignmentGuidesProps {
  nodes: Node[];
  draggingNodeId: string | null;
}

const ALIGNMENT_THRESHOLD = 10; // pixels - increased for better snapping

export function AlignmentGuides({ nodes, draggingNodeId }: AlignmentGuidesProps) {
  const [guides, setGuides] = useState<AlignmentGuide[]>([]);
  const reactFlowInstance = useReactFlow();

  useEffect(() => {
    if (!draggingNodeId) {
      setGuides([]);
      return;
    }

    const draggingNode = nodes.find((n) => n.id === draggingNodeId);
    if (!draggingNode || !draggingNode.position) {
      setGuides([]);
      return;
    }

    console.log('🎯 Dragging node:', draggingNodeId, 'at position:', draggingNode.position);

    const otherNodes = nodes.filter((n) => n.id !== draggingNodeId && n.position);
    const newGuides: AlignmentGuide[] = [];

    // Get dimensions (assuming default node size if not specified)
    const draggingWidth = draggingNode.width || 300;
    const draggingHeight = draggingNode.height || 200;
    const draggingCenterX = draggingNode.position.x + draggingWidth / 2;
    const draggingCenterY = draggingNode.position.y + draggingHeight / 2;
    const draggingLeft = draggingNode.position.x;
    const draggingRight = draggingNode.position.x + draggingWidth;
    const draggingTop = draggingNode.position.y;
    const draggingBottom = draggingNode.position.y + draggingHeight;

    for (const node of otherNodes) {
      if (!node.position) continue;

      const nodeWidth = node.width || 300;
      const nodeHeight = node.height || 200;
      const nodeCenterX = node.position.x + nodeWidth / 2;
      const nodeCenterY = node.position.y + nodeHeight / 2;
      const nodeLeft = node.position.x;
      const nodeRight = node.position.x + nodeWidth;
      const nodeTop = node.position.y;
      const nodeBottom = node.position.y + nodeHeight;

      // Check vertical alignment (centers)
      if (Math.abs(draggingCenterX - nodeCenterX) < ALIGNMENT_THRESHOLD) {
        newGuides.push({
          position: nodeCenterX,
          orientation: 'vertical',
        });
      }

      // Check vertical alignment (left edges)
      if (Math.abs(draggingLeft - nodeLeft) < ALIGNMENT_THRESHOLD) {
        newGuides.push({
          position: nodeLeft,
          orientation: 'vertical',
        });
      }

      // Check vertical alignment (right edges)
      if (Math.abs(draggingRight - nodeRight) < ALIGNMENT_THRESHOLD) {
        newGuides.push({
          position: nodeRight,
          orientation: 'vertical',
        });
      }

      // Check horizontal alignment (centers)
      if (Math.abs(draggingCenterY - nodeCenterY) < ALIGNMENT_THRESHOLD) {
        newGuides.push({
          position: nodeCenterY,
          orientation: 'horizontal',
        });
      }

      // Check horizontal alignment (top edges)
      if (Math.abs(draggingTop - nodeTop) < ALIGNMENT_THRESHOLD) {
        newGuides.push({
          position: nodeTop,
          orientation: 'horizontal',
        });
      }

      // Check horizontal alignment (bottom edges)
      if (Math.abs(draggingBottom - nodeBottom) < ALIGNMENT_THRESHOLD) {
        newGuides.push({
          position: nodeBottom,
          orientation: 'horizontal',
        });
      }
    }

    // Remove duplicate guides
    const uniqueGuides = newGuides.filter(
      (guide, index, self) =>
        index ===
        self.findIndex(
          (g) => g.position === guide.position && g.orientation === guide.orientation
        )
    );

    console.log('📏 Found', uniqueGuides.length, 'alignment guides:', uniqueGuides);
    setGuides(uniqueGuides);
  }, [nodes, draggingNodeId]);

  if (guides.length === 0) {
    return null;
  }

  // Get viewport for coordinate transformation
  const viewport = reactFlowInstance.getViewport();
  const { x: viewportX, y: viewportY, zoom } = viewport;

  console.log('🎨 Rendering guides:', guides.length, 'viewport:', { viewportX, viewportY, zoom });

  return (
    <div
      className="react-flow__panel pointer-events-none"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1000,
        overflow: 'hidden'
      }}
    >
      {guides.map((guide, index) => {
        if (guide.orientation === 'vertical') {
          // Transform X coordinate from flow to screen
          const screenX = guide.position * zoom + viewportX;
          return (
            <div
              key={`${guide.orientation}-${guide.position}-${index}`}
              style={{
                position: 'absolute',
                left: `${screenX}px`,
                top: '-1000px',
                width: '2px',
                height: 'calc(100% + 2000px)',
                backgroundColor: '#3b82f6',
                opacity: 0.7,
                boxShadow: '0 0 6px rgba(59, 130, 246, 0.8)',
              }}
            />
          );
        } else {
          // Transform Y coordinate from flow to screen
          const screenY = guide.position * zoom + viewportY;
          return (
            <div
              key={`${guide.orientation}-${guide.position}-${index}`}
              style={{
                position: 'absolute',
                top: `${screenY}px`,
                left: '-1000px',
                width: 'calc(100% + 2000px)',
                height: '2px',
                backgroundColor: '#3b82f6',
                opacity: 0.7,
                boxShadow: '0 0 6px rgba(59, 130, 246, 0.8)',
              }}
            />
          );
        }
      })}
    </div>
  );
}
