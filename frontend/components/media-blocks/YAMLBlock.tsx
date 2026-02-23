'use client';

import React from 'react';
import { FileCode } from 'lucide-react';
import BlockContainer from '../blocks/BlockContainer';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface YAMLBlockData {
  data: string;
  collapsed?: boolean;
}

interface YAMLBlockProps {
  data: YAMLBlockData;
  focused?: boolean;
  onClick?: () => void;
}

export default function YAMLBlock({ data, focused, onClick }: YAMLBlockProps) {
  const header = (
    <div className="flex items-center gap-2 w-full">
      <FileCode className="w-3.5 h-3.5 text-[#00d9ff]" />
      <span className="text-[11px] text-gray-400">YAML</span>
    </div>
  );

  // Custom dark theme matching our design
  const customStyle = {
    ...vscDarkPlus,
    'pre[class*="language-"]': {
      ...vscDarkPlus['pre[class*="language-"]'],
      background: 'transparent',
      margin: 0,
      padding: '12px',
      fontSize: '11px',
      lineHeight: '1.5',
    },
    'code[class*="language-"]': {
      ...vscDarkPlus['code[class*="language-"]'],
      background: 'transparent',
      fontSize: '11px',
      lineHeight: '1.5',
      fontFamily: 'ui-monospace, monospace',
    },
  };

  return (
    <BlockContainer
      type="code"
      header={header}
      copyContent={data.data}
      collapsible={data.collapsed}
      focused={focused}
      onClick={onClick}
    >
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language="yaml"
          style={customStyle}
          customStyle={{
            background: 'transparent',
            margin: 0,
            padding: '12px',
          }}
        >
          {data.data}
        </SyntaxHighlighter>
      </div>
    </BlockContainer>
  );
}
