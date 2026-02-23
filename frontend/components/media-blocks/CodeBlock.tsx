'use client';

import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Copy, FileCode } from 'lucide-react';
import type { CodeBlockData } from '@/types/media';

interface CodeBlockProps {
  data: CodeBlockData;
}

export default function CodeBlock({ data }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  return (
    <Card className="overflow-hidden my-4 border border-gray-700 bg-[#22252F]">
      {/* Header with filename and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1d26] border-b border-gray-700">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <FileCode className="w-4 h-4" />
          {data.filename ? (
            <span className="font-mono">{data.filename}</span>
          ) : (
            <span className="text-gray-400">{data.language || 'code'}</span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-8 px-2 text-gray-300 hover:text-white hover:bg-gray-700"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-1" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-1" />
              Copy
            </>
          )}
        </Button>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={data.language || 'text'}
          style={vscDarkPlus}
          showLineNumbers={data.lineNumbers !== false}
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: '#22252F',
            fontSize: '0.875rem',
            lineHeight: '1.5'
          }}
          codeTagProps={{
            style: {
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
            }
          }}
        >
          {data.code}
        </SyntaxHighlighter>
      </div>
    </Card>
  );
}
