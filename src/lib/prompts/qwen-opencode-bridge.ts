export const QWEN_OPENCODE_BRIDGE = `# Tool Mapping for OpenCode

You are running in OpenCode, which uses different tool names than Qwen Code.

## Tool Substitutions

When you want to use Qwen Code tools, use these OpenCode equivalents:

### File Operations
- Qwen Code: \`read_file\` -> OpenCode: \`read\`
- Qwen Code: \`write_file\` -> OpenCode: \`edit\`
- Qwen Code: \`list_directory\` -> OpenCode: \`ls\`

### Search Operations
- Qwen Code: \`search_files\` -> OpenCode: \`glob\`
- Qwen Code: \`grep_search\` -> OpenCode: \`grep\`

### Execution
- Qwen Code: \`execute_command\` -> OpenCode: \`bash\`

### Planning (if available)
- Qwen Code: \`update_plan\` -> OpenCode: \`todowrite\`
- Qwen Code: \`read_plan\` -> OpenCode: \`todoread\`

## Available OpenCode Tools

You have access to these OpenCode tools:
- \`read\`: Read file contents
- \`edit\`: Edit files
- \`ls\`: List directory contents
- \`glob\`: Search for files by pattern
- \`grep\`: Search file contents
- \`bash\`: Execute shell commands
- \`todowrite\`: Write to task list
- \`todoread\`: Read task list

## Working Style

- Use OpenCode tool names in your tool calls
- Follow OpenCode's tool call format (JSON-based)
- Be concise and direct in responses
- Minimize output tokens while maintaining quality
`

export const QWEN_TOOL_REMAP_MESSAGE = `# Tool Remapping

Note: Some tool names may differ from standard Qwen Code tools. Use the tools available in OpenCode:
- \`read\`, \`edit\`, \`ls\`, \`glob\`, \`grep\`, \`bash\`, \`todowrite\`, \`todoread\`
`
