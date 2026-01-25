'use client';

/**
 * Supabase Collaboration Hook
 * 
 * Real-time collaboration using Supabase subscriptions
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { CollaboratorAccess } from '@/types/database';

interface CollaborationEvent {
  type: 'user_joined' | 'user_left' | 'message_sent' | 'permission_changed';
  userId: string;
  userName: string;
  timestamp: string;
  data?: any;
}

export function useSupabaseCollaboration(projectId: string) {
  const [collaborators, setCollaborators] = useState<CollaboratorAccess[]>([]);
  const [events, setEvents] = useState<CollaborationEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;

    // Fetch initial collaborators
    const fetchCollaborators = async () => {
      const { data: collaboration } = await supabase
        .from('collaborations')
        .select('id')
        .eq('project_id', projectId)
        .single();

      if (collaboration) {
        const { data } = await supabase
          .from('collaborator_access')
          .select('*')
          .eq('collaboration_id', collaboration.id);

        if (data) {
          setCollaborators(data);
        }
      }
      setLoading(false);
    };

    fetchCollaborators();

    // Subscribe to collaborator_access changes
    const channel = supabase
      .channel(`project:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collaborator_access',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newCollab = payload.new as CollaboratorAccess;
            setCollaborators((prev) => [...prev, newCollab]);
            setEvents((prev) => [
              ...prev,
              {
                type: 'user_joined',
                userId: newCollab.user_id,
                userName: newCollab.user_name || 'Anonymous',
                timestamp: new Date().toISOString(),
              },
            ]);
          } else if (payload.eventType === 'DELETE') {
            const oldCollab = payload.old as CollaboratorAccess;
            setCollaborators((prev) =>
              prev.filter((c) => c.id !== oldCollab.id)
            );
            setEvents((prev) => [
              ...prev,
              {
                type: 'user_left',
                userId: oldCollab.user_id,
                userName: oldCollab.user_name || 'Anonymous',
                timestamp: new Date().toISOString(),
              },
            ]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedCollab = payload.new as CollaboratorAccess;
            setCollaborators((prev) =>
              prev.map((c) => (c.id === updatedCollab.id ? updatedCollab : c))
            );
            setEvents((prev) => [
              ...prev,
              {
                type: 'permission_changed',
                userId: updatedCollab.user_id,
                userName: updatedCollab.user_name || 'Anonymous',
                timestamp: new Date().toISOString(),
                data: { permissions: updatedCollab.permissions },
              },
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [projectId]);

  return { collaborators, events, loading };
}
