"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { getModelDependenciesTree } from "@/lib/api/models";
import type {
  BoardPremise,
  DependencyTreeEdge,
  DependencyTreeNode,
  DependencyTreeResponse,
  PremiseSource,
} from "@/lib/types/api";

type DependenciesPageProps = {
  modelId: string;
  premises: BoardPremise[];
};

type TreeNodeRecord = DependencyTreeNode & {
  model_id?: string | null;
  model_name?: string | null;
};

type DisplaySource = PremiseSource | "external" | "unknown";

type OutputChip = {
  id: string;
  name: string;
  modelId: string | null;
  modelName: string | null;
  sourcePremiseId: string | null;
};

type RenderNode = {
  pathKey: string;
  parentPathKey: string | null;
  premiseId: string;
  premiseName: string;
  nodeType: string;
  modelId: string | null;
  modelName: string | null;
  displaySource: DisplaySource;
  displaySourceLabel: string;
  outputChip: OutputChip | null;
  sourceModelId: string | null;
  sourceOutputId: string | null;
  children: RenderNode[];
};

type PositionedNode = {
  node: RenderNode;
  x: number;
  y: number;
  centerX: number;
  bottomY: number;
  outputX: number | null;
  outputY: number | null;
};

type LayoutEdge = {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  kind: "branch" | "output";
};

type TreeLayout = {
  width: number;
  height: number;
  nodes: PositionedNode[];
  edges: LayoutEdge[];
};

