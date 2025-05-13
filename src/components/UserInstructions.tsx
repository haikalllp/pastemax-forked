import React, { useEffect, useState } from 'react';
import { DEFAULT_TASK_TYPES, STORAGE_KEY_CUSTOM_TASK_TYPES, TaskType } from '../types/TaskTypes';

/**
 * Props interface for the UserInstructions component
 * @property {string} instructions - The current instructions text
 * @property {function} setInstructions - Function to update instructions
 * @property {string} selectedTaskType - The ID of the selected task type
 */
interface UserInstructionsProps {
  instructions: string;
  setInstructions: (value: string) => void;
  selectedTaskType: string;
}

/**
 * UserInstructions Component
 *
 * This component provides a text area for users to enter custom instructions
 * that will be appended to the end of the copied content. This is useful for
 * adding context, requirements, or special notes when sharing code snippets.
 *
 * The component now also loads predefined prompts based on the selected task type.
 *
 * @param {string} instructions - Current instructions text value
 * @param {function} setInstructions - State setter function for updating instructions
 * @param {string} selectedTaskType - The ID of the selected task type
 * @returns {JSX.Element} - The rendered component
 */
const UserInstructions = ({
  instructions,
  setInstructions,
  selectedTaskType,
}: UserInstructionsProps): JSX.Element => {
  const [allTaskTypes, setAllTaskTypes] = useState(DEFAULT_TASK_TYPES);

  // Load custom task types
  useEffect(() => {
    const loadCustomTaskTypes = () => {
      const savedCustomTypes = localStorage.getItem(STORAGE_KEY_CUSTOM_TASK_TYPES);
      if (savedCustomTypes) {
        try {
          const customTypes = JSON.parse(savedCustomTypes);
          setAllTaskTypes([...DEFAULT_TASK_TYPES, ...customTypes]);
        } catch (error) {
          console.error('Error parsing custom task types:', error);
        }
      }
    };

    // Initial load
    loadCustomTaskTypes();

    // Listen for our custom event for task type updates
    const handleCustomTaskTypesUpdated = () => {
      loadCustomTaskTypes();
    };

    // Listen for both events
    window.addEventListener('customTaskTypesUpdated', handleCustomTaskTypesUpdated);

    return () => {
      window.removeEventListener('customTaskTypesUpdated', handleCustomTaskTypesUpdated);
    };
  }, []);

  // Update instructions when task type changes
  useEffect(() => {
    // Find the selected task type - load most current version from localStorage
    const loadCurrentTaskType = () => {
      // First check in memory
      let selectedTask = allTaskTypes.find((type: TaskType) => type.id === selectedTaskType);

      // If not found or to ensure latest version, check localStorage for custom types
      if (!selectedTask || selectedTask.isCustom) {
        const savedCustomTypes = localStorage.getItem(STORAGE_KEY_CUSTOM_TASK_TYPES);
        if (savedCustomTypes) {
          try {
            const customTypes = JSON.parse(savedCustomTypes);
            const freshCustomTask = customTypes.find(
              (type: TaskType) => type.id === selectedTaskType
            );
            if (freshCustomTask) {
              selectedTask = freshCustomTask;
            }
          } catch (error) {
            console.error('Error finding custom task type:', error);
          }
        }
      }

      // If we found the task, update instructions
      if (selectedTask) {
        setInstructions(selectedTask.prompt);
      }
    };

    loadCurrentTaskType();

    // Also listen for task type updates
    const handleCustomTaskTypesUpdated = () => {
      loadCurrentTaskType();
    };

    window.addEventListener('customTaskTypesUpdated', handleCustomTaskTypesUpdated);

    return () => {
      window.removeEventListener('customTaskTypesUpdated', handleCustomTaskTypesUpdated);
    };
  }, [selectedTaskType, setInstructions, allTaskTypes]);

  return (
    <>
      {/* Section header */}
      <div className="content-header">
        <div className="content-title">User Instructions</div>
      </div>

      {/* Instructions input container */}
      <div className="user-instructions-container">
        <div className="user-instructions">
          <textarea
            id="userInstructionsInput"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Enter your instructions here..."
            rows={10}
            style={{
              width: '100%',
              resize: 'none',
            }}
          />
        </div>
      </div>
    </>
  );
};

export default UserInstructions;
