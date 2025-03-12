export interface Message {
    role: 'user' | 'assistant';
    content: string;
    reasoning?: string;
    searchResults?: SearchResult[];
    fullTavilyData?: TavilyResponse;
    reasoningInput?: string;
  }
  
 export interface TavilyImage {
    url: string;
    description?: string;
  }
  
 export interface SearchResult {
    title: string;
    content: string;
    url: string;
    snippet?: string;
    score?: number;
    image?: TavilyImage;
  }
  
 export interface TavilyResponse {
    results: SearchResult[];
    images?: TavilyImage[];
    answer?: string;
    query?: string;
  }
  
 export interface ChatSection {
    query: string;
    searchResults: SearchResult[];
    reasoning: string;
    response: string;
    error?: string | null;
    isLoadingSources?: boolean;
    isLoadingThinking?: boolean;
    isReasoningCollapsed?: boolean;
  }
  
 export interface SuggestionType {
    label: string;
    prefix: string;
  }