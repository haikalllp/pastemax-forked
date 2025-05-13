import React, { useState, useEffect, useRef } from 'react';
import {
  TaskTypeSelectorProps,
  DEFAULT_TASK_TYPES,
  STORAGE_KEY_CUSTOM_TASK_TYPES,
  TaskType,
} from '../types/TaskTypes';

/**
 * TaskTypeSelector Component - Minimal design
 *
 * This component provides a dropdown to select different task types which will
 * automatically load predefined prompts for each type.
 *
 * @param {string} selectedTaskType - The currently selected task type ID
 * @param {function} onTaskTypeChange - Function to call when task type changes
 * @param {function} onManageCustomTypes - Function to call when the manage custom types button is clicked
 * @returns {JSX.Element} - The rendered component
 */
const TaskTypeSelector = ({
  selectedTaskType,
  onTaskTypeChange,
  onManageCustomTypes,
}: TaskTypeSelectorProps): JSX.Element => {
  const [isOpen, setIsOpen] = useState(false);
  const [allTaskTypes, setAllTaskTypes] = useState([] as TaskType[]);
  const dropdownRef = useRef(null as HTMLDivElement | null);

  // Load custom task types from localStorage and combine with default types
  useEffect(() => {
    const loadCustomTaskTypes = () => {
      const savedCustomTypes = localStorage.getItem(STORAGE_KEY_CUSTOM_TASK_TYPES);
      if (savedCustomTypes) {
        try {
          const customTypes = JSON.parse(savedCustomTypes);
          setAllTaskTypes([...DEFAULT_TASK_TYPES, ...customTypes]);
        } catch (error) {
          console.error('Error parsing custom task types:', error);
          setAllTaskTypes(DEFAULT_TASK_TYPES);
        }
      } else {
        setAllTaskTypes(DEFAULT_TASK_TYPES);
      }
    };

    // Load task types initially
    loadCustomTaskTypes();

    // Listen for custom task type updates
    const handleCustomTaskTypesUpdated = () => {
      loadCustomTaskTypes();
    };

    // Listen for both storage events and our custom event
    window.addEventListener('customTaskTypesUpdated', handleCustomTaskTypesUpdated);

    return () => {
      window.removeEventListener('customTaskTypesUpdated', handleCustomTaskTypesUpdated);
    };
  }, []); // Don't re-create event listeners unnecessarily

  // Get the currently selected task type object
  const selectedTask = allTaskTypes.find((type: TaskType) => type.id === selectedTaskType) ||
    allTaskTypes[0] || { id: 'default', label: 'Select Type', prompt: '' };

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle task type selection
  const handleTaskTypeSelect = (taskTypeId: string) => {
    onTaskTypeChange(taskTypeId);
    setIsOpen(false);
  };

  return (
    <div className="sidebar-task-type" ref={dropdownRef}>
      <div className="sidebar-title">Task Type</div>
      <div className="sidebar-task-type-selected" onClick={() => setIsOpen(!isOpen)}>
        <span className="sidebar-task-type-label">{selectedTask.label}</span>
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div className="sidebar-task-type-dropdown">
          {/* Default Task Types */}
          <div className="task-type-section">
            <div className="task-type-section-header">Default Types</div>
            {DEFAULT_TASK_TYPES.map((type: TaskType) => (
              <div
                key={type.id}
                className={`sidebar-task-type-option ${type.id === selectedTaskType ? 'selected' : ''}`}
                onClick={() => handleTaskTypeSelect(type.id)}
              >
                <div className="sidebar-task-type-option-label">{type.label}</div>
                {type.description && (
                  <div className="sidebar-task-type-option-description">{type.description}</div>
                )}
              </div>
            ))}
          </div>

          {/* Custom Task Types */}
          {allTaskTypes.length > DEFAULT_TASK_TYPES.length && (
            <div className="task-type-section">
              <div className="task-type-section-header">Custom Types</div>
              {allTaskTypes
                .filter((type: TaskType) => type.isCustom)
                .map((type: TaskType) => (
                  <div
                    key={type.id}
                    className={`sidebar-task-type-option ${
                      type.id === selectedTaskType ? 'selected' : ''
                    }`}
                    onClick={() => handleTaskTypeSelect(type.id)}
                  >
                    <div className="sidebar-task-type-option-label">{type.label}</div>
                    {type.description && (
                      <div className="sidebar-task-type-option-description">{type.description}</div>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* Manage Custom Types Button */}
          {onManageCustomTypes && (
            <div className="manage-custom-types-wrapper">
              <button className="manage-custom-types-button" onClick={onManageCustomTypes}>
                Manage Custom Task Types
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskTypeSelector;
