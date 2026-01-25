'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';
import ImageBlock from './ImageBlock';
import TableBlock from './TableBlock';
import MermaidBlock from './MermaidBlock';
import AudioBlock from './AudioBlock';
import VideoBlock from './VideoBlock';
import FileBlock from './FileBlock';
import JSONBlock from './JSONBlock';
import YAMLBlock from './YAMLBlock';
import XMLBlock from './XMLBlock';
import ChartBlock from './ChartBlock';
import NetworkDiagramBlock from './NetworkDiagramBlock';
import PDFBlock from './PDFBlock';
import SpreadsheetBlock from './SpreadsheetBlock';
import MapBlock from './MapBlock';
import CommandOutputBlock from '../blocks/CommandOutputBlock';
import ErrorBlock from '../blocks/ErrorBlock';
import DesktopToolBlock from '../blocks/DesktopToolBlock';
import ThinkingBlock from '../blocks/ThinkingBlock';

// Custom markdown components with inline styles
const markdownComponents = {
  p: ({ children }: any) => <p style={{ marginBottom: '0.5rem' }}>{children}</p>,
  h1: ({ children }: any) => <h1 style={{ fontSize: '1.5em', fontWeight: 600, marginBottom: '0.5rem', marginTop: '1rem' }}>{children}</h1>,
  h2: ({ children }: any) => <h2 style={{ fontSize: '1.3em', fontWeight: 600, marginBottom: '0.5rem', marginTop: '1rem' }}>{children}</h2>,
  h3: ({ children }: any) => <h3 style={{ fontSize: '1.1em', fontWeight: 600, marginBottom: '0.5rem', marginTop: '0.75rem' }}>{children}</h3>,
  h4: ({ children }: any) => <h4 style={{ fontSize: '1em', fontWeight: 600, marginBottom: '0.25rem', marginTop: '0.75rem' }}>{children}</h4>,
  h5: ({ children }: any) => <h5 style={{ fontSize: '1em', fontWeight: 600, marginBottom: '0.25rem', marginTop: '0.75rem' }}>{children}</h5>,
  h6: ({ children }: any) => <h6 style={{ fontSize: '1em', fontWeight: 600, marginBottom: '0.25rem', marginTop: '0.75rem' }}>{children}</h6>,
  ul: ({ children }: any) => <ul style={{ listStyleType: 'disc', listStylePosition: 'outside', marginBottom: '0.75rem', paddingLeft: '1.25rem', marginTop: '0.5rem' }}>{children}</ul>,
  ol: ({ children }: any) => <ol style={{ listStyleType: 'decimal', listStylePosition: 'outside', marginBottom: '0.75rem', paddingLeft: '1.25rem', marginTop: '0.5rem' }}>{children}</ol>,
  li: ({ children }: any) => <li style={{ marginBottom: '0.375rem', lineHeight: '1.6' }}>{children}</li>,
  strong: ({ children }: any) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
  em: ({ children }: any) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
  a: ({ href, children }: any) => <a href={href} style={{ color: '#60a5fa', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer">{children}</a>,
  blockquote: ({ children }: any) => <blockquote style={{ borderLeft: '3px solid #4b5563', paddingLeft: '1rem', fontStyle: 'italic', marginTop: '0.5rem', marginBottom: '0.5rem', color: '#9ca3af' }}>{children}</blockquote>,
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid #374151', marginTop: '1rem', marginBottom: '1rem' }} />,
  code: ({ inline, className, children }: any) => {
    // AGGRESSIVE CLEANING: Remove ALL backticks from code content
    let cleanChildren = children;
    if (children) {
      if (typeof children === 'string') {
        cleanChildren = children.replace(/[`´'']/g, '');
      } else if (Array.isArray(children)) {
        cleanChildren = children.map(child => 
          typeof child === 'string' ? child.replace(/[`´'']/g, '') : child
        );
      }
    }
    
    // Determine if this should be inline based on multiple factors
    const hasLanguageClass = className && className.startsWith('language-');
    const isMultiline = typeof children === 'string' && children.includes('\n');
    const shouldBeInline = !hasLanguageClass && !isMultiline;
    
    if (shouldBeInline) {
      // Use inline styles directly - they have highest specificity
      return (
        <code 
          style={{
            display: 'inline',
            background: 'rgba(100, 116, 139, 0.15)',
            padding: '1px 3px',
            borderRadius: '2px',
            fontSize: '0.88em',
            fontFamily: 'monospace',
            fontWeight: 400,
            whiteSpace: 'nowrap',
            margin: 0,
            lineHeight: 'inherit',
            verticalAlign: 'baseline'
          }}
        >{cleanChildren}</code>
      );
    } else {
      return (
        <code 
          style={{ 
            display: 'block', 
            backgroundColor: '#22252F', 
            padding: '0.5rem', 
            borderRadius: '0.25rem', 
            fontSize: '0.875em', 
            fontFamily: 'monospace', 
            overflowX: 'auto' 
          }}
        >{cleanChildren}</code>
      );
    }
  },
};

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
  | 'error'
  | 'desktop-tool'
  | 'thinking'
  | 'text';

export interface MediaBlock {
  id: string;
  type: MediaBlockType;
  data: any;
  timestamp: Date;
  position?: number;
}

interface MediaBlockManagerProps {
  blocks: MediaBlock[];
  focused?: string;
  onBlockClick?: (blockId: string) => void;
}

export default function MediaBlockManager({ 
  blocks, 
  focused, 
  onBlockClick 
}: MediaBlockManagerProps) {
  // Deduplicate blocks by ID to prevent rendering the same block twice
  const uniqueBlocks = React.useMemo(() => {
    const seen = new Set<string>();
    return blocks.filter(block => {
      if (seen.has(block.id)) {
        return false;
      }
      seen.add(block.id);
      return true;
    });
  }, [blocks]);
  
  const renderBlock = React.useCallback((block: MediaBlock) => {
    const isFocused = focused === block.id;
    const handleClick = () => onBlockClick?.(block.id);

    const commonProps = {
      data: block.data,
      focused: isFocused,
      onClick: handleClick,
    };

    switch (block.type) {
      case 'code':
        return (
          <CodeBlock
            code={block.data.code}
            language={block.data.language}
            filename={block.data.filename}
            startLine={block.data.startLine}
            focused={isFocused}
            onClick={handleClick}
          />
        );
      case 'image':
        return (
          <ImageBlock
            url={block.data.url}
            alt={block.data.alt}
            width={block.data.width}
            height={block.data.height}
            focused={isFocused}
            onClick={handleClick}
          />
        );
      case 'table':
        return <TableBlock {...commonProps} />;
      case 'mermaid':
        return (
          <MermaidBlock
            code={block.data.code}
            diagramType={block.data.diagramType}
            renderError={block.data.renderError}
            focused={isFocused}
            onClick={handleClick}
          />
        );
      case 'audio':
        return <AudioBlock {...commonProps} />;
      case 'video':
        return <VideoBlock {...commonProps} />;
      case 'file':
        return (
          <FileBlock
            path={block.data.path}
            content={block.data.content}
            language={block.data.language}
            operation={block.data.operation}
            modified={block.data.modified}
            focused={isFocused}
            onClick={handleClick}
          />
        );
      case 'command':
        return (
          <CommandOutputBlock
            command={block.data.command}
            output={block.data.output}
            status={block.data.exitCode === 0 ? 'success' : 'error'}
            exitCode={block.data.exitCode}
            focused={isFocused}
            onClick={handleClick}
          />
        );
      case 'json':
        return (
          <JSONBlock
            data={block.data}
            focused={isFocused}
            onClick={handleClick}
          />
        );
      case 'yaml':
        return <YAMLBlock {...commonProps} />;
      case 'xml':
        return <XMLBlock {...commonProps} />;
      case 'chart':
        return (
          <ChartBlock
            data={block.data}
            focused={isFocused}
            onClick={handleClick}
          />
        );
      case 'network-diagram':
        return <NetworkDiagramBlock {...commonProps} />;
      case 'pdf':
        return <PDFBlock {...commonProps} />;
      case 'spreadsheet':
        return <SpreadsheetBlock {...commonProps} />;
      case 'map':
        return <MapBlock {...commonProps} />;
      case 'error':
        return (
          <ErrorBlock
            message={block.data.message}
            type={block.data.type}
            stack={block.data.stack}
            code={block.data.code}
            focused={isFocused}
            onClick={handleClick}
          />
        );
      case 'desktop-tool':
        // Reduced logging - only log on first render or status changes
        // console.log('🎨 MediaBlockManager rendering desktop-tool block:', {
        //   id: block.id,
        //   toolName: block.data.toolName,
        //   hasOutput: !!block.data.output,
        //   outputLength: block.data.output?.length,
        //   status: block.data.status,
        //   duration: block.data.duration
        // });
        return (
          <DesktopToolBlock
            toolName={block.data.toolName}
            args={block.data.args}
            output={block.data.output}
            status={block.data.status}
            duration={block.data.duration}
            focused={isFocused}
            onClick={handleClick}
          />
        );
      case 'thinking':
        return (
          <ThinkingBlock
            steps={block.data.steps}
            collapsed={block.data.collapsed}
            focused={isFocused}
          />
        );
      case 'text':
        // Render plain text block with markdown support
        return (
          <div className="text-[13px] text-gray-300 leading-snug prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {block.data.text}
            </ReactMarkdown>
          </div>
        );
      default:
        return null;
    }
  }, [focused, onBlockClick]);

  return (
    <div className="space-y-4">
      <AnimatePresence mode="popLayout">
        {uniqueBlocks.map((block) => (
          <motion.div
            key={block.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {renderBlock(block)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
