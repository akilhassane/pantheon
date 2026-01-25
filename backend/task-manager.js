/**
 * Task Manager
 * 
 * Manages task lists and tasks with Supabase persistence
 */

class TaskManager {
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error('Supabase client is required');
    }
    this.supabase = supabaseClient;
  }

  /**
   * Create a new task list
   */
  async createTaskList(projectId, name, userId, description = null) {
    console.log(`[TaskManager] Creating task list "${name}" for project ${projectId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('task_lists')
        .insert({
          project_id: projectId,
          name,
          description,
          created_by: userId
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`[TaskManager] ✅ Task list created: ${data.id}`);
      return data;
    } catch (error) {
      console.error('[TaskManager] ❌ Failed to create task list:', error.message);
      throw error;
    }
  }

  /**
   * Get all task lists for a project
   */
  async getTaskLists(projectId) {
    console.log(`[TaskManager] Getting task lists for project ${projectId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('task_lists')
        .select('*')
        .eq('project_id', projectId)
        .order('last_updated', { ascending: false });
      
      if (error) throw error;
      
      console.log(`[TaskManager] ✅ Found ${data.length} task lists`);
      return data;
    } catch (error) {
      console.error('[TaskManager] ❌ Failed to get task lists:', error.message);
      throw error;
    }
  }

  /**
   * Get a single task list by ID
   */
  async getTaskList(taskListId) {
    console.log(`[TaskManager] Getting task list ${taskListId}`);
    
    try {
      const { data, error} = await this.supabase
        .from('task_lists')
        .select('*')
        .eq('id', taskListId)
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('[TaskManager] ❌ Failed to get task list:', error.message);
      throw error;
    }
  }

  /**
   * Update a task list
   */
  async updateTaskList(taskListId, updates) {
    console.log(`[TaskManager] Updating task list ${taskListId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('task_lists')
        .update({
          ...updates,
          last_updated: new Date().toISOString()
        })
        .eq('id', taskListId)
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`[TaskManager] ✅ Task list updated`);
      return data;
    } catch (error) {
      console.error('[TaskManager] ❌ Failed to update task list:', error.message);
      throw error;
    }
  }

  /**
   * Delete a task list (cascades to tasks)
   */
  async deleteTaskList(taskListId) {
    console.log(`[TaskManager] Deleting task list ${taskListId}`);
    
    try {
      const { error } = await this.supabase
        .from('task_lists')
        .delete()
        .eq('id', taskListId);
      
      if (error) throw error;
      
      console.log(`[TaskManager] ✅ Task list deleted`);
    } catch (error) {
      console.error('[TaskManager] ❌ Failed to delete task list:', error.message);
      throw error;
    }
  }

  /**
   * Create a new task
   */
  async createTask(taskListId, taskData) {
    console.log(`[TaskManager] Creating task in list ${taskListId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('tasks')
        .insert({
          task_list_id: taskListId,
          title: taskData.title,
          description: taskData.description || null,
          command: taskData.command || null,
          status: 'pending'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`[TaskManager] ✅ Task created: ${data.id}`);
      return data;
    } catch (error) {
      console.error('[TaskManager] ❌ Failed to create task:', error.message);
      throw error;
    }
  }

  /**
   * Get all tasks for a task list
   */
  async getTasks(taskListId) {
    console.log(`[TaskManager] Getting tasks for list ${taskListId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('tasks')
        .select('*')
        .eq('task_list_id', taskListId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      console.log(`[TaskManager] ✅ Found ${data.length} tasks`);
      return data;
    } catch (error) {
      console.error('[TaskManager] ❌ Failed to get tasks:', error.message);
      throw error;
    }
  }

  /**
   * Get a single task by ID
   */
  async getTask(taskId) {
    console.log(`[TaskManager] Getting task ${taskId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('[TaskManager] ❌ Failed to get task:', error.message);
      throw error;
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId, status, result = null, error = null) {
    console.log(`[TaskManager] Updating task ${taskId} status to ${status}`);
    
    try {
      const updates = {
        status
      };
      
      if (status === 'running' && !result && !error) {
        updates.started_at = new Date().toISOString();
      }
      
      if (status === 'completed' || status === 'failed') {
        updates.completed_at = new Date().toISOString();
        if (result) updates.result = result;
        if (error) updates.error = error;
      }
      
      const { data, error: updateError } = await this.supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      console.log(`[TaskManager] ✅ Task status updated`);
      return data;
    } catch (err) {
      console.error('[TaskManager] ❌ Failed to update task status:', err.message);
      throw err;
    }
  }

  /**
   * Update a task
   */
  async updateTask(taskId, updates) {
    console.log(`[TaskManager] Updating task ${taskId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`[TaskManager] ✅ Task updated`);
      return data;
    } catch (error) {
      console.error('[TaskManager] ❌ Failed to update task:', error.message);
      throw error;
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId) {
    console.log(`[TaskManager] Deleting task ${taskId}`);
    
    try {
      const { error } = await this.supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);
      
      if (error) throw error;
      
      console.log(`[TaskManager] ✅ Task deleted`);
    } catch (error) {
      console.error('[TaskManager] ❌ Failed to delete task:', error.message);
      throw error;
    }
  }
}

module.exports = TaskManager;
