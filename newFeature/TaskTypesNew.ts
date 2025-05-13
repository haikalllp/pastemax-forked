export interface TaskType {
  id: string;
  label: string;
  description?: string;
  prompt: string;
  isCustom?: boolean;
}

export interface TaskTypeSelectorProps {
  selectedTaskType: string;
  onTaskTypeChange: (taskTypeId: string) => void;
  onManageCustomTypes?: () => void;
}

export const STORAGE_KEY_TASK_TYPE = 'selectedTaskType';
export const STORAGE_KEY_CUSTOM_TASK_TYPES = 'customTaskTypes';

export const DEFAULT_TASK_TYPES: TaskType[] = [
  {
    id: 'none',
    label: 'None',
    description: '',
    prompt: '',
  },
  {
    id: 'feature',
    label: 'Feature',
    description: 'Implement a new feature',
    prompt: `You are tasked to implement a feature. Instructions are as follows:

Instructions for the output format:
- Output code without descriptions, unless it is important.
- Minimize prose, comments and empty lines.
- Only show the relevant code that needs to be modified. Use comments to represent the parts that are not modified.
- Make it easy to copy and paste.
- Consider other possibilities to achieve the result, do not be limited by the prompt.`,
  },
  {
    id: 'refactor',
    label: 'Refactor',
    description: 'Refactor an existing codebase',
    prompt: `You are an expert code refactorer. Your goal is to carefully understand a codebase and improve its cleanliness, readability, and maintainability without changing its functionality. Follow these guidelines:

- Identify code smells and technical debt
- Apply SOLID principles and design patterns where appropriate
- Improve naming, organization, and structure
- Reduce duplication and complexity
- Optimize for readability and maintainability
- Provide clear explanations of your changes and why they improve the code`,
  },
  {
    id: 'question',
    label: 'Question',
    description: 'Ask a general coding question',
    prompt: `You are an experienced engineer who helps people understand a codebase or concept. You provide detailed, accurate explanations that are tailored to the user's level of understanding. For code-related questions:

- Analyze the code thoroughly before answering
- Explain how different parts of the code interact
- Use concrete examples to illustrate concepts
- Suggest best practices when relevant
- Be concise but comprehensive in your explanations`,
  },
  {
    id: 'debug',
    label: 'Debug',
    description: 'Help debug an issue',
    prompt: `You are a experienced debugger. Your task is to help the user debug their code. Given a description of a bug in a codebase, you'll:

- Analyze the symptoms and error messages
- Identify potential causes of the issue
- Suggest diagnostic approaches and tests
- Recommend specific fixes with code examples
- Explain why the bug occurred and how the fix resolves it
- Suggest preventative measures for similar bugs in the future`,
  },
];
