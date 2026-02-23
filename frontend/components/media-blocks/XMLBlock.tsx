'use client';

import React from 'react';
import { Code2 } from 'lucide-react';
import BlockContainer from '../blocks/BlockContainer';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface XMLBlockData {
  data: string;
  collapsed?: boolean;
}

interface XMLBlockProps {
  data: XMLBlockData;
  focused?: boolean;
  onClick?: () => void;
}

export default function XMLBlock({ data, focused, onClick }: XMLBlockProps) {
  const header = (
    <div className="flex items-center gap-2 w-full">
      <Code2 className="w-3.5 h-3.5 text-[#00d9ff]" />
      <span className="text-[11px] text-gray-400">XML</span>
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
          language="xml"
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
