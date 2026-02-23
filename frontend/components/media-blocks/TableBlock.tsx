'use client';

import React from 'react';
import { Table as TableIcon } from 'lucide-react';
import BlockContainer from '../blocks/BlockContainer';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface TableBlockData {
  headers: string[];
  rows: string[][];
  caption?: string;
}

interface TableBlockProps {
  data: TableBlockData;
  focused?: boolean;
  onClick?: () => void;
}

export default function TableBlock({ data, focused, onClick }: TableBlockProps) {
  const header = (
    <div className="flex items-center gap-2 w-full">
      <TableIcon className="w-3.5 h-3.5 text-[#00d9ff]" />
      <span className="text-[11px] text-gray-400">Table</span>
      {data.caption && (
        <span className="text-[11px] text-gray-500 truncate flex-1">
          {data.caption}
        </span>
      )}
    </div>
  );

  return (
    <BlockContainer
      type="table"
      header={header}
      focused={focused}
      onClick={onClick}
    >
      <ScrollArea className="w-full max-h-96">
        <div className="min-w-full">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[#101218]/30 hover:bg-transparent">
                {data.headers.map((header, index) => (
                  <TableHead
                    key={index}
                    className="font-bold text-[11px] text-gray-300 bg-[#0a0a0a] h-8"
                  >
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  className={`border-b border-[#101218]/30 hover:bg-[#0a0a0a]/50 ${
                    rowIndex % 2 === 0 ? 'bg-transparent' : 'bg-[#0a0a0a]/30'
                  }`}
                >
                  {row.map((cell, cellIndex) => (
                    <TableCell
                      key={cellIndex}
                      className="text-[11px] text-gray-400 py-2"
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>
    </BlockContainer>
  );
}
