'use client';

import React, { useState } from 'react';
import { Terminal, Clock, CheckCircle, XCircle, Search, Download } from 'lucide-react';

interface CommandEntry {
  command: string;
  output: string;
  exitCode: number;
  timestamp: Date;
  duration?: number;
}

interface CommandHistoryProps {
  commands: CommandEntry[];
  onExport?: () => void;
}

export default function CommandHistory({ commands, onExport }: CommandHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCommand, setSelectedCommand] = useState<number | null>(null);

  const filteredCommands = commands.filter(cmd =>
    cmd.command.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cmd.output.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Command History
          </h2>
          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search commands..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Command List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredCommands.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Terminal className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              {searchTerm ? 'No commands found' : 'No commands executed yet'}
            </p>
          </div>
        ) : (
          filteredCommands.map((cmd, index) => (
            <div
              key={index}
              className={`border rounded-lg transition-all cursor-pointer ${
                selectedCommand === index
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => setSelectedCommand(selectedCommand === index ? null : index)}
            >
              {/* Command Header */}
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {cmd.exitCode === 0 ? (
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      )}
                      <code className="text-sm font-mono text-gray-900 truncate">
                        {cmd.command}
                      </code>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(cmd.timestamp)}
                      </span>
                      <span>Duration: {formatDuration(cmd.duration)}</span>
                      <span>Exit: {cmd.exitCode}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Command Output (Expandable) */}
              {selectedCommand === index && cmd.output && (
                <div className="border-t border-gray-200 bg-gray-900 p-3">
                  <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto max-h-60 overflow-y-auto">
                    {cmd.output}
                  </pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{filteredCommands.length} command{filteredCommands.length !== 1 ? 's' : ''}</span>
          <span>
            {filteredCommands.filter(c => c.exitCode === 0).length} successful
          </span>
        </div>
      </div>
    </div>
  );
}
