'use client';

import React, { useState } from 'react';
import { Sheet, ArrowUpDown } from 'lucide-react';
import BlockContainer from '../blocks/BlockContainer';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SpreadsheetBlockData {
  headers: string[];
  rows: (string | number)[][];
  sortable?: boolean;
  filterable?: boolean;
}

interface SpreadsheetBlockProps {
  data: SpreadsheetBlockData;
  focused?: boolean;
  onClick?: () => void;
}

export default function SpreadsheetBlock({ data, focused, onClick }: SpreadsheetBlockProps) {
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [sortedRows, setSortedRows] = useState(data.rows);

  const handleSort = (columnIndex: number) => {
    if (!data.sortable) return;

    const newDirection = sortColumn === columnIndex && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(columnIndex);
    setSortDirection(newDirection);

    const sorted = [...data.rows].sort((a, b) => {
      const aVal = a[columnIndex];
      const bVal = b[columnIndex];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return newDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return newDirection === 'asc' 
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

    setSortedRows(sorted);
  };

  const header = (
    <div className="flex items-center gap-2 w-full">
      <Sheet className="w-3.5 h-3.5 text-[#00d9ff]" />
      <span className="text-[11px] text-gray-400">Spreadsheet</span>
      <span className="text-[10px] text-gray-600">
        {data.rows.length} rows × {data.headers.length} columns
      </span>
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
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#101218]/30">
                {data.headers.map((header, index) => (
                  <th
                    key={index}
                    onClick={() => handleSort(index)}
                    className={`
                      text-left px-3 py-2 bg-[#0a0a0a] text-[11px] font-bold text-gray-300
                      ${data.sortable ? 'cursor-pointer hover:bg-[#101218]/50' : ''}
                    `}
                  >
                    <div className="flex items-center gap-1">
                      {header}
                      {data.sortable && (
                        <ArrowUpDown className={`w-3 h-3 ${sortColumn === index ? 'text-[#00d9ff]' : 'text-gray-600'}`} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={`
                    border-b border-[#101218]/30 hover:bg-[#0a0a0a]/50 transition-colors
                    ${rowIndex % 2 === 0 ? 'bg-transparent' : 'bg-[#0a0a0a]/30'}
                  `}
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="px-3 py-2 text-[11px] text-gray-400"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </BlockContainer>
  );
}
