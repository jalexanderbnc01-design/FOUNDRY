/**
 * Foundry AI Tool Registry for controlled workspace operations & tool calling
 */
export interface AiWorkspaceTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: any, context: { elements: any[]; selectedIds: string[]; dispatch: any }) => any;
}

class AiToolRegistryService {
  private tools: Map<string, AiWorkspaceTool> = new Map();

  registerTool(tool: AiWorkspaceTool) {
    this.tools.set(tool.name, tool);
  }

  getTools(): AiWorkspaceTool[] {
    return Array.from(this.tools.values());
  }

  async executeTool(name: string, args: any, context: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`AI Tool not found: ${name}`);
    }
    return await tool.execute(args, context);
  }
}

export const aiToolRegistry = new AiToolRegistryService();

// Register default built-in workspace tools
aiToolRegistry.registerTool({
  name: "get_workspace_summary",
  description: "Returns summary statistics of elements on the current board (count by type, titles, tags).",
  parameters: {},
  execute: (_, { elements }) => {
    const counts: Record<string, number> = {};
    elements.forEach((el) => {
      counts[el.type] = (counts[el.type] || 0) + 1;
    });
    return {
      totalElements: elements.length,
      elementTypes: counts,
      titles: elements.filter((e) => e.title || e.content).map((e) => e.title || e.content?.substring(0, 40)),
    };
  },
});

aiToolRegistry.registerTool({
  name: "get_selected_elements",
  description: "Returns detailed data for currently selected canvas objects.",
  parameters: {},
  execute: (_, { elements, selectedIds }) => {
    return elements.filter((el) => selectedIds.includes(el.id));
  },
});

aiToolRegistry.registerTool({
  name: "search_workspace",
  description: "Search workspace elements matching query text in titles or content.",
  parameters: { query: "string" },
  execute: ({ query }, { elements }) => {
    const q = (query || "").toLowerCase();
    return elements.filter(
      (el) =>
        (el.content && el.content.toLowerCase().includes(q)) ||
        (el.title && el.title.toLowerCase().includes(q)) ||
        (el.fileName && el.fileName.toLowerCase().includes(q))
    );
  },
});
