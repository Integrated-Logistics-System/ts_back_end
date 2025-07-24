/**
 * Workflow Nodes Export
 * Centralized export for all workflow nodes
 */

export { BaseNode } from './base.node';
export { IntentAnalysisNode } from './intent-analysis.node';
export { RecipeSearchNode } from './recipe-search.node';
export { CookingHelpNode } from './cooking-help.node';
export { GeneralChatNode } from './general-chat.node';
export { ResponseIntegrationNode } from './response-integration.node';

// Import for registry
import { IntentAnalysisNode } from './intent-analysis.node';
import { RecipeSearchNode } from './recipe-search.node';
import { CookingHelpNode } from './cooking-help.node';
import { GeneralChatNode } from './general-chat.node';
import { ResponseIntegrationNode } from './response-integration.node';

/**
 * Node registry for dynamic node creation
 */
export const NodeRegistry = {
  IntentAnalysisNode,
  RecipeSearchNode,
  CookingHelpNode,
  GeneralChatNode,
  ResponseIntegrationNode,
} as const;

export type NodeType = keyof typeof NodeRegistry;