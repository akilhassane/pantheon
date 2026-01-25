import { useState, useCallback, useRef } from 'react'

interface ProjectCreationProgress {
  projectId: string
  projectName: string
  step: string
  message: string
  progress: number
  status: 'creating' | 'complete' | 'error'
  error?: string
  project?: any
}

export function useProjectCreation() {
  const [creatingProjects, setCreatingProjects] = useState<Map<string, ProjectCreationProgress>>(new Map())
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map())

  const startProjectCreation = useCallback(async (
    projectName: string,
    os: string,
    userId: string,
    backendUrl: string,
    authHeaders: HeadersInit
  ): Promise<string> => {
    // Generate temporary project ID
    const tempProjectId = `temp-${Date.now()}`
    
    // Initialize progress state
    setCreatingProjects(prev => {
      const next = new Map(prev)
      next.set(tempProjectId, {
        projectId: tempProjectId,
        projectName,
        step: 'init',
        message: 'Initializing project...',
        progress: 0,
        status: 'creating'
      })
      return next
    })

    // Create EventSource for SSE
    const url = new URL(`${backendUrl}/api/projects/create-with-progress`)
    
    // Use POST with fetch to send data, then connect SSE
    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: projectName, userId, os })
      })

      if (!response.ok) {
        throw new Error(`Failed to start project creation: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      // Read SSE stream
      const readStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            
            if (done) break

            const chunk = decoder.decode(value)
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = JSON.parse(line.substring(6))
                
                setCreatingProjects(prev => {
                  const next = new Map(prev)
                  const current = next.get(tempProjectId)
                  
                  if (current) {
                    next.set(tempProjectId, {
                      ...current,
                      step: data.step,
                      message: data.message,
                      progress: data.progress,
                      status: data.status,
                      error: data.error,
                      project: data.project,
                      projectId: data.project?.id || tempProjectId
                    })
                  }
                  
                  return next
                })

                // If complete or error, clean up after delay
                if (data.status === 'complete' || data.status === 'error') {
                  setTimeout(() => {
                    setCreatingProjects(prev => {
                      const next = new Map(prev)
                      next.delete(tempProjectId)
                      return next
                    })
                  }, 5000)
                }
              }
            }
          }
        } catch (error) {
          console.error('Error reading SSE stream:', error)
          setCreatingProjects(prev => {
            const next = new Map(prev)
            const current = next.get(tempProjectId)
            if (current) {
              next.set(tempProjectId, {
                ...current,
                status: 'error',
                error: error instanceof Error ? error.message : 'Stream error',
                progress: 0
              })
            }
            return next
          })
        }
      }

      readStream()

    } catch (error) {
      console.error('Failed to start project creation:', error)
      setCreatingProjects(prev => {
        const next = new Map(prev)
        next.set(tempProjectId, {
          projectId: tempProjectId,
          projectName,
          step: 'error',
          message: 'Failed to start project creation',
          progress: 0,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        return next
      })
    }

    return tempProjectId
  }, [])

  const cancelProjectCreation = useCallback((projectId: string) => {
    const eventSource = eventSourcesRef.current.get(projectId)
    if (eventSource) {
      eventSource.close()
      eventSourcesRef.current.delete(projectId)
    }
    
    setCreatingProjects(prev => {
      const next = new Map(prev)
      next.delete(projectId)
      return next
    })
  }, [])

  const getProjectProgress = useCallback((projectId: string) => {
    return creatingProjects.get(projectId)
  }, [creatingProjects])

  return {
    creatingProjects,
    startProjectCreation,
    cancelProjectCreation,
    getProjectProgress
  }
}
