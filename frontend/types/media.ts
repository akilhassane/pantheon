// Media Block Type Definitions

export type MediaBlockType = 
  | 'code' 
  | 'image' 
  | 'table' 
  | 'mermaid' 
  | 'audio' 
  | 'video' 
  | 'file'
  | 'command'
  | 'json'
  | 'yaml'
  | 'xml'
  | 'chart'
  | 'network-diagram'
  | 'pdf'
  | 'spreadsheet'
  | 'map'
  | 'text'
  | 'desktop-tool'
  | 'error'
  | 'thinking';

export interface MediaBlock {
  id: string;
  type: MediaBlockType;
  data: MediaBlockData;
  timestamp: Date;
  position?: number;
}

export type MediaBlockData =
  | CodeBlockData
  | ImageBlockData
  | TableBlockData
  | MermaidBlockData
  | AudioBlockData
  | VideoBlockData
  | FileBlockData
  | CommandBlockData
  | JSONBlockData
  | YAMLBlockData
  | XMLBlockData
  | ChartBlockData
  | NetworkDiagramBlockData
  | PDFBlockData
  | SpreadsheetBlockData
  | MapBlockData;

export interface CodeBlockData {
  language: string;
  code: string;
  filename?: string;
  lineNumbers?: boolean;
}

export interface ImageBlockData {
  url: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface TableBlockData {
  headers: string[];
  rows: string[][];
  caption?: string;
}

export interface MermaidBlockData {
  code: string;
  diagramType: 'flowchart' | 'sequence' | 'class' | 'state' | 'er' | 'gantt' | 'pie';
}

export interface AudioBlockData {
  url: string;
  title?: string;
  duration?: number;
}

export interface VideoBlockData {
  url: string;
  thumbnail?: string;
  title?: string;
  duration?: number;
}

export interface FileBlockData {
  url: string;
  filename: string;
  size: number;
  type: string;
  icon?: string;
}

export interface CommandBlockData {
  command: string;
  output: string;
  exitCode?: number;
  timestamp?: Date;
}

export interface JSONBlockData {
  data: any;
  collapsed?: boolean;
}

export interface YAMLBlockData {
  data: string;
  collapsed?: boolean;
}

export interface XMLBlockData {
  data: string;
  collapsed?: boolean;
}

export interface ChartBlockData {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'radar';
  data: any[];
  xKey?: string;
  yKeys?: string[];
  colors?: string[];
  title?: string;
}

export interface NetworkDiagramBlockData {
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

export interface PDFBlockData {
  url: string;
  filename?: string;
  pageCount?: number;
}

export interface SpreadsheetBlockData {
  headers: string[];
  rows: (string | number)[][];
  sortable?: boolean;
  filterable?: boolean;
}

export interface MapBlockData {
  center: { lat: number; lng: number };
  zoom?: number;
  markers: {
    position: { lat: number; lng: number };
    label: string;
    popup?: string;
  }[];
  routes?: {
    from: { lat: number; lng: number };
    to: { lat: number; lng: number };
  }[];
}

// Streaming event types
export interface MediaBlockEvent {
  type: 'media-block';
  mediaType: MediaBlockType;
  data: MediaBlockData;
}

export interface TextDeltaEvent {
  type: 'text-delta';
  textDelta: string;
}

export type StreamEvent = MediaBlockEvent | TextDeltaEvent;
