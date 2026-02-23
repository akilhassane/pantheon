'use client';

import React from 'react';
import { Braces } from 'lucide-react';
import BlockContainer from '../blocks/BlockContainer';
import JsonView from '@uiw/react-json-view';
import { darkTheme } from '@uiw/react-json-view/dark';

interface JSONBlockData {
  data: any;
  collapsed?: boolean;
}

interface JSONBlockProps {
  data: JSONBlockData;
  focused?: boolean;
  onClick?: () => void;
}

export default function JSONBlock({ data, focused, onClick }: JSONBlockProps) {
  const header = (
    <div className="flex items-center gap-2 w-full">
      <Braces className="w-3.5 h-3.5 text-[#00d9ff]" />
      <span className="text-[11px] text-gray-400">JSON</span>
    </div>
  );

  // Custom dark theme matching our design
  const customTheme = {
    ...darkTheme,
    '--w-rjv-background-color': '#000000',
    '--w-rjv-border-left-color': '#101218',
    '--w-rjv-color': '#d1d5db',
    '--w-rjv-key-string': '#00d9ff',
    '--w-rjv-type-string-color': '#10b981',
    '--w-rjv-type-int-color': '#f59e0b',
    '--w-rjv-type-float-color': '#f59e0b',
    '--w-rjv-type-bigint-color': '#f59e0b',
    '--w-rjv-type-boolean-color': '#8b5cf6',
    '--w-rjv-type-null-color': '#6b7280',
    '--w-rjv-type-undefined-color': '#6b7280',
    '--w-rjv-font-family': 'ui-monospace, monospace',
    '--w-rjv-font-size': '11px',
    '--w-rjv-line-height': '1.5',
  };

  // Convert JSON to string for copy functionality
  const jsonString = JSON.stringify(data.data, null, 2);

  return (
    <BlockContainer
      type="code"
      header={header}
      copyContent={jsonString}
      focused={focused}
      onClick={onClick}
    >
      <div className="p-3 overflow-x-auto max-h-96 overflow-y-auto">
        <JsonView
          value={data.data}
          collapsed={data.collapsed ? 1 : false}
          style={customTheme}
          displayDataTypes={false}
          enableClipboard={false}
        />
      </div>
    </BlockContainer>
  );
}
