import type Anthropic from '@anthropic-ai/sdk';

export function getCoreTools(): Anthropic.Tool[] {
  return [
    {
      name: 'Bash',
      description: 'Execute a shell command',
      input_schema: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          timeout: { type: 'number' },
          description: { type: 'string' },
          run_in_background: { type: 'boolean' }
        },
        required: ['command']
      }
    },
    {
      name: 'Read',
      description: 'Read a file',
      input_schema: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
          offset: { type: 'number' },
          limit: { type: 'number' }
        },
        required: ['file_path']
      }
    },
    {
      name: 'Write',
      description: 'Write content to a file',
      input_schema: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['file_path', 'content']
      }
    },
    {
      name: 'Edit',
      description: 'Edit a file by replacing a string',
      input_schema: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
          old_string: { type: 'string' },
          new_string: { type: 'string' },
          replace_all: { type: 'boolean' }
        },
        required: ['file_path', 'old_string', 'new_string']
      }
    },
    {
      name: 'Glob',
      description: 'Find files by glob pattern',
      input_schema: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          path: { type: 'string' }
        },
        required: ['pattern']
      }
    },
    {
      name: 'Grep',
      description: 'Search text using ripgrep',
      input_schema: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          path: { type: 'string' },
          glob: { type: 'string' },
          output_mode: { type: 'string' },
          '-i': { type: 'boolean' },
          '-n': { type: 'boolean' },
          '-B': { type: 'number' },
          '-A': { type: 'number' },
          '-C': { type: 'number' },
          head_limit: { type: 'number' },
          multiline: { type: 'boolean' }
        },
        required: ['pattern']
      }
    },
    {
      name: 'WebFetch',
      description: 'Fetch a URL and return markdown content',
      input_schema: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          prompt: { type: 'string' }
        },
        required: ['url', 'prompt']
      }
    },
    {
      name: 'TodoWrite',
      description: 'Store todo list updates',
      input_schema: {
        type: 'object',
        properties: {
          todos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                content: { type: 'string' },
                status: { type: 'string' },
                activeForm: { type: 'string' }
              },
              required: ['content', 'status', 'activeForm']
            }
          }
        },
        required: ['todos']
      }
    },
    {
      name: 'Task',
      description: 'Delegate work to a sub-agent',
      input_schema: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          prompt: { type: 'string' },
          subagent_type: { type: 'string' },
          model: { type: 'string' },
          run_in_background: { type: 'boolean' }
        },
        required: ['description', 'prompt', 'subagent_type']
      }
    },
    {
      name: 'AskUserQuestion',
      description: 'Ask the user a question with options',
      input_schema: {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                header: { type: 'string' },
                options: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      label: { type: 'string' },
                      description: { type: 'string' }
                    },
                    required: ['label', 'description']
                  }
                },
                multiSelect: { type: 'boolean' }
              },
              required: ['question', 'header', 'options']
            }
          }
        },
        required: ['questions']
      }
    }
  ];
}
