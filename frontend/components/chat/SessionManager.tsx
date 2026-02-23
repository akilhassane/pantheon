'use client';

import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown, X, Edit2, Check, Clock } from 'lucide-react';

interface Session {
  id: string;
  name: string;
  createdAt: Date;
  lastActive: Date;
  messageCount: number;
}

interface SessionManagerProps {
  sessions: Session[];
  activeSessionId: string | null;
  onCreateSession: () => void;
  onSwitchSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newName: string) => void;
}

export default function SessionManager({
  sessions,
  activeSessionId,
  onCreateSession,
  onSwitchSession,
  onDeleteSession,
  onRenameSession
}: SessionManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const handleRename = (sessionId: string) => {
    if (editName.trim()) {
      onRenameSession(sessionId, editName.trim());
      setEditingSessionId(null);
      setEditName('');
    }
  };

  const startEdit = (session: Session) => {
    setEditingSessionId(session.id);
    setEditName(session.name);
  };

  const handleDelete = (sessionId: string) => {
    if (deleteConfirmId === sessionId) {
      onDeleteSession(sessionId);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(sessionId);
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="relative">
      {/* Session Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <span className="max-w-[200px] truncate">
          {activeSession?.name || 'Select Session'}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[500px] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Sessions</h3>
              <button
                onClick={() => {
                  onCreateSession();
                  setIsOpen(false);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto">
              {sessions.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  <p>No sessions yet</p>
                  <p className="text-xs mt-1">Create one to get started</p>
                </div>
              ) : (
                <div className="p-2">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`group relative rounded-lg mb-1 transition-colors ${
                        session.id === activeSessionId
                          ? 'bg-blue-50 border border-blue-200'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      {editingSessionId === session.id ? (
                        /* Edit Mode */
                        <div className="p-3 flex items-center gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRename(session.id);
                              if (e.key === 'Escape') setEditingSessionId(null);
                            }}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleRename(session.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingSessionId(null)}
                            className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        /* Normal Mode */
                        <div
                          onClick={() => {
                            onSwitchSession(session.id);
                            setIsOpen(false);
                          }}
                          className="p-3 cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-900 truncate">
                                {session.name}
                              </h4>
                              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatRelativeTime(session.lastActive)}
                                </span>
                                <span>{session.messageCount} messages</span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(session);
                                }}
                                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="Rename"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(session.id);
                                }}
                                className={`p-1 rounded transition-colors ${
                                  deleteConfirmId === session.id
                                    ? 'text-red-600 bg-red-50'
                                    : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                }`}
                                title={deleteConfirmId === session.id ? 'Click again to confirm' : 'Delete'}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Active Indicator */}
                          {session.id === activeSessionId && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r" />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
              <div className="flex items-center justify-between">
                <span>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
                <span className="text-gray-400">Double-click to rename</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