const MAIN_CARD_WIDTH = 388;
const MAIN_CARD_HEIGHT = 208;
const OUTPUT_CARD_WIDTH = 248;
const OUTPUT_CARD_HEIGHT = 126;
const OUTPUT_GAP = 30;
const COLUMN_GAP = 96;
const ROW_GAP = 176;
const CANVAS_PADDING_X = 96;
const CANVAS_PADDING_Y = 72;
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 1.45;

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function typeBadgeTone(type: string) {
  if (type === "model_output") {
    return "warning" as const;
  }

  if (type === "library") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function typeLabel(type: string) {
  if (type === "model_output") {
    return "Output de modelo";
  }

  if (type === "library") {
    return "Biblioteca";
  }

  return "Premisa";
}

function sourceTone(source: DisplaySource) {
  if (source === "library") {
    return "accent" as const;
  }

  if (source === "model_output") {
    return "warning" as const;
  }

  return "neutral" as const;
}

function sourceCardClasses(source: DisplaySource) {
  if (source === "library") {
    return "border-[rgba(20,89,199,0.22)] bg-[rgba(20,89,199,0.08)]";
  }

  if (source === "model_output") {
    return "border-[rgba(217,119,6,0.28)] bg-[rgba(217,119,6,0.08)]";
  }

  return "border-[var(--border)] bg-white";
}

function buildTreeMaps(tree: DependencyTreeResponse) {
  const nodeLookup = new Map<string, TreeNodeRecord>();
  const incomingEdges = new Map<string, DependencyTreeEdge[]>();

  tree.nodes.forEach((node) => {
    nodeLookup.set(node.id, node as TreeNodeRecord);
  });

  if (!nodeLookup.has(tree.root.id)) {
    nodeLookup.set(tree.root.id, {
      id: tree.root.id,
      type: tree.root.type,
      name: tree.root.name,
      model_id: null,
      model_name: null,
    });
  }

  tree.edges.forEach((edge) => {
    const current = incomingEdges.get(edge.to_id) || [];
    current.push(edge);
    incomingEdges.set(edge.to_id, current);
  });

  return { nodeLookup, incomingEdges };
}

function deriveSourceInfo(
  node: TreeNodeRecord | undefined,
  premise: BoardPremise | undefined,
): { source: DisplaySource; label: string } {
  if (premise) {
    return {
      source: premise.source,
      label: premise.source_label,
    };
  }

  if (node?.type === "library") {
    return {
      source: "library",
      label: "Biblioteca",
    };
  }

  if (node?.model_name) {
    return {
      source: "external",
      label: `Premisa de ${node.model_name}`,
    };
  }

  return {
    source: "unknown",
    label: "Premisa local",
  };
}

function buildRenderTree(
  tree: DependencyTreeResponse,
  premisesById: Map<string, BoardPremise>,
): RenderNode {
  const { incomingEdges, nodeLookup } = buildTreeMaps(tree);

  function buildNode(
    premiseId: string,
    parentPathKey: string | null,
    pathSegment: string,
    ancestry: Set<string>,
  ): RenderNode {
    const pathKey = parentPathKey
      ? `${parentPathKey}/${pathSegment}`
      : pathSegment;
    const treeNode = nodeLookup.get(premiseId);
    const premise = premisesById.get(premiseId);
    const sourceInfo = deriveSourceInfo(treeNode, premise);
    const incoming = incomingEdges.get(premiseId) || [];
    const outputUseEdges = incoming.filter((edge) => {
      const fromNode = nodeLookup.get(edge.from_id);
      return fromNode?.type === "model_output" && edge.relation === "uses";
    });
    const primaryOutputEdge = outputUseEdges[0] || null;
    const primaryOutputNode = primaryOutputEdge
      ? nodeLookup.get(primaryOutputEdge.from_id)
      : null;
    const primaryOutputSourceEdge = primaryOutputEdge
      ? (incomingEdges.get(primaryOutputEdge.from_id) || []).find((edge) => {
          const fromNode = nodeLookup.get(edge.from_id);
          return (
            edge.relation === "exports" && fromNode?.type !== "model_output"
          );
        })
      : undefined;

    const childCandidates: Array<{ premiseId: string; key: string }> = [];
    const candidateKeys = new Set<string>();

    incoming.forEach((edge) => {
      const fromNode = nodeLookup.get(edge.from_id);

      if (!fromNode) {
        return;
      }

      if (fromNode.type === "model_output" && edge.relation === "uses") {
        const exportEdges = incomingEdges.get(edge.from_id) || [];

        exportEdges.forEach((exportEdge) => {
          const exportFromNode = nodeLookup.get(exportEdge.from_id);

          if (
            exportEdge.relation !== "exports" ||
            !exportFromNode ||
            exportFromNode.type === "model_output"
          ) {
            return;
          }

          const uniqueKey = `${edge.from_id}:${exportEdge.from_id}`;

          if (!candidateKeys.has(uniqueKey)) {
            candidateKeys.add(uniqueKey);
            childCandidates.push({
              premiseId: exportEdge.from_id,
              key: uniqueKey,
            });
          }
        });

        return;
      }

      if (edge.relation === "exports") {
        return;
      }

      const uniqueKey = `premise:${edge.from_id}`;

      if (!candidateKeys.has(uniqueKey)) {
        candidateKeys.add(uniqueKey);
        childCandidates.push({
          premiseId: edge.from_id,
          key: uniqueKey,
        });
      }
    });

    const nextAncestry = new Set(ancestry);
    nextAncestry.add(premiseId);

    return {
      pathKey,
      parentPathKey,
      premiseId,
      premiseName: treeNode?.name || premise?.name || premiseId,
      nodeType: treeNode?.type || "premise",
      modelId: treeNode?.model_id || null,
      modelName: treeNode?.model_name || null,
      displaySource: sourceInfo.source,
      displaySourceLabel: sourceInfo.label,
      outputChip: primaryOutputNode
        ? {
            id: primaryOutputNode.id,
            name: primaryOutputNode.name,
            modelId:
              primaryOutputNode.model_id || premise?.source_model_id || null,
            modelName: primaryOutputNode.model_name || null,
            sourcePremiseId: primaryOutputSourceEdge?.from_id || null,
          }
        : null,
      sourceModelId: premise?.source_model_id || null,
      sourceOutputId: premise?.source_output_id || null,
      children: childCandidates
        .filter((candidate) => !nextAncestry.has(candidate.premiseId))
        .map((candidate, index) =>
          buildNode(
            candidate.premiseId,
            pathKey,
            `${candidate.premiseId}:${index}`,
            nextAncestry,
          ),
        ),
    };
  }

  return buildNode(tree.root.id, null, tree.root.id, new Set<string>());
}

function findNodeByPath(root: RenderNode, pathKey: string): RenderNode | null {
  if (root.pathKey === pathKey) {
    return root;
  }

  for (const child of root.children) {
    const match = findNodeByPath(child, pathKey);

    if (match) {
      return match;
    }
  }

  return null;
}

function collectDescendantPaths(node: RenderNode): string[] {
  const paths: string[] = [];

  node.children.forEach((child) => {
    paths.push(child.pathKey);
    paths.push(...collectDescendantPaths(child));
  });

  return paths;
}

function collapseBranch(expanded: Record<string, boolean>, node: RenderNode) {
  const next = { ...expanded };
  delete next[node.pathKey];

  collectDescendantPaths(node).forEach((pathKey) => {
    delete next[pathKey];
  });

  return next;
}

function toggleExpandedState(
  expanded: Record<string, boolean>,
  root: RenderNode,
  targetPathKey: string,
): Record<string, boolean> {
  const target = findNodeByPath(root, targetPathKey);

  if (!target) {
    return expanded;
  }

  if (expanded[target.pathKey]) {
    return collapseBranch(expanded, target);
  }

  let next = {
    ...expanded,
    [target.pathKey]: true,
  };

  if (target.parentPathKey) {
    const parent = findNodeByPath(root, target.parentPathKey);

    parent?.children.forEach((sibling) => {
      if (sibling.pathKey === target.pathKey) {
        return;
      }

      next = collapseBranch(next, sibling);
    });
  }

  return next;
}

function expandAncestors(root: RenderNode, targetPathKey: string) {
  const expanded: Record<string, boolean> = {};
  const segments = targetPathKey.split("/");

  segments.reduce<string | null>((current, segment) => {
    const nextPath = current ? `${current}/${segment}` : segment;

    if (nextPath !== targetPathKey && findNodeByPath(root, nextPath)) {
      expanded[nextPath] = true;
    }

    return nextPath;
  }, null);

  return expanded;
}

function nodeMatchesSearch(node: RenderNode, term: string) {
  if (!term) {
    return false;
  }

  const searchSpace = normalizeText(
    [
      node.premiseName,
      node.displaySourceLabel,
      node.modelName,
      node.outputChip?.name,
      node.outputChip?.modelName,
      node.outputChip?.modelId,
      node.premiseId,
      node.sourceOutputId,
      node.sourceModelId,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return searchSpace.includes(term);
}

function findFirstSearchMatch(
  node: RenderNode,
  term: string,
): RenderNode | null {
  if (nodeMatchesSearch(node, term)) {
    return node;
  }

  for (const child of node.children) {
    const match = findFirstSearchMatch(child, term);

    if (match) {
      return match;
    }
  }

  return null;
}

function computeTreeLayout(
  root: RenderNode,
  expanded: Record<string, boolean>,
  hiddenOutputs: Record<string, boolean>,
): TreeLayout {
  const nodes: PositionedNode[] = [];
  const edges: LayoutEdge[] = [];
  const positions = new Map<string, PositionedNode>();
  const widthCache = new Map<string, number>();
  let maxBottom = 0;

  function nodeWidth(node: RenderNode) {
    if (node.outputChip && !hiddenOutputs[node.pathKey]) {
      return MAIN_CARD_WIDTH + OUTPUT_GAP + OUTPUT_CARD_WIDTH;
    }

    return MAIN_CARD_WIDTH;
  }

  function subtreeWidth(node: RenderNode): number {
    const cached = widthCache.get(node.pathKey);

    if (cached) {
      return cached;
    }

    const selfWidth = nodeWidth(node);

    if (!expanded[node.pathKey] || node.children.length === 0) {
      widthCache.set(node.pathKey, selfWidth);
      return selfWidth;
    }

    const childrenWidth =
      node.children.reduce((sum, child) => sum + subtreeWidth(child), 0) +
      COLUMN_GAP * Math.max(0, node.children.length - 1);
    const totalWidth = Math.max(selfWidth, childrenWidth);
    widthCache.set(node.pathKey, totalWidth);
    return totalWidth;
  }

  function placeNode(node: RenderNode, xStart: number, depth: number) {
    const width = subtreeWidth(node);
    const totalNodeWidth = nodeWidth(node);
    const x = xStart + (width - totalNodeWidth) / 2;
    const y = CANVAS_PADDING_Y + depth * (MAIN_CARD_HEIGHT + ROW_GAP);
    const positioned: PositionedNode = {
      node,
      x,
      y,
      centerX: x + MAIN_CARD_WIDTH / 2,
      bottomY: y + MAIN_CARD_HEIGHT,
      outputX:
        node.outputChip && !hiddenOutputs[node.pathKey]
          ? x + MAIN_CARD_WIDTH + OUTPUT_GAP
          : null,
      outputY:
        node.outputChip && !hiddenOutputs[node.pathKey]
          ? y + (MAIN_CARD_HEIGHT - OUTPUT_CARD_HEIGHT) / 2
          : null,
    };

    positions.set(node.pathKey, positioned);
    nodes.push(positioned);
    maxBottom = Math.max(
      maxBottom,
      positioned.bottomY,
      positioned.outputY ? positioned.outputY + OUTPUT_CARD_HEIGHT : 0,
    );

    if (positioned.outputX !== null && positioned.outputY !== null) {
      edges.push({
        id: `${node.pathKey}-output`,
        fromX: x + MAIN_CARD_WIDTH,
        fromY: y + MAIN_CARD_HEIGHT / 2,
        toX: positioned.outputX,
        toY: positioned.outputY + OUTPUT_CARD_HEIGHT / 2,
        kind: "output",
      });
    }

    if (!expanded[node.pathKey] || node.children.length === 0) {
      return;
    }

    let childX = xStart;

    node.children.forEach((child) => {
      const childWidth = subtreeWidth(child);
      placeNode(child, childX, depth + 1);
      childX += childWidth + COLUMN_GAP;
      const childPosition = positions.get(child.pathKey);

      if (!childPosition) {
        return;
      }

      edges.push({
        id: `${node.pathKey}-${child.pathKey}`,
        fromX: positioned.centerX,
        fromY: positioned.bottomY,
        toX: childPosition.centerX,
        toY: childPosition.y,
        kind: "branch",
      });
    });
  }

  const fullWidth = subtreeWidth(root);
  placeNode(root, CANVAS_PADDING_X, 0);

  return {
    width: fullWidth + CANVAS_PADDING_X * 2,
    height: maxBottom + CANVAS_PADDING_Y * 2,
    nodes,
    edges,
  };
}

function edgePath(edge: LayoutEdge) {
  const middleY = (edge.fromY + edge.toY) / 2;
  return `M ${edge.fromX} ${edge.fromY} V ${middleY} H ${edge.toX} V ${edge.toY}`;
}

export default function DependenciesPage({
  modelId,
  premises,
}: DependenciesPageProps) {
  const defaultRootPremiseId = useMemo(() => {
    const formulaPremise = premises.find(
      (premise) => premise.prediction_base.method === "formula_placeholder",
    );

    return formulaPremise?.id || premises[0]?.id || "";
  }, [premises]);
  const [rootPremiseId, setRootPremiseId] = useState(defaultRootPremiseId);
  const [tree, setTree] = useState<DependencyTreeResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(
    {},
  );
  const [hiddenOutputs, setHiddenOutputs] = useState<Record<string, boolean>>(
    {},
  );
  const [selectedPathKey, setSelectedPathKey] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pendingCenterPath, setPendingCenterPath] = useState<string | null>(
    null,
  );
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const hasInitialCenterRef = useRef(false);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null>(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const premisesById = useMemo(
    () => new Map(premises.map((premise) => [premise.id, premise])),
    [premises],
  );

  useEffect(() => {
    setRootPremiseId(defaultRootPremiseId);
  }, [defaultRootPremiseId]);

  useEffect(() => {
    if (!rootPremiseId) {
      return;
    }

    let mounted = true;

    async function loadTree() {
      setPending(true);
      setErrorMessage(null);

      try {
        const nextTree = await getModelDependenciesTree(modelId, rootPremiseId);

        if (!mounted) {
          return;
        }

        setTree(nextTree);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo cargar el arbol de dependencias.",
        );
        setTree(null);
      } finally {
        if (mounted) {
          setPending(false);
        }
      }
    }

    void loadTree();

    return () => {
      mounted = false;
    };
  }, [modelId, rootPremiseId]);

  const renderRoot = useMemo(() => {
    if (!tree) {
      return null;
    }

    return buildRenderTree(tree, premisesById);
  }, [premisesById, tree]);

  const layout = useMemo(() => {
    if (!renderRoot) {
      return null;
    }

    return computeTreeLayout(renderRoot, expandedNodes, hiddenOutputs);
  }, [expandedNodes, hiddenOutputs, renderRoot]);

  const selectedNode = useMemo(() => {
    if (!renderRoot || !selectedPathKey) {
      return renderRoot;
    }

    return findNodeByPath(renderRoot, selectedPathKey) || renderRoot;
  }, [renderRoot, selectedPathKey]);

  useEffect(() => {
    if (!renderRoot) {
      setSelectedPathKey(null);
      return;
    }

    setExpandedNodes({});
    setHiddenOutputs({});
    setSelectedPathKey(renderRoot.pathKey);
    setSearchNotice(null);
    setZoom(1);
    hasInitialCenterRef.current = false;
    setPendingCenterPath(renderRoot.pathKey);
  }, [renderRoot]);

  function centerPathInViewport(
    pathKey: string,
    behavior: ScrollBehavior,
  ): boolean {
    const viewport = viewportRef.current;

    if (!viewport || !layout) {
      return false;
    }

    const positioned = layout.nodes.find(
      (node) => node.node.pathKey === pathKey,
    );

    if (!positioned) {
      return false;
    }

    const nodeCenterX = (positioned.x + MAIN_CARD_WIDTH / 2) * zoom;
    const nodeCenterY = (positioned.y + MAIN_CARD_HEIGHT / 2) * zoom;
    const maxLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const nextLeft = Math.min(
      maxLeft,
      Math.max(0, nodeCenterX - viewport.clientWidth / 2),
    );
    const nextTop = Math.min(
      maxTop,
      Math.max(0, nodeCenterY - viewport.clientHeight / 2),
    );

    if (typeof viewport.scrollTo === "function") {
      viewport.scrollTo({
        left: nextLeft,
        top: nextTop,
        behavior,
      });
    } else {
      viewport.scrollLeft = nextLeft;
      viewport.scrollTop = nextTop;
    }

    return true;
  }

  useEffect(() => {
    if (!pendingCenterPath) {
      return;
    }

    const didCenter = centerPathInViewport(
      pendingCenterPath,
      hasInitialCenterRef.current ? "smooth" : "auto",
    );

    if (!didCenter) {
      return;
    }

    hasInitialCenterRef.current = true;
    setPendingCenterPath(null);
  }, [layout, pendingCenterPath, zoom]);

  useEffect(() => {
    function handleDocumentWheel(event: WheelEvent) {
      const viewport = viewportRef.current;

      if (!viewport) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Node) || !viewport.contains(target)) {
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
      }
    }

    document.addEventListener("wheel", handleDocumentWheel, {
      capture: true,
      passive: false,
    });

    return () => {
      document.removeEventListener("wheel", handleDocumentWheel, true);
    };
  }, []);

  function handleToggleNode(pathKey: string) {
    if (!renderRoot) {
      return;
    }

    setExpandedNodes((current) =>
      toggleExpandedState(current, renderRoot, pathKey),
    );
    setSelectedPathKey(pathKey);
    setPendingCenterPath(pathKey);
  }

  function handleToggleOutput(pathKey: string) {
    setHiddenOutputs((current) => ({
      ...current,
      [pathKey]: !current[pathKey],
    }));
  }

  function setNodeRef(pathKey: string, node: HTMLDivElement | null) {
    if (node) {
      nodeRefs.current.set(pathKey, node);
      return;
    }

    nodeRefs.current.delete(pathKey);
  }

  function applyZoom(
    nextZoom: number,
    anchor?: {
      clientX: number;
      clientY: number;
    },
  ) {
    const viewport = viewportRef.current;

    if (!viewport || !layout) {
      return;
    }

    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
    const viewportRect = viewport.getBoundingClientRect();
    const anchorX = anchor
      ? anchor.clientX - viewportRect.left
      : viewport.clientWidth / 2;
    const anchorY = anchor
      ? anchor.clientY - viewportRect.top
      : viewport.clientHeight / 2;
    const contentX = (viewport.scrollLeft + anchorX) / zoom;
    const contentY = (viewport.scrollTop + anchorY) / zoom;

    setZoom(clampedZoom);

    window.requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(0, contentX * clampedZoom - anchorX);
      viewport.scrollTop = Math.max(0, contentY * clampedZoom - anchorY);
    });
  }

  function handleFitView() {
    const viewport = viewportRef.current;

    if (!viewport || !layout) {
      return;
    }

    const nextZoom = Math.max(
      MIN_ZOOM,
      Math.min(
        MAX_ZOOM,
        (viewport.clientWidth - 48) / layout.width,
        (viewport.clientHeight - 48) / layout.height,
      ),
    );

    applyZoom(nextZoom);
  }

  function handleResetZoom() {
    applyZoom(1);
    setPendingCenterPath(selectedNode?.pathKey || renderRoot?.pathKey || null);
  }

  function handleZoomIn() {
    applyZoom(zoom + 0.14);
  }

  function handleZoomOut() {
    applyZoom(zoom - 0.14);
  }

  function handleViewportPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;

    if (
      target.closest(
        "[data-canvas-card='true'], [data-canvas-control='true'], button, input, select, textarea, label",
      )
    ) {
      return;
    }

    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: viewport.scrollLeft,
      startScrollTop: viewport.scrollTop,
    };
    setIsDraggingCanvas(true);
    viewport.setPointerCapture(event.pointerId);
  }

  function handleViewportPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    const dragState = dragStateRef.current;

    if (!viewport || !dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    viewport.scrollLeft =
      dragState.startScrollLeft - (event.clientX - dragState.startX);
    viewport.scrollTop =
      dragState.startScrollTop - (event.clientY - dragState.startY);
  }

  function handleViewportPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    setIsDraggingCanvas(false);

    if (viewport?.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
  }

  function handleViewportWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    const nextZoom = zoom + (event.deltaY < 0 ? 0.08 : -0.08);
    applyZoom(nextZoom, {
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }

  function handleOpenSelectedBranch() {
    if (!renderRoot || !selectedNode || selectedNode.children.length === 0) {
      return;
    }

    setExpandedNodes((current) =>
      toggleExpandedState(current, renderRoot, selectedNode.pathKey),
    );
    setPendingCenterPath(selectedNode.pathKey);
  }

  function handleSearch() {
    if (!renderRoot) {
      return;
    }

    const normalized = normalizeText(searchValue.trim());

    if (!normalized) {
      setSearchNotice(null);
      setSelectedPathKey(renderRoot.pathKey);
      setPendingCenterPath(renderRoot.pathKey);
      return;
    }

    const match = findFirstSearchMatch(renderRoot, normalized);

    if (!match) {
      setSearchNotice("No encontre una premisa que coincida con esa busqueda.");
      return;
    }

    setExpandedNodes(expandAncestors(renderRoot, match.pathKey));
    setSelectedPathKey(match.pathKey);
    setSearchNotice(null);
    setPendingCenterPath(match.pathKey);
  }

  const sourceTotals = useMemo(() => {
    return premises.reduce(
      (accumulator, premise) => {
        accumulator[premise.source] += 1;
        return accumulator;
      },
      {
        local: 0,
        library: 0,
        model_output: 0,
      } as Record<PremiseSource, number>,
    );
  }, [premises]);

  return (
    <section className="panel-surface rounded-[28px] p-4 sm:p-5">
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="rounded-[24px] bg-white p-4">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Arbol de premisas
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--foreground-muted)]">
            Arrastra el lienzo para moverte. Usa la rueda para zoom, o los
            botones + y -.
          </p>

          <div className="mt-4">
            <Select
              label="Premisa raiz"
              value={rootPremiseId}
              onChange={(event) => setRootPremiseId(event.target.value)}
            >
              {premises.map((premise) => (
                <option key={premise.id} value={premise.id}>
                  {premise.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-5 rounded-[20px] bg-[var(--surface-muted)] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
              Resumen del modelo
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="neutral">{sourceTotals.local} locales</Badge>
              <Badge tone="accent">{sourceTotals.library} biblioteca</Badge>
              <Badge tone="warning">
                {sourceTotals.model_output} importadas
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
              Las premisas importadas muestran un nodo lateral punteado con el
              output origen. Las dependencias transitivas externas quedan en
              neutro si el backend no trae su fuente exacta.
            </p>
          </div>

          <h3 className="mt-5 text-sm font-semibold text-[var(--foreground)]">
            Dependencias unicas
          </h3>
          <div className="mt-2 space-y-2 h-[20rem] overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--border)] scrollbar-track-transparent pr-1 grid-scrollbar">
            {tree?.unique_dependencies.map((dependency) => (
              <div
                key={dependency.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5"
              >
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {dependency.name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge tone={typeBadgeTone(dependency.type)}>
                    {typeLabel(dependency.type)}
                  </Badge>
                  {dependency.model_name ? (
                    <span className="text-xs text-[var(--foreground-muted)]">
                      {dependency.model_name}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="rounded-[24px] border border-[var(--border)] bg-white p-3">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] px-1 pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-[var(--foreground)]">
                  Buscar en el arbol
                </span>
                <input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSearch();
                    }
                  }}
                  className="h-11 rounded-2xl border border-[var(--border)] bg-white px-3.5 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                  placeholder="Gasolina, ingreso, output, modelo..."
                />
              </label>
              <p className="mt-2 text-xs leading-5 text-[var(--foreground-muted)]">
                Arrastra el lienzo para moverte. Usa la rueda para zoom, o los
                botones + y -.
              </p>
            </div>

            <div className="flex flex-wrap gap-2" data-canvas-control="true">
              <Button variant="secondary" onClick={handleSearch}>
                Buscar
              </Button>
              <Button
                variant="secondary"
                onClick={handleOpenSelectedBranch}
                disabled={!selectedNode || selectedNode.children.length === 0}
              >
                Abrir seleccion
              </Button>
              <Button variant="ghost" onClick={handleFitView}>
                Ajustar vista
              </Button>
              <Button variant="ghost" onClick={handleZoomOut}>
                -
              </Button>
              <Button variant="ghost" onClick={handleZoomIn}>
                +
              </Button>
              <Button variant="ghost" onClick={handleResetZoom}>
                Reset zoom
              </Button>
            </div>
          </div>

          {searchNotice ? (
            <div className="mt-3 rounded-2xl bg-[rgba(217,119,6,0.12)] px-4 py-3 text-sm text-[var(--warning)]">
              {searchNotice}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-3 rounded-2xl bg-[rgba(209,67,67,0.1)] px-4 py-3 text-sm text-[var(--danger)]">
              {errorMessage}
            </div>
          ) : null}

          {pending ? (
            <div className="mt-3 h-[720px] animate-pulse rounded-[22px] bg-[var(--surface-muted)]" />
          ) : null}

          {!pending && layout && renderRoot ? (
            <div
              ref={viewportRef}
              className={`grid-scrollbar mt-3 h-[720px] overflow-auto overscroll-contain rounded-[22px] border border-[var(--border)] touch-none select-none ${isDraggingCanvas ? "cursor-grabbing" : "cursor-grab"}`}
              style={{
                backgroundImage:
                  "linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px)",
                backgroundSize: "34px 34px",
                backgroundColor: "rgba(248,250,253,0.92)",
              }}
              onPointerDown={handleViewportPointerDown}
              onPointerMove={handleViewportPointerMove}
              onPointerUp={handleViewportPointerEnd}
              onPointerCancel={handleViewportPointerEnd}
              onPointerLeave={handleViewportPointerEnd}
              onWheel={handleViewportWheel}
            >
              <div
                style={{
                  width: layout.width * zoom,
                  height: layout.height * zoom,
                  minWidth: "100%",
                }}
              >
                <div
                  className="relative"
                  style={{
                    width: layout.width,
                    height: layout.height,
                    transform: `scale(${zoom})`,
                    transformOrigin: "top left",
                  }}
                >
                  <svg
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    width={layout.width}
                    height={layout.height}
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                  >
                    {layout.edges.map((edge) => (
                      <path
                        key={edge.id}
                        d={edgePath(edge)}
                        fill="none"
                        stroke={
                          edge.kind === "output"
                            ? "rgba(100,116,139,0.9)"
                            : "rgba(20,89,199,0.42)"
                        }
                        strokeDasharray={
                          edge.kind === "output" ? "7 5" : undefined
                        }
                        strokeWidth={edge.kind === "output" ? 1.4 : 1.8}
                      />
                    ))}
                  </svg>

                  {layout.nodes.map((positioned) => {
                    const isSelected =
                      selectedNode?.pathKey === positioned.node.pathKey;
                    const isExpanded = !!expandedNodes[positioned.node.pathKey];
                    const outputHidden =
                      !!hiddenOutputs[positioned.node.pathKey];

                    return (
                      <div key={positioned.node.pathKey}>
                        <div
                          ref={(node) =>
                            setNodeRef(positioned.node.pathKey, node)
                          }
                          data-node-id={positioned.node.premiseId}
                          data-origin={positioned.node.displaySource}
                          data-canvas-card="true"
                          className={`absolute rounded-[24px] border shadow-[0_16px_36px_rgba(15,23,42,0.08)] transition ${sourceCardClasses(positioned.node.displaySource)} ${isSelected ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-transparent" : ""}`}
                          style={{
                            left: positioned.x,
                            top: positioned.y,
                            width: MAIN_CARD_WIDTH,
                            height: MAIN_CARD_HEIGHT,
                          }}
                          onClick={() =>
                            setSelectedPathKey(positioned.node.pathKey)
                          }
                          onDoubleClick={() =>
                            handleToggleNode(positioned.node.pathKey)
                          }
                        >
                          <div className="flex h-full flex-col justify-between gap-4 p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="break-words text-[15px] font-semibold leading-5 text-[var(--foreground)]">
                                  {positioned.node.premiseName}
                                </p>
                                <p className="mt-2 break-all text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                                  {positioned.node.premiseId}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <Badge
                                  tone={sourceTone(
                                    positioned.node.displaySource,
                                  )}
                                >
                                  {positioned.node.displaySourceLabel}
                                </Badge>
                                {positioned.node.children.length > 0 ? (
                                  <button
                                    type="button"
                                    aria-label={`Alternar ${positioned.node.premiseName}`}
                                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white text-lg font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleToggleNode(positioned.node.pathKey);
                                    }}
                                  >
                                    {isExpanded ? "−" : "+"}
                                  </button>
                                ) : null}
                              </div>
                            </div>

                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge tone="neutral">
                                  {positioned.node.children.length} relaciones
                                  hijas
                                </Badge>
                                {positioned.node.outputChip ? (
                                  <Badge tone="warning">Origen importado</Badge>
                                ) : null}
                              </div>

                              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                                  Doble click para abrir/cerrar
                                </span>
                                {positioned.node.outputChip ? (
                                  <button
                                    type="button"
                                    aria-label={`Alternar origen ${positioned.node.premiseName}`}
                                    className="ml-auto inline-flex h-7 shrink-0 items-center rounded-full border border-[var(--border)] bg-white px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleToggleOutput(
                                        positioned.node.pathKey,
                                      );
                                    }}
                                  >
                                    {outputHidden ? "Mostrar" : "Ocultar"}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>

                        {positioned.node.outputChip &&
                        !outputHidden &&
                        positioned.outputX !== null &&
                        positioned.outputY !== null ? (
                          <div
                            data-output-chip-id={positioned.node.outputChip.id}
                            className="absolute rounded-[22px] border border-dashed border-[rgba(100,116,139,0.55)] bg-[rgba(255,255,255,0.92)] p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
                            style={{
                              left: positioned.outputX,
                              top: positioned.outputY,
                              width: OUTPUT_CARD_WIDTH,
                              height: OUTPUT_CARD_HEIGHT,
                            }}
                          >
                            <p className="break-words text-sm font-semibold leading-5 text-[var(--foreground)]">
                              {positioned.node.outputChip.name}
                            </p>
                            <p className="mt-2 break-words text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                              {positioned.node.outputChip.modelName ||
                                positioned.node.outputChip.modelId ||
                                "Modelo origen"}
                            </p>
                            <p className="mt-2 text-xs text-[var(--foreground-muted)]">
                              Output importado
                            </p>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="rounded-[24px] border border-[var(--border)] bg-white p-4">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Detalle del nodo
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--foreground-muted)]">
            Click selecciona. Doble click o el boton redondo abren y cierran la
            rama.
          </p>

          {selectedNode ? (
            <div className="mt-4 rounded-[22px] bg-[var(--surface-muted)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={sourceTone(selectedNode.displaySource)}>
                  {selectedNode.displaySourceLabel}
                </Badge>
                {selectedNode.modelName ? (
                  <Badge tone="neutral">{selectedNode.modelName}</Badge>
                ) : null}
              </div>

              <h3 className="mt-3 text-xl font-semibold text-[var(--foreground)]">
                {selectedNode.premiseName}
              </h3>
              <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                {selectedNode.premiseId}
              </p>

              <div className="mt-4 grid gap-3 text-sm text-[var(--foreground-muted)]">
                <div className="rounded-2xl border border-[var(--border)] bg-white px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                    Tipo visible
                  </p>
                  <p className="mt-1 font-medium text-[var(--foreground)]">
                    {selectedNode.displaySourceLabel}
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-white px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                    Relaciones inmediatas
                  </p>
                  <p className="mt-1 font-medium text-[var(--foreground)]">
                    {selectedNode.children.length} premisas hijas
                  </p>
                  {selectedNode.children.length > 0 ? (
                    <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                      {selectedNode.children
                        .map((child) => child.premiseName)
                        .join(", ")}
                    </p>
                  ) : null}
                </div>

                {selectedNode.outputChip ? (
                  <div className="rounded-2xl border border-dashed border-[rgba(100,116,139,0.45)] bg-white px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                      Origen importado
                    </p>
                    <p className="mt-1 font-medium text-[var(--foreground)]">
                      {selectedNode.outputChip.name}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                      {selectedNode.outputChip.modelName ||
                        selectedNode.outputChip.modelId ||
                        "Modelo externo"}
                    </p>
                    {selectedNode.sourceOutputId ? (
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                        output id {selectedNode.sourceOutputId}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[22px] bg-[var(--surface-muted)] px-4 py-5 text-sm text-[var(--foreground-muted)]">
              Selecciona una premisa para inspeccionar su detalle.
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
