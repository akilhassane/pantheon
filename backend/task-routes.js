/**
 * Task Management API Routes
 */

const express = require('express');
const router = express.Router();

function setupTaskRoutes(taskManager, authenticate) {
  
  // POST /api/projects/:projectId/task-lists - Create task list
  router.post('/projects/:projectId/task-lists', authenticate, async (req, res) => {
    try {
      const { projectId } = req.params;
      const { name, description } = req.body;
      const userId = req.userId;
      
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      
      const taskList = await taskManager.createTaskList(projectId, name, userId, description);
      
      res.status(201).json({ success: true, taskList });
    } catch (error) {
      console.error('[TaskRoutes] Error creating task list:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // GET /api/projects/:projectId/task-lists - List task lists
  router.get('/projects/:projectId/task-lists', authenticate, async (req, res) => {
    try {
      const { projectId } = req.params;
      
      const taskLists = await taskManager.getTaskLists(projectId);
      
      res.json({ success: true, taskLists });
    } catch (error) {
      console.error('[TaskRoutes] Error getting task lists:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // PUT /api/task-lists/:id - Update task list
  router.put('/task-lists/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const taskList = await taskManager.updateTaskList(id, updates);
      
      res.json({ success: true, taskList });
    } catch (error) {
      console.error('[TaskRoutes] Error updating task list:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // DELETE /api/task-lists/:id - Delete task list
  router.delete('/task-lists/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      
      await taskManager.deleteTaskList(id);
      
      res.json({ success: true });
    } catch (error) {
      console.error('[TaskRoutes] Error deleting task list:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/task-lists/:listId/tasks - Create task
  router.post('/task-lists/:listId/tasks', authenticate, async (req, res) => {
    try {
      const { listId } = req.params;
      const taskData = req.body;
      
      if (!taskData.title) {
        return res.status(400).json({ error: 'Title is required' });
      }
      
      const task = await taskManager.createTask(listId, taskData);
      
      res.status(201).json({ success: true, task });
    } catch (error) {
      console.error('[TaskRoutes] Error creating task:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // GET /api/task-lists/:listId/tasks - List tasks
  router.get('/task-lists/:listId/tasks', authenticate, async (req, res) => {
    try {
      const { listId } = req.params;
      
      const tasks = await taskManager.getTasks(listId);
      
      res.json({ success: true, tasks });
    } catch (error) {
      console.error('[TaskRoutes] Error getting tasks:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // PUT /api/tasks/:id - Update task
  router.put('/tasks/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const task = await taskManager.updateTask(id, updates);
      
      res.json({ success: true, task });
    } catch (error) {
      console.error('[TaskRoutes] Error updating task:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // PATCH /api/tasks/:id/status - Update task status
  router.patch('/tasks/:id/status', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, result, error } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }
      
      const task = await taskManager.updateTaskStatus(id, status, result, error);
      
      res.json({ success: true, task });
    } catch (error) {
      console.error('[TaskRoutes] Error updating task status:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // DELETE /api/tasks/:id - Delete task
  router.delete('/tasks/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      
      await taskManager.deleteTask(id);
      
      res.json({ success: true });
    } catch (error) {
      console.error('[TaskRoutes] Error deleting task:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  return router;
}

module.exports = { setupTaskRoutes };
