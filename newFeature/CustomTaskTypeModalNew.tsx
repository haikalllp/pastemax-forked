import React from 'react';
import { useState, useEffect } from 'react';
import { TaskType, STORAGE_KEY_CUSTOM_TASK_TYPES } from '../types/TaskTypes';

interface CustomTaskTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskTypesUpdated: () => void;
}

const CustomTaskTypeModal = ({
  isOpen,
  onClose,
  onTaskTypesUpdated,
}: CustomTaskTypeModalProps): JSX.Element | null => {
  const [customTaskTypes, setCustomTaskTypes] = useState([] as TaskType[]);
  const [newTaskType, setNewTaskType] = useState({
    id: '',
    label: '',
    description: '',
    prompt: '',
    isCustom: true,
  } as TaskType);
  const [editingIndex, setEditingIndex] = useState(null as number | null);
  const [validationError, setValidationError] = useState('');

  // Load custom task types from localStorage
  useEffect(() => {
    if (isOpen) {
      const savedCustomTypes = localStorage.getItem(STORAGE_KEY_CUSTOM_TASK_TYPES);
      if (savedCustomTypes) {
        try {
          setCustomTaskTypes(JSON.parse(savedCustomTypes));
        } catch (error) {
          console.error('Error parsing custom task types:', error);
          setCustomTaskTypes([]);
        }
      }
    }
  }, [isOpen]);

  // Reset form when opening modal
  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setNewTaskType({
      id: '',
      label: '',
      description: '',
      prompt: '',
      isCustom: true,
    } as TaskType);
    setEditingIndex(null);
    setValidationError('');
  };

  const handleInputChange = (e: { target: { name: string; value: string } }) => {
    const { name, value } = e.target;

    setNewTaskType((prev: TaskType) => {
      // If we're changing the label, automatically update the ID to be URL-friendly
      if (name === 'label' && editingIndex === null) {
        const generatedId = value
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
        return { ...prev, [name]: value, id: generatedId };
      }
      return { ...prev, [name]: value };
    });
  };

  const validateTaskType = (): boolean => {
    if (!newTaskType.label.trim()) {
      setValidationError('Task type name is required.');
      return false;
    }

    // Check for duplicate names if not editing
    if (editingIndex === null) {
      const isDuplicate = customTaskTypes.some(
        (type: TaskType) => type.label.toLowerCase() === newTaskType.label.toLowerCase()
      );
      if (isDuplicate) {
        setValidationError('A task type with this name already exists.');
        return false;
      }
    }

    return true;
  };

  const handleSaveTaskType = () => {
    if (!validateTaskType()) return;

    let updatedTaskTypes: TaskType[];

    if (editingIndex !== null) {
      // Editing existing task type
      updatedTaskTypes = [...customTaskTypes];
      updatedTaskTypes[editingIndex] = newTaskType;
    } else {
      // Adding new task type
      updatedTaskTypes = [...customTaskTypes, newTaskType];
    }

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY_CUSTOM_TASK_TYPES, JSON.stringify(updatedTaskTypes));
    setCustomTaskTypes(updatedTaskTypes);

    // Dispatch a custom event to notify components of the change
    window.dispatchEvent(new CustomEvent('customTaskTypesUpdated'));

    // Notify parent component of update
    onTaskTypesUpdated();

    // Reset form
    resetForm();
  };

  const handleEditTaskType = (index: number) => {
    setEditingIndex(index);
    setNewTaskType({ ...customTaskTypes[index] });
  };

  const handleDeleteTaskType = (index: number) => {
    const updatedTaskTypes = [...customTaskTypes];
    updatedTaskTypes.splice(index, 1);

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY_CUSTOM_TASK_TYPES, JSON.stringify(updatedTaskTypes));
    setCustomTaskTypes(updatedTaskTypes);

    // Dispatch a custom event to notify components of the change
    window.dispatchEvent(new CustomEvent('customTaskTypesUpdated'));

    // If editing the task type that's being deleted, reset the form
    if (editingIndex === index) {
      resetForm();
    } else if (editingIndex !== null && editingIndex > index) {
      // Adjust editing index if we're editing a task type that comes after the deleted one
      setEditingIndex(editingIndex - 1);
    }

    // Notify parent component of update
    onTaskTypesUpdated();
  };

  if (!isOpen) return null;

  return (
    <div className="custom-task-type-modal-overlay">
      <div className="custom-task-type-modal">
        <div className="custom-task-type-modal-header">
          <h2>{editingIndex !== null ? 'Edit' : 'Add'} Custom Task Type</h2>
          <button className="close-button" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="custom-task-type-modal-content">
          <div className="task-type-form">
            <div className="form-group">
              <label htmlFor="task-type-name">Task Type Name</label>
              <input
                id="task-type-name"
                name="label"
                type="text"
                value={newTaskType.label}
                onChange={handleInputChange}
                placeholder="Enter task type name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="task-type-description">Description (Optional)</label>
              <input
                id="task-type-description"
                name="description"
                type="text"
                value={newTaskType.description || ''}
                onChange={handleInputChange}
                placeholder="Enter a short description"
              />
            </div>

            <div className="form-group">
              <label htmlFor="task-type-prompt">Task Type Prompt</label>
              <textarea
                id="task-type-prompt"
                name="prompt"
                value={newTaskType.prompt}
                onChange={handleInputChange}
                placeholder="Enter task type prompt"
                rows={8}
              />
            </div>

            {validationError && <div className="validation-error">{validationError}</div>}

            <div className="form-actions">
              <button className="cancel-button" onClick={resetForm}>
                Cancel
              </button>
              <button className="save-button" onClick={handleSaveTaskType}>
                {editingIndex !== null ? 'Update' : 'Add'} Task Type
              </button>
            </div>
          </div>

          <div className="existing-task-types">
            <h3>Existing Custom Task Types</h3>
            {customTaskTypes.length === 0 ? (
              <div className="no-task-types">No custom task types created yet.</div>
            ) : (
              <div className="task-type-list">
                {customTaskTypes.map((taskType: TaskType, index: number) => (
                  <div key={taskType.id} className="task-type-item">
                    <div className="task-type-info">
                      <div className="task-type-name">{taskType.label}</div>
                      {taskType.description && (
                        <div className="task-type-description">{taskType.description}</div>
                      )}
                    </div>
                    <div className="task-type-actions">
                      <button
                        className="edit-button"
                        onClick={() => handleEditTaskType(index)}
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        className="delete-button"
                        onClick={() => handleDeleteTaskType(index)}
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomTaskTypeModal;
